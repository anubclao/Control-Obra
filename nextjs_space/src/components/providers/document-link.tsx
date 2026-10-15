"use client";

// src/components/providers/document-link.tsx
//
// Componente que renderiza un link al endpoint de download con auth.
// NO usa la URL de SharePoint directa (que sería un link público).
// Usa el endpoint que valida sesión + access + redirige via 302.

import { FileText, Download } from "lucide-react";
import { getProviderDocumentDownloadUrl } from "@/lib/providers-documents/download-url";

export interface DocumentLinkProps {
  providerId: string;
  docId: string;
  /** Texto a mostrar (default: fileName). */
  label?: string;
  /** Mostrar/ocultar el icono de download. Default: true. */
  showIcon?: boolean;
  /** className para el <a>. */
  className?: string;
}

/**
 * Link de descarga con auth. Se abre en nueva tab.
 * El endpoint de download valida que el user tenga acceso al provider
 * y luego hace 302 redirect al link de SharePoint.
 */
export function DocumentLink({
  providerId,
  docId,
  label,
  showIcon = true,
  className = "inline-flex items-center gap-1.5 text-sm text-primary hover:underline",
}: DocumentLinkProps) {
  const href = getProviderDocumentDownloadUrl(providerId, docId);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {showIcon && <FileText className="h-3.5 w-3.5" />}
      <Download className="h-3 w-3" />
      {label ?? "Descargar"}
    </a>
  );
}
