import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'
import { getColombiaDateRange } from '@/lib/dateUtils'

// GET /api/commissions
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const tenantId = session.user.tenantId
    const { searchParams } = new URL(request.url)
    const barberId = searchParams.get('barberId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const isPaidParam = searchParams.get('isPaid')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Se requieren startDate y endDate' }, { status: 400 })
    }

    const { start, end } = getColombiaDateRange(startDate, endDate)

    const where = {
      tenantId,
      createdAt: { gte: start, lte: end },
    }

    if (barberId && barberId !== 'all') where.barberId = barberId

    if (isPaidParam !== null && isPaidParam !== undefined && isPaidParam !== '' && isPaidParam !== 'all') {
      where.isPaid = isPaidParam === 'true'
    }

    if (session.user.role === 'BARBER' && session.user.barberId) {
      where.barberId = session.user.barberId
    }

    // Comisiones
    const commissions = await prisma.commission.findMany({
      where,
      include: {
        barber: { select: { id: true, name: true, specialty: true, photoUrl: true } },
        sale: {
          select: {
            id: true,
            total: true,
            subtotal: true,
            discount: true,
            paymentMethod: true,
            clientName: true,
            createdAt: true,
            items: {
              include: {
                service: { select: { id: true, name: true, price: true } },
                product: { select: { id: true, name: true, salePrice: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Préstamos / Vales de barberos
    const advancesWhere = {
      tenantId,
      ...(barberId && barberId !== 'all' ? { barberId } : {}),
    }
    if (session.user.role === 'BARBER' && session.user.barberId) {
      advancesWhere.barberId = session.user.barberId
    }

    const advances = await prisma.barberAdvance.findMany({
      where: advancesWhere,
      include: {
        barber: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    })

    let totalServiceRevenue = 0
    let totalCommissions = 0
    let totalPaid = 0
    let totalPending = 0
    let totalBarbershopRetained = 0

    const barberMap = {}

    // Cargar barberos base para asegurar que aparezcan aunque no tengan comisiones aún
    const allBarbers = await prisma.barber.findMany({
      where: { tenantId, isActive: true, ...(barberId && barberId !== 'all' ? { id: barberId } : {}) },
      select: { id: true, name: true, specialty: true },
    })

    for (const b of allBarbers) {
      barberMap[b.id] = {
        barberId: b.id,
        barberName: b.name,
        specialty: b.specialty,
        totalServices: 0,
        total: 0,
        paid: 0,
        pending: 0,
        advancesPending: 0,
        advancesTotal: 0,
        netPending: 0,
        barbershopShare: 0,
        advancesList: [],
      }
    }

    for (const c of commissions) {
      const barberTotalRevenue = c.serviceTotal || 0
      const barberCommAmount = c.commissionAmount || 0
      const barbershopShareAmount = Math.max(0, barberTotalRevenue - barberCommAmount)

      totalServiceRevenue += barberTotalRevenue
      totalCommissions += barberCommAmount
      totalBarbershopRetained += barbershopShareAmount

      if (c.isPaid) {
        totalPaid += barberCommAmount
      } else {
        totalPending += barberCommAmount
      }

      const bId = c.barberId
      const bName = c.barber?.name || 'Desconocido'
      if (!barberMap[bId]) {
        barberMap[bId] = {
          barberId: bId,
          barberName: bName,
          totalServices: 0,
          total: 0,
          paid: 0,
          pending: 0,
          advancesPending: 0,
          advancesTotal: 0,
          netPending: 0,
          barbershopShare: 0,
          advancesList: [],
        }
      }
      barberMap[bId].totalServices += barberTotalRevenue
      barberMap[bId].total += barberCommAmount
      barberMap[bId].barbershopShare += barbershopShareAmount

      if (c.isPaid) {
        barberMap[bId].paid += barberCommAmount
      } else {
        barberMap[bId].pending += barberCommAmount
      }
    }

    // Asociar vales/préstamos por barbero
    let totalPendingAdvances = 0

    for (const adv of advances) {
      const bId = adv.barberId
      if (barberMap[bId]) {
        barberMap[bId].advancesList.push(adv)
        barberMap[bId].advancesTotal += adv.amount
        if (adv.status === 'PENDING') {
          barberMap[bId].advancesPending += adv.amount
          totalPendingAdvances += adv.amount
        }
      }
    }

    // Calcular Neto por barbero
    for (const bId in barberMap) {
      const b = barberMap[bId]
      b.netPending = Math.max(0, b.pending - b.advancesPending)
    }

    const barbershopShareRate = totalServiceRevenue > 0
      ? Math.round((totalBarbershopRetained / totalServiceRevenue) * 100)
      : 40

    return NextResponse.json({
      commissions,
      advances,
      summary: {
        totalServiceRevenue: Math.round(totalServiceRevenue),
        totalCommissions: Math.round(totalCommissions),
        totalPaid: Math.round(totalPaid),
        totalPending: Math.round(totalPending),
        totalPendingAdvances: Math.round(totalPendingAdvances),
        netPendingToPay: Math.round(Math.max(0, totalPending - totalPendingAdvances)),
        totalBarbershopRetained: Math.round(totalBarbershopRetained),
        barbershopShareRate,
        byBarber: Object.values(barberMap),
      },
    })
  } catch (error) {
    console.error('[GET /api/commissions]', error)
    return NextResponse.json({ error: 'Error al obtener comisiones', details: error.message }, { status: 500 })
  }
}
