import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'
import { getColombiaDateRange } from '@/lib/dateUtils'

// GET /api/expenses
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const tenantId = session.user.tenantId
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Se requieren startDate y endDate' }, { status: 400 })
    }

    const { start, end } = getColombiaDateRange(startDate, endDate)

    const where = {
      tenantId,
      date: { gte: start, lte: end },
    }

    if (categoryId) where.categoryId = categoryId

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    })

    const total = expenses.reduce((sum, e) => sum + e.amount, 0)

    return NextResponse.json({ expenses, total: Math.round(total) })
  } catch (error) {
    console.error('[GET /api/expenses]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST /api/expenses
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!['ADMIN', 'CASHIER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const tenantId = session.user.tenantId
    const body = await request.json()
    const { categoryId, description, amount, date } = body

    if (!categoryId || !description || amount === undefined || !date) {
      return NextResponse.json({ error: 'categoryId, description, amount y date son requeridos' }, { status: 400 })
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'amount debe ser un número positivo' }, { status: 400 })
    }

    const category = await prisma.expenseCategory.findFirst({ where: { id: categoryId, tenantId } })
    if (!category) return NextResponse.json({ error: 'Categoría de gasto no encontrada' }, { status: 404 })

    const expenseDate = new Date(date)
    if (isNaN(expenseDate.getTime())) {
      return NextResponse.json({ error: 'Formato de fecha inválido' }, { status: 400 })
    }

    const expense = await prisma.expense.create({
      data: {
        tenantId,
        categoryId,
        description: description.trim(),
        amount: Math.round(amount),
        date: expenseDate,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error('[POST /api/expenses]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
