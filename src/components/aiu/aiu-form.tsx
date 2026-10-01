"use client";

import { useState } from "react";
import { useAiuStore, validateAiu } from "@/lib/data-store";
import { computeAiu, IVA_ON_UTILITY_PCT } from "@/lib/aiu-constants";
import { useProjectsStore } from "@/lib/data-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { AiuConfig } from "@/types";

interface AiuFormProps {
  projectId: string;
  existing?: AiuConfig;
  onSuccess?: () => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);

export function AiuForm({ projectId, existing, onSuccess }: AiuFormProps) {
  const { upsertConfig } = useAiuStore();
  const { getProject } = useProjectsStore();
  const project = getProject(projectId);

  const [administration, setAdministration] = useState<number>(
    existing?.administration ?? 10,
  );
  const [imprevistos, setImprevistos] = useState<number>(
    existing?.imprevistos ?? 5,
  );
  const [utilidad, setUtilidad] = useState<number>(existing?.utilidad ?? 5);
  const [notes, setNotes] = useState<string>(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const total = administration + imprevistos + utilidad;
  const validation = validateAiu(administration, imprevistos, utilidad);

  // Preview en dinero: cada % se aplica sobre el costo directo del proyecto.
  const totalBudget = project?.totalBudget ?? 0;
  const preview = computeAiu(totalBudget, { administration, imprevistos, utilidad });
  const adminValue = preview.administration;
  const imprevValue = preview.imprevistos;
  const utilValue = preview.utilidad;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validation.ok) return;
    setSaving(true);
    setSaveError(null);
    // updated_by lo toma la API de la sesión.
    const result = await upsertConfig({
      projectId,
      administration,
      imprevistos,
      utilidad,
      notes: notes || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error ?? "No se pudo guardar el AIU");
      return;
    }
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">
          {project?.code} · {project?.name} · Presupuesto:{" "}
          {new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
            maximumFractionDigits: 0,
          }).format(totalBudget)}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label>Administración (A)</Label>
            <span className="text-sm font-semibold text-blue-600">
              {administration}%
            </span>
          </div>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={administration}
            onChange={(e) => setAdministration(parseFloat(e.target.value) || 0)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {new Intl.NumberFormat("es-CO", {
              style: "currency",
              currency: "COP",
              maximumFractionDigits: 0,
            }).format(adminValue)}
          </p>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label>Imprevistos (I)</Label>
            <span className="text-sm font-semibold text-amber-600">
              {imprevistos}%
            </span>
          </div>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={imprevistos}
            onChange={(e) => setImprevistos(parseFloat(e.target.value) || 0)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {new Intl.NumberFormat("es-CO", {
              style: "currency",
              currency: "COP",
              maximumFractionDigits: 0,
            }).format(imprevValue)}
          </p>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label>Utilidad (U)</Label>
            <span className="text-sm font-semibold text-emerald-600">
              {utilidad}%
            </span>
          </div>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={utilidad}
            onChange={(e) => setUtilidad(parseFloat(e.target.value) || 0)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {new Intl.NumberFormat("es-CO", {
              style: "currency",
              currency: "COP",
              maximumFractionDigits: 0,
            }).format(utilValue)}
          </p>
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block">Notas / justificación</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Contexto, justificación de los porcentajes…"
          rows={2}
        />
      </div>

      <div className="rounded-md border bg-secondary/40 p-3">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Total AIU (sobre costo directo)</span>
          <span
            className={`font-bold ${validation.ok ? "text-emerald-600" : "text-red-600"}`}
          >
            {total.toFixed(2)}%
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-background flex">
          <div
            className="bg-blue-500 h-full"
            style={{ width: `${(administration / 100) * 100}%` }}
          />
          <div
            className="bg-amber-500 h-full"
            style={{ width: `${(imprevistos / 100) * 100}%` }}
          />
          <div
            className="bg-emerald-500 h-full"
            style={{ width: `${(utilidad / 100) * 100}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>A: {administration.toFixed(2)}%</span>
          <span>I: {imprevistos.toFixed(2)}%</span>
          <span>U: {utilidad.toFixed(2)}%</span>
        </div>
        <div className="mt-3 space-y-1 border-t pt-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">IVA {IVA_ON_UTILITY_PCT}% sobre utilidad</span>
            <span>{fmt(preview.iva)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total obra (CD + AIU + IVA)</span>
            <span>{fmt(preview.total)}</span>
          </div>
        </div>
      </div>

      {!validation.ok && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Validación</AlertTitle>
          <AlertDescription>{validation.message}</AlertDescription>
        </Alert>
      )}

      {saveError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No se guardó</AlertTitle>
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      {validation.ok && total > 0 && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Configuración válida</AlertTitle>
          <AlertDescription>
            AIU de {total.toFixed(2)}% sobre el costo directo, más IVA del{" "}
            {IVA_ON_UTILITY_PCT}% sobre la utilidad.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2 border-t pt-4">
        <div className="flex gap-2">
          {onSuccess && (
            <Button type="button" variant="outline" onClick={onSuccess}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={!validation.ok || saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </form>
  );
}
