// src/lib/providers-documents/download-url.ts
//
// Helper para construir el URL del endpoint de download con auth.
// Usado por el componente <DocumentLink> para que el href apunte al
// endpoint que valida sesión + access (no al file_url directo de SharePoint).

export function getProviderDocumentDownloadUrl(
  providerId: string,
  docId: string,
): string {
  return `/api/providers/${providerId}/documents/${docId}/download`;
}
