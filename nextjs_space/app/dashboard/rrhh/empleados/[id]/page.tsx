import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ROLES_CAN_VIEW_HR, REQUIRED_EMPLOYEE_DOCUMENTS, EXPIRABLE_EMPLOYEE_DOCUMENTS } from '@/lib/constants';
import EmpleadoDetails from './_components/empleado-details';
import { calculateDaysUntil } from '@/lib/format';

export const dynamic = 'force-dynamic';

type UserRole = keyof typeof import('@/lib/constants').USER_ROLE;

export default async function EmpleadoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect('/login');
  }

  const userRole = session.user.role as UserRole;
  if (!ROLES_CAN_VIEW_HR.includes(userRole as (typeof ROLES_CAN_VIEW_HR)[number])) {
    redirect('/dashboard');
  }

  const { id } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true
        }
      },
      documents: {
        orderBy: {
          uploadedAt: 'desc'
        }
      }
    }
  });

  if (!employee) {
    notFound();
  }

  // Calcular alertas de documentos
  const documentAlerts: {
    missing: string[];
    expired: { type: string; daysAgo: number }[];
    expiringSoon: { type: string; daysLeft: number }[];
  } = {
    missing: [],
    expired: [],
    expiringSoon: []
  };

  // Documentos faltantes
  const uploadedTypes = employee.documents.map(d => d.type);
  REQUIRED_EMPLOYEE_DOCUMENTS.forEach(docType => {
    if (!uploadedTypes.includes(docType)) {
      documentAlerts.missing.push(docType);
    }
  });

  // Documentos vencidos o por vencer
  employee.documents.forEach(doc => {
    if (doc.expirationDate) {
      const daysUntil = calculateDaysUntil(doc.expirationDate);
      if (daysUntil < 0) {
        documentAlerts.expired.push({
          type: doc.type,
          daysAgo: Math.abs(daysUntil)
        });
      } else if (daysUntil <= 30) {
        documentAlerts.expiringSoon.push({
          type: doc.type,
          daysLeft: daysUntil
        });
      }
    }
  });

  return (
    <EmpleadoDetails 
      employee={employee} 
      documentAlerts={documentAlerts} 
      userRole={userRole} 
    />
  );
}
