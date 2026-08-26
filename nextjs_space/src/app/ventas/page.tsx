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
];

export default function VentasDashboard() {
  const { stats, loading } = useDashboardStats();
  const { clients, load: loadClients } = useClientsStore();
  const { quotations, load: loadQuotations } = useQuotationsStore();

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
  const totalWon = stats.activeClients;
  const totalActive = clients.length;

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
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard Comercial</h1>
        <p className="text-sm text-muted-foreground">
          Pipeline de ventas, clientes y cotizaciones
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes totales</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{totalActive}</div>
            <p className="text-xs text-muted-foreground">En cartera</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes ganados</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{totalWon}</div>
            <p className="text-xs text-muted-foreground">
              {totalActive > 0 ? Math.round((totalWon / totalActive) * 100) : 0}% conversión
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cotizaciones abiertas</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.openQuotations}</div>
            <p className="text-xs text-muted-foreground">En proceso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor en pipeline</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(totalOpenValue)}</div>
            <p className="text-xs text-muted-foreground">Cotizaciones abiertas</p>
          </CardContent>
        </Card>
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
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando pipeline…</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {funnelOrder.map((stage, idx) => {
                const stageClients = clientsByStage[stage];
                const config = stageConfig[stage];
                return (
                  <div key={stage} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className={config.color}>{config.label}</Badge>
                      <span className="text-sm font-semibold">{stageClients.length}</span>
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
                            <p className="font-medium leading-tight">{c.companyName}</p>
                            <p className="mt-0.5 truncate text-muted-foreground">{c.contactName}</p>
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
                      <div className="hidden text-center text-muted-foreground lg:block">↓</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
            {quotations.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm font-medium">Sin cotizaciones aún</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Crea tu primera cuando un cliente llegue a la etapa de Propuesta.
                </p>
              </div>
            ) : (
              quotations.slice(0, 4).map((q) => {
                const client = clients.find((c) => c.id === q.clientId);
                return (
                  <div key={q.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex-1">
                      <p className="font-mono text-xs text-muted-foreground">{q.quotationNumber}</p>
                      <p className="font-medium">{q.title}</p>
                      <p className="text-sm text-muted-foreground">{client?.companyName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(q.total)}</p>
                      <p className="text-xs text-muted-foreground">Vence: {formatDate(q.validUntil)}</p>
                      <Badge variant="outline" className="mt-1">{q.status}</Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
