"use client";

/**
 * src/components/ui/kpi-card.tsx
 *
 * Tarjeta KPI reutilizable para los tres dashboards (tecnico,
 * administrativo, ventas). Pensada para centralizar el patron
 * "loading -> $0 -> error" que estaba duplicado en cada dashboard y
 * que confundia al usuario entre "cargando" y "sin datos".
 *
 * Tres estados:
 *   - `loading`:    muestra un Skeleton en lugar del valor.
 *   - `error`:      muestra el icono de alerta + boton "Reintentar".
 *   - `isEmpty`:    cuando se pasa, muestra estado vacio con CTA
 *                    opcional (mismo patron que las tablas vacias).
 *   - normal:      valor + subtitulo, igual que antes.
 *
 * El subtitulo se oculta mientras esta cargando o hay error (seria
 * ruido visual).
 */

import { AlertCircle, RefreshCw, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  title: string;
  icon: LucideIcon;
  /** Valor formateado listo para mostrar (ej. "$1.250.000" o "12"). */
  value: string | number;
  /** Texto pequeno debajo del valor (ej. "de $5.000.000"). */
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  /** Si se pasa, se muestra estado vacio con CTA (no se renderiza el valor). */
  isEmpty?: { title: string; cta?: { label: string; href: string } };
  onRetry?: () => void;
  className?: string;
}

export function KpiCard({
  title,
  icon: Icon,
  value,
  subtitle,
  loading = false,
  error = null,
  isEmpty,
  onRetry,
  className,
}: KpiCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2" data-testid="kpi-loading">
            <Skeleton className="h-7 w-2/3" />
            {subtitle ? <Skeleton className="h-3 w-1/2" /> : null}
          </div>
        ) : error ? (
          <div
            className="flex flex-col items-start gap-2"
            data-testid="kpi-error"
          >
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="line-clamp-2">{error}</span>
            </div>
            {onRetry ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className="h-7 px-2 text-xs"
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Reintentar
              </Button>
            ) : null}
          </div>
        ) : isEmpty ? (
          <div className="space-y-1" data-testid="kpi-empty">
            <p className="text-sm font-medium">{isEmpty.title}</p>
            {isEmpty.cta ? (
              <Button asChild size="sm" variant="link" className="h-auto p-0">
                <a href={isEmpty.cta.href}>{isEmpty.cta.label}</a>
              </Button>
            ) : null}
          </div>
        ) : (
          <div data-testid="kpi-value">
            <div className="text-2xl font-semibold">{value}</div>
            {subtitle ? (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Variante compacta para listados (sin CardHeader con icono grande).
 * Se usa en cortes y cotizaciones para mantener el grid de 4-6 KPI.
 */
export interface KpiMiniProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Color de Tailwind para el icono. Default = muted-foreground. */
  color?: string;
  loading?: boolean;
}

export function KpiMini({
  label,
  value,
  icon: Icon,
  color = "text-muted-foreground",
  loading = false,
}: KpiMiniProps) {
  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-3">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="mt-2 h-5 w-12" />
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", color)} />
        {label}
      </div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
