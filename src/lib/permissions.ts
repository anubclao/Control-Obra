"use client";

import { useAuthStore } from "./auth-store";
import type { User, Role } from "@/types";
import {
  can,
  actionsFor,
  type Resource,
  type Action,
} from "./permissions-matrix";

/**
 * Helpers de permisos para gating por rol en componentes cliente.
 *
 * P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.4):
 *   Esta capa es el espejo cliente de `permissions-matrix.ts`. La
 *   matriz central es la unica fuente de verdad y la consumen:
 *     - Servidor: las rutas API llaman `can(role, resource, action)`
 *       para devolver 403 antes de tocar la BD.
 *     - UI: los componentes usan `useCan(resource, action)` y
 *       `useActionsFor(resource)` para mostrar / ocultar botones.
 *   Asi un cambio de politica (ej. quitar `pay` a TESORERIA) se hace
 *   en un solo archivo y se propaga a ambos lados.
 *
 * Antes este archivo decia "todo es cliente (sin backend)"; eso ya
 * no es cierto desde que se introdujo la matriz en Fase 4.
 */

/** El "Super Administrador" del rediseño PDF = rol ADMIN. */
export function isSuperAdmin(user: User | null | undefined): boolean {
  return !!user && user.role === "ADMIN";
}

export function hasRole(
  user: User | null | undefined,
  ...roles: Role[]
): boolean {
  return !!user && roles.includes(user.role);
}

export function useCurrentUser(): User | null {
  return useAuthStore((s) => s.user);
}

export function useIsSuperAdmin(): boolean {
  return isSuperAdmin(useAuthStore((s) => s.user));
}

export function useHasRole(...roles: Role[]): boolean {
  return hasRole(
    useAuthStore((s) => s.user),
    ...roles,
  );
}

/**
 * Hook de UI que consulta la matriz `permissions-matrix.ts`.
 *
 * Uso:
 *   const canApprove = useCan("payments", "approve_l1");
 *   const canEdit    = useCan("projects", "update");
 *
 * Si el rol no esta permitido, devuelve false. La matriz es la misma
 * que consume el servidor, asi que un boton que se ve en UI nunca
 * sera rechazado por el servidor (excepto cambios en linea).
 */
export function useCan(resource: Resource, action: Action): boolean {
  const role = useAuthStore((s) => s.user?.role);
  return can(role, resource, action);
}

/** Devuelve la lista de acciones disponibles para el rol actual sobre un recurso. */
export function useActionsFor(resource: Resource): Action[] {
  const role = useAuthStore((s) => s.user?.role);
  return actionsFor(role, resource);
}
