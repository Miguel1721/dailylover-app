const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const ALL_SLOTS = []
for (let h = 8; h < 19; h++) {
  ALL_SLOTS.push(`${h.toString().padStart(2, '0')}:00`)
  if (h < 18) ALL_SLOTS.push(`${h.toString().padStart(2, '0')}:30`)
}

const FULL_WEEK_SCHEDULE = {
  Mon: [...ALL_SLOTS],
  Tue: [...ALL_SLOTS],
  Wed: [...ALL_SLOTS],
  Thu: [...ALL_SLOTS],
  Fri: [...ALL_SLOTS],
  Sat: [...ALL_SLOTS],
  Sun: [...ALL_SLOTS],
}

async function main() {
  console.log('🌱 Iniciando seed multi-tenant de El Campincito Barber Club...')

  // 0. Tenant por defecto
  let tenant = await prisma.tenant.findUnique({
    where: { slug: 'el-campincito' },
  })

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'El Campincito Barber Club',
        slug: 'el-campincito',
        isActive: true,
      },
    })
  }
  const tenantId = tenant.id

  // 1. Settings
  await prisma.settings.upsert({
    where: { tenantId },
    update: {},
    create: {
      tenantId,
      businessName: 'El Campincito Barber Club',
      businessSubtitle: 'Tradición & Estilo',
      businessPhone: '',
      businessAddress: '',
      businessEmail: 'admin@barberclub.com.co',
      logoUrl: '/logo.jpeg',
      commissionRateService: 0.60,
      commissionRateProduct: 0.20,
      appointmentSlotMin: 30,
      businessHours: FULL_WEEK_SCHEDULE,
    },
  })
  console.log('✅ Settings creados para el tenant')

  // 2a. Super Admin General (super-admin@barberclub.com.co)
  const superAdminEmail = 'super-admin@barberclub.com.co'
  const superHashedPassword = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!', 10)

  const existingSuperAdmin = await prisma.user.findUnique({ where: { email: superAdminEmail } })
  if (!existingSuperAdmin) {
    await prisma.user.create({
      data: {
        tenantId,
        email: superAdminEmail,
        password: superHashedPassword,
        name: 'Super Administrador',
        role: 'SUPERADMIN',
      },
    })
  } else {
    await prisma.user.update({
      where: { email: superAdminEmail },
      data: { role: 'SUPERADMIN', password: superHashedPassword },
    })
  }
  console.log('✅ Super Admin configurado:', superAdminEmail)

  // 2b. Admin de Barbería (admin@barberclub.com.co)
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@barberclub.com.co'
  const adminHashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin123!', 10)

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        tenantId,
        email: adminEmail,
        password: adminHashedPassword,
        name: 'Administrador Campincito',
        role: 'ADMIN',
      },
    })
  } else {
    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: 'ADMIN', tenantId, password: adminHashedPassword },
    })
  }
  console.log('✅ Admin local configurado:', adminEmail)

  // 3. Barberos (Hombres)
  for (let i = 1; i <= 6; i++) {
    const bId = `barber-seed-${i}`
    const existingBarber = await prisma.barber.findUnique({ where: { id: bId } })
    if (!existingBarber) {
      await prisma.barber.create({
        data: {
          id: bId,
          tenantId,
          name: `Barbero ${i}`,
          specialty: 'Cortes y diseños',
          phone: '',
          category: 'BARBERIA',
          isActive: true,
          schedule: FULL_WEEK_SCHEDULE,
        },
      })
    }
  }

  // 3b. Estilistas (Mujeres)
  for (let i = 1; i <= 3; i++) {
    const eId = `estilista-seed-${i}`
    const existingEstilista = await prisma.barber.findUnique({ where: { id: eId } })
    if (!existingEstilista) {
      await prisma.barber.create({
        data: {
          id: eId,
          tenantId,
          name: `Estilista ${i}`,
          specialty: 'Peluquería y Estética Femenina',
          phone: '',
          category: 'PELUQUERIA',
          isActive: true,
          schedule: FULL_WEEK_SCHEDULE,
        },
      })
    }
  }
  console.log('✅ Barberos y Estilistas verificados')

  // 4. Servicios de Barbería (Hombres)
  const serviciosBarberia = [
    { id: 'svc-premium', name: 'Club Premium', description: 'La experiencia VIP completa', price: 70000, durationMinutes: 80, category: 'BARBERIA' },
    { id: 'svc-silver', name: 'Club Silver', description: 'Corte y barba con exfoliación', price: 50000, durationMinutes: 60, category: 'BARBERIA' },
    { id: 'svc-personalizado-barba-cejas', name: 'Corte Personalizado + Barba + Exfoliación Cejas', description: 'Corte a tijera o máquina, perfilado de barba y cejas.', price: 42000, durationMinutes: 45, category: 'BARBERIA' },
    { id: 'svc-tradicional-barba', name: 'Corte Tradicional + Barba', description: 'Corte clásico y arreglo de barba.', price: 38000, durationMinutes: 45, category: 'BARBERIA' },
    { id: 'svc-corte-cejas', name: 'Corte + Cejas', description: 'Corte de cabello y depilación/perfilado de cejas.', price: 30000, durationMinutes: 35, category: 'BARBERIA' },
    { id: 'svc-solo-corte', name: 'Corte Solo Cabello', description: 'Corte de cabello masculino.', price: 27000, durationMinutes: 30, category: 'BARBERIA' },
    { id: 'svc-solo-barba', name: 'Barba Impecable', description: 'Perfilado y arreglo de barba.', price: 20000, durationMinutes: 25, category: 'BARBERIA' },
    { id: 'svc-padre-hijo', name: 'Combo Padre e Hijo', description: 'Dos cortes en la misma sesión.', price: 50000, durationMinutes: 60, category: 'BARBERIA' },
    { id: 'svc-limpieza-facial', name: 'Limpieza Facial con Vaporozono', description: 'Tratamiento facial hidratante y desincrustante.', price: 25000, durationMinutes: 30, category: 'BARBERIA' },
    { id: 'svc-mascarilla-negra', name: 'Mascarilla Negra de Carbón', description: 'Extracción de puntos negros y toxinas.', price: 15000, durationMinutes: 20, category: 'BARBERIA' },
  ]

  // 4b. Servicios de Peluquería (Mujeres)
  const serviciosMujeres = [
    { id: 'svc-corte-recto', name: 'Corte Recto', description: 'Corte femenino clásico de puntas e igualado.', price: 16000, durationMinutes: 30, category: 'PELUQUERIA' },
    { id: 'svc-corte-v', name: 'Corte en V', description: 'Corte en capas o forma en V estilizado.', price: 20000, durationMinutes: 30, category: 'PELUQUERIA' },
    { id: 'svc-corte-v-cepillado', name: 'Corte en V + Cepillado', description: 'Corte en forma en V con acabado de cepillado.', price: 35000, durationMinutes: 45, category: 'PELUQUERIA' },
    { id: 'svc-otros-cortes-mujeres', name: 'Otros Cortes de Mujer', description: 'Cortes estilizados según preferencia.', price: 27000, durationMinutes: 35, category: 'PELUQUERIA' },
    { id: 'svc-grafilados', name: 'Grafilados', description: 'Corte y desfilado para dar volumen y movimiento.', price: 20000, durationMinutes: 30, category: 'PELUQUERIA' },
    { id: 'svc-grafilados-cepillado', name: 'Grafilados con Cepillado', description: 'Grafilado con moldeo y cepillado profesional.', price: 35000, durationMinutes: 45, category: 'PELUQUERIA' },
    { id: 'svc-planchado', name: 'Planchado de Cabello', description: 'Alisado térmico con plancha profesional.', price: 20000, durationMinutes: 30, category: 'PELUQUERIA' },
    { id: 'svc-cepillado-planchado-corto', name: 'Cepillado y Planchado Cabello Corto', description: 'Peinado completo para cabello corto.', price: 25000, durationMinutes: 40, category: 'PELUQUERIA' },
    { id: 'svc-cepillado-planchado-largo', name: 'Cepillado y Planchado Cabello Largo', description: 'Peinado completo para cabello largo.', price: 30000, durationMinutes: 50, category: 'PELUQUERIA' },
    { id: 'svc-keratina-largo', name: 'Keratina Cabello Largo', description: 'Tratamiento alisador e hidratante para cabello largo.', price: 200000, durationMinutes: 120, category: 'PELUQUERIA' },
    { id: 'svc-keratina-corto', name: 'Keratina Cabello Corto', description: 'Tratamiento alisador e hidratante para cabello corto.', price: 180000, durationMinutes: 90, category: 'PELUQUERIA' },
  ]

  const todosServicios = [...serviciosBarberia, ...serviciosMujeres]

  for (const s of todosServicios) {
    const existingSvc = await prisma.service.findUnique({ where: { id: s.id } })
    if (!existingSvc) {
      await prisma.service.create({
        data: {
          id: s.id,
          tenantId,
          ...s,
        },
      })
    }
  }
  console.log('✅ Servicios de Barbería y Peluquería verificados')

  // 5. Categorías de Gastos
  const categorias = ['Alquiler & Local', 'Insumos & Barbería', 'Servicios Públicos', 'Mantenimiento', 'Nómina & Comisiones', 'Publicidad & Marketing', 'Aseo & Limpieza', 'Snacks & Bebidas', 'Impuestos & Licencias', 'Otros Gastos']

  for (const catName of categorias) {
    const existingCat = await prisma.expenseCategory.findUnique({
      where: { name_tenantId: { name: catName, tenantId } },
    })
    if (!existingCat) {
      await prisma.expenseCategory.create({
        data: {
          tenantId,
          name: catName,
        },
      })
    }
  }
  console.log('✅ Categorías de gastos verificadas')

  console.log('🎉 Seed multi-tenant completado exitosamente!')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
