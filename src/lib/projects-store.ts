"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Project, ProjectStatus } from "@/types";
import { MOCK_PROJECTS } from "@/mocks";

interface ProjectsStore {
  projects: Project[];
  addProject: (project: Omit<Project, "id" | "code" | "executedAmount">) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  getProject: (id: string) => Project | undefined;
}

function nextProjectCode(projects: Project[]): string {
  const year = new Date().getFullYear();
  const sameYear = projects.filter((p) => p.code.startsWith(`PRY-${year}`));
  const next = sameYear.length + 1;
  return `PRY-${year}-${String(next).padStart(3, "0")}`;
}

function nextId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export const useProjectsStore = create<ProjectsStore>()(
  persist(
    (set, get) => ({
      projects: MOCK_PROJECTS,
      addProject: (data) => {
        const projects = get().projects;
        const project: Project = {
          ...data,
          id: nextId(),
          code: nextProjectCode(projects),
          executedAmount: 0,
        };
        set({ projects: [project, ...projects] });
        return project;
      },
      updateProject: (id, updates) => {
        set({
          projects: get().projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        });
      },
      deleteProject: (id) => {
        set({ projects: get().projects.filter((p) => p.id !== id) });
      },
      getProject: (id) => get().projects.find((p) => p.id === id),
    }),
    { name: "controlobra-projects" }
  )
);

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