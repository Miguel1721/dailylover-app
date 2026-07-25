import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'

// GET /api/expenses/[id]
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = params
    const tenantId = session.user.tenantId

    const expense = await prisma.expense.findFirst({
      where: { id, tenantId },
      include: {
        category: { select: { id: true, name: true } },
      },
    })

    if (!expense) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 })

    return NextResponse.json(expense)
  } catch (error) {
    console.error(`[GET /api/expenses/${params.id}]`, error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// PUT /api/expenses/[id]
export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!['ADMIN', 'CASHIER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { id } = params
    const tenantId = session.user.tenantId

    const existing = await prisma.expense.findFirst({ where: { id, tenantId } })
    if (!existing) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 })

    const body = await request.json()
    const { categoryId, description, amount, date } = body

    const updateData = {}

    if (categoryId !== undefined) {
      const category = await prisma.expenseCategory.findFirst({ where: { id: categoryId, tenantId } })
      if (!category) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
      updateData.categoryId = categoryId
    }

    if (description !== undefined) {
      if (!description.trim()) return NextResponse.json({ error: 'La descripción no puede estar vacía' }, { status: 400 })
      updateData.description = description.trim()
    }

    if (amount !== undefined) {
      if (typeof amount !== 'number' || amount <= 0) return NextResponse.json({ error: 'amount debe ser positivo' }, { status: 400 })
      updateData.amount = Math.round(amount)
    }

    if (date !== undefined) {
      const expenseDate = new Date(date)
      if (isNaN(expenseDate.getTime())) return NextResponse.json({ error: 'Formato de fecha inválido' }, { status: 400 })
      updateData.date = expenseDate
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: updateData,
      include: { category: { select: { id: true, name: true } } },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error(`[PUT /api/expenses/${params.id}]`, error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// DELETE /api/expenses/[id]
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!['ADMIN', 'CASHIER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { id } = params
    const tenantId = session.user.tenantId

    const existing = await prisma.expense.findFirst({ where: { id, tenantId } })
    if (!existing) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 })

    await prisma.expense.delete({ where: { id } })

    return NextResponse.json({ message: 'Gasto eliminado correctamente' })
  } catch (error) {
    console.error(`[DELETE /api/expenses/${params.id}]`, error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
