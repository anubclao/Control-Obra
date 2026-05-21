import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ROLES_CAN_VIEW_PROGRESS } from '@/lib/constants';
import ProgramacionClient from './_components/programacion-client';

export const dynamic = 'force-dynamic';

type UserRole = keyof typeof import('@/lib/constants').USER_ROLE;

export default async function ProgramacionPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect('/login');
  }

  const userRole = session.user.role as UserRole;
  if (!ROLES_CAN_VIEW_PROGRESS.includes(userRole as (typeof ROLES_CAN_VIEW_PROGRESS)[number])) {
    redirect('/dashboard');
  }

  // Obtener proyectos con presupuesto
  const projects = await prisma.project.findMany({
    where: {
      budget: {
        isNot: null
      }
    },
    include: {
      budget: {
        select: {
          id: true,
          totalPC: true,
          totalPT: true
        }
      },
      dailyProgress: {
        orderBy: {
          date: 'desc'
        },
        take: 5,
        include: {
          entries: true
        }
      }
    },
    orderBy: {
      name: 'asc'
    }
  });

  return <ProgramacionClient projects={projects} userRole={userRole} />;
}
