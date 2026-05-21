import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/db';
import { ROLES_CAN_VIEW_SALES, ROLES_CAN_MANAGE_SALES } from '@/lib/constants';

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
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        client: true,
        items: {
          orderBy: { itemNumber: 'asc' }
        }
      }
    });

    if (!quotation) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    return NextResponse.json(quotation);
  } catch (error) {
    console.error('Error fetching quotation:', error);
    return NextResponse.json({ error: 'Error al obtener cotización' }, { status: 500 });
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
    const { title, description, validUntil, status, paymentTerms, deliveryTerms, warranty, observations, ivaPercent, discountPercent, items } = body;

    const existingQuotation = await prisma.quotation.findUnique({
      where: { id },
      include: { items: true }
    });
    
    if (!existingQuotation) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    // Calculate totals if items provided
    let subtotal = existingQuotation.subtotal;
    let processedItems: { itemNumber: number; description: string; unit: string; quantity: number; unitPrice: number; totalPrice: number; notes: string | null }[] | undefined;
    
    if (items && items.length > 0) {
      subtotal = 0;
      processedItems = items.map((item: { description: string; unit: string; quantity: number; unitPrice: number; notes?: string }, index: number) => {
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
      });
    }

    const ivaPercentValue = ivaPercent ?? existingQuotation.ivaPercent;
    const discountPercentValue = discountPercent ?? existingQuotation.discountPercent;
    const discountAmount = subtotal * (discountPercentValue / 100);
    const subtotalAfterDiscount = subtotal - discountAmount;
    const ivaAmount = subtotalAfterDiscount * (ivaPercentValue / 100);
    const total = subtotalAfterDiscount + ivaAmount;

    // Update status dates
    const updateData: Record<string, unknown> = {
      title: title || existingQuotation.title,
      description: description !== undefined ? description : existingQuotation.description,
      validUntil: validUntil ? new Date(validUntil) : existingQuotation.validUntil,
      status: status || existingQuotation.status,
      paymentTerms: paymentTerms !== undefined ? paymentTerms : existingQuotation.paymentTerms,
      deliveryTerms: deliveryTerms !== undefined ? deliveryTerms : existingQuotation.deliveryTerms,
      warranty: warranty !== undefined ? warranty : existingQuotation.warranty,
      observations: observations !== undefined ? observations : existingQuotation.observations,
      subtotal,
      discountPercent: discountPercentValue,
      discountAmount,
      ivaPercent: ivaPercentValue,
      ivaAmount,
      total
    };

    // Handle status change dates
    if (status === 'SENT' && !existingQuotation.sentAt) {
      updateData.sentAt = new Date();
    }
    if (['ACCEPTED', 'REJECTED'].includes(status) && !existingQuotation.respondedAt) {
      updateData.respondedAt = new Date();
    }

    // Update quotation
    const updatedQuotation = await prisma.quotation.update({
      where: { id },
      data: updateData
    });

    // Update items if provided
    if (processedItems) {
      // Delete existing items
      await prisma.quotationItem.deleteMany({ where: { quotationId: id } });
      // Create new items
      await prisma.quotationItem.createMany({
        data: processedItems.map(item => ({
          ...item,
          quotationId: id
        }))
      });
    }

    // Update client status based on quotation status
    if (status === 'ACCEPTED') {
      await prisma.client.update({
        where: { id: existingQuotation.clientId },
        data: { status: 'WON' }
      });
    } else if (status === 'REJECTED') {
      await prisma.client.update({
        where: { id: existingQuotation.clientId },
        data: { status: 'LOST' }
      });
    } else if (status === 'SENT') {
      const client = await prisma.client.findUnique({ where: { id: existingQuotation.clientId } });
      if (client && client.status === 'PROPOSAL') {
        await prisma.client.update({
          where: { id: existingQuotation.clientId },
          data: { status: 'NEGOTIATION' }
        });
      }
    }

    const finalQuotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        client: true,
        items: { orderBy: { itemNumber: 'asc' } }
      }
    });

    return NextResponse.json(finalQuotation);
  } catch (error) {
    console.error('Error updating quotation:', error);
    return NextResponse.json({ error: 'Error al actualizar cotización' }, { status: 500 });
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
    
    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    // Only allow deletion of draft or cancelled quotations
    if (!['DRAFT', 'CANCELLED'].includes(quotation.status)) {
      return NextResponse.json({ error: 'Solo se pueden eliminar cotizaciones en borrador o canceladas' }, { status: 400 });
    }

    await prisma.quotation.delete({ where: { id } });
    return NextResponse.json({ message: 'Cotización eliminada' });
  } catch (error) {
    console.error('Error deleting quotation:', error);
    return NextResponse.json({ error: 'Error al eliminar cotización' }, { status: 500 });
  }
}
