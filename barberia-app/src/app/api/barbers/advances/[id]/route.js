import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'

// DELETE /api/barbers/advances/[id]
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!['ADMIN', 'CASHIER', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const tenantId = session.user.tenantId
    const { id } = params

    const advance = await prisma.barberAdvance.findFirst({
      where: { id, tenantId },
    })

    if (!advance) {
      return NextResponse.json({ error: 'Vale no encontrado' }, { status: 404 })
    }

    if (advance.status === 'DEDUCTED') {
      return NextResponse.json({ error: 'No se puede eliminar un vale que ya ha sido descontado en una liquidación' }, { status: 400 })
    }

    await prisma.barberAdvance.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Vale anulado correctamente' })
  } catch (error) {
    console.error('[DELETE /api/barbers/advances/[id]]', error)
    return NextResponse.json({ error: 'Error al eliminar vale', details: error.message }, { status: 500 })
  }
}
