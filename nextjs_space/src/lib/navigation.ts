import {
  LayoutDashboard,
  FolderKanban,
  Calculator,
  TrendingUp,
  FileText,
  Truck,
  Scissors,
  BookOpen,
  Wallet,
  Receipt,
  Percent,
  Users,
  UserCog,
  UserPlus,
  Building2,
  FileSpreadsheet,
  ListChecks,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import type { Area, Role } from "@/types";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  requiresRole?: Role;
}

export const NAV_BY_AREA: Record<Area, NavItem[]> = {
  tecnico: [
    { title: "Dashboard", href: "/tecnico", icon: LayoutDashboard, description: "Vista general técnica" },
    { title: "Proyectos", href: "/tecnico/proyectos", icon: FolderKanban },
    { title: "Presupuestos", href: "/tecnico/presupuestos", icon: Calculator },
    { title: "PSC", href: "/tecnico/presupuestos/psc", icon: ClipboardList, description: "Presupuesto proveedor" },
    { title: "Gastos", href: "/tecnico/gastos", icon: Receipt, description: "Registro de gastos" },
    { title: "AIU", href: "/tecnico/aiu", icon: TrendingUp, description: "Resumen global" },
    { title: "Contratos", href: "/tecnico/contratos", icon: FileText },
    { title: "Proveedores", href: "/tecnico/proveedores", icon: Truck },
    { title: "Cortes de Obra", href: "/tecnico/cortes", icon: Scissors },
    { title: "Bitácora", href: "/tecnico/bitacora", icon: BookOpen },
  ],
  administrativo: [
    { title: "Dashboard", href: "/administrativo", icon: LayoutDashboard, description: "Vista general administrativa" },
    { title: "Tesorería", href: "/administrativo/tesoreria", icon: Wallet },
    { title: "Pagos", href: "/administrativo/pagos", icon: ListChecks },
    { title: "Reportes Financieros", href: "/administrativo/reportes/financiero", icon: FileSpreadsheet },
    { title: "Impuestos", href: "/administrativo/impuestos", icon: Percent },
    { title: "RRHH - Empleados", href: "/administrativo/empleados", icon: Users },
    // Solo visible para Super Admin (rol ADMIN).  El gating real vive en el
    // componente de la página con useIsSuperAdmin(); aquí dejamos el item
    // declarado para que el sidebar pueda filtrarlo si lo desea.
    { title: "Administración", href: "/administrativo/usuarios", icon: UserCog, requiresRole: "ADMIN" as const },
  ],
  ventas: [
    { title: "Dashboard", href: "/ventas", icon: LayoutDashboard, description: "Pipeline y métricas comerciales" },
    { title: "Clientes", href: "/ventas/clientes", icon: Building2 },
    { title: "Cotizaciones", href: "/ventas/cotizaciones", icon: FileSpreadsheet },
    { title: "CRM - Pipeline", href: "/ventas/pipeline", icon: UserPlus },
  ],
};

export const AREA_LABELS: Record<Area, string> = {
  tecnico: "Área Técnica",
  administrativo: "Área Administrativa",
  ventas: "Área Comercial",
};

export const AREA_COLORS: Record<Area, string> = {
  tecnico: "bg-blue-500",
  administrativo: "bg-emerald-500",
  ventas: "bg-violet-500",
};
