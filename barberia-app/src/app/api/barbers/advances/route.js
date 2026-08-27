import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'
import { getColombiaDateRange } from '@/lib/dateUtils'

// GET /api/barbers/advances
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const tenantId = session.user.tenantId
    const { searchParams } = new URL(request.url)
    const barberId = searchParams.get('barberId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const status = searchParams.get('status')

    const where = { tenantId }

    if (barberId && barberId !== 'all') where.barberId = barberId
    if (status && status !== 'all') where.status = status

    if (startDate && endDate) {
      const { start, end } = getColombiaDateRange(startDate, endDate)
      where.date = { gte: start, lte: end }
    }

    if (session.user.role === 'BARBER' && session.user.barberId) {
      where.barberId = session.user.barberId
    }

    const advances = await prisma.barberAdvance.findMany({
      where,
      include: {
        barber: { select: { id: true, name: true, photoUrl: true, specialty: true } },
      },
      orderBy: { date: 'desc' },
    })

    const summary = {
      totalCount: advances.length,
      totalAmount: advances.reduce((acc, a) => acc + a.amount, 0),
      pendingAmount: advances.filter(a => a.status === 'PENDING').reduce((acc, a) => acc + a.amount, 0),
      deductedAmount: advances.filter(a => a.status === 'DEDUCTED').reduce((acc, a) => acc + a.amount, 0),
    }

    return NextResponse.json({ advances, summary })
  } catch (error) {
    console.error('[GET /api/barbers/advances]', error)
    return NextResponse.json({ error: 'Error al consultar vales/préstamos', details: error.message }, { status: 500 })
  }
}

// POST /api/barbers/advances
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!['ADMIN', 'CASHIER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const tenantId = session.user.tenantId
    const body = await request.json()
    const { barberId, amount, reason, date } = body

    if (!barberId) {
      return NextResponse.json({ error: 'barberId es requerido' }, { status: 400 })
    }
    const parsedAmount = Number(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      return NextResponse.json({ error: 'El monto debe ser un valor positivo' }, { status: 400 })
    }

    const barber = await prisma.barber.findFirst({ where: { id: barberId, tenantId } })
    if (!barber) {
      return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 })
    }

    const advanceDate = date ? new Date(date) : new Date()

    const advance = await prisma.barberAdvance.create({
      data: {
        tenantId,
        barberId,
        amount: parsedAmount,
        reason: reason?.trim() || 'Adelanto / Vale de comisión',
        date: advanceDate,
        status: 'PENDING',
      },
      include: {
        barber: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ advance }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/barbers/advances]', error)
    return NextResponse.json({ error: 'Error al registrar vale/préstamo', details: error.message }, { status: 500 })
  }
}
