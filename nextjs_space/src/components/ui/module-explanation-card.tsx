"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Info, Lightbulb, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface ModuleStep {
  title: string;
  description: string;
}

export interface ModuleExplanationCardProps {
  title: string;
  description: string;
  steps: ModuleStep[];
  tips?: string[];
  warnings?: string[];
  icon?: LucideIcon;
  variant?: "info" | "guide" | "warning";
  className?: string;
  /**
   * P2 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.3):
   *   Antes la tarjeta de guia ocupaba la parte superior de cada
   *   visita sin posibilidad de cerrarla. Ahora la tarjeta arranca
   *   abierta (visible) la primera vez; el usuario puede cerrarla
   *   y la preferencia se guarda en localStorage con esta clave.
   *   Sin la clave, cada visita arranca abierta (modo por defecto).
   */
  storageKey?: string;
  /** Default: arranca abierta si no hay preferencia guardada. */
  defaultOpen?: boolean;
}

const VARIANT_CONFIG = {
  info: {
    container: "border-blue-500/40 bg-blue-50/60",
    icon: "bg-blue-500/15 text-blue-700",
    Icon: Info,
    titleColor: "text-blue-900",
  },
  guide: {
    container: "border-primary/30 bg-primary/5",
    icon: "bg-primary/10 text-primary",
    Icon: Lightbulb,
    titleColor: "text-foreground",
  },
  warning: {
    container: "border-amber-500/40 bg-amber-50/60",
    icon: "bg-amber-500/15 text-amber-700",
    Icon: AlertTriangle,
    titleColor: "text-amber-900",
  },
} as const;

const STORAGE_PREFIX = "module-explanation-card:";

function readStoredOpen(storageKey: string, defaultOpen: boolean): boolean {
  if (typeof window === "undefined") return defaultOpen;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (raw === "open") return true;
    if (raw === "closed") return false;
  } catch {
    /* SSR / Safari private mode */
  }
  return defaultOpen;
}

function writeStoredOpen(storageKey: string, open: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_PREFIX + storageKey,
      open ? "open" : "closed",
    );
  } catch {
    /* ignore */
  }
}

export function ModuleExplanationCard({
  title,
  description,
  steps,
  tips = [],
  warnings = [],
  icon,
  variant = "guide",
  className,
  storageKey,
  defaultOpen = true,
}: ModuleExplanationCardProps) {
  const cfg = VARIANT_CONFIG[variant];
  const Icon = icon ?? cfg.Icon;

  // El render inicial es consistente entre servidor y cliente (mismo
  // `defaultOpen`) para evitar hydration mismatch; el efecto siguiente
  // rehidrata desde localStorage en el cliente.
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (!storageKey) return;
    setOpen(readStoredOpen(storageKey, defaultOpen));
  }, [storageKey, defaultOpen]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (storageKey) writeStoredOpen(storageKey, next);
  };

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card className={cn("border", cfg.container, className)}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full flex-row items-start gap-3 p-6 pb-3 text-left transition-colors hover:bg-black/[0.02]"
            aria-label={open ? "Plegar guia" : "Expandir guia"}
            data-testid="module-explanation-trigger"
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                cfg.icon,
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3
                className={cn(
                  "text-base font-semibold leading-none tracking-tight",
                  cfg.titleColor,
                )}
              >
                {title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {description}
              </p>
            </div>
            <ChevronDown
              className={cn(
                "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {steps.length > 0 && (
              <ol className="space-y-2 text-sm">
                {steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        cfg.icon,
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="font-medium">{s.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {s.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {tips.length > 0 && (
              <div className="rounded-md border bg-background/60 p-3 text-sm">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  <Lightbulb className="h-3.5 w-3.5" /> Tips
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {tips.map((t, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span>•</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-50 p-3 text-sm">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5" /> Atención
                </p>
                <ul className="space-y-1 text-xs text-amber-900">
                  {warnings.map((w, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span>•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
