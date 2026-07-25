const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Limpiando datos de prueba...')

  await prisma.commission.deleteMany({})
  console.log('✅ Comisiones eliminadas')

  await prisma.saleItem.deleteMany({})
  console.log('✅ Ítems de venta eliminados')

  await prisma.sale.deleteMany({})
  console.log('✅ Ventas eliminadas')

  await prisma.appointmentService.deleteMany({})
  console.log('✅ Servicios de citas eliminados')

  await prisma.appointment.deleteMany({})
  console.log('✅ Citas eliminadas')

  await prisma.inventoryMovement.deleteMany({})
  console.log('✅ Movimientos de inventario eliminados')

  await prisma.product.deleteMany({})
  console.log('✅ Productos de inventario eliminados')

  await prisma.expense.deleteMany({})
  console.log('✅ Gastos eliminados')

  console.log('🎉 Sistema limpio y listo para producción!')
}

main()
  .catch((e) => {
    console.error('❌ Error en limpieza:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
