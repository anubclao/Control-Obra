"use client";

// filepath: src/components/documents/document-link.tsx
// Muestra el link al documento generado en SharePoint (si existe).
// Si el registro aún no tiene `generatedDocumentUrl`, no renderiza nada.
//
// Diseño: pequeño "chip" con ícono + nombre del archivo. Click abre la URL
// en una pestaña nueva. Se usa junto con <GenerateButton /> en los
// detail pages de los 6 módulos soportados.

import {
  ExternalLink,
  FileText,
  FileSpreadsheet,
  FileType,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface DocumentLinkProps {
  webUrl?: string | null;
  fileName?: string | null;
  /** tamaño: "sm" para listas, "md" para detail pages */
  size?: "sm" | "md";
  className?: string;
  label?: string;
}

function pickIcon(name: string | null | undefined) {
  if (!name) return FileText;
  const lower = name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return FileSpreadsheet;
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) return FileType;
  return FileText;
}

export function DocumentLink({
  webUrl,
  fileName,
  size = "md",
  className,
  label = "Documento generado",
}: DocumentLinkProps) {
  if (!webUrl) return null;
  const Icon = pickIcon(fileName);
  const display = fileName ?? label;

  return (
    <a
      href={webUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="document-link"
      data-url={webUrl}
      data-filename={fileName ?? ""}
      className={cn(
        "group inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 transition-colors hover:bg-emerald-100 hover:border-emerald-300",
        size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm",
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      <span className="truncate font-medium" title={display}>
        {display}
      </span>
      <ExternalLink
        className={cn(
          "opacity-60 transition-opacity group-hover:opacity-100",
          size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5",
        )}
      />
    </a>
  );
}
