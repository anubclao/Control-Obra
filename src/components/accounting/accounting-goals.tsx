"use client";

/** Pestaña Metas: objetivo mensual por alcance y avance del mes en curso (AC-18). */

import { useState } from "react";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccountingStore, goalForScope } from "@/lib/accounting-store";
import { goalProgress } from "@/lib/accounting";
import { ACCOUNTING_GENERAL_SCOPE } from "@/lib/accounting-constants";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "./accounting-shared";

export function AccountingGoals() {
  const { scope, goals, incomes, expenses, saveGoal, error } = useAccountingStore();
  const goal = goalForScope(goals, scope);
  const [form, setForm] = useState<{ income: string; expense: string; savings: string } | null>(
    null,
  );

  if (scope === "ALL") {
    return (
      <EmptyState
        icon={Target}
        title="Elige un alcance"
        description="Las metas se definen por proyecto o para el alcance General, no sobre el consolidado."
      />
    );
  }

  const progress = goalProgress(goal, { incomes, expenses });
  const values = form ?? {
    income: String(goal?.monthlyIncome ?? 0),
    expense: String(goal?.maxExpense ?? 0),
    savings: String(goal?.monthlySavings ?? 0),
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <ProgressCard
          label="Ingreso del mes"
          current={progress.incomeTotal}
          target={goal?.monthlyIncome ?? 0}
          percent={progress.incomePercent}
        />
        <ProgressCard
          label="Gasto del mes"
          current={progress.expenseTotal}
          target={goal?.maxExpense ?? 0}
          percent={progress.expensePercent}
          danger={progress.expenseExceeded}
        />
        <ProgressCard
          label="Ahorro del mes"
          current={progress.savings}
          target={goal?.monthlySavings ?? 0}
          percent={progress.savingsPercent}
          danger={progress.savings < 0}
        />
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-medium">
            Metas para{" "}
            {scope === ACCOUNTING_GENERAL_SCOPE ? "el alcance General" : "este proyecto"}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="goal-income">Ingreso mensual objetivo</Label>
              <Input
                id="goal-income"
                type="number"
                min={0}
                value={values.income}
                onChange={(e) => setForm({ ...values, income: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="goal-expense">Tope de gasto mensual</Label>
              <Input
                id="goal-expense"
                type="number"
                min={0}
                value={values.expense}
                onChange={(e) => setForm({ ...values, expense: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="goal-savings">Ahorro mensual objetivo</Label>
              <Input
                id="goal-savings"
                type="number"
                min={0}
                value={values.savings}
                onChange={(e) => setForm({ ...values, savings: e.target.value })}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            onClick={async () => {
              const ok = await saveGoal({
                projectId: scope === ACCOUNTING_GENERAL_SCOPE ? null : scope,
                monthlyIncome: Number(values.income || 0),
                maxExpense: Number(values.expense || 0),
                monthlySavings: Number(values.savings || 0),
              });
              if (ok) setForm(null);
            }}
          >
            Guardar metas
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ProgressCard({
  label,
  current,
  target,
  percent,
  danger,
}: {
  label: string;
  current: number;
  target: number;
  percent: number;
  danger?: boolean;
}) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={danger ? "text-xl font-semibold text-destructive" : "text-xl font-semibold"}>
          {formatCurrency(current)}
        </p>
        <p className="text-xs text-muted-foreground">
          Meta {formatCurrency(target)} · {percent.toFixed(0)}%
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={danger ? "h-full bg-destructive" : "h-full bg-primary"}
            style={{ width: `${width}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
