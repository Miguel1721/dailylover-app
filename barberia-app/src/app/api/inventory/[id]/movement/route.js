import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// POST /api/inventory/[id]/movement
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = params
    const tenantId = session.user.tenantId

    const product = await prisma.product.findFirst({ where: { id, tenantId } })
    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }
    if (!product.isActive) {
      return NextResponse.json({ error: 'El producto está inactivo' }, { status: 400 })
    }

    const body = await request.json()
    const { type, quantity, reason } = body

    const validTypes = ['IN', 'OUT', 'ADJUSTMENT']
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ error: `Tipo de movimiento inválido: ${type}` }, { status: 400 })
    }
    if (!quantity || !Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'quantity debe ser un entero positivo' }, { status: 400 })
    }

    let newStock
    switch (type) {
      case 'IN':
        newStock = product.stock + quantity
        break
      case 'OUT':
        if (product.stock < quantity) {
          return NextResponse.json({ error: `Stock insuficiente. Disponible: ${product.stock}, solicitado: ${quantity}` }, { status: 400 })
        }
        newStock = product.stock - quantity
        break
      case 'ADJUSTMENT':
        newStock = quantity
        break
      default:
        newStock = product.stock
    }

    const [movement, updatedProduct] = await prisma.$transaction([
      prisma.inventoryMovement.create({
        data: {
          productId: id,
          type,
          quantity,
          reason: reason ?? null,
        },
      }),
      prisma.product.update({
        where: { id },
        data: { stock: newStock },
      }),
    ])

    return NextResponse.json(
      {
        movement,
        product: {
          ...updatedProduct,
          lowStock: updatedProduct.stock <= updatedProduct.minStock,
          previousStock: product.stock,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/inventory/[id]/movement]', error)
    return NextResponse.json({ error: 'Error al registrar movimiento de inventario', details: error.message }, { status: 500 })
  }
}
