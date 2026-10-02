export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * /api/auth/debug — healthcheck interno.
 *
 * P2 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.4):
 *   Antes esta ruta aceptaba el token en query string y devolvia
 *   informacion sensible (DB_HOST, DB_USER, etc.). Eso permitia
 *   que cualquiera con el token mapeara la topologia de la BD.
 *   Cambios:
 *     1. En produccion, la ruta devuelve 404 aunque pases el token.
 *        Asi no es un vector de reconocimiento desde fuera.
 *     2. El token solo se acepta por header `x-debug-token`, no
 *        por query string. Asi no queda en logs/proxies.
 *     3. Solo se exponen metricas operativas (alcanzabilidad de
 *        BD, tiempo de respuesta, version del servidor) — nunca
 *        credenciales ni paths de archivos.
 */
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: Request) {
  // 1) En produccion la ruta esta deshabilitada por completo.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 2) En desarrollo: autenticacion por header unicamente.
  const expected = process.env.DEBUG_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "DEBUG_TOKEN no configurado" },
      { status: 503 },
    );
  }
  const provided =
    req.headers.get("x-debug-token") ?? req.headers.get("X-Debug-Token");
  if (provided !== expected) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 3) Solo metricas operativas, sin credenciales.
  const startedAt = Date.now();
  let dbCheck: any = { reachable: false };
  try {
    const [rows]: any = await pool.query(
      "SELECT VERSION() AS version, NOW() AS now_server, DATABASE() AS current_db",
    );
    dbCheck = {
      reachable: true,
      latencyMs: Date.now() - startedAt,
      serverVersion: rows[0]?.version,
      nowServer: rows[0]?.now_server,
      currentDb: rows[0]?.current_db,
    };
  } catch (e: any) {
    dbCheck = {
      reachable: false,
      latencyMs: Date.now() - startedAt,
      code: e?.code,
      errno: e?.errno,
      sqlState: e?.sqlState,
    };
  }
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV ?? "(unset)",
    dbCheck,
  });
}
