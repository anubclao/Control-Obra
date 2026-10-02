"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Calculator,
  ArrowRight,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBudgetsStore } from "@/lib/data-store";
import { useProjectsStore } from "@/lib/data-store";
import { useEnsureLoaded } from "@/lib/use-ensure-loaded";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils";

import { useConfirm } from "@/components/ui/confirm-dialog";
import { ModuleExplanationCard } from "@/components/ui/module-explanation-card";
export default function PresupuestosPage() {
  const { getBudgetByProject, budgets } = useBudgetsStore();
  useEnsureLoaded("projects", "budgets");
  const { projects } = useProjectsStore();
  const [search, setSearch] = useState("");
  const [createFor, setCreateFor] = useState<string>("");

  const withBudget = useMemo(
    () => projects.filter((p) => getBudgetByProject(p.id)),
    [projects, getBudgetByProject]
  );

  const filtered = useMemo(() => {
    return withBudget.filter((p) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.client.toLowerCase().includes(q)
      );
    });
  }, [withBudget, search]);

  const totals = useMemo(() => {
    let clientValue = 0;
    let topeValue = 0;
    let unforeseenValue = 0;
    for (const b of budgets) {
      clientValue += b.clientValue ?? 0;
      topeValue += b.totalValue;
      unforeseenValue += b.unforeseenValue ?? 0;
    }
    return { clientValue, topeValue, unforeseenValue };
  }, [budgets]);

  return (
    <div className="space-y-6">

      <ModuleExplanationCard
        icon={Calculator}
        variant="guide"
        title="Presupuestos (PT)"
        description="Presupuesto Tope por proyecto."
        steps={[
            { title: "Carga presupuesto", description: "Importa Excel o digita items." },
            { title: "Versionar", description: "Nueva version sin perder anterior." },
            { title: "Vincular con PSC", description: "PSC es espejo del PT por contratista." },
          ]}
          tips={[
            "Excel detecta columnas automaticamente.",
          ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Presupuestos</h1>
          <p className="text-sm text-muted-foreground">
            Presupuesto Cliente y Presupuesto Tope por proyecto
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Cargar presupuesto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cargar presupuesto desde Excel</DialogTitle>
              <DialogDescription>
                Selecciona el proyecto al que quieres cargar el presupuesto. La importación detecta
                columnas automáticamente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Select value={createFor} onValueChange={setCreateFor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem
                      key={p.id}
                      value={p.id}
                      disabled={!!getBudgetByProject(p.id)}
                    >
                      {p.code} · {p.name}
                      {getBudgetByProject(p.id) && " (ya tiene presupuesto)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2">
                <Button asChild disabled={!createFor}>
                  <Link href={`/tecnico/presupuestos/cargar?projectId=${createFor}`}>
                    Continuar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resumen ejecutivo — solo lo esencial */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Presupuesto Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatCurrency(totals.clientValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Presupuesto Tope
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatCurrency(totals.topeValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Ítems No Previstos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-amber-600">
              {formatCurrency(totals.unforeseenValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por proyecto, código o cliente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Calculator className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No hay presupuestos</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search
              ? "Intenta con otros términos de búsqueda"
              : "Carga el primer presupuesto para empezar"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((p) => {
            const b = getBudgetByProject(p.id)!;
            const itemCount = b.layers.reduce((s, l) => s + l.items.length, 0);
            const executedAmount = b.layers
              .flatMap((l) => l.items)
              .reduce((s, it) => s + it.executedAmount, 0);
            const executionPercent =
              b.totalValue > 0 ? (executedAmount / b.totalValue) * 100 : 0;
            const overBudget = executedAmount > b.totalValue;
            return (
              <Card key={p.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-muted-foreground">{p.code}</p>
                      <CardTitle className="text-lg">{p.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{p.client}</p>
                    </div>
                    <Badge variant={overBudget ? "warning" : "info"}>
                      {overBudget ? "Sobre tope" : "En tope"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-secondary/40 p-2">
                      <p className="text-xs text-muted-foreground">Cliente</p>
                      <p className="font-semibold">{formatCurrency(b.clientValue ?? 0)}</p>
                    </div>
                    <div className="rounded-md bg-secondary/40 p-2">
                      <p className="text-xs text-muted-foreground">Tope</p>
                      <p className="font-semibold">{formatCurrency(b.totalValue)}</p>
                    </div>
                    <div className="rounded-md bg-secondary/40 p-2">
                      <p className="text-xs text-muted-foreground">Ítems</p>
                      <p className="font-semibold">{itemCount}</p>
                    </div>
                    <div className="rounded-md bg-secondary/40 p-2">
                      <p className="text-xs text-muted-foreground">Ejecutado</p>
                      <p className="font-semibold text-emerald-600">
                        {formatPercent(executionPercent)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(b.createdAt)}
                    </span>
                  </div>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={`/tecnico/presupuestos/${p.id}`}>
                      Ver presupuesto
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
