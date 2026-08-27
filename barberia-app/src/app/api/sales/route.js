import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getColombiaDateRange } from '@/lib/dateUtils'

const SALE_INCLUDE = {
  barber: {
    select: { id: true, name: true, specialty: true, photoUrl: true },
  },
  items: {
    include: {
      service: {
        select: { id: true, name: true, price: true, durationMinutes: true, commissionRate: true },
      },
      product: {
        select: { id: true, name: true, salePrice: true, costPrice: true },
      },
    },
  },
  commission: true,
  appointment: {
    select: { id: true, clientName: true, date: true, timeSlot: true, status: true },
  },
}

// GET /api/sales
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const tenantId = session.user.tenantId
    const { searchParams } = new URL(request.url)
    const barberId = searchParams.get('barberId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const paymentMethod = searchParams.get('paymentMethod')

    const where = { tenantId }

    if (barberId) where.barberId = barberId
    if (paymentMethod) where.paymentMethod = paymentMethod

    if (startDate || endDate) {
      const { start, end } = getColombiaDateRange(startDate, endDate)
      where.createdAt = { gte: start, lte: end }
    }

    const sales = await prisma.sale.findMany({
      where,
      include: SALE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })

    const summary = {
      count: sales.length,
      totalRevenue: sales.reduce((acc, s) => acc + s.total, 0),
      totalDiscount: sales.reduce((acc, s) => acc + s.discount, 0),
    }

    return NextResponse.json({ sales, summary })
  } catch (error) {
    console.error('[GET /api/sales]', error)
    return NextResponse.json(
      { error: 'Error al obtener las ventas', details: error.message },
      { status: 500 }
    )
  }
}

// POST /api/sales
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const tenantId = session.user.tenantId
    const body = await request.json()
    const {
      appointmentId,
      barberId,
      clientName,
      paymentMethod = 'CASH',
      discount = 0,
      items,
    } = body

    if (!barberId) {
      return NextResponse.json({ error: 'barberId es requerido' }, { status: 400 })
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un ítem' }, { status: 400 })
    }

    const validItemTypes = ['SERVICE', 'PRODUCT']
    const validPaymentMethods = ['CASH', 'NEQUI', 'TRANSFER', 'CARD', 'MIXED']

    if (!validPaymentMethods.includes(paymentMethod)) {
      return NextResponse.json({ error: `paymentMethod inválido: ${paymentMethod}` }, { status: 400 })
    }

    for (const item of items) {
      if (!validItemTypes.includes(item.itemType)) {
        return NextResponse.json({ error: `itemType inválido: ${item.itemType}` }, { status: 400 })
      }
      if (item.itemType === 'SERVICE' && !item.serviceId) {
        return NextResponse.json({ error: 'serviceId es requerido para ítems SERVICE' }, { status: 400 })
      }
      if (item.itemType === 'PRODUCT' && !item.productId) {
        return NextResponse.json({ error: 'productId es requerido para ítems PRODUCT' }, { status: 400 })
      }
      if (item.unitPrice === undefined || item.unitPrice < 0) {
        return NextResponse.json({ error: 'unitPrice debe ser positivo' }, { status: 400 })
      }
    }

    const barber = await prisma.barber.findFirst({ where: { id: barberId, tenantId } })
    if (!barber) return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 })
    if (!barber.isActive) return NextResponse.json({ error: 'El barbero está inactivo' }, { status: 400 })

    const settings = await prisma.settings.findUnique({ where: { tenantId } }).catch(() => null)
    const globalServiceRate = settings?.commissionRateService ?? 0.60
    const globalProductRate = settings?.commissionRateProduct ?? 0.20
    const barberServiceRate = barber.commissionRateService ?? globalServiceRate
    const productCommissionRate = barber.commissionRateProduct ?? globalProductRate

    if (appointmentId) {
      const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, tenantId } })
      if (!appointment) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })

      const existingSale = await prisma.sale.findUnique({ where: { appointmentId } })
      if (existingSale) return NextResponse.json({ error: 'Esta cita ya tiene una venta asociada' }, { status: 409 })
    }

    const serviceItems = items.filter((i) => i.itemType === 'SERVICE')
    let serviceTotal = 0
    let serviceCommissionTotal = 0

    for (const item of serviceItems) {
      const service = await prisma.service.findFirst({ where: { id: item.serviceId, tenantId } })
      if (!service) return NextResponse.json({ error: `Servicio no encontrado: ${item.serviceId}` }, { status: 404 })
      if (!service.isActive) return NextResponse.json({ error: `Servicio inactivo: ${service.name}` }, { status: 400 })

      const qty = item.quantity ?? 1
      const itemTotal = item.unitPrice * qty
      serviceTotal += itemTotal

      const itemRate = service.commissionRate ?? barberServiceRate
      serviceCommissionTotal += itemTotal * itemRate
    }

    const productItems = items.filter((i) => i.itemType === 'PRODUCT')
    let productTotal = 0
    let productCommissionTotal = 0

    for (const item of productItems) {
      const product = await prisma.product.findFirst({ where: { id: item.productId, tenantId } })
      if (!product) return NextResponse.json({ error: `Producto no encontrado: ${item.productId}` }, { status: 404 })
      if (!product.isActive) return NextResponse.json({ error: `Producto inactivo: ${product.name}` }, { status: 400 })
      const qty = item.quantity ?? 1
      if (product.stock < qty) {
        return NextResponse.json(
          { error: `Stock insuficiente para "${product.name}". Disponible: ${product.stock}, solicitado: ${qty}` },
          { status: 400 }
        )
      }

      const itemTotal = item.unitPrice * qty
      productTotal += itemTotal
      productCommissionTotal += itemTotal * productCommissionRate
    }

    const subtotal = items.reduce((acc, item) => acc + item.unitPrice * (item.quantity ?? 1), 0)
    const total = Math.max(0, subtotal - discount)
    const totalCommissionAmount = serviceCommissionTotal + productCommissionTotal
    const effectiveCommissionRate = (serviceTotal + productTotal) > 0 ? (totalCommissionAmount / (serviceTotal + productTotal)) : barberServiceRate

    const sale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          tenantId,
          barberId,
          clientName: clientName ?? null,
          paymentMethod,
          subtotal,
          discount,
          total,
          ...(appointmentId ? { appointmentId } : {}),
        },
      })

      const saleItemsData = items.map((item) => ({
        saleId: newSale.id,
        itemType: item.itemType,
        serviceId: item.serviceId ?? null,
        productId: item.productId ?? null,
        quantity: item.quantity ?? 1,
        unitPrice: item.unitPrice,
        total: item.unitPrice * (item.quantity ?? 1),
      }))

      await tx.saleItem.createMany({ data: saleItemsData })

      if (serviceTotal > 0 || productTotal > 0) {
        await tx.commission.create({
          data: {
            tenantId,
            barberId,
            saleId: newSale.id,
            serviceTotal: serviceTotal + productTotal,
            commissionRate: effectiveCommissionRate,
            commissionAmount: totalCommissionAmount,
          },
        })
      }

      for (const item of productItems) {
        const qty = item.quantity ?? 1
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: qty } },
        })

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: 'OUT',
            quantity: qty,
            reason: `Venta #${newSale.id}`,
          },
        })
      }

      if (appointmentId) {
        await tx.appointment.update({
          where: { id: appointmentId },
          data: { status: 'COMPLETED' },
        })
      }

      return tx.sale.findUnique({
        where: { id: newSale.id },
        include: SALE_INCLUDE,
      })
    })

    return NextResponse.json({ sale }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/sales]', error)
    return NextResponse.json(
      { error: 'Error al crear la venta', details: error.message },
      { status: 500 }
    )
  }
}
