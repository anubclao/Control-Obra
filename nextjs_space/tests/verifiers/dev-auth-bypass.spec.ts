/**
 * tests/verifiers/dev-auth-bypass.spec.ts
 *
 * Verifier para docs/specs/dev-auth-bypass.md
 *
 * Cubre:
 *  - AC-1: produccion SIEMPRE devuelve 404 (doble guard).
 *  - AC-2: dev sin DEV_AUTH_BYPASS=true devuelve 404.
 *  - AC-3: dev con flag devuelve 200 + user + cookie legacy + NO escribe en MySQL.
 *  - AC-4: GET /api/auth/login con cookie dev devuelve user sin MySQL.
 *
 * Estrategia:
 *   - Todos los vi.mock() van al top-level del archivo (Vitest los hoistea).
 *   - Usamos vi.stubEnv() para los env vars (NODE_ENV, DEV_AUTH_BYPASS).
 *   - Mockeamos DB y next/headers con objetos estables que podemos
 *     reescribir entre tests via vi.mocked() para inspeccionar llamadas.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mocks top-level: Vitest los hoistea. NO usar vi.mock() dentro de describe.
vi.mock("@/lib/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/session")>(
    "@/lib/session",
  );
  return {
    ...actual,
    signSession: vi.fn((userId: string) => `${userId}.FAKE-SIG`),
    verifySessionCookie: vi.fn(async (cookie: string | undefined) => {
      if (!cookie) return null;
      // Legacy format: ${userId}.${sig} -> parts = [userId]
      const dot = cookie.lastIndexOf(".");
      if (dot < 1) return null;
      const payload = cookie.slice(0, dot);
      const parts = payload.split("|");
      const userId = parts[0];
      if (!userId) return null;
      return {
        userId,
        sessionId: "legacy",
        tokenId: "legacy",
        expiresAt: 0,
      };
    }),
    SESSION_COOKIE: "co_session",
  };
});

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ allowed: true, response: null })),
}));

const dbQuery = vi.fn(() => {
  throw new Error("pool.query called: dev-login NO debe tocar MySQL");
});
vi.mock("@/lib/db", () => ({
  query: dbQuery,
  pool: { query: dbQuery },
}));

const cookieGet = vi.fn((name: string) =>
  name === "co_session" ? { value: "1.FAKE-SIG" } : undefined,
);
const cookieSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: cookieGet,
    set: cookieSet,
  })),
}));

import { devMockUser } from "@/lib/dev-auth";

beforeEach(() => {
  vi.resetAllMocks();
  // Re-configurar los mocks despues de resetAllMocks.
  cookieGet.mockImplementation((name: string) =>
    name === "co_session" ? { value: "1.FAKE-SIG" } : undefined,
  );
  dbQuery.mockImplementation(() => {
    throw new Error("pool.query called: dev-login NO debe tocar MySQL");
  });
});

describe("dev-auth bypass — devMockUser helper", () => {
  it("userId=1 mapea a ADMIN en area administrativo", () => {
    const u = devMockUser("1");
    expect(u.id).toBe("1");
    expect(u.role).toBe("ADMIN");
    expect(u.area).toBe("administrativo");
    expect(u.email).toContain("@");
    expect(u.name.length).toBeGreaterThan(0);
  });

  it("userId=2 mapea a TECNICO", () => {
    const u = devMockUser("2");
    expect(u.role).toBe("TECNICO");
    expect(u.area).toBe("tecnico");
  });

  it("userId=3 mapea a SUPER_ADMIN", () => {
    const u = devMockUser("3");
    expect(u.role).toBe("SUPER_ADMIN");
    expect(u.area).toBe("administrativo");
  });

  it("userId desconocido cae al default ADMIN", () => {
    const u = devMockUser("9999");
    expect(u.role).toBe("ADMIN");
    expect(u.area).toBe("administrativo");
  });

  it("userId vacio cae al default admin", () => {
    const u = devMockUser("");
    expect(u.role).toBe("ADMIN");
  });

  it("area del mock siempre en minusculas (importante para redirect)", () => {
    // El redirect en /login usa `/${user.area}` directamente.
    // Si el area viene en mayusculas, Next.js devuelve 404.
    // AC-3 (bug-fix colateral): asegurar lowercase.
    expect(devMockUser("1").area).toBe("administrativo");
    expect(devMockUser("2").area).toBe("tecnico");
    expect(devMockUser("9999").area).toBe("administrativo");
  });
});

describe("dev-auth bypass — POST /api/auth/dev-login (guards)", () => {
  it("AC-1: con NODE_ENV=production devuelve 404 aunque DEV_AUTH_BYPASS=true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_AUTH_BYPASS", "true");
    const { POST } = await import("@/app/api/auth/dev-login/route");
    const req = new Request("http://localhost:3000/api/auth/dev-login", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    vi.unstubAllEnvs();
  });

  it("AC-2: dev sin DEV_AUTH_BYPASS=true devuelve 404", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_BYPASS", "");
    const { POST } = await import("@/app/api/auth/dev-login/route");
    const req = new Request("http://localhost:3000/api/auth/dev-login", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    vi.unstubAllEnvs();
  });

  it("AC-3: dev + flag devuelve 200, set cookie legacy, NO toca MySQL", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_BYPASS", "true");
    const { POST } = await import("@/app/api/auth/dev-login/route");
    const req = new Request("http://localhost:3000/api/auth/dev-login", {
      method: "POST",
      body: JSON.stringify({ userId: "1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.user).toBeDefined();
    expect(body.user.id).toBe("1");
    expect(body.user.area).toBe("administrativo");
    expect(body.warning).toMatch(/DEV-ONLY/i);
    // CRITICO: el handler NO debio consultar MySQL.
    expect(dbQuery).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("userId fuera de [a-zA-Z0-9_-]{1,32} cae al default '1' por seguridad", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_BYPASS", "true");
    const { POST } = await import("@/app/api/auth/dev-login/route");
    const req = new Request("http://localhost:3000/api/auth/dev-login", {
      method: "POST",
      body: JSON.stringify({ userId: "' OR 1=1 --" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // userId malicioso se sanitiza -> default admin (id=1)
    expect(body.user.id).toBe("1");
    vi.unstubAllEnvs();
  });
});

describe("dev-auth bypass — GET /api/auth/login (dev branch)", () => {
  it("AC-4: con cookie legacy + DEV_AUTH_BYPASS=true devuelve user sin tocar MySQL", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_BYPASS", "true");
    const { GET } = await import("@/app/api/auth/login/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeDefined();
    expect(body.user.id).toBe("1");
    expect(dbQuery).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("sin DEV_AUTH_BYPASS=true, la rama dev NO se activa (cae a prod-flow)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_BYPASS", "");
    // Re-habilitamos el mock de DB para que devuelva null (no encontrado).
    // Cast a any para evitar TS2345 (vi.fn sin tipo explicito infiere never).
    (dbQuery.mockResolvedValueOnce as any)([] as any);
    const { GET } = await import("@/app/api/auth/login/route");
    const res = await GET();
    // Caemos al SELECT que devuelve [] -> user:null con status 200.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeNull();
    expect(dbQuery).toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("produccion con cookie legacy: cae al flujo actual (puede tocar BD)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_AUTH_BYPASS", "");
    (dbQuery.mockResolvedValueOnce as any)([] as any);
    const { GET } = await import("@/app/api/auth/login/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeNull();
    expect(dbQuery).toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});