import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/public/tenant?slug=[slug]
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json({ error: 'El parámetro "slug" es requerido' }, { status: 400 })
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      include: { settings: true },
    })

    if (!tenant || !tenant.isActive) {
      return NextResponse.json({ error: 'Barbería no encontrada o inactiva' }, { status: 404 })
    }

    return NextResponse.json({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      settings: tenant.settings || {
        businessName: tenant.name,
        businessSubtitle: 'Gestión Barbería',
        businessPhone: null,
        businessAddress: null,
        businessEmail: null,
        logoUrl: null,
        appointmentSlotMin: 30,
        businessHours: {},
      },
    })
  } catch (error) {
    console.error('GET /api/public/tenant error:', error)
    return NextResponse.json({ error: 'Error al obtener información de la barbería' }, { status: 500 })
  }
}
