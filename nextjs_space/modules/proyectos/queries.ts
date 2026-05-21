import { prisma } from "@/lib/db";
import { ProjectFilterInput } from "./validations";

const projectInclude = {
  costCenters: true,
  assignments: {
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  },
  budget: {
    select: { totalPC: true, totalPT: true },
  },
  _count: {
    select: { workCuts: true, workLogs: true, contracts: true, paymentRequests: true },
  },
} as const;

export async function findProjectById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: projectInclude,
  });
}

export async function findManyProjects(filters: ProjectFilterInput, userId?: string, userRole?: string) {
  const { status, search, page, limit } = filters;
  const skip = (page - 1) * limit;

  const where = {
    ...(status && { status }),
    ...(search && {
      OR: [
        { name: { contains: search } },
        { client: { contains: search } },
        { code: { contains: search } },
      ],
    }),
    // CLIENTE solo ve sus proyectos asignados
    ...(userRole === "CLIENTE" && userId && {
      assignments: { some: { userId } },
    }),
  };

  const [projects, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      include: projectInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.project.count({ where }),
  ]);

  return { projects, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function createProject(data: {
  name: string;
  client: string;
  location?: string;
  startDate: Date;
  estimatedEndDate: Date;
  totalBudget: number;
  description?: string;
  code: string;
  createdById: string;
}) {
  return prisma.project.create({ data, include: projectInclude });
}

export async function updateProject(id: string, data: Parameters<typeof prisma.project.update>[0]["data"]) {
  return prisma.project.update({ where: { id }, data, include: projectInclude });
}

export async function getNextProjectCode(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.project.count();
  return `PRY-${year}-${String(count + 1).padStart(3, "0")}`;
}
