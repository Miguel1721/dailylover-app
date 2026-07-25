const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🏁 Iniciando migración de datos para Multi-Tenancy...')

  // 1. Crear el Tenant por defecto si no existe
  let tenant = await prisma.tenant.findUnique({
    where: { slug: 'el-campincito' }
  })

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'El Campincito Barber Club',
        slug: 'el-campincito',
        isActive: true
      }
    })
    console.log(`✅ Tenant por defecto creado: "${tenant.name}" (${tenant.id})`)
  } else {
    console.log(`ℹ️ Tenant por defecto ya existe: "${tenant.name}" (${tenant.id})`)
  }

  const tenantId = tenant.id

  // 2. Asociar todos los registros huérfanos con el nuevo Tenant
  
  // Usuarios
  const usersUpdated = await prisma.user.updateMany({
    where: { tenantId: null },
    data: { tenantId }
  })
  console.log(`👥 Usuarios asociados: ${usersUpdated.count}`)

  // Ascender al usuario administrador actual a SUPERADMIN
  const superadminEmails = ['admin@barberclub.com.co', 'admin@barberia.com']
  const adminUpgrade = await prisma.user.updateMany({
    where: {
      email: { in: superadminEmails }
    },
    data: {
      role: 'SUPERADMIN'
    }
  })
  console.log(`👑 Administradores ascendidos a SUPERADMIN: ${adminUpgrade.count}`)

  // Barberos
  const barbersUpdated = await prisma.barber.updateMany({
    where: { tenantId: null },
    data: { tenantId }
  })
  console.log(`💈 Barberos asociados: ${barbersUpdated.count}`)

  // Servicios
  const servicesUpdated = await prisma.service.updateMany({
    where: { tenantId: null },
    data: { tenantId }
  })
  console.log(`✂️ Servicios asociados: ${servicesUpdated.count}`)

  // Productos
  const productsUpdated = await prisma.product.updateMany({
    where: { tenantId: null },
    data: { tenantId }
  })
  console.log(`📦 Productos asociados: ${productsUpdated.count}`)

  // Citas
  const appointmentsUpdated = await prisma.appointment.updateMany({
    where: { tenantId: null },
    data: { tenantId }
  })
  console.log(`📅 Citas asociadas: ${appointmentsUpdated.count}`)

  // Ventas
  const salesUpdated = await prisma.sale.updateMany({
    where: { tenantId: null },
    data: { tenantId }
  })
  console.log(`💰 Ventas asociadas: ${salesUpdated.count}`)

  // Comisiones
  const commissionsUpdated = await prisma.commission.updateMany({
    where: { tenantId: null },
    data: { tenantId }
  })
  console.log(`💵 Comisiones asociadas: ${commissionsUpdated.count}`)

  // Categorías de Gastos
  const expenseCatsUpdated = await prisma.expenseCategory.updateMany({
    where: { tenantId: null },
    data: { tenantId }
  })
  console.log(`🗂️ Categorías de Gastos asociadas: ${expenseCatsUpdated.count}`)

  // Gastos
  const expensesUpdated = await prisma.expense.updateMany({
    where: { tenantId: null },
    data: { tenantId }
  })
  console.log(`💸 Gastos asociados: ${expensesUpdated.count}`)

  // Configuración (Settings)
  const settingsUpdated = await prisma.settings.updateMany({
    where: { tenantId: null },
    data: { tenantId }
  })
  console.log(`⚙️ Configuración asociada: ${settingsUpdated.count}`)

  console.log('🎉 Migración de datos completada exitosamente!')
}

main()
  .catch((e) => {
    console.error('❌ Error durante la migración de datos:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
