// Mock data para desarrollo sin BD (Fase 1)
// Cada dominio en su propio archivo para facilitar la navegación y refactors.
//
// Re-exports para mantener compatibilidad con imports existentes
// (import { MOCK_PROJECTS } from "@/mocks"; sigue funcionando).
export * from "./projects";
export * from "./work-cuts";
export * from "./clients";
export * from "./quotations";
export * from "./payments";
export * from "./providers";
export * from "./work-logs";
export * from "./budgets";
export * from "./aiu";
export * from "./contracts";
export * from "./taxes";
export * from "./employees";
export * from "./invitations";
export * from "./psc";
export * from "./expenses";

// Helper deprecado — usar useDashboardStats() desde @/lib/dashboard-stats
export { getDashboardStats } from "./_deprecated/dashboard-stats";
