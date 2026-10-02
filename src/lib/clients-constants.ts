// Extraido de clients-store.ts (constantes + helpers)
import type { ClientStatus } from "@/types";

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  PROSPECT: "Prospecto",
  CONTACTED: "Contactado",
  QUALIFIED: "Calificado",
  PROPOSAL: "Propuesta",
  NEGOTIATION: "Negociación",
  WON: "Ganado",
  LOST: "Perdido",
};

export const CLIENT_STATUS_VARIANTS: Record<ClientStatus, "default" | "info" | "warning" | "success" | "destructive"> = {
  PROSPECT: "default",
  CONTACTED: "info",
  QUALIFIED: "info",
  PROPOSAL: "warning",
  NEGOTIATION: "warning",
  WON: "success",
  LOST: "destructive",
};

export const CLIENT_SOURCE_LABELS: Record<string, string> = {
  REFERIDO: "Referido",
  WEB: "Web",
  REDES_SOCIALES: "Redes sociales",
  FERIA: "Feria",
  LLAMADA_FRIA: "Llamada en frío",
  OTROS: "Otros",
};
