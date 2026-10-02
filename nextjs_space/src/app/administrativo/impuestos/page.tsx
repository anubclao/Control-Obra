"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  Percent,
  Search,
  Power,
  Trash2,
  Edit,
  PercentCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTaxesStore, TAX_TYPE_LABELS, TAX_APPLIES_LABELS } from "@/lib/data-store";
import { formatDate } from "@/lib/utils";
import type { TaxConfig, TaxType, TaxAppliesTo } from "@/types";

import { useConfirm } from "@/components/ui/confirm-dialog";
import { ModuleExplanationCard } from "@/components/ui/module-explanation-card";
export default function ImpuestosPage() {
  const { taxes, deleteTax, toggleActive } = useTaxesStore();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | TaxType>("ALL");
  const [editing, setEditing] = useState<TaxConfig | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    return taxes.filter((t) => {
      const matchSearch =
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.type.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "ALL" || t.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [taxes, search, typeFilter]);

  const active = taxes.filter((t) => t.isActive).length;
  const avgRate = taxes.length > 0 ? taxes.reduce((s, t) => s + t.rate, 0) / taxes.length : 0;

  return (
    <div className="space-y-6">

      <ModuleExplanationCard
        icon={Percent}
        variant="guide"
        title="Impuestos"
        description="Configura impuestos por proyecto."
        steps={[
            { title: "Crear configuracion", description: "Asigna proyecto, tipo y tasa." },
            { title: "Activar/desactivar", description: "Inactivos NO se aplican." },
          ]}
          tips={[
            "Tipos: IVA, RETENCION_FUENTE, RETENCION_IVA, RETENCION_ICA.",
          ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Impuestos</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de impuestos aplicables a proyectos
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo impuesto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear impuesto</DialogTitle>
              <DialogDescription>Define la tasa y el alcance</DialogDescription>
            </DialogHeader>
            <TaxForm onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiMini label="Activos" value={active} icon={Power} color="text-emerald-600" />
        <KpiMini label="Total configurados" value={taxes.length} icon={Percent} color="text-blue-600" />
        <KpiMini label="Tasa promedio" value={`${avgRate.toFixed(2)}%`} icon={PercentCircle} color="text-violet-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o tipo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los tipos</SelectItem>
            {Object.entries(TAX_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <PercentCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No hay impuestos</h3>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <div
              key={t.id}
              className={`rounded-lg border bg-card p-4 transition-opacity ${
                !t.isActive ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md text-2xl font-bold ${
                    t.isActive ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {t.rate}%
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{t.name}</p>
                    <Badge variant="outline">{TAX_TYPE_LABELS[t.type]}</Badge>
                    <Badge variant="secondary">{TAX_APPLIES_LABELS[t.appliesTo]}</Badge>
                    {!t.isActive && <Badge variant="destructive">Inactivo</Badge>}
                  </div>
                  {t.notes && <p className="mt-1 text-xs text-muted-foreground">{t.notes}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Creado {formatDate(t.createdAt)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(t.id)}>
                    {t.isActive ? "Desactivar" : "Activar"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(t)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`¿Eliminar "${t.name}"?`)) deleteTax(t.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar impuesto</DialogTitle>
            <DialogDescription>{editing?.name}</DialogDescription>
          </DialogHeader>
          {editing && <TaxForm tax={editing} onSuccess={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiMini({
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
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        {label}
      </div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function TaxForm({ tax, onSuccess }: { tax?: TaxConfig; onSuccess: () => void }) {
  const { addTax } = useTaxesStore();
  const isEditing = !!tax;
  const [name, setName] = useState(tax?.name ?? "");
  const [rate, setRate] = useState(tax?.rate ?? 0);
  const [type, setType] = useState<TaxType>(tax?.type ?? "OTROS");
  const [appliesTo, setAppliesTo] = useState<TaxAppliesTo>(tax?.appliesTo ?? "AMBOS");
  const [notes, setNotes] = useState(tax?.notes ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name,
      rate,
      type,
      appliesTo,
      isActive: tax?.isActive ?? true,
      notes: notes || undefined,
    };
    if (tax) {
      // Aquí iría updateTax(tax.id, data)
    } else {
      addTax(data);
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label className="mb-1.5 block">Nombre *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Retención en la fuente" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block">Tasa (%) *</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
            required
          />
        </div>
        <div>
          <Label className="mb-1.5 block">Tipo *</Label>
          <Select value={type} onValueChange={(v) => setType(v as TaxType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TAX_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block">Aplica a *</Label>
        <Select value={appliesTo} onValueChange={(v) => setAppliesTo(v as TaxAppliesTo)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TAX_APPLIES_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="mb-1.5 block">Notas</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onSuccess}>Cancelar</Button>
        <Button type="submit">{isEditing ? "Guardar" : "Crear"}</Button>
      </DialogFooter>
    </form>
  );
}
