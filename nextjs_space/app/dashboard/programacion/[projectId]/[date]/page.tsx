import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ROLES_CAN_VIEW_PROGRESS } from '@/lib/constants';
import ProgressDetailClient from './_components/progress-detail-client';

export const dynamic = 'force-dynamic';

type UserRole = keyof typeof import('@/lib/constants').USER_ROLE;

export default async function ProgressDetailPage({ 
  params 
}: { 
  params: Promise<{ projectId: string; date: string }> 
}) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect('/login');
  }

  const userRole = session.user.role as UserRole;
  if (!ROLES_CAN_VIEW_PROGRESS.includes(userRole as (typeof ROLES_CAN_VIEW_PROGRESS)[number])) {
    redirect('/dashboard');
  }

  const { projectId, date: progressId } = await params;

  // Obtener el registro de avance
  const dailyProgress = await prisma.dailyProgress.findUnique({
    where: { id: progressId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          code: true,
          client: true
        }
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      entries: {
        include: {
          budgetItem: {
            include: {
              layer: true
            }
          },
          contractor: {
            select: {
              id: true,
              name: true
            }
          },
          approvedBy: {
            select: {
              name: true
            }
          }
        }
      },
      photos: true
    }
  });

  if (!dailyProgress || dailyProgress.projectId !== projectId) {
    notFound();
  }

  const projectContractors = await prisma.contract.findMany({
    where: { projectId },
    select: {
      contractor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const contractors = projectContractors
    .map((item) => item.contractor)
    .filter((contractor) => Boolean(contractor?.id));

  return (
    <ProgressDetailClient
      dailyProgress={dailyProgress}
      userRole={userRole}
      contractors={contractors}
    />
  );
}
