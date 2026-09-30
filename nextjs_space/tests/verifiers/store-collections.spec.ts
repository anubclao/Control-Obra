/**
 * tests/verifiers/store-collections.spec.ts
 *
 * Verifier de docs/specs/bug-presupuestos-persistencia.md AC-8 y AC-9:
 * claves de colección del data-store y acciones de useAiuStore.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: apiMock }));

import { useDataStore, useAiuStore } from "@/lib/data-store";

const AIU = { id: "a1", projectId: "p1", administration: 8, imprevistos: 5, utilidad: 5, updatedAt: "2026-09-30" };

beforeEach(() => {
  Object.values(apiMock).forEach((m) => m.mockReset());
  useDataStore.setState((s: any) => ({
    aius: { ...s.aius, items: [], loaded: false, loading: false, error: null },
    workLogs: { ...s.workLogs, items: [], loaded: false, loading: false, error: null },
  }));
});

describe("AC-8 · cada colección carga en su propia clave", () => {
  it("aius.load() llena aius.items (endpoint /api/aiu-configs)", async () => {
    apiMock.get.mockResolvedValue([AIU]);
    await (useDataStore.getState() as any).aius.load();
    expect(apiMock.get).toHaveBeenCalledWith("/api/aiu-configs");
    expect((useDataStore.getState() as any).aius.items).toEqual([AIU]);
    expect((useDataStore.getState() as any)["aiu-configs"]).toBeUndefined();
  });

  it("workLogs.load() llena workLogs.items (endpoint /api/work-logs)", async () => {
    apiMock.get.mockResolvedValue([{ id: "w1" }]);
    await (useDataStore.getState() as any).workLogs.load();
    expect((useDataStore.getState() as any).workLogs.items).toEqual([{ id: "w1" }]);
    expect((useDataStore.getState() as any)["work-logs"]).toBeUndefined();
  });
});

describe("AC-9 · useAiuStore expone getConfig / hasConfig / upsertConfig", () => {
  beforeEach(() => {
    useDataStore.setState((s: any) => ({ aius: { ...s.aius, items: [AIU], loaded: true } }));
  });

  it("getConfig y hasConfig por proyecto", () => {
    const { result } = renderHook(() => useAiuStore());
    expect(result.current.getConfig("p1")).toEqual(AIU);
    expect(result.current.hasConfig("p1")).toBe(true);
    expect(result.current.hasConfig("p2")).toBe(false);
    expect(result.current.getConfig("p2")).toBeUndefined();
  });

  it("upsertConfig actualiza si el proyecto ya tiene AIU", async () => {
    apiMock.put.mockResolvedValue({ ok: true });
    apiMock.get.mockResolvedValue([AIU]);
    const { result } = renderHook(() => useAiuStore());
    let r: any;
    await act(async () => {
      r = await result.current.upsertConfig({ projectId: "p1", administration: 10, imprevistos: 5, utilidad: 5 });
    });
    expect(r).toEqual({ ok: true });
    expect(apiMock.put).toHaveBeenCalledWith("/api/aiu-configs", expect.objectContaining({ id: "a1", administration: 10 }));
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it("upsertConfig crea si el proyecto no tiene AIU", async () => {
    apiMock.post.mockResolvedValue({ id: "a2" });
    apiMock.get.mockResolvedValue([AIU]);
    const { result } = renderHook(() => useAiuStore());
    let r: any;
    await act(async () => {
      r = await result.current.upsertConfig({ projectId: "p2", administration: 8, imprevistos: 5, utilidad: 5 });
    });
    expect(r.ok).toBe(true);
    expect(apiMock.post).toHaveBeenCalledWith("/api/aiu-configs", expect.objectContaining({ projectId: "p2" }));
  });

  it("upsertConfig devuelve el error de la API", async () => {
    apiMock.put.mockRejectedValue(new Error("Utilidad debe estar entre 0% y 100%"));
    const { result } = renderHook(() => useAiuStore());
    let r: any;
    await act(async () => {
      r = await result.current.upsertConfig({ projectId: "p1", administration: 8, imprevistos: 5, utilidad: 500 });
    });
    expect(r).toEqual({ ok: false, error: "Utilidad debe estar entre 0% y 100%" });
  });
});
