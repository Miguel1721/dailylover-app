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
      data: { role: 'ADMIN', password: adminHashedPassword },
    })
  }
  console.log('✅ Admin configurado:', adminEmail)

  // 3. Barberos y Estilistas Femeninas por defecto
  const barberosDefecto = [
    { id: 'barber-juan', name: 'Juan Sanchez', specialty: 'Cortes urbanos, desvanecidos y cejas', phone: '3001234567', category: 'BARBERIA' },
    { id: 'barber-daniel', name: 'Daniel', specialty: 'Cortes clásicos, barba e hidratación', phone: '3007654321', category: 'BARBERIA' },
    { id: 'barber-miguel', name: 'Miguel', specialty: 'Estilo clásico y diseño de barba', phone: '3019876543', category: 'BARBERIA' },
  ]

  for (const b of barberosDefecto) {
    const existingBarber = await prisma.barber.findUnique({ where: { id: b.id } })
    if (!existingBarber) {
      await prisma.barber.create({
        data: {
          ...b,
          tenantId,
          isActive: true,
          schedule: FULL_WEEK_SCHEDULE,
        },
      })
    }
  }

  // Estilistas para servicios de mujeres
  for (let i = 1; i <= 3; i++) {
    const eId = `estilista-${i}`
    const existingEstilista = await prisma.barber.findUnique({ where: { id: eId } })
    if (!existingEstilista) {
      await prisma.barber.create({
        data: {
          id: eId,
          tenantId,
          name: `Estilista ${i}`,
          specialty: 'Peluquería, Manicure y Estética Femenina',
          phone: '',
          category: 'PELUQUERIA',
          commissionRateService: 0.70,
          isActive: true,
          schedule: FULL_WEEK_SCHEDULE,
        },
      })
    }
  }
  console.log('✅ Barberos y Estilistas verificados')

  // 4. Servicios de Barbería (Hombres - 60% por defecto)
  const serviciosBarberia = [
    { id: 'svc-premium', name: 'Club Premium', description: 'La experiencia VIP completa', price: 70000, durationMinutes: 80, category: 'BARBERIA', commissionRate: 0.60 },
    { id: 'svc-silver', name: 'Club Silver', description: 'Corte y barba con exfoliación', price: 50000, durationMinutes: 60, category: 'BARBERIA', commissionRate: 0.60 },
    { id: 'svc-personalizado-barba-cejas', name: 'Corte Personalizado + Barba + Exfoliación Cejas', description: 'Corte a tijera o máquina, perfilado de barba y cejas.', price: 42000, durationMinutes: 45, category: 'BARBERIA', commissionRate: 0.60 },
    { id: 'svc-tradicional-barba', name: 'Corte Tradicional + Barba', description: 'Corte clásico y arreglo de barba.', price: 38000, durationMinutes: 45, category: 'BARBERIA', commissionRate: 0.60 },
    { id: 'svc-corte-cejas', name: 'Corte + Cejas', description: 'Corte de cabello y depilación/perfilado de cejas.', price: 30000, durationMinutes: 35, category: 'BARBERIA', commissionRate: 0.60 },
    { id: 'svc-solo-corte', name: 'Corte Solo Cabello', description: 'Corte de cabello masculino.', price: 27000, durationMinutes: 30, category: 'BARBERIA', commissionRate: 0.60 },
    { id: 'svc-solo-barba', name: 'Barba Impecable', description: 'Perfilado y arreglo de barba.', price: 20000, durationMinutes: 25, category: 'BARBERIA', commissionRate: 0.60 },
    { id: 'svc-padre-hijo', name: 'Combo Padre e Hijo', description: 'Dos cortes en la misma sesión.', price: 50000, durationMinutes: 60, category: 'BARBERIA', commissionRate: 0.60 },
    { id: 'svc-limpieza-facial', name: 'Limpieza Facial con Vaporozono', description: 'Tratamiento facial hidratante y desincrustante.', price: 25000, durationMinutes: 30, category: 'BARBERIA', commissionRate: 0.60 },
    { id: 'svc-mascarilla-negra', name: 'Mascarilla Negra de Carbón', description: 'Extracción de puntos negros y toxinas.', price: 15000, durationMinutes: 20, category: 'BARBERIA', commissionRate: 0.60 },
  ]

  // 4b. Servicios de Peluquería / Cabello Femenino (50% Comisión)
  const serviciosMujeresCabello = [
    { id: 'svc-corte-recto', name: 'Corte recto', description: 'Corte femenino clásico de puntas e igualado', price: 16000, durationMinutes: 30, category: 'PELUQUERIA', commissionRate: 0.50 },
    { id: 'svc-corte-v', name: 'Corte en V', description: 'Corte en capas o forma en V estilizado', price: 20000, durationMinutes: 30, category: 'PELUQUERIA', commissionRate: 0.50 },
    { id: 'svc-corte-v-cepillado', name: 'Corte en V + cepillado', description: 'Corte en forma en V con acabado de cepillado', price: 35000, durationMinutes: 45, category: 'PELUQUERIA', commissionRate: 0.50 },
    { id: 'svc-otros-cortes-mujeres', name: 'Otros cortes', description: 'Cortes estilizados de mujer según preferencia', price: 27000, durationMinutes: 35, category: 'PELUQUERIA', commissionRate: 0.50 },
    { id: 'svc-grafilados', name: 'Grafilados', description: 'Corte y desfilado para dar volumen y movimiento', price: 20000, durationMinutes: 30, category: 'PELUQUERIA', commissionRate: 0.50 },
    { id: 'svc-grafilados-cepillado', name: 'Grafilados con cepillado', description: 'Grafilado con moldeo y cepillado profesional', price: 35000, durationMinutes: 45, category: 'PELUQUERIA', commissionRate: 0.50 },
    { id: 'svc-planchado', name: 'Planchado', description: 'Alisado térmico con plancha profesional', price: 20000, durationMinutes: 30, category: 'PELUQUERIA', commissionRate: 0.50 },
    { id: 'svc-cepillado-planchado-corto', name: 'Cepillado y planchado cabello corto', description: 'Peinado completo para cabello corto', price: 25000, durationMinutes: 40, category: 'PELUQUERIA', commissionRate: 0.50 },
    { id: 'svc-cepillado-planchado-largo', name: 'Cepillado y planchado cabello largo', description: 'Peinado completo para cabello largo', price: 30000, durationMinutes: 50, category: 'PELUQUERIA', commissionRate: 0.50 },
    { id: 'svc-keratina-largo', name: 'Keratina cabello largo', description: 'Tratamiento alisador e hidratante para cabello largo', price: 150000, durationMinutes: 120, category: 'PELUQUERIA', commissionRate: 0.50 },
    { id: 'svc-keratina-corto', name: 'Keratina cabello corto', description: 'Tratamiento alisador e hidratante para cabello corto', price: 120000, durationMinutes: 90, category: 'PELUQUERIA', commissionRate: 0.50 },
  ]

  // 4c. Servicios de Manicure, Pedicure & Uñas (70% Comisión)
  const serviciosUnasManicure = [
    { id: 'svc-tradicional-tapa-azul', name: 'Tradicional tapa azul', description: 'Manicure tradicional con esmalte tapa azul', price: 18000, durationMinutes: 30, category: 'PELUQUERIA', commissionRate: 0.70 },
    { id: 'svc-tradicional-secado-rapido', name: 'Tradicional secado rápido tapa negra', description: 'Manicure tradicional con secado rápido esmalte tapa negra', price: 23000, durationMinutes: 35, category: 'PELUQUERIA', commissionRate: 0.70 },
    { id: 'svc-pies-limpieza', name: 'Pies limpieza', description: 'Limpieza profunda de pies', price: 24000, durationMinutes: 35, category: 'PELUQUERIA', commissionRate: 0.70 },
    { id: 'svc-pies-tradicional-tapa-azul', name: 'Pies tradicional tapa azul', description: 'Pedicure tradicional con esmalte tapa azul', price: 26000, durationMinutes: 40, category: 'PELUQUERIA', commissionRate: 0.70 },
    { id: 'svc-pies-tradicional-tapa-negra', name: 'Pies tradicional tapa negra', description: 'Pedicure tradicional con esmalte tapa negra', price: 28000, durationMinutes: 45, category: 'PELUQUERIA', commissionRate: 0.70 },
    { id: 'svc-semi-manos', name: 'Semi manos', description: 'Maquillaje semipermanente de manos', price: 50000, durationMinutes: 50, category: 'PELUQUERIA', commissionRate: 0.70 },
    { id: 'svc-semi-pies', name: 'Semi pies', description: 'Maquillaje semipermanente de pies', price: 60000, durationMinutes: 60, category: 'PELUQUERIA', commissionRate: 0.70 },
    { id: 'svc-base-ruber', name: 'Base ruber', description: 'Aplicación de Base Ruber de alta resistencia', price: 60000, durationMinutes: 60, category: 'PELUQUERIA', commissionRate: 0.70 },
    { id: 'svc-press-on', name: 'Press-on', description: 'Uñas Press-On reutilizables', price: 90000, durationMinutes: 60, category: 'PELUQUERIA', commissionRate: 0.70 },
    { id: 'svc-acrilico-tip', name: 'Acrílico con tip', description: 'Uñas acrílicas con extensión de tip', price: 110000, durationMinutes: 90, category: 'PELUQUERIA', commissionRate: 0.70 },
    { id: 'svc-acrilico-esculpida', name: 'Acrílico esculpida', description: 'Uñas acrílicas esculpidas a mano', price: 120000, durationMinutes: 100, category: 'PELUQUERIA', commissionRate: 0.70 },
    { id: 'svc-poly-gel-tip', name: 'Poly gel con tip', description: 'Uñas en Poly Gel con tip', price: 120000, durationMinutes: 90, category: 'PELUQUERIA', commissionRate: 0.70 },
    { id: 'svc-poly-gel-esculpida', name: 'Poly gel esculpida', description: 'Uñas en Poly Gel esculpidas', price: 130000, durationMinutes: 100, category: 'PELUQUERIA', commissionRate: 0.70 },
    { id: 'svc-diping', name: 'Diping', description: 'Sistema de uñas en polvo dipping', price: 65000, durationMinutes: 60, category: 'PELUQUERIA', commissionRate: 0.70 },
    { id: 'svc-mantenimiento-diping', name: 'Mantenimiento de diping', description: 'Mantenimiento y retoque de dipping', price: 60000, durationMinutes: 50, category: 'PELUQUERIA', commissionRate: 0.70 },
    { id: 'svc-mantenimiento-ruber', name: 'Mantenimiento de ruber', description: 'Mantenimiento y nivelación de Ruber', price: 55000, durationMinutes: 50, category: 'PELUQUERIA', commissionRate: 0.70 },
    { id: 'svc-ojo-gato', name: 'Ojo de gato', description: 'Efecto decorativo ojo de gato (+ $5.000)', price: 5000, durationMinutes: 15, category: 'PELUQUERIA', commissionRate: 0.70 },
    { id: 'svc-decoracion-1-una', name: 'Decoración 1 uña', description: 'Diseño/decoración por uña (+ $5.000)', price: 5000, durationMinutes: 10, category: 'PELUQUERIA', commissionRate: 0.70 },
    { id: 'svc-piedreria', name: 'Piedrería', description: 'Aplicación de piedras decorativas (+ $2.000)', price: 2000, durationMinutes: 10, category: 'PELUQUERIA', commissionRate: 0.70 },
  ]

  const todosServicios = [...serviciosBarberia, ...serviciosMujeresCabello, ...serviciosUnasManicure]

  for (const s of todosServicios) {
    await prisma.service.upsert({
      where: { id: s.id },
      update: {
        name: s.name,
        price: s.price,
        durationMinutes: s.durationMinutes,
        description: s.description,
        category: s.category,
        commissionRate: s.commissionRate || null,
        isActive: true,
      },
      create: {
        id: s.id,
        tenantId,
        ...s,
      },
    })
  }
  console.log('✅ Todos los servicios de Barbería (60%), Cabello Femenino (50%) y Uñas (70%) guardados correctamente')

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
