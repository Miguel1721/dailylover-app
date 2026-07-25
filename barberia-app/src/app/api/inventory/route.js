import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// GET /api/inventory
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const tenantId = session.user.tenantId
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const lowStockOnly = searchParams.get('lowStockOnly') === 'true'

    const where = {
      tenantId,
      ...(includeInactive ? {} : { isActive: true }),
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    const productsWithFlag = products.map((p) => ({
      ...p,
      lowStock: p.stock <= p.minStock,
    }))

    const result = lowStockOnly
      ? productsWithFlag.filter((p) => p.lowStock)
      : productsWithFlag

    const summary = {
      total: result.length,
      lowStockCount: result.filter((p) => p.lowStock).length,
    }

    return NextResponse.json({ products: result, summary })
  } catch (error) {
    console.error('[GET /api/inventory]', error)
    return NextResponse.json(
      { error: 'Error al obtener el inventario', details: error.message },
      { status: 500 }
    )
  }
}

// POST /api/inventory
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const tenantId = session.user.tenantId
    const body = await request.json()
    const { name, description, costPrice, salePrice, stock, minStock, photoUrl } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'El nombre del producto es requerido' }, { status: 400 })
    }
    if (costPrice === undefined || costPrice < 0) {
      return NextResponse.json({ error: 'costPrice debe ser un número positivo' }, { status: 400 })
    }
    if (salePrice === undefined || salePrice < 0) {
      return NextResponse.json({ error: 'salePrice debe ser un número positivo' }, { status: 400 })
    }

    const product = await prisma.product.create({
      data: {
        tenantId,
        name: name.trim(),
        description: description ?? null,
        costPrice,
        salePrice,
        stock: stock ?? 0,
        minStock: minStock ?? 5,
        photoUrl: photoUrl ?? null,
      },
    })

    if ((stock ?? 0) > 0) {
      await prisma.inventoryMovement.create({
        data: {
          productId: product.id,
          type: 'IN',
          quantity: stock,
          reason: 'Stock inicial al crear producto',
        },
      })
    }

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/inventory]', error)
    return NextResponse.json(
      { error: 'Error al crear el producto', details: error.message },
      { status: 500 }
    )
  }
}
