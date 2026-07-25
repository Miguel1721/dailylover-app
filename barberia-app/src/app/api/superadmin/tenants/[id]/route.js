import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// PUT /api/superadmin/tenants/[id] — Activar / Desactivar Barbería
export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { isActive, name, slug } = body

    const existing = await prisma.tenant.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Barbería no encontrada' }, { status: 404 })
    }

    const updateData = {}
    if (isActive !== undefined) updateData.isActive = Boolean(isActive)
    if (name !== undefined) updateData.name = name.trim()
    if (slug !== undefined) {
      const normalizedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
      const conflict = await prisma.tenant.findFirst({ where: { slug: normalizedSlug, id: { not: id } } })
      if (conflict) {
        return NextResponse.json({ error: 'El slug ya pertenece a otra barbería' }, { status: 409 })
      }
      updateData.slug = normalizedSlug
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, tenant: updated })
  } catch (error) {
    console.error('PUT /api/superadmin/tenants/[id] error:', error)
    return NextResponse.json({ error: 'Error al actualizar barbería' }, { status: 500 })
  }
}
