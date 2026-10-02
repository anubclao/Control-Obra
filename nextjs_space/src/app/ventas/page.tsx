"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  Building2,
  FileSpreadsheet,
  TrendingUp,
  UserPlus,
  ArrowRight,
  ShoppingBag,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModuleExplanationCard } from "@/components/ui/module-explanation-card";
import { KpiCard } from "@/components/ui/kpi-card";
import { PanelState } from "@/components/ui/panel-state";
import { useClientsStore, useQuotationsStore } from "@/lib/data-store";
import { useDashboardStats } from "@/lib/dashboard-stats";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ClientStatus } from "@/types";

const stageConfig: Record<ClientStatus, { label: string; color: string }> = {
  PROSPECT: { label: "Prospecto", color: "bg-slate-100 text-slate-700" },
  CONTACTED: { label: "Contactado", color: "bg-blue-100 text-blue-700" },
  QUALIFIED: { label: "Calificado", color: "bg-cyan-100 text-cyan-700" },
  PROPOSAL: { label: "Propuesta", color: "bg-violet-100 text-violet-700" },
  NEGOTIATION: { label: "Negociación", color: "bg-amber-100 text-amber-700" },
  WON: { label: "Ganado", color: "bg-emerald-100 text-emerald-700" },
  LOST: { label: "Perdido", color: "bg-red-100 text-red-700" },
};

const funnelOrder: ClientStatus[] = [
  "PROSPECT",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
];

export default function VentasDashboard() {
  // P1 (seccion 4.3): loading/error/reload del hook para no mostrar $0
  //   silencioso en los KPIs.
  const {
    stats,
    loading: statsLoading,
    error: statsError,
    reload: reloadStats,
  } = useDashboardStats();
  const {
    clients,
    loading: clientsLoading,
    error: clientsError,
    load: loadClients,
  } = useClientsStore();
  const {
    quotations,
    loading: quotationsLoading,
    error: quotationsError,
    load: loadQuotations,
  } = useQuotationsStore();

  useEffect(() => {
    loadClients();
    loadQuotations();
  }, []);

  const clientsByStage = funnelOrder.reduce(
    (acc, stage) => {
      acc[stage] = clients.filter((c) => c.status === stage);
      return acc;
    },
    {} as Record<ClientStatus, typeof clients>,
  );

  const totalOpenValue = stats.totalOpenValue;
  const totalWon = clientsByStage.WON.length;
  const totalLost = clientsByStage.LOST.length;
  const totalActive = clients.length;
  // P2 (seccion 4.3): la conversion antes era WON / total (incluia
  //   prospectos y perdidos recien creados). Ahora es WON / (WON + LOST)
  //   que es la metrica real de cierre del pipeline.
  const conversionDenominator = totalWon + totalLost;
  const conversionPercent =
    conversionDenominator > 0
      ? Math.round((totalWon / conversionDenominator) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <ModuleExplanationCard
        icon={ShoppingBag}
        variant="guide"
        title="Dashboard Comercial"
        description="Embudo de ventas, cotizaciones activas y tasa de conversión."
        steps={[
          {
            title: "Añadir prospectos",
            description:
              "Clientes → Nuevo. Captura empresa, contacto, ciudad y fuente (referido, web, etc.).",
          },
          {
            title: "Avanzar en el pipeline",
            description:
              "Cada cliente se mueve por etapas (PROSPECT → WON). Solo se puede avanzar, no retroceder.",
          },
          {
            title: "Generar cotización",
            description:
              "Cuando llega a la etapa de Propuesta, ve a Cotizaciones y crea una con items, IVA y descuentos.",
          },
        ]}
        tips={[
          "Una cotización en estado ACCEPTED puede convertirse en Proyecto automáticamente (futuro).",
          "El pipeline se actualiza en tiempo real al mover clientes de etapa.",
        ]}
      />

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Dashboard Comercial
        </h1>
        <p className="text-sm text-muted-foreground">
          Pipeline de ventas, clientes y cotizaciones
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Clientes totales"
          icon={Building2}
          value={totalActive}
          subtitle="En cartera"
          loading={clientsLoading && totalActive === 0}
          error={totalActive === 0 ? clientsError : null}
          onRetry={loadClients}
        />
        <KpiCard
          title="Clientes ganados"
          icon={TrendingUp}
          value={totalWon}
          subtitle={
            conversionDenominator > 0
              ? `${conversionPercent}% conversión (WON / WON+LOST)`
              : "Sin clientes cerrados aún"
          }
          loading={clientsLoading && totalActive === 0}
          error={totalActive === 0 ? clientsError : null}
          onRetry={loadClients}
        />
        <KpiCard
          title="Cotizaciones abiertas"
          icon={FileSpreadsheet}
          value={stats.openQuotations}
          subtitle="En proceso"
          loading={statsLoading}
          error={statsError}
          onRetry={reloadStats}
        />
        <KpiCard
          title="Valor en pipeline"
          icon={UserPlus}
          value={formatCurrency(totalOpenValue)}
          subtitle="Cotizaciones abiertas"
          loading={statsLoading}
          error={statsError}
          onRetry={reloadStats}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pipeline de ventas</CardTitle>
              <CardDescription>Embudo comercial</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/ventas/pipeline">
                Ver detalle <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <PanelState
            loading={clientsLoading && totalActive === 0}
            error={totalActive === 0 ? clientsError : null}
            onRetry={loadClients}
            isEmpty={totalActive === 0}
            emptyTitle="Sin clientes en el pipeline"
            emptyDescription="Anade tu primer prospecto desde Clientes."
            emptyCta={{ label: "Ir a clientes", href: "/ventas/clientes" }}
            skeletonRows={3}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
              {funnelOrder.map((stage, idx) => {
                const stageClients = clientsByStage[stage];
                const config = stageConfig[stage];
                return (
                  <div key={stage} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className={config.color}>{config.label}</Badge>
                      <span className="text-sm font-semibold">
                        {stageClients.length}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {stageClients.length === 0 ? (
                        <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                          Vacío
                        </div>
                      ) : (
                        stageClients.slice(0, 3).map((c) => (
                          <Link
                            key={c.id}
                            href={`/ventas/clientes`}
                            className="block rounded-md border bg-card p-2 text-xs transition-colors hover:bg-accent"
                          >
                            <p className="font-medium leading-tight">
                              {c.companyName}
                            </p>
                            <p className="mt-0.5 truncate text-muted-foreground">
                              {c.contactName}
                            </p>
                          </Link>
                        ))
                      )}
                      {stageClients.length > 3 && (
                        <p className="text-center text-xs text-muted-foreground">
                          +{stageClients.length - 3} más
                        </p>
                      )}
                    </div>
                    {idx < funnelOrder.length - 1 && (
                      <div className="hidden text-center text-muted-foreground lg:block">
                        ↓
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </PanelState>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cotizaciones recientes</CardTitle>
              <CardDescription>Últimas creadas</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/ventas/cotizaciones">
                Ver todas <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <PanelState
              loading={quotationsLoading && quotations.length === 0}
              error={quotations.length === 0 ? quotationsError : null}
              onRetry={loadQuotations}
              isEmpty={quotations.length === 0}
              emptyTitle="Sin cotizaciones aún"
              emptyDescription="Crea tu primera cuando un cliente llegue a la etapa de Propuesta."
              skeletonRows={2}
            >
              {quotations.slice(0, 4).map((q) => {
                const client = clients.find((c) => c.id === q.clientId);
                return (
                  <div
                    key={q.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex-1">
                      <p className="font-mono text-xs text-muted-foreground">
                        {q.quotationNumber}
                      </p>
                      <p className="font-medium">{q.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {client?.companyName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(q.total)}</p>
                      <p className="text-xs text-muted-foreground">
                        Vence: {formatDate(q.validUntil)}
                      </p>
                      <Badge variant="outline" className="mt-1">
                        {q.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </PanelState>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
