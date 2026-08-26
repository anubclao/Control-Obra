export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("x-debug-token");
  const expected = process.env.DEBUG_TOKEN;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const env = {
    DB_HOST: process.env.DB_HOST ?? "(unset)",
    DB_PORT: process.env.DB_PORT ?? "(unset)",
    DB_USER: process.env.DB_USER ?? "(unset)",
    DB_NAME: process.env.DB_NAME ?? "(unset)",
    NODE_ENV: process.env.NODE_ENV ?? "(unset)",
  };
  let dbCheck: any = { reachable: false };
  try {
    const [rows]: any = await pool.query("SELECT VERSION() AS version, NOW() AS now_server, DATABASE() AS current_db");
    dbCheck = { reachable: true, ...rows[0] };
  } catch (e: any) {
    dbCheck = {
      reachable: false,
      code: e?.code, errno: e?.errno, message: e?.message, sqlState: e?.sqlState,
    };
  }
  return NextResponse.json({ env, dbCheck });
}
