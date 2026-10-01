/**
 * tests/verifiers/admin-user-authorization.spec.ts
 *
 * PHASE 3 — Verifier (TDD, Red phase).
 * Cubre AC-1 a AC-10 de docs/specs/admin-user-authorization-with-otp.md
 *
 * Estos tests DEBEN FALLAR antes de la implementación (PHASE 4).
 * Una vez implementado el store y los componentes, deben pasar en verde.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isValidEmail,
  canRequestOtp,
  isSuperAdmin,
  buildAuthorizedUser,
  computeKpis,
  filterAuthorizedUsers,
  migrateInvitationsToUsers,
  isTransitionAllowed,
  type AuthorizedUser,
  type AuthorizedUserStatus,
} from "@/lib/admin-users";

// ──────────────────────────────────────────────────────────────
// AC-1 · Helper de gating por Super Admin
// ──────────────────────────────────────────────────────────────
describe("AC-1 · Gating por Super Admin", () => {
  it("isSuperAdmin devuelve true solo cuando role === 'ADMIN'", () => {
    expect(isSuperAdmin({ id: "u1", email: "a@x.com", name: "A", role: "ADMIN", area: "administrativo" })).toBe(true);
    expect(isSuperAdmin({ id: "u2", email: "b@x.com", name: "B", role: "GERENTE", area: "administrativo" })).toBe(false);
    expect(isSuperAdmin({ id: "u3", email: "c@x.com", name: "C", role: "RESIDENTE", area: "tecnico" })).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// AC-2 · Validación de email y construcción de usuario
// ──────────────────────────────────────────────────────────────
describe("AC-2 · Validación de email", () => {
  it("isValidEmail acepta correos con formato válido", () => {
    expect(isValidEmail("juan@empresa.com")).toBe(true);
    expect(isValidEmail("maria.lopez@controlobra.io")).toBe(true);
    expect(isValidEmail("a+tag@b.co")).toBe(true);
  });

  it("isValidEmail rechaza correos mal formados", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("sin-arroba.com")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
    expect(isValidEmail("@dominio.com")).toBe(false);
    expect(isValidEmail("user@dominio")).toBe(false);
    expect(isValidEmail("user con espacio@dominio.com")).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// AC-3 / AC-4 / AC-5 / AC-10 · Helpers de lógica de estado
// ──────────────────────────────────────────────────────────────
describe("AC-3 · buildAuthorizedUser genera el registro inicial en PENDING", () => {
  it("crea un AuthorizedUser en PENDING con createdBy/createdAt correctos", () => {
    const u = buildAuthorizedUser({
      email: "nuevo@empresa.com",
      name: "Nuevo Usuario",
      role: "RESIDENTE",
      area: "tecnico",
      projectId: undefined,
      createdBy: "admin-1",
    });

    expect(u.id).toMatch(/^[a-z0-9-]+$/);
    expect(u.email).toBe("nuevo@empresa.com");
    expect(u.name).toBe("Nuevo Usuario");
    expect(u.role).toBe("RESIDENTE");
    expect(u.area).toBe("tecnico");
    expect(u.status).toBe("PENDING");
    expect(u.createdBy).toBe("admin-1");
    expect(typeof u.createdAt).toBe("string");
    expect(Number.isFinite(Date.parse(u.createdAt))).toBe(true);
    expect(u.authorizedBy).toBeUndefined();
    expect(u.authorizedAt).toBeUndefined();
    expect(u.suspendedBy).toBeUndefined();
    expect(u.suspendedAt).toBeUndefined();
  });
});

describe("AC-8 · canRequestOtp — gate antes de enviar el código", () => {
  const baseActive: AuthorizedUser = {
    id: "u1",
    email: "x@y.com",
    name: "X",
    role: "USER",
    area: "tecnico",
    status: "ACTIVE",
    createdBy: "admin-1",
    createdAt: "2026-01-01T00:00:00Z",
  };

  it("permite solicitar OTP cuando el usuario existe y está ACTIVE", () => {
    expect(canRequestOtp(baseActive)).toEqual({ allowed: true });
  });

  it("rechaza cuando no existe el usuario (null/undefined)", () => {
    expect(canRequestOtp(null)).toEqual({ allowed: false, code: 404, reason: "NOT_REGISTERED" });
    expect(canRequestOtp(undefined)).toEqual({ allowed: false, code: 404, reason: "NOT_REGISTERED" });
  });

  it("rechaza cuando está PENDING con código 403", () => {
    expect(canRequestOtp({ ...baseActive, status: "PENDING" })).toEqual({
      allowed: false,
      code: 403,
      reason: "PENDING_AUTHORIZATION",
    });
  });

  it("rechaza cuando está SUSPENDED con código 403", () => {
    expect(canRequestOtp({ ...baseActive, status: "SUSPENDED" })).toEqual({
      allowed: false,
      code: 403,
      reason: "SUSPENDED",
    });
  });
});

// ──────────────────────────────────────────────────────────────
// AC-6 · KPIs derivados del listado
// ──────────────────────────────────────────────────────────────
describe("AC-6 · KPIs del módulo", () => {
  const users: AuthorizedUser[] = [
    { id: "1", email: "a@x.com", name: "A", role: "ADMIN",     area: "administrativo", status: "ACTIVE",    createdBy: "s", createdAt: "" },
    { id: "2", email: "b@x.com", name: "B", role: "GERENTE",   area: "administrativo", status: "ACTIVE",    createdBy: "s", createdAt: "" },
    { id: "3", email: "c@x.com", name: "C", role: "RESIDENTE", area: "tecnico",        status: "PENDING",   createdBy: "s", createdAt: "" },
    { id: "4", email: "d@x.com", name: "D", role: "HSEQ",      area: "tecnico",        status: "PENDING",   createdBy: "s", createdAt: "" },
    { id: "5", email: "e@x.com", name: "E", role: "USER",      area: "ventas",         status: "SUSPENDED", createdBy: "s", createdAt: "" },
  ];

  it("computeKpis cuenta correctamente por estado", () => {
    expect(computeKpis(users)).toEqual({
      active: 2,
      pending: 2,
      suspended: 1,
      total: 5,
    });
  });

  it("computeKpis maneja lista vacía sin explotar", () => {
    expect(computeKpis([])).toEqual({ active: 0, pending: 0, suspended: 0, total: 0 });
  });
});

// ──────────────────────────────────────────────────────────────
// AC-7 · Filtros (búsqueda libre + por rol + por estado)
// ──────────────────────────────────────────────────────────────
describe("AC-7 · Filtros y búsqueda", () => {
  const users: AuthorizedUser[] = [
    { id: "1", email: "juan@empresa.com", name: "Juan Pérez",  role: "RESIDENTE", area: "tecnico",        status: "ACTIVE",  createdBy: "s", createdAt: "" },
    { id: "2", email: "maria@empresa.com", name: "Maria Lopez", role: "HSEQ",     area: "tecnico",        status: "PENDING", createdBy: "s", createdAt: "" },
    { id: "3", email: "luis@otro.com", name: "Luis Diaz",        role: "GERENTE",  area: "administrativo", status: "ACTIVE",  createdBy: "s", createdAt: "" },
    { id: "4", email: "ana@otro.com", name: "Ana Ruiz",         role: "CLIENTE",  area: "ventas",         status: "SUSPENDED", createdBy: "s", createdAt: "" },
  ];

  it("filtra por texto libre en email, nombre o rol (case-insensitive)", () => {
    expect(filterAuthorizedUsers(users, { search: "juan" }).map((u) => u.id)).toEqual(["1"]);
    expect(filterAuthorizedUsers(users, { search: "EMPRESA" }).map((u) => u.id)).toEqual(["1", "2"]);
    expect(filterAuthorizedUsers(users, { search: "hseq" }).map((u) => u.id)).toEqual(["2"]);
    expect(filterAuthorizedUsers(users, { search: "" }).length).toBe(4);
  });

  it("filtra por rol exacto", () => {
    expect(filterAuthorizedUsers(users, { role: "GERENTE" }).map((u) => u.id)).toEqual(["3"]);
    expect(filterAuthorizedUsers(users, { role: "RESIDENTE" }).map((u) => u.id)).toEqual(["1"]);
  });

  it("filtra por estado", () => {
    expect(filterAuthorizedUsers(users, { status: "PENDING" }).map((u) => u.id)).toEqual(["2"]);
    expect(filterAuthorizedUsers(users, { status: "SUSPENDED" }).map((u) => u.id)).toEqual(["4"]);
    expect(filterAuthorizedUsers(users, { status: "ACTIVE" }).length).toBe(2);
  });

  it("combina filtros (AND lógico)", () => {
    expect(
      filterAuthorizedUsers(users, { search: "empresa", status: "ACTIVE" }).map((u) => u.id)
    ).toEqual(["1"]);
  });
});

// ──────────────────────────────────────────────────────────────
// AC-9 · Migración de invitaciones legacy → usuarios autorizados
// ──────────────────────────────────────────────────────────────
describe("AC-9 · Migración de Invitations legacy", () => {
  it("convierte invitaciones ACCEPTED en usuarios ACTIVE preservando rol/área", () => {
    const legacyInvitations = [
      {
        id: "i1",
        code: "ABCD1234",
        email: "a@x.com",
        role: "GERENTE" as const,
        area: "administrativo" as const,
        status: "ACCEPTED" as const,
        maxUses: 1,
        uses: 1,
        expiresAt: "2026-12-01",
        createdBy: "admin-1",
        createdAt: "2026-01-01",
        acceptedBy: "u-legacy-1",
        acceptedAt: "2026-01-02",
      },
      {
        id: "i2",
        code: "WXYZ5678",
        email: "b@x.com",
        role: "RESIDENTE" as const,
        area: "tecnico" as const,
        status: "PENDING" as const,
        maxUses: 1,
        uses: 0,
        expiresAt: "2026-12-01",
        createdBy: "admin-1",
        createdAt: "2026-01-01",
      },
    ];

    const migrated = migrateInvitationsToUsers(legacyInvitations, "admin-current");
    expect(migrated).toHaveLength(2);

    const accepted = migrated.find((u) => u.email === "a@x.com")!;
    expect(accepted.status).toBe("ACTIVE");
    expect(accepted.role).toBe("GERENTE");
    expect(accepted.area).toBe("administrativo");
    expect(accepted.authorizedBy).toBe("admin-current");

    const pending = migrated.find((u) => u.email === "b@x.com")!;
    expect(pending.status).toBe("PENDING");
    expect(pending.role).toBe("RESIDENTE");
    expect(pending.area).toBe("tecnico");
  });

  it("omite invitaciones EXPIRED y CANCELLED de la migración", () => {
    const legacy = [
      {
        id: "i1",
        code: "EXPI1234",
        email: "x@y.com",
        role: "USER" as const,
        status: "EXPIRED" as const,
        maxUses: 1,
        uses: 0,
        expiresAt: "",
        createdBy: "admin",
        createdAt: "",
      },
      {
        id: "i2",
        code: "CANC1234",
        email: "y@z.com",
        role: "USER" as const,
        status: "CANCELLED" as const,
        maxUses: 1,
        uses: 0,
        expiresAt: "",
        createdBy: "admin",
        createdAt: "",
      },
    ];
    expect(migrateInvitationsToUsers(legacy, "admin-current")).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────
// AC-3/4/5 · Transiciones de estado válidas
// ──────────────────────────────────────────────────────────────
describe("AC-3/4/5 · Transiciones válidas de estado", () => {
  const transitions: Array<{ from: AuthorizedUserStatus; to: AuthorizedUserStatus; allowed: boolean }> = [
    { from: "PENDING",   to: "ACTIVE",    allowed: true },
    { from: "PENDING",   to: "SUSPENDED", allowed: false },
    { from: "ACTIVE",    to: "SUSPENDED", allowed: true },
    { from: "ACTIVE",    to: "PENDING",   allowed: false },
    { from: "SUSPENDED", to: "ACTIVE",    allowed: true },
    { from: "SUSPENDED", to: "PENDING",   allowed: false },
  ];

  it("documenta y respeta la matriz de transiciones", () => {
    transitions.forEach(({ from, to, allowed }) => {
      expect(isTransitionAllowed(from, to)).toBe(allowed);
    });
  });

  it("ningun estado puede transicionar a si mismo", () => {
    (["PENDING", "ACTIVE", "SUSPENDED"] as AuthorizedUserStatus[]).forEach((s) => {
      expect(isTransitionAllowed(s, s)).toBe(false);
    });
  });
});

// ──────────────────────────────────────────────────────────────
// AC-10 · Auditoría — campos opcionales poblados en cada acción
// ──────────────────────────────────────────────────────────────
describe("AC-10 · Auditoría mínima", () => {
  it("buildAuthorizedUser incluye createdBy/createdAt y deja authorized* vacíos hasta activación", () => {
    const u = buildAuthorizedUser({
      email: "aud@x.com",
      name: "Aud",
      role: "USER",
      area: "ventas",
      createdBy: "super-1",
    });
    expect(u.createdBy).toBe("super-1");
    expect(u.createdAt).toBeTruthy();
    expect(u.authorizedBy).toBeUndefined();
    expect(u.authorizedAt).toBeUndefined();
    expect(u.suspendedBy).toBeUndefined();
    expect(u.suspendedAt).toBeUndefined();
    expect(u.lastLoginAt).toBeUndefined();
  });
});
