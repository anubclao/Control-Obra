/**
 * lib/permissions-matrix.ts
 *
 * Matriz centralizada de permisos rol × recurso × acción.
 *
 * P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.4):
 *   Antes, los handlers API usaban listas blancas locales (7 roles
 *   en pagos, otros 7 en clientes, etc.) y nunca se reutilizaban.
 *   HSEQ podia crear pagos, no habia un rol VENTAS explicito, y
 *   cualquier GET solo exigia requireAuth. Aqui consolidamos todo
 *   en una sola fuente que sirve a:
 *     - Rutas API: `can(role, resource, action)` -> boolean.
 *     - UI cliente: `useCan(resource, action)` para gating de botones.
 *
 * Diseño:
 *   - `RESOURCE_ACTIONS[resource] = Action[]` declara la lista cerrada
 *     de acciones que cada recurso soporta. Esto evita que se inventen
 *     strings nuevos.
 *   - `ROLE_PERMISSIONS[role]` mapea recurso -> Set<action> permitido.
 *     ADMIN tiene `*` (todas) para no tener que mantener un mapa gigante.
 *   - `can()` consulta el mapa y devuelve false por defecto (deny-by-default).
 *
 * Uso servidor:
 *   if (!can(user.role, "payments", "write")) {
 *     return NextResponse.json({ error: "forbidden" }, { status: 403 });
 *   }
 *
 * Uso cliente:
 *   const allowed = useCan("payments", "approve_l1");
 *   if (!allowed) return null;
 *
 * Notas:
 *   - "create" / "read" / "update" / "delete" siguen el patron REST.
 *   - "approve_l1" / "approve_l2" / "pay" / "reject" / "cancel" son
 *     acciones de workflow de pagos; viven aqui para que el cliente
 *     y el servidor compartan el mismo mapa.
 *   - "validate" / "approve" / "submit" son acciones de workflow de
 *     cortes, equivalentes a las anteriores.
 *   - Las acciones de pagos y cortes ya tienen su propio mapa de
 *     roles en `payments-workflow.ts` y `cuts-workflow.ts`. Este
 *     archivo es la CAPA SUPERIOR que engloba tanto workflow como
 *     CRUD, y se usa para los chequeos de servidor antes de entrar
 *     al workflow puro.
 */

import type { Role } from "@/types";

// -----------------------------------------------------------------------------
// Recursos del sistema
// -----------------------------------------------------------------------------

export type Resource =
  | "projects"
  | "work_logs"
  | "cuts"
  | "payments"
  | "clients"
  | "quotations"
  | "providers"
  | "contracts"
  | "budgets"
  | "pscs"
  | "expenses"
  | "employees"
  | "users"
  | "accounting"
  | "documents";

export type Action =
  // CRUD
  | "read"
  | "create"
  | "update"
  | "delete"
  | "soft_delete"
  // Workflow de pagos
  | "approve_l1"
  | "approve_l2"
  | "pay"
  | "reject"
  | "cancel"
  // Workflow de cortes
  | "submit"
  | "validate"
  | "approve"
  // Comercial
  | "move_stage"
  | "convert_to_project";

// -----------------------------------------------------------------------------
// Tabla: rol -> recurso -> acciones permitidas
// -----------------------------------------------------------------------------
// "*" = todas las acciones del recurso (incluye futuras que se agreguen).
// "all" = el comodín para ADMIN (cualquier recurso, cualquier acción).

const A: Action[] = []; // helper de readability
const C: Action[] = ["create"];
const R: Action[] = ["read"];
const U: Action[] = ["update"];
const D: Action[] = ["delete"];
const S: Action[] = ["soft_delete"];

/**
 * Permisos por rol. La forma es `Record<Role, Record<Resource, Action[]>>`.
 * Si una entrada es `"all"`, el rol tiene TODAS las acciones registradas
 * (incluidas las que se agreguen en el futuro).
 *
 * Lo que NO esta aqui esta denegado por defecto. Por eso "CLIENTE" y
 * "USER" no aparecen: no tienen permisos declarados, `can()` devuelve
 * false para todo.
 */
export const ROLE_PERMISSIONS: Record<
  Role,
  "all" | Partial<Record<Resource, Action[]>>
> = {
  ADMIN: "all",

  GERENTE: {
    projects: [...R, ...C, ...U],
    work_logs: [...R],
    // GERENTE puede rechazar cortes pero NO aprobar (solo ADMIN).
    cuts: [...R, ...U, "reject"],
    payments: [...R, ...C, ...U, "approve_l2", "reject"],
    clients: [...R, ...C, ...U, "move_stage"],
    quotations: [...R, ...C, ...U],
    providers: [...R, ...C, ...U, ...S],
    contracts: [...R, ...C, ...U],
    budgets: [...R, ...C, ...U],
    pscs: [...R, ...C, ...U],
    expenses: [...R, ...C, ...U],
    employees: [...R, ...C, ...U],
    accounting: [...R, ...C, ...U],
    documents: [...R, ...C],
  },

  DIRECTOR: {
    projects: [...R, ...C, ...U],
    work_logs: [...R, ...C, ...U],
    // DIRECTOR valida y rechaza, pero NO aprueba (solo ADMIN).
    cuts: [...R, ...C, ...U, "submit", "validate", "reject"],
    payments: [...R, ...C, ...U, "approve_l1", "reject"],
    clients: [...R, ...C, ...U, "move_stage"],
    quotations: [...R, ...C, ...U],
    providers: [...R, ...C, ...U, ...S],
    contracts: [...R, ...C, ...U],
    budgets: [...R, ...C, ...U],
    pscs: [...R, ...C, ...U],
    expenses: [...R, ...C, ...U],
    employees: [...R],
    accounting: [...R],
    documents: [...R, ...C],
  },

  RESIDENTE: {
    projects: [...R, ...C, ...U],
    work_logs: [...R, ...C, ...U],
    cuts: [...R, ...C, ...U, "submit"],
    payments: [...R, ...C, ...U],
    clients: [...R, ...C, ...U, "move_stage"],
    quotations: [...R, ...C, ...U],
    providers: [...R, ...C, ...U],
    contracts: [...R, ...C, ...U],
    budgets: [...R, ...C, ...U],
    pscs: [...R, ...C, ...U],
    expenses: [...R, ...C, ...U],
    documents: [...R, ...C],
  },

  CONTABILIDAD: {
    projects: [...R],
    cuts: [...R],
    payments: [...R, ...C, ...U],
    clients: [...R, ...C, ...U],
    quotations: [...R, ...C, ...U],
    providers: [...R, ...C, ...U],
    contracts: [...R, ...C, ...U],
    budgets: [...R, ...C, ...U],
    expenses: [...R, ...C, ...U],
    employees: [...R, ...C, ...U],
    accounting: [...R, ...C, ...U],
    documents: [...R, ...C],
  },

  TESORERIA: {
    projects: [...R],
    cuts: [...R, "pay"],
    payments: [...R, ...C, ...U, "pay", "cancel"],
    clients: [...R],
    quotations: [...R],
    providers: [...R],
    contracts: [...R, ...C, ...U],
    budgets: [...R],
    accounting: [...R, ...C, ...U],
    documents: [...R, ...C],
  },

  HSEQ: {
    projects: [...R],
    work_logs: [...R, ...C, ...U],
    cuts: [...R],
    // P1 (seccion 4.4): antes HSEQ podia crear pagos porque la lista
    // blanca de 7 roles se compartia. Con la matriz, HSEQ ya no
    // puede escribir pagos (solo lectura).
    payments: [...R],
    clients: [...R, ...C, ...U, "move_stage"],
    quotations: [...R],
    providers: [...R, ...C, ...U],
    contracts: [...R],
    employees: [...R],
    documents: [...R, ...C],
  },

  // CLIENTE / USER no tienen permisos declarados: can() devuelve
  // false para cualquier recurso. Asi satisfacemos la P0 de la
  // seccion 4.4 ("cualquier usuario lee TODAS las solicitudes de
  // pago"): con la matriz, USER no puede ni siquiera leer pagos.
  CLIENTE: {},
  USER: {},
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Devuelve true si `role` puede ejecutar `action` sobre `resource`.
 * Deny-by-default: si no hay entrada, devuelve false.
 *
 * ADMIN siempre devuelve true (wildcard "all").
 */
export function can(
  role: Role | string | null | undefined,
  resource: Resource,
  action: Action,
): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role as Role];
  if (!perms) return false;
  if (perms === "all") return true;
  const actions = perms[resource];
  if (!actions) return false;
  return actions.includes(action);
}

/**
 * Igual que `can` pero para chequeos de UI. Devuelve false si el rol
 * no esta presente o no esta permitido.
 */
export function canRole(
  role: Role | string | null | undefined,
  resource: Resource,
  action: Action,
): boolean {
  return can(role, resource, action);
}
void canRole; // exportado para compatibilidad; misma impl que can().

/**
 * Devuelve la lista de acciones que un rol puede ejecutar sobre un
 * recurso. Util para filtrar menus/botones.
 */
export function actionsFor(
  role: Role | string | null | undefined,
  resource: Resource,
): Action[] {
  if (!role) return [];
  const perms = ROLE_PERMISSIONS[role as Role];
  if (!perms) return [];
  if (perms === "all") {
    // ADMIN: devolver todas las acciones conocidas (cubre las
    // pre-declaradas arriba). Si se anade una nueva, hay que
    // agregarla tambien a esta lista.
    return [
      "read",
      "create",
      "update",
      "delete",
      "soft_delete",
      "approve_l1",
      "approve_l2",
      "pay",
      "reject",
      "cancel",
      "submit",
      "validate",
      "approve",
      "move_stage",
      "convert_to_project",
    ];
  }
  return perms[resource] ?? [];
}

// -----------------------------------------------------------------------------
// Compatibilidad hacia atras
// -----------------------------------------------------------------------------
// Lista de roles que pueden escribir en el "nucleo" del sistema.
// Antes se hacia `requireRole("ADMIN","GERENTE",...)` en cada ruta;
// este helper centraliza la lista corta y sigue funcionando.
export const CORE_WRITE_ROLES: Role[] = [
  "ADMIN",
  "GERENTE",
  "DIRECTOR",
  "RESIDENTE",
  "CONTABILIDAD",
  "TESORERIA",
  "HSEQ",
];

export const ACCOUNTING_WRITE_ROLES: Role[] = [
  "ADMIN",
  "GERENTE",
  "CONTABILIDAD",
  "TESORERIA",
];
