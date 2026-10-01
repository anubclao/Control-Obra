/**
 * lib/users-store.ts
 *
 * Store Zustand para el módulo de administración de usuarios autorizados.
 * Spec: docs/specs/admin-user-authorization-with-otp.md
 *
 * Conecta con /api/users para CRUD completo.  En paralelo al data-store
 * principal (useDataStore.users) que ya existía para la lista plana de
 * usuarios.  Este nuevo store está especializado para el nuevo ciclo de
 * vida PENDING/ACTIVE/SUSPENDED con auditoría.
 */

"use client";

import { create } from "zustand";
import { api } from "./api";
import type { AuthorizedUser, Role, Area } from "@/types";

export interface CreateAuthorizedUserInput {
  email: string;
  name: string;
  role: Role;
  area: Area;
  projectId?: string;
  createdBy: string;
}

interface UsersState {
  users: AuthorizedUser[];
  loading: boolean;
  loaded: boolean;
  error: string | null;

  load: () => Promise<void>;
  createUser: (input: CreateAuthorizedUserInput) => Promise<AuthorizedUser>;
  authorizeUser: (userId: string, adminId: string) => Promise<AuthorizedUser>;
  suspendUser: (userId: string, adminId: string) => Promise<AuthorizedUser>;
  reactivateUser: (userId: string, adminId: string) => Promise<AuthorizedUser>;
  deleteUser: (userId: string) => Promise<void>;
  findByEmail: (email: string) => AuthorizedUser | undefined;
}

export const useUsersStore = create<UsersState>()((set, get) => ({
  users: [],
  loading: false,
  loaded: false,
  error: null,

  load: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const data = await api.get<AuthorizedUser[]>("/api/users");
      set({ users: data, loaded: true, loading: false });
    } catch (e: any) {
      console.error("[users-store load]", e?.message);
      set({
        error: e?.message ?? "Error al cargar usuarios",
        loading: false,
      });
    }
  },

  createUser: async (input) => {
    const created = await api.post<AuthorizedUser>("/api/users", input);
    set({ users: [...get().users, created] });
    return created;
  },

  authorizeUser: async (userId, adminId) => {
    const updated = await api.patch<AuthorizedUser>(`/api/users`, {
      id: userId,
      status: "ACTIVE",
      authorizedBy: adminId,
    });
    set({
      users: get().users.map((u) => (u.id === userId ? updated : u)),
    });
    return updated;
  },

  suspendUser: async (userId, adminId) => {
    const updated = await api.patch<AuthorizedUser>(`/api/users`, {
      id: userId,
      status: "SUSPENDED",
      suspendedBy: adminId,
    });
    set({
      users: get().users.map((u) => (u.id === userId ? updated : u)),
    });
    return updated;
  },

  reactivateUser: async (userId, adminId) => {
    const updated = await api.patch<AuthorizedUser>(`/api/users`, {
      id: userId,
      status: "ACTIVE",
      authorizedBy: adminId,
    });
    set({
      users: get().users.map((u) => (u.id === userId ? updated : u)),
    });
    return updated;
  },

  deleteUser: async (userId) => {
    await api.del(`/api/users?id=${encodeURIComponent(userId)}`);
    set({ users: get().users.filter((u) => u.id !== userId) });
  },

  findByEmail: (email) => {
    const e = email.trim().toLowerCase();
    return get().users.find((u) => u.email.toLowerCase() === e);
  },
}));
