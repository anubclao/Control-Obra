"use client";

/** Pestaña Cuentas: el saldo actual se calcula, nunca se teclea (AC-10 a AC-12). */

import { useState } from "react";
import { Landmark, Plus, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAccountingStore } from "@/lib/accounting-store";
import { accountBalance } from "@/lib/accounting";
import { ACCOUNTING_ACCOUNT_TYPE_LABELS } from "@/lib/accounting-constants";
import { formatCurrency } from "@/lib/utils";
import type { AccountingAccount, AccountingAccountType } from "@/types";
import { EmptyState } from "./accounting-shared";

export function AccountingAccounts() {
  const {
    accounts,
    incomes,
    expenses,
    taxMovements,
    addAccount,
    updateAccount,
    deleteAccount,
  } = useAccountingStore();
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);

  const dataset = { incomes, expenses, taxMovements };
  const total = accounts
    .filter((a) => a.isActive)
    .reduce((sum, a) => sum + accountBalance(a, dataset), 0);

  function handleDelete(account: AccountingAccount) {
    confirm.open({
      title: "Eliminar cuenta",
      description: `¿Eliminar "${account.name}"? Solo es posible si no tiene movimientos.`,
      variant: "danger",
      onConfirm: async () => {
        await deleteAccount(account.id);
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Disponible en cuentas activas
          </p>
          <p className="text-2xl font-semibold">{formatCurrency(total)}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nueva cuenta
        </Button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Aún no tienes cuentas"
          description="Crea una cuenta para empezar a registrar ingresos, gastos y pagos."
          actionLabel="Crear primera cuenta"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => {
            const balance = accountBalance(a, dataset);
            return (
              <Card key={a.id} className={a.isActive ? "" : "opacity-60"}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ACCOUNTING_ACCOUNT_TYPE_LABELS[a.type]}
                      </p>
                    </div>
                    <Badge variant={a.isActive ? "success" : "secondary"}>
                      {a.isActive ? "Activa" : "Inactiva"}
                    </Badge>
                  </div>
                  <p
                    className={
                      balance < 0
                        ? "text-2xl font-semibold text-destructive"
                        : "text-2xl font-semibold"
                    }
                  >
                    {formatCurrency(balance)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Saldo inicial {formatCurrency(a.openingBalance)}
                    {a.notes ? ` · ${a.notes}` : ""}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateAccount(a.id, { isActive: !a.isActive })
                      }
                    >
                      <Power className="mr-1 h-3.5 w-3.5" />
                      {a.isActive ? "Desactivar" : "Activar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(a)}
                      aria-label="Eliminar cuenta"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AccountFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={async (values) => {
          const ok = await addAccount(values);
          if (ok) setCreateOpen(false);
          return ok;
        }}
      />

      {confirm.dialog}
    </div>
  );
}

function AccountFormDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: Partial<AccountingAccount>) => Promise<boolean>;
}) {
  const error = useAccountingStore((s) => s.error);
  const empty = {
    name: "",
    type: "CORRIENTE" as AccountingAccountType,
    openingBalance: "",
    notes: "",
  };
  const [form, setForm] = useState(empty);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva cuenta</DialogTitle>
          <DialogDescription>
            El saldo actual se calcula con los movimientos; aquí solo va el
            saldo inicial.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="acc-name">Nombre</Label>
            <Input
              id="acc-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select
              value={form.type}
              onValueChange={(v) =>
                setForm({ ...form, type: v as AccountingAccountType })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACCOUNTING_ACCOUNT_TYPE_LABELS).map(
                  ([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="acc-balance">Saldo inicial</Label>
            <Input
              id="acc-balance"
              type="number"
              value={form.openingBalance}
              onChange={(e) =>
                setForm({ ...form, openingBalance: e.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="acc-notes">Notas</Label>
            <Textarea
              id="acc-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!form.name}
            onClick={async () => {
              const ok = await onSubmit({
                name: form.name,
                type: form.type,
                openingBalance: Number(form.openingBalance || 0),
                notes: form.notes,
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
