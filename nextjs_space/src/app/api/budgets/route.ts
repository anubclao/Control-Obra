export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * CRUD: /api/budgets — Presupuestos Tope (PT)
 *
 *   GET                          Budget completo: versiones, capas del Tope,
 *                                snapshot Cliente e ítems no previstos
 *   POST  { projectId, layers }  crea el PT (v1 + Tope + snapshot Cliente)
 *   PUT   { id, … }              valores y condiciones comerciales
 *   PATCH { id, action, … }      NEW_VERSION | ADD_UNFORESEEN | REMOVE_UNFORESEEN
 *
 * Los totales se calculan aquí (lib/budget-layers.ts), nunca vienen del cliente.
 * Spec: docs/specs/bug-presupuestos-persistencia.md
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { requireAuth, requireRole, authFailureResponse } from "@/lib/api-auth";
import {
  validateBudgetCommercialTerms,
  type BudgetCommercialTermsInput,
} from "@/lib/budgets-validation";
import {
  normalizeBudgetLayers,
  sumBudgetLayers,
  type NormalizedBudgetLayer,
} from "@/lib/budget-layers";

const BUDGET_ROLES = [
  "ADMIN",
  "GERENTE",
  "DIRECTOR",
  "RESIDENTE",
  "CONTABILIDAD",
  "TESORERIA",
  "HSEQ",
] as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Parsea TEXT JSON tolerante a NULL. Si no es JSON válido, devuelve null. */
function parseJsonOrNull<T>(v: unknown): T | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function r(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    activeVersionId: row.active_version_id,
    totalValue: Number(row.total_value),
    clientValue: Number(row.client_value),
    unforeseenValue: Number(row.unforeseen_value),
    commercialTerms: {
      paymentTerms: parseJsonOrNull(row.payment_terms_json),
      deliveryDays:
        row.delivery_days == null ? null : Number(row.delivery_days),
      offerValidityDays:
        row.offer_validity_days == null
          ? null
          : Number(row.offer_validity_days),
      commercialAdvisor: parseJsonOrNull(row.commercial_advisor_json),
    },
    createdAt: row.created_at,
  };
}

type Children = {
  versions: any[];
  layers: any[];
  items: any[];
  unforeseen: any[];
};

function itemDto(it: any) {
  return {
    id: it.id,
    layerId: it.layer_id,
    description: it.description,
    unit: it.unit,
    quantity: Number(it.quantity),
    unitPrice: Number(it.unit_price),
    totalPrice: Number(it.total_price),
    executedQuantity: Number(it.executed_quantity ?? 0),
    executedAmount: Number(it.executed_amount ?? 0),
  };
}

/** Arma el Budget completo que esperan las pantallas (los arrays nunca son undefined). */
function fullBudget(row: any, c: Children) {
  const itemsByLayer: Record<string, any[]> = {};
  for (const it of c.items) (itemsByLayer[it.layer_id] ??= []).push(itemDto(it));
  const layersOf = (isClient: boolean) =>
    c.layers
      .filter((l) => l.budget_id === row.id && Boolean(Number(l.is_client)) === isClient)
      .map((l) => ({
        id: l.id,
        budgetId: l.budget_id,
        code: l.code,
        name: l.name,
        layerType: l.layer_type,
        parentId: l.parent_id ?? undefined,
        items: itemsByLayer[l.id] ?? [],
      }));
  return {
    ...r(row),
    versions: c.versions
      .filter((v) => v.budget_id === row.id)
      .map((v) => ({
        id: v.id,
        budgetId: v.budget_id,
        version: Number(v.version),
        isActive: Boolean(Number(v.is_active)),
        totalValue: Number(v.total_value),
        notes: v.notes ?? undefined,
        createdAt: v.created_at,
      }))
      .sort((a, b) => a.version - b.version),
    layers: layersOf(false),
    clientLayers: layersOf(true),
    unforeseenItems: c.unforeseen
      .filter((u) => u.budget_id === row.id)
      .map((u) => ({ ...itemDto({ ...u, layer_id: "unforeseen" }), createdAt: u.created_at })),
  };
}

async function loadChildren(budgetIds: string[]): Promise<Children> {
  if (!budgetIds.length) return { versions: [], layers: [], items: [], unforeseen: [] };
  const [versions, layers, items, unforeseen] = await Promise.all([
    query<any[]>(`SELECT * FROM budget_versions WHERE budget_id IN (?) ORDER BY version ASC`, [budgetIds]),
    query<any[]>(`SELECT * FROM budget_layers WHERE budget_id IN (?) ORDER BY code ASC`, [budgetIds]),
    query<any[]>(
      `SELECT i.* FROM budget_items i
         JOIN budget_layers l ON l.id = i.layer_id
        WHERE l.budget_id IN (?)`,
      [budgetIds],
    ),
    query<any[]>(
      `SELECT * FROM budget_unforeseen_items WHERE budget_id IN (?) ORDER BY created_at ASC`,
      [budgetIds],
    ),
  ]);
  return { versions, layers, items, unforeseen };
}

/** Inserta capas + ítems (Tope o snapshot Cliente) dentro de una transacción. */
async function insertLayers(
  conn: any,
  budgetId: string,
  layers: NormalizedBudgetLayer[],
  isClient: boolean,
) {
  for (const layer of layers) {
    const layerId = randomUUID();
    await conn.execute(
      `INSERT INTO budget_layers (id, budget_id, code, name, layer_type, parent_id, is_client)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [layerId, budgetId, layer.code, layer.name, layer.layerType, null, isClient ? 1 : 0],
    );
    for (const it of layer.items) {
      await conn.execute(
        `INSERT INTO budget_items
           (id, layer_id, description, unit, quantity, unit_price, total_price,
            executed_quantity, executed_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), layerId, it.description, it.unit, it.quantity, it.unitPrice, it.totalPrice, 0, 0],
      );
    }
  }
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const where = projectId ? "WHERE project_id = ?" : "";
    const args = projectId ? [projectId] : [];
    const rows = await query<any[]>(
      `SELECT * FROM budgets ${where} ORDER BY created_at DESC`,
      args,
    );
    const children = await loadChildren(rows.map((b) => b.id));
    return NextResponse.json(rows.map((b) => fullBudget(b, children)));
  } catch (e: any) {
    console.error("[budgets GET]", e?.code, e?.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(...BUDGET_ROLES);
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.projectId)
      return NextResponse.json(
        { error: "projectId requerido" },
        { status: 400 },
      );

    // Condiciones comerciales opcionales (gap-analysis §3.1).
    // Si el cliente las manda, las validamos; si no, NULL → no rompe.
    const ct = body.commercialTerms as BudgetCommercialTermsInput | undefined;
    if (ct) {
      const v = validateBudgetCommercialTerms(ct);
      if (!v.ok) {
        return NextResponse.json(
          { code: v.code, error: v.error },
          { status: v.status },
        );
      }
    }

    // Regla de oro (store legacy): un solo PT por proyecto; para reemplazarlo
    // se crea una nueva versión.
    const existing = await query<any[]>(
      `SELECT id FROM budgets WHERE project_id = ? LIMIT 1`,
      [body.projectId],
    );
    if (existing.length) {
      return NextResponse.json(
        { error: 'Este proyecto ya tiene un PT cargado. Para reemplazarlo, usa "Nueva versión".' },
        { status: 409 },
      );
    }

    const id = randomUUID();
    const paymentTermsJson = ct?.paymentTerms
      ? JSON.stringify(ct.paymentTerms)
      : null;
    const advisorJson = ct?.commercialAdvisor
      ? JSON.stringify(ct.commercialAdvisor)
      : null;
    const deliveryDays =
      ct?.deliveryDays != null ? Number(ct.deliveryDays) : null;
    const offerValidityDays =
      ct?.offerValidityDays != null ? Number(ct.offerValidityDays) : 30;

    const layers = normalizeBudgetLayers(body.layers);
    const totalValue = sumBudgetLayers(layers);
    const versionId = randomUUID();
    const notes = String(body.notes ?? "").trim() || "PT inicial";

    await transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO budgets
           (id, project_id, total_value, client_value, unforeseen_value,
            payment_terms_json, delivery_days, offer_validity_days, commercial_advisor_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          body.projectId,
          totalValue,
          totalValue, // Cliente = Tope al crear (snapshot del presupuesto firmado)
          0,
          paymentTermsJson,
          deliveryDays,
          offerValidityDays,
          advisorJson,
        ],
      );
      await conn.execute(
        `INSERT INTO budget_versions (id, budget_id, version, is_active, total_value, notes)
         VALUES (?, ?, ?, 1, ?, ?)`,
        [versionId, id, 1, totalValue, notes],
      );
      await conn.execute(`UPDATE budgets SET active_version_id = ? WHERE id = ?`, [versionId, id]);
      await insertLayers(conn, id, layers, false);
      await insertLayers(conn, id, layers, true);
    });
    return NextResponse.json(
      { id, projectId: body.projectId, activeVersionId: versionId, totalValue, clientValue: totalValue },
      { status: 201 },
    );
  } catch (e: any) {
    console.error("[budgets POST]", e?.code, e?.message);
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "El proyecto ya tiene presupuesto" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Error al crear presupuesto" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const auth = await requireRole(...BUDGET_ROLES);
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    if (!body?.id)
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    // Validamos commercialTerms si viene; también aceptamos null explícito
    // para "borrar" el bloque.
    if (body.commercialTerms !== undefined && body.commercialTerms !== null) {
      const v = validateBudgetCommercialTerms(body.commercialTerms);
      if (!v.ok) {
        return NextResponse.json(
          { code: v.code, error: v.error },
          { status: v.status },
        );
      }
    }

    const sets: string[] = [];
    const args: any[] = [];
    for (const [k, c] of Object.entries({
      activeVersionId: "active_version_id",
      totalValue: "total_value",
      clientValue: "client_value",
      unforeseenValue: "unforeseen_value",
    })) {
      if (body[k] !== undefined) {
        sets.push(`${c} = ?`);
        args.push(k === "activeVersionId" ? body[k] : Number(body[k]));
      }
    }

    // Campos comerciales (todos opcionales; null explícito = limpiar).
    if (body.commercialTerms !== undefined) {
      const ct = body.commercialTerms as BudgetCommercialTermsInput | null;
      sets.push("payment_terms_json = ?");
      args.push(ct?.paymentTerms ? JSON.stringify(ct.paymentTerms) : null);
      sets.push("delivery_days = ?");
      args.push(ct?.deliveryDays != null ? Number(ct.deliveryDays) : null);
      sets.push("offer_validity_days = ?");
      args.push(
        ct?.offerValidityDays != null ? Number(ct.offerValidityDays) : 30,
      );
      sets.push("commercial_advisor_json = ?");
      args.push(
        ct?.commercialAdvisor ? JSON.stringify(ct.commercialAdvisor) : null,
      );
    }

    if (!sets.length)
      return NextResponse.json(
        { error: "Nada que actualizar" },
        { status: 400 },
      );
    args.push(body.id);
    await query(`UPDATE budgets SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[budgets PUT]", e?.code, e?.message);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

// =============================================================================
// PATCH — acciones sobre el PT: NEW_VERSION | ADD_UNFORESEEN | REMOVE_UNFORESEEN
// =============================================================================
const NOT_FOUND = "__NOT_FOUND__";

export async function PATCH(req: Request) {
  const auth = await requireRole(...BUDGET_ROLES);
  const fail = authFailureResponse(auth);
  if (fail) return fail;
  try {
    const body = await req.json();
    const { id, action } = body ?? {};
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    const lockBudget = async (conn: any) => {
      const [rows] = await conn.query(
        `SELECT id, total_value, unforeseen_value FROM budgets WHERE id = ? FOR UPDATE`,
        [id],
      );
      return rows[0] ?? null;
    };

    let result: unknown;

    if (action === "NEW_VERSION") {
      const layers = normalizeBudgetLayers(body.layers);
      if (!layers.length) {
        return NextResponse.json({ error: "La nueva versión no tiene capítulos" }, { status: 400 });
      }
      const layersTotal = sumBudgetLayers(layers);
      result = await transaction(async (conn) => {
        const budget = await lockBudget(conn);
        if (!budget) return NOT_FOUND;
        const [versions] = await conn.query<any[]>(
          `SELECT COALESCE(MAX(version), 0) AS max_version FROM budget_versions WHERE budget_id = ?`,
          [id],
        );
        const versionNumber = Number(versions[0]?.max_version ?? 0) + 1;
        const versionId = randomUUID();
        // Tope = capas nuevas + no previstos vigentes. El Cliente no cambia.
        const totalValue = round2(layersTotal + Number(budget.unforeseen_value ?? 0));
        await conn.execute(`DELETE FROM budget_layers WHERE budget_id = ? AND is_client = 0`, [id]);
        await insertLayers(conn, id, layers, false);
        await conn.execute(`UPDATE budget_versions SET is_active = 0 WHERE budget_id = ?`, [id]);
        await conn.execute(
          `INSERT INTO budget_versions (id, budget_id, version, is_active, total_value, notes)
           VALUES (?, ?, ?, 1, ?, ?)`,
          [versionId, id, versionNumber, totalValue,
           String(body.notes ?? "").trim() || `Revisión v${versionNumber}`],
        );
        await conn.execute(
          `UPDATE budgets SET total_value = ?, active_version_id = ? WHERE id = ?`,
          [totalValue, versionId, id],
        );
        return { ok: true, versionId, version: versionNumber, totalValue };
      });
    } else if (action === "ADD_UNFORESEEN") {
      const it = body.item ?? {};
      const quantity = Number(it.quantity);
      const unitPrice = Number(it.unitPrice);
      if (!String(it.description ?? "").trim() || !Number.isFinite(quantity) || !Number.isFinite(unitPrice)) {
        return NextResponse.json(
          { error: "El ítem no previsto necesita descripción, cantidad y valor unitario" },
          { status: 400 },
        );
      }
      const totalPrice = round2(quantity * unitPrice);
      result = await transaction(async (conn) => {
        const budget = await lockBudget(conn);
        if (!budget) return NOT_FOUND;
        const itemId = randomUUID();
        await conn.execute(
          `INSERT INTO budget_unforeseen_items
             (id, budget_id, description, unit, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [itemId, id, String(it.description).trim(), String(it.unit ?? "").trim() || "UN",
           quantity, unitPrice, totalPrice],
        );
        // PDF p.5: el ítem no previsto aparece automáticamente en el Tope.
        await conn.execute(
          `UPDATE budgets SET unforeseen_value = ?, total_value = ? WHERE id = ?`,
          [round2(Number(budget.unforeseen_value) + totalPrice),
           round2(Number(budget.total_value) + totalPrice), id],
        );
        return { ok: true, itemId, totalPrice };
      });
    } else if (action === "REMOVE_UNFORESEEN") {
      if (!body.itemId) return NextResponse.json({ error: "itemId requerido" }, { status: 400 });
      result = await transaction(async (conn) => {
        const budget = await lockBudget(conn);
        if (!budget) return NOT_FOUND;
        const [items] = await conn.query<any[]>(
          `SELECT id, total_price FROM budget_unforeseen_items WHERE id = ? AND budget_id = ?`,
          [body.itemId, id],
        );
        if (!items.length) return NOT_FOUND;
        const removed = Number(items[0].total_price);
        await conn.execute(`DELETE FROM budget_unforeseen_items WHERE id = ?`, [body.itemId]);
        await conn.execute(
          `UPDATE budgets SET unforeseen_value = ?, total_value = ? WHERE id = ?`,
          [round2(Number(budget.unforeseen_value) - removed),
           round2(Number(budget.total_value) - removed), id],
        );
        return { ok: true };
      });
    } else {
      return NextResponse.json({ error: `Acción desconocida: ${action}` }, { status: 400 });
    }

    if (result === NOT_FOUND) {
      return NextResponse.json({ error: "Presupuesto o ítem no existe" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("[budgets PATCH]", e?.code, e?.message);
    return NextResponse.json({ error: "Error en la acción del presupuesto" }, { status: 500 });
  }
}
