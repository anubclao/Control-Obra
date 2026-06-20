"use client";

import Link from "next/link";
import {
  Building2,
  FileSpreadsheet,
  TrendingUp,
  UserPlus,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MOCK_CLIENTS, MOCK_QUOTATIONS } from "@/mocks";
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
  "PROSPECT", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON",
];

export default function VentasDashboard() {
  const clientsByStage = funnelOrder.reduce((acc, stage) => {
    acc[stage] = MOCK_CLIENTS.filter((c) => c.status === stage);
    return acc;
  }, {} as Record<ClientStatus, typeof MOCK_CLIENTS>);

  const totalOpenValue = MOCK_QUOTATIONS
    .filter((q) => ["SENT", "VIEWED", "DRAFT"].includes(q.status))
    .reduce((sum, q) => sum + q.total, 0);

  const totalWon = MOCK_CLIENTS.filter((c) => c.status === "WON").length;
  const totalActive = MOCK_CLIENTS.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard Comercial</h1>
        <p className="text-sm text-muted-foreground">
          Pipeline de ventas, clientes y cotizaciones
        </p>
      </div>

      {/* KPIs */}
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
            <div className="text-2xl font-semibold">
              {MOCK_QUOTATIONS.filter((q) => ["SENT", "VIEWED", "DRAFT"].includes(q.status)).length}
            </div>
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

      {/* Pipeline / Funnel */}
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {funnelOrder.map((stage, idx) => {
              const clients = clientsByStage[stage];
              const config = stageConfig[stage];
              return (
                <div key={stage} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge className={config.color}>{config.label}</Badge>
                    <span className="text-sm font-semibold">{clients.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {clients.length === 0 ? (
                      <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                        Vacío
                      </div>
                    ) : (
                      clients.slice(0, 3).map((c) => (
                        <div key={c.id} className="rounded-md border bg-card p-2 text-xs">
                          <p className="font-medium leading-tight">{c.companyName}</p>
                          <p className="mt-0.5 truncate text-muted-foreground">{c.contactName}</p>
                        </div>
                      ))
                    )}
                    {clients.length > 3 && (
                      <p className="text-center text-xs text-muted-foreground">
                        +{clients.length - 3} más
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
        </CardContent>
      </Card>

      {/* Cotizaciones recientes */}
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
            {MOCK_QUOTATIONS.slice(0, 4).map((q) => {
              const client = MOCK_CLIENTS.find((c) => c.id === q.clientId);
              return (
                <div key={q.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex-1">
                    <p className="font-mono text-xs text-muted-foreground">{q.quotationNumber}</p>
                    <p className="font-medium">{q.title}</p>
                    <p className="text-sm text-muted-foreground">{client?.companyName}</p>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
