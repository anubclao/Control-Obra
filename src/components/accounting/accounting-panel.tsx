"use client";

/** Pestaña Panel: KPIs, agrupaciones, serie mensual y exportación (AC-15 a AC-17). */

import { useMemo } from "react";
import { Download, Landmark, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccountingStore } from "@/lib/accounting-store";
import {
  buildFullReportCsv,
  downloadCsv,
  groupSum,
  monthlySeries,
  summarize,
} from "@/lib/accounting";
import { formatCurrency } from "@/lib/utils";
import { KpiCard } from "./accounting-shared";

export function AccountingPanel({
  scopeLabel,
  projectNameOf,
}: {
  scopeLabel: string;
  projectNameOf: (projectId: string | null | undefined) => string;
}) {
  const { incomes, expenses, taxMovements, accounts } = useAccountingStore();
  const year = new Date().getFullYear();

  const summary = useMemo(
    () => summarize({ incomes, expenses, taxMovements }, year),
    [incomes, expenses, taxMovements, year],
  );

  const byClient = useMemo(
    () => groupSum(incomes, (i) => i.clientName, (i) => i.amount, "Sin cliente"),
    [incomes],
  );
  const byIncomeCostCenter = useMemo(
    () => groupSum(incomes, (i) => i.costCenter, (i) => i.amount),
    [incomes],
  );
  const byProvider = useMemo(
    () => groupSum(expenses, (e) => e.providerName, (e) => e.amount, "Sin proveedor"),
    [expenses],
  );
  const byExpenseCostCenter = useMemo(
    () => groupSum(expenses, (e) => e.costCenter, (e) => e.amount),
    [expenses],
  );
  const series = useMemo(() => monthlySeries(incomes, expenses), [incomes, expenses]);

  function exportReport() {
    const csv = buildFullReportCsv({
      scopeLabel,
      incomes,
      expenses,
      accounts,
      taxMovements,
      year,
      projectNameOf,
    });
    const safe = scopeLabel.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    downloadCsv(`contabilidad_${safe}_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" onClick={exportReport}>
          <Download className="mr-2 h-4 w-4" /> Exportar reporte completo
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ingresos totales"
          value={formatCurrency(summary.totalIncome)}
          icon={TrendingUp}
          color="text-emerald-600"
        />
        <KpiCard
          label="Gastos totales"
          value={formatCurrency(summary.totalExpenses)}
          hint={`Operativos ${formatCurrency(summary.totalOperatingExpenses)}`}
          icon={TrendingDown}
          color="text-rose-600"
        />
        <KpiCard
          label={`Impuestos ${year}`}
          value={formatCurrency(summary.totalTaxes)}
          icon={Landmark}
          color="text-amber-600"
        />
        <KpiCard
          label="Balance neto"
          value={formatCurrency(summary.balance)}
          hint={`Margen ${summary.margin.toFixed(1)}%`}
          icon={Scale}
          color={summary.balance < 0 ? "text-destructive" : "text-blue-600"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GroupCard title="Ingresos por cliente" rows={byClient} />
        <GroupCard title="Ingresos por centro de costo" rows={byIncomeCostCenter} />
        <GroupCard title="Gastos por proveedor" rows={byProvider} />
        <GroupCard title="Gastos por centro de costo" rows={byExpenseCostCenter} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ingresos vs gastos por mes</CardTitle>
        </CardHeader>
        <CardContent>
          {series.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
          ) : (
            <div className="space-y-3">
              {series.map((point) => {
                const max = Math.max(
                  ...series.map((p) => Math.max(p.incomes, p.expenses)),
                  1,
                );
                return (
                  <div key={point.month} className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{point.month}</span>
                      <span>
                        {formatCurrency(point.incomes)} / {formatCurrency(point.expenses)}
                      </span>
                    </div>
                    <div className="flex h-2 gap-1">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${(point.incomes / max) * 50}%` }}
                      />
                      <div
                        className="h-full rounded-full bg-rose-500"
                        style={{ width: `${(point.expenses / max) * 50}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GroupCard({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; total: number }[];
}) {
  const top = rows.slice(0, 6);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        ) : (
          <ul className="space-y-2">
            {top.map((row) => (
              <li key={row.key} className="flex justify-between gap-3 text-sm">
                <span className="truncate text-muted-foreground">{row.key}</span>
                <span className="shrink-0 font-medium">{formatCurrency(row.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
