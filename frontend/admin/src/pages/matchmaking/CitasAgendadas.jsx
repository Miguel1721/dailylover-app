import React, { useState, useEffect, useCallback } from 'react'
import { Calendar as CalendarIcon, MessageCircle, Copy, CheckCircle, RefreshCw, MapPin, User, Clock, AlertCircle, Search, Filter, Utensils, RotateCcw } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import CrmPersonLink from '../../components/CrmPersonLink'

const API = 'https://prueba-daily.agentesia.cloud'

const CITIES = [
  'Todas', 'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga',
  'Pereira', 'Cartagena', 'Manizales', 'Santa Marta', 'Miami', 'Madrid'
]

export default function CitasAgendadas() {
  const { token } = useAuth()
  const [calendarDates, setCalendarDates] = useState([])
  const [loading, setLoading] = useState(false)
  const [cityFilter, setCityFilter] = useState('Todas')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [successBanner, setSuccessBanner] = useState('')

  const fetchCalendar = useCallback(() => {
    setLoading(true)
    let url = `${API}/api/v1/matchmaking/calendar?`
    if (cityFilter && cityFilter !== 'Todas') url += `city=${encodeURIComponent(cityFilter)}&`
    if (dateFrom) url += `date_from=${encodeURIComponent(dateFrom)}&`
    if (dateTo) url += `date_to=${encodeURIComponent(dateTo)}&`
    if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setCalendarDates(data.calendar || [])
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching calendar:', err)
        setCalendarDates([])
        setLoading(false)
      })
  }, [cityFilter, dateFrom, dateTo, searchTerm, token])

  useEffect(() => {
    fetchCalendar()
  }, [fetchCalendar])

  const copyToClipboard = (text, type, id) => {
    navigator.clipboard.writeText(text)
    setCopiedId(`${id}-${type}`)
    setSuccessBanner(`¡Mensaje de ${type.toUpperCase()} copiado al portapapeles!`)
    setTimeout(() => {
      setCopiedId(null)
      setSuccessBanner('')
    }, 2500)
  }

  const handleUpdateDate = async (calId, updates) => {
    setSavingId(calId)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/calendar/${calId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      })

      const data = await res.json()
      if (res.ok) {
        if (updates.reschedule) {
          setSuccessBanner('¡Cita reprogramada! Se ha generado una fila de reintento.')
          setTimeout(() => setSuccessBanner(''), 5000)
          fetchCalendar()
        } else {
          setCalendarDates(prev => prev.map(c => c.calendar_id === calId ? { ...c, ...updates } : c))
          setSuccessBanner('Cambio guardado exitosamente.')
          setTimeout(() => setSuccessBanner(''), 3000)
        }
      } else {
        alert(data.detail || 'Error al actualizar cita')
      }
    } catch (e) {
      alert('Error de conexión al actualizar cita')
    } finally {
      setSavingId(null)
    }
  }

  const handleReschedulePrompt = (item) => {
    const newDate = window.prompt(`Ingresa nueva fecha y hora para ${item.person_a} y ${item.person_b} (YYYY-MM-DD HH:mm):`, "")
    if (!newDate) return
    const reason = window.prompt('Motivo de la reprogramación:', "Cliente solicitó cambio de horario")
    handleUpdateDate(item.calendar_id, {
      reschedule: true,
      new_scheduled_date: newDate,
      reschedule_reason: reason
    })
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1650, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <CalendarIcon size={28} style={{ color: 'var(--color-primary)' }} />
            Citas Agendadas (Calendario & Mensajería)
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Control de citas confirmadas, plantillas de mensajes (Confirmación, Día Antes, Hoy) y gestión de reprogramaciones.
          </p>
        </div>

        <button
          onClick={fetchCalendar}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 13,
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refrescar
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Citas Agendadas</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{calendarDates.length}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid #B6D7A8', borderRadius: 10, padding: '16px' }}>
          <div style={{ fontSize: 11, color: '#274E13', fontWeight: 700, textTransform: 'uppercase' }}>Citas Realizadas</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#274E13', marginTop: 4 }}>
            {calendarDates.filter(c => c.had_date === true || c.had_date === 'true').length}
          </div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid #F9CB9C', borderRadius: 10, padding: '16px' }}>
          <div style={{ fontSize: 11, color: '#783F04', fontWeight: 700, textTransform: 'uppercase' }}>Reprogramadas</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#D97706', marginTop: 4 }}>
            {calendarDates.filter(c => c.rescheduled === true || c.rescheduled === 'true').length}
          </div>
        </div>
      </div>

      {/* Success Banner */}
      {successBanner && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10B981',
          color: '#10B981',
          padding: '10px 16px',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <CheckCircle size={16} />
          {successBanner}
        </div>
      )}

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        background: 'var(--bg-card)',
        padding: '12px 18px',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        marginBottom: 20,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Ciudad:</span>
          <select
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none'
            }}
          >
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Desde:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{
              padding: '5px 8px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 12,
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Hasta:</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{
              padding: '5px 8px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 12,
              outline: 'none'
            }}
          />
        </div>

        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar pareja o restaurante..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 12px 6px 32px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 12,
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state" style={{ padding: 40 }}>Cargando citas agendadas...</div>
        ) : calendarDates.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <CalendarIcon size={36} style={{ color: 'var(--color-primary)', margin: '0 auto 12px', display: 'block' }} />
            No hay citas confirmadas en el rango seleccionado.
          </div>
        ) : (
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(150,21,0,0.06)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>#</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Fecha Cita</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Persona A (Cliente)</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Persona B (Candidato)</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Lugar / Restaurante</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Ciudad</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'center', fontWeight: 700 }}>Mensajería WhatsApp</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'center', fontWeight: 700 }}>Reprogramar</th>
                </tr>
              </thead>
              <tbody>
                {calendarDates.map(c => (
                  <tr key={c.calendar_id || c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>{c.calendar_id || c.id}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                      📅 {c.scheduled_date || 'Por definir'}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                      <CrmPersonLink name={c.person_a} />
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                      <CrmPersonLink name={c.person_b} />
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      📍 {c.venue || 'Restaurante por confirmar'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      {c.city || 'Bogotá'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          onClick={() => copyToClipboard(c.msg_confirmation || `Hola! Tu cita está confirmada para ${c.scheduled_date} en ${c.venue}.`, 'confirmación', c.calendar_id)}
                          style={{
                            background: copiedId === `${c.calendar_id}-confirmación` ? '#10B981' : 'var(--bg-base)',
                            color: copiedId === `${c.calendar_id}-confirmación` ? '#fff' : 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                          title="Copiar plantilla de confirmación"
                        >
                          <Copy size={11} /> Confirmación
                        </button>
                        <button
                          onClick={() => copyToClipboard(c.msg_day_before || `Hola! Recordatorio: Mañana tienes tu cita a las ${c.scheduled_date} en ${c.venue}.`, 'día antes', c.calendar_id)}
                          style={{
                            background: copiedId === `${c.calendar_id}-día antes` ? '#10B981' : 'var(--bg-base)',
                            color: copiedId === `${c.calendar_id}-día antes` ? '#fff' : 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                          title="Copiar recordatorio de 24h antes"
                        >
                          <Copy size={11} /> Día Antes
                        </button>
                        <button
                          onClick={() => copyToClipboard(c.msg_today || `Hola! Hoy es tu cita con Daily Lover a las ${c.scheduled_date} en ${c.venue}. ¡Que la pases increíble!`, 'hoy', c.calendar_id)}
                          style={{
                            background: copiedId === `${c.calendar_id}-hoy` ? '#10B981' : 'var(--bg-base)',
                            color: copiedId === `${c.calendar_id}-hoy` ? '#fff' : 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                          title="Copiar recordatorio del día"
                        >
                          <Copy size={11} /> Hoy
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleReschedulePrompt(c)}
                        style={{
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#D97706',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          borderRadius: 6,
                          padding: '5px 12px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <RotateCcw size={12} /> Reprogramar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
