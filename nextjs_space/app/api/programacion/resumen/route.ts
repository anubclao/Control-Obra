import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { ROLES_CAN_VIEW_PROGRESS } from '@/lib/constants';

type UserRole = keyof typeof import('@/lib/constants').USER_ROLE;

// GET - Obtener resumen de avance por proyecto
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!ROLES_CAN_VIEW_PROGRESS.includes(userRole as (typeof ROLES_CAN_VIEW_PROGRESS)[number])) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId es requerido' }, { status: 400 });
    }

    // Obtener todos los ítems del presupuesto con sus avances
    const budgetItems = await prisma.budgetItem.findMany({
      where: {
        layer: {
          budget: {
            projectId
          }
        }
      },
      include: {
        layer: true,
        progressEntries: {
          select: {
            quantityToday: true
          }
        }
      }
    });

    // Calcular resumen por ítem
    const itemsSummary = budgetItems.map(item => {
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
        remaining: item.quantity - totalExecuted,
        progressPercentage: Math.min(progressPercentage, 100),
        layerCode: item.layer.code,
        layerName: item.layer.name
      };
    });

    // Calcular resumen general
    const totalItems = itemsSummary.length;
    const completedItems = itemsSummary.filter(i => i.progressPercentage >= 100).length;
    const inProgressItems = itemsSummary.filter(i => i.progressPercentage > 0 && i.progressPercentage < 100).length;
    const pendingItems = itemsSummary.filter(i => i.progressPercentage === 0).length;

    // Avance general ponderado por valor
    let totalValuePC = 0;
    let executedValuePC = 0;

    for (const item of budgetItems) {
      const budgetItem = budgetItems.find(b => b.id === item.id);
      if (budgetItem) {
        totalValuePC += budgetItem.totalPC;
        const executed = item.progressEntries.reduce((sum, e) => sum + e.quantityToday, 0);
        const executedPercentage = budgetItem.quantity > 0 ? executed / budgetItem.quantity : 0;
        executedValuePC += budgetItem.totalPC * Math.min(executedPercentage, 1);
      }
    }

    const overallProgress = totalValuePC > 0 ? (executedValuePC / totalValuePC) * 100 : 0;

    // Resumen por capa
    const layersSummary: Record<string, { code: string; name: string; items: number; avgProgress: number }> = {};
    itemsSummary.forEach(item => {
      if (!layersSummary[item.layerCode]) {
        layersSummary[item.layerCode] = {
          code: item.layerCode,
          name: item.layerName,
          items: 0,
          avgProgress: 0
        };
      }
      layersSummary[item.layerCode].items++;
      layersSummary[item.layerCode].avgProgress += item.progressPercentage;
    });

    // Calcular promedio de avance por capa
    Object.values(layersSummary).forEach(layer => {
      layer.avgProgress = layer.items > 0 ? layer.avgProgress / layer.items : 0;
    });

    return NextResponse.json({
      overview: {
        totalItems,
        completedItems,
        inProgressItems,
        pendingItems,
        overallProgress: Math.round(overallProgress * 100) / 100
      },
      byLayer: Object.values(layersSummary),
      items: itemsSummary
    });
  } catch (error) {
    console.error('Error fetching progress summary:', error);
    return NextResponse.json(
      { error: 'Error al obtener resumen de avance' },
      { status: 500 }
    );
  }
}
