import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// GET /api/services
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const tenantId = session.user.tenantId
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const services = await prisma.service.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(services)
  } catch (error) {
    console.error('[GET /api/services]', error)
    return NextResponse.json(
      { error: 'Error al obtener los servicios', details: error.message },
      { status: 500 }
    )
  }
}

// POST /api/services
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const tenantId = session.user.tenantId
    const body = await request.json()
    const { name, description, price, durationMinutes, category } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'El nombre del servicio es requerido' }, { status: 400 })
    }
    if (price === undefined || price < 0) {
      return NextResponse.json({ error: 'El precio debe ser un número positivo' }, { status: 400 })
    }

    const service = await prisma.service.create({
      data: {
        tenantId,
        name: name.trim(),
        description: description ?? null,
        price,
        durationMinutes: durationMinutes ?? 30,
        category: category || 'BARBERIA',
      },
    })

    return NextResponse.json({ service }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/services]', error)
    return NextResponse.json(
      { error: 'Error al crear el servicio', details: error.message },
      { status: 500 }
    )
  }
}
