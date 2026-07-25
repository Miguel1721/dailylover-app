import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// GET /api/public/available-slots?slug=[slug]&barberId=[id]&date=[YYYY-MM-DD]
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')
    const barberId = searchParams.get('barberId')
    const dateParam = searchParams.get('date')

    if (!slug || !barberId || !dateParam) {
      return NextResponse.json(
        { success: false, error: 'Los parámetros "slug", "barberId" y "date" son requeridos' },
        { status: 400 }
      )
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json(
        { success: false, error: 'Formato de fecha inválido. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }

    const parsedDate = new Date(`${dateParam}T00:00:00.000Z`)
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ success: false, error: 'Fecha inválida' }, { status: 400 })
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    })

    if (!tenant || !tenant.isActive) {
      return NextResponse.json({ success: false, error: 'Barbería no encontrada o inactiva' }, { status: 404 })
    }

    const barber = await prisma.barber.findFirst({
      where: { id: barberId, tenantId: tenant.id },
      select: { id: true, name: true, isActive: true, schedule: true },
    })

    if (!barber) {
      return NextResponse.json({ success: false, error: 'Barbero no encontrado' }, { status: 404 })
    }

    if (!barber.isActive) {
      return NextResponse.json({ success: false, error: 'El barbero no está activo' }, { status: 409 })
    }

    const dayKey = DAY_KEYS[parsedDate.getUTCDay()]
    const schedule = barber.schedule || {}
    const scheduledSlots = Array.isArray(schedule[dayKey]) ? schedule[dayKey] : []

    const startOfDay = new Date(`${dateParam}T00:00:00.000Z`)
    const endOfDay = new Date(`${dateParam}T23:59:59.999Z`)

    const bookedAppointments = await prisma.appointment.findMany({
      where: {
        tenantId: tenant.id,
        barberId,
        date: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
      select: { timeSlot: true },
    })

    const bookedSlots = bookedAppointments.map((a) => a.timeSlot)
    const availableSlots = scheduledSlots.filter((slot) => !bookedSlots.includes(slot))

    return NextResponse.json({
      success: true,
      data: {
        barberId: barber.id,
        barberName: barber.name,
        date: dateParam,
        dayKey,
        scheduledSlots,
        bookedSlots,
        availableSlots,
      },
    })
  } catch (error) {
    console.error('GET /api/public/available-slots error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener horarios disponibles' }, { status: 500 })
  }
}
