// VERIFIER: Dashboard Stats (Single Source of Truth)
// SPEC: /docs/specs/dashboard-stats-from-stores.md
//
// Los stores por módulo de localStorage ya no existen. La fuente única de
// verdad pasó a ser la BD: /api/dashboard/stats agrega con
// `computeDashboardStats` y el cliente consume el endpoint con
// `useDashboardStats`. Este verifier cubre ambas capas.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  computeDashboardStats,
  EMPTY_DASHBOARD_STATS,
  useDashboardStats,
  type DashboardStats,
} from "@/lib/dashboard-stats";
import { api } from "@/lib/api";

// ──────────────────────────────────────────────────────────────
// AC-1 · KPIs del dashboard técnico
// ──────────────────────────────────────────────────────────────
describe("AC-1 · KPIs técnicos", () => {
  it("cuenta proyectos activos solo con status IN_EXECUTION", () => {
    const stats = computeDashboardStats({
      projects: [
        { status: "IN_EXECUTION", total_budget: 100, executed_amount: 25 },
        { status: "IN_EXECUTION", total_budget: 300, executed_amount: 75 },
        { status: "IN_PLANNING", total_budget: 100, executed_amount: 0 },
        { status: "COMPLETED", total_budget: 500, executed_amount: 500 },
        { status: "PAUSED", total_budget: 0, executed_amount: 0 },
      ],
    });
    expect(stats.activeProjects).toBe(2);
    expect(stats.totalProjects).toBe(5);
  });

  it("suma presupuesto y ejecutado de TODOS los proyectos", () => {
    const stats = computeDashboardStats({
      projects: [
        { status: "IN_EXECUTION", total_budget: 1000, executed_amount: 250 },
        { status: "COMPLETED", total_budget: 3000, executed_amount: 3000 },
      ],
    });
    expect(stats.totalBudget).toBe(4000);
    expect(stats.totalExecuted).toBe(3250);
    expect(stats.executionPercent).toBeCloseTo(81.25);
  });

  it("cuenta cortes pendientes en SUBMITTED o VALIDATED", () => {
    const stats = computeDashboardStats({
      cuts: [
        { status: "DRAFT" },
        { status: "SUBMITTED" },
        { status: "VALIDATED" },
        { status: "APPROVED" },
        { status: "PAID" },
        { status: "REJECTED" },
      ],
    });
    expect(stats.pendingCuts).toBe(2);
  });
});

// ──────────────────────────────────────────────────────────────
// AC-2 · KPIs del dashboard administrativo
// ──────────────────────────────────────────────────────────────
describe("AC-2 · KPIs administrativos", () => {
  it("'Por pagar' suma PENDING, APPROVED_LEVEL_1 y APPROVED_LEVEL_2", () => {
    const stats = computeDashboardStats({
      payments: [
        { status: "PENDING", amount: 100 },
        { status: "APPROVED_LEVEL_1", amount: 200 },
        { status: "APPROVED_LEVEL_2", amount: 300 },
        { status: "APPROVED", amount: 999 },
        { status: "PAID", amount: 999 },
        { status: "REJECTED", amount: 999 },
        { status: "CANCELLED", amount: 999 },
      ],
    });
    expect(stats.pendingPayments).toBe(3);
    expect(stats.pendingAmount).toBe(600);
  });

  it("una solicitud aprobada deja de contar como pendiente", () => {
    const antes = computeDashboardStats({
      payments: [{ status: "APPROVED_LEVEL_2", amount: 500 }],
    });
    const despues = computeDashboardStats({
      payments: [{ status: "APPROVED", amount: 500 }],
    });
    expect(antes.pendingPayments).toBe(1);
    expect(antes.pendingAmount).toBe(500);
    expect(despues.pendingPayments).toBe(0);
    expect(despues.pendingAmount).toBe(0);
  });

  it("cuenta empleados activos desde filas agrupadas por status", () => {
    const stats = computeDashboardStats({
      employees: [
        { status: "ACTIVE", n: 12 },
        { status: "INACTIVE", n: 4 },
      ],
    });
    expect(stats.activeEmployees).toBe(12);
  });
});

// ──────────────────────────────────────────────────────────────
// AC-3 · KPIs del dashboard de ventas
// ──────────────────────────────────────────────────────────────
describe("AC-3 · KPIs de ventas", () => {
  it("'Clientes ganados' cuenta solo status WON", () => {
    const stats = computeDashboardStats({
      clients: [
        { status: "WON" },
        { status: "WON" },
        { status: "LEAD" },
        { status: "LOST" },
      ],
    });
    expect(stats.activeClients).toBe(2);
    expect(stats.totalClients).toBe(4);
  });

  it("'Cotizaciones abiertas' y pipeline usan DRAFT, SENT y VIEWED", () => {
    const stats = computeDashboardStats({
      quotations: [
        { status: "DRAFT", total: 1000 },
        { status: "SENT", total: 2000 },
        { status: "VIEWED", total: 3000 },
        { status: "APPROVED", total: 9999 },
        { status: "REJECTED", total: 9999 },
      ],
    });
    expect(stats.openQuotations).toBe(3);
    expect(stats.totalOpenValue).toBe(6000);
  });
});

// ──────────────────────────────────────────────────────────────
// Edge cases · vacíos y datos sucios
// ──────────────────────────────────────────────────────────────
describe("Edge cases de la agregación", () => {
  it("sin datos devuelve todos los KPIs en cero, no NaN", () => {
    expect(computeDashboardStats()).toEqual(EMPTY_DASHBOARD_STATS);
    expect(computeDashboardStats({})).toEqual(EMPTY_DASHBOARD_STATS);
  });

  it("presupuesto 0 no produce división por cero", () => {
    const stats = computeDashboardStats({
      projects: [{ status: "IN_EXECUTION", total_budget: 0, executed_amount: 0 }],
    });
    expect(stats.executionPercent).toBe(0);
  });

  it("nulos y strings no numéricos se tratan como 0", () => {
    const stats = computeDashboardStats({
      projects: [
        { status: "IN_EXECUTION", total_budget: null, executed_amount: undefined },
        { status: "IN_EXECUTION", total_budget: "abc", executed_amount: "500" },
      ],
      payments: [{ status: "PENDING", amount: null }],
    });
    expect(stats.totalBudget).toBe(0);
    expect(stats.totalExecuted).toBe(500);
    expect(stats.pendingAmount).toBe(0);
    expect(Number.isNaN(stats.executionPercent)).toBe(false);
  });

  it("filas sin status no cuentan en ningún KPI filtrado", () => {
    const stats = computeDashboardStats({
      projects: [{ total_budget: 10, executed_amount: 1 }],
      payments: [{ amount: 50 }],
      clients: [{}],
      quotations: [{ total: 70 }],
    });
    expect(stats.activeProjects).toBe(0);
    expect(stats.pendingPayments).toBe(0);
    expect(stats.activeClients).toBe(0);
    expect(stats.openQuotations).toBe(0);
    expect(stats.totalOpenValue).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────
// AC-4 · El hook es reutilizable y testeable
// ──────────────────────────────────────────────────────────────
describe("AC-4 · useDashboardStats", () => {
  const payload: DashboardStats = {
    ...EMPTY_DASHBOARD_STATS,
    activeProjects: 3,
    totalBudget: 5000,
    pendingPayments: 2,
    pendingAmount: 800,
    activeClients: 4,
    openQuotations: 6,
    totalOpenValue: 9000,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("arranca en loading con KPIs en cero y luego entrega los del endpoint", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue(payload);

    const { result } = renderHook(() => useDashboardStats());
    expect(result.current.loading).toBe(true);
    expect(result.current.stats).toEqual(EMPTY_DASHBOARD_STATS);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(get).toHaveBeenCalledWith("/api/dashboard/stats");
    expect(result.current.stats).toEqual(payload);
    expect(result.current.error).toBeNull();
  });

  it("ante error devuelve KPIs en cero y mensaje, sin lanzar", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(api, "get").mockRejectedValue(new Error("BD caída"));

    const { result } = renderHook(() => useDashboardStats());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.stats).toEqual(EMPTY_DASHBOARD_STATS);
    expect(result.current.error).toBe("BD caída");
  });

  it("reload vuelve a consultar el endpoint", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue(payload);

    const { result } = renderHook(() => useDashboardStats());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(get).toHaveBeenCalledTimes(1);

    act(() => result.current.reload());
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });
});
