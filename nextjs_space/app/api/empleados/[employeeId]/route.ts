import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { ROLES_CAN_MANAGE_HR, ROLES_CAN_VIEW_HR } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type UserRole = keyof typeof import('@/lib/constants').USER_ROLE;

// GET - Obtener un empleado por ID
export async function GET(
  request: Request,
  { params }: { params: { employeeId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!ROLES_CAN_VIEW_HR.includes(userRole as (typeof ROLES_CAN_VIEW_HR)[number])) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { employeeId } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
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
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    return NextResponse.json(
      { error: 'Error al obtener empleado' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar empleado
export async function PUT(
  request: Request,
  { params }: { params: { employeeId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!ROLES_CAN_MANAGE_HR.includes(userRole as (typeof ROLES_CAN_MANAGE_HR)[number])) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { employeeId } = await params;
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
      status,
      userId
    } = body;

    // Verificar que el empleado existe
    const existingEmployee = await prisma.employee.findUnique({
      where: { id: employeeId }
    });

    if (!existingEmployee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Verificar si se intenta vincular a un usuario que ya tiene empleado
    if (userId && userId !== existingEmployee.userId) {
      const userWithEmployee = await prisma.employee.findUnique({
        where: { userId }
      });
      if (userWithEmployee) {
        return NextResponse.json(
          { error: 'Este usuario ya tiene un registro de empleado' },
          { status: 400 }
        );
      }
    }

    const employee = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        position: position || existingEmployee.position,
        department: department || existingEmployee.department,
        contractType: contractType || existingEmployee.contractType,
        startDate: startDate ? new Date(startDate) : existingEmployee.startDate,
        endDate: endDate ? new Date(endDate) : endDate === null ? null : existingEmployee.endDate,
        salary: salary !== undefined ? (salary ? parseFloat(salary) : null) : existingEmployee.salary,
        legalBonus: legalBonus !== undefined ? (legalBonus ? parseFloat(legalBonus) : null) : existingEmployee.legalBonus,
        extraLegalBonus: extraLegalBonus !== undefined ? (extraLegalBonus ? parseFloat(extraLegalBonus) : null) : existingEmployee.extraLegalBonus,
        eps: eps !== undefined ? eps : existingEmployee.eps,
        pensionFund: pensionFund !== undefined ? pensionFund : existingEmployee.pensionFund,
        arl: arl !== undefined ? arl : existingEmployee.arl,
        riskLevel: riskLevel !== undefined ? parseInt(riskLevel) : existingEmployee.riskLevel,
        bankName: bankName !== undefined ? bankName : existingEmployee.bankName,
        accountType: accountType !== undefined ? accountType : existingEmployee.accountType,
        accountNumber: accountNumber !== undefined ? accountNumber : existingEmployee.accountNumber,
        status: status || existingEmployee.status,
        userId: userId !== undefined ? userId : existingEmployee.userId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        documents: true
      }
    });

    return NextResponse.json(employee);
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json(
      { error: 'Error al actualizar empleado' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar empleado
export async function DELETE(
  request: Request,
  { params }: { params: { employeeId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!ROLES_CAN_MANAGE_HR.includes(userRole as (typeof ROLES_CAN_MANAGE_HR)[number])) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { employeeId } = await params;

    await prisma.employee.delete({
      where: { id: employeeId }
    });

    return NextResponse.json({ message: 'Empleado eliminado' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    return NextResponse.json(
      { error: 'Error al eliminar empleado' },
      { status: 500 }
    );
  }
}
