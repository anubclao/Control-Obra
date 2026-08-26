"use client";

import { Info, Lightbulb, Target, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

export function ModuleExplanationCard({
  title,
  description,
  steps,
  tips = [],
  warnings = [],
  icon,
  variant = "guide",
  className,
}: ModuleExplanationCardProps) {
  const cfg = VARIANT_CONFIG[variant];
  const Icon = icon ?? cfg.Icon;

  return (
    <Card className={cn("border", cfg.container, className)}>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", cfg.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className={cn("text-base", cfg.titleColor)}>{title}</CardTitle>
          <CardDescription className="mt-1">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
    </Card>
  );
}
