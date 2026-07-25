import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'
import { getColombiaDateRange } from '@/lib/dateUtils'

// POST /api/commissions/pay
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!['ADMIN', 'CASHIER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const tenantId = session.user.tenantId
    const body = await request.json()
    const { commissionIds, barberId, startDate, endDate } = body

    const paidAt = new Date()
    let where = { tenantId }

    if (Array.isArray(commissionIds) && commissionIds.length > 0) {
      where.id = { in: commissionIds }
      where.isPaid = false
    } else if (startDate && endDate) {
      const { start, end } = getColombiaDateRange(startDate, endDate)

      where.isPaid = false
      where.createdAt = { gte: start, lte: end }

      if (barberId) where.barberId = barberId
    } else {
      return NextResponse.json({ error: 'Debe proporcionar commissionIds[] o (startDate + endDate)' }, { status: 400 })
    }

    const matching = await prisma.commission.findMany({
      where,
      select: { id: true },
    })

    if (matching.length === 0) {
      return NextResponse.json({ message: 'No se encontraron comisiones pendientes que coincidan', updated: 0 })
    }

    const result = await prisma.commission.updateMany({
      where,
      data: { isPaid: true, paidAt },
    })

    return NextResponse.json({
      message: `${result.count} comisión(es) marcada(s) como pagada(s)`,
      updated: result.count,
      paidAt,
    })
  } catch (error) {
    console.error('[POST /api/commissions/pay]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
