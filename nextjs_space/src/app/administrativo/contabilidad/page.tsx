"use client";

/**
 * /administrativo/contabilidad — Módulo de Contabilidad.
 * Spec: /docs/specs/accounting-module.md
 *
 * Adapta el flujo del tablero visual (Panel / Ingresos / Gastos / Cuentas /
 * Impuestos / Metas) al modelo de ControlObra: el "selector de empresa" del
 * tablero es aquí el **alcance** (consolidado, General o un proyecto).
 */

import { useEffect, useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ModuleExplanationCard } from "@/components/ui/module-explanation-card";
import { AccountingPanel } from "@/components/accounting/accounting-panel";
import { AccountingIncomes } from "@/components/accounting/accounting-incomes";
import { AccountingExpenses } from "@/components/accounting/accounting-expenses";
import { AccountingAccounts } from "@/components/accounting/accounting-accounts";
import { AccountingTaxes } from "@/components/accounting/accounting-taxes";
import { AccountingGoals } from "@/components/accounting/accounting-goals";
import { useAccountingStore } from "@/lib/accounting-store";
import { ACCOUNTING_GENERAL_SCOPE } from "@/lib/accounting-constants";
import { useProjectsStore, useProvidersStore } from "@/lib/data-store";
import { useAuthStore } from "@/lib/auth-store";

export default function ContabilidadPage() {
  const {
    scope,
    setScope,
    load,
    loading,
    error,
    incomes,
    expenses,
  } = useAccountingStore();
  const { projects, load: loadProjects } = useProjectsStore();
  const { providers, load: loadProviders } = useProvidersStore();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState("panel");

  useEffect(() => {
    load();
    loadProjects();
    loadProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const projectNameOf = useMemo(() => {
    const byId = new Map(projects.map((p) => [p.id, p.name]));
    return (projectId: string | null | undefined) =>
      projectId ? (byId.get(projectId) ?? "Proyecto eliminado") : "General";
  }, [projects]);

  const scopeLabel =
    scope === "ALL"
      ? "Consolidado"
      : scope === ACCOUNTING_GENERAL_SCOPE
        ? "General"
        : projectNameOf(scope);

  /** El alcance con el que se crean los registros nuevos. */
  const projectIdForNew =
    scope === "ALL" || scope === ACCOUNTING_GENERAL_SCOPE ? null : scope;

  const costCenterOptions = useMemo(() => {
    const used = new Set<string>();
    for (const i of incomes) if (i.costCenter) used.add(i.costCenter);
    for (const e of expenses) if (e.costCenter) used.add(e.costCenter);
    for (const p of projects) used.add(p.name);
    return Array.from(used).sort();
  }, [incomes, expenses, projects]);

  const providerOptions = useMemo(
    () => providers.map((p: { name: string }) => p.name).sort(),
    [providers],
  );

  return (
    <div className="space-y-6">
      <ModuleExplanationCard
        icon={Calculator}
        variant="guide"
        title="Contabilidad"
        description="Ingresos, gastos, cuentas, impuestos y metas de la empresa y de cada obra."
        steps={[
          {
            title: "Elige el alcance",
            description: "Consolidado, General (empresa) o un proyecto concreto.",
          },
          {
            title: "Registra y mueve el estado",
            description:
              "Un gasto va de Por pagar → Aprobado → Pagado; al pagar se exige la cuenta.",
          },
          {
            title: "Revisa el panel",
            description: "Balance, margen y agrupaciones por cliente, proveedor y centro de costo.",
          },
        ]}
        tips={[
          "El saldo de cada cuenta se calcula con los movimientos pagados: no se edita a mano.",
          "Aquí se registran los impuestos declarados y pagados; las tarifas siguen en Impuestos.",
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Contabilidad</h1>
          <p className="text-sm text-muted-foreground">Alcance: {scopeLabel}</p>
        </div>
        <Select value={scope} onValueChange={(v) => setScope(v)}>
          <SelectTrigger className="w-full sm:w-[280px]">
            <SelectValue placeholder="Alcance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Consolidado (todo)</SelectItem>
            <SelectItem value={ACCOUNTING_GENERAL_SCOPE}>General (empresa)</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="panel">Panel</TabsTrigger>
          <TabsTrigger value="ingresos">Ingresos</TabsTrigger>
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
          <TabsTrigger value="cuentas">Cuentas</TabsTrigger>
          <TabsTrigger value="impuestos">Impuestos</TabsTrigger>
          <TabsTrigger value="metas">Metas</TabsTrigger>
        </TabsList>

        <TabsContent value="panel" className="mt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <AccountingPanel scopeLabel={scopeLabel} projectNameOf={projectNameOf} />
          )}
        </TabsContent>
        <TabsContent value="ingresos" className="mt-4">
          <AccountingIncomes
            projectIdForNew={projectIdForNew}
            costCenterOptions={costCenterOptions}
            defaultCreator={user?.name ?? ""}
          />
        </TabsContent>
        <TabsContent value="gastos" className="mt-4">
          <AccountingExpenses
            projectIdForNew={projectIdForNew}
            costCenterOptions={costCenterOptions}
            providerOptions={providerOptions}
            defaultResponsible={user?.name ?? ""}
          />
        </TabsContent>
        <TabsContent value="cuentas" className="mt-4">
          <AccountingAccounts />
        </TabsContent>
        <TabsContent value="impuestos" className="mt-4">
          <AccountingTaxes projectIdForNew={projectIdForNew} />
        </TabsContent>
        <TabsContent value="metas" className="mt-4">
          <AccountingGoals />
        </TabsContent>
      </Tabs>
    </div>
  );
}
