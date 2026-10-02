"use client";

/**
 * Piezas compartidas por las pestañas del módulo de Contabilidad:
 * KPI, estado vacío, badges de estado y selector de cuenta.
 */

import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACCOUNTING_EXPENSE_STATUS_LABELS,
  ACCOUNTING_EXPENSE_STATUS_VARIANTS,
  ACCOUNTING_INCOME_STATUS_LABELS,
  ACCOUNTING_INCOME_STATUS_VARIANTS,
  ACCOUNTING_TAX_STATUS_LABELS,
  ACCOUNTING_TAX_STATUS_VARIANTS,
} from "@/lib/accounting-constants";
import { cn } from "@/lib/utils";
import type {
  AccountingAccount,
  AccountingExpenseStatus,
  AccountingIncomeStatus,
  AccountingTaxStatus,
} from "@/types";

export const NO_ACCOUNT = "__none__";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  color = "text-foreground",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className={cn("mt-1 truncate text-2xl font-semibold", color)}>
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <Icon className={cn("h-5 w-5 shrink-0", color)} />
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed p-12 text-center">
      <Icon className="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <Button onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function IncomeStatusBadge({
  status,
}: {
  status: AccountingIncomeStatus;
}) {
  return (
    <Badge variant={ACCOUNTING_INCOME_STATUS_VARIANTS[status]}>
      {ACCOUNTING_INCOME_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ExpenseStatusBadge({
  status,
}: {
  status: AccountingExpenseStatus;
}) {
  return (
    <Badge variant={ACCOUNTING_EXPENSE_STATUS_VARIANTS[status]}>
      {ACCOUNTING_EXPENSE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function TaxStatusBadge({ status }: { status: AccountingTaxStatus }) {
  return (
    <Badge variant={ACCOUNTING_TAX_STATUS_VARIANTS[status]}>
      {ACCOUNTING_TAX_STATUS_LABELS[status]}
    </Badge>
  );
}

export function AccountSelect({
  accounts,
  value,
  onChange,
  placeholder = "Cuenta de pago",
  allowEmpty = true,
}: {
  accounts: AccountingAccount[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  return (
    <Select value={value || NO_ACCOUNT} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty ? (
          <SelectItem value={NO_ACCOUNT}>Sin cuenta</SelectItem>
        ) : null}
        {accounts
          .filter((a) => a.isActive)
          .map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

/** Convierte el valor del Select al valor que espera la API. */
export function accountValue(value: string): string | null {
  return !value || value === NO_ACCOUNT ? null : value;
}
