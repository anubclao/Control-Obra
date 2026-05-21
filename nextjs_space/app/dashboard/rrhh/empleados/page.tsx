import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ROLES_CAN_VIEW_HR, REQUIRED_EMPLOYEE_DOCUMENTS, EXPIRABLE_EMPLOYEE_DOCUMENTS } from '@/lib/constants';
import EmpleadosClient from './_components/empleados-client';
import { calculateDaysUntil } from '@/lib/format';

export const dynamic = 'force-dynamic';

type UserRole = keyof typeof import('@/lib/constants').USER_ROLE;

export default async function EmpleadosPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect('/login');
  }

  const userRole = session.user.role as UserRole;
  if (!ROLES_CAN_VIEW_HR.includes(userRole as (typeof ROLES_CAN_VIEW_HR)[number])) {
    redirect('/dashboard');
  }

  const employees = await prisma.employee.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      },
      documents: true
    },
    orderBy: {
      employeeNumber: 'asc'
    }
  });

  // Calcular alertas para cada empleado
  const employeesWithAlerts = employees.map(employee => {
    const alerts: { type: 'missing' | 'expired' | 'expiring'; message: string; documentType?: string }[] = [];
    
    // Verificar documentos faltantes
    const uploadedTypes = employee.documents.map(d => d.type);
    REQUIRED_EMPLOYEE_DOCUMENTS.forEach(docType => {
      if (!uploadedTypes.includes(docType)) {
        alerts.push({
          type: 'missing',
          message: `Falta: ${docType}`,
          documentType: docType
        });
      }
    });

    // Verificar documentos vencidos o por vencer
    employee.documents.forEach(doc => {
      if (doc.expirationDate) {
        const daysUntil = calculateDaysUntil(doc.expirationDate);
        if (daysUntil < 0) {
          alerts.push({
            type: 'expired',
            message: `Vencido: ${doc.type}`,
            documentType: doc.type
          });
        } else if (daysUntil <= 30) {
          alerts.push({
            type: 'expiring',
            message: `Por vencer (${daysUntil} días): ${doc.type}`,
            documentType: doc.type
          });
        }
      }
    });

    return {
      ...employee,
      alerts,
      hasAlerts: alerts.length > 0
    };
  });

  // Estadísticas
  const stats = {
    total: employees.length,
    active: employees.filter(e => e.status === 'ACTIVE').length,
    withAlerts: employeesWithAlerts.filter(e => e.hasAlerts).length,
    onLeave: employees.filter(e => e.status === 'ON_LEAVE').length
  };

  return <EmpleadosClient employees={employeesWithAlerts} stats={stats} userRole={userRole} />;
}
