// @vitest-environment node
/**
 * tests/verifiers/users-api-auth.spec.ts
 *
 * Verifier de docs/specs/bug-users-api-sin-auth.md (AC-1 a AC-4).
 *
 * Se ejecutan los handlers reales de /api/users con la capa de auth real
 * (api-auth.ts); solo se simulan la cookie (next/headers), la firma de
 * sesión y la BD.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  sessionUser: null as null | { id: string; role: string },
}));

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.cookie ? { value: state.cookie } : undefined),
    delete: () => {},
  }),
}));

vi.mock("@/lib/session", () => ({
  SESSION_COOKIE: "session",
  verifySessionCookie: (v: string | undefined) => (v ? state.sessionUser?.id ?? null : null),
}));

vi.mock("@/lib/db", () => ({ query: queryMock, pool: {} }));

import { GET, POST, PATCH, PUT, DELETE } from "@/app/api/users/route";

const userRow = {
  id: "new-1",
  email: "nuevo@x.com",
  name: "Nuevo",
  role: "RESIDENTE",
  area: "tecnico",
  status: "PENDING",
  is_active: 0,
};

/** Simula la BD: la consulta de sesión devuelve al usuario logueado. */
function setupDb() {
  queryMock.mockImplementation(async (sql: string) => {
    if (/WHERE id = \? AND status = 'ACTIVE'/.test(sql)) {
      const u = state.sessionUser;
      return u ? [{ id: u.id, email: "s@x.com", name: "S", role: u.role, area: "administrativo" }] : [];
    }
    if (/^\s*SELECT\s+\(SELECT COUNT/i.test(sql) || /COUNT\(\*\)/.test(sql)) {
      return [{ cuts: 0, payments: 0, contracts: 0, expenses: 0, logs: 0 }];
    }
    if (/^\s*SELECT/i.test(sql)) return [userRow];
    return { affectedRows: 1 };
  });
}

function writes() {
  return queryMock.mock.calls
    .map((c) => String(c[0]))
    .filter((sql) => /^\s*(INSERT|UPDATE|DELETE)/i.test(sql));
}

function json(method: string, body: unknown) {
  return new Request("http://localhost/api/users", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const createBody = {
  email: "atacante@x.com",
  name: "Atacante",
  role: "ADMIN",
  area: "administrativo",
  createdBy: "falso",
};

const calls: Array<[string, () => Promise<Response>]> = [
  ["GET", () => GET()],
  ["POST", () => POST(json("POST", createBody))],
  ["PATCH", () => PATCH(json("PATCH", { id: "u9", status: "ACTIVE", role: "ADMIN" }))],
  ["PUT", () => PUT(json("PUT", { id: "u9", role: "ADMIN", isActive: true }))],
  ["DELETE", () => DELETE(new Request("http://localhost/api/users?id=u9", { method: "DELETE" }))],
];

beforeEach(() => {
  queryMock.mockReset();
  setupDb();
  state.cookie = undefined;
  state.sessionUser = null;
});

describe("AC-1 · Sin sesión → 401 y sin escrituras", () => {
  it.each(calls)("%s responde 401", async (_m, call) => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(writes()).toEqual([]);
  });
});

describe("AC-2 · Sesión no ADMIN → 403 y sin escrituras", () => {
  beforeEach(() => {
    state.cookie = "firmada";
    state.sessionUser = { id: "res-1", role: "RESIDENTE" };
  });

  it.each(calls)("%s responde 403", async (_m, call) => {
    const res = await call();
    expect(res.status).toBe(403);
    expect(writes()).toEqual([]);
  });
});

describe("AC-3 · Sesión ADMIN → funciona como antes", () => {
  beforeEach(() => {
    state.cookie = "firmada";
    state.sessionUser = { id: "admin-1", role: "ADMIN" };
  });

  it("GET responde 200 con la lista", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it("POST responde 201", async () => {
    const res = await POST(json("POST", createBody));
    expect(res.status).toBe(201);
  });
});

describe("AC-4 · Auditoría tomada de la sesión, no del body", () => {
  beforeEach(() => {
    state.cookie = "firmada";
    state.sessionUser = { id: "admin-1", role: "ADMIN" };
  });

  function argsOf(pattern: RegExp): unknown[] {
    const call = queryMock.mock.calls.find((c) => pattern.test(String(c[0])));
    expect(call).toBeDefined();
    return call![1] as unknown[];
  }

  it("POST guarda created_by = admin de la sesión", async () => {
    await POST(json("POST", { ...createBody, createdBy: "falso" }));
    const args = argsOf(/INSERT INTO users/);
    expect(args).toContain("admin-1");
    expect(args).not.toContain("falso");
  });

  it("POST sin createdBy en el body también funciona", async () => {
    const { createdBy: _omit, ...sinCreatedBy } = createBody;
    const res = await POST(json("POST", sinCreatedBy));
    expect(res.status).toBe(201);
  });

  it("PATCH ACTIVE guarda authorized_by = admin de la sesión", async () => {
    await PATCH(json("PATCH", { id: "u9", status: "ACTIVE", authorizedBy: "falso" }));
    const args = argsOf(/UPDATE users SET/);
    expect(args).toContain("admin-1");
    expect(args).not.toContain("falso");
  });

  it("PATCH SUSPENDED guarda suspended_by = admin de la sesión", async () => {
    await PATCH(json("PATCH", { id: "u9", status: "SUSPENDED", suspendedBy: "falso" }));
    const args = argsOf(/UPDATE users SET/);
    expect(args).toContain("admin-1");
    expect(args).not.toContain("falso");
  });
});
