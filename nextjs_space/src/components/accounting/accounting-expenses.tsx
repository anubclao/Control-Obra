"use client";

/** Pestaña Gastos: workflow de 6 estados y pago contra cuenta (AC-6 a AC-9). */

import { useMemo, useState } from "react";
import { Plus, Receipt, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  ACCOUNTING_EXPENSE_STATUS_LABELS,
  nextExpenseStatuses,
} from "@/lib/accounting-constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AccountingExpense, AccountingExpenseStatus } from "@/types";
import {
  AccountSelect,
  EmptyState,
  ExpenseStatusBadge,
  NO_ACCOUNT,
  accountValue,
} from "./accounting-shared";

const today = () => new Date().toISOString().slice(0, 10);

interface Props {
  projectIdForNew: string | null;
  costCenterOptions: string[];
  providerOptions: string[];
  defaultResponsible: string;
}

export function AccountingExpenses({
  projectIdForNew,
  costCenterOptions,
  providerOptions,
  defaultResponsible,
}: Props) {
  const { expenses, accounts, addExpense, updateExpense, deleteExpense } =
    useAccountingStore();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | AccountingExpenseStatus
  >("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [paying, setPaying] = useState<AccountingExpense | null>(null);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return expenses.filter((e) => {
      const matchSearch =
        !term ||
        e.providerName.toLowerCase().includes(term) ||
        e.concept.toLowerCase().includes(term) ||
        e.costCenter.toLowerCase().includes(term);
      return (
        matchSearch && (statusFilter === "ALL" || e.status === statusFilter)
      );
    });
  }, [expenses, search, statusFilter]);

  function handleDelete(expense: AccountingExpense) {
    confirm.open({
      title: "Eliminar gasto",
      description: `¿Eliminar "${expense.concept}"?`,
      variant: "danger",
      onConfirm: async () => {
        await deleteExpense(expense.id);
      },
    });
  }

  async function moveTo(
    expense: AccountingExpense,
    status: AccountingExpenseStatus,
  ) {
    if (status === "PAGADO") {
      setPaying(expense);
      return;
    }
    await updateExpense(expense.id, { status });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por proveedor, concepto o centro de costo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            {Object.entries(ACCOUNTING_EXPENSE_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo gasto
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No hay gastos"
          description="Registra el primer gasto para este alcance."
          actionLabel="Registrar primer gasto"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <div
              key={e.id}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{e.concept}</span>
                  <ExpenseStatusBadge status={e.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {e.providerName || "Sin proveedor"} ·{" "}
                  {e.costCenter || "Sin centro de costo"} · {formatDate(e.date)}
                </p>
                {e.detail ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {e.detail}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="text-lg font-semibold">
                  {formatCurrency(e.amount)}
                </span>
                {nextExpenseStatuses(e.status).map((next) => (
                  <Button
                    key={next}
                    size="sm"
                    variant={next === "PAGADO" ? "default" : "outline"}
                    onClick={() => moveTo(e, next)}
                  >
                    {ACCOUNTING_EXPENSE_STATUS_LABELS[next]}
                  </Button>
                ))}
                {e.status !== "PAGADO" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(e)}
                    aria-label="Eliminar gasto"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <ExpenseFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        costCenterOptions={costCenterOptions}
        providerOptions={providerOptions}
        defaultResponsible={defaultResponsible}
        onSubmit={async (values) => {
          const ok = await addExpense({
            ...values,
            projectId: projectIdForNew,
          });
          if (ok) setCreateOpen(false);
          return ok;
        }}
      />

      <PayDialog
        expense={paying}
        accounts={accounts}
        onClose={() => setPaying(null)}
        onSubmit={async (id, accountId) => {
          const ok = await updateExpense(id, { status: "PAGADO", accountId });
          if (ok) setPaying(null);
        }}
      />

      {confirm.dialog}
    </div>
  );
}

function ExpenseFormDialog({
  open,
  onOpenChange,
  costCenterOptions,
  providerOptions,
  defaultResponsible,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCenterOptions: string[];
  providerOptions: string[];
  defaultResponsible: string;
  onSubmit: (values: Partial<AccountingExpense>) => Promise<boolean>;
}) {
  const error = useAccountingStore((s) => s.error);
  const empty = {
    date: today(),
    responsible: defaultResponsible,
    costCenter: "",
    providerName: "",
    concept: "",
    detail: "",
    amount: "",
    status: "POR_PAGAR" as AccountingExpenseStatus,
  };
  const [form, setForm] = useState(empty);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo gasto</DialogTitle>
          <DialogDescription>
            El pago se registra después, desde el flujo de estados.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="exp-date">Fecha</Label>
            <Input
              id="exp-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="exp-resp">Responsable</Label>
            <Input
              id="exp-resp"
              value={form.responsible}
              onChange={(e) =>
                setForm({ ...form, responsible: e.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="exp-cc">Centro de costo</Label>
            <Input
              id="exp-cc"
              list="accounting-cost-centers-exp"
              value={form.costCenter}
              onChange={(e) => setForm({ ...form, costCenter: e.target.value })}
            />
            <datalist id="accounting-cost-centers-exp">
              {costCenterOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label htmlFor="exp-prov">Proveedor</Label>
            <Input
              id="exp-prov"
              list="accounting-providers"
              value={form.providerName}
              onChange={(e) =>
                setForm({ ...form, providerName: e.target.value })
              }
            />
            <datalist id="accounting-providers">
              {providerOptions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="exp-concept">Concepto</Label>
            <Input
              id="exp-concept"
              value={form.concept}
              onChange={(e) => setForm({ ...form, concept: e.target.value })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="exp-detail">Detalle</Label>
            <Textarea
              id="exp-detail"
              rows={2}
              value={form.detail}
              onChange={(e) => setForm({ ...form, detail: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="exp-amount">Valor a pagar</Label>
            <Input
              id="exp-amount"
              type="number"
              min={0}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Estado inicial</Label>
            <Select
              value={form.status}
              onValueChange={(v) =>
                setForm({ ...form, status: v as AccountingExpenseStatus })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  ["POR_PAGAR", "APROBADO", "URGENTE", "RETEGARANTIA"] as const
                ).map((s) => (
                  <SelectItem key={s} value={s}>
                    {ACCOUNTING_EXPENSE_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!form.concept}
            onClick={async () => {
              const ok = await onSubmit({
                date: form.date,
                responsible: form.responsible,
                costCenter: form.costCenter,
                providerName: form.providerName,
                concept: form.concept,
                detail: form.detail,
                amount: Number(form.amount || 0),
                status: form.status,
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

function PayDialog({
  expense,
  accounts,
  onClose,
  onSubmit,
}: {
  expense: AccountingExpense | null;
  accounts: ReturnType<typeof useAccountingStore.getState>["accounts"];
  onClose: () => void;
  onSubmit: (id: string, accountId: string) => Promise<void>;
}) {
  const error = useAccountingStore((s) => s.error);
  const [accountId, setAccountId] = useState(NO_ACCOUNT);

  return (
    <Dialog
      open={!!expense}
      onOpenChange={(open) => {
        if (!open) {
          setAccountId(NO_ACCOUNT);
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            {expense
              ? `${expense.concept} — ${formatCurrency(expense.amount)}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Cuenta de donde sale el dinero</Label>
          <AccountSelect
            accounts={accounts}
            value={accountId}
            onChange={setAccountId}
            allowEmpty={false}
          />
          {accounts.length === 0 ? (
            <p className="text-sm text-destructive">
              Primero debes crear una cuenta en la pestaña Cuentas.
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!expense || accountValue(accountId) === null}
            onClick={() =>
              expense && onSubmit(expense.id, accountValue(accountId) as string)
            }
          >
            Confirmar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
