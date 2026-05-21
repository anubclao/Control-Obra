import { getServerSession } from 'next-auth';
import { redirect, notFound } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { ROLES_CAN_VIEW_FINANCIAL } from '@/lib/constants';
import { PagoDetailClient } from './_components/pago-detail-client';

export const dynamic = 'force-dynamic';

interface PagoDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PagoDetailPage({ params }: PagoDetailPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }

  const userRole = session.user.role;
  if (!ROLES_CAN_VIEW_FINANCIAL.includes(userRole as (typeof ROLES_CAN_VIEW_FINANCIAL)[number])) {
    redirect('/dashboard');
  }

  const { id } = await params;

  // Obtener el pago con todas las relaciones
  const payment = await prisma.paymentRequest.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true, code: true, client: true } },
      contractor: { select: { id: true, name: true, nit: true, email: true, phone: true } },
      workCut: {
        select: {
          id: true,
          cutNumber: true,
          requestedAmount: true,
          periodStart: true,
          periodEnd: true
        }
      },
      contract: {
        select: {
          id: true,
          contractNumber: true,
          contractValue: true,
          contractType: true
        }
      },
      createdBy: { select: { id: true, name: true, email: true, role: true } },
      approvals: {
        include: {
          approver: { select: { id: true, name: true, email: true, role: true } }
        },
        orderBy: { createdAt: 'asc' }
      },
      documents: true
    }
  });

  if (!payment) {
    notFound();
  }

  // Obtener el usuario actual para verificar permisos
  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true, name: true, email: true, role: true }
  });

  if (!currentUser) {
    redirect('/login');
  }

  return (
    <PagoDetailClient
      payment={payment}
      userRole={userRole}
      currentUser={currentUser}
    />
  );
}
