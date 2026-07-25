'use client'
import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, BarChart2, Plus, Trash2, CreditCard, Banknote, Smartphone } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

export default function FinancePage() {
  const now = new Date()
  const [period, setPeriod] = useState({
    startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
  })
  const [summary, setSummary] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showExpenseModal, setShowExpenseModal] = useState(false)

  const PRESETS = [
    { label: 'Hoy', start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') },
    { label: 'Esta semana', start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') },
    { label: 'Este mes', start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') },
    { label: 'Este año', start: format(startOfYear(now), 'yyyy-MM-dd'), end: format(endOfYear(now), 'yyyy-MM-dd') },
  ]

  const load = async () => {
    setLoading(true)
    const [sumRes, expRes, catRes] = await Promise.all([
      fetch(`/api/finance/summary?startDate=${period.startDate}&endDate=${period.endDate}`),
      fetch(`/api/expenses?startDate=${period.startDate}&endDate=${period.endDate}`),
      fetch('/api/expenses/categories'),
    ])
    const [sumData, expData, catData] = await Promise.all([sumRes.json(), expRes.json(), catRes.json()])
    setSummary(sumData)
    setExpenses(expData.expenses || expData || [])
    setCategories(catData.categories || catData || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [period])

  const deleteExpense = async (id) => {
    if (!confirm('¿Eliminar este gasto?')) return
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    toast.success('Gasto eliminado')
    load()
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) return (
      <div className="glass rounded-lg p-3 text-xs">
        <p className="font-semibold text-white mb-1">{label}</p>
        {payload.map(p => <p key={p.name} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>)}
      </div>
    )
    return null
  }

  // Build payment method chart data
  const paymentData = summary ? Object.entries(summary.income?.byPaymentMethod || {}).map(([k, v]) => ({
    name: { CASH: 'Efectivo', NEQUI: 'Nequi', TRANSFER: 'Transferencia', CARD: 'Tarjeta', MIXED: 'Mixto' }[k] || k,
    value: v,
  })).filter(d => d.value > 0) : []

  // Expenses by category chart
  const expCatData = summary?.expenses?.byCategory?.map(c => ({ name: c.categoryName, gastos: c.amount })) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <TrendingUp className="text-gold-400" size={28} />
            Finanzas
          </h1>
          <p className="page-subtitle">Ingresos, gastos y utilidades del negocio</p>
        </div>
        <button id="btn-new-expense" onClick={() => setShowExpenseModal(true)} className="btn-secondary">
          <Plus size={16} /> Registrar Gasto
        </button>
      </div>

      {/* Period selector */}
      <div className="card flex flex-wrap gap-3 items-center">
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map(p => (
            <button key={p.label}
                    onClick={() => setPeriod({ startDate: p.start, endDate: p.end })}
                    className={`btn-ghost text-xs px-3 py-1.5 border rounded-lg transition-all ${period.startDate === p.start && period.endDate === p.end ? 'border-gold-600 text-gold-400 bg-gold-900/20' : 'border-dark-600'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input type="date" value={period.startDate} onChange={e => setPeriod(p => ({...p, startDate: e.target.value}))} className="input w-36" />
          <span className="text-dark-500">—</span>
          <input type="date" value={period.endDate} onChange={e => setPeriod(p => ({...p, endDate: e.target.value}))} className="input w-36" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>
            <TrendingUp size={22} className="text-emerald-400" />
          </div>
          <div>
            <div className="kpi-value text-emerald-400">{loading ? '...' : fmt(summary?.income?.total || 0)}</div>
            <div className="kpi-label">Total ingresos</div>
            {summary && <div className="text-xs text-dark-500 mt-0.5">{summary.salesCount} ventas</div>}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>
            <TrendingDown size={22} className="text-red-400" />
          </div>
          <div>
            <div className="kpi-value text-red-400">{loading ? '...' : fmt(summary?.expenses?.total || 0)}</div>
            <div className="kpi-label">Total gastos</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <DollarSign size={22} className="text-gold-400" />
          </div>
          <div>
            <div className="kpi-value text-gold-400">{loading ? '...' : fmt(summary?.commissions?.paid || 0)}</div>
            <div className="kpi-label">Comisiones pagadas</div>
          </div>
        </div>
        <div className="card-gold kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <BarChart2 size={22} className="text-gold-400" />
          </div>
          <div>
            <div className="kpi-value">{loading ? '...' : fmt(summary?.netProfit || 0)}</div>
            <div className="kpi-label">Utilidad neta</div>
          </div>
        </div>
      </div>

      {/* Income breakdown + Payment methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income sources */}
        <div className="card">
          <h2 className="section-title mb-4">Desglose de Ingresos</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-dark-700/50 rounded-lg">
              <span className="text-dark-400 text-sm flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-gold-500 inline-block" /> Servicios</span>
              <span className="font-semibold text-white">{fmt(summary?.income?.fromServices || 0)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-dark-700/50 rounded-lg">
              <span className="text-dark-400 text-sm flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Productos</span>
              <span className="font-semibold text-white">{fmt(summary?.income?.fromProducts || 0)}</span>
            </div>
            <div className="divider" />
            <div className="flex items-center justify-between p-3 gold-box rounded-lg">
              <span className="text-sm font-semibold">Total</span>
              <span className="font-bold text-lg">{fmt(summary?.income?.total || 0)}</span>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-dark-400 mt-5 mb-3 uppercase tracking-wide">Por método de pago</h3>
          <div className="space-y-2">
            {paymentData.length === 0 ? <p className="text-dark-500 text-sm">Sin datos</p> : paymentData.map(p => (
              <div key={p.name} className="flex items-center justify-between">
                <span className="text-dark-400 text-sm">{p.name}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gold-500 rounded-full" style={{ width: `${Math.min(100, (p.value / (summary?.income?.total || 1)) * 100)}%` }} />
                  </div>
                  <span className="text-white text-sm font-medium w-24 text-right">{fmt(p.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top barbers */}
        <div className="card">
          <h2 className="section-title mb-4">Top Barberos del Período</h2>
          <div className="space-y-3">
            {loading ? (
              [1,2,3].map(i => <div key={i} className="h-12 bg-dark-700 rounded animate-pulse" />)
            ) : (summary?.topBarbers || []).length === 0 ? (
              <p className="text-dark-500 text-sm text-center py-4">Sin datos en este período</p>
            ) : (
              (summary?.topBarbers || []).map((b, i) => (
                <div key={b.barberName} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-dark-600 flex items-center justify-center text-xs font-bold text-gold-400 flex-shrink-0">{i+1}</div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-white">{b.barberName}</span>
                      <span className="text-sm font-semibold text-gold-400">{fmt(b.servicesTotal)}</span>
                    </div>
                    <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (b.servicesTotal / ((summary?.topBarbers[0]?.servicesTotal) || 1)) * 100)}%`, background: 'linear-gradient(90deg, #f59e0b, #d97706)' }} />
                    </div>
                    <div className="text-xs text-dark-500 mt-0.5">Comisión: {fmt(b.commissionsEarned)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Expenses chart */}
      {expCatData.length > 0 && (
        <div className="card">
          <h2 className="section-title mb-4">Gastos por Categoría</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={expCatData} margin={{ top: 5, right: 5, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Expenses list */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Gastos Registrados</h2>
          <span className="text-gold-400 font-semibold">{fmt(summary?.expenses?.total || 0)}</span>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Monto</th><th></th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-6 text-dark-500">Cargando...</td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-dark-500">
                  <TrendingDown size={28} className="mx-auto mb-2 opacity-30" />
                  Sin gastos registrados en este período
                </td></tr>
              ) : (
                expenses.map(exp => (
                  <tr key={exp.id}>
                    <td className="text-dark-400">{format(new Date(exp.date), 'dd/MM/yyyy')}</td>
                    <td><span className="badge badge-gray">{exp.category?.name}</span></td>
                    <td className="text-white">{exp.description}</td>
                    <td className="text-red-400 font-semibold">{fmt(exp.amount)}</td>
                    <td>
                      <button onClick={() => deleteExpense(exp.id)} className="btn-ghost p-1.5 text-red-500 hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showExpenseModal && (
        <ExpenseModal
          categories={categories}
          onClose={() => setShowExpenseModal(false)}
          onSave={() => { setShowExpenseModal(false); load() }}
        />
      )}
    </div>
  )
}

function ExpenseModal({ categories, onClose, onSave }) {
  const [form, setForm] = useState({ categoryId: '', description: '', amount: '', date: format(new Date(), 'yyyy-MM-dd') })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.categoryId) { toast.error('Selecciona una categoría'); return }
    setLoading(true)
    const res = await fetch('/api/expenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: Number(form.amount) }),
    })
    setLoading(false)
    if (res.ok) { toast.success('Gasto registrado'); onSave() }
    else { const d = await res.json(); toast.error(d.error || 'Error') }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="section-title">Registrar Gasto</h3>
          <button onClick={onClose} className="btn-ghost p-2">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div>
              <label className="input-label">Categoría *</label>
              <select className="select" value={form.categoryId} onChange={e => setForm(f => ({...f, categoryId: e.target.value}))} required>
                <option value="">Seleccionar categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Descripción *</label>
              <input className="input" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} required placeholder="Ej: Pago arriendo local" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Monto *</label>
                <input type="number" min="0" className="input" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} required placeholder="0" />
              </div>
              <div>
                <label className="input-label">Fecha *</label>
                <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} required />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : 'Registrar Gasto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
