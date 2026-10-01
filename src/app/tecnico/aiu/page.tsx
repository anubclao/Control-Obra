"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Wallet,
  PieChart,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAiuStore, validateAiu } from "@/lib/data-store";
import { useBudgetsStore } from "@/lib/data-store";
import { useProjectsStore } from "@/lib/data-store";
import { useEnsureLoaded } from "@/lib/use-ensure-loaded";
import { formatCurrency, formatPercent } from "@/lib/utils";

import { useConfirm } from "@/components/ui/confirm-dialog";
import { ModuleExplanationCard } from "@/components/ui/module-explanation-card";
export default function AiuOverviewPage() {
  const { getConfig, hasConfig } = useAiuStore();
  const { getBudgetByProject } = useBudgetsStore();
  const { projects } = useProjectsStore();
  useEnsureLoaded("projects", "budgets", "aius");

  const summary = useMemo(() => {
    const withAiu = projects.filter((p) => hasConfig(p.id));
    const totalBase = withAiu.reduce((s, p) => {
      const b = getBudgetByProject(p.id);
      return s + (b?.totalValue ?? p.totalBudget);
    }, 0);
    const totalAdmin = withAiu.reduce((s, p) => {
      const c = getConfig(p.id);
      const b = getBudgetByProject(p.id);
      return s + ((b?.totalValue ?? p.totalBudget) * (c?.administration ?? 0)) / 100;
    }, 0);
    const totalImprev = withAiu.reduce((s, p) => {
      const c = getConfig(p.id);
      const b = getBudgetByProject(p.id);
      return s + ((b?.totalValue ?? p.totalBudget) * (c?.imprevistos ?? 0)) / 100;
    }, 0);
    const totalUtil = withAiu.reduce((s, p) => {
      const c = getConfig(p.id);
      const b = getBudgetByProject(p.id);
      return s + ((b?.totalValue ?? p.totalBudget) * (c?.utilidad ?? 0)) / 100;
    }, 0);
    const totalAiu = totalAdmin + totalImprev + totalUtil;
    return { withAiu: withAiu.length, totalBase, totalAiu, totalAdmin, totalImprev, totalUtil };
  }, [projects, hasConfig, getConfig, getBudgetByProject]);

  return (
    <div className="space-y-6">

      <ModuleExplanationCard
        icon={TrendingUp}
        variant="guide"
        title="AIU"
        description="Administración, Imprevistos y Utilidad como % sobre el costo directo, más IVA 19% sobre la utilidad."
        steps={[
            { title: "Configurar AIU", description: "Define el % de cada componente (ej. A 8%, I 5%, U 5%)." },
            { title: "Validar", description: "Cada componente entre 0% y 100%; el AIU total no puede superar el 100%." },
          ]}
      />

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">AIU</h1>
        <p className="text-sm text-muted-foreground">
          Resumen de Administración, Imprevistos y Utilidad configurados por proyecto.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Con AIU</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {summary.withAiu} / {projects.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Base total</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatCurrency(summary.totalBase)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">AIU total</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatCurrency(summary.totalAiu)}</p>
            <p className="text-xs text-muted-foreground">
              {formatPercent(summary.totalBase > 0 ? (summary.totalAiu / summary.totalBase) * 100 : 0)}{" "}
              del base
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-muted-foreground" />
            Distribución global
          </CardTitle>
          <CardDescription>
            Suma de Administración + Imprevistos + Utilidad sobre toda la cartera configurada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-sm text-muted-foreground">Administración</p>
                <p className="text-2xl font-semibold text-blue-600">
                  {formatCurrency(summary.totalAdmin)}
                </p>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-blue-500"
                  style={{
                    width: `${summary.totalAiu > 0 ? (summary.totalAdmin / summary.totalAiu) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-sm text-muted-foreground">Imprevistos</p>
                <p className="text-2xl font-semibold text-amber-600">
                  {formatCurrency(summary.totalImprev)}
                </p>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-amber-500"
                  style={{
                    width: `${summary.totalAiu > 0 ? (summary.totalImprev / summary.totalAiu) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-sm text-muted-foreground">Utilidad</p>
                <p className="text-2xl font-semibold text-emerald-600">
                  {formatCurrency(summary.totalUtil)}
                </p>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-emerald-500"
                  style={{
                    width: `${summary.totalAiu > 0 ? (summary.totalUtil / summary.totalAiu) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuración por proyecto</CardTitle>
          <CardDescription>
            Cada AIU se configura dentro de su presupuesto, en la pestaña AIU
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {projects.map((p) => {
              const c = getConfig(p.id);
              const b = getBudgetByProject(p.id);
              if (!b) return null;
              const valid = c ? validateAiu(c.administration, c.imprevistos, c.utilidad).ok : false;
              return (
                <Link
                  key={p.id}
                  href={`/tecnico/presupuestos/${p.id}`}
                  className="flex items-center justify-between p-3 hover:bg-accent/50"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">{p.code}</p>
                    <p className="text-sm font-medium">{p.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {c ? (
                      <>
                        <span className="text-xs text-blue-600">{c.administration}% A</span>
                        <span className="text-xs text-amber-600">{c.imprevistos}% I</span>
                        <span className="text-xs text-emerald-600">{c.utilidad}% U</span>
                        <Badge variant={valid ? "success" : "warning"}>
                          {valid ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <AlertCircle className="mr-1 h-3 w-3" />}
                          {valid ? "OK" : "Inválido"}
                        </Badge>
                      </>
                    ) : (
                      <Badge variant="outline">Sin configurar</Badge>
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
