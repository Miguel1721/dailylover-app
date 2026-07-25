import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// GET /api/barbers — Autenticado por sesión
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const tenantId = session.user.tenantId

    const barbers = await prisma.barber.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        specialty: true,
        phone: true,
        photoUrl: true,
        category: true,
        isActive: true,
        schedule: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { email: true, role: true } },
        _count: { select: { appointments: true, sales: true } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(barbers)
  } catch (error) {
    console.error('[GET /api/barbers]', error)
    return NextResponse.json({ success: false, error: 'Error al obtener los barberos' }, { status: 500 })
  }
}

// POST /api/barbers
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const tenantId = session.user.tenantId
    const body = await request.json()
    const { name, specialty, phone, photoUrl, category, schedule, userId } = body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ success: false, error: 'El campo "name" es requerido' }, { status: 400 })
    }
    if (!specialty || typeof specialty !== 'string' || specialty.trim() === '') {
      return NextResponse.json({ success: false, error: 'El campo "specialty" es requerido' }, { status: 400 })
    }

    if (userId) {
      const existingUser = await prisma.user.findFirst({ where: { id: userId, tenantId } })
      if (!existingUser) {
        return NextResponse.json({ success: false, error: 'El usuario especificado no existe' }, { status: 404 })
      }
      const alreadyLinked = await prisma.barber.findUnique({ where: { userId } })
      if (alreadyLinked) {
        return NextResponse.json({ success: false, error: 'Este usuario ya está vinculado a otro barbero' }, { status: 409 })
      }
    }

    const barber = await prisma.barber.create({
      data: {
        tenantId,
        name: name.trim(),
        specialty: specialty.trim(),
        phone: phone?.trim() ?? null,
        photoUrl: photoUrl?.trim() ?? null,
        category: category || 'BARBERIA',
        schedule: schedule ?? {},
        ...(userId ? { userId } : {}),
      },
      include: {
        user: { select: { email: true, role: true } },
      },
    })

    return NextResponse.json({ success: true, data: barber }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/barbers]', error)
    return NextResponse.json({ success: false, error: 'Error al crear el barbero' }, { status: 500 })
  }
}
