import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { ROLES_CAN_MANAGE_HR, ROLES_CAN_VIEW_HR } from '@/lib/constants';

type UserRole = keyof typeof import('@/lib/constants').USER_ROLE;

// GET - Listar todos los empleados
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!ROLES_CAN_VIEW_HR.includes(userRole as (typeof ROLES_CAN_VIEW_HR)[number])) {
      return NextResponse.json({ error: 'Sin permisos para ver RRHH' }, { status: 403 });
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

    return NextResponse.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Error al obtener empleados' },
      { status: 500 }
    );
  }
}

// POST - Crear nuevo empleado
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!ROLES_CAN_MANAGE_HR.includes(userRole as (typeof ROLES_CAN_MANAGE_HR)[number])) {
      return NextResponse.json({ error: 'Sin permisos para gestionar RRHH' }, { status: 403 });
    }

    const body = await request.json();
    const {
      position,
      department,
      contractType,
      startDate,
      endDate,
      salary,
      legalBonus,
      extraLegalBonus,
      eps,
      pensionFund,
      arl,
      riskLevel,
      bankName,
      accountType,
      accountNumber,
      userId
    } = body;

    // Validar campos requeridos
    if (!position || !department || !startDate) {
      return NextResponse.json(
        { error: 'Cargo, departamento y fecha de ingreso son requeridos' },
        { status: 400 }
      );
    }

    // Generar número de empleado
    const lastEmployee = await prisma.employee.findFirst({
      orderBy: { employeeNumber: 'desc' }
    });
    
    let nextNumber = 1;
    if (lastEmployee?.employeeNumber) {
      const match = lastEmployee.employeeNumber.match(/EMP-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    const employeeNumber = `EMP-${String(nextNumber).padStart(4, '0')}`;

    // Verificar si el usuario ya tiene un empleado asignado
    if (userId) {
      const existingEmployee = await prisma.employee.findUnique({
        where: { userId }
      });
      if (existingEmployee) {
        return NextResponse.json(
          { error: 'Este usuario ya tiene un registro de empleado' },
          { status: 400 }
        );
      }
    }

    const employee = await prisma.employee.create({
      data: {
        employeeNumber,
        position,
        department,
        contractType: contractType || 'INDEFINIDO',
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        salary: salary ? parseFloat(salary) : null,
        legalBonus: legalBonus ? parseFloat(legalBonus) : null,
        extraLegalBonus: extraLegalBonus ? parseFloat(extraLegalBonus) : null,
        eps: eps || null,
        pensionFund: pensionFund || null,
        arl: arl || null,
        riskLevel: riskLevel ? parseInt(riskLevel) : 1,
        bankName: bankName || null,
        accountType: accountType || null,
        accountNumber: accountNumber || null,
        userId: userId || null
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json(
      { error: 'Error al crear empleado' },
      { status: 500 }
    );
  }
}
