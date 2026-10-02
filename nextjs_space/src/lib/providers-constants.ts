// Extraido de providers-store.ts (constantes + helpers)
import type { PersonType, ProviderDocumentType, ProviderStatus } from "@/types";

export const REQUIRED_DOCS_BY_PERSON_TYPE: Record<
  PersonType,
  ProviderDocumentType[]
> = {
  NATURAL: ["CEDULA", "RUT", "CERTIFICADO_BANCARIO"],
  JURIDICA: ["CEDULA", "RUT", "CERTIFICADO_BANCARIO", "CAMARA_COMERCIO"],
};

export const PROVIDER_STATUS_LABELS: Record<ProviderStatus, string> = {
  COMPLETE: "Habilitado",
  INCOMPLETE: "Incompleto",
  EXPIRED: "Docs vencidos",
};

export const PROVIDER_STATUS_VARIANTS: Record<
  ProviderStatus,
  "success" | "warning" | "destructive"
> = {
  COMPLETE: "success",
  INCOMPLETE: "warning",
  EXPIRED: "destructive",
};

export const DOCUMENT_TYPE_LABELS: Record<ProviderDocumentType, string> = {
  CEDULA: "Cédula de Ciudadanía",
  RUT: "RUT",
  CAMARA_COMERCIO: "Cámara de Comercio",
  CERTIFICADO_BANCARIO: "Certificado Bancario",
  CERTIFICACIONES_COMERCIALES: "Certificaciones Comerciales",
  OTROS: "Otros",
};

export const PERSON_TYPE_LABELS: Record<PersonType, string> = {
  NATURAL: "Persona Natural",
  JURIDICA: "Persona Jurídica",
};

export const CATEGORY_LABELS: Record<"PRODUCTO" | "SERVICIO", string> = {
  PRODUCTO: "Producto",
  SERVICIO: "Servicio",
};

export function requiredDocsFor(
  personType: PersonType,
): ProviderDocumentType[] {
  return REQUIRED_DOCS_BY_PERSON_TYPE[personType];
}
