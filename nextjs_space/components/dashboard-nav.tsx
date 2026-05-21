"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getDefaultMenuPermissionsForRole } from "@/lib/rbac";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  FileText,
  BookOpen,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Percent,
  FileSignature,
  Scissors,
  Wallet,
  Receipt,
  UserCheck,
  Briefcase,
  CalendarDays,
  ShoppingCart,
  Building2,
  HardHat,
  Truck,
  UserCog,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { useState, useEffect } from "react";

interface DashboardNavProps {
  user: { role?: string; menuPermissions?: string[] } | null;
  onNavigate?: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  permissionKey?: string;
  children?: NavItem[];
  roles?: string[];
  isSection?: boolean;
}

const navigation: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permissionKey: "dashboard",
  },
  // ===== ÁREA TÉCNICA =====
  {
    name: "Técnico",
    href: "#tecnico",
    icon: HardHat,
    isSection: true,
    children: [
      {
        name: "Proyectos",
        href: "/dashboard/proyectos",
        icon: FolderKanban,
        permissionKey: "proyectos",
      },
      {
        name: "Presupuestos",
        href: "/dashboard/presupuestos",
        icon: FileSpreadsheet,
        permissionKey: "presupuestos",
      },
      {
        name: "Registro de Gastos",
        href: "/dashboard/planeacion/contratos",
        icon: FileSignature,
        permissionKey: "registro_gastos",
      },
      {
        name: "AIU",
        href: "/dashboard/planeacion/aiu",
        icon: Percent,
        permissionKey: "aiu",
      },
      {
        name: "Registro de Avances",
        href: "/dashboard/programacion",
        icon: CalendarDays,
        permissionKey: "registro_avances",
      },
      {
        name: "Cortes de Obra",
        href: "/dashboard/cortes",
        icon: Scissors,
        permissionKey: "cortes_obra",
      },
    ],
  },
  // ===== ÁREA ADMINISTRATIVA =====
  {
    name: "Administrativo",
    href: "#administrativo",
    icon: Briefcase,
    isSection: true,
    roles: ["ADMIN", "GERENTE", "DIRECTOR", "CONTABILIDAD", "TESORERIA", "HSEQ"],
    children: [
      {
        name: "Contratistas",
        href: "/dashboard/subcontratistas",
        icon: Users,
        permissionKey: "contratistas",
      },
      {
        name: "Proveedores",
        href: "/dashboard/proveedores",
        icon: Truck,
        permissionKey: "proveedores",
      },
      {
        name: "RRHH",
        href: "/dashboard/rrhh/empleados",
        icon: UserCheck,
        permissionKey: "rrhh",
      },
      {
        name: "Tesorería",
        href: "/dashboard/tesoreria/pagos",
        icon: Wallet,
        permissionKey: "tesoreria",
      },
      {
        name: "Impuestos",
        href: "/dashboard/reportes/impuestos",
        icon: Receipt,
        permissionKey: "impuestos",
      },
      {
        name: "Usuarios",
        href: "/dashboard/administracion/usuarios",
        icon: UserCog,
        permissionKey: "usuarios",
        roles: ["ADMIN", "GERENTE"],
      },
      {
        name: "Roles y Permisos",
        href: "/dashboard/administracion/roles",
        icon: Shield,
        permissionKey: "roles",
        roles: ["ADMIN", "GERENTE"],
      },
    ],
  },
  // ===== ÁREA VENTAS =====
  {
    name: "Ventas",
    href: "#ventas",
    icon: ShoppingCart,
    isSection: true,
    roles: ["ADMIN", "GERENTE", "DIRECTOR"],
    children: [
      {
        name: "Cotizaciones",
        href: "/dashboard/ventas/cotizaciones",
        icon: FileText,
        permissionKey: "cotizaciones",
      },
      {
        name: "Clientes",
        href: "/dashboard/ventas/clientes",
        icon: Building2,
        permissionKey: "clientes",
      },
    ],
  },
];

export function DashboardNav({ user, onNavigate }: DashboardNavProps) {
  const pathname = usePathname();
  const userRole = user?.role || "USER";
  const menuPermissions =
    user?.menuPermissions?.length
      ? user.menuPermissions
      : getDefaultMenuPermissionsForRole(userRole);
  const allowedMenuKeys = new Set(menuPermissions);
  const [expandedItems, setExpandedItems] = useState<string[]>(["Técnico", "Administrativo", "Ventas"]);

  const hasPermission = (item: NavItem): boolean => {
    if (item.permissionKey) {
      return allowedMenuKeys.has(item.permissionKey);
    }

    if (item.roles && !item.roles.includes(userRole)) {
      return false;
    }

    return true;
  };

  // Filtrar navegación según rol del usuario
  const filteredNavigation = navigation.filter((item) => {
    if (!hasPermission(item)) return false;

    if (item.children) {
      return item.children.some((child) => hasPermission(child));
    }

    return true;
  });

  // Filtrar hijos según rol
  const filterChildren = (children: NavItem[] | undefined) => {
    if (!children) return [];
    return children.filter((child) => {
      return hasPermission(child);
    });
  };

  // Auto-expand parent if child is active
  useEffect(() => {
    navigation.forEach((item) => {
      if (item.children) {
        const isChildActive = item.children.some(
          (child) =>
            pathname === child.href || pathname?.startsWith(child.href + "/")
        );
        if (isChildActive) {
          setExpandedItems((prev) =>
            prev.includes(item.name) ? prev : [...prev, item.name]
          );
        }
      }
    });
  }, [pathname]);

  const toggleExpand = (name: string) => {
    setExpandedItems((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : [...prev, name]
    );
  };

  const getSectionColor = (name: string) => {
    switch (name) {
      case "Técnico":
        return { bg: "bg-blue-600 dark:bg-blue-700", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800", activeBg: "bg-blue-50 dark:bg-blue-950/50" };
      case "Administrativo":
        return { bg: "bg-amber-600 dark:bg-amber-700", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800", activeBg: "bg-amber-50 dark:bg-amber-950/50" };
      case "Ventas":
        return { bg: "bg-green-600 dark:bg-green-700", text: "text-green-700 dark:text-green-400", border: "border-green-200 dark:border-green-800", activeBg: "bg-green-50 dark:bg-green-950/50" };
      default:
        return { bg: "bg-gray-600 dark:bg-gray-700", text: "text-gray-700 dark:text-gray-400", border: "border-gray-200 dark:border-gray-700", activeBg: "bg-gray-50 dark:bg-gray-800" };
    }
  };

  const handleLinkClick = () => {
    if (onNavigate) {
      onNavigate();
    }
  };

  const renderNavItem = (item: NavItem, parentName?: string) => {
    const Icon = item.icon;
    const isActive =
      pathname === item.href ||
      (pathname?.startsWith(item.href + "/") && item.href !== "/dashboard");
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.name);
    const filteredChildren = filterChildren(item.children);
    const colors = parentName ? getSectionColor(parentName) : getSectionColor(item.name);

    // Sección principal (Técnico, Administrativo, Ventas)
    if (item.isSection) {
      return (
        <div key={item.name} className="mb-2">
          <button
            onClick={() => toggleExpand(item.name)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all",
              colors.bg, "text-white"
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4" />
              {item.name}
            </div>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          {isExpanded && filteredChildren.length > 0 && (
            <div className={cn("mt-1 space-y-0.5 border-l-2 ml-2 pl-2", colors.border)}>
              {filteredChildren.map((child) => renderNavItem(child, item.name))}
            </div>
          )}
        </div>
      );
    }

    // Item normal con hijos
    if (hasChildren && filteredChildren.length > 0) {
      return (
        <div key={item.name}>
          <button
            onClick={() => toggleExpand(item.name)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-all",
              isExpanded || filteredChildren.some((c) => pathname?.startsWith(c.href))
                ? cn(colors.activeBg, colors.text)
                : "text-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className={cn("w-4 h-4", isExpanded ? colors.text : "text-muted-foreground")} />
              {item.name}
            </div>
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
          {isExpanded && (
            <div className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
              {filteredChildren.map((child) => renderNavItem(child, parentName))}
            </div>
          )}
        </div>
      );
    }

    // Item simple (link)
    const activeColors = parentName ? getSectionColor(parentName) : { activeBg: "bg-blue-50 dark:bg-blue-950/50", text: "text-blue-700 dark:text-blue-400" };
    
    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={handleLinkClick}
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg transition-all",
          isActive
            ? cn(activeColors.activeBg, activeColors.text)
            : "text-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Icon
          className={cn(
            "w-4 h-4",
            isActive ? activeColors.text : "text-muted-foreground"
          )}
        />
        {item.name}
      </Link>
    );
  };

  return (
    <nav className="space-y-1">
      {filteredNavigation.map((item) => renderNavItem(item))}
    </nav>
  );
}
