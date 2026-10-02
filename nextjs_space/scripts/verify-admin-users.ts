/**
 * scripts/verify-admin-users.ts
 *
 * Smoke test STANDALONE (no vitest) para validar la implementación de
 * src/lib/admin-users.ts cuando el sandbox bloquea vitest (rolldown EPERM).
 *
 * Cubre los mismos escenarios que el verifier spec, sin dependencias externas.
 *
 * Uso: npx tsx scripts/verify-admin-users.ts
 *      (si tsx no está disponible, usar node --import tsx scripts/verify-admin-users.ts)
 */

import {
  isValidEmail,
  isSuperAdmin,
  buildAuthorizedUser,
  canRequestOtp,
  computeKpis,
  filterAuthorizedUsers,
  migrateInvitationsToUsers,
  isTransitionAllowed,
} from "../src/lib/admin-users.ts";
import type { AuthorizedUser, AuthorizedUserStatus } from "../src/types/index.ts";
import type { Role, Area } from "../src/types/index.ts";

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  \u2713 ${name}`);
    passed++;
  } else {
    console.error(`  \u2717 ${name}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

function section(title: string) {
  console.log(`\n— ${title} —`);
}

const baseUser = (overrides: Partial<AuthorizedUser> = {}): AuthorizedUser => ({
  id: "u-test",
  email: "x@y.com",
  name: "X",
  role: "USER",
  area: "tecnico",
  status: "ACTIVE",
  createdBy: "admin",
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

// ──────────────────────────────────────────────────────────────────────
section("AC-1 · isSuperAdmin");
assert(
  "ADMIN → true",
  isSuperAdmin({ id: "u", email: "a@x.com", name: "A", role: "ADMIN" as Role, area: "administrativo" as Area }) === true,
);
assert(
  "GERENTE → false",
  isSuperAdmin({ id: "u", email: "b@x.com", name: "B", role: "GERENTE" as Role, area: "administrativo" as Area }) === false,
);
assert("null → false", isSuperAdmin(null) === false);
assert("undefined → false", isSuperAdmin(undefined) === false);

// ──────────────────────────────────────────────────────────────────────
section("AC-2 · isValidEmail");
assert("'juan@empresa.com' válido", isValidEmail("juan@empresa.com"));
assert("'a+tag@b.co' válido", isValidEmail("a+tag@b.co"));
assert("'' inválido", !isValidEmail(""));
assert("'sin-arroba' inválido", !isValidEmail("sin-arroba.com"));
assert("'user@' inválido", !isValidEmail("user@"));
assert("'user@dominio' inválido", !isValidEmail("user@dominio"));
assert("'con espacio@x.com' inválido", !isValidEmail("user con espacio@x.com"));

// ──────────────────────────────────────────────────────────────────────
section("AC-3 · buildAuthorizedUser → PENDING");
{
  const u = buildAuthorizedUser({
    email: "nuevo@empresa.com",
    name: "Nuevo",
    role: "RESIDENTE",
    area: "tecnico",
    createdBy: "admin-1",
  });
  assert("id generado (UUID-like)", /^[a-z0-9-]+$/.test(u.id));
  assert("email normalizado", u.email === "nuevo@empresa.com");
  assert("name trim", u.name === "Nuevo");
  assert("status === 'PENDING'", u.status === "PENDING");
  assert("createdBy === 'admin-1'", u.createdBy === "admin-1");
  assert("createdAt ISO parseable", Number.isFinite(Date.parse(u.createdAt)));
  assert("authorizedBy undefined", u.authorizedBy === undefined);
  assert("authorizedAt undefined", u.authorizedAt === undefined);
  assert("suspendedBy undefined", u.suspendedBy === undefined);
}

// ──────────────────────────────────────────────────────────────────────
section("AC-8 · canRequestOtp");
{
  const active = baseUser({ status: "ACTIVE" });
  const pending = baseUser({ status: "PENDING" });
  const suspended = baseUser({ status: "SUSPENDED" });

  assert("ACTIVE → allowed", canRequestOtp(active).allowed === true);
  assert(
    "PENDING → 403 PENDING_AUTHORIZATION",
    JSON.stringify(canRequestOtp(pending)) ===
      JSON.stringify({ allowed: false, code: 403, reason: "PENDING_AUTHORIZATION" }),
  );
  assert(
    "SUSPENDED → 403 SUSPENDED",
    JSON.stringify(canRequestOtp(suspended)) ===
      JSON.stringify({ allowed: false, code: 403, reason: "SUSPENDED" }),
  );
  assert(
    "null → 404 NOT_REGISTERED",
    JSON.stringify(canRequestOtp(null)) ===
      JSON.stringify({ allowed: false, code: 404, reason: "NOT_REGISTERED" }),
  );
}

// ──────────────────────────────────────────────────────────────────────
section("AC-3/4/5 · isTransitionAllowed");
const transitions: Array<[AuthorizedUserStatus, AuthorizedUserStatus, boolean]> = [
  ["PENDING", "ACTIVE", true],
  ["PENDING", "SUSPENDED", false],
  ["ACTIVE", "SUSPENDED", true],
  ["ACTIVE", "PENDING", false],
  ["SUSPENDED", "ACTIVE", true],
  ["SUSPENDED", "PENDING", false],
];
for (const [from, to, allowed] of transitions) {
  assert(`${from} → ${to} ${allowed ? "OK" : "BLOQUEADO"}`, isTransitionAllowed(from, to) === allowed);
}

// ──────────────────────────────────────────────────────────────────────
section("AC-6 · computeKpis");
{
  const users = [
    baseUser({ id: "1", status: "ACTIVE" }),
    baseUser({ id: "2", status: "ACTIVE" }),
    baseUser({ id: "3", status: "PENDING" }),
    baseUser({ id: "4", status: "PENDING" }),
    baseUser({ id: "5", status: "SUSPENDED" }),
  ];
  const k = computeKpis(users);
  assert("active=2", k.active === 2);
  assert("pending=2", k.pending === 2);
  assert("suspended=1", k.suspended === 1);
  assert("total=5", k.total === 5);
  assert("empty list", computeKpis([]).total === 0);
}

// ──────────────────────────────────────────────────────────────────────
section("AC-7 · filterAuthorizedUsers");
{
  const users: AuthorizedUser[] = [
    baseUser({ id: "1", email: "juan@empresa.com", name: "Juan Pérez", role: "RESIDENTE", area: "tecnico", status: "ACTIVE" }),
    baseUser({ id: "2", email: "maria@empresa.com", name: "Maria Lopez", role: "HSEQ", area: "tecnico", status: "PENDING" }),
    baseUser({ id: "3", email: "luis@otro.com", name: "Luis Diaz", role: "GERENTE", area: "administrativo", status: "ACTIVE" }),
    baseUser({ id: "4", email: "ana@otro.com", name: "Ana Ruiz", role: "CLIENTE", area: "ventas", status: "SUSPENDED" }),
  ];
  assert(
    "search='juan' → 1 resultado",
    filterAuthorizedUsers(users, { search: "juan" }).length === 1,
  );
  assert(
    "search='EMPRESA' → 2 (case-insensitive)",
    filterAuthorizedUsers(users, { search: "EMPRESA" }).length === 2,
  );
  assert(
    "search='' → todos",
    filterAuthorizedUsers(users, { search: "" }).length === 4,
  );
  assert(
    "role='GERENTE' → 1",
    filterAuthorizedUsers(users, { role: "GERENTE" }).length === 1,
  );
  assert(
    "status='SUSPENDED' → 1",
    filterAuthorizedUsers(users, { status: "SUSPENDED" }).length === 1,
  );
  assert(
    "search='empresa' + status='ACTIVE' → 1",
    filterAuthorizedUsers(users, { search: "empresa", status: "ACTIVE" }).length === 1,
  );
}

// ──────────────────────────────────────────────────────────────────────
section("AC-9 · migrateInvitationsToUsers");
{
  const legacy = [
    {
      id: "i1",
      code: "ABCD1234",
      email: "a@x.com",
      role: "GERENTE" as Role,
      area: "administrativo" as Area,
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
      role: "RESIDENTE" as Role,
      area: "tecnico" as Area,
      status: "PENDING" as const,
      maxUses: 1,
      uses: 0,
      expiresAt: "2026-12-01",
      createdBy: "admin-1",
      createdAt: "2026-01-01",
    },
  ];
  const migrated = migrateInvitationsToUsers(legacy as any, "admin-current");
  assert("2 usuarios migrados", migrated.length === 2);
  const accepted = migrated.find((u) => u.email === "a@x.com")!;
  assert("ACCEPTED → ACTIVE", accepted.status === "ACTIVE");
  assert("ACCEPTED preserva role", accepted.role === "GERENTE");
  assert("ACCEPTED preserva area", accepted.area === "administrativo");
  const pending = migrated.find((u) => u.email === "b@x.com")!;
  assert("PENDING → PENDING", pending.status === "PENDING");

  // Legacy cancelados/expirados omitidos
  const cancelled = [
    {
      id: "i3",
      code: "EXPI1234",
      email: "x@y.com",
      role: "USER" as Role,
      status: "EXPIRED" as const,
      maxUses: 1,
      uses: 0,
      expiresAt: "",
      createdBy: "admin",
      createdAt: "",
    },
    {
      id: "i4",
      code: "CANC1234",
      email: "y@z.com",
      role: "USER" as Role,
      status: "CANCELLED" as const,
      maxUses: 1,
      uses: 0,
      expiresAt: "",
      createdBy: "admin",
      createdAt: "",
    },
  ];
  assert(
    "EXPIRED/CANCELLED omitidos",
    migrateInvitationsToUsers(cancelled as any, "admin-current").length === 0,
  );
}

// ──────────────────────────────────────────────────────────────────────
console.log(`\n========================================`);
console.log(`Resultados: ${passed} pasaron, ${failed} fallaron`);
console.log(`========================================`);

if (failed > 0) process.exit(1);
