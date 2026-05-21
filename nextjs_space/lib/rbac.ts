export interface MenuPermissionItem {
  key: string;
  label: string;
  path: string;
  section: "general" | "tecnico" | "administrativo" | "ventas";
}

export const MENU_PERMISSION_CATALOG: MenuPermissionItem[] = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard", section: "general" },

  { key: "proyectos", label: "Proyectos", path: "/dashboard/proyectos", section: "tecnico" },
  { key: "presupuestos", label: "Presupuestos", path: "/dashboard/presupuestos", section: "tecnico" },
  { key: "registro_gastos", label: "Registro de Gastos", path: "/dashboard/planeacion/contratos", section: "tecnico" },
  { key: "aiu", label: "AIU", path: "/dashboard/planeacion/aiu", section: "tecnico" },
  { key: "registro_avances", label: "Registro de Avances", path: "/dashboard/programacion", section: "tecnico" },
  { key: "cortes_obra", label: "Cortes de Obra", path: "/dashboard/cortes", section: "tecnico" },

  { key: "contratistas", label: "Contratistas", path: "/dashboard/subcontratistas", section: "administrativo" },
  { key: "proveedores", label: "Proveedores", path: "/dashboard/proveedores", section: "administrativo" },
  { key: "rrhh", label: "RRHH", path: "/dashboard/rrhh/empleados", section: "administrativo" },
  { key: "tesoreria", label: "Tesoreria", path: "/dashboard/tesoreria/pagos", section: "administrativo" },
  { key: "impuestos", label: "Impuestos", path: "/dashboard/reportes/impuestos", section: "administrativo" },
  { key: "usuarios", label: "Usuarios", path: "/dashboard/administracion/usuarios", section: "administrativo" },
  { key: "roles", label: "Roles y Permisos", path: "/dashboard/administracion/roles", section: "administrativo" },

  { key: "cotizaciones", label: "Cotizaciones", path: "/dashboard/ventas/cotizaciones", section: "ventas" },
  { key: "clientes", label: "Clientes", path: "/dashboard/ventas/clientes", section: "ventas" },
];

const LEGACY_ROLE_DEFAULTS: Record<string, string[]> = {
  ADMIN: MENU_PERMISSION_CATALOG.map((item) => item.key),
  GERENTE: MENU_PERMISSION_CATALOG.map((item) => item.key),
  DIRECTOR: [
    "dashboard",
    "proyectos",
    "presupuestos",
    "registro_gastos",
    "aiu",
    "registro_avances",
    "cortes_obra",
    "contratistas",
    "proveedores",
    "rrhh",
    "tesoreria",
    "impuestos",
    "cotizaciones",
    "clientes",
  ],
  RESIDENTE: [
    "dashboard",
    "proyectos",
    "presupuestos",
    "registro_gastos",
    "aiu",
    "registro_avances",
    "cortes_obra",
  ],
  CONTABILIDAD: ["dashboard", "tesoreria", "impuestos", "contratistas", "proveedores"],
  TESORERIA: ["dashboard", "tesoreria", "impuestos"],
  HSEQ: ["dashboard", "proyectos", "registro_avances", "contratistas"],
  CLIENTE: ["dashboard", "proyectos"],
  USER: ["dashboard"],
};

export function getDefaultMenuPermissionsForRole(role?: string | null): string[] {
  if (!role) return ["dashboard"];
  return LEGACY_ROLE_DEFAULTS[role] || ["dashboard"];
}

export function normalizeMenuPermissions(permissions: string[]): string[] {
  const valid = new Set(MENU_PERMISSION_CATALOG.map((item) => item.key));
  return [...new Set(permissions)].filter((permission) => valid.has(permission));
}

export function getRequiredMenuKeyForPath(pathname: string): string | null {
  if (!pathname.startsWith("/dashboard")) return null;

  let bestMatch: { key: string; path: string } | null = null;
  for (const item of MENU_PERMISSION_CATALOG) {
    if (pathname === item.path || pathname.startsWith(`${item.path}/`)) {
      if (!bestMatch || item.path.length > bestMatch.path.length) {
        bestMatch = { key: item.key, path: item.path };
      }
    }
  }

  return bestMatch?.key || "dashboard";
}
