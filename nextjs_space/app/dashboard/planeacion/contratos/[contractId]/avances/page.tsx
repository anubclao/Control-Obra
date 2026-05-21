import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ContractorProgressListClient } from "./_components/contractor-progress-list-client";

export const dynamic = "force-dynamic";

interface Props {
  params: { contractId: string };
}

export default async function ContractorProgressPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    notFound();
  }

  const contract = await prisma.contract.findUnique({
    where: { id: params.contractId },
    include: {
      project: {
        select: { id: true, name: true, code: true }
      },
      contractor: {
        select: { id: true, name: true }
      },
      budget: {
        include: {
          layers: {
            include: { items: true },
            orderBy: { order: "asc" }
          }
        }
      },
      dailyProgress: {
        orderBy: { date: "desc" },
        include: {
          createdBy: {
            select: { id: true, name: true }
          },
          entries: {
            include: {
              budgetItem: true
            }
          }
        }
      }
    }
  });

  if (!contract) {
    notFound();
  }

  // Calcular resumen de avance
  const itemsSummary = contract.budget?.layers.flatMap(layer => 
    layer.items.map(item => {
      const totalExecuted = contract.dailyProgress?.flatMap(dp => dp.entries)
        .filter(e => e.budgetItemId === item.id)
        .reduce((sum, e) => sum + e.quantityToday, 0) || 0;
      
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

  contract.budget?.layers.forEach(layer => {
    layer.items.forEach(item => {
      totalValuePC += item.totalPC;
      const executed = contract.dailyProgress?.flatMap(dp => dp.entries)
        .filter(e => e.budgetItemId === item.id)
        .reduce((sum, e) => sum + e.quantityToday, 0) || 0;
      const executedPercentage = item.quantity > 0 ? executed / item.quantity : 0;
      executedValuePC += item.totalPC * Math.min(executedPercentage, 1);
    });
  });

  const overallProgress = totalValuePC > 0 ? (executedValuePC / totalValuePC) * 100 : 0;

  return (
    <ContractorProgressListClient
      contract={contract}
      itemsSummary={itemsSummary}
      overallProgress={overallProgress}
      userRole={session.user.role as string}
    />
  );
}
