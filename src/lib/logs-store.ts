"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WorkLog, WeatherCondition, WorkLogPhoto } from "@/types";
import { MOCK_WORK_LOGS } from "@/mocks";

interface LogsStore {
  logs: WorkLog[];
  addLog: (
    data: Omit<WorkLog, "id" | "photos" | "createdAt">
  ) => { ok: boolean; error?: string; log?: WorkLog };
  updateLog: (id: string, updates: Partial<WorkLog>) => void;
  deleteLog: (id: string) => void;
  getLog: (id: string) => WorkLog | undefined;
  addPhoto: (logId: string, photo: Omit<WorkLogPhoto, "id" | "uploadedAt">) => void;
  removePhoto: (logId: string, photoId: string) => void;
}

function nextId(): string {
  return `wl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export const useLogsStore = create<LogsStore>()(
  persist(
    (set, get) => ({
      logs: MOCK_WORK_LOGS,

      addLog: (data) => {
        // Validar: solo 1 bitácora por proyecto+fecha
        const existing = get().logs.find(
          (l) => l.projectId === data.projectId && l.date === data.date
        );
        if (existing) {
          return {
            ok: false,
            error: `Ya existe una bitácora para el proyecto en la fecha ${data.date}. Edítala o elige otra fecha.`,
          };
        }
        const log: WorkLog = {
          ...data,
          id: nextId(),
          photos: [],
          createdAt: new Date().toISOString(),
        };
        set({ logs: [log, ...get().logs] });
        return { ok: true, log };
      },

      updateLog: (id, updates) => {
        set({
          logs: get().logs.map((l) => (l.id === id ? { ...l, ...updates } : l)),
        });
      },

      deleteLog: (id) => {
        set({ logs: get().logs.filter((l) => l.id !== id) });
      },

      getLog: (id) => get().logs.find((l) => l.id === id),

      addPhoto: (logId, photo) => {
        set({
          logs: get().logs.map((l) =>
            l.id !== logId
              ? l
              : {
                  ...l,
                  photos: [...l.photos, { ...photo, id: nextId(), uploadedAt: new Date().toISOString().slice(0, 10) }],
                }
          ),
        });
      },

      removePhoto: (logId, photoId) => {
        set({
          logs: get().logs.map((l) =>
            l.id !== logId ? l : { ...l, photos: l.photos.filter((p) => p.id !== photoId) }
          ),
        });
      },
    }),
    { name: "controlobra-logs" }
  )
);

export const WEATHER_LABELS: Record<WeatherCondition, string> = {
  SOLEADO: "Soleado",
  NUBLADO: "Nublado",
  LLUVIOSO: "Lluvioso",
  TORMENTA: "Tormenta",
  VIENTO: "Viento",
  NIEBLA: "Niebla",
  OTRO: "Otro",
};

export const WEATHER_ICONS: Record<WeatherCondition, string> = {
  SOLEADO: "☀️",
  NUBLADO: "☁️",
  LLUVIOSO: "🌧️",
  TORMENTA: "⛈️",
  VIENTO: "💨",
  NIEBLA: "🌫️",
  OTRO: "🌡️",
};
