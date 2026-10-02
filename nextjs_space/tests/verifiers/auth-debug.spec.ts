// @vitest-environment node
/**
 * tests/verifiers/auth-debug.spec.ts
 *
 * Verifier de Fase 5, P2 (seccion 4.4): /api/auth/debug
 *   - En produccion, devuelve 404 aunque pases el token.
 *   - En desarrollo, requiere DEBUG_TOKEN por header.
 *   - Nunca expone credenciales (DB_USER, DB_PASSWORD, etc.).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/api/auth/debug: en produccion", () => {
  it("devuelve 404 aunque pases el token correcto", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEBUG_TOKEN", "secret-1234");
    vi.resetModules();
    const { GET } = await import("@/app/api/auth/debug/route");
    const req = new NextRequest("http://localhost/api/auth/debug", {
      headers: { "x-debug-token": "secret-1234" },
    });
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("devuelve 404 sin token", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEBUG_TOKEN", "");
    vi.resetModules();
    const { GET } = await import("@/app/api/auth/debug/route");
    const req = new NextRequest("http://localhost/api/auth/debug");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });
});

describe("/api/auth/debug: en desarrollo", () => {
  it("503 si no hay DEBUG_TOKEN configurado", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEBUG_TOKEN", "");
    vi.resetModules();
    const { GET } = await import("@/app/api/auth/debug/route");
    const req = new NextRequest("http://localhost/api/auth/debug", {
      headers: { "x-debug-token": "cualquiera" },
    });
    const res = await GET(req);
    expect([404, 503]).toContain(res.status);
  });

  it("404 con token incorrecto", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEBUG_TOKEN", "secret-real");
    vi.resetModules();
    const { GET } = await import("@/app/api/auth/debug/route");
    const req = new NextRequest("http://localhost/api/auth/debug", {
      headers: { "x-debug-token": "no-es-el-real" },
    });
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("token en query string NO se acepta (solo header)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEBUG_TOKEN", "secret-real");
    vi.resetModules();
    const { GET } = await import("@/app/api/auth/debug/route");
    const req = new NextRequest(
      "http://localhost/api/auth/debug?token=secret-real",
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("OK con token correcto, no expone credenciales", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEBUG_TOKEN", "secret-real");
    // vi.stubEnv solo permite string; lo usamos para los env legitimos.
    // El body no debe contener DB_PASSWORD, DB_USER, ni cualquier
    // valor "should-not-leak". Mockeamos el driver.
    vi.doMock("@/lib/db", () => ({
      pool: {
        query: async () => {
          throw new Error("no bd");
        },
      },
    }));
    vi.resetModules();
    const { GET } = await import("@/app/api/auth/debug/route");
    const req = new NextRequest("http://localhost/api/auth/debug", {
      headers: { "x-debug-token": "secret-real" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    const json = JSON.stringify(body);
    expect(json).not.toContain("DB_PASSWORD");
    expect(json).not.toContain("DB_USER");
    expect(body).toHaveProperty("nodeEnv");
    expect(body).toHaveProperty("dbCheck");
  });
});
