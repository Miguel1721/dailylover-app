'use client'
import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Scissors, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl')

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email: form.email,
      password: form.password,
      redirect: false,
    })

    if (result?.error) {
      setLoading(false)
      setError('Email o contraseña incorrectos')
      return
    }

    try {
      const res = await fetch('/api/auth/session')
      const session = await res.json()
      setLoading(false)

      if (callbackUrl && callbackUrl !== '/login') {
        router.push(callbackUrl)
      } else if (session?.user?.role === 'SUPERADMIN') {
        router.push('/superadmin')
      } else {
        router.push('/pos')
      }
      router.refresh()
    } catch {
      setLoading(false)
      router.push('/pos')
      router.refresh()
    }
  }

  return (
    <div className="w-full max-w-md animate-fade-in">
      {/* Logo */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4 animate-pulse-gold"
             style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 8px 32px rgba(245,158,11,0.3)' }}>
          <Scissors size={36} className="text-black" />
        </div>
        <h1 className="text-3xl font-bold text-white">BarberPro</h1>
        <p className="text-dark-500 mt-2 text-sm">Sistema de Gestión para Barbería</p>
      </div>

      {/* Login Card */}
      <div className="card gradient-border">
        <h2 className="text-xl font-semibold text-white mb-1">Iniciar sesión</h2>
        <p className="text-dark-500 text-sm mb-6">Ingresa tus credenciales para continuar</p>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/20 border border-red-800/50 text-red-400 text-sm mb-5">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Email</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
              placeholder="admin@barberia.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="input-label">Contraseña</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input pr-10"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-400"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            id="btn-login"
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-base mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Ingresando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <LogIn size={18} />
                Ingresar
              </span>
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-dark-600 text-xs mt-6">
        BarberPro v1.0 — Sistema de gestión profesional
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full"
             style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full"
             style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 70%)' }} />
        <div className="absolute top-0 left-0 w-full h-1"
             style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.3), transparent)' }} />
      </div>

      <Suspense fallback={<div className="text-white text-sm">Cargando...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
