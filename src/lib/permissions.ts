"use client";

import { useAuthStore } from "./auth-store";
import type { User, Role } from "@/types";

/**
 * Helpers de permisos para gating por rol.
 * Por ahora todo es cliente (sin backend), pero la firma permite migrar a server-side fácil.
 */

/** El "Super Administrador" del rediseño PDF = rol ADMIN. */
export function isSuperAdmin(user: User | null | undefined): boolean {
  return !!user && user.role === "ADMIN";
}

export function hasRole(user: User | null | undefined, ...roles: Role[]): boolean {
  return !!user && roles.includes(user.role);
}

export function useCurrentUser(): User | null {
  return useAuthStore((s) => s.user);
}

export function useIsSuperAdmin(): boolean {
  return isSuperAdmin(useAuthStore((s) => s.user));
}

export function useHasRole(...roles: Role[]): boolean {
  return hasRole(useAuthStore((s) => s.user), ...roles);
}
