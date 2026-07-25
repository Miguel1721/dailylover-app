import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/public/services?slug=[slug]
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

    const services = await prisma.service.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { price: 'desc' },
    })

    return NextResponse.json(services)
  } catch (error) {
    console.error('GET /api/public/services error:', error)
    return NextResponse.json({ error: 'Error al obtener servicios' }, { status: 500 })
  }
}
