/**
 * lib/store-factory.ts
 *
 * Genera un store Zustand con la misma forma que tenía antes pero hablando
 * con la API REST (NO con localStorage).
 *
 * Estrategia (Karpathy: minimizar cambios en componentes):
 *   - Mantener los nombres de los métodos (addX, updateX, deleteX, getX, etc.)
 *     para no tocar las 30+ páginas.
 *   - Cargar datos desde API al inicializar (`loaded: boolean` indica listo).
 *   - Mutaciones: hacer POST/PUT/DELETE y refrescar la lista.
 *   - Zustand persist desactivado: la fuente de verdad es MySQL.
 *
 * Si el backend no responde, el método lanza un error que el componente
 * atrapa con try/catch y muestra en UI.
 */

import { create } from "zustand";
import { api } from "./api";

export interface CrudState<T> {
  items: T[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  // Acciones básicas
  load: () => Promise<void>;
  clear: () => void;
}

export interface BaseEntity {
  id: string;
}

export function makeCrudStore<T extends BaseEntity>(
  endpoint: string,
  set: any,
  get: any,
) {
  return {
    items: [] as T[],
    loaded: false,
    loading: false,
    error: null as string | null,

    load: async () => {
      if (get().loading) return;
      set({ loading: true, error: null });
      try {
        const items = await api.get<T[]>(endpoint);
        set({ items, loaded: true, loading: false });
      } catch (e: any) {
        console.error(`[${endpoint} load]`, e?.message);
        set({ error: e?.message ?? "Error al cargar", loading: false });
      }
    },

    clear: () => set({ items: [], loaded: false, error: null }),
  };
}

export async function withErrorHandling<T>(fn: () => Promise<T>, setError?: (msg: string) => void): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e: any) {
    console.error("[store action]", e?.message);
    if (setError) setError(e?.message ?? "Error");
    return undefined;
  }
}

/** Recargar lista después de una mutación. */
export async function reloadList<T extends BaseEntity>(
  endpoint: string,
  set: (state: Partial<{ items: T[]; loading: boolean }>) => void,
  current: T[],
) {
  try {
    const items = await api.get<T[]>(endpoint);
    set({ items, loading: false });
  } catch (e: any) {
    console.error(`[${endpoint} reload]`, e?.message);
    // Fallar suave: conservar cache anterior
    set({ loading: false });
  }
}
