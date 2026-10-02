"use client";

/**
 * src/components/ui/pagination-control.tsx
 *
 * Controles de paginacion (Anterior / Siguiente + indicador de
 * pagina) para los listados que ahora exponen `pagination` en su
 * store (cuts, quotations, etc.). Vive en la UI para que el cambio
 * entre paginas recargue el endpoint pasando `?page=` y `?limit=`.
 *
 * Es un control minimo: si la coleccion ya cargo y su `pagination`
 * indica que hay mas paginas, muestra los botones. El consumidor
 * decide si invocar `load({page})` o si tiene su propio fetcher.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PaginationControlProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  className?: string;
  /** Etiqueta del recurso (default "resultados"). */
  noun?: string;
}

export function PaginationControl({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  loading = false,
  className,
  noun = "resultados",
}: PaginationControlProps) {
  if (total <= limit && totalPages <= 1) return null;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      data-testid="pagination-control"
    >
      <p className="text-xs text-muted-foreground">
        {from}-{to} de {total} {noun}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev || loading}
        >
          <ChevronLeft className="mr-1 h-3.5 w-3.5" />
          Anterior
        </Button>
        <span className="text-xs text-muted-foreground">
          Pagina {page} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext || loading}
        >
          Siguiente
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
