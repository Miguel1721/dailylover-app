import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// GET /api/settings — Autenticado por sesión
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const tenantId = session.user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'Inquilino no especificado' }, { status: 400 })

    const settings = await prisma.settings.upsert({
      where: { tenantId },
      update: {},
      create: {
        tenantId,
        businessName: 'Barber Club',
        businessSubtitle: 'Gestión Barbería',
        commissionRateService: 0.60,
        commissionRateProduct: 0.20,
        appointmentSlotMin: 30,
        businessHours: {},
      },
    })
    return NextResponse.json(settings)
  } catch (error) {
    console.error('GET /api/settings error:', error)
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 })
  }
}

// PUT /api/settings — ADMIN o SUPERADMIN
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const tenantId = session.user.tenantId
    if (!tenantId) return NextResponse.json({ error: 'Inquilino no especificado' }, { status: 400 })

    const body = await request.json()

    const allowed = [
      'businessName', 'businessSubtitle', 'businessPhone', 'businessAddress',
      'businessEmail', 'logoUrl', 'commissionRateService', 'commissionRateProduct',
      'appointmentSlotMin', 'businessHours',
    ]

    const data = {}
    for (const key of allowed) {
      if (body[key] !== undefined) data[key] = body[key]
    }

    if (data.commissionRateService !== undefined) {
      const rate = parseFloat(data.commissionRateService)
      if (isNaN(rate) || rate < 0 || rate > 1) {
        return NextResponse.json({ error: 'Tasa de comisión servicios inválida' }, { status: 400 })
      }
      data.commissionRateService = rate
    }
    if (data.commissionRateProduct !== undefined) {
      const rate = parseFloat(data.commissionRateProduct)
      if (isNaN(rate) || rate < 0 || rate > 1) {
        return NextResponse.json({ error: 'Tasa de comisión productos inválida' }, { status: 400 })
      }
      data.commissionRateProduct = rate
    }
    if (data.appointmentSlotMin !== undefined) {
      data.appointmentSlotMin = parseInt(data.appointmentSlotMin)
    }

    const settings = await prisma.settings.upsert({
      where: { tenantId },
      update: data,
      create: { tenantId, ...data },
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('PUT /api/settings error:', error)
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 })
  }
}
