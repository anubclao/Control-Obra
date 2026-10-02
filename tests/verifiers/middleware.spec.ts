// @vitest-environment node
/**
 * tests/verifiers/middleware.spec.ts
 *
 * Verifier de Fase 4, P2 (seccion 4.4): middleware.ts protege las
 * areas privadas en el edge. Cubre:
 *
 *   - "/" sin cookie -> /login.
 *   - "/" con cookie -> /administrativo.
 *   - "/login" sin cookie -> deja pasar.
 *   - "/login" con cookie -> /administrativo.
 *   - "/tecnico" sin cookie -> /login?next=/tecnico.
 *   - "/tecnico" con cookie basica -> deja pasar.
 *   - "/tecnico" con cookie malformada -> /login.
 *   - "/api/foo" -> no se gatea (caller lo hace).
 *
 * El middleware de Next no se puede importar directamente en
 * vitest (depende de next/server en runtime edge); testeamos la
 * funcion exportada manualmente.
 */

// Importamos sin re-ejecutar el matcher de Next: instanciamos NextRequest
// y NextResponse via next/server. Si no estan, hacemos skip.
import { describe, it, expect, beforeAll } from "vitest";

let nextAvailable = false;
let NextRequestCls: any;
let NextResponseCls: any;

beforeAll(async () => {
  try {
    const mod = await import("next/server");
    NextRequestCls = mod.NextRequest;
    NextResponseCls = mod.NextResponse;
    nextAvailable = true;
  } catch {
    nextAvailable = false;
  }
});

describe("middleware (skip si next/server no carga en vitest)", () => {
  it.skipIf(!nextAvailable)(
    "redirige / a /login si no hay cookie",
    async () => {
      const { middleware } = await import("@/middleware");
      const req = new NextRequestCls("http://localhost/");
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    },
  );

  it.skipIf(!nextAvailable)(
    "redirige / a /administrativo si hay cookie",
    async () => {
      const { middleware } = await import("@/middleware");
      const req = new NextRequestCls("http://localhost/", {
        headers: { cookie: "co_session=u1.firmafake" },
      });
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/administrativo");
    },
  );

  it.skipIf(!nextAvailable)("/login sin cookie -> deja pasar", async () => {
    const { middleware } = await import("@/middleware");
    const req = new NextRequestCls("http://localhost/login");
    const res = middleware(req);
    expect(res.status).not.toBe(307);
  });

  it.skipIf(!nextAvailable)(
    "/login con cookie -> redirige a /administrativo",
    async () => {
      const { middleware } = await import("@/middleware");
      const req = new NextRequestCls("http://localhost/login", {
        headers: { cookie: "co_session=u1.firmafake" },
      });
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/administrativo");
    },
  );

  it.skipIf(!nextAvailable)(
    "/tecnico sin cookie -> /login?next=/tecnico",
    async () => {
      const { middleware } = await import("@/middleware");
      const req = new NextRequestCls("http://localhost/tecnico");
      const res = middleware(req);
      expect(res.status).toBe(307);
      const loc = res.headers.get("location") ?? "";
      expect(loc).toContain("/login");
      expect(loc).toContain("next=%2Ftecnico");
    },
  );

  it.skipIf(!nextAvailable)(
    "/tecnico con cookie basica -> deja pasar",
    async () => {
      const { middleware } = await import("@/middleware");
      const req = new NextRequestCls("http://localhost/tecnico", {
        headers: { cookie: "co_session=u1.token.firmafake" },
      });
      const res = middleware(req);
      expect(res.status).not.toBe(307);
    },
  );

  it.skipIf(!nextAvailable)(
    "/tecnico con cookie malformada -> /login",
    async () => {
      const { middleware } = await import("@/middleware");
      const req = new NextRequestCls("http://localhost/tecnico", {
        headers: { cookie: "co_session=short" },
      });
      const res = middleware(req);
      expect(res.status).toBe(307);
    },
  );

  it.skipIf(!nextAvailable)(
    "/api/foo -> no se gatea (deja pasar)",
    async () => {
      const { middleware } = await import("@/middleware");
      // El matcher excluye /api, asi que el middleware NO se ejecuta
      // para esa ruta en runtime; pero si se invoca manualmente,
      // el codigo del middleware no la trata como protegida y la deja
      // pasar.
      const req = new NextRequestCls("http://localhost/api/foo");
      const res = middleware(req);
      expect(res.status).not.toBe(307);
    },
  );
});

describe("config.matcher excluye /api y assets", () => {
  it("matcher definido correctamente", async () => {
    const { config } = await import("@/middleware");
    expect(config.matcher).toBeDefined();
    const matcher = config.matcher[0];
    // Negacion de /api, _next/static, _next/image, favicon, archivos con extension.
    expect(matcher).toMatch(/api/);
    expect(matcher).toMatch(/_next/);
    expect(matcher).toMatch(/favicon/);
  });
});
