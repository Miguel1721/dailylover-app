import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/public/appointments
// Body: { slug, clientName, clientPhone?, barberId, serviceIds[], date, timeSlot, notes? }
export async function POST(request) {
  try {
    const body = await request.json()
    const {
      slug,
      clientName,
      clientPhone,
      barberId,
      serviceIds,
      date,
      timeSlot,
      notes,
    } = body

    if (!slug) {
      return NextResponse.json({ success: false, error: 'El campo "slug" es requerido' }, { status: 400 })
    }
    if (!clientName || clientName.trim() === '') {
      return NextResponse.json({ success: false, error: 'El campo "clientName" es requerido' }, { status: 400 })
    }
    if (!barberId) {
      return NextResponse.json({ success: false, error: 'El campo "barberId" es requerido' }, { status: 400 })
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ success: false, error: 'El campo "date" es requerido y debe ser YYYY-MM-DD' }, { status: 400 })
    }
    if (!timeSlot || !/^\d{2}:\d{2}$/.test(timeSlot)) {
      return NextResponse.json({ success: false, error: 'El campo "timeSlot" es requerido' }, { status: 400 })
    }
    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Debe incluir al menos un servicio en "serviceIds"' }, { status: 400 })
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    })

    if (!tenant || !tenant.isActive) {
      return NextResponse.json({ success: false, error: 'Barbería no encontrada o inactiva' }, { status: 404 })
    }

    const barber = await prisma.barber.findFirst({
      where: { id: barberId, tenantId: tenant.id, isActive: true },
    })
    if (!barber) {
      return NextResponse.json({ success: false, error: 'Barbero no encontrado o inactivo' }, { status: 404 })
    }

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId: tenant.id, isActive: true },
    })
    if (services.length !== serviceIds.length) {
      return NextResponse.json({ success: false, error: 'Uno o más servicios no existen o están inactivos' }, { status: 404 })
    }

    const dayStart = new Date(`${date}T00:00:00.000Z`)
    const dayEnd = new Date(`${date}T23:59:59.999Z`)

    const conflict = await prisma.appointment.findFirst({
      where: {
        tenantId: tenant.id,
        barberId,
        timeSlot,
        date: { gte: dayStart, lte: dayEnd },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
    })

    if (conflict) {
      return NextResponse.json(
        { success: false, error: `El horario ${timeSlot} ya se encuentra ocupado para esa fecha` },
        { status: 409 }
      )
    }

    const appointmentDate = new Date(`${date}T00:00:00.000Z`)

    const newAppointment = await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
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

    return NextResponse.json({ success: true, data: newAppointment }, { status: 201 })
  } catch (error) {
    console.error('POST /api/public/appointments error:', error)
    return NextResponse.json({ success: false, error: 'Error al crear la cita' }, { status: 500 })
  }
}
