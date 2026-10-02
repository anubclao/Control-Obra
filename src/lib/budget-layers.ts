/**
 * lib/budget-layers.ts
 *
 * Normaliza las capas (capítulos) e ítems del PT que llegan del navegador
 * (salida de buildBudgetLayers) antes de guardarlas: descarta los ids
 * temporales y recalcula totalPrice = cantidad × vr unitario. Función pura.
 *
 * SPEC: docs/specs/bug-presupuestos-persistencia.md
 */

import type { BudgetLayerType } from "@/types";

const LAYER_TYPES: BudgetLayerType[] = ["CHAPTER", "SUBCHAPTER", "ITEM"];

export interface NormalizedBudgetItem {
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface NormalizedBudgetLayer {
  code: string;
  name: string;
  layerType: BudgetLayerType;
  items: NormalizedBudgetItem[];
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

export function normalizeBudgetLayers(raw: unknown): NormalizedBudgetLayer[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((l: any, idx) => ({
    code: String(l?.code ?? idx + 1),
    name: String(l?.name ?? "").trim() || `Capítulo ${idx + 1}`,
    layerType: LAYER_TYPES.includes(l?.layerType) ? l.layerType : "CHAPTER",
    items: (Array.isArray(l?.items) ? l.items : []).map((it: any) => ({
      description: String(it?.description ?? "").trim() || "(sin descripción)",
      unit: String(it?.unit ?? "").trim() || "UN",
      quantity: num(it?.quantity),
      unitPrice: num(it?.unitPrice),
      totalPrice: round2(num(it?.quantity) * num(it?.unitPrice)),
    })),
  }));
}

export function sumBudgetLayers(layers: NormalizedBudgetLayer[]): number {
  return round2(layers.reduce((s, l) => s + l.items.reduce((t, it) => t + it.totalPrice, 0), 0));
}
