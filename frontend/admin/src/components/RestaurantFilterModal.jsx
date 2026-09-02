import React, { useState, useEffect, useCallback } from 'react'
import { Calendar as CalendarIcon, Clock, MapPin, DollarSign, Utensils, CheckCircle, X, Search, AlertCircle } from 'lucide-react'

const API = 'https://prueba-daily.agentesia.cloud'

const CITIES = [
  'Bogotá', 'Medellín', 'Chía', 'Cali', 'Barranquilla', 'Bucaramanga',
  'Pereira', 'Cartagena', 'Manizales', 'Santa Marta'
]

const BUDGET_CATEGORIES = [
  { id: 'all', label: 'Cualquier Presupuesto', desc: 'Ver todos los precios' },
  { id: 'Menos de 100k', label: 'Menos de 100k', desc: '< $100.000 COP' },
  { id: '100k-200k', label: '100k - 200k', desc: '$100.000 a $200.000 COP' },
  { id: '200k-300k', label: '200k - 300k', desc: '$200.000 a $300.000 COP' },
  { id: 'Más de 300k', label: 'Más de 300k', desc: '> $300.000 COP' },
]

const POPULAR_TIMES = [
  '12:00', '12:30', '13:00', '13:30',
  '19:00', '19:30', '20:00', '20:30', '21:00'
]

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_FULL_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function RestaurantFilterModal({ match, initialDate, initialVenue, onClose, onConfirm }) {
  // Filtro 1: Ciudad
  const [city, setCity] = useState(match?.city || 'Bogotá')
  
  // Filtro 2: Día (Fecha y cálculo de día)
  const defaultDateObj = new Date()
  defaultDateObj.setDate(defaultDateObj.getDate() + 2)
  const defaultDateStr = defaultDateObj.toISOString().slice(0, 10)
  
  const [selectedDate, setSelectedDate] = useState(initialDate ? initialDate.slice(0, 10) : defaultDateStr)
  const [showCalendarModal, setShowCalendarModal] = useState(false)
  
  // Filtro 3: Hora
  const [selectedTime, setSelectedTime] = useState(initialDate && initialDate.length > 11 ? initialDate.slice(11, 16) : '19:30')
  const [showTimeModal, setShowTimeModal] = useState(false)

  // Filtro 4: Presupuesto
  const [budgetCategory, setBudgetCategory] = useState('100k-200k')

  // Restaurante Seleccionado
  const [selectedRestaurant, setSelectedRestaurant] = useState(null)
  const [customVenue, setCustomVenue] = useState('')
  const [isCustom, setIsCustom] = useState(false)

  // Lista de Restaurantes filtrados
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Calcular día de la semana a partir de la fecha elegida
  const getDayOfWeekCode = (dateStr) => {
    if (!dateStr) return 'Vie'
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      return DAY_NAMES[d.getDay()]
    }
    return 'Vie'
  }

  const getDayFullName = (dateStr) => {
    if (!dateStr) return 'Viernes'
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      return DAY_FULL_NAMES[d.getDay()]
    }
    return 'Viernes'
  }

  const currentDayCode = getDayOfWeekCode(selectedDate)
  const currentDayFullName = getDayFullName(selectedDate)

  // Fetch restaurantes con los 4 filtros combinados
  const fetchRestaurants = useCallback(async () => {
    setLoading(true)
    let url = `${API}/api/v1/matchmaking/restaurants?`
    if (city && city !== 'all') url += `city=${encodeURIComponent(city)}&`
    if (currentDayCode) url += `day=${encodeURIComponent(currentDayCode)}&`
    if (budgetCategory && budgetCategory !== 'all') url += `budget_category=${encodeURIComponent(budgetCategory)}&`
    if (selectedTime) url += `time=${encodeURIComponent(selectedTime)}&`
    if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`

    try {
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setRestaurants(data.restaurants || [])
        if (selectedRestaurant && !data.restaurants.some(r => r.id === selectedRestaurant.id)) {
          setSelectedRestaurant(null)
        }
      }
    } catch (e) {
      console.error('Error al consultar restaurantes:', e)
      setRestaurants([])
    } finally {
      setLoading(false)
    }
  }, [city, currentDayCode, budgetCategory, selectedTime, searchTerm, selectedRestaurant])

  useEffect(() => {
    fetchRestaurants()
  }, [fetchRestaurants])

  const handleFinalSubmit = async (e) => {
    e.preventDefault()
    if (!selectedDate || !selectedTime) {
      alert('Por favor selecciona el día y la hora de la cita.')
      return
    }

    let finalVenueName = ''
    if (isCustom) {
      if (!customVenue.trim()) {
        alert('Por favor escribe el nombre del lugar personalizado.')
        return
      }
      finalVenueName = customVenue.trim()
    } else if (selectedRestaurant) {
      finalVenueName = `${selectedRestaurant.name} (${selectedRestaurant.zone || selectedRestaurant.city})`
    } else {
      alert('Por favor selecciona un restaurante de la lista filtrada o elige "Otro lugar por definir".')
      return
    }

    const fullDateTime = `${selectedDate} ${selectedTime}:00`
    setSubmitting(true)
    try {
      await onConfirm(fullDateTime, finalVenueName, {
        restaurant: selectedRestaurant,
        city,
        day: currentDayCode,
        time: selectedTime,
        budgetCategory
      })
      onClose()
    } catch (err) {
      alert(err.message || 'Error al agendar la cita.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }} onClick={onClose}>
      <div style={{
        background: '#160F11', border: '1px solid var(--border-color)', borderRadius: 16,
        padding: 24, maxWidth: 840, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 12px 50px rgba(0,0,0,0.7)', color: 'var(--text-primary)'
      }} onClick={e => e.stopPropagation()}>

        {/* Encabezado del Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
              <Utensils size={22} style={{ color: 'var(--color-primary)' }} />
              Filtrar y Seleccionar Restaurante de Cita
            </h2>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Pareja: <strong style={{ color: '#fff' }}>{match?.person_a}</strong> × <strong style={{ color: '#fff' }}>{match?.person_b}</strong>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* ── BARRA DE LOS 4 FILTROS INTERACTIVOS ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12,
          background: 'rgba(150,21,0,0.06)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 14, marginBottom: 20
        }}>
          
          {/* 1. FILTRO CIUDAD */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
              <MapPin size={13} style={{ color: 'var(--color-primary)' }} /> 1. Ciudad
            </label>
            <select
              value={city}
              onChange={e => setCity(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8,
                border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer'
              }}
            >
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* 2. FILTRO DÍA (MODAL / SELECTOR DE CALENDARIO DEDICADO) */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
              <CalendarIcon size={13} style={{ color: 'var(--color-primary)' }} /> 2. Día ({currentDayCode})
            </label>
            <button
              type="button"
              onClick={() => setShowCalendarModal(true)}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8,
                border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, textAlign: 'left',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
              }}
            >
              <span>{selectedDate ? `${currentDayFullName.slice(0,3)} ${selectedDate}` : 'Elegir Fecha'}</span>
              <CalendarIcon size={14} style={{ color: 'var(--color-primary)' }} />
            </button>
          </div>

          {/* 3. FILTRO HORA (MODAL / SELECTOR DE HORA DEDICADO) */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
              <Clock size={13} style={{ color: 'var(--color-primary)' }} /> 3. Hora
            </label>
            <button
              type="button"
              onClick={() => setShowTimeModal(true)}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8,
                border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, textAlign: 'left',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
              }}
            >
              <span>{selectedTime ? `${selectedTime} ${Number(selectedTime.split(':')[0]) >= 12 ? 'PM' : 'AM'}` : 'Elegir Hora'}</span>
              <Clock size={14} style={{ color: 'var(--color-primary)' }} />
            </button>
          </div>

          {/* 4. FILTRO PRESUPUESTO */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
              <DollarSign size={13} style={{ color: 'var(--color-primary)' }} /> 4. Presupuesto
            </label>
            <select
              value={budgetCategory}
              onChange={e => setBudgetCategory(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8,
                border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer'
              }}
            >
              {BUDGET_CATEGORIES.map(b => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </div>

        </div>

        {/* ── BÚSQUEDA RÁPIDA DENTRO DE LOS RESULTADOS ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
            Restaurantes Disponibles ({restaurants.length} opciones en {city} para el día {currentDayFullName}):
          </div>
          <div style={{ position: 'relative', width: 240 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar por nombre o tipo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%', padding: '6px 10px 6px 30px', borderRadius: 6,
                border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                color: 'var(--text-primary)', fontSize: 12, outline: 'none'
              }}
            />
          </div>
        </div>

        {/* ── LISTA DE RESTAURANTES FILTRADOS ── */}
        <div style={{
          maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border-color)',
          borderRadius: 10, background: 'var(--bg-base)', padding: 8, marginBottom: 20
        }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Cargando restaurantes que coinciden con los 4 filtros...
            </div>
          ) : restaurants.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <AlertCircle size={28} style={{ color: '#D97706', margin: '0 auto 8px', display: 'block' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                No se encontraron restaurantes con esta combinación exacta.
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Prueba cambiando la categoría de presupuesto o seleccionando otro día.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {restaurants.map(r => {
                const isSelected = selectedRestaurant?.id === r.id && !isCustom
                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      setSelectedRestaurant(r)
                      setIsCustom(false)
                    }}
                    style={{
                      padding: 12, borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s ease',
                      border: isSelected ? '2px solid var(--color-primary)' : '1px solid rgba(150,21,0,0.15)',
                      background: isSelected ? 'rgba(150,21,0,0.15)' : 'rgba(255,255,255,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: isSelected ? '#fff' : 'var(--text-primary)' }}>
                        {r.name}
                      </div>
                      {isSelected && <CheckCircle size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--color-primary-light)', marginTop: 2 }}>
                      {r.food_type || 'Restaurante'}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                      <span>📍 {r.zone || r.city}</span>
                      <span style={{ fontWeight: 600, color: '#4ADE80' }}>${Number(r.price_num_cop).toLocaleString('es-CO')}</span>
                    </div>

                    {r.detailed_location && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.detailed_location}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── OPCIÓN LUGAR PERSONALIZADO / POR DEFINIR ── */}
        <div style={{
          border: isCustom ? '2px solid var(--color-primary)' : '1px dashed var(--border-color)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 20, background: isCustom ? 'rgba(150,21,0,0.08)' : 'transparent',
          cursor: 'pointer'
        }} onClick={() => { setIsCustom(true); setSelectedRestaurant(null); }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="radio"
              checked={isCustom}
              onChange={() => { setIsCustom(true); setSelectedRestaurant(null); }}
              style={{ accentColor: 'var(--color-primary)' }}
            />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Otro lugar personalizado o por definir fuera del catálogo</span>
          </div>
          {isCustom && (
            <input
              type="text"
              autoFocus
              placeholder="Escribe el nombre del restaurante o lugar alternativo..."
              value={customVenue}
              onChange={e => setCustomVenue(e.target.value)}
              style={{
                width: '100%', marginTop: 8, padding: '8px 12px', borderRadius: 6,
                border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                color: 'var(--text-primary)', fontSize: 13, outline: 'none'
              }}
            />
          )}
        </div>

        {/* ── RESUMEN SELECCIONADO Y BOTÓN DE CONFIRMACIÓN ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
          <div style={{ fontSize: 13 }}>
            {selectedRestaurant ? (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Cita: </span>
                <strong style={{ color: '#fff' }}>{selectedRestaurant.name}</strong> • <span>{currentDayFullName} {selectedDate} a las {selectedTime}</span>
              </div>
            ) : isCustom && customVenue ? (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Cita: </span>
                <strong style={{ color: '#fff' }}>{customVenue}</strong> • <span>{currentDayFullName} {selectedDate} a las {selectedTime}</span>
              </div>
            ) : (
              <span style={{ color: '#D97706' }}>Selecciona un restaurante o lugar de la lista</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border-color)',
                background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={submitting || (!selectedRestaurant && (!isCustom || !customVenue.trim()))}
              onClick={handleFinalSubmit}
              style={{
                padding: '9px 24px', borderRadius: 8, border: 'none',
                background: (!selectedRestaurant && (!isCustom || !customVenue.trim())) ? '#4A3B3D' : 'var(--color-primary)',
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                opacity: submitting ? 0.7 : 1
              }}
            >
              {submitting ? 'Guardando...' : 'Confirmar Cita y Restaurante'}
            </button>
          </div>
        </div>

      </div>

      {/* ── SUB-MODAL 1: SELECTOR DEDICADO DE CALENDARIO / FECHA ── */}
      {showCalendarModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }} onClick={() => setShowCalendarModal(false)}>
          <div style={{
            background: '#1A1214', border: '1px solid var(--border-color)', borderRadius: 14,
            padding: 20, maxWidth: 360, width: '100%', boxShadow: '0 8px 30px rgba(0,0,0,0.6)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarIcon size={18} style={{ color: 'var(--color-primary)' }} />
                Elegir Fecha de la Cita
              </div>
              <button onClick={() => setShowCalendarModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                color: 'var(--text-primary)', fontSize: 16, outline: 'none', marginBottom: 16
              }}
            />

            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, textAlign: 'center' }}>
              Día seleccionado: <strong style={{ color: 'var(--color-primary-light)' }}>{currentDayFullName} ({currentDayCode})</strong>
            </div>

            <button
              type="button"
              onClick={() => setShowCalendarModal(false)}
              style={{
                width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer'
              }}
            >
              Aplicar Fecha
            </button>
          </div>
        </div>
      )}

      {/* ── SUB-MODAL 2: SELECTOR DEDICADO DE HORA ── */}
      {showTimeModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }} onClick={() => setShowTimeModal(false)}>
          <div style={{
            background: '#1A1214', border: '1px solid var(--border-color)', borderRadius: 14,
            padding: 20, maxWidth: 360, width: '100%', boxShadow: '0 8px 30px rgba(0,0,0,0.6)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} style={{ color: 'var(--color-primary)' }} />
                Elegir Hora de la Cita
              </div>
              <button onClick={() => setShowTimeModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Horarios Populares:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
              {POPULAR_TIMES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setSelectedTime(t)
                    setShowTimeModal(false)
                  }}
                  style={{
                    padding: '8px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: selectedTime === t ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                    background: selectedTime === t ? 'rgba(150,21,0,0.2)' : 'var(--bg-base)',
                    color: selectedTime === t ? '#fff' : 'var(--text-primary)'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>O especifica hora exacta:</div>
            <input
              type="time"
              value={selectedTime}
              onChange={e => setSelectedTime(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                color: 'var(--text-primary)', fontSize: 14, outline: 'none', marginBottom: 16
              }}
            />

            <button
              type="button"
              onClick={() => setShowTimeModal(false)}
              style={{
                width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer'
              }}
            >
              Aplicar Hora
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
