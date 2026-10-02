// @vitest-environment node
/**
 * tests/verifiers/store-paginated.spec.ts
 *
 * Verifier de Fase 3, P1 (seccion 4.2/4.3): los GET de `/api/cuts`
 * y `/api/quotations` ahora devuelven `{data, pagination}`. El
 * store de Zustand tiene que normalizar la respuesta para que
 * `items` siga siendo un array y `pagination` se exponga por
 * separado.
 *
 * Aqui validamos:
 *   - load() normaliza cuando llega {data, pagination}
 *   - load() normaliza cuando llega un array (otros endpoints)
 *   - loadPage(page, limit) hace fetch con query params correctos
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ api: apiMock }));

import { useDataStore } from "@/lib/data-store";

beforeEach(() => {
  Object.values(apiMock).forEach((m) => m.mockReset());
  // Importante: solo reseteamos las flags (items/loading/error/pagination).
  // Los metodos (load, add, performAction, loadPage) viven en el closure
  // del store y NO deben reasignarse a {}, porque perderiamos
  // loadPage() y performAction() entre tests.
  useDataStore.setState((s: any) => ({
    cuts: {
      ...s.cuts,
      items: [],
      loaded: false,
      loading: false,
      error: null,
      pagination: null,
    },
    quotations: {
      ...s.quotations,
      items: [],
      loaded: false,
      loading: false,
      error: null,
      pagination: null,
    },
    projects: {
      ...s.projects,
      items: [],
      loaded: false,
      loading: false,
      error: null,
      pagination: null,
    },
  }));
});

describe("cuts store: respuesta paginada {data, pagination}", () => {
  it("load() guarda data en items y pagination aparte", async () => {
    apiMock.get.mockResolvedValue({
      data: [{ id: "c1" }, { id: "c2" }],
      pagination: { total: 100, page: 1, limit: 50, totalPages: 2 },
    });
    await act(async () => {
      await (useDataStore.getState() as any).cuts.load();
    });
    const state = (useDataStore.getState() as any).cuts;
    expect(state.items).toEqual([{ id: "c1" }, { id: "c2" }]);
    expect(state.pagination).toEqual({
      total: 100,
      page: 1,
      limit: 50,
      totalPages: 2,
    });
  });

  it("loadPage(page, limit) hace GET con los query params correctos", async () => {
    apiMock.get.mockResolvedValue({
      data: [{ id: "c3" }],
      pagination: { total: 100, page: 2, limit: 25, totalPages: 4 },
    });
    let result: any;
    await act(async () => {
      result = await (useDataStore.getState() as any).cuts.loadPage(2, 25);
    });
    expect(apiMock.get).toHaveBeenCalledWith("/api/cuts?page=2&limit=25");
    expect(result.ok).toBe(true);
    const state = (useDataStore.getState() as any).cuts;
    expect(state.items).toEqual([{ id: "c3" }]);
    expect(state.pagination.page).toBe(2);
  });

  it("loadPage() devuelve ok=false y deja el error si la API falla", async () => {
    apiMock.get.mockRejectedValue(new Error("Network error"));
    let result: any;
    await act(async () => {
      result = await (useDataStore.getState() as any).cuts.loadPage(1, 50);
    });
    expect(result.ok).toBe(false);
    expect((useDataStore.getState() as any).cuts.error).toBe("Network error");
  });
});

describe("quotations store: respuesta paginada {data, pagination}", () => {
  it("load() normaliza respuesta paginada", async () => {
    apiMock.get.mockResolvedValue({
      data: [{ id: "q1" }],
      pagination: { total: 10, page: 1, limit: 50, totalPages: 1 },
    });
    await act(async () => {
      await (useDataStore.getState() as any).quotations.load();
    });
    const state = (useDataStore.getState() as any).quotations;
    expect(state.items).toEqual([{ id: "q1" }]);
    expect(state.pagination.total).toBe(10);
  });

  it("loadPage acepta parametros y expone el resultado paginado", async () => {
    apiMock.get.mockResolvedValue({
      data: [{ id: "q99" }],
      pagination: { total: 200, page: 3, limit: 50, totalPages: 4 },
    });
    await act(async () => {
      await (useDataStore.getState() as any).quotations.loadPage(3, 50);
    });
    expect(apiMock.get).toHaveBeenCalledWith("/api/quotations?page=3&limit=50");
    const state = (useDataStore.getState() as any).quotations;
    expect(state.pagination.page).toBe(3);
  });
});

describe("projects store: respuesta no paginada (array)", () => {
  it("load() guarda el array completo en items y deja pagination en null", async () => {
    apiMock.get.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    await act(async () => {
      await (useDataStore.getState() as any).projects.load();
    });
    const state = (useDataStore.getState() as any).projects;
    expect(state.items).toEqual([{ id: "p1" }, { id: "p2" }]);
    expect(state.pagination).toBeNull();
  });
});
