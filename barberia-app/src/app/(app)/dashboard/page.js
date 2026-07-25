'use client'
import { useState, useEffect } from 'react'
import {
  CalendarDays, ShoppingCart, DollarSign, Users,
  TrendingUp, Package, Clock, CheckCircle, AlertTriangle, Scissors
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)

export default function DashboardPage() {
  const [summary, setSummary] = useState(null)
  const [todayAppointments, setTodayAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const today = new Date()
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

  useEffect(() => {
    const load = async () => {
      try {
        const [sumRes, appRes] = await Promise.all([
          fetch(`/api/finance/summary?startDate=${todayStr}&endDate=${todayStr}`),
          fetch(`/api/appointments?date=${todayStr}`),
        ])
        const [sumData, appData] = await Promise.all([sumRes.json(), appRes.json()])
        setSummary(sumData)
        setTodayAppointments(Array.isArray(appData) ? appData : appData?.data || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Real 7-day chart data from database
  const chartData = summary?.weeklyChart || [
    { day: 'Hoy', ingresos: summary?.income?.total || 0, gastos: summary?.expenses?.total || 0 }
  ]

  const statusColor = {
    PENDING: 'status-pending', CONFIRMED: 'status-confirmed',
    IN_PROGRESS: 'status-inprogress', COMPLETED: 'status-completed',
    CANCELLED: 'status-cancelled', NO_SHOW: 'status-noshow',
  }
  const statusLabel = {
    PENDING: 'Pendiente', CONFIRMED: 'Confirmada',
    IN_PROGRESS: 'En curso', COMPLETED: 'Completada',
    CANCELLED: 'Cancelada', NO_SHOW: 'No asistió',
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="glass rounded-lg p-3 text-xs">
          <p className="font-semibold text-white mb-1">{label}</p>
          {payload.map((p) => (
            <p key={p.name} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Scissors className="text-gold-400" size={28} />
            Dashboard
          </h1>
          <p className="page-subtitle capitalize">
            {format(today, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>
        <Link href="/pos" id="btn-new-sale" className="btn-primary">
          <ShoppingCart size={16} />
          Nueva Venta
        </Link>
      </div>

      {/* KPIs de hoy */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <DollarSign size={20} className="text-gold-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="kpi-value" title={fmt(summary?.income?.total || 0)}>{loading ? '...' : fmt(summary?.income?.total || 0)}</div>
            <div className="kpi-label">Ingresos hoy</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>
            <CalendarDays size={20} className="text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="kpi-value">{loading ? '...' : todayAppointments.length}</div>
            <div className="kpi-label">Citas hoy</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>
            <ShoppingCart size={20} className="text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="kpi-value">{loading ? '...' : summary?.salesCount || 0}</div>
            <div className="kpi-label">Ventas hoy</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <TrendingUp size={20} className="text-gold-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="kpi-value" title={fmt(summary?.netProfit || 0)}>{loading ? '...' : fmt(summary?.netProfit || 0)}</div>
            <div className="kpi-label">Utilidad neta</div>
          </div>
        </div>
      </div>

      {/* Charts + Appointments */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Ingresos vs Gastos (últimos 7 días)</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false}
                     tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#f59e0b" strokeWidth={2}
                    fill="url(#gradIngresos)" />
              <Area type="monotone" dataKey="gastos" name="Gastos" stroke="#ef4444" strokeWidth={2}
                    fill="url(#gradGastos)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Today's Appointments */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Citas de hoy</h2>
            <Link href="/appointments" className="text-gold-400 text-xs hover:underline">Ver todas</Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-dark-700 rounded-lg animate-pulse" />)}
            </div>
          ) : todayAppointments.length === 0 ? (
            <div className="text-center py-8 text-dark-500">
              <CalendarDays size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Sin citas para hoy</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-48 no-scrollbar">
              {todayAppointments.map((apt) => (
                <div key={apt.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-dark-700/50 hover:bg-dark-700 transition-colors">
                  <div className="text-center w-12 flex-shrink-0">
                    <div className="text-gold-400 font-bold text-sm">{apt.timeSlot}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{apt.clientName}</div>
                    <div className="text-xs text-dark-500 truncate">{apt.barber?.name}</div>
                  </div>
                  <span className={statusColor[apt.status]}>{statusLabel[apt.status]}</span>
                </div>
              ))}
            </div>
          )}
          <Link href="/appointments?new=true" id="btn-new-appointment"
                className="btn-secondary w-full mt-3 text-xs">
            <CalendarDays size={14} />
            Nueva cita
          </Link>
        </div>
      </div>

      {/* Top Barbers + Quick Access */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Barbers */}
        <div className="card">
          <h2 className="section-title mb-4">Barberos — Rendimiento del mes</h2>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-dark-700 rounded animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {(summary?.topBarbers || []).map((b, idx) => (
                <div key={b.barberId || idx} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-dark-600 flex items-center justify-center text-xs font-bold text-gold-400">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-white">{b.barberName}</span>
                      <span className="text-sm text-gold-400 font-semibold">{fmt(b.servicesTotal)}</span>
                    </div>
                    <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-gold rounded-full transition-all"
                           style={{ width: `${Math.min(100, (b.servicesTotal / (summary?.income?.fromServices || 1)) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
              {(!summary?.topBarbers?.length) && (
                <p className="text-dark-500 text-sm text-center py-4">Sin ventas registradas este mes</p>
              )}
            </div>
          )}
        </div>

        {/* Quick Access */}
        <div className="card">
          <h2 className="section-title mb-4">Acceso rápido</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: '/pos', icon: ShoppingCart, label: 'Nueva Venta', color: 'text-gold-400', bg: 'rgba(245,158,11,0.1)', id: 'quick-pos' },
              { href: '/appointments?new=true', icon: CalendarDays, label: 'Nueva Cita', color: 'text-emerald-400', bg: 'rgba(16,185,129,0.1)', id: 'quick-apt' },
              { href: '/inventory', icon: Package, label: 'Inventario', color: 'text-blue-400', bg: 'rgba(59,130,246,0.1)', id: 'quick-inv' },
              { href: '/commissions', icon: DollarSign, label: 'Comisiones', color: 'text-purple-400', bg: 'rgba(168,85,247,0.1)', id: 'quick-com' },
            ].map(({ href, icon: Icon, label, color, bg, id }) => (
              <Link key={href} href={href} id={id}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-dark-700 hover:border-dark-600 transition-all hover:scale-105">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bg }}>
                  <Icon size={20} className={color} />
                </div>
                <span className="text-sm font-medium text-white text-center">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
