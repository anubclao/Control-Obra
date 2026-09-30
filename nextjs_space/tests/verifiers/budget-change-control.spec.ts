// @vitest-environment node
/**
 * tests/verifiers/budget-change-control.spec.ts
 *
 * Verifier de docs/specs/budget-change-control.md.
 *   - AC-1..AC-8: funciones puras de lib/budget-change-control.ts
 *   - AC-2, AC-5, AC-9, AC-10: ruta /api/budget-change-orders con BD simulada
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─────────────────────────── BD / sesión simuladas ───────────────────────────
const db = vi.hoisted(() => ({
  sessionUser: null as null | { id: string; role: string },
  aiu: { administration: 8, imprevistos: 5, utilidad: 5 } as null | Record<string, number>,
  budget: { id: "b1", project_id: "p1", total_value: 100_000_000, client_value: 120_000_000, change_order_seq: 0 },
  maxVersion: 2,
  co: null as null | Record<string, unknown>,
  coItems: [] as Array<Record<string, unknown>>,
}));
const queryMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (db.sessionUser ? { value: "firmada" } : undefined),
    delete: () => {},
  }),
}));
vi.mock("@/lib/session", () => ({
  SESSION_COOKIE: "session",
  verifySessionCookie: (v: string | undefined) => (v ? db.sessionUser?.id ?? null : null),
}));

function fakeDb(sql: string): unknown {
  if (/WHERE id = \? AND status = 'ACTIVE'/.test(sql)) {
    const u = db.sessionUser;
    return u ? [{ id: u.id, email: "s@x.com", name: `Nombre ${u.id}`, role: u.role, area: "tecnico" }] : [];
  }
  if (/FROM aiu_configs/i.test(sql)) return db.aiu ? [db.aiu] : [];
  if (/MAX\(version\)/i.test(sql)) return [{ max_version: db.maxVersion }];
  if (/FROM budgets/i.test(sql) && /^\s*SELECT/i.test(sql)) return [db.budget];
  if (/FROM budget_change_order_items/i.test(sql) && /^\s*SELECT/i.test(sql)) return db.coItems;
  if (/FROM budget_change_orders/i.test(sql) && /^\s*SELECT/i.test(sql)) return db.co ? [db.co] : [];
  if (/^\s*SELECT/i.test(sql)) return [];
  return { affectedRows: 1 };
}

vi.mock("@/lib/db", () => ({
  query: queryMock,
  pool: {},
  transaction: async (fn: (conn: unknown) => unknown) => {
    const run = async (sql: string, args: unknown[]) => [await queryMock(sql, args)];
    return fn({ execute: run, query: run });
  },
}));

import {
  computeChangeOrderTotals,
  validateChangeOrderInput,
  evaluateChangeOrderAction,
  isChangeOrderEditable,
  formatChangeOrderNumber,
  applyChangeOrderToBudget,
  CHANGE_REQUEST_CHANNELS,
} from "@/lib/budget-change-control";
import * as route from "@/app/api/budget-change-orders/route";

function req(method: string, body?: unknown, qs = "") {
  return new Request(`http://localhost/api/budget-change-orders${qs}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const calls = (re: RegExp) => queryMock.mock.calls.filter((c) => re.test(String(c[0])));
const writes = () => calls(/^\s*(INSERT|UPDATE|DELETE)/i);
const login = (role: string, id = `${role.toLowerCase()}-1`) => (db.sessionUser = { id, role });

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockImplementation(async (sql: string) => fakeDb(sql));
  db.sessionUser = null;
  db.aiu = { administration: 8, imprevistos: 5, utilidad: 5 };
  db.budget = { id: "b1", project_id: "p1", total_value: 100_000_000, client_value: 120_000_000, change_order_seq: 0 };
  db.maxVersion = 2;
  db.co = null;
  db.coItems = [];
});

// Ítems reales del PDF (pág. 3) + un ítem que completa el CD del documento.
const PDF_ITEMS = [
  { chapterCode: "1", itemCode: "1.1", description: "Desmonte de puerta existente", unit: "UND", quantity: 1, unitPrice: 438_000 },
  { chapterCode: "1", itemCode: "1.2", description: "Desmonte de aparatos sanitarios", unit: "UND", quantity: 2, unitPrice: 54_000 },
  { chapterCode: "5", itemCode: "5.1", description: "Kit lavatrapero", unit: "UND", quantity: 1, unitPrice: -636_000 },
  { chapterCode: "6", itemCode: "6.3", description: "Panel mdf con logo neón", unit: "UND", quantity: 1, unitPrice: -1_210_706 },
  { chapterCode: "7", itemCode: "7.1", description: "Descuento general", unit: "GLB", quantity: 1, unitPrice: -2_150_000 },
];
const PDF_CD = 30_732_844.34;
const FILLER = PDF_CD - PDF_ITEMS.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
const ITEMS_CD = [...PDF_ITEMS, { chapterCode: "2", itemCode: "2.1", description: "Resto de obra", unit: "GL", quantity: 1, unitPrice: FILLER }];
const AIU_855 = { administration: 8, imprevistos: 5, utilidad: 5 };

const validBody = {
  budgetId: "b1",
  issueDate: "2025-07-18",
  requestChannel: "SOLICITUD_VERBAL",
  description: "Remodelación oficinas — CC 001",
  items: ITEMS_CD,
};

// ═════════════════════════════ Funciones puras ═════════════════════════════
describe("AC-1 · computeChangeOrderTotals", () => {
  const t = computeChangeOrderTotals(ITEMS_CD, AIU_855);

  it("reproduce la liquidación del PDF", () => {
    expect(t.directCost).toBe(30_732_844.34);
    expect(t.administration).toBe(2_458_627.55);
    expect(t.imprevistos).toBe(1_536_642.22);
    expect(t.utilidad).toBe(1_536_642.22);
    expect(t.iva).toBe(291_962.02);
    expect(t.total).toBe(36_556_718.34);
  });

  it("totalPrice por ítem (negativos incluidos)", () => {
    expect(t.items[1].totalPrice).toBe(108_000);
    expect(t.items[2].totalPrice).toBe(-636_000);
  });

  it("% incidencia por actividad = valor / CD (−636.000 → −2,07 %)", () => {
    expect(t.items[2].incidencePct).toBeCloseTo(-2.0694, 3);
  });

  it("% incidencia por capítulo suma los ítems del capítulo", () => {
    const cap1 = t.chapters.find((c) => c.chapterCode === "1")!;
    expect(cap1.total).toBe(546_000);
    expect(cap1.incidencePct).toBeCloseTo((546_000 / PDF_CD) * 100, 6);
  });

  it("CD = 0 → incidencias en 0, sin dividir entre cero", () => {
    const z = computeChangeOrderTotals([{ description: "Branding", unit: "-", quantity: 0, unitPrice: 0 }], AIU_855);
    expect(z.directCost).toBe(0);
    expect(z.items[0].incidencePct).toBe(0);
    expect(z.total).toBe(0);
  });
});

describe("AC-3/AC-4 · validateChangeOrderInput", () => {
  it("los canales son los del PDF", () => {
    expect(CHANGE_REQUEST_CHANNELS).toEqual(["ACTA_COMITE", "MAIL", "SOLICITUD_VERBAL", "OTROS"]);
  });

  it("acepta un CC válido", () => {
    expect(validateChangeOrderInput(validBody).ok).toBe(true);
  });

  it("canal obligatorio y dentro de la lista", () => {
    expect(validateChangeOrderInput({ ...validBody, requestChannel: undefined }).code).toBe("INVALID_CHANNEL");
    expect(validateChangeOrderInput({ ...validBody, requestChannel: "FAX" }).code).toBe("INVALID_CHANNEL");
  });

  it("OTROS exige detalle", () => {
    expect(validateChangeOrderInput({ ...validBody, requestChannel: "OTROS" }).code).toBe("CHANNEL_OTHER_REQUIRED");
    expect(validateChangeOrderInput({ ...validBody, requestChannel: "OTROS", requestChannelOther: "WhatsApp" }).ok).toBe(true);
  });

  it("al menos un ítem, con descripción y números válidos", () => {
    expect(validateChangeOrderInput({ ...validBody, items: [] }).code).toBe("ITEMS_REQUIRED");
    expect(validateChangeOrderInput({ ...validBody, items: [{ description: "", unit: "M2", quantity: 1, unitPrice: 1 }] }).code).toBe("INVALID_ITEM");
    expect(validateChangeOrderInput({ ...validBody, items: [{ description: "x", unit: "M2", quantity: Number.NaN, unitPrice: 1 }] }).code).toBe("INVALID_ITEM");
  });

  it("permite ítems en 0 y negativos", () => {
    expect(validateChangeOrderInput({
      ...validBody,
      items: [{ description: "BRANDING", unit: "-", quantity: 0, unitPrice: 0 }, { description: "Desc.", unit: "GLB", quantity: 1, unitPrice: -5 }],
    }).ok).toBe(true);
  });

  it("descripción obligatoria", () => {
    expect(validateChangeOrderInput({ ...validBody, description: "  " }).code).toBe("DESCRIPTION_REQUIRED");
  });
});

describe("AC-5 · numeración", () => {
  it("CC-001, CC-012, CC-123", () => {
    expect(formatChangeOrderNumber(1)).toBe("CC-001");
    expect(formatChangeOrderNumber(12)).toBe("CC-012");
    expect(formatChangeOrderNumber(123)).toBe("CC-123");
  });
});

describe("AC-6/AC-7 · evaluateChangeOrderAction", () => {
  it("DRAFT → SUBMIT por RESIDENTE/DIRECTOR/ADMIN", () => {
    for (const role of ["RESIDENTE", "DIRECTOR", "ADMIN"]) {
      expect(evaluateChangeOrderAction("DRAFT", "SUBMIT", role)).toMatchObject({ ok: true, target: "SUBMITTED" });
    }
  });

  it("APPROVE solo GERENTE/ADMIN", () => {
    expect(evaluateChangeOrderAction("SUBMITTED", "APPROVE", "GERENTE")).toMatchObject({ ok: true, target: "APPROVED" });
    expect(evaluateChangeOrderAction("SUBMITTED", "APPROVE", "ADMIN").ok).toBe(true);
    for (const role of ["DIRECTOR", "RESIDENTE", "TESORERIA"]) {
      expect(evaluateChangeOrderAction("SUBMITTED", "APPROVE", role)).toMatchObject({ ok: false, code: "FORBIDDEN_ROLE", status: 403 });
    }
  });

  it("REJECT exige motivo", () => {
    expect(evaluateChangeOrderAction("SUBMITTED", "REJECT", "GERENTE", { rejectionReason: " " }))
      .toMatchObject({ ok: false, code: "REJECTION_REASON_REQUIRED", status: 400 });
    expect(evaluateChangeOrderAction("SUBMITTED", "REJECT", "GERENTE", { rejectionReason: "Precio alto" }))
      .toMatchObject({ ok: true, target: "REJECTED" });
  });

  it("transiciones inválidas", () => {
    expect(evaluateChangeOrderAction("DRAFT", "APPROVE", "ADMIN")).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
    expect(evaluateChangeOrderAction("APPROVED", "REJECT", "ADMIN", { rejectionReason: "x" })).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("REJECTED se puede reenviar tras corregir", () => {
    expect(evaluateChangeOrderAction("REJECTED", "SUBMIT", "RESIDENTE")).toMatchObject({ ok: true, target: "SUBMITTED" });
  });

  it("acción desconocida", () => {
    expect(evaluateChangeOrderAction("DRAFT", "PAY" as never, "ADMIN")).toMatchObject({ ok: false, code: "UNKNOWN_ACTION" });
  });
});

describe("AC-8 · edición", () => {
  it("solo DRAFT y REJECTED son editables", () => {
    expect(isChangeOrderEditable("DRAFT")).toBe(true);
    expect(isChangeOrderEditable("REJECTED")).toBe(true);
    expect(isChangeOrderEditable("SUBMITTED")).toBe(false);
    expect(isChangeOrderEditable("APPROVED")).toBe(false);
  });
});

describe("AC-9 · applyChangeOrderToBudget (Cliente y Tope += costo directo)", () => {
  it("suma el costo directo, no el total con AIU", () => {
    expect(applyChangeOrderToBudget({ totalValue: 100, clientValue: 120 }, -30)).toEqual({ totalValue: 70, clientValue: 90 });
  });
});

// ═════════════════════════════ Ruta API ═════════════════════════════
describe("API · auth y roles", () => {
  it("sin sesión → 401 en todos los métodos", async () => {
    for (const res of [
      await route.GET(req("GET", undefined, "?budgetId=b1")),
      await route.POST(req("POST", validBody)),
      await route.PUT(req("PUT", { id: "cc1", ...validBody })),
      await route.DELETE(req("DELETE", undefined, "?id=cc1")),
      await route.PATCH(req("PATCH", { id: "cc1", action: "APPROVE" })),
    ]) expect(res.status).toBe(401);
    expect(writes()).toEqual([]);
  });

  it("GERENTE no crea (solo RESIDENTE/DIRECTOR/ADMIN)", async () => {
    login("GERENTE");
    expect((await route.POST(req("POST", validBody))).status).toBe(403);
  });
});

describe("API · POST", () => {
  beforeEach(() => login("DIRECTOR", "dir-1"));

  it("crea CC-001 con totales del servidor y AIU congelado (AC-2, AC-10)", async () => {
    const res = await route.POST(req("POST", { ...validBody, directCost: 1, total: 1, createdBy: "falso" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ number: "CC-001", directCost: 30_732_844.34, total: 36_556_718.34, status: "DRAFT" });
    const [, args] = calls(/INSERT INTO budget_change_orders/)[0];
    expect(args).toEqual(expect.arrayContaining([30_732_844.34, 36_556_718.34, 8, 5, 19, "dir-1"]));
    expect(args).not.toContain("falso");
    expect(calls(/INSERT INTO budget_change_order_items/).length).toBe(ITEMS_CD.length);
  });

  it("el consecutivo sale del contador del presupuesto (no se reutiliza)", async () => {
    db.budget.change_order_seq = 4;
    const body = await (await route.POST(req("POST", validBody))).json();
    expect(body.number).toBe("CC-005");
    expect(calls(/FOR UPDATE/).length).toBeGreaterThan(0);
    expect(calls(/UPDATE budgets SET change_order_seq/).length).toBe(1);
  });

  it("proyecto sin AIU → 409 AIU_NOT_CONFIGURED", async () => {
    db.aiu = null;
    const res = await route.POST(req("POST", validBody));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("AIU_NOT_CONFIGURED");
    expect(writes()).toEqual([]);
  });

  it("input inválido → 400 sin escribir", async () => {
    const res = await route.POST(req("POST", { ...validBody, requestChannel: "OTROS" }));
    expect(res.status).toBe(400);
    expect(writes()).toEqual([]);
  });
});

const storedCo = (status: string) => ({
  id: "cc1", budget_id: "b1", seq: 1, number: "CC-001", status,
  issue_date: "2025-07-18", request_channel: "SOLICITUD_VERBAL", description: "CC",
  aiu_administration: 8, aiu_imprevistos: 5, aiu_utilidad: 5, iva_on_utility_pct: 19,
  direct_cost: 1000, total: 1189.5, created_by: "dir-1",
});

describe("API · PUT / DELETE solo en DRAFT o REJECTED (AC-8)", () => {
  beforeEach(() => login("DIRECTOR"));

  it.each(["SUBMITTED", "APPROVED"])("PUT sobre %s → 409", async (status) => {
    db.co = storedCo(status);
    expect((await route.PUT(req("PUT", { id: "cc1", ...validBody }))).status).toBe(409);
    expect(writes()).toEqual([]);
  });

  it.each(["SUBMITTED", "APPROVED"])("DELETE sobre %s → 409", async (status) => {
    db.co = storedCo(status);
    expect((await route.DELETE(req("DELETE", undefined, "?id=cc1"))).status).toBe(409);
    expect(writes()).toEqual([]);
  });

  it("PUT en DRAFT recalcula con el AIU congelado, no con el actual", async () => {
    db.co = { ...storedCo("DRAFT"), aiu_utilidad: 10 };
    db.aiu = { administration: 50, imprevistos: 0, utilidad: 0 }; // AIU del proyecto cambió después
    const res = await route.PUT(req("PUT", {
      id: "cc1", ...validBody, items: [{ description: "x", unit: "UND", quantity: 1, unitPrice: 1000 }],
    }));
    expect(res.status).toBe(200);
    const [, args] = calls(/UPDATE budget_change_orders SET/)[0];
    // CD 1000; A 80; I 50; U 100; IVA 19 → 1249
    expect(args).toEqual(expect.arrayContaining([1000, 1249]));
  });
});

describe("API · PATCH workflow (AC-6, AC-9, AC-10)", () => {
  it("el rol sale de la sesión: DIRECTOR que dice ser GERENTE no aprueba", async () => {
    login("DIRECTOR");
    db.co = storedCo("SUBMITTED");
    const res = await route.PATCH(req("PATCH", { id: "cc1", action: "APPROVE", user: { role: "GERENTE" } }));
    expect(res.status).toBe(403);
    expect(writes()).toEqual([]);
  });

  it("APPROVE crea versión n+1 y suma el CD a Tope y Cliente", async () => {
    login("GERENTE", "ger-1");
    db.co = storedCo("SUBMITTED");
    const res = await route.PATCH(req("PATCH", { id: "cc1", action: "APPROVE" }));
    expect(res.status).toBe(200);

    const [, vArgs] = calls(/INSERT INTO budget_versions/)[0];
    expect(vArgs).toEqual(expect.arrayContaining(["b1", 3, 100_001_000]));
    expect(vArgs.some((a: unknown) => typeof a === "string" && a.startsWith("CC-001"))).toBe(true);

    const [, bArgs] = calls(/UPDATE budgets SET total_value/)[0];
    expect(bArgs).toEqual(expect.arrayContaining([100_001_000, 120_001_000]));

    const [, coArgs] = calls(/UPDATE budget_change_orders SET status/)[0];
    expect(coArgs).toEqual(expect.arrayContaining(["APPROVED", "ger-1"]));
    expect(calls(/FOR UPDATE/).length).toBeGreaterThan(0);
  });

  it("REJECT sin motivo → 400", async () => {
    login("GERENTE");
    db.co = storedCo("SUBMITTED");
    const res = await route.PATCH(req("PATCH", { id: "cc1", action: "REJECT" }));
    expect(res.status).toBe(400);
    expect(writes()).toEqual([]);
  });

  it("SUBMIT registra quién envió", async () => {
    login("RESIDENTE", "res-9");
    db.co = storedCo("DRAFT");
    const res = await route.PATCH(req("PATCH", { id: "cc1", action: "SUBMIT" }));
    expect(res.status).toBe(200);
    const [, args] = calls(/UPDATE budget_change_orders SET status/)[0];
    expect(args).toEqual(expect.arrayContaining(["SUBMITTED", "res-9"]));
    expect(calls(/INSERT INTO budget_versions/)).toEqual([]);
  });
});

describe("API · GET", () => {
  it("lista los CC del presupuesto con sus ítems", async () => {
    login("RESIDENTE");
    db.co = storedCo("DRAFT");
    db.coItems = [{ id: "i1", change_order_id: "cc1", position: 0, description: "x", unit: "UND", quantity: 1, unit_price: 1000, total_price: 1000 }];
    const res = await route.GET(req("GET", undefined, "?budgetId=b1"));
    expect(res.status).toBe(200);
    const [co] = await res.json();
    expect(co).toMatchObject({ id: "cc1", number: "CC-001", status: "DRAFT", directCost: 1000 });
    expect(co.aiuSnapshot).toEqual({ administration: 8, imprevistos: 5, utilidad: 5, ivaOnUtility: 19 });
    expect(co.items[0]).toMatchObject({ description: "x", unitPrice: 1000, totalPrice: 1000 });
  });

  it("budgetId obligatorio", async () => {
    login("RESIDENTE");
    expect((await route.GET(req("GET"))).status).toBe(400);
  });
});
