import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// GET /api/services/[id]
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = params
    const tenantId = session.user.tenantId

    const service = await prisma.service.findFirst({ where: { id, tenantId } })
    if (!service) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

    return NextResponse.json({ service })
  } catch (error) {
    console.error('[GET /api/services/[id]]', error)
    return NextResponse.json({ error: 'Error al obtener el servicio', details: error.message }, { status: 500 })
  }
}

// PUT /api/services/[id]
export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { id } = params
    const tenantId = session.user.tenantId

    const existing = await prisma.service.findFirst({ where: { id, tenantId } })
    if (!existing) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

    const body = await request.json()
    const { name, description, price, durationMinutes, category, isActive, commissionRate } = body

    const data = {}
    if (name !== undefined) {
      if (name.trim() === '') return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 })
      data.name = name.trim()
    }
    if (description !== undefined) data.description = description
    if (price !== undefined) {
      if (price < 0) return NextResponse.json({ error: 'El precio debe ser un número positivo' }, { status: 400 })
      data.price = price
    }
    if (durationMinutes !== undefined) data.durationMinutes = durationMinutes
    if (category !== undefined) data.category = category
    if (isActive !== undefined) data.isActive = isActive
    if (commissionRate !== undefined) {
      data.commissionRate = commissionRate !== null && commissionRate !== '' ? Number(commissionRate) : null
    }

    const service = await prisma.service.update({ where: { id }, data })

    return NextResponse.json({ service })
  } catch (error) {
    console.error('[PUT /api/services/[id]]', error)
    return NextResponse.json({ error: 'Error al actualizar el servicio', details: error.message }, { status: 500 })
  }
}

// DELETE /api/services/[id]
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { id } = params
    const tenantId = session.user.tenantId

    const existing = await prisma.service.findFirst({ where: { id, tenantId } })
    if (!existing) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

    const service = await prisma.service.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ service })
  } catch (error) {
    console.error('[DELETE /api/services/[id]]', error)
    return NextResponse.json({ error: 'Error al desactivar el servicio', details: error.message }, { status: 500 })
  }
}
