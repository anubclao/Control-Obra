import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { ROLES_CAN_VIEW_FINANCIAL } from '@/lib/constants';
import { PagosClient } from './_components/pagos-client';

export const dynamic = 'force-dynamic';

export default async function PagosPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }

  const userRole = session.user.role;
  if (!ROLES_CAN_VIEW_FINANCIAL.includes(userRole as (typeof ROLES_CAN_VIEW_FINANCIAL)[number])) {
    redirect('/dashboard');
  }

  // Obtener todas las solicitudes de pago con relaciones
  const payments = await prisma.paymentRequest.findMany({
    include: {
      project: { select: { id: true, name: true, code: true } },
      contractor: { select: { id: true, name: true, nit: true } },
      workCut: { select: { id: true, cutNumber: true } },
      contract: { select: { id: true, contractNumber: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      approvals: {
        include: {
          approver: { select: { id: true, name: true, email: true, role: true } }
        },
        orderBy: { createdAt: 'asc' }
      },
      _count: { select: { documents: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Obtener proyectos para el filtro
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' }
  });

  // Obtener subcontratistas para el formulario
  const contractors = await prisma.contractor.findMany({
    select: { id: true, name: true, nit: true },
    orderBy: { name: 'asc' }
  });

  // Estadísticas
  type PaymentWithRelations = typeof payments[number];
  const stats = {
    total: payments.length,
    pending: payments.filter((p: PaymentWithRelations) => ['PENDING', 'APPROVED_LEVEL_1', 'APPROVED_LEVEL_2'].includes(p.status)).length,
    approved: payments.filter((p: PaymentWithRelations) => p.status === 'APPROVED').length,
    paid: payments.filter((p: PaymentWithRelations) => p.status === 'PAID').length,
    rejected: payments.filter((p: PaymentWithRelations) => p.status === 'REJECTED').length,
    totalAmount: payments.reduce((sum: number, p: PaymentWithRelations) => sum + p.amount, 0),
    pendingAmount: payments
      .filter((p: PaymentWithRelations) => ['PENDING', 'APPROVED_LEVEL_1', 'APPROVED_LEVEL_2', 'APPROVED'].includes(p.status))
      .reduce((sum: number, p: PaymentWithRelations) => sum + p.amount, 0),
    paidAmount: payments.filter((p: PaymentWithRelations) => p.status === 'PAID').reduce((sum: number, p: PaymentWithRelations) => sum + p.amount, 0)
  };

  return (
    <PagosClient
      payments={payments}
      projects={projects}
      contractors={contractors}
      stats={stats}
      userRole={userRole}
    />
  );
}
