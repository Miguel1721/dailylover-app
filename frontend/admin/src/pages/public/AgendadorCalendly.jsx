import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Calendar as CalendarIcon, Clock, Video, MapPin, CheckCircle2, 
  ChevronRight, ArrowLeft, Download, ShieldCheck, Heart, User, Phone, Mail, Sparkles, Award
} from 'lucide-react'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

export default function AgendadorCalendly() {
  const { psicologaSlug } = useParams()
  const navigate = useNavigate()

  const [availability, setAvailability] = useState(null)
  const [loading, setLoading] = useState(true)

  // Selección de fecha y hora
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')

  // Formulario de Intake
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    city: 'Bogotá',
    motivo: 'Busco una pareja estable con valores afines',
    rango_edad: '26 a 36 años',
    innegociables: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState(null)

  // Cargar disponibilidad global de citas
  useEffect(() => {
    setLoading(true)
    // Si viene psicologaSlug específico, consultar esa psicóloga; si no, consultar la disponibilidad global unificada
    const endpoint = psicologaSlug 
      ? `${API}/api/v1/booking/psychologist/${psicologaSlug}/availability`
      : `${API}/api/v1/booking/availability`
      
    fetch(endpoint)
      .then(r => r.json())
      .then(d => {
        setAvailability(d)
        if (d.available_days && d.available_days.length > 0) {
          setSelectedDate(d.available_days[0])
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching availability:', err)
        setLoading(false)
      })
  }, [psicologaSlug])

  const handleBook = async (e) => {
    e.preventDefault()
    if (!selectedDate || !selectedSlot) {
      alert('Por favor selecciona fecha y hora para tu entrevista.')
      return
    }

    setSubmitting(true)
    try {
      // El cliente no escoge a la psicóloga; se envía 'AUTO' para asignación automática según el turno activo
      const payload = {
        psychologist_name: 'AUTO',
        date: selectedDate,
        time_slot: selectedSlot,
        client_name: formData.name,
        client_phone: formData.phone,
        client_email: formData.email,
        client_city: formData.city,
        intake_answers: {
          motivo: formData.motivo,
          rango_edad: formData.rango_edad,
          innegociables: formData.innegociables
        }
      }

      const res = await fetch(`${API}/api/v1/booking/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (res.ok) {
        setConfirmation(data)
      } else {
        alert(data.detail || 'No se pudo completar la reserva. El horario pudo haber sido ocupado.')
      }
    } catch (e) {
      alert('Error de conexión al procesar la cita.')
    } finally {
      setSubmitting(false)
    }
  }

  const downloadIcs = () => {
    if (!confirmation?.ics_data) return
    const blob = new Blob([confirmation.ics_data], { type: 'text/calendar;charset=utf-8' })
    const link = document.createElement('a')
    link.href = window.URL.createObjectURL(blob)
    link.setAttribute('download', `entrevista-daily-lover-${confirmation.videocall_token}.ics`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // PANTALLA DE CONFIRMACIÓN CON ASIGNACIÓN AUTOMÁTICA
  if (confirmation) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0D0A0B',
        color: '#F5F0F1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24
      }}>
        <div style={{
          background: '#1A1214',
          border: '1px solid rgba(150, 21, 0, 0.4)',
          borderRadius: 16,
          maxWidth: 600,
          width: '100%',
          padding: 40,
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
        }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10B981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: '#10B981'
          }}>
            <CheckCircle2 size={40} />
          </div>

          <h2 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 8px', color: '#F5F0F1' }}>
            ¡Cita Agendada Exitosamente!
          </h2>
          <p style={{ color: '#9A8A8D', fontSize: 14, margin: '0 0 24px' }}>
            Tu entrevista ha sido asignada con una de nuestras especialistas clínicas de Matchmaking.
          </p>

          {/* Tarjeta de la Psicóloga Asignada Automáticamente */}
          <div style={{
            background: '#110D0E',
            border: '1px solid rgba(150, 21, 0, 0.25)',
            borderRadius: 12,
            padding: 20,
            textAlign: 'left',
            marginBottom: 24
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid rgba(150, 21, 0, 0.15)' }}>
              <img
                src={confirmation.psychologist?.avatar || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'}
                alt="Psicóloga Asignada"
                style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', border: '2px solid #961500' }}
              />
              <div>
                <span style={{ fontSize: 11, color: '#10B981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Psicóloga Asignada:
                </span>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#F5F0F1' }}>
                  {confirmation.psychologist?.name}
                </div>
                <div style={{ fontSize: 12, color: '#9A8A8D' }}>
                  {confirmation.psychologist?.role} • {confirmation.psychologist?.city}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 13 }}>
              <div>
                <div style={{ color: '#9A8A8D', marginBottom: 2 }}>Fecha & Hora</div>
                <div style={{ fontWeight: 600, color: '#F5F0F1' }}>{confirmation.date} a las {confirmation.time_slot}</div>
              </div>
              <div>
                <div style={{ color: '#9A8A8D', marginBottom: 2 }}>Duración</div>
                <div style={{ fontWeight: 600, color: '#10B981' }}>45 minutos</div>
              </div>
              <div>
                <div style={{ color: '#9A8A8D', marginBottom: 2 }}>Candidato(a)</div>
                <div style={{ fontWeight: 600, color: '#F5F0F1' }}>{confirmation.client_name}</div>
              </div>
              <div>
                <div style={{ color: '#9A8A8D', marginBottom: 2 }}>Código de Videollamada</div>
                <div style={{ fontWeight: 600, color: '#c41a00', fontFamily: 'monospace' }}>{confirmation.videocall_token}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <a
              href={`/admin/matchmaking/sala/${confirmation.videocall_token}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px 20px',
                background: '#961500',
                borderRadius: 10,
                color: '#FFF',
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
                boxShadow: '0 4px 15px rgba(150,21,0,0.4)'
              }}
            >
              <Video size={18} />
              <span>Entrar a la Sala de Videollamada</span>
            </a>

            <button
              onClick={downloadIcs}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 20px',
                background: 'transparent',
                border: '1px solid rgba(150, 21, 0, 0.4)',
                borderRadius: 10,
                color: '#F5F0F1',
                fontWeight: 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              <Download size={16} />
              <span>Guardar en tu Calendario (.ics)</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // PANTALLA PRINCIPAL: AGENDADOR PÚBLICO INSTITUCIONAL
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0D0A0B',
      color: '#F5F0F1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px'
    }}>
      <div style={{
        maxWidth: 1060,
        width: '100%',
        background: '#1A1214',
        border: '1px solid rgba(150, 21, 0, 0.3)',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 390px) 1fr'
      }}>
        
        {/* PANEL IZQUIERDO: MARCA & DETALLES DE LA SESIÓN */}
        <div style={{
          background: '#140D0F',
          borderRight: '1px solid rgba(150, 21, 0, 0.25)',
          padding: '40px 32px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Brand header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
            <span style={{ color: '#961500', fontWeight: 800, fontSize: 18, letterSpacing: '0.05em' }}>DAILY LOVER</span>
            <span style={{ background: 'rgba(150,21,0,0.15)', color: '#c41a00', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
              CLÍNICA
            </span>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px', color: '#F5F0F1', lineHeight: 1.3 }}>
            Entrevista Clínica de Compatibilidad
          </h2>
          <p style={{ fontSize: 13, color: '#9A8A8D', lineHeight: 1.6, margin: '0 0 28px' }}>
            Selecciona el día y la hora que mejor se adapte a tu agenda. Nuestro sistema te asignará de forma automática a una de nuestras psicólogas clínicas según disponibilidad.
          </p>

          {/* Características clave */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 'auto', borderTop: '1px solid rgba(150, 21, 0, 0.15)', paddingTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#F5F0F1' }}>
              <Clock size={16} style={{ color: '#c41a00', flexShrink: 0 }} />
              <span><strong>45 minutos</strong> de sesión individual</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#F5F0F1' }}>
              <Video size={16} style={{ color: '#c41a00', flexShrink: 0 }} />
              <span>Videollamada Web HD (sin instalar aplicaciones)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#F5F0F1' }}>
              <Award size={16} style={{ color: '#c41a00', flexShrink: 0 }} />
              <span>Asignación con el equipo de 10 psicólogas</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#F5F0F1' }}>
              <ShieldCheck size={16} style={{ color: '#10B981', flexShrink: 0 }} />
              <span>100% Confidencial bajo secreto profesional</span>
            </div>
          </div>
        </div>

        {/* PANEL DERECHO: SELECCIONAR DÍA & HORA + DATOS */}
        <div style={{ padding: '36px 36px', overflowY: 'auto', maxHeight: '88vh' }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#9A8A8D' }}>
              Cargando horarios disponibles del equipo clínico...
            </div>
          ) : !availability?.available_days?.length ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#9A8A8D' }}>
              No hay horarios disponibles publicados para los próximos 14 días.
            </div>
          ) : (
            <form onSubmit={handleBook}>
              
              {/* PASO 1: SELECCIONAR FECHA */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#F5F0F1' }}>
                    1. Selecciona Fecha
                  </h3>
                  <span style={{ fontSize: 12, color: '#9A8A8D' }}>
                    {availability.available_days.length} días con turnos disponibles
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {availability.available_days.map(dStr => {
                    const isSelected = selectedDate === dStr
                    const slotsCount = availability.slots_by_day?.[dStr]?.length || 0
                    const parts = dStr.split('-')
                    const label = `${parts[2]}/${parts[1]}`
                    return (
                      <button
                        key={dStr}
                        type="button"
                        onClick={() => {
                          setSelectedDate(dStr)
                          setSelectedSlot('')
                        }}
                        style={{
                          padding: '10px 16px',
                          borderRadius: 10,
                          background: isSelected ? '#961500' : '#110D0E',
                          border: isSelected ? '1px solid #c41a00' : '1px solid rgba(150, 21, 0, 0.25)',
                          color: isSelected ? '#FFF' : '#F5F0F1',
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 3,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span>{label}</span>
                        <span style={{ fontSize: 10, color: isSelected ? 'rgba(255,255,255,0.8)' : '#10B981' }}>
                          {slotsCount} horas
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* PASO 2: SELECCIONAR HORA */}
              {selectedDate && (
                <div style={{ marginBottom: 28 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: '#F5F0F1' }}>
                    2. Selecciona Horario (Hora Colombia)
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
                    {(availability.slots_by_day?.[selectedDate] || []).map(slot => {
                      const isSelected = selectedSlot === slot
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            background: isSelected ? '#961500' : '#140D0F',
                            border: isSelected ? '1px solid #c41a00' : '1px solid rgba(150, 21, 0, 0.25)',
                            color: isSelected ? '#FFF' : '#F5F0F1',
                            fontWeight: 700,
                            fontSize: 14,
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {slot}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* PASO 3: TUS DATOS */}
              {selectedSlot && (
                <div style={{ borderTop: '1px solid rgba(150, 21, 0, 0.2)', paddingTop: 24, marginBottom: 24 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px', color: '#F5F0F1' }}>
                    3. Tus Datos para la Cita
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#9A8A8D', marginBottom: 6 }}>Nombre Completo *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: Camilo Gómez"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        style={{
                          width: '100%',
                          background: '#0D0A0B',
                          border: '1px solid rgba(150, 21, 0, 0.3)',
                          padding: '10px 12px',
                          borderRadius: 8,
                          color: '#F5F0F1',
                          fontSize: 13,
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#9A8A8D', marginBottom: 6 }}>WhatsApp / Celular *</label>
                      <input
                        type="tel"
                        required
                        placeholder="Ej: 3101234567"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        style={{
                          width: '100%',
                          background: '#0D0A0B',
                          border: '1px solid rgba(150, 21, 0, 0.3)',
                          padding: '10px 12px',
                          borderRadius: 8,
                          color: '#F5F0F1',
                          fontSize: 13,
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#9A8A8D', marginBottom: 6 }}>Correo Electrónico</label>
                      <input
                        type="email"
                        placeholder="camilo@ejemplo.com"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        style={{
                          width: '100%',
                          background: '#0D0A0B',
                          border: '1px solid rgba(150, 21, 0, 0.3)',
                          padding: '10px 12px',
                          borderRadius: 8,
                          color: '#F5F0F1',
                          fontSize: 13,
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#9A8A8D', marginBottom: 6 }}>Ciudad</label>
                      <select
                        value={formData.city}
                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                        style={{
                          width: '100%',
                          background: '#0D0A0B',
                          border: '1px solid rgba(150, 21, 0, 0.3)',
                          padding: '10px 12px',
                          borderRadius: 8,
                          color: '#F5F0F1',
                          fontSize: 13,
                          boxSizing: 'border-box'
                        }}
                      >
                        <option value="Bogotá">Bogotá</option>
                        <option value="Medellín">Medellín</option>
                        <option value="Cali">Cali</option>
                        <option value="Barranquilla">Barranquilla</option>
                        <option value="Miami">Miami</option>
                        <option value="Madrid">Madrid</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#9A8A8D', marginBottom: 6 }}>
                      Tus innegociables principales (opcional, para la psicóloga):
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ej: No tolero el humo de cigarrillo, quiero tener hijos a futuro, etc."
                      value={formData.innegociables}
                      onChange={e => setFormData({ ...formData, innegociables: e.target.value })}
                      style={{
                        width: '100%',
                        background: '#0D0A0B',
                        border: '1px solid rgba(150, 21, 0, 0.3)',
                        padding: '10px 12px',
                        borderRadius: 8,
                        color: '#F5F0F1',
                        fontSize: 13,
                        boxSizing: 'border-box',
                        resize: 'none'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '14px 20px',
                      background: '#961500',
                      border: 'none',
                      borderRadius: 10,
                      color: '#FFF',
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: 'pointer',
                      boxShadow: '0 6px 20px rgba(150,21,0,0.4)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {submitting ? 'Confirmando Cita...' : `Confirmar Cita para el ${selectedDate} a las ${selectedSlot}`}
                  </button>
                </div>
              )}

            </form>
          )}
        </div>

      </div>
    </div>
  )
}
