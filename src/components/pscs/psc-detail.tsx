"use client";

import {
  Pause,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePscsStore, PSC_STATUS_LABELS, PSC_STATUS_VARIANTS } from "@/lib/data-store";
import { useProjectsStore } from "@/lib/data-store";
import { useProvidersStore } from "@/lib/data-store";
import { useBudgetsStore } from "@/lib/data-store";
import { formatCurrency, formatPercent, formatDate, cn } from "@/lib/utils";
import type { PSC } from "@/types";

export function PSCDetail({ psc, onClose }: { psc: PSC; onClose: () => void }) {
  const { getProject } = useProjectsStore();
  const { getProvider } = useProvidersStore();
  const { getBudgetByProject } = useBudgetsStore();
  const { setStatus } = usePscsStore();

  const project = getProject(psc.projectId);
  const provider = getProvider(psc.providerId);
  const budget = getBudgetByProject(psc.projectId);

  const executed = psc.items.reduce((s, it) => s + it.executedAmount, 0);
  const percent = psc.totalValue > 0 ? (executed / psc.totalValue) * 100 : 0;
  const variant = PSC_STATUS_VARIANTS[psc.status];

  // Comparativa vs PT
  const ptItems = budget?.layers.flatMap((l) => l.items) ?? [];
  const ptTotal = budget?.totalValue ?? 0;
  const ptContracted = psc.items.reduce((sum, it) => {
    const ptItem = ptItems.find((p) => p.id === it.budgetItemId);
    return ptItem ? sum + ptItem.totalPrice : sum;
  }, 0);
  const ptCoverage = ptTotal > 0 ? (ptContracted / ptTotal) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={variant}>{PSC_STATUS_LABELS[psc.status]}</Badge>
        <span className="font-mono text-xs text-muted-foreground">{psc.pscNumber}</span>
      </div>
      <div>
        <h2 className="text-xl font-semibold">PSC – {provider?.name}</h2>
        <p className="text-sm text-muted-foreground">
          {project?.code} · {project?.name}
        </p>
      </div>

      {psc.notes && (
        <p className="rounded-md bg-secondary/40 p-3 text-sm">{psc.notes}</p>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Contratado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatCurrency(psc.totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Ejecutado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-emerald-600">{formatCurrency(executed)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">% Avance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatPercent(percent)}</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full",
                  percent >= 90 ? "bg-emerald-500" : percent >= 30 ? "bg-primary" : "bg-amber-500"
                )}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Cobertura del PT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatPercent(ptCoverage)}</p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(ptContracted)} de {formatCurrency(ptTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de items */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Ítems espejo del PT</h3>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/30 text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2">Item del PT</th>
                <th className="px-3 py-2 text-center">Unidad</th>
                <th className="px-3 py-2 text-right">Cant.</th>
                <th className="px-3 py-2 text-right">P. Unit.</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Ejecutado</th>
                <th className="px-3 py-2 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {psc.items.map((it) => {
                const ex = it.totalPrice > 0 ? (it.executedAmount / it.totalPrice) * 100 : 0;
                const ptItem = ptItems.find((p) => p.id === it.budgetItemId);
                return (
                  <tr key={it.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <p className="font-medium">{it.description}</p>
                      {ptItem && (
                        <p className="text-[10px] text-muted-foreground">
                          PT: {ptItem.quantity} {ptItem.unit} · {formatCurrency(ptItem.totalPrice)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{it.unit}</td>
                    <td className="px-3 py-2 text-right">{it.quantity.toLocaleString("es-CO")}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(it.unitPrice)}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatCurrency(it.totalPrice)}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-600">
                      {formatCurrency(it.executedAmount)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-xs">{formatPercent(ex)}</span>
                        <div className="h-1.5 w-10 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${Math.min(ex, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Acciones de estado */}
      {psc.status !== "COMPLETED" && psc.status !== "CANCELLED" && (
        <div className="flex flex-wrap gap-2 border-t pt-3">
          {psc.status === "ACTIVE" && (
            <Button variant="outline" onClick={() => { setStatus(psc.id, "SUSPENDED"); onClose(); }}>
              <Pause className="mr-2 h-4 w-4" /> Suspender
            </Button>
          )}
          {psc.status === "SUSPENDED" && (
            <Button variant="outline" onClick={() => { setStatus(psc.id, "ACTIVE"); onClose(); }}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Reactivar
            </Button>
          )}
          <Button onClick={() => { setStatus(psc.id, "COMPLETED"); onClose(); }}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar completado
          </Button>
          <Button variant="destructive" onClick={() => { setStatus(psc.id, "CANCELLED"); onClose(); }}>
            <XCircle className="mr-2 h-4 w-4" /> Cancelar PSC
          </Button>
        </div>
      )}

      {psc.startDate && (
        <p className="text-xs text-muted-foreground">
          Inicio: {formatDate(psc.startDate)} · Creado: {formatDate(psc.createdAt)}
        </p>
      )}
    </div>
  );
}
