import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  Search, Plus, Edit2, Clock, X, MapPin, DollarSign,
  Calendar as CalendarIcon, Users, Utensils, CheckCircle, AlertCircle, Trash2
} from 'lucide-react'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia')))
  ? window.location.origin
  : 'https://daily-lover.agentesia.cloud'

const CITIES = [
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena',
  'Bucaramanga', 'Pereira', 'Manizales', 'Santa Marta',
  'Villavicencio', 'Ibagué', 'Cúcuta', 'Armenia', 'Chía', 'Miami'
]

const BUDGET_CATEGORIES = [
  'Menos de 100k',
  '100k-200k',
  '200k-300k',
  'Más de 300k'
]

const ALL_DAYS = [
  { key: 'Lun', matchKey: 'lun', label: 'Lun' },
  { key: 'Mar', matchKey: 'mar', label: 'Mar' },
  { key: 'Mié', matchKey: 'mie', label: 'Mié' },
  { key: 'Jue', matchKey: 'jue', label: 'Jue' },
  { key: 'Vie', matchKey: 'vie', label: 'Vie' },
  { key: 'Sáb', matchKey: 'sab', label: 'Sáb' },
  { key: 'Dom', matchKey: 'dom', label: 'Dom' },
]

const HALF_HOUR_SLOTS = [
  '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM',
  '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
  '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM',
  '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM',
  '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM',
  '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM', '10:00 PM'
]

const SCHEDULE_PRESETS = [
  { label: 'Restaurante Estándar (Lun-Sáb 12pm-10:30pm · Dom 12pm-5pm)', value: 'Lun-Mié 12:00-10:00pm · Jue-Sáb 12:00-11:00pm · Dom 12:00-5:00pm' },
  { label: 'Lunes Cerrado (Mar-Sáb 12pm-11pm · Dom 12pm-5pm)', value: 'Lunes cerrado · Mar-Mié 12:00-10:00pm · Jue-Sáb 12:00-11:00pm · Dom 12:00-5:00pm' },
  { label: 'Doble Turno Almuerzo/Cena (12:30-3:30pm y 7:00-11:00pm)', value: 'Lun-Sáb 12:30-3:30pm y 7:00-11:00pm · Dom 12:30-4:30pm' },
  { label: 'Solo Tardes/Noches (Lun-Sáb 5:00pm-11:30pm)', value: 'Lun-Sáb 5:00pm-11:30pm · Dom cerrado' },
  { label: 'Cafetería / Brunch (Lun-Sáb 8:00am-6:30pm · Dom 8:00am-5:30pm)', value: 'Lun-Sáb 8:00am-6:30pm · Dom 8:00am-5:30pm' },
]

function stripAccents(str = '') {
  return String(str)
    .toLowerCase()
    .replace(/á/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u')
}

function parseDaysList(availableDaysStr = '') {
  const norm = stripAccents(availableDaysStr)
  if (norm.includes('todos')) return ALL_DAYS.map(d => d.key)
  return ALL_DAYS.filter(d => norm.includes(d.matchKey)).map(d => d.key)
}

function getDayFromDateYMD(dateStr) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return ''
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  const map = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return map[d.getDay()] || ''
}

const BUDGET_BADGE_STYLE = {
  'Menos de 100k': { background: 'rgba(16, 185, 129, 0.14)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.35)' },
  '100k-200k':     { background: 'rgba(59, 130, 246, 0.14)', color: '#60A5FA', border: '1px solid rgba(59, 130, 246, 0.35)' },
  '200k-300k':     { background: 'rgba(245, 158, 11, 0.14)', color: '#FBBF24', border: '1px solid rgba(245, 158, 11, 0.35)' },
  'Más de 300k':   { background: 'rgba(236, 72, 153, 0.14)', color: '#F472B6', border: '1px solid rgba(236, 72, 153, 0.35)' },
}

// ─── MODAL DE CONFIGURACIÓN DE RESTAURANTE (FILTROS, HORARIO Y CUPOS) ─────────
function RestaurantConfigModal({ restaurant, onClose, onSaved }) {
  const { token } = useAuth()
  const isEdit = Boolean(restaurant && restaurant.id)

  const initialDays = restaurant?.available_days
    ? parseDaysList(restaurant.available_days)
    : ALL_DAYS.map(d => d.key)

  const [form, setForm] = useState({
    name: restaurant?.name || '',
    city: restaurant?.city || 'Bogotá',
    zone: restaurant?.zone || '',
    detailed_location: restaurant?.detailed_location || '',
    food_type: restaurant?.food_type || '',
    budget_category: restaurant?.budget_category || '100k-200k',
    price_range_raw: restaurant?.price_range_raw || '70-150k',
    price_num_cop: restaurant?.price_num_cop || 120000,
    hours_raw: restaurant?.hours_raw || 'Lun-Mié 12:00-10:00pm · Jue-Sáb 12:00-11:00pm · Dom 12:00-5:00pm',
    accepts_reservations: restaurant?.accepts_reservations || 'Sí',
    max_slots_per_time: restaurant?.max_slots_per_time ?? 3,
    is_active: restaurant?.is_active !== false,
    contact_phone: restaurant?.contact_phone || '',
    notes: restaurant?.notes || '',
  })
  const [selectedDays, setSelectedDays] = useState(initialDays)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const toggleDay = (dayKey) => {
    setSelectedDays(prev =>
      prev.includes(dayKey) ? prev.filter(d => d !== dayKey) : [...prev, dayKey]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (selectedDays.length === 0) {
      setError('Selecciona al menos un día de apertura.')
      return
    }
    setLoading(true)
    setError(null)

    const orderedDays = ALL_DAYS.map(d => d.key).filter(k => selectedDays.includes(k)).join(',')
    const url = isEdit
      ? `${API}/api/v1/matchmaking/restaurants/${restaurant.id}`
      : `${API}/api/v1/matchmaking/restaurants`
    const method = isEdit ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          ...form,
          available_days: orderedDays,
          price_num_cop: Number(form.price_num_cop) || 0,
          max_slots_per_time: Math.max(1, Number(form.max_slots_per_time) || 3)
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al guardar el restaurante')
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 680, width: '96vw', maxHeight: '92vh', overflowY: 'auto', padding: 24 }}
      >
        <div className="modal-header" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Utensils size={18} style={{ color: 'var(--color-primary)' }} />
              {isEdit ? `Configurar Restaurante: ${restaurant.name}` : 'Nuevo Restaurante Aliado'}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              Configura ciudad, rango de precios, días que abre, horario de apertura/cierre y cupos simultáneos cada media hora
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Fila 1: Nombre, Ciudad, Estado */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Nombre del Restaurante *</label>
              <input
                className="input"
                required
                placeholder="Ej. Osaki, Eda Rón, Salvaje..."
                value={form.name}
                onChange={e => setField('name', e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Ciudad (Filtro) *</label>
              <select value={form.city} onChange={e => setField('city', e.target.value)}>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Estado</label>
              <select
                value={form.is_active ? 'activo' : 'inactivo'}
                onChange={e => setField('is_active', e.target.value === 'activo')}
              >
                <option value="activo">🟢 Activo</option>
                <option value="inactivo">🔴 Inactivo</option>
              </select>
            </div>
          </div>

          {/* Fila 2: Presupuesto (Filtro), Rango Texto, Precio Promedio COP, Cupos por Media Hora */}
          <div style={{
            background: 'rgba(150, 21, 0, 0.06)',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            padding: 14,
            marginBottom: 14
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#F59E0B', textTransform: 'uppercase', marginBottom: 10 }}>
              ⚙️ Parámetros de Filtrado Automático y Cupos por Media Hora
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 1.3fr', gap: 10 }}>
              <div>
                <label className="form-label" style={{ fontSize: 11.5 }}>Categoría Precio (Filtro) *</label>
                <select
                  value={form.budget_category}
                  onChange={e => setField('budget_category', e.target.value)}
                >
                  {BUDGET_CATEGORIES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 11.5 }}>Rango Visible</label>
                <input
                  className="input"
                  placeholder="Ej. 100-150k"
                  value={form.price_range_raw}
                  onChange={e => setField('price_range_raw', e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 11.5 }}>Valor Prom. (COP)</label>
                <input
                  className="input"
                  type="number"
                  value={form.price_num_cop}
                  onChange={e => setField('price_num_cop', e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 11.5, color: '#10B981', fontWeight: 700 }}>
                  👥 Cupos / Media Hora *
                </label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={30}
                  required
                  value={form.max_slots_per_time}
                  onChange={e => setField('max_slots_per_time', e.target.value)}
                  style={{ borderColor: '#10B981', fontWeight: 800, color: '#10B981' }}
                />
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              💡 <strong>Cupos por Media Hora:</strong> Si configuras <strong>{form.max_slots_per_time || 3} cupos</strong>, el sistema permitirá agendar hasta {form.max_slots_per_time || 3} citas en la misma fecha y misma media hora (ej. 7:00 PM). Para una {(Number(form.max_slots_per_time) || 3) + 1}ª cita a las 7:00 PM ya no aparecerá disponible, pero sí seguirá disponible a las 7:30 PM o en otra media hora.
            </div>
          </div>

          {/* Fila 3: Días que Abre */}
          <div className="form-group" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>📅 Días de la Semana que Abre *</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => setSelectedDays(ALL_DAYS.map(d => d.key))}
                >
                  Todos (Lun-Dom)
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => setSelectedDays(['Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'])}
                >
                  Cerrado Lunes (Mar-Dom)
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => setSelectedDays(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'])}
                >
                  Cerrado Domingo (Lun-Sáb)
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ALL_DAYS.map(d => {
                const active = selectedDays.includes(d.key)
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleDay(d.key)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: active ? '1.5px solid #10B981' : '1px solid var(--border-color)',
                      background: active ? 'rgba(16, 185, 129, 0.16)' : 'var(--bg-base)',
                      color: active ? '#10B981' : 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: 'pointer'
                    }}
                  >
                    {active ? '✓ ' : ''}{d.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Fila 4: Horario de Apertura y Cierre */}
          <div className="form-group" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>⏰ Horario de Apertura y Cierre (Usado por el Filtro de Hora) *</label>
              <select
                value=""
                onChange={e => { if (e.target.value) setField('hours_raw', e.target.value) }}
                style={{ width: 'auto', padding: '4px 8px', fontSize: 11, background: 'var(--bg-base)' }}
              >
                <option value="">⚡ Usar plantilla rápida de horario...</option>
                {SCHEDULE_PRESETS.map(p => (
                  <option key={p.label} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <input
              className="input"
              required
              placeholder="Ej. Lun-Mié 12:00-10:00pm · Jue-Sáb 12:00-11:00pm · Dom 12:00-5:00pm"
              value={form.hours_raw}
              onChange={e => setField('hours_raw', e.target.value)}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Formato reconocido: <code>Lun-Mié 12:00-10:00pm · Jue-Sáb 12:00-11:00pm · Dom 12:00-5:00pm</code> o turnos partidos <code>12:30-3:00pm y 7:00-11:00pm</code>.
            </div>
          </div>

          {/* Fila 5: Zona, Tipo de Comida, Acepta Reservas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Zona / Sector</label>
              <input
                className="input"
                placeholder="Ej. Norte, Chapinero, Provenza..."
                value={form.zone}
                onChange={e => setField('zone', e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Tipo de Comida / Ambiente</label>
              <input
                className="input"
                placeholder="Ej. Asiática, Italiana, Café..."
                value={form.food_type}
                onChange={e => setField('food_type', e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">¿Acepta Reservas?</label>
              <select
                value={form.accepts_reservations}
                onChange={e => setField('accepts_reservations', e.target.value)}
              >
                <option value="Sí">Sí</option>
                <option value="No">No (Orden de llegada)</option>
                <option value="Según disponibilidad">Según disponibilidad</option>
              </select>
            </div>
          </div>

          {/* Fila 6: Ubicación detallada y Teléfono */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Dirección / Sedes Detalladas</label>
              <input
                className="input"
                placeholder="Dirección o sedes..."
                value={form.detailed_location}
                onChange={e => setField('detailed_location', e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Teléfono de Reservas</label>
              <input
                className="input"
                placeholder="+57 300 000 0000"
                value={form.contact_phone}
                onChange={e => setField('contact_phone', e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : isEdit ? 'Guardar Configuración' : 'Crear Restaurante'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── MODAL DE CUPOS POR MEDIA HORA E HISTORIAL DE CITAS DEL RESTAURANTE ───────
function RestaurantBookingsModal({ restaurant, onClose }) {
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/api/v1/matchmaking/restaurants/${restaurant.id}/bookings`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [restaurant.id, token])

  const slotsSummary = data?.slots_summary || []
  const bookings = data?.bookings || []
  const maxSlots = restaurant.max_slots_per_time || 3

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 640, width: '95vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: 24 }}
      >
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
              📅 Ocupación de Cupos por Hora & Historial
            </h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              <strong>{restaurant.name}</strong> ({restaurant.city}) • Capacidad: <strong>{maxSlots} cupos simultáneos cada media hora</strong>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
          {loading ? (
            <div className="empty-state" style={{ padding: 36 }}>Cargando ocupación de cupos...</div>
          ) : slotsSummary.length === 0 ? (
            <div className="empty-state" style={{ padding: 36 }}>
              No hay citas activas agendadas en <strong>{restaurant.name}</strong>.
              <div style={{ fontSize: 12, marginTop: 6, color: 'var(--text-secondary)' }}>
                Todos los bloques de 30 minutos tienen <strong>{maxSlots}/{maxSlots} cupos disponibles</strong>.
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 10 }}>
                🕒 Resumen de Cupos Ocupados por Fecha y Media Hora
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, marginBottom: 20 }}>
                {slotsSummary.map((s, i) => {
                  const isFull = s.occupied >= s.max_slots
                  return (
                    <div
                      key={i}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        border: isFull ? '1px solid rgba(239,68,68,0.45)' : '1px solid rgba(16,185,129,0.35)',
                        background: isFull ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.06)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>
                          📅 {s.date_ymd} • {s.slot_display}
                        </span>
                        <span
                          className="badge"
                          style={{
                            background: isFull ? '#EF4444' : '#10B981',
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: 11
                          }}
                        >
                          {s.occupied}/{s.max_slots} cupos {isFull ? '(LLENO)' : ''}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        {s.couples.map((c, idx) => (
                          <div key={idx}>• {c}</div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
                📋 Detalle de Citas Agendadas ({bookings.length})
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Pareja</th>
                      <th>Fecha y Hora</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map(b => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{b.person_a} &amp; {b.person_b}</td>
                        <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{b.date_time_raw}</td>
                        <td>
                          <span className={`badge ${b.had_date ? 'badge-green' : 'badge-yellow'}`}>
                            {b.had_date ? 'Realizada' : 'Programada'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── TARJETA DE RESTAURANTE CON TODOS SUS FILTROS Y CUPOS VISIBLES ────────────
function RestaurantCard({ restaurant, filterDate, filterTime, onEdit, onViewBookings, onQuickSlotsChange }) {
  const openDays = parseDaysList(restaurant.available_days)
  const maxSlots = restaurant.max_slots_per_time ?? 3
  const occupied = restaurant.occupied_slots ?? 0
  const available = restaurant.available_slots ?? maxSlots
  const isFullAtSlot = Boolean(restaurant.is_full_at_slot)
  const slotsByTime = restaurant.slots_by_time_on_date || {}
  const budgetStyle = BUDGET_BADGE_STYLE[restaurant.budget_category] || {
    background: 'rgba(155,155,155,0.12)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)'
  }

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 18,
        border: isFullAtSlot
          ? '1.5px solid rgba(239, 68, 68, 0.5)'
          : '1px solid var(--border-color)',
        opacity: restaurant.is_active === false ? 0.6 : 1,
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Fila 1: Nombre + Ciudad/Zona + Estado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15.5, color: 'var(--text-primary)' }}>
            {restaurant.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <MapPin size={12} style={{ color: 'var(--color-primary)' }} />
            <strong>{restaurant.city}</strong>
            {restaurant.zone ? ` • ${restaurant.zone}` : ''}
          </div>
        </div>
        <span
          className={`badge ${restaurant.is_active === false ? 'badge-red' : 'badge-green'}`}
          style={{ flexShrink: 0 }}
        >
          {restaurant.is_active === false ? 'Inactivo' : 'Activo'}
        </span>
      </div>

      {/* Fila 2: Filtros de Presupuesto y Tipo de Comida */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span className="badge" style={{ ...budgetStyle, fontSize: 11, fontWeight: 700 }}>
          💰 {restaurant.budget_category}
        </span>
        {restaurant.price_range_raw && (
          <span className="badge badge-gray" style={{ fontSize: 11 }}>
            Rango: ${restaurant.price_range_raw}
          </span>
        )}
        {restaurant.food_type && (
          <span className="badge badge-gray" style={{ fontSize: 11 }}>
            🍽️ {restaurant.food_type}
          </span>
        )}
      </div>

      {/* Fila 3: Días de Apertura (Pills Lun..Dom) */}
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
          📅 Días que Abre:
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {ALL_DAYS.map(d => {
            const isOpenDay = openDays.includes(d.key)
            return (
              <span
                key={d.key}
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 6,
                  background: isOpenDay ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.08)',
                  color: isOpenDay ? '#10B981' : 'var(--text-muted)',
                  border: isOpenDay ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                  textDecoration: isOpenDay ? 'none' : 'line-through'
                }}
              >
                {d.label}
              </span>
            )
          })}
        </div>
      </div>

      {/* Fila 4: Horario de Apertura y Cierre */}
      <div style={{
        background: 'var(--bg-base)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 11.5,
        color: 'var(--text-secondary)',
        lineHeight: 1.4
      }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>
          ⏰ Horario de Atención:
        </div>
        <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
          {restaurant.hours_raw || 'Lun-Sáb 12:00-10:30pm · Dom 12:00-5:00pm'}
        </div>
      </div>

      {/* Fila 5: Cupos por Media Hora (Configurable + Estado en vivo) */}
      <div style={{
        background: isFullAtSlot ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.07)',
        border: isFullAtSlot ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(16, 185, 129, 0.25)',
        borderRadius: 8,
        padding: '8px 10px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: isFullAtSlot ? '#EF4444' : '#10B981', textTransform: 'uppercase' }}>
              👥 Cupos por Media Hora (Cada 30 min)
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 700, marginTop: 2 }}>
              Máx. {maxSlots} {maxSlots === 1 ? 'cita simultánea' : 'citas simultáneas'} a la misma hora
            </div>
          </div>

          {/* Controles rápidos - / + para cambiar cupos directamente */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              title="Reducir cupos por media hora"
              onClick={() => onQuickSlotsChange(restaurant, Math.max(1, maxSlots - 1))}
              style={{
                width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border-color)',
                background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer'
              }}
            >
              -
            </button>
            <span style={{
              minWidth: 26, textAlign: 'center', fontWeight: 800, fontSize: 13, color: '#10B981'
            }}>
              {maxSlots}
            </span>
            <button
              type="button"
              title="Aumentar cupos por media hora"
              onClick={() => onQuickSlotsChange(restaurant, maxSlots + 1)}
              style={{
                width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border-color)',
                background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer'
              }}
            >
              +
            </button>
          </div>
        </div>

        {/* Estado en vivo si hay fecha/hora seleccionada */}
        {(filterDate && filterTime && filterTime !== 'all') && (
          <div style={{
            marginTop: 6,
            paddingTop: 6,
            borderTop: '1px dashed rgba(255,255,255,0.1)',
            fontSize: 11.5,
            fontWeight: 700,
            color: isFullAtSlot ? '#EF4444' : '#10B981'
          }}>
            {isFullAtSlot
              ? `🔴 SIN CUPOS el ${filterDate} a las ${filterTime} (${occupied}/${maxSlots} ocupados — bloqueado para ${maxSlots + 1}ª cita)`
              : `🟢 Disponible el ${filterDate} a las ${filterTime}: ${available} de ${maxSlots} cupos libres (${occupied} ocupados)`}
          </div>
        )}

        {/* Mostrar horas con reservas en la fecha elegida */}
        {Object.keys(slotsByTime).length > 0 && (
          <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {Object.entries(slotsByTime).map(([slot24, cnt]) => (
              <span
                key={slot24}
                style={{
                  fontSize: 10.5,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: cnt >= maxSlots ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                  color: cnt >= maxSlots ? '#FCA5A5' : '#FCD34D',
                  fontWeight: 700
                }}
              >
                🕒 {slot24}: {cnt}/{maxSlots} cupos
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
        <button
          className="btn btn-ghost btn-sm"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
          onClick={() => onViewBookings(restaurant)}
        >
          <Clock size={13} /> Cupos / Citas ({restaurant.total_active_bookings || 0})
        </button>
        <button
          className="btn btn-ghost btn-sm"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderColor: 'rgba(150,21,0,0.4)' }}
          onClick={() => onEdit(restaurant)}
        >
          <Edit2 size={13} /> Configurar Filtros
        </button>
      </div>
    </div>
  )
}

// ─── PÁGINA PRINCIPAL: CATÁLOGO Y FILTROS DE RESTAURANTES ALIADOS ─────────────
export default function Proveedores() {
  const { token } = useAuth()
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)

  // Filtros interactivos
  const [cityFilter, setCityFilter] = useState('all')
  const [budgetFilter, setBudgetFilter] = useState('all')
  const [dayFilter, setDayFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [timeFilter, setTimeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [includeFull, setIncludeFull] = useState(false)

  // Modales
  const [editRestaurant, setEditRestaurant] = useState(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [bookingsRestaurant, setBookingsRestaurant] = useState(null)

  const fetchRestaurants = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('include_inactive', 'true')
    params.set('include_full', includeFull ? 'true' : 'false')
    if (cityFilter && cityFilter !== 'all') params.set('city', cityFilter)
    if (budgetFilter && budgetFilter !== 'all') params.set('budget_category', budgetFilter)
    if (dayFilter && dayFilter !== 'all') params.set('day', dayFilter)
    if (dateFilter) params.set('date', dateFilter)
    if (timeFilter && timeFilter !== 'all') params.set('time', timeFilter)
    if (search.trim()) params.set('search', search.trim())

    fetch(`${API}/api/v1/matchmaking/restaurants?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => r.json())
      .then(data => setRestaurants(data.restaurants || []))
      .catch(() => setRestaurants([]))
      .finally(() => setLoading(false))
  }, [token, cityFilter, budgetFilter, dayFilter, dateFilter, timeFilter, search, includeFull])

  useEffect(() => {
    fetchRestaurants()
  }, [fetchRestaurants])

  const handleDateChange = (val) => {
    setDateFilter(val)
    if (val) {
      const derivedDay = getDayFromDateYMD(val)
      if (derivedDay) setDayFilter(derivedDay)
    }
  }

  const handleQuickSlotsChange = async (rest, newMaxSlots) => {
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/restaurants/${rest.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          ...rest,
          max_slots_per_time: newMaxSlots
        })
      })
      if (res.ok) fetchRestaurants()
    } catch (e) {
      console.error('Error actualizando cupos:', e)
    }
  }

  return (
    <div>
      {/* Encabezado */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Restaurantes Aliados &amp; Cupos por Hora</h1>
          <p className="page-subtitle">
            Configuración de filtros (ciudad, presupuesto, días de apertura, horarios de atención y cupos simultáneos cada 30 minutos)
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={() => { setEditRestaurant(null); setShowConfigModal(true) }}
        >
          <Plus size={16} /> Nuevo Restaurante
        </button>
      </div>

      <div className="content-area">
        {/* Barra Multi-Filtro Interactiva */}
        <div
          className="card"
          style={{
            padding: 16,
            marginBottom: 20,
            background: 'rgba(150, 21, 0, 0.05)',
            border: '1px solid var(--border-color)'
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 12, marginBottom: 12 }}>
            {/* 1. Ciudad */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                📍 1. Ciudad
              </label>
              <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}>
                <option value="all">Todas las ciudades</option>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* 2. Presupuesto */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                💰 2. Presupuesto
              </label>
              <select value={budgetFilter} onChange={e => setBudgetFilter(e.target.value)}>
                <option value="all">Todos los precios</option>
                {BUDGET_CATEGORIES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* 3. Día de la Semana */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                📅 3. Día que Abre
              </label>
              <select value={dayFilter} onChange={e => setDayFilter(e.target.value)}>
                <option value="all">Cualquier día</option>
                {ALL_DAYS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </div>

            {/* 4. Fecha exacta (para verificar cupos) */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                🗓️ 4. Fecha (Validar Cupos)
              </label>
              <input
                type="date"
                value={dateFilter}
                onChange={e => handleDateChange(e.target.value)}
              />
            </div>

            {/* 5. Hora exacta cada 30 min */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                ⏰ 5. Hora (Cada 30 min)
              </label>
              <select value={timeFilter} onChange={e => setTimeFilter(e.target.value)}>
                <option value="all">Cualquier hora</option>
                {HALF_HOUR_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Buscador + Toggle cupos llenos + Limpiar filtros */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 380 }}>
              <Search
                size={15}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                className="search-bar"
                style={{ paddingLeft: 36, width: '100%' }}
                placeholder="Buscar restaurante por nombre, zona o comida..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={includeFull}
                  onChange={e => setIncludeFull(e.target.checked)}
                  style={{ width: 15, height: 15 }}
                />
                Mostrar también restaurantes con cupos llenos en esa hora
              </label>

              {(cityFilter !== 'all' || budgetFilter !== 'all' || dayFilter !== 'all' || dateFilter || timeFilter !== 'all' || search) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setCityFilter('all')
                    setBudgetFilter('all')
                    setDayFilter('all')
                    setDateFilter('')
                    setTimeFilter('all')
                    setSearch('')
                  }}
                >
                  Limpiar filtros
                </button>
              )}

              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {restaurants.length} {restaurants.length === 1 ? 'restaurante disponible' : 'restaurantes disponibles'}
              </div>
            </div>
          </div>
        </div>

        {/* Grilla de Restaurantes */}
        {loading ? (
          <div className="card"><div className="empty-state">Cargando restaurantes...</div></div>
        ) : restaurants.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              No se encontraron restaurantes abiertos o con cupo disponible para los filtros seleccionados.
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}>
            {restaurants.map(r => (
              <RestaurantCard
                key={r.id}
                restaurant={r}
                filterDate={dateFilter}
                filterTime={timeFilter}
                onEdit={(rest) => { setEditRestaurant(rest); setShowConfigModal(true) }}
                onViewBookings={(rest) => setBookingsRestaurant(rest)}
                onQuickSlotsChange={handleQuickSlotsChange}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal Crear / Editar Configuración del Restaurante */}
      {showConfigModal && (
        <RestaurantConfigModal
          restaurant={editRestaurant}
          onClose={() => setShowConfigModal(false)}
          onSaved={fetchRestaurants}
        />
      )}

      {/* Modal Ver Cupos e Historial de Citas */}
      {bookingsRestaurant && (
        <RestaurantBookingsModal
          restaurant={bookingsRestaurant}
          onClose={() => setBookingsRestaurant(null)}
        />
      )}
    </div>
  )
}
