"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, AlertCircle, X, CheckCircle2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ModuleExplanationCard } from "@/components/ui/module-explanation-card";
import { usePscsStore } from "@/lib/data-store";
import { useProjectsStore } from "@/lib/data-store";
import { useProvidersStore } from "@/lib/data-store";
import { useBudgetsStore } from "@/lib/data-store";
import { useAuthStore } from "@/lib/auth-store";
import { formatCurrency } from "@/lib/utils";
import type { PSC, PSCItem, PSCStatus } from "@/types";

interface Props {
  psc?: PSC;
  onSuccess: () => void;
}

export function PSCForm({ psc, onSuccess }: Props) {
  const { createPSC, updatePSC, getItemsAvailable } = usePscsStore();
  const { projects } = useProjectsStore();
  const { providers } = useProvidersStore();
  const { getBudgetByProject } = useBudgetsStore();
  const { user } = useAuthStore();
  const isEditing = !!psc;

  const [projectId, setProjectId] = useState(psc?.projectId ?? "");
  const [providerId, setProviderId] = useState(psc?.providerId ?? "");
  const [status, setStatus] = useState<PSCStatus>(psc?.status ?? "DRAFT");
  const [notes, setNotes] = useState(psc?.notes ?? "");
  const [startDate, setStartDate] = useState(psc?.startDate ?? "");
  const [items, setItems] = useState<PSCItem[]>(
    psc?.items ?? [{ id: "new1", budgetItemId: "", description: "", unit: "M2", quantity: 0, unitPrice: 0, totalPrice: 0, executedQuantity: 0, executedAmount: 0 }]
  );
  const [error, setError] = useState<string | null>(null);

  // Auto-sugerir: si cambia proyecto, refrescar items disponibles
  const availableItems = useMemo(() => {
    if (!projectId) return [];
    return getItemsAvailable(projectId, psc?.id);
  }, [projectId, getItemsAvailable, psc?.id]);

  // Si cambia de proyecto, validar items
  useEffect(() => {
    if (!projectId) return;
    const availableIds = new Set(availableItems.map((i) => i.id));
    setItems((prev) => prev.filter((it) => !it.budgetItemId || availableIds.has(it.budgetItemId)));
  }, [projectId, availableItems]);

  function selectItem(idx: number, itemId: string) {
    const item = availableItems.find((i) => i.id === itemId);
    if (!item) return;
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              budgetItemId: item.id,
              description: item.description,
              unit: item.unit,
              unitPrice: item.unitPrice,
              quantity: 0,
              totalPrice: 0,
            }
          : it
      )
    );
  }

  function updateItemField(idx: number, field: keyof PSCItem, value: string | number) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const updated: PSCItem = { ...it, [field]: value };
        if (field === "quantity" || field === "unitPrice") {
          updated.totalPrice = Number(updated.quantity || 0) * Number(updated.unitPrice || 0);
        }
        return updated;
      })
    );
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: `new${Date.now()}`, budgetItemId: "", description: "", unit: "M2", quantity: 0, unitPrice: 0, totalPrice: 0, executedQuantity: 0, executedAmount: 0 },
    ]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalValue = items.reduce((s, it) => s + it.totalPrice, 0);
  const budget = projectId ? getBudgetByProject(projectId) : undefined;
  const itemsWithValidBudgetItem = items.filter((it) => it.budgetItemId).length;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!projectId) return setError("Selecciona un proyecto");
    if (!providerId) return setError("Selecciona un proveedor");
    if (itemsWithValidBudgetItem === 0) return setError("Agrega al menos un ítem del PT");

    const payload = {
      projectId,
      budgetId: budget?.id ?? "",
      providerId,
      items: items.filter((it) => it.budgetItemId),
      totalValue,
      status,
      notes: notes || undefined,
      startDate: startDate || undefined,
    };

    if (psc) {
      updatePSC(psc.id, payload as Partial<PSC>);
    } else {
      const result = createPSC({
        ...payload,
        createdBy: user?.id ?? "unknown",
      } as Omit<PSC, "id" | "pscNumber" | "totalValue" | "createdAt">);
      if (!result.ok) {
        setError(result.error || "Error al crear PSC");
        return;
      }
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ModuleExplanationCard
        icon={FileText}
        variant="guide"
        title="Como crear un PSC"
        description="Selecciona el proyecto con PT, el contratista, y los items del PT que este PSC va a cubrir."
        steps={[
          { title: "Proyecto", description: "Elige el proyecto. Solo aparecen los que tienen PT cargado." },
          { title: "Contratista", description: "Selecciona el proveedor. Debe estar habilitado en el modulo Proveedores." },
          { title: "Items del PT", description: "Agrega los items del PT que este PSC va a cubrir." },
          { title: "Alcance", description: "Define notas, fecha de inicio y guarda como DRAFT." },
        ]}
        tips={["El total contratado al proveedor se calcula automaticamente a partir de los items."]}
        storageKey="psc:form"
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block">Proyecto *</Label>
          <Select value={projectId} onValueChange={setProjectId} disabled={isEditing}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona proyecto" />
            </SelectTrigger>
            <SelectContent>
              {projects
                .filter((p) => getBudgetByProject(p.id))
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code} – {p.name.slice(0, 30)}
                    {!getBudgetByProject(p.id) && " (sin PT)"}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {!budget && projectId && (
            <p className="mt-1 text-xs text-amber-600">⚠ Este proyecto no tiene PT cargado</p>
          )}
        </div>

        <div>
          <Label className="mb-1.5 block">Contratista *</Label>
          <Select value={providerId} onValueChange={setProviderId} disabled={isEditing}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona contratista" />
            </SelectTrigger>
            <SelectContent>
              {providers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name.slice(0, 40)} – {c.nit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block">Estado</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as PSCStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">Borrador</SelectItem>
              <SelectItem value="ACTIVE">Activo</SelectItem>
              <SelectItem value="SUSPENDED">Suspendido</SelectItem>
              <SelectItem value="COMPLETED">Completado</SelectItem>
              <SelectItem value="CANCELLED">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block">Fecha inicio</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>

        <div className="sm:col-span-2">
          <Label className="mb-1.5 block">Notas / alcance del PSC</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </div>

      {/* Items del PT */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Ítems del PT cubiertos</h3>
            <p className="text-xs text-muted-foreground">
              Selecciona los ítems que este contratista va a ejecutar
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Ítem
          </Button>
        </div>

        {projectId && availableItems.length === 0 && !isEditing && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Todos los ítems del PT de este proyecto ya están asignados a otros PSCs.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          {items.map((it, idx) => {
            const selectedId = it.budgetItemId;
            const selectedItem = availableItems.find((i) => i.id === selectedId);
            return (
              <div key={it.id} className="rounded-md border bg-secondary/30 p-3">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-12 sm:col-span-5">
                    <Select value={selectedId} onValueChange={(v) => selectItem(idx, v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona item del PT" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableItems.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No hay items disponibles
                          </SelectItem>
                        ) : (
                          availableItems.map((it) => (
                            <SelectItem key={it.id} value={it.id}>
                              {it.description} ({it.unit}) – {formatCurrency(it.totalPrice)}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.quantity}
                      onChange={(e) => updateItemField(idx, "quantity", parseFloat(e.target.value) || 0)}
                      placeholder="Cant."
                      disabled={!selectedItem}
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={it.unitPrice}
                      onChange={(e) => updateItemField(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                      placeholder="P. Unit."
                      disabled={!selectedItem}
                    />
                  </div>
                  <div className="col-span-9 col-start-1 flex items-center justify-between rounded border bg-background px-3 py-1.5 text-sm sm:col-span-2 sm:col-start-auto">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-semibold">{formatCurrency(it.totalPrice)}</span>
                  </div>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(idx)}
                      className="col-span-3 h-9 w-full sm:col-span-1 sm:w-9"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Total */}
      <div className="rounded-lg border bg-secondary/40 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Total contratado al proveedor</span>
          <span className="text-xl font-bold text-emerald-600">{formatCurrency(totalValue)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {itemsWithValidBudgetItem} de {availableItems.length} items disponibles del PT
        </p>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="submit">{isEditing ? "Guardar cambios" : "Crear PSC"}</Button>
      </div>
    </form>
  );
}
