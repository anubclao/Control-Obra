"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AiuConfig } from "@/types";
import { MOCK_AIU } from "@/mocks";

interface AiuStore {
  configs: AiuConfig[];
  getConfig: (projectId: string) => AiuConfig | undefined;
  hasConfig: (projectId: string) => boolean;
  upsertConfig: (data: Omit<AiuConfig, "id" | "updatedAt"> & { id?: string }) => AiuConfig;
}

function nextId(): string {
  return `aiu${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export const useAiuStore = create<AiuStore>()(
  persist(
    (set, get) => ({
      configs: MOCK_AIU,

      getConfig: (projectId) => get().configs.find((c) => c.projectId === projectId),

      hasConfig: (projectId) => !!get().configs.find((c) => c.projectId === projectId),

      upsertConfig: (data) => {
        const existing = get().configs.find((c) => c.projectId === data.projectId);
        if (existing) {
          const updated: AiuConfig = {
            ...existing,
            ...data,
            id: existing.id,
            updatedAt: new Date().toISOString().slice(0, 10),
          };
          set({
            configs: get().configs.map((c) => (c.id === existing.id ? updated : c)),
          });
          return updated;
        }
        const newCfg: AiuConfig = {
          ...data,
          id: nextId(),
          updatedAt: new Date().toISOString().slice(0, 10),
        };
        set({ configs: [...get().configs, newCfg] });
        return newCfg;
      },
    }),
    { name: "controlobra-aiu" }
  )
);

// Validador: suma debe sumar 100% (con tolerancia)
export function validateAiu(admin: number, imprev: number, util: number): {
  ok: boolean;
  total: number;
  message?: string;
} {
  const total = admin + imprev + util;
  if (Math.abs(total - 100) > 0.01) {
    return { ok: false, total, message: `La suma debe ser exactamente 100% (actual: ${total.toFixed(2)}%)` };
  }
  return { ok: true, total };
}
