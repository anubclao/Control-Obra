// @vitest-environment node
/**
 * tests/verifiers/aiu-direct-cost.spec.ts
 *
 * Verifier de docs/specs/bug-aiu-porcentaje-sobre-costo-directo.md (AC-1 a AC-4).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const state = vi.hoisted(() => ({
  sessionUser: null as null | { id: string; role: string },
  current: { administration: 8, imprevistos: 5, utilidad: 5 },
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
  verifySessionCookie: (v: string | undefined) => (v ? state.sessionUser?.id ?? null : null),
}));
vi.mock("@/lib/db", () => ({ query: queryMock, pool: {} }));

import { validateAiu, computeAiu, IVA_ON_UTILITY_PCT } from "@/lib/aiu-constants";
import { POST, PUT } from "@/app/api/aiu-configs/route";

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockImplementation(async (sql: string) => {
    if (/WHERE id = \? AND status = 'ACTIVE'/.test(sql)) {
      const u = state.sessionUser;
      return u ? [{ id: u.id, email: "d@x.com", name: "D", role: u.role, area: "tecnico" }] : [];
    }
    if (/FROM aiu_configs/i.test(sql)) return [state.current];
    return { affectedRows: 1 };
  });
  state.sessionUser = { id: "dir-1", role: "DIRECTOR" };
  state.current = { administration: 8, imprevistos: 5, utilidad: 5 };
});

function req(method: string, body: unknown) {
  return new Request("http://localhost/api/aiu-configs", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function writes() {
  return queryMock.mock.calls.filter((c) => /^\s*(INSERT|UPDATE)/i.test(String(c[0])));
}

describe("AC-1 · validateAiu: % sobre costo directo", () => {
  it("acepta el AIU del cliente 8/5/5", () => {
    expect(validateAiu(8, 5, 5)).toMatchObject({ ok: true, total: 18 });
  });

  it("acepta 0 en cualquier componente", () => {
    expect(validateAiu(0, 0, 0).ok).toBe(true);
  });

  it.each([
    [-1, 5, 5],
    [8, 101, 5],
    [Number.NaN, 5, 5],
    [60, 30, 20],
  ])("rechaza %s/%s/%s", (a, i, u) => {
    const r = validateAiu(a, i, u);
    expect(r.ok).toBe(false);
    expect(r.message).toBeTruthy();
  });
});

describe("AC-2 · computeAiu reproduce el PDF del cliente", () => {
  const r = computeAiu(30_732_844.34, { administration: 8, imprevistos: 5, utilidad: 5 });

  it("IVA es 19 % de la utilidad", () => {
    expect(IVA_ON_UTILITY_PCT).toBe(19);
  });

  it("componentes redondeados a 2 decimales", () => {
    expect(r.administration).toBe(2_458_627.55);
    expect(r.imprevistos).toBe(1_536_642.22);
    expect(r.utilidad).toBe(1_536_642.22);
    expect(r.iva).toBe(291_962.02);
  });

  it("total = 36.556.718,34 (redondeo al final, no suma de redondeados)", () => {
    expect(r.total).toBe(36_556_718.34);
  });

  it("costo directo 0 → todo 0", () => {
    expect(computeAiu(0, { administration: 8, imprevistos: 5, utilidad: 5 })).toMatchObject({
      administration: 0, imprevistos: 0, utilidad: 0, iva: 0, total: 0,
    });
  });

  it("costo directo negativo (deducciones) → componentes negativos", () => {
    const n = computeAiu(-1000, { administration: 10, imprevistos: 0, utilidad: 10 });
    expect(n).toMatchObject({ administration: -100, utilidad: -100, iva: -19, total: -1219 });
  });
});

describe("AC-3 · API /api/aiu-configs", () => {
  it("POST acepta 8/5/5 y guarda updated_by de la sesión", async () => {
    const res = await POST(req("POST", {
      projectId: "p1", administration: 8, imprevistos: 5, utilidad: 5, updatedBy: "falso",
    }));
    expect(res.status).toBe(201);
    const [, args] = writes()[0];
    expect(args).toContain("dir-1");
    expect(args).not.toContain("falso");
  });

  it("POST rechaza un componente > 100", async () => {
    const res = await POST(req("POST", { projectId: "p1", administration: 150, imprevistos: 5, utilidad: 5 }));
    expect(res.status).toBe(400);
    expect(writes()).toEqual([]);
  });

  it("PUT valida combinando lo guardado con el body", async () => {
    state.current = { administration: 50, imprevistos: 40, utilidad: 5 };
    const res = await PUT(req("PUT", { id: "a1", utilidad: 20 })); // 50+40+20 = 110
    expect(res.status).toBe(400);
    expect(writes()).toEqual([]);
  });

  it("PUT válido guarda updated_by de la sesión", async () => {
    const res = await PUT(req("PUT", { id: "a1", administration: 10, updatedBy: "falso" }));
    expect(res.status).toBe(200);
    const [, args] = writes()[0];
    expect(args).toContain("dir-1");
    expect(args).not.toContain("falso");
  });
});

describe("AC-4 · Migración y esquema", () => {
  const root = path.resolve(__dirname, "../../database/mysql");

  it("la migración 008 elimina chk_aiu_sum", () => {
    const sql = readFileSync(path.join(root, "migrations/008_aiu_percent_over_direct_cost.sql"), "utf8");
    expect(sql).toMatch(/DROP\s+CHECK\s+chk_aiu_sum/i);
  });

  it("init.sql ya no tiene la regla de suma 100", () => {
    const sql = readFileSync(path.join(root, "init.sql"), "utf8");
    expect(sql).not.toMatch(/administration\s*\+\s*imprevistos\s*\+\s*utilidad\s*=\s*100/);
  });
});
