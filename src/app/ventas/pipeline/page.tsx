"use client";

import { useState } from "react";
import { TrendingUp, Plus, Building2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useClientsStore,
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_VARIANTS,
  CLIENT_SOURCE_LABELS,
} from "@/lib/data-store";
import { useQuotationsStore } from "@/lib/data-store";
import { formatCurrency, cn } from "@/lib/utils";
import type { Client, ClientStatus, Quotation } from "@/types";

const STAGES: { key: ClientStatus; title: string; color: string }[] = [
  {
    key: "PROSPECT",
    title: "Prospecto",
    color: "border-slate-400 bg-slate-50",
  },
  {
    key: "CONTACTED",
    title: "Contactado",
    color: "border-blue-400 bg-blue-50",
  },
  {
    key: "QUALIFIED",
    title: "Calificado",
    color: "border-cyan-400 bg-cyan-50",
  },
  {
    key: "PROPOSAL",
    title: "Propuesta",
    color: "border-violet-400 bg-violet-50",
  },
  {
    key: "NEGOTIATION",
    title: "Negociación",
    color: "border-amber-400 bg-amber-50",
  },
  { key: "WON", title: "Ganado", color: "border-emerald-500 bg-emerald-50" },
];

import { useConfirm } from "@/components/ui/confirm-dialog";
import { ModuleExplanationCard } from "@/components/ui/module-explanation-card";
export default function PipelinePage() {
  const { clients, setStatus } = useClientsStore();
  const { quotations } = useQuotationsStore();
  const [viewing, setViewing] = useState<Client | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const byStage = groupClientsByStage(clients);

  const totalValue = sumOpenQuotationValue(clients, quotations);
  const stats = {
    inPipeline: clients.filter((c) =>
      [
        "PROSPECT",
        "CONTACTED",
        "QUALIFIED",
        "PROPOSAL",
        "NEGOTIATION",
      ].includes(c.status),
    ).length,
    won: clients.filter((c) => c.status === "WON").length,
    lost: clients.filter((c) => c.status === "LOST").length,
  };

  function handleDrop(stage: ClientStatus, e: React.DragEvent) {
    e.preventDefault();
    if (!draggedId) return;
    setStatus(draggedId, stage);
    setDraggedId(null);
  }

  return (
    <div className="space-y-6">

      <ModuleExplanationCard
        icon={TrendingUp}
        variant="guide"
        title="Pipeline de Ventas"
        description="Vista kanban del embudo comercial."
        steps={[
            { title: "Vista por etapa", description: "Cada columna es una etapa." },
            { title: "Avanzar cliente", description: "Cambia estado desde la tarjeta." },
          ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Pipeline Comercial
          </h1>
          <p className="text-sm text-muted-foreground">
            {stats.inPipeline} en pipeline · {stats.won} ganados ·{" "}
            {formatCurrency(totalValue.total)} cotizado
          </p>
        </div>
        <Button asChild>
          <a href="/ventas/clientes">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo cliente
          </a>
        </Button>
      </div>

      {/* Métricas del funnel */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          label="En pipeline"
          value={stats.inPipeline}
          icon={TrendingUp}
          color="text-amber-600"
        />
        <Kpi
          label="Ganados"
          value={stats.won}
          icon={Building2}
          color="text-emerald-600"
        />
        <Kpi
          label="Perdidos"
          value={stats.lost}
          icon={Building2}
          color="text-red-600"
        />
        <Kpi
          label="Valor cotizado"
          value={formatCurrency(totalValue.total)}
          icon={TrendingUp}
          color="text-blue-600"
        />
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto pb-4">
        <div className="grid min-w-[1100px] grid-cols-6 gap-3">
          {STAGES.map((stage) => {
            const stageClients = byStage[stage.key] || [];
            const stageValue = stageClients.reduce((s, c) => {
              const cq = quotations.filter(
                (q) =>
                  q.clientId === c.id &&
                  q.status !== "REJECTED" &&
                  q.status !== "CANCELLED",
              );
              return s + cq.reduce((sum, q) => sum + q.total, 0);
            }, 0);
            return (
              <div
                key={stage.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(stage.key, e)}
                className={cn(
                  "rounded-lg border-2 border-dashed p-2 min-h-[400px]",
                  stage.color,
                )}
              >
                <div className="mb-2 px-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{stage.title}</h3>
                    <Badge variant={CLIENT_STATUS_VARIANTS[stage.key]}>
                      {stageClients.length}
                    </Badge>
                  </div>
                  {stageClients.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatCurrency(stageValue)}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  {stageClients.length === 0 ? (
                    <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                      Arrastra clientes aquí
                    </p>
                  ) : (
                    stageClients.map((c) => {
                      const cq = quotations.filter((q) => q.clientId === c.id);
                      const lastQ = cq[cq.length - 1];
                      return (
                        <div
                          key={c.id}
                          draggable
                          onDragStart={() => setDraggedId(c.id)}
                          onDragEnd={() => setDraggedId(null)}
                          onClick={() => setViewing(c)}
                          className={cn(
                            "cursor-grab rounded-md border bg-card p-3 text-sm shadow-sm transition-shadow hover:shadow-md",
                            draggedId === c.id && "opacity-50",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium leading-tight">
                              {c.companyName}
                            </p>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {c.contactName}
                          </p>
                          <div className="mt-2 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {cq.length} cotizacion
                              {cq.length === 1 ? "" : "es"}
                            </span>
                            {lastQ && (
                              <span className="font-semibold text-emerald-600">
                                {formatCurrency(lastQ.total)}
                              </span>
                            )}
                          </div>
                          {c.status === "WON" && lastQ && (
                            <Badge
                              variant="success"
                              className="mt-2 w-full justify-center text-[10px]"
                            >
                              {lastQ.quotationNumber} aceptada
                            </Badge>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.companyName}</DialogTitle>
                <DialogDescription>
                  {viewing.clientNumber} ·{" "}
                  {CLIENT_STATUS_LABELS[viewing.status]}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground">Contacto:</span>{" "}
                    {viewing.contactName}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>{" "}
                    {viewing.email}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Teléfono:</span>{" "}
                    {viewing.phone}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ciudad:</span>{" "}
                    {viewing.city}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fuente:</span>{" "}
                    {CLIENT_SOURCE_LABELS[viewing.source]}
                  </div>
                  {viewing.nit && (
                    <div>
                      <span className="text-muted-foreground">NIT:</span>{" "}
                      {viewing.nit}
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-1.5 font-semibold">Mover a etapa</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {STAGES.map((s) => (
                      <Button
                        key={s.key}
                        variant={
                          viewing.status === s.key ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => {
                          setStatus(viewing.id, s.key);
                          setViewing({ ...viewing, status: s.key });
                        }}
                      >
                        {s.title}
                      </Button>
                    ))}
                    <Button
                      variant={
                        viewing.status === "LOST" ? "destructive" : "outline"
                      }
                      size="sm"
                      onClick={() => {
                        setStatus(viewing.id, "LOST");
                        setViewing({ ...viewing, status: "LOST" });
                      }}
                    >
                      Perdido
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

// Helpers locales
function groupClientsByStage(
  clients: Client[],
): Record<ClientStatus, Client[]> {
  const map = {} as Record<ClientStatus, Client[]>;
  STAGES.forEach((s) => (map[s.key] = []));
  clients.forEach((c) => {
    if (map[c.status]) map[c.status].push(c);
  });
  return map;
}

function sumOpenQuotationValue(
  _clients: Client[],
  quotations: Quotation[],
): { total: number } {
  return {
    total: quotations
      .filter((q) => q.status !== "REJECTED" && q.status !== "CANCELLED")
      .reduce((s, q) => s + q.total, 0),
  };
}
