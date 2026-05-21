"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut, Building2, User, Menu, X } from "lucide-react";
import { USER_ROLE } from "@/lib/constants";
import { ThemeToggle } from "@/components/theme-toggle";

type UserRoleKey = keyof typeof USER_ROLE;

interface DashboardHeaderProps {
  user: any;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
}

export function DashboardHeader({ user, isMobileMenuOpen, onToggleMobileMenu }: DashboardHeaderProps) {
  const userRole =
    user?.accessRoleName ||
    USER_ROLE[user?.role as UserRoleKey] ||
    USER_ROLE.USER;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background shadow-sm">
      <div className="max-w-full px-3 sm:px-6 lg:px-8">
        <div className="flex h-14 sm:h-16 items-center justify-between">
          {/* Mobile menu button + Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            {onToggleMobileMenu && (
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-9 w-9"
                onClick={onToggleMobileMenu}
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            )}
            <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-lg">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-foreground">Control de Obra</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Sistema de Gestión</p>
            </div>
          </div>

          {/* User info + Theme toggle + Logout */}
          <div className="flex items-center gap-1 sm:gap-3">
            {/* User info - hide on very small screens */}
            <div className="hidden xs:flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-muted rounded-lg">
              <User className="w-4 h-4 text-muted-foreground hidden sm:block" />
              <div className="text-xs sm:text-sm">
                <p className="font-medium text-foreground truncate max-w-[80px] sm:max-w-none">{user?.name}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">{userRole}</p>
              </div>
            </div>

            <ThemeToggle />
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
