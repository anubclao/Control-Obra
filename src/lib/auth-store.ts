/**
 * lib/auth-store.ts
 *
 * Store de autenticación conectado a BD.
 * Sesión persiste en cookie httpOnly (servidor) + cache cliente ligero.
 */

"use client";

import { create } from "zustand";
import { api } from "./api";
import type { User, Area } from "@/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  hydrated: boolean;
  lastStatus: number | null;
  lastDetail: any;
  switchUser: (email: string) => Promise<boolean>;
  switchArea: (area: Area) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, _get) => ({
  user: null,
  loading: false,
  error: null,
  hydrated: false,
  lastStatus: null as number | null,
  lastDetail: null as any,

  refresh: async () => {
    set({ loading: true });
    try {
      const data = await api.get<{ user: User | null }>("/api/auth/login");
      set({ user: data.user, loading: false, hydrated: true, error: null });
    } catch (e: any) {
      console.error("[auth refresh]", e?.message);
      set({ user: null, loading: false, hydrated: true, error: e?.message });
    }
  },

  switchUser: async (email: string) => {
    set({ loading: true, error: null, lastStatus: null, lastDetail: null });
    try {
      const data = await api.post<{ user: User }>("/api/auth/login", { email });
      set({ user: data.user, loading: false });
      return true;
    } catch (e: any) {
      console.error("[auth login] status:", e?.status, "detail:", e?.payload);
      set({
        loading: false,
        error: e?.message ?? "No se pudo iniciar sesión",
        lastStatus: e?.status ?? null,
        lastDetail: e?.payload ?? null,
      });
      return false;
    }
  },

  switchArea: async (area: Area) => {
    const cur = _get().user;
    if (!cur) return false;
    // En un sistema real, esto sería un endpoint dedicado; por ahora
    // cambiamos el área en cliente (el backend lo persistirá al refrescar).
    set({ user: { ...cur, area } });
    return true;
  },

  logout: async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {}
    set({ user: null, error: null });
  },
}));
