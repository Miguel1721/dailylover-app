import React, { useState, useEffect, useCallback } from 'react'
import { Calendar as CalendarIcon, MessageCircle, Copy, CheckCircle, RefreshCw, MapPin, User, Clock, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

export default function CalendarioCitas() {
  const { token } = useAuth()
  const [calendarDates, setCalendarDates] = useState([])
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [successBanner, setSuccessBanner] = useState('')

  const fetchCalendar = useCallback(() => {
    setLoading(true)
    fetch(`${API}/api/v1/matchmaking/calendar`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setCalendarDates(data.calendar || [])
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching calendar:', err)
        setLoading(false)
      })
  }, [token])

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
        setCalendarDates(prev => prev.map(item => item.id === calId ? { ...item, ...updates } : item))
        if (updates.had_date && updates.feedback) {
          setSuccessBanner('¡Cita marcada como COMPLETADA! Estado actualizado en la psicóloga y en el historial.')
          setTimeout(() => setSuccessBanner(''), 4000)
        }
        if (updates.reschedule) {
          setSuccessBanner('¡Cita marcada para reprogramar! Transferida a EN PAUSA conservando historial.')
          setTimeout(() => setSuccessBanner(''), 4000)
        }
      } else {
        alert(data.detail || 'Error al actualizar cita')
      }
    } catch (e) {
      alert('Error de conexión al actualizar')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <CalendarIcon size={28} color="#B8324F" />
            Calendario de Citas & Despacho WhatsApp
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Citas agendadas formalmente. Botones con plantillas de WhatsApp personalizadas (Reserva fija: <strong>María Paula Salinas</strong>).
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

      {/* Banner */}
      {successBanner && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10B981',
          color: '#065F46',
          padding: '10px 16px',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <CheckCircle size={18} color="#10B981" />
          {successBanner}
        </div>
      )}

      {/* Main Calendar Table */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        overflowX: 'auto'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 14px', minWidth: 180 }}>Persona A × Persona B</th>
              <th style={{ padding: '12px 12px', minWidth: 160 }}>Día / Fecha & Hora</th>
              <th style={{ padding: '12px 12px', minWidth: 180 }}>Lugar / Restaurante</th>
              <th style={{ padding: '12px 10px', width: 90 }}>Ciudad</th>
              <th style={{ padding: '12px 14px', minWidth: 320, textAlign: 'center' }}>Mensajes WhatsApp (1-Clic)</th>
              <th style={{ padding: '12px 12px', width: 130, textAlign: 'center' }}>¿Tuvo la Cita?</th>
              <th style={{ padding: '12px 14px', minWidth: 200 }}>Retroalimentación</th>
              <th style={{ padding: '12px 12px', width: 120, textAlign: 'center' }}>¿Reprogramar?</th>
            </tr>
          </thead>
          <tbody>
            {loading && calendarDates.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Cargando calendario de citas...
                </td>
              </tr>
            ) : calendarDates.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No hay citas agendadas actualmente en el calendario.
                </td>
              </tr>
            ) : (
              calendarDates.map((item) => {
                let rowBg = 'transparent'
                if (item.had_date) {
                  rowBg = 'rgba(106, 168, 79, 0.08)' // Verde completada
                } else if (item.reschedule) {
                  rowBg = 'rgba(249, 203, 156, 0.12)' // Naranja reprogramar
                }

                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: rowBg,
                      transition: 'background 0.15s'
                    }}
                  >
                    {/* Pareja */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.person_a}
                      </div>
                      <div style={{ fontSize: 12, color: '#134F5C', fontWeight: 600 }}>
                        × {item.person_b}
                      </div>
                    </td>

                    {/* Día */}
                    <td style={{ padding: '10px 12px' }}>
                      <input
                        type="text"
                        defaultValue={item.date_time}
                        placeholder="Ej: Sáb 24 Ago - 7:30 PM"
                        onBlur={e => {
                          if (e.target.value !== item.date_time) {
                            handleUpdateDate(item.id, { date_time: e.target.value })
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 4,
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-base)',
                          color: 'var(--text-primary)',
                          fontSize: 13,
                          outline: 'none'
                        }}
                      />
                    </td>

                    {/* Lugar */}
                    <td style={{ padding: '10px 12px' }}>
                      <input
                        type="text"
                        defaultValue={item.venue}
                        placeholder="Ej: Restaurante Criterión"
                        onBlur={e => {
                          if (e.target.value !== item.venue) {
                            handleUpdateDate(item.id, { venue: e.target.value })
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 4,
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-base)',
                          color: 'var(--text-primary)',
                          fontSize: 13,
                          outline: 'none'
                        }}
                      />
                    </td>

                    {/* Ciudad */}
                    <td style={{ padding: '12px 10px', fontWeight: 500 }}>
                      {item.city || '—'}
                    </td>

                    {/* Botones WhatsApp */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          onClick={() => copyToClipboard(item.whatsapp_confirmacion, 'confirmacion', item.id)}
                          title="Copiar mensaje de confirmación inicial"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: '#D9EAD3',
                            color: '#274E13',
                            border: '1px solid #B6D7A8',
                            borderRadius: 4,
                            padding: '5px 8px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <MessageCircle size={13} color="#274E13" />
                          {copiedId === `${item.id}-confirmacion` ? '✓ Copiado' : '1. Confirmación'}
                        </button>

                        <button
                          onClick={() => copyToClipboard(item.whatsapp_dia_antes, 'dia_antes', item.id)}
                          title="Copiar mensaje de recordatorio 24h antes"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: '#CFE2F3',
                            color: '#1B365D',
                            border: '1px solid #A2C4C9',
                            borderRadius: 4,
                            padding: '5px 8px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Clock size={13} color="#1B365D" />
                          {copiedId === `${item.id}-dia_antes` ? '✓ Copiado' : '2. Día Antes'}
                        </button>

                        <button
                          onClick={() => copyToClipboard(item.whatsapp_hoy, 'hoy', item.id)}
                          title="Copiar mensaje del día del evento"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: '#FFE599',
                            color: '#7F6000',
                            border: '1px solid #F9CB9C',
                            borderRadius: 4,
                            padding: '5px 8px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <CheckCircle size={13} color="#7F6000" />
                          {copiedId === `${item.id}-hoy` ? '✓ Copiado' : '3. Hoy'}
                        </button>
                      </div>
                    </td>

                    {/* ¿Tuvo la Cita? */}
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={item.had_date}
                          onChange={e => handleUpdateDate(item.id, { had_date: e.target.checked, feedback: item.feedback })}
                          style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 11, fontWeight: 600, color: item.had_date ? '#274E13' : 'var(--text-secondary)' }}>
                          {item.had_date ? 'Sí' : 'No'}
                        </span>
                      </label>
                    </td>

                    {/* Retroalimentación */}
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="text"
                        defaultValue={item.feedback}
                        placeholder="Notas de feedback tras la cita..."
                        onBlur={e => {
                          if (e.target.value !== item.feedback) {
                            handleUpdateDate(item.id, { feedback: e.target.value, had_date: item.had_date })
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 4,
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-base)',
                          color: 'var(--text-primary)',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </td>

                    {/* ¿Reprogramar? */}
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={item.reschedule}
                          onChange={e => handleUpdateDate(item.id, { reschedule: e.target.checked })}
                          style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 11, fontWeight: 600, color: item.reschedule ? '#783F04' : 'var(--text-secondary)' }}>
                          {item.reschedule ? 'Sí (En Pausa)' : 'No'}
                        </span>
                      </label>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
