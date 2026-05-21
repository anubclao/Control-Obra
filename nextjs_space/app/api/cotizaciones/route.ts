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
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const clientId = searchParams.get('clientId');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    
    if (status) {
      where.status = status;
    }
    
    if (clientId) {
      where.clientId = clientId;
    }
    
    if (search) {
      where.OR = [
        { quotationNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { client: { companyName: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const quotations = await prisma.quotation.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
            email: true
          }
        },
        _count: {
          select: { items: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(quotations);
  } catch (error) {
    console.error('Error fetching quotations:', error);
    return NextResponse.json({ error: 'Error al obtener cotizaciones' }, { status: 500 });
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
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await request.json();
    const { clientId, title, description, validUntil, paymentTerms, deliveryTerms, warranty, observations, ivaPercent, items } = body;

    if (!clientId || !title || !validUntil) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // Check client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Generate quotation number
    const year = new Date().getFullYear();
    const lastQuotation = await prisma.quotation.findFirst({
      where: {
        quotationNumber: { startsWith: `COT-${year}` }
      },
      orderBy: { quotationNumber: 'desc' }
    });
    
    let nextNumber = 1;
    if (lastQuotation?.quotationNumber) {
      const match = lastQuotation.quotationNumber.match(/COT-\d{4}-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    const quotationNumber = `COT-${year}-${nextNumber.toString().padStart(4, '0')}`;

    // Calculate totals
    let subtotal = 0;
    const processedItems = items?.map((item: { description: string; unit: string; quantity: number; unitPrice: number; notes?: string }, index: number) => {
      const totalPrice = item.quantity * item.unitPrice;
      subtotal += totalPrice;
      return {
        itemNumber: index + 1,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice,
        notes: item.notes || null
      };
    }) || [];

    const ivaPercentValue = ivaPercent ?? 19;
    const ivaAmount = subtotal * (ivaPercentValue / 100);
    const total = subtotal + ivaAmount;

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        title,
        description: description || null,
        validUntil: new Date(validUntil),
        clientId,
        subtotal,
        ivaPercent: ivaPercentValue,
        ivaAmount,
        total,
        paymentTerms: paymentTerms || null,
        deliveryTerms: deliveryTerms || null,
        warranty: warranty || null,
        observations: observations || null,
        items: {
          create: processedItems
        }
      },
      include: {
        client: true,
        items: true
      }
    });

    // Update client status to PROPOSAL if it was QUALIFIED or earlier
    if (['PROSPECT', 'CONTACTED', 'QUALIFIED'].includes(client.status)) {
      await prisma.client.update({
        where: { id: clientId },
        data: { status: 'PROPOSAL' }
      });
    }

    return NextResponse.json(quotation, { status: 201 });
  } catch (error) {
    console.error('Error creating quotation:', error);
    return NextResponse.json({ error: 'Error al crear cotización' }, { status: 500 });
  }
}
