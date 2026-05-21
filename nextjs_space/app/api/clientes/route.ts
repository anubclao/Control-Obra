import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { ROLES_CAN_VIEW_SALES, ROLES_CAN_MANAGE_SALES } from '@/lib/constants';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role as string;
    if (!ROLES_CAN_VIEW_SALES.includes(userRole as typeof ROLES_CAN_VIEW_SALES[number])) {
      return NextResponse.json({ error: 'Sin permisos para ver clientes' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    
    if (status) {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { nit: { contains: search, mode: 'insensitive' } }
      ];
    }

    const clients = await prisma.client.findMany({
      where,
      include: {
        _count: {
          select: { quotations: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role as string;
    if (!ROLES_CAN_MANAGE_SALES.includes(userRole as typeof ROLES_CAN_MANAGE_SALES[number])) {
      return NextResponse.json({ error: 'Sin permisos para crear clientes' }, { status: 403 });
    }

    const body = await request.json();
    const { companyName, nit, contactName, contactPosition, email, phone, address, city, sector, source, notes } = body;

    if (!companyName || !contactName || !email || !phone) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // Generate client number
    const lastClient = await prisma.client.findFirst({
      orderBy: { clientNumber: 'desc' }
    });
    
    let nextNumber = 1;
    if (lastClient?.clientNumber) {
      const match = lastClient.clientNumber.match(/CLI-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    const clientNumber = `CLI-${nextNumber.toString().padStart(4, '0')}`;

    // Check if NIT already exists
    if (nit) {
      const existingClient = await prisma.client.findUnique({ where: { nit } });
      if (existingClient) {
        return NextResponse.json({ error: 'Ya existe un cliente con este NIT' }, { status: 400 });
      }
    }

    const client = await prisma.client.create({
      data: {
        clientNumber,
        companyName,
        nit: nit || null,
        contactName,
        contactPosition: contactPosition || null,
        email,
        phone,
        address: address || null,
        city: city || null,
        sector: sector || null,
        source: source || 'REFERIDO',
        notes: notes || null
      }
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 });
  }
}
