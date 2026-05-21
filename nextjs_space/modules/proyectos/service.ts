import { CreateProjectInput, UpdateProjectInput, ProjectFilterInput } from "./validations";
import { createProject, findProjectById, findManyProjects, updateProject, getNextProjectCode } from "./queries";

export async function getProjects(filters: ProjectFilterInput, userId?: string, userRole?: string) {
  return findManyProjects(filters, userId, userRole);
}

export async function getProjectById(id: string) {
  const project = await findProjectById(id);
  if (!project) throw new Error("Proyecto no encontrado");
  return project;
}

export async function createNewProject(input: CreateProjectInput, createdById: string) {
  const code = await getNextProjectCode();
  return createProject({
    name: input.name,
    client: input.client,
    location: input.location,
    startDate: new Date(input.startDate),
    estimatedEndDate: new Date(input.estimatedEndDate),
    totalBudget: input.totalBudget,
    description: input.description,
    code,
    createdById,
  });
}

export async function updateExistingProject(id: string, input: UpdateProjectInput) {
  await getProjectById(id); // verifica que existe
  return updateProject(id, {
    ...(input.name && { name: input.name }),
    ...(input.client && { client: input.client }),
    ...(input.location !== undefined && { location: input.location }),
    ...(input.startDate && { startDate: new Date(input.startDate) }),
    ...(input.estimatedEndDate && { estimatedEndDate: new Date(input.estimatedEndDate) }),
    ...(input.totalBudget !== undefined && { totalBudget: input.totalBudget }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.status && { status: input.status }),
  });
}
