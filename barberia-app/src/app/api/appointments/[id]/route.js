import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// GET /api/appointments/[id]
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = params
    const tenantId = session.user.tenantId

    const appointment = await prisma.appointment.findFirst({
      where: { id, tenantId },
      include: {
        barber: { select: { id: true, name: true, specialty: true, phone: true, photoUrl: true } },
        services: { include: { service: { select: { id: true, name: true, description: true, price: true, durationMinutes: true } } } },
        sale: { include: { items: true, commission: true } },
      },
    })

    if (!appointment) {
      return NextResponse.json({ success: false, error: 'Cita no encontrada' }, { status: 404 })
    }

    const formatted = {
      ...appointment,
      services: appointment.services.map((s) => s.service),
    }

    return NextResponse.json({ success: true, data: formatted })
  } catch (error) {
    console.error('[GET /api/appointments/[id]]', error)
    return NextResponse.json({ success: false, error: 'Error al obtener la cita' }, { status: 500 })
  }
}

// PUT /api/appointments/[id]
export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = params
    const tenantId = session.user.tenantId
    const body = await request.json()
    const { status, notes, timeSlot, date, clientName, clientPhone } = body

    const existing = await prisma.appointment.findFirst({ where: { id, tenantId } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Cita no encontrada' }, { status: 404 })
    }

    if (existing.status === 'CANCELLED') {
      return NextResponse.json({ success: false, error: 'No se puede editar una cita cancelada' }, { status: 409 })
    }

    const validStatuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']
    if (status !== undefined && !validStatuses.includes(status.toUpperCase())) {
      return NextResponse.json({ success: false, error: 'Estado inválido' }, { status: 400 })
    }

    const updateData = {}
    if (status !== undefined) updateData.status = status.toUpperCase()
    if (notes !== undefined) updateData.notes = notes ? notes.trim() : null
    if (clientName !== undefined) updateData.clientName = clientName.trim()
    if (clientPhone !== undefined) updateData.clientPhone = clientPhone ? clientPhone.trim() : null

    let targetDate = existing.date
    let targetSlot = existing.timeSlot

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ success: false, error: 'Formato de fecha inválido' }, { status: 400 })
      }
      targetDate = new Date(`${date}T00:00:00.000Z`)
      updateData.date = targetDate
    }

    if (timeSlot) {
      if (!/^\d{2}:\d{2}$/.test(timeSlot)) {
        return NextResponse.json({ success: false, error: 'Formato de hora inválido' }, { status: 400 })
      }
      targetSlot = timeSlot
      updateData.timeSlot = timeSlot
    }

    if (date || timeSlot) {
      const dateStr = (date || existing.date.toISOString().slice(0, 10))
      const dayStart = new Date(`${dateStr}T00:00:00.000Z`)
      const dayEnd = new Date(`${dateStr}T23:59:59.999Z`)

      const conflict = await prisma.appointment.findFirst({
        where: {
          tenantId,
          barberId: existing.barberId,
          timeSlot: targetSlot,
          date: { gte: dayStart, lte: dayEnd },
          id: { not: id },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
      })

      if (conflict) {
        return NextResponse.json({ success: false, error: `El horario ${targetSlot} ya está ocupado` }, { status: 409 })
      }
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        barber: { select: { id: true, name: true, specialty: true } },
        services: { include: { service: true } },
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[PUT /api/appointments/[id]]', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar la cita' }, { status: 500 })
  }
}

// DELETE /api/appointments/[id]
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = params
    const tenantId = session.user.tenantId

    const existing = await prisma.appointment.findFirst({ where: { id, tenantId } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Cita no encontrada' }, { status: 404 })
    }

    if (existing.status === 'CANCELLED') {
      return NextResponse.json({ success: false, error: 'La cita ya está cancelada' }, { status: 409 })
    }

    const cancelled = await prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        barber: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ success: true, message: 'Cita cancelada correctamente', data: cancelled })
  } catch (error) {
    console.error('[DELETE /api/appointments/[id]]', error)
    return NextResponse.json({ success: false, error: 'Error al cancelar la cita' }, { status: 500 })
  }
}
