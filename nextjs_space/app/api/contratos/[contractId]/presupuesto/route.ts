import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';

type UserRole = keyof typeof import('@/lib/constants').USER_ROLE;

export const dynamic = 'force-dynamic';

// GET - Obtener presupuesto ACTIVO del contratista (compatibilidad con UI actual)
// Retorna el presupuesto activo o el más reciente si no hay activo
export async function GET(
  request: Request,
  { params }: { params: { contractId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Buscar presupuesto activo, si no existe, obtener el más reciente
    let budget = await prisma.contractorBudget.findFirst({
      where: { 
        contractId: params.contractId,
        isActive: true
      },
      include: {
        contract: {
          select: {
            id: true,
            contractNumber: true,
            contractor: {
              select: { id: true, name: true }
            }
          }
        },
        layers: {
          include: {
            items: {
              include: {
                progressEntries: {
                  where: {
                    status: 'APPROVED',
                  },
                  select: {
                    quantityToday: true,
                    status: true,
                  },
                },
              },
            },
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    // Si no hay presupuesto activo, obtener el más reciente
    if (!budget) {
      budget = await prisma.contractorBudget.findFirst({
        where: { contractId: params.contractId },
        include: {
          contract: {
            select: {
              id: true,
              contractNumber: true,
              contractor: {
                select: { id: true, name: true }
              }
            }
          },
          layers: {
            include: {
              items: {
                include: {
                  progressEntries: {
                    where: {
                      status: 'APPROVED',
                    },
                    select: {
                      quantityToday: true,
                      status: true,
                    },
                  },
                },
              },
            },
            orderBy: { order: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!budget) {
      return NextResponse.json(
        { error: 'Presupuesto no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(budget);
  } catch (error) {
    console.error('Error fetching contractor budget:', error);
    return NextResponse.json(
      { error: 'Error al obtener presupuesto' },
      { status: 500 }
    );
  }
}

// POST - Crear presupuesto del contratista (versión múltiple)
// Desactiva versiones anteriores y activa la nueva
export async function POST(
  request: Request,
  { params }: { params: { contractId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = (session.user as any).role as UserRole;
    if (!['ADMIN', 'GERENTE', 'DIRECTOR'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Sin permisos para crear presupuesto' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      aiuPercentage,
      adminPercentage,
      imprevistoPercentage,
      utilidadPercentage,
      ivaUtilityPercentage,
      layers
    } = body;

    // Verificar que el contrato existe y está habilitado
    const contract = await prisma.contract.findUnique({
      where: { id: params.contractId },
      select: { id: true, status: true }
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contrato no encontrado' },
        { status: 404 }
      );
    }

    if (contract.status !== 'ENABLED') {
      return NextResponse.json(
        { error: 'El contrato debe estar habilitado' },
        { status: 400 }
      );
    }

    // Obtener el número de versión siguiente
    const lastBudget = await prisma.contractorBudget.findFirst({
      where: { contractId: params.contractId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true }
    });

    const nextVersionNumber = (lastBudget?.versionNumber || 0) + 1;

    // Desactivar todos los presupuestos anteriores
    await prisma.contractorBudget.updateMany({
      where: { contractId: params.contractId },
      data: { isActive: false }
    });

    // Crear presupuesto con capas e ítems
    const budget = await prisma.contractorBudget.create({
      data: {
        contractId: params.contractId,
        versionNumber: nextVersionNumber,
        isActive: true,  // El nuevo presupuesto es activo por defecto
        aiuPercentage: aiuPercentage || 18,
        adminPercentage: adminPercentage || 8,
        imprevistoPercentage: imprevistoPercentage || 5,
        utilidadPercentage: utilidadPercentage || 5,
        ivaUtilityPercentage: ivaUtilityPercentage || 19,
        layers: {
          create: layers?.map((layer: any, idx: number) => ({
            code: layer.code,
            name: layer.name,
            order: idx,
            items: {
              create: layer.items?.map((item: any, itemIdx: number) => ({
                itemNumber: item.itemNumber || `${layer.code}-${itemIdx + 1}`,
                description: item.description,
                unit: item.unit,
                quantity: item.quantity,
                unitPricePC: item.unitPricePC,
                unitPricePT: item.unitPricePT || item.unitPricePC,
                totalPC: item.quantity * item.unitPricePC,
                totalPT: item.quantity * (item.unitPricePT || item.unitPricePC)
              })) || []
            }
          })) || []
        }
      },
      include: {
        layers: {
          include: { items: true }
        }
      }
    });

    // Recalcular totales
    let totalDirectCostPC = 0;
    let totalDirectCostPT = 0;

    for (const layer of budget.layers) {
      let layerTotalPC = 0;
      let layerTotalPT = 0;

      for (const item of layer.items) {
        layerTotalPC += item.totalPC;
        layerTotalPT += item.totalPT;
      }

      totalDirectCostPC += layerTotalPC;
      totalDirectCostPT += layerTotalPT;

      await prisma.contractorBudgetLayer.update({
        where: { id: layer.id },
        data: {
          totalDirectCostPC: layerTotalPC,
          totalDirectCostPT: layerTotalPT
        }
      });
    }

    const totalAIU_PC = totalDirectCostPC * (aiuPercentage || 18) / 100;
    const totalAIU_PT = totalDirectCostPT * (aiuPercentage || 18) / 100;
    const totalIvaUtilidad_PC = (totalDirectCostPC + totalAIU_PC) * (ivaUtilityPercentage || 19) / 100;
    const totalIvaUtilidad_PT = (totalDirectCostPT + totalAIU_PT) * (ivaUtilityPercentage || 19) / 100;

    const updatedBudget = await prisma.contractorBudget.update({
      where: { id: budget.id },
      data: {
        totalDirectCostPC,
        totalDirectCostPT,
        totalAIU_PC,
        totalAIU_PT,
        totalIvaUtilidad_PC,
        totalIvaUtilidad_PT,
        totalPC: totalDirectCostPC + totalAIU_PC + totalIvaUtilidad_PC,
        totalPT: totalDirectCostPT + totalAIU_PT + totalIvaUtilidad_PT
      },
      include: {
        layers: { include: { items: true } }
      }
    });

    return NextResponse.json(
      { 
        ...updatedBudget,
        message: `Presupuesto v${nextVersionNumber} creado y activado exitosamente`
      }, 
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating contractor budget:', error);
    return NextResponse.json(
      { error: 'Error al crear presupuesto' },
      { status: 500 }
    );
  }
}
