export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * /api/cuts/advance-suggestion — sugiere cuanto anticipo se puede
 * amortizar en un nuevo corte.
 *
 * P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.1):
 *   Antes `advanceDeduction` en cada corte era un numero libre que
 *   podia no cuadrar con los anticipos pagados. Aqui exponemos la
 *   consulta de saldo y sugerencia: el frontend la consume al
 *   cargar el formulario del corte y le muestra al residente cuanto
 *   le queda por amortizar (y el maximo que podria aplicar).
 *
 * Query params:
 *   projectId   — id del proyecto (requerido)
 *   providerId  — id del proveedor (requerido)
 *   netValue    — valor neto estimado del corte (opcional, default 0)
 *
 * Response:
 *   { contract: { id, value, advancePercent } | null,
 *     balance:  { authorized, disbursed, remaining },
 *     suggestedDeduction: number,
 *     reason: "..." | "no_contract" | "no_advance_configured" }
 */

import { NextResponse } from "next/server";
import { query, pool } from "@/lib/db";
import { requireAuth, authFailureResponse } from "@/lib/api-auth";
import { computeAdvanceBalance, suggestAdvanceDeduction } from "@/lib/advances";

export async function GET(req: Request) {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const providerId = url.searchParams.get("providerId");
    const netValue = Number(url.searchParams.get("netValue") ?? 0);
    if (!projectId || !providerId) {
      return NextResponse.json(
        { error: "projectId y providerId son requeridos" },
        { status: 400 },
      );
    }
    // Buscar el contrato del par (project, provider). Si hay varios,
    // tomamos el primero ACTIVE o el mas reciente.
    const contractRows = (await query<any[]>(
      `SELECT id, value, advance_percent
         FROM contracts
        WHERE project_id = ? AND provider_id = ?
        ORDER BY FIELD(status,'ACTIVE','DRAFT','SUSPENDED','COMPLETED','CANCELLED'),
                 created_at DESC
        LIMIT 1`,
      [projectId, providerId],
    )) as any[];
    if (!contractRows.length) {
      return NextResponse.json({
        contract: null,
        balance: { authorized: 0, disbursed: 0, remaining: 0 },
        suggestedDeduction: 0,
        reason: "no_contract",
      });
    }
    const contract = {
      id: contractRows[0].id as string,
      value: Number(contractRows[0].value ?? 0),
      advancePercent: Number(contractRows[0].advance_percent ?? 0),
    };
    if (contract.advancePercent <= 0) {
      return NextResponse.json({
        contract,
        balance: { authorized: 0, disbursed: 0, remaining: 0 },
        suggestedDeduction: 0,
        reason: "no_advance_configured",
      });
    }
    // computeAdvanceBalance necesita una conexion con `execute`.
    // Usamos el pool directamente: las queries usan `execute`, no `query`.
    const conn = await pool.getConnection();
    let balance;
    try {
      balance = await computeAdvanceBalance(conn, contract.id);
    } finally {
      conn.release();
    }
    const suggestedDeduction = suggestAdvanceDeduction(balance, netValue);
    return NextResponse.json({
      contract,
      balance: {
        authorized: balance.authorized,
        disbursed: balance.disbursed,
        remaining: balance.remaining,
      },
      suggestedDeduction,
      reason: balance.remaining > 0 ? "ok" : "fully_amortized",
    });
  } catch (e: any) {
    console.error("[cuts advance-suggestion]", e?.code, e?.message);
    return NextResponse.json(
      { error: "Error al calcular anticipo" },
      { status: 500 },
    );
  }
}
