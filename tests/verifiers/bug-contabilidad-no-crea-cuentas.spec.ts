/**
 * tests/verifiers/bug-contabilidad-no-crea-cuentas.spec.ts
 * Verifier para docs/specs/bug-contabilidad-no-crea-cuentas.md
 *
 * STATUS: GREEN una vez aplicados los fixes de AC-1 a AC-5.
 *
 * Cubre:
 *  - AC-1: accounting-accounts.tsx usa EmptyState con actionLabel + onAction
 *  - AC-2: accounting-incomes.tsx usa EmptyState con actionLabel + onAction
 *  - AC-3: accounting-expenses.tsx usa EmptyState con actionLabel + onAction
 *  - AC-4: accounting-taxes.tsx usa EmptyState con actionLabel + onAction
 *  - accounting-shared.tsx EmptyState acepta actionLabel + onAction
 *  - accountBalance maneja datasets vacíos
 *  - La store expone `error` cuando la API falla
 *  - La store refresca la lista tras addAccount exitoso
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { api } from "@/lib/api";
import { accountBalance } from "@/lib/accounting";
import type {
  AccountingAccount,
  AccountingIncome,
  AccountingExpense,
  AccountingTaxMovement,
} from "@/types";

const here = dirname(fileURLToPath(import.meta.url));
const SHARED = resolve(here, "../../src/components/accounting/accounting-shared.tsx");
const ACCOUNTS = resolve(here, "../../src/components/accounting/accounting-accounts.tsx");
const INCOMES = resolve(here, "../../src/components/accounting/accounting-incomes.tsx");
const EXPENSES = resolve(here, "../../src/components/accounting/accounting-expenses.tsx");
const TAXES = resolve(here, "../../src/components/accounting/accounting-taxes.tsx");

const emptyAccount: AccountingAccount = {
  id: "acc1",
  name: "Bancolombia",
  type: "CORRIENTE",
  openingBalance: 0,
  notes: "",
  isActive: true,
  createdAt: "2026-01-01",
};

const emptyDataset = {
  incomes: [] as AccountingIncome[],
  expenses: [] as AccountingExpense[],
  taxMovements: [] as AccountingTaxMovement[],
};

describe("Bug contabilidad — EmptyState extendido (AC-1 a AC-4)", () => {
  let sharedSrc = "";
  let accountsSrc = "";
  let incomesSrc = "";
  let expensesSrc = "";
  let taxesSrc = "";

  beforeAll(() => {
    sharedSrc = readFileSync(SHARED, "utf8");
    accountsSrc = readFileSync(ACCOUNTS, "utf8");
    incomesSrc = readFileSync(INCOMES, "utf8");
    expensesSrc = readFileSync(EXPENSES, "utf8");
    taxesSrc = readFileSync(TAXES, "utf8");
  });

  function hasEmptyStateCta(src: string, expectedLabel: string): boolean {
    // Acepta orden de props variable: actionLabel="..." onAction={...}
    const emptyState = src.match(/<EmptyState[\s\S]*?\/>/);
    if (!emptyState) return false;
    const block = emptyState[0];
    return (
      block.includes(`actionLabel="${expectedLabel}"`) &&
      /onAction\s*=\s*\{/.test(block)
    );
  }

  it("AC-0: EmptyState en accounting-shared acepta actionLabel + onAction", () => {
    expect(sharedSrc).toMatch(/actionLabel\?\s*:\s*string/);
    expect(sharedSrc).toMatch(/onAction\?\s*:\s*\(\)\s*=>\s*void/);
  });

  it("AC-1: accounting-accounts usa EmptyState con CTA 'Crear primera cuenta'", () => {
    expect(hasEmptyStateCta(accountsSrc, "Crear primera cuenta")).toBe(true);
  });

  it("AC-2: accounting-incomes usa EmptyState con CTA 'Registrar primer ingreso'", () => {
    expect(hasEmptyStateCta(incomesSrc, "Registrar primer ingreso")).toBe(true);
  });

  it("AC-3: accounting-expenses usa EmptyState con CTA 'Registrar primer gasto'", () => {
    expect(hasEmptyStateCta(expensesSrc, "Registrar primer gasto")).toBe(true);
  });

  it("AC-4: accounting-taxes usa EmptyState con CTA 'Registrar primer movimiento'", () => {
    expect(hasEmptyStateCta(taxesSrc, "Registrar primer movimiento")).toBe(true);
  });
});

describe("Bug contabilidad — accountBalance con cuentas vacías (helper)", () => {
  it("devuelve el saldo inicial cuando no hay movimientos", () => {
    expect(accountBalance(emptyAccount, emptyDataset)).toBe(0);
  });

  it("suma ingresos PAGADOS al saldo", () => {
    const incomes = [
      {
        id: "i1",
        date: "2026-01-15",
        projectId: null,
        costCenter: "",
        creator: "",
        clientName: "",
        invoice: "",
        amount: 1_000_000,
        taxes: 0,
        status: "PAGADO" as const,
        accountId: "acc1",
        paidAmount: 1_000_000,
        createdAt: "2026-01-15",
      },
    ];
    const balance = accountBalance(emptyAccount, { ...emptyDataset, incomes });
    expect(balance).toBe(1_000_000);
  });
});

describe("Bug contabilidad — la store maneja errores y refresca (AC-8)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("AC-8: addAccount expone el mensaje de error en `error` cuando la API falla", async () => {
    vi.spyOn(api, "post").mockRejectedValueOnce(
      new Error("El nombre de la cuenta es obligatorio"),
    );
    const { useAccountingStore } = await import("@/lib/accounting-store");
    // Reset state
    useAccountingStore.setState({ error: null });
    const ok = await useAccountingStore.getState().addAccount({ name: "" });
    expect(ok).toBe(false);
    expect(useAccountingStore.getState().error).toMatch(/obligatorio/i);
  });

  it("AC-7: tras addAccount exitoso, la cuenta aparece en el listado", async () => {
    const fakeAccount = { ...emptyAccount, name: "Caja menor" };
    vi.spyOn(api, "post").mockResolvedValueOnce(fakeAccount as any);
    vi.spyOn(api, "get").mockResolvedValueOnce([fakeAccount] as any);
    vi.spyOn(api, "get").mockResolvedValueOnce([] as any);
    vi.spyOn(api, "get").mockResolvedValueOnce([] as any);
    vi.spyOn(api, "get").mockResolvedValueOnce([] as any);
    vi.spyOn(api, "get").mockResolvedValueOnce([] as any);
    const { useAccountingStore } = await import("@/lib/accounting-store");
    useAccountingStore.setState({ accounts: [] });
    const ok = await useAccountingStore
      .getState()
      .addAccount({ name: "Caja menor" });
    expect(ok).toBe(true);
    const accounts = useAccountingStore.getState().accounts;
    expect(accounts.some((a) => a.name === "Caja menor")).toBe(true);
  });
});
