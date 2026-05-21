import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { getFinancialReportPayload } from '@/lib/financial-report';
import { ROLES_CAN_VIEW_FINANCIAL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// GET - Obtener reporte financiero
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = session.user.role;
    if (!ROLES_CAN_VIEW_FINANCIAL.includes(userRole as (typeof ROLES_CAN_VIEW_FINANCIAL)[number])) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const noCache = searchParams.get('noCache') === '1';
    const payload = await getFinancialReportPayload(projectId, noCache);

    return NextResponse.json(payload, {
      headers: {
        'x-runtime-cache': noCache ? 'bypass' : 'hit-or-miss',
      },
    });
  } catch (error) {
    console.error('Error fetching financial report:', error);
    return NextResponse.json({ error: 'Error al obtener reporte financiero' }, { status: 500 });
  }
}
