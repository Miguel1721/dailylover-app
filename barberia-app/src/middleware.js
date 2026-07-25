import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const { pathname } = req.nextUrl

  // Alias o tipeos comunes para superadmin
  if (pathname === '/admin' || pathname === '/super-admin') {
    return NextResponse.redirect(new URL('/superadmin', req.url))
  }

  // Rutas públicas (portal de reservas cliente, login, apis públicas, health, auth)
  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/b/') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/public')

  if (isPublic) {
    return NextResponse.next()
  }

  // Sin sesión → redirigir a login
  if (!token) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Si trata de entrar a /superadmin y no es SUPERADMIN → redirigir a /pos
  if (pathname.startsWith('/superadmin') && token.role !== 'SUPERADMIN') {
    return NextResponse.redirect(new URL('/pos', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
