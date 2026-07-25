import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/public/barbers?slug=[slug]
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json({ error: 'El parámetro "slug" es requerido' }, { status: 400 })
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    })

    if (!tenant || !tenant.isActive) {
      return NextResponse.json({ error: 'Barbería no encontrada o inactiva' }, { status: 404 })
    }

    const barbers = await prisma.barber.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: {
        id: true,
        name: true,
        specialty: true,
        phone: true,
        photoUrl: true,
        category: true,
        schedule: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(barbers)
  } catch (error) {
    console.error('GET /api/public/barbers error:', error)
    return NextResponse.json({ error: 'Error al obtener barberos' }, { status: 500 })
  }
}
