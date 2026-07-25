import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// GET /api/superadmin/tenants — Solo SUPERADMIN
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Acceso denegado. Se requieren permisos de Super Administrador.' }, { status: 403 })
    }

    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            users: true,
            barbers: true,
            sales: true,
            appointments: true,
          },
        },
        users: {
          where: { role: 'ADMIN' },
          select: { email: true, name: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(tenants)
  } catch (error) {
    console.error('GET /api/superadmin/tenants error:', error)
    return NextResponse.json({ error: 'Error al obtener barberías' }, { status: 500 })
  }
}

// POST /api/superadmin/tenants — Crear nueva barbería con usuario Administrador
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Acceso denegado. Se requieren permisos de Super Administrador.' }, { status: 403 })
    }

    const body = await request.json()
    const { name, slug, adminName, adminEmail, adminPassword } = body

    if (!name || !name.trim()) return NextResponse.json({ error: 'El nombre de la barbería es requerido' }, { status: 400 })
    if (!slug || !slug.trim()) return NextResponse.json({ error: 'El slug es requerido' }, { status: 400 })
    if (!adminName || !adminName.trim()) return NextResponse.json({ error: 'El nombre del administrador es requerido' }, { status: 400 })
    if (!adminEmail || !adminEmail.trim()) return NextResponse.json({ error: 'El correo del administrador es requerido' }, { status: 400 })
    if (!adminPassword || adminPassword.length < 6) return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })

    const normalizedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')

    // Check slug uniqueness
    const existingTenant = await prisma.tenant.findUnique({ where: { slug: normalizedSlug } })
    if (existingTenant) {
      return NextResponse.json({ error: 'Ya existe una barbería con este slug / enlace.' }, { status: 409 })
    }

    // Check email uniqueness
    const existingUser = await prisma.user.findUnique({ where: { email: adminEmail.trim().toLowerCase() } })
    if (existingUser) {
      return NextResponse.json({ error: 'Ya existe un usuario registrado con este correo electrónico.' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: name.trim(),
          slug: normalizedSlug,
          isActive: true,
        },
      })

      // 2. Create Admin User
      const adminUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: adminName.trim(),
          email: adminEmail.trim().toLowerCase(),
          password: hashedPassword,
          role: 'ADMIN',
        },
      })

      // 3. Create Settings
      await tx.settings.create({
        data: {
          tenantId: tenant.id,
          businessName: name.trim(),
          businessSubtitle: 'Gestión Barbería',
          commissionRateService: 0.60,
          commissionRateProduct: 0.20,
          appointmentSlotMin: 30,
        },
      })

      // 4. Create default Expense Categories
      const defaultCategories = ['Insumos & Productos', 'Alquiler & Local', 'Servicios Públicos', 'Mantenimiento & Equipos', 'Nómina & Sueldos', 'Marketing & Publicidad']
      for (const catName of defaultCategories) {
        await tx.expenseCategory.create({
          data: {
            tenantId: tenant.id,
            name: catName,
          },
        })
      }

      return { tenant, adminUser }
    })

    return NextResponse.json({
      success: true,
      tenant: result.tenant,
      adminEmail: result.adminUser.email,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/superadmin/tenants error:', error)
    return NextResponse.json({ error: 'Error al crear la nueva barbería: ' + error.message }, { status: 500 })
  }
}
