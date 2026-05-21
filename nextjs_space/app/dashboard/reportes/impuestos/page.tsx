import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { ROLES_CAN_VIEW_FINANCIAL } from '@/lib/constants';
import { ImpuestosClient } from './_components/impuestos-client';

export const dynamic = 'force-dynamic';

type TaxWithProject = {
  projectId: string;
  id: string;
  name: string;
  rate: number;
  type: string;
  appliesTo: string;
  isActive: boolean;
  project: { id: string; name: string; code: string | null };
};

type TaxGroup = {
  project: { id: string; name: string; code: string | null };
  taxes: TaxWithProject[];
};

export default async function ImpuestosPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }

  const userRole = session.user.role;
  if (!ROLES_CAN_VIEW_FINANCIAL.includes(userRole as (typeof ROLES_CAN_VIEW_FINANCIAL)[number])) {
    redirect('/dashboard');
  }

  // Obtener todos los impuestos con sus proyectos
  const taxes = await prisma.taxConfig.findMany({
    include: {
      project: { select: { id: true, name: true, code: true } }
    },
    orderBy: [{ projectId: 'asc' }, { name: 'asc' }]
  });

  // Obtener proyectos para el selector
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' }
  });

  // Agrupar impuestos por proyecto
  const taxesByProject = taxes.reduce<Record<string, TaxGroup>>((acc, tax) => {
    const taxWithProject = tax as typeof tax & TaxWithProject;
    const projectId = tax.projectId;
    if (!acc[projectId]) {
      acc[projectId] = {
        project: taxWithProject.project,
        taxes: []
      };
    }
    acc[projectId].taxes.push(tax);
    return acc;
  }, {});

  return (
    <ImpuestosClient
      taxesByProject={Object.values(taxesByProject)}
      projects={projects}
      userRole={userRole}
    />
  );
}
