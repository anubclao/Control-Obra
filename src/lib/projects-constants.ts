// Extraido de projects-store.ts (constantes + helpers)
import type { ProjectStatus } from "@/types";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  IN_PLANNING: "Planificación",
  IN_EXECUTION: "En ejecución",
  PAUSED: "Pausado",
  COMPLETED: "Completado",
};

export const PROJECT_STATUS_VARIANTS: Record<ProjectStatus, "info" | "success" | "warning" | "default"> = {
  IN_PLANNING: "info",
  IN_EXECUTION: "success",
  PAUSED: "warning",
  COMPLETED: "default",
};
