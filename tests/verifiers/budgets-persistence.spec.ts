// @vitest-environment node
/**
 * tests/verifiers/budgets-persistence.spec.ts
 *
 * Verifier de docs/specs/bug-presupuestos-persistencia.md (AC-1 a AC-6).
 * Ruta /api/budgets real con BD simulada + acciones del store.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const db = vi.hoisted(() => ({
  sessionUser: null as null | { id: string; role: string },
  budgets: [] as Array<Record<string, unknown>>,
  versions: [] as Array<Record<string, unknown>>,
  layers: [] as Array<Record<string, unknown>>,
  items: [] as Array<Record<string, unknown>>,
  unforeseen: [] as Array<Record<string, unknown>>,
}));
const queryMock = vi.hoisted(() => vi.fn());
const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() }));

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
vi.mock("@/lib/api", () => ({ api: apiMock }));

function fakeDb(sql: string): unknown {
  if (/WHERE id = \? AND status = 'ACTIVE'/.test(sql)) {
    const u = db.sessionUser;
    return u ? [{ id: u.id, email: "s@x.com", name: "S", role: u.role, area: "tecnico" }] : [];
  }
  if (!/^\s*SELECT/i.test(sql)) return { affectedRows: 1 };
  if (/MAX\(version\)/i.test(sql)) {
    return [{ max_version: db.versions.reduce((m, v) => Math.max(m, Number(v.version)), 0) }];
  }
  if (/FROM budget_versions/i.test(sql)) return db.versions;
  if (/FROM budget_items/i.test(sql)) return db.items;
  if (/FROM budget_layers/i.test(sql)) return db.layers;
  if (/FROM budget_unforeseen_items/i.test(sql)) {
    return /WHERE id = \?/.test(sql) ? db.unforeseen.slice(0, 1) : db.unforeseen;
  }
  if (/FROM budgets/i.test(sql)) return db.budgets;
  return [];
}

vi.mock("@/lib/db", () => ({
  query: queryMock,
  pool: {},
  transaction: async (fn: (conn: unknown) => unknown) => {
    const run = async (sql: string, args: unknown[]) => [await queryMock(sql, args)];
    return fn({ execute: run, query: run });
  },
}));

import * as route from "@/app/api/budgets/route";
import { useDataStore } from "@/lib/data-store";

const calls = (re: RegExp) => queryMock.mock.calls.filter((c) => re.test(String(c[0])));
const writes = () => calls(/^\s*(INSERT|UPDATE|DELETE)/i);
function req(method: string, body?: unknown, qs = "") {
  return new Request(`http://localhost/api/budgets${qs}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Capas como las produce buildBudgetLayers (ids temporales del cliente). */
const LAYERS = [
  {
    id: "l_ch_1_tmp", budgetId: "", code: "1", name: "PRELIMINARES", layerType: "CHAPTER",
    items: [
      { id: "bi_tmp1", layerId: "l_ch_1_tmp", description: "Replanteo", unit: "M2", quantity: 100, unitPrice: 8_500, totalPrice: 1, executedQuantity: 0, executedAmount: 0 },
      { id: "bi_tmp2", layerId: "l_ch_1_tmp", description: "Cerramiento", unit: "ML", quantity: 50, unitPrice: 20_000, totalPrice: 1, executedQuantity: 0, executedAmount: 0 },
    ],
  },
  {
    id: "l_ch_2_tmp", budgetId: "", code: "2", name: "CIMENTACIÓN", layerType: "CHAPTER",
    items: [
      { id: "bi_tmp3", layerId: "l_ch_2_tmp", description: "Zapatas", unit: "M3", quantity: 10, unitPrice: 500_000, totalPrice: 1, executedQuantity: 0, executedAmount: 0 },
    ],
  },
];
const LAYERS_TOTAL = 100 * 8_500 + 50 * 20_000 + 10 * 500_000; // 6.850.000

const budgetRow = {
  id: "b1", project_id: "p1", active_version_id: "v2", total_value: 7_000_000,
  client_value: 6_850_000, unforeseen_value: 150_000, change_order_seq: 0, created_at: "2026-09-01",
};

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockImplementation(async (sql: string) => fakeDb(sql));
  Object.values(apiMock).forEach((m) => m.mockReset());
  db.sessionUser = { id: "dir-1", role: "DIRECTOR" };
  db.budgets = [];
  db.versions = [];
  db.layers = [];
  db.items = [];
  db.unforeseen = [];
});

// ═════════════════════════════════ AC-1 ═════════════════════════════════
describe("AC-1 · GET devuelve el Budget completo", () => {
  beforeEach(() => {
    db.budgets = [budgetRow];
    db.versions = [
      { id: "v1", budget_id: "b1", version: 1, is_active: 0, total_value: 6_850_000, notes: "PT inicial", created_at: "2026-09-01" },
      { id: "v2", budget_id: "b1", version: 2, is_active: 1, total_value: 7_000_000, notes: "Rev", created_at: "2026-09-10" },
    ];
    db.layers = [
      { id: "L1", budget_id: "b1", code: "1", name: "PRELIMINARES", layer_type: "CHAPTER", parent_id: null, is_client: 0 },
      { id: "C1", budget_id: "b1", code: "1", name: "PRELIMINARES", layer_type: "CHAPTER", parent_id: null, is_client: 1 },
    ];
    db.items = [
      { id: "I1", layer_id: "L1", description: "Replanteo", unit: "M2", quantity: 100, unit_price: 8500, total_price: 850000, executed_quantity: 10, executed_amount: 85000 },
      { id: "I2", layer_id: "C1", description: "Replanteo", unit: "M2", quantity: 100, unit_price: 8500, total_price: 850000, executed_quantity: 0, executed_amount: 0 },
    ];
    db.unforeseen = [
      { id: "U1", budget_id: "b1", description: "Imprevisto", unit: "GL", quantity: 1, unit_price: 150000, total_price: 150000, created_at: "2026-09-11" },
    ];
  });

  it("incluye versions, layers (Tope), clientLayers y unforeseenItems", async () => {
    const res = await route.GET(req("GET"));
    expect(res.status).toBe(200);
    const [b] = await res.json();
    expect(b).toMatchObject({ id: "b1", projectId: "p1", activeVersionId: "v2", totalValue: 7_000_000 });
    expect(b.versions.map((v: { version: number }) => v.version)).toEqual([1, 2]);
    expect(b.versions[1]).toMatchObject({ id: "v2", isActive: true, totalValue: 7_000_000 });
    expect(b.layers).toHaveLength(1);
    expect(b.layers[0]).toMatchObject({ id: "L1", code: "1", layerType: "CHAPTER" });
    expect(b.layers[0].items[0]).toMatchObject({ id: "I1", quantity: 100, unitPrice: 8500, totalPrice: 850000, executedAmount: 85000 });
    expect(b.clientLayers).toHaveLength(1);
    expect(b.clientLayers[0].items[0].id).toBe("I2");
    expect(b.unforeseenItems[0]).toMatchObject({ id: "U1", layerId: "unforeseen", totalPrice: 150000 });
  });

  it("presupuesto sin capas → arrays vacíos, nunca undefined", async () => {
    db.layers = []; db.items = []; db.versions = []; db.unforeseen = [];
    const [b] = await (await route.GET(req("GET"))).json();
    expect(b.layers).toEqual([]);
    expect(b.clientLayers).toEqual([]);
    expect(b.versions).toEqual([]);
    expect(b.unforeseenItems).toEqual([]);
  });

  it("sin sesión → 401", async () => {
    db.sessionUser = null;
    expect((await route.GET(req("GET"))).status).toBe(401);
  });
});

// ═════════════════════════════════ AC-2 ═════════════════════════════════
describe("AC-2 · POST crea el PT completo", () => {
  it("versión 1, Tope + snapshot Cliente, totales del servidor", async () => {
    const res = await route.POST(req("POST", { projectId: "p1", layers: LAYERS, notes: "PT inicial", totalValue: 1 }));
    expect(res.status).toBe(201);

    const [, bArgs] = calls(/INSERT INTO budgets/)[0];
    expect(bArgs).toEqual(expect.arrayContaining(["p1", LAYERS_TOTAL]));
    expect(bArgs.filter((a: unknown) => a === LAYERS_TOTAL)).toHaveLength(2); // total_value y client_value
    expect(bArgs).not.toContain(1);

    const [, vArgs] = calls(/INSERT INTO budget_versions/)[0];
    expect(vArgs).toEqual(expect.arrayContaining([1, LAYERS_TOTAL, "PT inicial"]));

    const layerInserts = calls(/INSERT INTO budget_layers/);
    expect(layerInserts).toHaveLength(4); // 2 Tope + 2 Cliente
    // último parámetro = is_client
    expect(layerInserts.map(([, a]) => (a as unknown[]).at(-1)).sort()).toEqual([0, 0, 1, 1]);

    const itemInserts = calls(/INSERT INTO budget_items/);
    expect(itemInserts).toHaveLength(6); // 3 Tope + 3 Cliente
    const zapatas = itemInserts.find(([, a]) => (a as unknown[]).includes("Zapatas"))!;
    expect(zapatas[1]).toEqual(expect.arrayContaining([10, 500_000, 5_000_000]));
  });

  it("ids temporales del cliente no llegan a la BD", async () => {
    await route.POST(req("POST", { projectId: "p1", layers: LAYERS }));
    const all = writes().flatMap(([, a]) => a as unknown[]);
    expect(all).not.toContain("l_ch_1_tmp");
    expect(all).not.toContain("bi_tmp1");
  });

  it("proyecto con PT → 409 sin escribir", async () => {
    db.budgets = [budgetRow];
    const res = await route.POST(req("POST", { projectId: "p1", layers: LAYERS }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/Nueva versión/);
    expect(writes()).toEqual([]);
  });

  it("sin capas crea un PT vacío en 0 (compatibilidad)", async () => {
    const res = await route.POST(req("POST", { projectId: "p1" }));
    expect(res.status).toBe(201);
    const [, bArgs] = calls(/INSERT INTO budgets/)[0];
    expect(bArgs.filter((a: unknown) => a === 0).length).toBeGreaterThanOrEqual(2);
  });
});

// ═════════════════════════════════ AC-3 ═════════════════════════════════
describe("AC-3 · PATCH NEW_VERSION", () => {
  beforeEach(() => {
    db.budgets = [budgetRow];
    db.versions = [
      { id: "v1", budget_id: "b1", version: 1 },
      { id: "v2", budget_id: "b1", version: 2 },
    ];
  });

  it("reemplaza solo el Tope, crea v3 activa y conserva el Cliente", async () => {
    const res = await route.PATCH(req("PATCH", { id: "b1", action: "NEW_VERSION", layers: LAYERS, notes: "Rev 3" }));
    expect(res.status).toBe(200);

    const del = calls(/DELETE FROM budget_layers/)[0];
    expect(String(del[0])).toMatch(/is_client\s*=\s*0/);
    expect(calls(/UPDATE budget_versions SET is_active = 0/)).toHaveLength(1);

    const [, vArgs] = calls(/INSERT INTO budget_versions/)[0];
    // total = capas nuevas + no previstos vigentes (150.000)
    expect(vArgs).toEqual(expect.arrayContaining(["b1", 3, LAYERS_TOTAL + 150_000, "Rev 3"]));

    const [bSql, bArgs] = calls(/UPDATE budgets SET/)[0];
    expect(String(bSql)).not.toMatch(/client_value/);
    expect(bArgs).toContain(LAYERS_TOTAL + 150_000);

    expect(calls(/INSERT INTO budget_layers/)).toHaveLength(2);
    expect(calls(/INSERT INTO budget_items/)).toHaveLength(3);
    expect(calls(/FOR UPDATE/).length).toBeGreaterThan(0);
  });

  it("sin capas → 400", async () => {
    expect((await route.PATCH(req("PATCH", { id: "b1", action: "NEW_VERSION", layers: [] }))).status).toBe(400);
    expect(writes()).toEqual([]);
  });
});

// ═════════════════════════════════ AC-4 ═════════════════════════════════
describe("AC-4 · ítems no previstos", () => {
  beforeEach(() => { db.budgets = [budgetRow]; });

  it("ADD_UNFORESEEN suma al no previsto y al Tope", async () => {
    const res = await route.PATCH(req("PATCH", {
      id: "b1", action: "ADD_UNFORESEEN",
      item: { description: "Refuerzo", unit: "ML", quantity: 4, unitPrice: 25_000, totalPrice: 999 },
    }));
    expect(res.status).toBe(200);
    const [, iArgs] = calls(/INSERT INTO budget_unforeseen_items/)[0];
    expect(iArgs).toEqual(expect.arrayContaining(["b1", "Refuerzo", "ML", 4, 25_000, 100_000]));
    expect(iArgs).not.toContain(999);
    const [, bArgs] = calls(/UPDATE budgets SET/)[0];
    expect(bArgs).toEqual(expect.arrayContaining([150_000 + 100_000, 7_000_000 + 100_000]));
  });

  it("ADD_UNFORESEEN sin descripción → 400", async () => {
    const res = await route.PATCH(req("PATCH", { id: "b1", action: "ADD_UNFORESEEN", item: { quantity: 1, unitPrice: 1 } }));
    expect(res.status).toBe(400);
  });

  it("REMOVE_UNFORESEEN resta su valor", async () => {
    db.unforeseen = [{ id: "U1", budget_id: "b1", total_price: 150_000 }];
    const res = await route.PATCH(req("PATCH", { id: "b1", action: "REMOVE_UNFORESEEN", itemId: "U1" }));
    expect(res.status).toBe(200);
    expect(calls(/DELETE FROM budget_unforeseen_items/)).toHaveLength(1);
    const [, bArgs] = calls(/UPDATE budgets SET/)[0];
    expect(bArgs).toEqual(expect.arrayContaining([0, 7_000_000 - 150_000]));
  });
});

// ═════════════════════════════════ AC-5 ═════════════════════════════════
describe("AC-5 · auth", () => {
  it("PATCH sin sesión → 401", async () => {
    db.sessionUser = null;
    expect((await route.PATCH(req("PATCH", { id: "b1", action: "NEW_VERSION", layers: LAYERS }))).status).toBe(401);
  });

  it("acción desconocida → 400", async () => {
    db.budgets = [budgetRow];
    expect((await route.PATCH(req("PATCH", { id: "b1", action: "BORRAR_TODO" }))).status).toBe(400);
  });

  it("presupuesto inexistente → 404", async () => {
    expect((await route.PATCH(req("PATCH", { id: "nope", action: "NEW_VERSION", layers: LAYERS }))).status).toBe(404);
  });
});

// ═════════════════════════════════ AC-6 ═════════════════════════════════
describe("AC-6 · acciones del store", () => {
  const budgets = () => useDataStore.getState().budgets as any;

  beforeEach(() => {
    useDataStore.setState((s: any) => ({ budgets: { ...s.budgets, items: [], error: null } }));
    apiMock.get.mockResolvedValue([{ id: "b1", projectId: "p1" }]);
  });

  it("createPT llama POST y recarga", async () => {
    apiMock.post.mockResolvedValue({ id: "b1" });
    const r = await budgets().createPT("p1", LAYERS, "PT inicial");
    expect(r.ok).toBe(true);
    expect(apiMock.post).toHaveBeenCalledWith("/api/budgets", { projectId: "p1", layers: LAYERS, notes: "PT inicial" });
    expect(budgets().items).toEqual([{ id: "b1", projectId: "p1" }]);
  });

  it("createPT devuelve el error de la API", async () => {
    apiMock.post.mockRejectedValue(new Error("Este proyecto ya tiene un PT"));
    const r = await budgets().createPT("p1", LAYERS);
    expect(r).toEqual({ ok: false, error: "Este proyecto ya tiene un PT" });
  });

  it("createNewVersion / addUnforeseenItem / removeUnforeseenItem usan PATCH", async () => {
    useDataStore.setState((s: any) => ({ budgets: { ...s.budgets, items: [{ id: "b1", projectId: "p1" }] } }));
    apiMock.patch.mockResolvedValue({ ok: true });
    expect((await budgets().createNewVersion("p1", LAYERS, "v3")).ok).toBe(true);
    expect(apiMock.patch).toHaveBeenLastCalledWith("/api/budgets", { id: "b1", action: "NEW_VERSION", layers: LAYERS, notes: "v3" });
    await budgets().addUnforeseenItem("b1", { description: "x", unit: "GL", quantity: 1, unitPrice: 5 });
    expect(apiMock.patch).toHaveBeenLastCalledWith("/api/budgets", {
      id: "b1", action: "ADD_UNFORESEEN", item: { description: "x", unit: "GL", quantity: 1, unitPrice: 5 },
    });
    await budgets().removeUnforeseenItem("b1", "U1");
    expect(apiMock.patch).toHaveBeenLastCalledWith("/api/budgets", { id: "b1", action: "REMOVE_UNFORESEEN", itemId: "U1" });
  });

  it("createNewVersion sin PT previo → error sin llamar a la API", async () => {
    const r = await budgets().createNewVersion("p9", LAYERS);
    expect(r.ok).toBe(false);
    expect(apiMock.patch).not.toHaveBeenCalled();
  });
});
