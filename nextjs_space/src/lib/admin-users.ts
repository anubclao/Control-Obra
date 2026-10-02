/**
 * lib/admin-users.ts
 *
 * Helpers puros (sin acceso a DB ni a React) para el módulo de administración
 * de usuarios autorizados por Super Admin.
 *
 * Spec: docs/specs/admin-user-authorization-with-otp.md
 * Cubren AC-1 a AC-10.
 *
 * Por qué este archivo existe separado de users-store.ts y de /api/users:
 *   - Funciones puras, fácilmente testeables.
 *   - Reutilizables desde frontend (componentes) y backend (route handlers).
 *   - Sin dependencias de Zustand ni de mysql2 → cero acoplamiento.
 */

import type { Role, Area, User, Invitation } from "@/types";
import type { AuthorizedUser, AuthorizedUserStatus } from "@/types";

// =============================================================================
// Re-exports de tipos para que el import desde consumers sea de un solo lugar.
// =============================================================================
export type { AuthorizedUser, AuthorizedUserStatus } from "@/types";

// =============================================================================
// AC-2 · Validación de email
// =============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: unknown): boolean {
  return typeof email === "string" && EMAIL_REGEX.test(email.trim());
}

// =============================================================================
// AC-1 · Gating por Super Admin
// =============================================================================

export function isSuperAdmin(user: User | null | undefined): boolean {
  return !!user && user.role === "ADMIN";
}

// =============================================================================
// AC-3 · Construcción del registro inicial (estado PENDING)
// =============================================================================

export interface BuildAuthorizedUserInput {
  email: string;
  name: string;
  role: Role;
  area: Area;
  projectId?: string;
  createdBy: string;
  now?: () => Date; // inyectable para tests deterministas
}

export function buildAuthorizedUser(
  input: BuildAuthorizedUserInput,
): AuthorizedUser {
  const now = (input.now ?? (() => new Date()))().toISOString();
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : fallbackUuid();
  return {
    id,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    role: input.role,
    area: input.area,
    projectId: input.projectId,
    status: "PENDING",
    createdBy: input.createdBy,
    createdAt: now,
    authorizedBy: undefined,
    authorizedAt: undefined,
    suspendedBy: undefined,
    suspendedAt: undefined,
    lastLoginAt: undefined,
  };
}

function fallbackUuid(): string {
  // RFC4122 v4 — sólo se usa si crypto.randomUUID no está disponible.
  let s = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += "-";
    else if (i === 14) s += "4";
    else s += Math.floor(Math.random() * 16).toString(16);
  }
  return s.slice(0, 14) + "4" + s.slice(15).replace(/[0-9]/, (c) => {
    return ((parseInt(c, 10) & 0x3) | 0x8).toString(16);
  });
}

// =============================================================================
// AC-8 · Gate antes de enviar OTP
// =============================================================================

export type OtpRequestDecision =
  | { allowed: true }
  | { allowed: false; code: 403 | 404; reason: "NOT_REGISTERED" | "PENDING_AUTHORIZATION" | "SUSPENDED" };

export function canRequestOtp(
  user: AuthorizedUser | null | undefined,
): OtpRequestDecision {
  if (!user) {
    return { allowed: false, code: 404, reason: "NOT_REGISTERED" };
  }
  if (user.status === "PENDING") {
    return { allowed: false, code: 403, reason: "PENDING_AUTHORIZATION" };
  }
  if (user.status === "SUSPENDED") {
    return { allowed: false, code: 403, reason: "SUSPENDED" };
  }
  return { allowed: true };
}

// =============================================================================
// AC-3/4/5 · Transiciones de estado válidas
// =============================================================================

export function isTransitionAllowed(
  from: AuthorizedUserStatus,
  to: AuthorizedUserStatus,
): boolean {
  if (from === to) return false;
  // PENDING → ACTIVE (autorizar)
  if (from === "PENDING" && to === "ACTIVE") return true;
  // ACTIVE → SUSPENDED (suspender)
  if (from === "ACTIVE" && to === "SUSPENDED") return true;
  // SUSPENDED → ACTIVE (reactivar)
  if (from === "SUSPENDED" && to === "ACTIVE") return true;
  return false;
}

// =============================================================================
// AC-6 · KPIs del módulo
// =============================================================================

export interface AuthorizedUserKpis {
  active: number;
  pending: number;
  suspended: number;
  total: number;
}

export function computeKpis(users: AuthorizedUser[]): AuthorizedUserKpis {
  let active = 0;
  let pending = 0;
  let suspended = 0;
  for (const u of users) {
    if (u.status === "ACTIVE") active++;
    else if (u.status === "PENDING") pending++;
    else if (u.status === "SUSPENDED") suspended++;
  }
  return { active, pending, suspended, total: users.length };
}

// =============================================================================
// AC-7 · Filtros y búsqueda
// =============================================================================

export interface AuthorizedUserFilters {
  search?: string;
  role?: Role | "ALL";
  status?: AuthorizedUserStatus | "ALL";
}

export function filterAuthorizedUsers(
  users: AuthorizedUser[],
  filters: AuthorizedUserFilters,
): AuthorizedUser[] {
  const search = filters.search?.trim().toLowerCase() ?? "";
  const roleFilter = filters.role && filters.role !== "ALL" ? filters.role : null;
  const statusFilter =
    filters.status && filters.status !== "ALL" ? filters.status : null;

  return users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (statusFilter && u.status !== statusFilter) return false;
    if (search) {
      const hay =
        u.email.toLowerCase().includes(search) ||
        u.name.toLowerCase().includes(search) ||
        u.role.toLowerCase().includes(search);
      if (!hay) return false;
    }
    return true;
  });
}

// =============================================================================
// AC-9 · Migración de invitaciones legacy → usuarios autorizados
// =============================================================================

export function migrateInvitationsToUsers(
  invitations: Invitation[],
  adminId: string,
): AuthorizedUser[] {
  const migrated: AuthorizedUser[] = [];
  for (const inv of invitations) {
    if (inv.status !== "PENDING" && inv.status !== "ACCEPTED") continue;
    migrated.push(
      buildAuthorizedUser({
        email: inv.email,
        name: inv.email.split("@")[0] ?? inv.email,
        role: inv.role,
        area: (inv.area ?? "administrativo") as Area,
        projectId: inv.projectId,
        createdBy: inv.createdBy || adminId,
        now: () => new Date(inv.createdAt || Date.now()),
      }),
    );
    const u = migrated[migrated.length - 1];
    if (inv.status === "ACCEPTED") {
      u.status = "ACTIVE";
      // `acceptedBy` es el invitado que aceptó, no quien lo autorizó (AC-10).
      // La autorización es este acto de migración, ejecutado por el admin.
      u.authorizedBy = adminId;
      u.authorizedAt = inv.acceptedAt ?? inv.createdAt;
    }
  }
  return migrated;
}

// =============================================================================
// Util — mapear fila de DB → AuthorizedUser (snake_case → camelCase)
// =============================================================================

export interface AuthorizedUserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  area: Area;
  project_id?: string | null;
  status: AuthorizedUserStatus;
  created_by?: string | null;
  created_at?: string | null;
  authorized_by?: string | null;
  authorized_at?: string | null;
  suspended_by?: string | null;
  suspended_at?: string | null;
  last_login_at?: string | null;
}

export function rowToAuthorizedUser(row: AuthorizedUserRow): AuthorizedUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    area: row.area,
    projectId: row.project_id ?? undefined,
    status: row.status,
    createdBy: row.created_by ?? "",
    createdAt: row.created_at ?? new Date().toISOString(),
    authorizedBy: row.authorized_by ?? undefined,
    authorizedAt: row.authorized_at ?? undefined,
    suspendedBy: row.suspended_by ?? undefined,
    suspendedAt: row.suspended_at ?? undefined,
    lastLoginAt: row.last_login_at ?? undefined,
  };
}

export function authorizedUserToRow(
  u: AuthorizedUser,
): Record<string, unknown> {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    area: u.area,
    project_id: u.projectId ?? null,
    status: u.status,
    created_by: u.createdBy ?? null,
    created_at: u.createdAt,
    authorized_by: u.authorizedBy ?? null,
    authorized_at: u.authorizedAt ?? null,
    suspended_by: u.suspendedBy ?? null,
    suspended_at: u.suspendedAt ?? null,
    last_login_at: u.lastLoginAt ?? null,
  };
}
