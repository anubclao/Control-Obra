"use client";

/** Pestaña Ingresos: registro y cobro de facturas (AC-3 a AC-5). */

import { useMemo, useState } from "react";
import { Plus, Receipt, Search, Trash2, Wallet } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAccountingStore } from "@/lib/accounting-store";
import { incomeNetAmount, incomeReceivedAmount } from "@/lib/accounting";
import { ACCOUNTING_INCOME_STATUS_LABELS } from "@/lib/accounting-constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AccountingIncome, AccountingIncomeStatus } from "@/types";
import {
  AccountSelect,
  EmptyState,
  IncomeStatusBadge,
  NO_ACCOUNT,
  accountValue,
} from "./accounting-shared";

const today = () => new Date().toISOString().slice(0, 10);

interface Props {
  projectIdForNew: string | null;
  costCenterOptions: string[];
  defaultCreator: string;
}

export function AccountingIncomes({
  projectIdForNew,
  costCenterOptions,
  defaultCreator,
}: Props) {
  const { incomes, accounts, addIncome, updateIncome, deleteIncome } =
    useAccountingStore();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AccountingIncomeStatus>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [collecting, setCollecting] = useState<AccountingIncome | null>(null);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return incomes.filter((i) => {
      const matchSearch =
        !term ||
        i.clientName.toLowerCase().includes(term) ||
        i.invoice.toLowerCase().includes(term) ||
        i.costCenter.toLowerCase().includes(term);
      return matchSearch && (statusFilter === "ALL" || i.status === statusFilter);
    });
  }, [incomes, search, statusFilter]);

  function handleDelete(income: AccountingIncome) {
    confirm.open({
      title: "Eliminar ingreso",
      description: `¿Eliminar la factura ${income.invoice || "sin número"}?`,
      variant: "danger",
      onConfirm: async () => {
        await deleteIncome(income.id);
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, factura o centro de costo…"
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
            {Object.entries(ACCOUNTING_INCOME_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo ingreso
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No hay ingresos"
          description="Registra la primera factura para este alcance."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">Cliente / Factura</th>
                <th className="p-3">Centro de costo</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3 text-right">Impuestos</th>
                <th className="p-3 text-right">Valor final</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="p-3 whitespace-nowrap">{formatDate(i.date)}</td>
                  <td className="p-3">
                    <div className="font-medium">{i.clientName || "—"}</div>
                    <div className="text-xs text-muted-foreground">{i.invoice}</div>
                  </td>
                  <td className="p-3">{i.costCenter || "—"}</td>
                  <td className="p-3 text-right">{formatCurrency(i.amount)}</td>
                  <td className="p-3 text-right">{formatCurrency(i.taxes)}</td>
                  <td className="p-3 text-right font-medium">
                    {formatCurrency(incomeNetAmount(i))}
                    {i.status === "PAGADO" ? (
                      <div className="text-xs text-muted-foreground">
                        Recibido {formatCurrency(incomeReceivedAmount(i))}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3">
                    <IncomeStatusBadge status={i.status} />
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      {i.status === "POR_PAGAR" ? (
                        <>
                          <Button size="sm" onClick={() => setCollecting(i)}>
                            <Wallet className="mr-1 h-3.5 w-3.5" /> Registrar cobro
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(i)}
                            aria-label="Eliminar ingreso"
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

      <IncomeFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        costCenterOptions={costCenterOptions}
        defaultCreator={defaultCreator}
        onSubmit={async (values) => {
          const ok = await addIncome({ ...values, projectId: projectIdForNew });
          if (ok) setCreateOpen(false);
          return ok;
        }}
      />

      <CollectDialog
        income={collecting}
        accounts={accounts}
        onClose={() => setCollecting(null)}
        onSubmit={async (id, accountId, paidAmount) => {
          const ok = await updateIncome(id, {
            status: "PAGADO",
            accountId,
            paidAmount,
          });
          if (ok) setCollecting(null);
          return ok;
        }}
      />

      {confirm.dialog}
    </div>
  );
}

function IncomeFormDialog({
  open,
  onOpenChange,
  costCenterOptions,
  defaultCreator,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCenterOptions: string[];
  defaultCreator: string;
  onSubmit: (values: Partial<AccountingIncome>) => Promise<boolean>;
}) {
  const error = useAccountingStore((s) => s.error);
  const [form, setForm] = useState({
    date: today(),
    creator: defaultCreator,
    costCenter: "",
    clientName: "",
    invoice: "",
    amount: "",
    taxes: "",
  });

  const net = Math.max(0, Number(form.amount || 0) - Number(form.taxes || 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo ingreso</DialogTitle>
          <DialogDescription>
            Se crea como &quot;Por cobrar&quot;; el cobro se registra aparte.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="inc-date">Fecha</Label>
            <Input
              id="inc-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="inc-creator">Creador</Label>
            <Input
              id="inc-creator"
              value={form.creator}
              onChange={(e) => setForm({ ...form, creator: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="inc-cc">Centro de costo</Label>
            <Input
              id="inc-cc"
              list="accounting-cost-centers"
              value={form.costCenter}
              onChange={(e) => setForm({ ...form, costCenter: e.target.value })}
            />
            <datalist id="accounting-cost-centers">
              {costCenterOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label htmlFor="inc-client">Cliente</Label>
            <Input
              id="inc-client"
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="inc-invoice">Factura</Label>
            <Input
              id="inc-invoice"
              value={form.invoice}
              onChange={(e) => setForm({ ...form, invoice: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="inc-amount">Valor</Label>
            <Input
              id="inc-amount"
              type="number"
              min={0}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="inc-taxes">Impuestos / retenciones</Label>
            <Input
              id="inc-taxes"
              type="number"
              min={0}
              value={form.taxes}
              onChange={(e) => setForm({ ...form, taxes: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Valor final</Label>
            <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium">
              {formatCurrency(net)}
            </div>
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              const ok = await onSubmit({
                date: form.date,
                creator: form.creator,
                costCenter: form.costCenter,
                clientName: form.clientName,
                invoice: form.invoice,
                amount: Number(form.amount || 0),
                taxes: Number(form.taxes || 0),
                status: "POR_PAGAR",
              });
              if (ok) {
                setForm({
                  date: today(),
                  creator: defaultCreator,
                  costCenter: "",
                  clientName: "",
                  invoice: "",
                  amount: "",
                  taxes: "",
                });
              }
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CollectDialog({
  income,
  accounts,
  onClose,
  onSubmit,
}: {
  income: AccountingIncome | null;
  accounts: ReturnType<typeof useAccountingStore.getState>["accounts"];
  onClose: () => void;
  onSubmit: (id: string, accountId: string, paidAmount: number) => Promise<boolean>;
}) {
  const error = useAccountingStore((s) => s.error);
  const [accountId, setAccountId] = useState(NO_ACCOUNT);
  const [amount, setAmount] = useState("");

  const net = income ? incomeNetAmount(income) : 0;

  return (
    <Dialog
      open={!!income}
      onOpenChange={(open) => {
        if (!open) {
          setAccountId(NO_ACCOUNT);
          setAmount("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar cobro</DialogTitle>
          <DialogDescription>
            Valor final de la factura: {formatCurrency(net)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Cuenta donde entra el dinero</Label>
            <AccountSelect
              accounts={accounts}
              value={accountId}
              onChange={setAccountId}
              allowEmpty={false}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="collect-amount">Valor recibido</Label>
            <Input
              id="collect-amount"
              type="number"
              min={0}
              placeholder={String(net)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
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
            disabled={!income || accountValue(accountId) === null}
            onClick={async () => {
              if (!income) return;
              await onSubmit(
                income.id,
                accountValue(accountId) as string,
                Number(amount || net),
              );
            }}
          >
            Confirmar cobro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
