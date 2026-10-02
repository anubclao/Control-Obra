export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * /api/quotations/expire — cron de expiracion automatica.
 *
 * P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.1):
 *   Recorre las cotizaciones activas (DRAFT/SENT/VIEWED) cuya
 *   `valid_until` ya vencio y las pasa a EXPIRED. Pensado para
 *   llamarse desde un cron externo (cron-job.org, GitHub Actions)
 *   una vez al dia. Solo ADMIN puede invocarlo.
 *
 *   Esta ruta vive aparte de /api/quotations porque Next.js
 *   (15.x) solo acepta exports nombrados HTTP (GET/POST/PUT/
 *   DELETE/HEAD/OPTIONS) en un route file: meter aqui un
 *   `export async function POST_EXPIRE` daba TS2344.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  requireAuth,
  authFailureResponse,
  type AuthSuccess,
} from "@/lib/api-auth";
import { evaluateQuotationExpiry } from "@/lib/quotations-workflow";

export async function POST(req: Request) {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  if ((auth as AuthSuccess).user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo ADMIN puede correr el cron de expiracion" },
      { status: 403 },
    );
  }
  try {
    const rows = await query<any[]>(
      `SELECT id, status, valid_until FROM quotations
        WHERE status IN ('DRAFT','SENT','VIEWED')`,
    );
    let expired = 0;
    for (const r of rows) {
      if (evaluateQuotationExpiry(r.status, r.valid_until)) {
        await query(
          `UPDATE quotations SET status = 'EXPIRED', updated_by = ? WHERE id = ?`,
          [(auth as AuthSuccess).userId, r.id],
        );
        expired++;
      }
    }
    return NextResponse.json({ ok: true, expired });
  } catch (e: any) {
    console.error("[quotations expire]", e?.code, e?.message);
    return NextResponse.json(
      { error: "Error al expirar cotizaciones" },
      { status: 500 },
    );
  }
}
