import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// GET /api/barbers/[id]
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = params
    const tenantId = session.user.tenantId

    const barber = await prisma.barber.findFirst({
      where: { id, tenantId },
      include: {
        user: { select: { email: true, role: true } },
        appointments: { select: { id: true, status: true } },
        sales: { select: { id: true, total: true, subtotal: true, discount: true, paymentMethod: true, createdAt: true } },
        commissions: { select: { id: true, saleId: true, serviceTotal: true, commissionRate: true, commissionAmount: true, isPaid: true, paidAt: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
      },
    })

    if (!barber) {
      return NextResponse.json({ success: false, error: 'Barbero no encontrado' }, { status: 404 })
    }

    const appointmentCount = barber.appointments.length
    const appointmentsByStatus = barber.appointments.reduce((acc, apt) => {
      acc[apt.status] = (acc[apt.status] ?? 0) + 1
      return acc
    }, {})

    const totalSales = barber.sales.reduce((sum, s) => sum + s.total, 0)
    const totalCommissions = barber.commissions.reduce((sum, c) => sum + c.commissionAmount, 0)
    const pendingCommissions = barber.commissions.filter((c) => !c.isPaid).reduce((sum, c) => sum + c.commissionAmount, 0)
    const paidCommissions = barber.commissions.filter((c) => c.isPaid).reduce((sum, c) => sum + c.commissionAmount, 0)

    const { appointments, sales, commissions, ...barberBase } = barber

    return NextResponse.json({
      success: true,
      data: {
        ...barberBase,
        stats: {
          appointmentCount,
          appointmentsByStatus,
          totalSales,
          totalCommissions,
          pendingCommissions,
          paidCommissions,
        },
        commissions,
      },
    })
  } catch (error) {
    console.error('[GET /api/barbers/[id]]', error)
    return NextResponse.json({ success: false, error: 'Error al obtener el barbero' }, { status: 500 })
  }
}

// PUT /api/barbers/[id]
export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = params
    const tenantId = session.user.tenantId
    const body = await request.json()
    const { name, specialty, phone, photoUrl, category, schedule, isActive } = body

    const existing = await prisma.barber.findFirst({ where: { id, tenantId } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Barbero no encontrado' }, { status: 404 })
    }

    const updateData = {}
    if (name !== undefined) updateData.name = name.trim()
    if (specialty !== undefined) updateData.specialty = specialty.trim()
    if (phone !== undefined) updateData.phone = phone?.trim() ?? null
    if (photoUrl !== undefined) updateData.photoUrl = photoUrl?.trim() ?? null
    if (category !== undefined) updateData.category = category
    if (schedule !== undefined) updateData.schedule = schedule
    if (isActive !== undefined) updateData.isActive = Boolean(isActive)

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'No se proporcionaron campos para actualizar' }, { status: 400 })
    }

    const updated = await prisma.barber.update({
      where: { id },
      data: updateData,
      include: { user: { select: { email: true, role: true } } },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[PUT /api/barbers/[id]]', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar el barbero' }, { status: 500 })
  }
}

// DELETE /api/barbers/[id]
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = params
    const tenantId = session.user.tenantId

    const existing = await prisma.barber.findFirst({ where: { id, tenantId } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Barbero no encontrado' }, { status: 404 })
    }

    if (!existing.isActive) {
      return NextResponse.json({ success: false, error: 'El barbero ya está desactivado' }, { status: 409 })
    }

    const deactivated = await prisma.barber.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true, updatedAt: true },
    })

    return NextResponse.json({ success: true, message: 'Barbero desactivado correctamente', data: deactivated })
  } catch (error) {
    console.error('[DELETE /api/barbers/[id]]', error)
    return NextResponse.json({ success: false, error: 'Error al desactivar el barbero' }, { status: 500 })
  }
}
