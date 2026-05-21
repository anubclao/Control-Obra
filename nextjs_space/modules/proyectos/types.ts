import { Project, ProjectStatus, CostCenter, ProjectAssignment, UserRole } from "@prisma/client";

export type { ProjectStatus };

export interface ProjectWithStats extends Project {
  costCenters: CostCenter[];
  assignments: (ProjectAssignment & { user: { id: string; name: string; email: string; role: UserRole } })[];
  _count: {
    workCuts: number;
    workLogs: number;
    contracts: number;
    paymentRequests: number;
  };
  budget?: {
    totalPC: number;
    totalPT: number;
  } | null;
}

export interface ProjectSummary {
  id: string;
  code: string | null;
  name: string;
  client: string;
  location: string | null;
  status: ProjectStatus;
  startDate: Date;
  estimatedEndDate: Date;
  totalBudget: number;
}

export interface CreateProjectInput {
  name: string;
  client: string;
  location?: string;
  startDate: string;
  estimatedEndDate: string;
  totalBudget: number;
  description?: string;
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  status?: ProjectStatus;
}
