'use client'
import { useState, useEffect } from 'react'
import { Users, Plus, Edit2, Power, Phone, Scissors, DollarSign, CalendarDays, Sparkles, Copy, Check, Sun, Sunset, Moon, Zap, Trash2 } from 'lucide-react'
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

// Generar slots desde las 06:00 AM hasta las 23:00 (11:00 PM)
const ALL_SLOTS = Array.from({ length: 35 }, (_, i) => {
  const hour = Math.floor(i / 2) + 6
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
      <div className="card flex gap-8 items-center overflow-x-auto">
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
                  <div className="flex items-center justify-between text-xs text-dark-500 mb-1.5 uppercase tracking-wide">
                    <span>Horario Configurado</span>
                    <span className="text-[10px] text-gold-400 font-semibold">{schedDays.length} días activos</span>
                  </div>
                  <div className="flex gap-1">
                    {DAYS.map(d => {
                      const count = (barber.schedule || {})[d.key]?.length || 0
                      return (
                        <div key={d.key} title={count > 0 ? `${count} turnos disponibles` : 'Cerrado'} className={`flex-1 text-center py-1 rounded text-xs font-medium ${count > 0 ? (isWomen ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'gold-chip') : 'bg-dark-700 text-dark-600'}`}>
                          {d.label}
                        </div>
                      )
                    })}
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
                    <Edit2 size={12} /> Editar Horario / Perfil
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
      if (sched[day]) { delete sched[day] } else { sched[day] = ALL_SLOTS.slice(4, 26) } // Default 08:00 - 19:00
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

  // Preajustes rápidos de turno
  const applyPreset = (day, type) => {
    let slots = []
    if (type === 'morning') slots = ALL_SLOTS.filter(s => s >= '07:00' && s <= '13:00')
    else if (type === 'afternoon') slots = ALL_SLOTS.filter(s => s >= '13:00' && s <= '19:00')
    else if (type === 'night') slots = ALL_SLOTS.filter(s => s >= '19:00' && s <= '23:00')
    else if (type === 'full') slots = ALL_SLOTS.filter(s => s >= '08:00' && s <= '20:00')
    else if (type === 'extended') slots = ALL_SLOTS.filter(s => s >= '06:00' && s <= '23:00')
    else if (type === 'all') slots = [...ALL_SLOTS]
    else if (type === 'clear') slots = []

    setForm(f => ({
      ...f,
      schedule: {
        ...f.schedule,
        [day]: slots,
      }
    }))
  }

  // Copiar el horario del día actual a todos los días de la semana
  const copyScheduleToAllDays = () => {
    const currentSlots = form.schedule[scheduleTab] || []
    if (currentSlots.length === 0) {
      toast.error('Configura primero los horarios en este día antes de copiar')
      return
    }
    const newSched = {}
    DAYS.forEach(d => {
      newSched[d.key] = [...currentSlots]
    })
    setForm(f => ({ ...f, schedule: newSched }))
    toast.success(`Horario copiado exitosamente a los 7 días de la semana`)
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

  const currentDaySlots = form.schedule[scheduleTab] || []

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="modal-header sticky top-0 bg-dark-800 z-10">
          <h3 className="section-title">{barber ? 'Editar Profesional y Horarios' : 'Nuevo Profesional'}</h3>
          <button onClick={onClose} className="btn-ghost p-2">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Nombre completo *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required placeholder="Nombre del profesional" />
              </div>
              <div>
                <label className="input-label">Especialidad *</label>
                <input className="input" value={form.specialty} onChange={e => setForm(f => ({...f, specialty: e.target.value}))} required placeholder="Ej: Barbería & Diseños / Estilista" />
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
                <label className="input-label">Teléfono WhatsApp</label>
                <input className="input" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="3001234567" />
              </div>
            </div>

            {/* Configuración de horario ampliado */}
            <div className="p-4 rounded-2xl bg-dark-900 border border-dark-700 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-dark-700 pb-3">
                <div>
                  <h4 className="font-bold text-white text-base flex items-center gap-2">
                    <CalendarDays className="text-gold-400" size={18} />
                    Configuración de Horario Personalizado (06:00 AM - 11:00 PM)
                  </h4>
                  <p className="text-xs text-dark-400">Selecciona o amplía el rango de atención según la disponibilidad del profesional.</p>
                </div>
                <button
                  type="button"
                  onClick={copyScheduleToAllDays}
                  className="btn-secondary btn-sm text-xs gap-1.5 self-start sm:self-auto bg-dark-700 hover:bg-dark-600 text-gold-300 border-gold-800/40"
                  title="Copiar este horario a toda la semana"
                >
                  <Copy size={13} /> Copiar horario a toda la semana
                </button>
              </div>

              {/* Pestañas de días */}
              <div className="flex gap-1.5 flex-wrap">
                {DAYS.map(d => {
                  const count = form.schedule[d.key]?.length || 0
                  const isSelected = scheduleTab === d.key
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => {
                        setScheduleTab(d.key)
                        if (!form.schedule[d.key]) toggleDay(d.key)
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-gradient-gold text-black border-gold-400 shadow-md font-extrabold'
                          : count > 0
                            ? 'bg-dark-800 text-gold-400 border-gold-800/50'
                            : 'bg-dark-950 text-dark-500 border-dark-800 hover:border-dark-700'
                      }`}
                    >
                      <span>{d.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isSelected ? 'bg-black/20 text-black' : count > 0 ? 'bg-gold-500/20 text-gold-300' : 'bg-dark-700 text-dark-500'}`}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Panel de control de turnos para el día seleccionado */}
              {form.schedule[scheduleTab] !== undefined ? (
                <div className="space-y-3 pt-2">
                  {/* Botones de selección rápida (Presets) */}
                  <div className="flex items-center gap-1.5 flex-wrap bg-dark-950 p-2.5 rounded-xl border border-dark-800">
                    <span className="text-[11px] font-bold uppercase text-dark-400 mr-1">Turnos Rápidos:</span>
                    <button type="button" onClick={() => applyPreset(scheduleTab, 'morning')} className="btn-ghost btn-sm text-[11px] py-1 px-2.5 bg-dark-800 text-yellow-300 hover:bg-dark-700 rounded-lg flex items-center gap-1">
                      <Sun size={12} /> Mañana (07-13)
                    </button>
                    <button type="button" onClick={() => applyPreset(scheduleTab, 'afternoon')} className="btn-ghost btn-sm text-[11px] py-1 px-2.5 bg-dark-800 text-orange-300 hover:bg-dark-700 rounded-lg flex items-center gap-1">
                      <Sunset size={12} /> Tarde (13-19)
                    </button>
                    <button type="button" onClick={() => applyPreset(scheduleTab, 'night')} className="btn-ghost btn-sm text-[11px] py-1 px-2.5 bg-dark-800 text-purple-300 hover:bg-dark-700 rounded-lg flex items-center gap-1">
                      <Moon size={12} /> Noche (19-23)
                    </button>
                    <button type="button" onClick={() => applyPreset(scheduleTab, 'full')} className="btn-ghost btn-sm text-[11px] py-1 px-2.5 bg-dark-800 text-emerald-300 hover:bg-dark-700 rounded-lg flex items-center gap-1">
                      <Zap size={12} /> Día Completo (08-20)
                    </button>
                    <button type="button" onClick={() => applyPreset(scheduleTab, 'extended')} className="btn-ghost btn-sm text-[11px] py-1 px-2.5 bg-gold-950 text-gold-300 border border-gold-800/50 hover:bg-gold-900 rounded-lg flex items-center gap-1">
                      🌟 Ampliado (06-23)
                    </button>
                    <button type="button" onClick={() => applyPreset(scheduleTab, 'clear')} className="btn-ghost btn-sm text-[11px] py-1 px-2.5 text-red-400 hover:bg-red-950/40 rounded-lg flex items-center gap-1 ml-auto">
                      <Trash2 size={12} /> Vaciar Días
                    </button>
                  </div>

                  {/* Grilla interactiva de turnos de 06:00 a 23:00 */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-1.5 pt-1">
                    {ALL_SLOTS.map(slot => {
                      const isSelected = currentDaySlots.includes(slot)
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => toggleSlot(scheduleTab, slot)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                            isSelected
                              ? 'bg-gold-500 border-gold-400 text-black font-extrabold shadow-sm'
                              : 'bg-dark-950 text-dark-400 border-dark-800 hover:border-dark-600 hover:text-white'
                          }`}
                        >
                          {slot}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-between text-xs text-dark-400 pt-2">
                    <span>
                      {DAYS.find(d => d.key === scheduleTab)?.label}: <strong className="text-white">{currentDaySlots.length} horas/slots habilitados</strong>
                    </span>
                    <button type="button" onClick={() => toggleDay(scheduleTab)} className="text-red-400 hover:underline">
                      Desactivar este día
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-dark-700 rounded-xl bg-dark-950">
                  <p className="text-dark-400 text-xs mb-2">Este día figura como no laboral.</p>
                  <button type="button" onClick={() => toggleDay(scheduleTab)} className="btn-primary btn-sm text-xs">
                    Activar {DAYS.find(d => d.key === scheduleTab)?.label}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer sticky bottom-0 bg-dark-800 z-10">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : barber ? 'Guardar Cambios' : 'Crear Profesional'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
