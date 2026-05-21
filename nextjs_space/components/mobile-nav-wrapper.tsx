"use client";

import { useState, useEffect } from "react";
import { DashboardNav } from "./dashboard-nav";
import { DashboardHeader } from "./dashboard-header";
import { cn } from "@/lib/utils";

interface MobileNavWrapperProps {
  user: any;
  children: React.ReactNode;
}

export function MobileNavWrapper({ user, children }: MobileNavWrapperProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <DashboardHeader 
        user={user} 
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />
      
      <div className="flex relative">
        {/* Mobile overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={closeMobileMenu}
          />
        )}

        {/* Sidebar - Desktop: static, Mobile: slide-in drawer */}
        <aside
          className={cn(
            "fixed lg:sticky top-14 sm:top-16 left-0 z-40 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] w-72 lg:w-64 bg-background border-r transform transition-transform duration-300 ease-in-out overflow-y-auto",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <div className="p-3">
            <DashboardNav user={user} onNavigate={closeMobileMenu} />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
