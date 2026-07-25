import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export default async function RootPage() {
  const session = await getServerSession(authOptions)

  if (session) {
    if (session.user.role === 'SUPERADMIN') {
      redirect('/superadmin')
    } else {
      redirect('/pos')
    }
  }

  // Redirigir por defecto al catálogo/reserva del tenant por defecto
  redirect('/b/el-campincito')
}
