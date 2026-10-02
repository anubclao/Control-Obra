"use client";

/**
 * src/components/ui/panel-state.tsx
 *
 * Bloque reutilizable para los tres estados problematicos que tenian
 * los dashboards (seccion 4.3 de la documentacion tecnica):
 *
 *   - `loading`:    skeleton con el tamano del bloque que va a
 *                    aparecer (filas de tabla o tarjetas).
 *   - `error`:      aviso con icono, mensaje y boton "Reintentar".
 *   - `empty`:      estado vacio con icono, titulo y CTA opcional
 *                    (mismo patron que las tablas vacias).
 *
 * Asi los KPIs de los dashboards ya no muestran "$0" mientras cargan
 * ni se quedan en silencio cuando la API falla.
 */

import { AlertCircle, Inbox, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface PanelStateProps {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Numero de filas skeleton a mostrar cuando loading. Default 3. */
  skeletonRows?: number;
  /** Estado vacio: cuando se pasa, se muestra en lugar del valor. */
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyCta?: { label: string; href: string };
  className?: string;
  children?: React.ReactNode;
}

/**
 * Wrapper que envuelve cualquier bloque (tabla, lista, grid) y decide
 * si mostrar skeleton, error, estado vacio o los hijos.
 */
export function PanelState({
  loading = false,
  error = null,
  onRetry,
  skeletonRows = 3,
  isEmpty = false,
  emptyTitle = "Sin datos",
  emptyDescription,
  emptyIcon: EmptyIcon = Inbox,
  emptyCta,
  className,
  children,
}: PanelStateProps) {
  if (loading) {
    return (
      <div className={cn("space-y-2", className)} data-testid="panel-loading">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div
        className={cn(
          "rounded-lg border border-destructive/40 bg-destructive/5 p-6",
          className,
        )}
        data-testid="panel-error"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">No pudimos cargar esto</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>
            {onRetry ? (
              <Button
                onClick={onRetry}
                size="sm"
                variant="outline"
                className="mt-3"
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Reintentar
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed p-8 text-center",
          className,
        )}
        data-testid="panel-empty"
      >
        <EmptyIcon className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">{emptyTitle}</p>
        {emptyDescription ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {emptyDescription}
          </p>
        ) : null}
        {emptyCta ? (
          <Button asChild className="mt-4" size="sm">
            <Link href={emptyCta.href}>{emptyCta.label}</Link>
          </Button>
        ) : null}
      </div>
    );
  }
  return <>{children}</>;
}
