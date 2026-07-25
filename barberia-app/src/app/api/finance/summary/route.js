import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'
import { getColombiaDateRange, COLOMBIA_OFFSET } from '@/lib/dateUtils'

// GET /api/finance/summary
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!['ADMIN', 'CASHIER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const tenantId = session.user.tenantId
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    let start, end
    if (startDateParam || endDateParam) {
      const range = getColombiaDateRange(startDateParam, endDateParam)
      start = range.start
      end = range.end
    } else {
      const nowInColombia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
      const yyyy = nowInColombia.getFullYear()
      const mm = String(nowInColombia.getMonth() + 1).padStart(2, '0')
      const lastDay = new Date(yyyy, nowInColombia.getMonth() + 1, 0).getDate()
      start = new Date(`${yyyy}-${mm}-01T00:00:00.000${COLOMBIA_OFFSET}`)
      end = new Date(`${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}T23:59:59.999${COLOMBIA_OFFSET}`)
    }

    const [sales, expenses, commissions, appointments] = await Promise.all([
      prisma.sale.findMany({
        where: { tenantId, createdAt: { gte: start, lte: end } },
        include: {
          items: { select: { itemType: true, total: true } },
          barber: { select: { id: true, name: true } },
        },
      }),
      prisma.expense.findMany({
        where: { tenantId, date: { gte: start, lte: end } },
        include: { category: { select: { name: true } } },
      }),
      prisma.commission.findMany({
        where: { tenantId, createdAt: { gte: start, lte: end } },
        select: { commissionAmount: true, isPaid: true },
      }),
      prisma.appointment.findMany({
        where: { tenantId, date: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
        select: { id: true },
      }),
    ])

    const paymentMethodTotals = { CASH: 0, NEQUI: 0, TRANSFER: 0, CARD: 0, MIXED: 0 }
    let fromServices = 0
    let fromProducts = 0

    for (const sale of sales) {
      const pm = sale.paymentMethod
      if (paymentMethodTotals[pm] !== undefined) {
        paymentMethodTotals[pm] += sale.total
      }
      for (const item of sale.items) {
        if (item.itemType === 'SERVICE') {
          fromServices += item.total
        } else {
          fromProducts += item.total
        }
      }
    }

    const incomeTotal = fromServices + fromProducts

    const categoryMap = {}
    for (const expense of expenses) {
      const catName = expense.category.name
      categoryMap[catName] = (categoryMap[catName] || 0) + expense.amount
    }

    const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0)
    const byCategory = Object.entries(categoryMap)
      .map(([categoryName, amount]) => ({ categoryName, amount: Math.round(amount) }))
      .sort((a, b) => b.amount - a.amount)

    let commissionsTotal = 0
    let commissionsPaid = 0
    let commissionsPending = 0

    for (const c of commissions) {
      commissionsTotal += c.commissionAmount
      if (c.isPaid) {
        commissionsPaid += c.commissionAmount
      } else {
        commissionsPending += c.commissionAmount
      }
    }

    const barberStatsMap = {}

    for (const sale of sales) {
      const bid = sale.barber.id
      if (!barberStatsMap[bid]) {
        barberStatsMap[bid] = {
          barberId: bid,
          barberName: sale.barber.name,
          servicesTotal: 0,
          commissionsEarned: 0,
        }
      }
      for (const item of sale.items) {
        if (item.itemType === 'SERVICE') {
          barberStatsMap[bid].servicesTotal += item.total
        }
      }
    }

    const commissionsFull = await prisma.commission.findMany({
      where: { tenantId, createdAt: { gte: start, lte: end } },
      select: { barberId: true, commissionAmount: true },
    })

    for (const c of commissionsFull) {
      if (barberStatsMap[c.barberId]) {
        barberStatsMap[c.barberId].commissionsEarned += c.commissionAmount
      } else {
        barberStatsMap[c.barberId] = {
          barberId: c.barberId,
          barberName: 'Desconocido',
          servicesTotal: 0,
          commissionsEarned: c.commissionAmount,
        }
      }
    }

    const topBarbers = Object.values(barberStatsMap)
      .map((b) => ({
        barberId: b.barberId,
        barberName: b.barberName,
        servicesTotal: Math.round(b.servicesTotal),
        commissionsEarned: Math.round(b.commissionsEarned),
      }))
      .sort((a, b) => b.servicesTotal - a.servicesTotal)
      .slice(0, 10)

    const netProfit = incomeTotal - expenseTotal - commissionsPaid

    // Dynamic Last 7 Days chart data calculation in Colombia timezone
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const weeklyChart = []
    const nowInColombia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))

    for (let i = 6; i >= 0; i--) {
      const d = new Date(nowInColombia)
      d.setDate(d.getDate() - i)

      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const dateStr = `${yyyy}-${mm}-${dd}`
      const dayRange = getColombiaDateRange(dateStr, dateStr)

      const [daySales, dayExpenses] = await Promise.all([
        prisma.sale.aggregate({
          where: { tenantId, createdAt: { gte: dayRange.start, lte: dayRange.end } },
          _sum: { total: true },
        }),
        prisma.expense.aggregate({
          where: { tenantId, date: { gte: dayRange.start, lte: dayRange.end } },
          _sum: { amount: true },
        }),
      ])

      const isToday = i === 0
      weeklyChart.push({
        day: isToday ? 'Hoy' : dayNames[d.getDay()],
        dateStr,
        ingresos: daySales._sum.total || 0,
        gastos: dayExpenses._sum.amount || 0,
      })
    }

    return NextResponse.json({
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      income: {
        fromServices: Math.round(fromServices),
        fromProducts: Math.round(fromProducts),
        total: Math.round(incomeTotal),
        byPaymentMethod: {
          CASH: Math.round(paymentMethodTotals.CASH),
          NEQUI: Math.round(paymentMethodTotals.NEQUI),
          TRANSFER: Math.round(paymentMethodTotals.TRANSFER),
          CARD: Math.round(paymentMethodTotals.CARD),
          MIXED: Math.round(paymentMethodTotals.MIXED),
        },
      },
      expenses: {
        total: Math.round(expenseTotal),
        byCategory,
      },
      commissions: {
        total: Math.round(commissionsTotal),
        paid: Math.round(commissionsPaid),
        pending: Math.round(commissionsPending),
      },
      netProfit: Math.round(netProfit),
      salesCount: sales.length,
      appointmentsCount: appointments.length,
      topBarbers,
      weeklyChart,
    })
  } catch (error) {
    console.error('[GET /api/finance/summary]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
