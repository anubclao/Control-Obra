"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Invitation, Role, Area } from "@/types";
import { MOCK_INVITATIONS } from "@/mocks";

interface InvitationsStore {
  invitations: Invitation[];
  createInvitation: (data: {
    email: string;
    role: Role;
    area?: Area;
    projectId?: string;
    maxUses?: number;
    expiresInDays?: number;
    createdBy: string;
  }) => Invitation;
  cancelInvitation: (id: string) => void;
  acceptInvitation: (id: string, userId: string) => { ok: boolean; error?: string };
  deleteInvitation: (id: string) => void;
  // Para uso en el login mock
  validateCode: (code: string) => { ok: boolean; invitation?: Invitation; error?: string };
}

function nextId(): string {
  return `inv${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function generateCode(): string {
  // 8 caracteres alfanuméricos
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function isExpired(inv: Invitation): boolean {
  return new Date(inv.expiresAt) < new Date();
}

// Recalcula el estado en cada llamada
function refreshStatus(inv: Invitation): Invitation {
  if (inv.status === "ACCEPTED" || inv.status === "CANCELLED") return inv;
  if (isExpired(inv)) return { ...inv, status: "EXPIRED" };
  if (inv.uses >= inv.maxUses) return { ...inv, status: "EXPIRED" };
  return inv;
}

export const useInvitationsStore = create<InvitationsStore>()(
  persist(
    (set, get) => ({
      invitations: MOCK_INVITATIONS,

      createInvitation: (data) => {
        const inv: Invitation = {
          id: nextId(),
          code: generateCode(),
          email: data.email,
          role: data.role,
          area: data.area,
          projectId: data.projectId,
          status: "PENDING",
          maxUses: data.maxUses ?? 1,
          uses: 0,
          expiresAt: new Date(Date.now() + (data.expiresInDays ?? 30) * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
          createdBy: data.createdBy,
          createdAt: new Date().toISOString().slice(0, 10),
        };
        set({ invitations: [inv, ...get().invitations] });
        return inv;
      },

      cancelInvitation: (id) => {
        set({
          invitations: get().invitations.map((i) =>
            i.id === id ? { ...i, status: "CANCELLED" } : i
          ),
        });
      },

      acceptInvitation: (id, userId) => {
        const inv = get().invitations.find((i) => i.id === id);
        if (!inv) return { ok: false, error: "Invitación no encontrada" };
        const refreshed = refreshStatus(inv);
        if (refreshed.status !== "PENDING") {
          return { ok: false, error: `Invitación ${refreshed.status.toLowerCase()}` };
        }
        set({
          invitations: get().invitations.map((i) =>
            i.id === id
              ? {
                  ...i,
                  uses: i.uses + 1,
                  status: i.maxUses <= i.uses + 1 ? "ACCEPTED" : i.status,
                  acceptedBy: i.maxUses <= i.uses + 1 ? userId : i.acceptedBy,
                  acceptedAt: i.maxUses <= i.uses + 1 ? new Date().toISOString() : i.acceptedAt,
                }
              : i
          ),
        });
        return { ok: true };
      },

      deleteInvitation: (id) => {
        set({ invitations: get().invitations.filter((i) => i.id !== id) });
      },

      validateCode: (code) => {
        const inv = get().invitations.find((i) => i.code.toLowerCase() === code.toLowerCase());
        if (!inv) return { ok: false, error: "Código no encontrado" };
        const refreshed = refreshStatus(inv);
        if (refreshed.status !== "PENDING") {
          return { ok: false, error: `Invitación ${refreshed.status.toLowerCase()}` };
        }
        return { ok: true, invitation: refreshed };
      },
    }),
    { name: "controlobra-invitations" }
  )
);
