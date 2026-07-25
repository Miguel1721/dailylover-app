import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { getColombiaDateRange } from '@/lib/dateUtils'

// GET /api/appointments
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const tenantId = session.user.tenantId
    const { searchParams } = new URL(request.url)
    const barberId = searchParams.get('barberId')
    const dateParam = searchParams.get('date')
    const status = searchParams.get('status')

    const where = { tenantId }

    if (barberId) where.barberId = barberId

    if (dateParam) {
      const { start, end } = getColombiaDateRange(dateParam, dateParam)
      where.date = { gte: start, lte: end }
    }

    if (status) {
      where.status = status.toUpperCase()
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        barber: { select: { id: true, name: true, specialty: true } },
        services: { include: { service: true } },
      },
      orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }],
    })

    return NextResponse.json(appointments)
  } catch (error) {
    console.error('[GET /api/appointments]', error)
    return NextResponse.json({ success: false, error: 'Error al obtener las citas' }, { status: 500 })
  }
}

// POST /api/appointments
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const tenantId = session.user.tenantId
    const body = await request.json()
    const { clientName, clientPhone, barberId, serviceIds, date, timeSlot, notes } = body

    if (!clientName || clientName.trim() === '') {
      return NextResponse.json({ success: false, error: 'El campo "clientName" es requerido' }, { status: 400 })
    }
    if (!barberId) {
      return NextResponse.json({ success: false, error: 'El campo "barberId" es requerido' }, { status: 400 })
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ success: false, error: 'El campo "date" es requerido (YYYY-MM-DD)' }, { status: 400 })
    }
    if (!timeSlot || !/^\d{2}:\d{2}$/.test(timeSlot)) {
      return NextResponse.json({ success: false, error: 'El campo "timeSlot" es requerido (HH:MM)' }, { status: 400 })
    }
    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Debe incluir al menos un servicio en "serviceIds"' }, { status: 400 })
    }

    const barber = await prisma.barber.findFirst({ where: { id: barberId, tenantId } })
    if (!barber) return NextResponse.json({ success: false, error: 'Barbero no encontrado' }, { status: 404 })
    if (!barber.isActive) return NextResponse.json({ success: false, error: 'El barbero no está activo' }, { status: 409 })

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId, isActive: true },
    })
    if (services.length !== serviceIds.length) {
      return NextResponse.json({ success: false, error: 'Uno o más servicios no existen o están inactivos' }, { status: 404 })
    }

    const dayStart = new Date(`${date}T00:00:00.000Z`)
    const dayEnd = new Date(`${date}T23:59:59.999Z`)

    const conflict = await prisma.appointment.findFirst({
      where: {
        tenantId,
        barberId,
        timeSlot,
        date: { gte: dayStart, lte: dayEnd },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
    })

    if (conflict) {
      return NextResponse.json({ success: false, error: `El horario ${timeSlot} ya se encuentra reservado para este barbero` }, { status: 409 })
    }

    const appointmentDate = new Date(`${date}T00:00:00.000Z`)

    const appointment = await prisma.appointment.create({
      data: {
        tenantId,
        clientName: clientName.trim(),
        clientPhone: clientPhone ? clientPhone.trim() : null,
        barberId,
        date: appointmentDate,
        timeSlot,
        status: 'PENDING',
        notes: notes ? notes.trim() : null,
        services: {
          create: serviceIds.map((sId) => ({ serviceId: sId })),
        },
      },
      include: {
        barber: { select: { id: true, name: true, specialty: true } },
        services: { include: { service: true } },
      },
    })

    return NextResponse.json({ success: true, data: appointment }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/appointments]', error)
    return NextResponse.json({ success: false, error: 'Error al crear la cita' }, { status: 500 })
  }
}
