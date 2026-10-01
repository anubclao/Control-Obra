// @vitest-environment node
/**
 * tests/verifiers/cuts-payments-integrity.spec.ts
 *
 * Verifier de docs/specs/bug-cortes-pagos-integridad.md (AC-1 a AC-8).
 *
 * Handlers reales de /api/cuts, /api/payments y /api/projects con la capa de
 * auth real; solo se simulan cookie (next/headers), firma de sesión y BD.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({
  sessionUser: null as null | { id: string; role: string },
  cutStatus: "DRAFT",
  cutRetention: 10,
  cutAdvance: 0,
  cutItems: [] as Array<{ quantity: number; unit_price: number }>,
  paymentStatus: "PENDING",
}));

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.sessionUser ? { value: "firmada" } : undefined),
    delete: () => {},
  }),
}));

vi.mock("@/lib/session", () => ({
  SESSION_COOKIE: "session",
  verifySessionCookie: (v: string | undefined) =>
    v ? (state.sessionUser?.id ?? null) : null,
}));

vi.mock("@/lib/db", () => ({
  query: queryMock,
  pool: {},
  transaction: async (fn: (conn: unknown) => unknown) =>
    fn({
      // mysql2/promise.execute devuelve [rows, fields]. La ruta PATCH
      // hace `const [lockRows] = await conn.execute(...)` para tomar
      // SELECT ... FOR UPDATE, asi que el mock debe respetar ese
      // contrato y devolver la tupla [rows].
      execute: async (sql: string, args: unknown[]) => {
        const result = await queryMock(sql, args);
        // Si el mock ya devolvio una tupla (por ejemplo, un INSERT que
        // devuelve ResultSetHeader), se respeta tal cual. Si devolvio
        // un array plano, lo envolvemos para que el destructuring
        // funcione.
        if (Array.isArray(result) && Array.isArray(result[0])) {
          return result;
        }
        return [result];
      },
    }),
}));

import { computeCutTotals } from "@/lib/cuts-workflow";
import * as cutsRoute from "@/app/api/cuts/route";
import * as paymentsRoute from "@/app/api/payments/route";
import * as projectsRoute from "@/app/api/projects/route";

function setupDb() {
  queryMock.mockImplementation(async (sql: string) => {
    if (/WHERE id = \? AND status = 'ACTIVE'/.test(sql)) {
      const u = state.sessionUser;
      return u
        ? [
            {
              id: u.id,
              email: "s@x.com",
              name: "Sesión",
              role: u.role,
              area: "tecnico",
            },
          ]
        : [];
    }
    if (/FROM work_cut_items/i.test(sql) && /^\s*SELECT/i.test(sql))
      return state.cutItems;
    if (/FROM work_cuts/i.test(sql) && /^\s*SELECT/i.test(sql)) {
      return [
        {
          status: state.cutStatus,
          retention_percent: state.cutRetention,
          advance_deduction: state.cutAdvance,
        },
      ];
    }
    if (/FROM payment_requests/i.test(sql) && /^\s*SELECT/i.test(sql)) {
      return [
        {
          status: state.paymentStatus,
          required_approval_level: 1,
          current_approval_level: 0,
        },
      ];
    }
    if (/^\s*SELECT/i.test(sql)) return [];
    return { affectedRows: 1 };
  });
}

function writes(pattern = /^\s*(INSERT|UPDATE|DELETE)/i) {
  return queryMock.mock.calls.filter((c) => pattern.test(String(c[0])));
}

function req(url: string, method: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function login(role: string, id = `${role.toLowerCase()}-1`) {
  state.sessionUser = { id, role };
}

beforeEach(() => {
  queryMock.mockReset();
  setupDb();
  state.sessionUser = null;
  state.cutStatus = "DRAFT";
  state.cutRetention = 10;
  state.cutAdvance = 0;
  state.cutItems = [];
  state.paymentStatus = "PENDING";
});

// ──────────────────────────────────────────────────────────────
describe("AC-1 · Acciones de workflow sin sesión → 401", () => {
  it("PATCH /api/cuts", async () => {
    const res = await cutsRoute.PATCH(
      req("/api/cuts", "PATCH", {
        id: "c1",
        action: "APPROVE",
        user: { id: "x", role: "ADMIN" },
      }),
    );
    expect(res.status).toBe(401);
    expect(writes()).toEqual([]);
  });

  it("PATCH /api/payments", async () => {
    const res = await paymentsRoute.PATCH(
      req("/api/payments", "PATCH", {
        id: "p1",
        action: "PAY",
        user: { id: "x", role: "ADMIN" },
      }),
    );
    expect(res.status).toBe(401);
    expect(writes()).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────
describe("AC-2 · El rol sale de la sesión, no del body", () => {
  it("RESIDENTE que dice ser ADMIN no puede aprobar un corte", async () => {
    login("RESIDENTE");
    state.cutStatus = "VALIDATED";
    const res = await cutsRoute.PATCH(
      req("/api/cuts", "PATCH", {
        id: "c1",
        action: "APPROVE",
        user: { id: "admin-falso", role: "ADMIN" },
      }),
    );
    expect(res.status).toBe(403);
    expect(writes()).toEqual([]);
  });

  it("RESIDENTE que dice ser TESORERIA no puede pagar", async () => {
    login("RESIDENTE");
    state.paymentStatus = "APPROVED";
    const res = await paymentsRoute.PATCH(
      req("/api/payments", "PATCH", {
        id: "p1",
        action: "PAY",
        user: { id: "t-falso", role: "TESORERIA" },
      }),
    );
    expect(res.status).toBe(403);
    expect(writes()).toEqual([]);
  });

  it("la auditoría del corte registra al usuario de la sesión", async () => {
    login("RESIDENTE", "res-7");
    const res = await cutsRoute.PATCH(
      req("/api/cuts", "PATCH", {
        id: "c1",
        action: "SUBMIT",
        user: { id: "otro", name: "Otro", role: "ADMIN" },
      }),
    );
    expect(res.status).toBe(200);
    const [, args] = writes(/INSERT INTO work_cut_approvals/)[0];
    expect(args).toContain("res-7");
    expect(args).toContain("RESIDENTE");
    expect(args).not.toContain("otro");
    expect(args).not.toContain("ADMIN");
  });

  it("la auditoría del pago registra al usuario de la sesión", async () => {
    login("DIRECTOR", "dir-3");
    const res = await paymentsRoute.PATCH(
      req("/api/payments", "PATCH", {
        id: "p1",
        action: "APPROVE_L1",
        user: { id: "otro", role: "ADMIN" },
      }),
    );
    expect(res.status).toBe(200);
    const [, args] = writes(/INSERT INTO payment_approvals/)[0];
    expect(args).toContain("dir-3");
    expect(args).toContain("DIRECTOR");
    expect(args).not.toContain("otro");
  });

  it("ya no exige body.user", async () => {
    login("RESIDENTE");
    const res = await cutsRoute.PATCH(
      req("/api/cuts", "PATCH", { id: "c1", action: "SUBMIT" }),
    );
    expect(res.status).toBe(200);
  });
});

// ──────────────────────────────────────────────────────────────
describe("AC-3 · computeCutTotals", () => {
  it("calcula bruto, retención redondeada y neto", () => {
    const t = computeCutTotals(
      [
        { quantity: 3, unitPrice: 1000 },
        { quantity: 2.5, unitPrice: 333 },
      ],
      10,
      500,
    );
    expect(t.items.map((i) => i.totalPrice)).toEqual([3000, 832.5]);
    expect(t.grossValue).toBe(3832.5);
    expect(t.retentionValue).toBe(383);
    expect(t.netValue).toBe(3832.5 - 383 - 500);
  });

  it("tolera valores vacíos o no numéricos como 0", () => {
    const t = computeCutTotals(
      [{ quantity: undefined as unknown as number, unitPrice: 100 }],
      undefined as unknown as number,
      "" as unknown as number,
    );
    expect(t).toMatchObject({ grossValue: 0, retentionValue: 0, netValue: 0 });
  });
});

// ──────────────────────────────────────────────────────────────
const cutBody = {
  projectId: "pr1",
  providerId: "pv1",
  description: "Corte 1",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  retentionPercent: 10,
  advanceDeduction: 1000,
  items: [
    {
      description: "Muro",
      unit: "m2",
      quantity: 10,
      unitPrice: 5000,
      totalPrice: 999999999,
    },
  ],
  grossValue: 999999999,
  retentionValue: 0,
  netValue: 999999999,
  createdBy: "falso",
};

describe("AC-4 · POST /api/cuts calcula los totales en el servidor", () => {
  beforeEach(() => login("RESIDENTE", "res-1"));

  it("ignora los totales del body", async () => {
    const res = await cutsRoute.POST(req("/api/cuts", "POST", cutBody));
    expect(res.status).toBe(201);
    const [, cutArgs] = writes(/INSERT INTO work_cuts/)[0];
    // gross = 10 × 5000 = 50000; retención 10% = 5000; neto = 50000 − 5000 − 1000
    expect(cutArgs).toEqual(expect.arrayContaining([50000, 5000, 44000]));
    expect(cutArgs).not.toContain(999999999);
    const [, itemArgs] = writes(/INSERT INTO work_cut_items/)[0];
    expect(itemArgs).toContain(50000);
    expect(itemArgs).not.toContain(999999999);
  });

  it("created_by = usuario de la sesión (AC-7)", async () => {
    await cutsRoute.POST(req("/api/cuts", "POST", cutBody));
    const [, cutArgs] = writes(/INSERT INTO work_cuts/)[0];
    expect(cutArgs).toContain("res-1");
    expect(cutArgs).not.toContain("falso");
  });

  it("la respuesta devuelve los totales del servidor", async () => {
    const res = await cutsRoute.POST(req("/api/cuts", "POST", cutBody));
    const body = await res.json();
    expect(body).toMatchObject({
      grossValue: 50000,
      retentionValue: 5000,
      netValue: 44000,
    });
  });
});

// ──────────────────────────────────────────────────────────────
describe("AC-5 · PUT /api/cuts recalcula y no acepta status ni totales", () => {
  beforeEach(() => login("RESIDENTE"));

  it("con ítems nuevos recalcula totales e ignora los del body", async () => {
    const res = await cutsRoute.PUT(
      req("/api/cuts", "PUT", { id: "c1", ...cutBody }),
    );
    expect(res.status).toBe(200);
    const updates = writes(/UPDATE work_cuts SET/);
    const allArgs = updates.flatMap(([, a]) => a as unknown[]);
    expect(allArgs).toEqual(expect.arrayContaining([50000, 5000, 44000]));
    expect(allArgs).not.toContain(999999999);
  });

  it("si solo cambia el % de retención, recalcula con los ítems guardados", async () => {
    state.cutItems = [{ quantity: 4, unit_price: 2500 }];
    state.cutAdvance = 0;
    await cutsRoute.PUT(
      req("/api/cuts", "PUT", { id: "c1", retentionPercent: 5 }),
    );
    const allArgs = writes(/UPDATE work_cuts SET/).flatMap(
      ([, a]) => a as unknown[],
    );
    // gross = 10000; retención 5% = 500; neto = 9500
    expect(allArgs).toEqual(expect.arrayContaining([10000, 500, 9500]));
  });

  it("ignora status y rejectionReason del body", async () => {
    await cutsRoute.PUT(
      req("/api/cuts", "PUT", {
        id: "c1",
        description: "x",
        status: "APPROVED",
        rejectionReason: "y",
      }),
    );
    const sqls = writes(/UPDATE work_cuts SET/).map(([sql]) => String(sql));
    expect(sqls.join(" ")).not.toMatch(/\bstatus\s*=/);
    expect(sqls.join(" ")).not.toMatch(/rejection_reason\s*=/);
  });
});

// ──────────────────────────────────────────────────────────────
describe("AC-6 · No se editan cortes/pagos fuera de su estado editable", () => {
  it.each(["SUBMITTED", "VALIDATED", "APPROVED", "PAID"])(
    "PUT /api/cuts sobre corte %s → 409",
    async (status) => {
      login("RESIDENTE");
      state.cutStatus = status;
      const res = await cutsRoute.PUT(
        req("/api/cuts", "PUT", { id: "c1", ...cutBody }),
      );
      expect(res.status).toBe(409);
      expect(writes()).toEqual([]);
    },
  );

  it.each(["DRAFT", "REJECTED"])(
    "PUT /api/cuts sobre corte %s → 200",
    async (status) => {
      login("RESIDENTE");
      state.cutStatus = status;
      const res = await cutsRoute.PUT(
        req("/api/cuts", "PUT", { id: "c1", description: "ok" }),
      );
      expect(res.status).toBe(200);
    },
  );

  it.each(["APPROVED_LEVEL_1", "APPROVED", "PAID", "REJECTED", "CANCELLED"])(
    "PUT /api/payments sobre pago %s → 409",
    async (status) => {
      login("CONTABILIDAD");
      state.paymentStatus = status;
      const res = await paymentsRoute.PUT(
        req("/api/payments", "PUT", { id: "p1", amount: 1 }),
      );
      expect(res.status).toBe(409);
      expect(writes()).toEqual([]);
    },
  );

  it("PUT /api/payments sobre pago PENDING → 200", async () => {
    login("CONTABILIDAD");
    const res = await paymentsRoute.PUT(
      req("/api/payments", "PUT", { id: "p1", amount: 1 }),
    );
    expect(res.status).toBe(200);
  });
});

// ──────────────────────────────────────────────────────────────
describe("AC-7 · created_by del pago = usuario de la sesión", () => {
  it("POST /api/payments", async () => {
    login("CONTABILIDAD", "cont-2");
    const res = await paymentsRoute.POST(
      req("/api/payments", "POST", {
        projectId: "pr1",
        amount: 100,
        type: "CUT",
        beneficiaryName: "B",
        beneficiaryNit: "1",
        accountNumber: "1",
        createdBy: "falso",
      }),
    );
    expect(res.status).toBe(201);
    const [, args] = writes(/INSERT INTO payment_requests/)[0];
    expect(args).toContain("cont-2");
    expect(args).not.toContain("falso");
  });
});

// ──────────────────────────────────────────────────────────────
describe("AC-8 · GET /api/projects exige sesión", () => {
  it("sin sesión → 401", async () => {
    const res = await projectsRoute.GET(req("/api/projects", "GET"));
    expect(res.status).toBe(401);
  });

  it("con sesión → 200", async () => {
    login("RESIDENTE");
    const res = await projectsRoute.GET(req("/api/projects", "GET"));
    expect(res.status).toBe(200);
  });
});
