import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ROLES_CAN_VIEW_PROGRESS, ROLES_CAN_CREATE_PROGRESS } from '@/lib/constants';
import ProjectProgressClient from './_components/project-progress-client';

export const dynamic = 'force-dynamic';

type UserRole = keyof typeof import('@/lib/constants').USER_ROLE;

export default async function ProjectProgressPage({ params }: { params: Promise<{ projectId: string }> }) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect('/login');
  }

  const userRole = session.user.role as UserRole;
  if (!ROLES_CAN_VIEW_PROGRESS.includes(userRole as (typeof ROLES_CAN_VIEW_PROGRESS)[number])) {
    redirect('/dashboard');
  }

  const { projectId } = await params;

  // Obtener proyecto con presupuesto y avances
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      budget: {
        include: {
          layers: {
            include: {
              items: {
                include: {
                  progressEntries: {
                    select: {
                      quantityToday: true
                    }
                  }
                }
              }
            },
            orderBy: {
              order: 'asc'
            }
          }
        }
      },
      dailyProgress: {
        orderBy: {
          date: 'desc'
        },
        include: {
          createdBy: {
            select: {
              name: true
            }
          },
          entries: true
        }
      },
      contracts: {
        include: {
          contractor: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  });

  if (!project) {
    notFound();
  }

  // Calcular resumen de avance
  const itemsSummary = project.budget?.layers.flatMap(layer => 
    layer.items.map(item => {
      const totalExecuted = item.progressEntries.reduce(
        (sum, entry) => sum + entry.quantityToday, 
        0
      );
      const progressPercentage = item.quantity > 0 
        ? (totalExecuted / item.quantity) * 100 
        : 0;

      return {
        id: item.id,
        itemNumber: item.itemNumber,
        description: item.description,
        unit: item.unit,
        totalQuantity: item.quantity,
        totalExecuted,
        remaining: Math.max(0, item.quantity - totalExecuted),
        progressPercentage: Math.min(progressPercentage, 100),
        layerCode: layer.code,
        layerName: layer.name
      };
    })
  ) || [];

  // Calcular avance general
  let totalValuePC = 0;
  let executedValuePC = 0;

  project.budget?.layers.forEach(layer => {
    layer.items.forEach(item => {
      totalValuePC += item.totalPC;
      const executed = item.progressEntries.reduce((sum, e) => sum + e.quantityToday, 0);
      const executedPercentage = item.quantity > 0 ? executed / item.quantity : 0;
      executedValuePC += item.totalPC * Math.min(executedPercentage, 1);
    });
  });

  const overallProgress = totalValuePC > 0 ? (executedValuePC / totalValuePC) * 100 : 0;

  const canCreateProgress = ROLES_CAN_CREATE_PROGRESS.includes(userRole as (typeof ROLES_CAN_CREATE_PROGRESS)[number]);

  // Obtener subcontratistas disponibles
  const contractors = project.contracts.map(c => c.contractor);

  return (
    <ProjectProgressClient 
      project={project}
      itemsSummary={itemsSummary}
      overallProgress={overallProgress}
      canCreateProgress={canCreateProgress}
      contractors={contractors}
    />
  );
}
