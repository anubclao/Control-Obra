"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Client, ClientStatus } from "@/types";
import { MOCK_CLIENTS } from "@/mocks";

interface ClientsStore {
  clients: Client[];
  addClient: (data: Omit<Client, "id" | "clientNumber">) => Client;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  getClient: (id: string) => Client | undefined;
  setStatus: (id: string, status: ClientStatus) => void;
}

function nextId(): string {
  return `cl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function nextClientNumber(clients: Client[]): string {
  const max = clients.reduce((m, c) => {
    const n = parseInt(c.clientNumber.replace("CLI-", ""), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `CLI-${String(max + 1).padStart(4, "0")}`;
}

export const useClientsStore = create<ClientsStore>()(
  persist(
    (set, get) => ({
      clients: MOCK_CLIENTS,
      addClient: (data) => {
        const client: Client = {
          ...data,
          id: nextId(),
          clientNumber: nextClientNumber(get().clients),
        };
        set({ clients: [client, ...get().clients] });
        return client;
      },
      updateClient: (id, updates) => {
        set({ clients: get().clients.map((c) => (c.id === id ? { ...c, ...updates } : c)) });
      },
      deleteClient: (id) => {
        set({ clients: get().clients.filter((c) => c.id !== id) });
      },
      getClient: (id) => get().clients.find((c) => c.id === id),
      setStatus: (id, status) => {
        set({ clients: get().clients.map((c) => (c.id === id ? { ...c, status } : c)) });
      },
    }),
    { name: "controlobra-clients" }
  )
);

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  PROSPECT: "Prospecto",
  CONTACTED: "Contactado",
  QUALIFIED: "Calificado",
  PROPOSAL: "Propuesta",
  NEGOTIATION: "Negociación",
  WON: "Ganado",
  LOST: "Perdido",
};

export const CLIENT_STATUS_VARIANTS: Record<ClientStatus, "default" | "info" | "warning" | "success" | "destructive"> = {
  PROSPECT: "default",
  CONTACTED: "info",
  QUALIFIED: "info",
  PROPOSAL: "warning",
  NEGOTIATION: "warning",
  WON: "success",
  LOST: "destructive",
};

export const CLIENT_SOURCE_LABELS: Record<string, string> = {
  REFERIDO: "Referido",
  WEB: "Web",
  REDES_SOCIALES: "Redes sociales",
  FERIA: "Feria",
  LLAMADA_FRIA: "Llamada en frío",
  OTROS: "Otros",
};
