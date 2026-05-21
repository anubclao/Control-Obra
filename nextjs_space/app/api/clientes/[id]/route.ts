import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { ROLES_CAN_VIEW_SALES, ROLES_CAN_MANAGE_SALES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role as string;
    if (!ROLES_CAN_VIEW_SALES.includes(userRole as typeof ROLES_CAN_VIEW_SALES[number])) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await params;
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        quotations: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error('Error fetching client:', error);
    return NextResponse.json({ error: 'Error al obtener cliente' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role as string;
    if (!ROLES_CAN_MANAGE_SALES.includes(userRole as typeof ROLES_CAN_MANAGE_SALES[number])) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { companyName, nit, contactName, contactPosition, email, phone, address, city, sector, source, status, notes } = body;

    const existingClient = await prisma.client.findUnique({ where: { id } });
    if (!existingClient) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Check if NIT already exists (excluding current client)
    if (nit && nit !== existingClient.nit) {
      const nitExists = await prisma.client.findFirst({
        where: { nit, id: { not: id } }
      });
      if (nitExists) {
        return NextResponse.json({ error: 'Ya existe un cliente con este NIT' }, { status: 400 });
      }
    }

    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        companyName: companyName || existingClient.companyName,
        nit: nit || existingClient.nit,
        contactName: contactName || existingClient.contactName,
        contactPosition: contactPosition !== undefined ? contactPosition : existingClient.contactPosition,
        email: email || existingClient.email,
        phone: phone || existingClient.phone,
        address: address !== undefined ? address : existingClient.address,
        city: city !== undefined ? city : existingClient.city,
        sector: sector !== undefined ? sector : existingClient.sector,
        source: source || existingClient.source,
        status: status || existingClient.status,
        notes: notes !== undefined ? notes : existingClient.notes
      }
    });

    return NextResponse.json(updatedClient);
  } catch (error) {
    console.error('Error updating client:', error);
    return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role as string;
    if (!ROLES_CAN_MANAGE_SALES.includes(userRole as typeof ROLES_CAN_MANAGE_SALES[number])) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await params;
    
    // Check if client has quotations
    const quotationCount = await prisma.quotation.count({ where: { clientId: id } });
    if (quotationCount > 0) {
      return NextResponse.json({ error: 'No se puede eliminar un cliente con cotizaciones' }, { status: 400 });
    }

    await prisma.client.delete({ where: { id } });
    return NextResponse.json({ message: 'Cliente eliminado' });
  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json({ error: 'Error al eliminar cliente' }, { status: 500 });
  }
}
