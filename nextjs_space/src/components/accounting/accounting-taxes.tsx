"use client";

/** Pestaña Impuestos: movimientos declarados y pagados (AC-13, AC-14). */

import { useMemo, useState } from "react";
import { Percent, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAccountingStore } from "@/lib/accounting-store";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AccountingTaxMovement } from "@/types";
import {
  AccountSelect,
  EmptyState,
  NO_ACCOUNT,
  TaxStatusBadge,
  accountValue,
} from "./accounting-shared";

const today = () => new Date().toISOString().slice(0, 10);

export function AccountingTaxes({
  projectIdForNew,
}: {
  projectIdForNew: string | null;
}) {
  const {
    taxMovements,
    accounts,
    addTaxMovement,
    updateTaxMovement,
    deleteTaxMovement,
  } = useAccountingStore();
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const [paying, setPaying] = useState<AccountingTaxMovement | null>(null);

  const year = new Date().getFullYear();
  const totals = useMemo(() => {
    const ofYear = taxMovements.filter((t) => t.date.startsWith(String(year)));
    return {
      declarado: ofYear
        .filter((t) => t.status === "DECLARADO")
        .reduce((s, t) => s + t.amount, 0),
      pagado: ofYear
        .filter((t) => t.status === "PAGADO")
        .reduce((s, t) => s + t.amount, 0),
    };
  }, [taxMovements, year]);

  function handleDelete(movement: AccountingTaxMovement) {
    confirm.open({
      title: "Eliminar movimiento",
      description: `¿Eliminar "${movement.description}"?`,
      variant: "danger",
      onConfirm: async () => {
        await deleteTaxMovement(movement.id);
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Declarado {year}
            </p>
            <p className="text-xl font-semibold">
              {formatCurrency(totals.declarado)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Pagado {year}
            </p>
            <p className="text-xl font-semibold">
              {formatCurrency(totals.pagado)}
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo movimiento
        </Button>
      </div>

      {taxMovements.length === 0 ? (
        <EmptyState
          icon={Percent}
          title="No hay movimientos de impuestos"
          description="Las tarifas se configuran en Impuestos; aquí se registran declaraciones y pagos."
          actionLabel="Registrar primer movimiento"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">Entidad</th>
                <th className="p-3">Descripción</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {taxMovements.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-3 whitespace-nowrap">
                    {formatDate(t.date)}
                  </td>
                  <td className="p-3">{t.authority}</td>
                  <td className="p-3">{t.description}</td>
                  <td className="p-3 text-right">{formatCurrency(t.amount)}</td>
                  <td className="p-3">
                    <TaxStatusBadge status={t.status} />
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      {t.status === "DECLARADO" ? (
                        <>
                          <Button size="sm" onClick={() => setPaying(t)}>
                            Registrar pago
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(t)}
                            aria-label="Eliminar movimiento"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TaxFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={async (values) => {
          const ok = await addTaxMovement({
            ...values,
            projectId: projectIdForNew,
          });
          if (ok) setCreateOpen(false);
          return ok;
        }}
      />

      <Dialog
        open={!!paying}
        onOpenChange={(open) => {
          if (!open) setPaying(null);
        }}
      >
        <TaxPayContent
          movement={paying}
          accounts={accounts}
          onCancel={() => setPaying(null)}
          onSubmit={async (id, accountId) => {
            const ok = await updateTaxMovement(id, {
              status: "PAGADO",
              accountId,
            });
            if (ok) setPaying(null);
          }}
        />
      </Dialog>

      {confirm.dialog}
    </div>
  );
}

function TaxPayContent({
  movement,
  accounts,
  onCancel,
  onSubmit,
}: {
  movement: AccountingTaxMovement | null;
  accounts: ReturnType<typeof useAccountingStore.getState>["accounts"];
  onCancel: () => void;
  onSubmit: (id: string, accountId: string) => Promise<void>;
}) {
  const error = useAccountingStore((s) => s.error);
  const [accountId, setAccountId] = useState(NO_ACCOUNT);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Registrar pago de impuesto</DialogTitle>
        <DialogDescription>
          {movement
            ? `${movement.description} — ${formatCurrency(movement.amount)}`
            : ""}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label>Cuenta de pago</Label>
        <AccountSelect
          accounts={accounts}
          value={accountId}
          onChange={setAccountId}
          allowEmpty={false}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          disabled={!movement || accountValue(accountId) === null}
          onClick={() =>
            movement && onSubmit(movement.id, accountValue(accountId) as string)
          }
        >
          Confirmar pago
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function TaxFormDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: Partial<AccountingTaxMovement>) => Promise<boolean>;
}) {
  const error = useAccountingStore((s) => s.error);
  const empty = {
    date: today(),
    authority: "DIAN",
    description: "",
    amount: "",
  };
  const [form, setForm] = useState(empty);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo movimiento de impuesto</DialogTitle>
          <DialogDescription>Se registra como declarado.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="tax-date">Fecha</Label>
            <Input
              id="tax-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tax-auth">Entidad</Label>
            <Input
              id="tax-auth"
              value={form.authority}
              onChange={(e) => setForm({ ...form, authority: e.target.value })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="tax-desc">Descripción</Label>
            <Input
              id="tax-desc"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tax-amount">Valor</Label>
            <Input
              id="tax-amount"
              type="number"
              min={0}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!form.description}
            onClick={async () => {
              const ok = await onSubmit({
                date: form.date,
                authority: form.authority,
                description: form.description,
                amount: Number(form.amount || 0),
                status: "DECLARADO",
              });
              if (ok) setForm(empty);
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
