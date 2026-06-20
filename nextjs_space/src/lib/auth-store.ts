"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Area } from "@/types";
import { MOCK_USERS } from "./auth-mock";

interface AuthStore {
  user: User | null;
  hydrated: boolean;
  setHydrated: () => void;
  setUser: (user: User | null) => void;
  switchUser: (email: string) => boolean;
  switchArea: (area: Area) => boolean;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      setUser: (user) => set({ user }),
      switchUser: (email) => {
        const found = MOCK_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!found) return false;
        set({ user: found });
        return true;
      },
      switchArea: (area) => {
        const emailByArea: Record<Area, string> = {
          tecnico: "director@controlobra.com",
          administrativo: "gerente@controlobra.com",
          ventas: "ventas@controlobra.com",
        };
        const found = MOCK_USERS.find((u) => u.email === emailByArea[area]);
        if (!found) return false;
        set({ user: found });
        return true;
      },
      logout: () => set({ user: null }),
    }),
    {
      name: "controlobra-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
