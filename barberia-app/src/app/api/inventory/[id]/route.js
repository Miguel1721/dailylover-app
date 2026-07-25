import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// GET /api/inventory/[id]
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = params
    const tenantId = session.user.tenantId

    const product = await prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      product: {
        ...product,
        lowStock: product.stock <= product.minStock,
      },
    })
  } catch (error) {
    console.error('[GET /api/inventory/[id]]', error)
    return NextResponse.json({ error: 'Error al obtener el producto', details: error.message }, { status: 500 })
  }
}

// PUT /api/inventory/[id]
export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { id } = params
    const tenantId = session.user.tenantId

    const existing = await prisma.product.findFirst({ where: { id, tenantId } })
    if (!existing) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const { name, description, costPrice, salePrice, minStock, photoUrl, isActive } = body

    const data = {}
    if (name !== undefined) {
      if (name.trim() === '') return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 })
      data.name = name.trim()
    }
    if (description !== undefined) data.description = description
    if (costPrice !== undefined) {
      if (costPrice < 0) return NextResponse.json({ error: 'costPrice debe ser positivo' }, { status: 400 })
      data.costPrice = costPrice
    }
    if (salePrice !== undefined) {
      if (salePrice < 0) return NextResponse.json({ error: 'salePrice debe ser positivo' }, { status: 400 })
      data.salePrice = salePrice
    }
    if (minStock !== undefined) data.minStock = minStock
    if (photoUrl !== undefined) data.photoUrl = photoUrl
    if (isActive !== undefined) data.isActive = isActive

    const product = await prisma.product.update({ where: { id }, data })

    return NextResponse.json({
      product: { ...product, lowStock: product.stock <= product.minStock },
    })
  } catch (error) {
    console.error('[PUT /api/inventory/[id]]', error)
    return NextResponse.json({ error: 'Error al actualizar el producto', details: error.message }, { status: 500 })
  }
}

// DELETE /api/inventory/[id]
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { id } = params
    const tenantId = session.user.tenantId

    const existing = await prisma.product.findFirst({ where: { id, tenantId } })
    if (!existing) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    const product = await prisma.product.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ product })
  } catch (error) {
    console.error('[DELETE /api/inventory/[id]]', error)
    return NextResponse.json({ error: 'Error al desactivar el producto', details: error.message }, { status: 500 })
  }
}
