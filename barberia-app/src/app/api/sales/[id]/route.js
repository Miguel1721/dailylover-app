import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

const SALE_INCLUDE = {
  barber: {
    select: { id: true, name: true, specialty: true, photoUrl: true },
  },
  items: {
    include: {
      service: {
        select: { id: true, name: true, price: true, durationMinutes: true },
      },
      product: {
        select: { id: true, name: true, salePrice: true, costPrice: true },
      },
    },
  },
  commission: true,
  appointment: {
    select: { id: true, clientName: true, date: true, timeSlot: true, status: true },
  },
}

// GET /api/sales/[id]
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = params
    const tenantId = session.user.tenantId

    const sale = await prisma.sale.findFirst({
      where: { id, tenantId },
      include: SALE_INCLUDE,
    })

    if (!sale) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ sale })
  } catch (error) {
    console.error('[GET /api/sales/[id]]', error)
    return NextResponse.json(
      { error: 'Error al obtener la venta', details: error.message },
      { status: 500 }
    )
  }
}
