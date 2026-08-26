/**
 * API: POST /api/auth/logout  → limpia cookie
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const jar = await cookies();
  jar.delete("co_session");
  return NextResponse.json({ ok: true });
}
