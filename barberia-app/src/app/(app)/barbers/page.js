'use client'
import { useState, useEffect } from 'react'
import { Users, Plus, Edit2, Power, Phone, Scissors, DollarSign, CalendarDays, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const DAYS = [
  { key: 'Mon', label: 'Lun' },
  { key: 'Tue', label: 'Mar' },
  { key: 'Wed', label: 'Mié' },
  { key: 'Thu', label: 'Jue' },
  { key: 'Fri', label: 'Vie' },
  { key: 'Sat', label: 'Sáb' },
  { key: 'Sun', label: 'Dom' },
]

const ALL_SLOTS = Array.from({ length: 22 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8
  const min = i % 2 === 0 ? '00' : '30'
  return `${hour.toString().padStart(2, '0')}:${min}`
})

const COLORS = ['bg-gold-600', 'bg-purple-600', 'bg-blue-600', 'bg-emerald-600', 'bg-red-600', 'bg-pink-600']

export default function BarbersPage() {
  const [barbers, setBarbers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editBarber, setEditBarber] = useState(null)

  const load = async () => {
    setLoading(true)
    const data = await fetch('/api/barbers').then(r => r.json())
    setBarbers(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggleActive = async (barber) => {
    const res = await fetch(`/api/barbers/${barber.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !barber.isActive }),
    })
    if (res.ok) { toast.success(barber.isActive ? 'Profesional desactivado' : 'Profesional activado'); load() }
    else toast.error('Error al cambiar estado')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Users className="text-gold-400" size={28} />
            Barberos & Estilistas
          </h1>
          <p className="page-subtitle">Gestión del equipo de trabajo (Barbería y Peluquería)</p>
        </div>
        <button id="btn-new-barber" onClick={() => { setEditBarber(null); setShowModal(true) }} className="btn-primary">
          <Plus size={16} /> Nuevo Profesional
        </button>
      </div>

      {/* Stats bar */}
      <div className="card flex gap-8 items-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{barbers.length}</div>
          <div className="text-xs text-dark-500 uppercase tracking-wide">Total</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gold-400">{barbers.filter(b => (b.category || 'BARBERIA') === 'BARBERIA').length}</div>
          <div className="text-xs text-dark-500 uppercase tracking-wide">Barberos (H)</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-400">{barbers.filter(b => b.category === 'PELUQUERIA').length}</div>
          <div className="text-xs text-dark-500 uppercase tracking-wide">Estilistas (M)</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-400">{barbers.filter(b => b.isActive).length}</div>
          <div className="text-xs text-dark-500 uppercase tracking-wide">Activos</div>
        </div>
      </div>

      {/* Barbers grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="card animate-pulse">
              <div className="flex gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-dark-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-dark-700 rounded w-3/4" />
                  <div className="h-3 bg-dark-700 rounded w-1/2" />
                </div>
              </div>
              <div className="h-10 bg-dark-700 rounded" />
            </div>
          ))}
        </div>
      ) : barbers.length === 0 ? (
        <div className="card text-center py-12">
          <Users size={48} className="mx-auto mb-4 text-dark-600" />
          <p className="text-dark-400">No hay profesionales registrados</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mt-4">
            <Plus size={16} /> Agregar primer profesional
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {barbers.map((barber, idx) => {
            const isWomen = barber.category === 'PELUQUERIA'
            const avatarColor = isWomen ? 'bg-purple-600' : COLORS[idx % COLORS.length]
            const schedDays = Object.keys(barber.schedule || {})
            return (
              <div key={barber.id} className={`card group transition-all hover:border-gold-800/50 ${!barber.isActive ? 'opacity-60' : ''}`}>
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 rounded-full ${avatarColor} flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-lg`}>
                      {barber.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        {barber.name}
                        {isWomen && <Sparkles size={13} className="text-purple-400" />}
                      </div>
                      <div className="text-xs text-dark-500 mt-0.5">{barber.specialty}</div>
                      <div className="mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                          isWomen ? 'bg-purple-950 text-purple-300 border border-purple-800/50' : 'bg-gold-950 text-gold-400 border border-gold-800/50'
                        }`}>
                          {isWomen ? '💅 Peluquería / Mujeres' : '💈 Barbería / Hombres'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className={barber.isActive ? 'badge badge-green' : 'badge badge-gray'}>
                    {barber.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                {/* Schedule preview */}
                <div className="mb-4">
                  <div className="text-xs text-dark-500 mb-1.5 uppercase tracking-wide">Horario</div>
                  <div className="flex gap-1">
                    {DAYS.map(d => (
                      <div key={d.key} className={`flex-1 text-center py-1 rounded text-xs font-medium ${schedDays.includes(d.key) ? (isWomen ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'gold-chip') : 'bg-dark-700 text-dark-600'}`}>
                        {d.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center border-t border-dark-700 pt-3 mb-4">
                  <div>
                    <div className="text-sm font-semibold text-white">{barber._count?.appointments ?? '—'}</div>
                    <div className="text-xs text-dark-500">Citas</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gold-400">{barber.totalSales ? fmt(barber.totalSales) : '—'}</div>
                    <div className="text-xs text-dark-500">Ventas</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-emerald-400">{barber.pendingCommissions ? fmt(barber.pendingCommissions) : '—'}</div>
                    <div className="text-xs text-dark-500">Comisión</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    id={`btn-edit-${barber.id}`}
                    onClick={() => { setEditBarber(barber); setShowModal(true) }}
                    className="btn-secondary btn-sm flex-1"
                  >
                    <Edit2 size={12} /> Editar
                  </button>
                  <button
                    id={`btn-toggle-${barber.id}`}
                    onClick={() => toggleActive(barber)}
                    className={`btn-sm ${barber.isActive ? 'btn-danger' : 'btn-success'}`}
                    title={barber.isActive ? 'Desactivar' : 'Activar'}
                  >
                    <Power size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <BarberModal
          barber={editBarber}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function BarberModal({ barber, onClose, onSave }) {
  const [form, setForm] = useState(barber ? {
    name: barber.name,
    specialty: barber.specialty,
    phone: barber.phone || '',
    category: barber.category || 'BARBERIA',
    schedule: barber.schedule || {},
  } : {
    name: '',
    specialty: '',
    phone: '',
    category: 'BARBERIA',
    schedule: {},
  })
  const [loading, setLoading] = useState(false)
  const [scheduleTab, setScheduleTab] = useState('Mon')

  const toggleDay = (day) => {
    setForm(f => {
      const sched = { ...f.schedule }
      if (sched[day]) { delete sched[day] } else { sched[day] = ['09:00','09:30','10:00','10:30','11:00','14:00','14:30','15:00','15:30','16:00'] }
      return { ...f, schedule: sched }
    })
  }

  const toggleSlot = (day, slot) => {
    setForm(f => {
      const sched = { ...f.schedule }
      const slots = sched[day] ? [...sched[day]] : []
      if (slots.includes(slot)) { sched[day] = slots.filter(s => s !== slot) }
      else { sched[day] = [...slots, slot].sort() }
      return { ...f, schedule: sched }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const url = barber ? `/api/barbers/${barber.id}` : '/api/barbers'
    const method = barber ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) { toast.success(barber ? 'Profesional actualizado' : 'Profesional creado'); onSave() }
    else { const d = await res.json(); toast.error(d.error || 'Error') }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="modal-header sticky top-0 bg-dark-800 z-10">
          <h3 className="section-title">{barber ? 'Editar Profesional' : 'Nuevo Profesional'}</h3>
          <button onClick={onClose} className="btn-ghost p-2">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Nombre completo *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required placeholder="Nombre del profesional" />
              </div>
              <div>
                <label className="input-label">Especialidad *</label>
                <input className="input" value={form.specialty} onChange={e => setForm(f => ({...f, specialty: e.target.value}))} required placeholder="Ej: Estilista / Cortes y Keratina" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Categoría / Área *</label>
                <select className="select" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}>
                  <option value="BARBERIA">💈 Barbería (Hombres)</option>
                  <option value="PELUQUERIA">💅 Peluquería / Estética (Mujeres)</option>
                  <option value="TODOS">🌟 Todos (Hombres y Mujeres)</option>
                </select>
              </div>
              <div>
                <label className="input-label">Teléfono</label>
                <input className="input" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="3001234567" />
              </div>
            </div>

            {/* Schedule builder */}
            <div>
              <label className="input-label">Horario de trabajo</label>
              {/* Day tabs */}
              <div className="flex gap-1 mb-3 flex-wrap">
                {DAYS.map(d => (
                  <button key={d.key} type="button"
                          onClick={() => { setScheduleTab(d.key); if (!form.schedule[d.key]) toggleDay(d.key) }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.schedule[d.key] ? scheduleTab === d.key ? 'bg-gold-600 border-gold-500 text-black' : 'bg-gold-900/40 border-gold-800/50 text-gold-400' : 'border-dark-600 text-dark-500 hover:border-dark-500'}`}>
                    {d.label}
                    {form.schedule[d.key] && <span className="ml-1 text-xs">({form.schedule[d.key].length})</span>}
                  </button>
                ))}
              </div>

              {/* Slots for selected day */}
              {form.schedule[scheduleTab] !== undefined ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-dark-400">{DAYS.find(d => d.key === scheduleTab)?.label} — selecciona los slots disponibles</span>
                    <button type="button" onClick={() => toggleDay(scheduleTab)} className="btn-danger btn-sm text-xs">Quitar día</button>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                    {ALL_SLOTS.map(slot => (
                      <button key={slot} type="button"
                              onClick={() => toggleSlot(scheduleTab, slot)}
                              className={form.schedule[scheduleTab]?.includes(slot) ? 'slot-selected' : 'slot-available'}>
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 border border-dashed border-dark-600 rounded-lg">
                  <p className="text-dark-500 text-sm">Selecciona un día para configurar sus horarios</p>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer sticky bottom-0 bg-dark-800 z-10">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : barber ? 'Actualizar' : 'Crear Profesional'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
