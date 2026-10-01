// filepath: tests/verifiers/sharepoint-client.spec.ts
// Tests de la lógica ensureFolder + uploadFile con fetch mockeado.

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Antes de importar nada, mockeamos getGraphToken para devolver un token fijo.
vi.mock("@/lib/sharepoint/auth", async (importOriginal) => {
  const original: any = await importOriginal();
  return {
    ...original,
    getGraphToken: vi.fn(async () => "FAKE_TOKEN"),
  };
});

interface RecordedCall {
  method: string;
  url: string;
  body?: string | undefined;
  contentType?: string | undefined;
  init?: RequestInit | undefined;
}

interface RouteHandler {
  method: string;
  pattern: string;
  responder: (init: RequestInit) => Response | Promise<Response>;
}

let calls: RecordedCall[];
let routes: RouteHandler[];

function route(
  method: string,
  pattern: string,
  responder: (init: RequestInit) => Response | Promise<Response>,
): void {
  routes.push({ method: method.toUpperCase(), pattern, responder });
}

beforeEach(() => {
  calls = [];
  routes = [];

  // Reemplazamos fetch global con uno que captura llamadas y devuelve mocks.
  globalThis.fetch = vi.fn(async (input: any, init: any = {}) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init.method ?? "GET").toUpperCase();
    let bodyStr: string | undefined;
    if (
      init.body &&
      typeof init.body === "object" &&
      !(init.body instanceof ArrayBuffer)
    ) {
      bodyStr = JSON.stringify(init.body);
    } else if (init.body) {
      bodyStr = String(init.body);
    }
    calls.push({
      method,
      url,
      body: bodyStr,
      contentType: init.headers?.["Content-Type"],
      init,
    });
    for (const r of routes) {
      if (
        r.method === method &&
        url.toLowerCase().includes(r.pattern.toLowerCase())
      ) {
        return r.responder(init);
      }
    }
    // 404 por defecto para que la app no asuma éxito.
    return new Response("{}", {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }) as any;

  // Vars mínimas
  process.env.SP_TENANT_ID = "t";
  process.env.SP_CLIENT_ID = "c";
  process.env.SP_CLIENT_SECRET = "s";
  process.env.SP_SITE_ID = "site";
  process.env.SP_DRIVE_ID = "drive";
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(status: number, payload: any): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function itemResponse(
  name: string,
  id: string,
  webUrl: string,
  isFolder: boolean,
): any {
  return {
    id,
    name,
    webUrl,
    size: 100,
    lastModifiedDateTime: "2026-01-01T00:00:00Z",
    ...(isFolder
      ? { folder: { childCount: 0 } }
      : { file: { mimeType: "application/octet-stream" } }),
  };
}

const fakeConfig = {
  tenantId: "t",
  clientId: "c",
  clientSecret: "s",
  siteId: "site",
  driveId: "drive",
  basePath: "Proyectos",
};

describe("sharepoint-client: ensureFolder", () => {
  it("crea carpetas recursivamente si no existen", async () => {
    const { ensureFolder } = await import("@/lib/sharepoint/sharepoint-client");

    // GET de "Proyectos" → 404
    route("GET", "/drives/drive/root:/Proyectos", () => jsonResponse(404, {}));
    // POST crear "Proyectos" en root → ok
    route("POST", "/drives/drive/root/children", (init) => {
      const body = JSON.parse(init.body as string);
      if (body.name === "Proyectos") {
        return jsonResponse(
          201,
          itemResponse("Proyectos", "id-proy", "https://x/Proyectos", true),
        );
      }
      return jsonResponse(
        201,
        itemResponse(body.name, `id-${body.name}`, "https://x", true),
      );
    });
    // GET de "Proyectos/P001" → 404
    route("GET", "/items/id-proy:/P001", () => jsonResponse(404, {}));
    // POST crear "P001" bajo id-proy
    route("POST", "/items/id-proy/children", (init) => {
      const body = JSON.parse(init.body as string);
      return jsonResponse(
        201,
        itemResponse(body.name, `id-${body.name}`, "https://x", true),
      );
    });
    // GET de "Proyectos/P001/01-Anticipos" → 404
    route("GET", "/items/id-p001:/01-Anticipos", () => jsonResponse(404, {}));
    // POST crear "01-Anticipos" bajo id-p001
    route("POST", "/items/id-p001/children", (init) => {
      const body = JSON.parse(init.body as string);
      return jsonResponse(
        201,
        itemResponse(body.name, `id-${body.name}`, "https://x", true),
      );
    });

    const id = await ensureFolder(fakeConfig, "Proyectos/P001/01-Anticipos");
    expect(id).toBe("id-01-Anticipos");
    // Verificamos que se hicieron los 3 POST de creación.
    const posts = calls.filter((c) => c.method === "POST");
    expect(posts).toHaveLength(3);
    const createdNames = posts.map((c) => JSON.parse(c.body!).name);
    expect(createdNames).toEqual(["Proyectos", "P001", "01-Anticipos"]);
  });

  it("es idempotente: si la carpeta ya existe, no la crea", async () => {
    const { ensureFolder } = await import("@/lib/sharepoint/sharepoint-client");

    // Todos los GET devuelven 200 con un item existente.
    route("GET", "/drives/drive/root:/Proyectos", () =>
      jsonResponse(
        200,
        itemResponse("Proyectos", "id-proy", "https://x/Proyectos", true),
      ),
    );
    route("GET", "/items/id-proy:/P001", () =>
      jsonResponse(200, itemResponse("P001", "id-p001", "https://x", true)),
    );
    route("GET", "/items/id-p001:/01-Anticipos", () =>
      jsonResponse(
        200,
        itemResponse("01-Anticipos", "id-ant", "https://x", true),
      ),
    );

    const id = await ensureFolder(fakeConfig, "Proyectos/P001/01-Anticipos");
    expect(id).toBe("id-ant");
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });
});

describe("sharepoint-client: uploadFile", () => {
  it("sube un archivo nuevo y devuelve webUrl/size/version", async () => {
    const { uploadFile } = await import("@/lib/sharepoint/sharepoint-client");

    // ensureFolder: todas las carpetas ya existen
    route("GET", "/drives/drive/root:/Proyectos", () =>
      jsonResponse(
        200,
        itemResponse("Proyectos", "id-proy", "https://x/Proyectos", true),
      ),
    );
    route("GET", "/items/id-proy:/P001", () =>
      jsonResponse(200, itemResponse("P001", "id-p001", "https://x", true)),
    );
    route("GET", "/items/id-p001:/01-Anticipos", () =>
      jsonResponse(
        200,
        itemResponse("01-Anticipos", "id-ant", "https://x", true),
      ),
    );

    // GET para chequear existencia: 404
    route("GET", "/items/id-ant:/AD-0033_P001_2026-05-15.xlsx:", () =>
      jsonResponse(404, {}),
    );

    // PUT para subir
    route("PUT", "/items/id-ant:/AD-0033_P001_2026-05-15.xlsx:/content", () =>
      jsonResponse(200, {
        id: "file-1",
        name: "AD-0033_P001_2026-05-15.xlsx",
        webUrl:
          "https://example.sharepoint.com/sites/ControlObra/AD-0033_P001_2026-05-15.xlsx?web=1#v2",
        size: 12345,
        lastModifiedDateTime: "2026-05-15T00:00:00Z",
        file: {
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      }),
    );

    const r = await uploadFile(fakeConfig, {
      folderPath: "Proyectos/P001/01-Anticipos",
      fileName: "AD-0033_P001_2026-05-15.xlsx",
      content: Buffer.from("hola"),
    });

    expect(r.webUrl).toContain("sharepoint.com");
    expect(r.sizeBytes).toBe(12345);
    expect(r.version).toBe(2);

    const putCall = calls.find(
      (c) => c.method === "PUT" && c.url.includes("/content"),
    );
    expect(putCall).toBeDefined();
    expect(putCall!.contentType).toContain("spreadsheetml");
  });

  it("cuando el archivo ya existía, versiona correctamente", async () => {
    const { uploadFile } = await import("@/lib/sharepoint/sharepoint-client");

    // ensureFolder: todas existen
    route("GET", "/drives/drive/root:/Proyectos", () =>
      jsonResponse(
        200,
        itemResponse("Proyectos", "id-proy", "https://x", true),
      ),
    );
    route("GET", "/items/id-proy:/P001", () =>
      jsonResponse(200, itemResponse("P001", "id-p001", "https://x", true)),
    );
    route("GET", "/items/id-p001:/01-Anticipos", () =>
      jsonResponse(
        200,
        itemResponse("01-Anticipos", "id-ant", "https://x", true),
      ),
    );

    // GET para chequear: 200 con webUrl que ya tiene #v3
    route("GET", "/items/id-ant:/test.xlsx:", () =>
      jsonResponse(200, {
        id: "file-old",
        name: "test.xlsx",
        webUrl: "https://x/test.xlsx#v3",
        size: 100,
        lastModifiedDateTime: "2026-01-01T00:00:00Z",
        file: { mimeType: "x" },
      }),
    );

    // PUT devuelve v4
    route("PUT", "/items/id-ant:/test.xlsx:/content", () =>
      jsonResponse(200, {
        id: "file-new",
        name: "test.xlsx",
        webUrl: "https://x/test.xlsx#v4",
        size: 200,
        lastModifiedDateTime: "2026-02-01T00:00:00Z",
        file: { mimeType: "x" },
      }),
    );

    const r = await uploadFile(fakeConfig, {
      folderPath: "Proyectos/P001/01-Anticipos",
      fileName: "test.xlsx",
      content: Buffer.from("v4"),
    });

    expect(r.version).toBe(4);
  });
});
