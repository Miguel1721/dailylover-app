import React, { useState, useEffect, useCallback } from 'react'
import { Calendar as CalendarIcon, Filter, Clock, MapPin, User, Search, RefreshCw, CheckCircle, Copy, RotateCcw, AlertTriangle, X, Mail, Send } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import CrmPersonLink from '../../components/CrmPersonLink'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

const CITIES = [
  'Todas', 'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga',
  'Pereira', 'Cartagena', 'Manizales', 'Santa Marta', 'Miami', 'Madrid'
]

import RestaurantFilterModal from '../../components/RestaurantFilterModal'
import NoShowModal from '../../components/NoShowModal'
import FeedbackModal from '../../components/FeedbackModal'

export default function CitasAgendadas() {
  const { token } = useAuth()
  const [calendarDates, setCalendarDates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCity, setSelectedCity] = useState('Todas')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [successBanner, setSuccessBanner] = useState('')
  const [rescheduleModalItem, setRescheduleModalItem] = useState(null)
  const [noShowModalItem, setNoShowModalItem] = useState(null)
  const [feedbackModalItem, setFeedbackModalItem] = useState(null)
  const [waModalTarget, setWaModalTarget] = useState(null)
  const [quickDateFilter, setQuickDateFilter] = useState('all')
  const [dispatchingFeedback, setDispatchingFeedback] = useState(false)
  const [singleSendingId, setSingleSendingId] = useState(null)

  const getTodayStr = () => {
    const d = new Date()
    return d.toISOString().slice(0, 10)
  }

  const getYesterdayStr = () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }

  const getTomorrowStr = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }

  const getThisWeekRange = () => {
    const now = new Date()
    const day = now.getDay()
    const diffToMonday = (day === 0 ? -6 : 1) - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + diffToMonday)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return {
      from: monday.toISOString().slice(0, 10),
      to: sunday.toISOString().slice(0, 10)
    }
  }

  const handleQuickDate = (type) => {
    setQuickDateFilter(type)
    if (type === 'today') {
      const t = getTodayStr()
      setDateFrom(t)
      setDateTo(t)
    } else if (type === 'yesterday') {
      const y = getYesterdayStr()
      setDateFrom(y)
      setDateTo(y)
    } else if (type === 'tomorrow') {
      const tm = getTomorrowStr()
      setDateFrom(tm)
      setDateTo(tm)
    } else if (type === 'this_week') {
      const { from, to } = getThisWeekRange()
      setDateFrom(from)
      setDateTo(to)
    } else if (type === 'all') {
      setDateFrom('')
      setDateTo('')
    }
  }

  const fetchCalendar = useCallback(() => {
    setLoading(true)
    let url = `${API}/api/v1/matchmaking/calendar?`
    if (selectedCity && selectedCity !== 'Todas') url += `city=${encodeURIComponent(selectedCity)}&`
    if (dateFrom) url += `date_from=${encodeURIComponent(dateFrom)}&`
    if (dateTo) url += `date_to=${encodeURIComponent(dateTo)}&`

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        let list = data.calendar || []
        if (searchTerm) {
          const s = searchTerm.toLowerCase()
          list = list.filter(item =>
            (item.person_a || '').toLowerCase().includes(s) ||
            (item.person_b || '').toLowerCase().includes(s) ||
            (item.venue || '').toLowerCase().includes(s)
          )
        }
        setCalendarDates(list)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching calendar:', err)
        setCalendarDates([])
        setLoading(false)
      })
  }, [selectedCity, dateFrom, dateTo, searchTerm, token])

  useEffect(() => {
    fetchCalendar()
  }, [fetchCalendar])

  const buildCanonicalWhatsAppMessage = (c, type) => {
    const rest = (c.venue && !c.venue.toLowerCase().includes('por definir')) ? c.venue : 'el restaurante acordado'
    const dt = (c.scheduled_date || c.date_time || 'fecha y hora acordada')
    if (type === 'confirmacion') {
      return c.whatsapp_confirmacion || c.msg_confirmation || `¡Hola! 🎉 Te confirmamos que tu cita Daily Lover ha quedado agendada en *${rest}* para el *${dt}*. La reserva está a nombre de ustedes. ¡Que disfruten muchísimo la velada!`
    }
    if (type === 'dia_antes') {
      return c.whatsapp_dia_antes || c.msg_day_before || `¡Hola! 👋 Paso por aquí para recordarte que mañana es tu cita Daily Lover en *${rest}* (*${dt}*). Por favor confírmame tu asistencia para dejar todo listo con el restaurante. ✨`
    }
    return c.whatsapp_hoy || c.msg_day_of || `¡Hola! 🌟 ¡Llegó el día! Hoy tienes tu cita en *${rest}* (*${dt}*). Recuerda llegar puntual y disfrutar el momento. Cualquier novedad me cuentas por aquí. ❤️`
  }

  const copyToClipboard = (text, type, id, item = null, titleLabel = '') => {
    navigator.clipboard.writeText(text)
    setCopiedId(`${id}-${type}`)
    setSuccessBanner(`¡Mensaje de ${type.toUpperCase()} copiado al portapapeles!`)
    if (item) {
      setWaModalTarget({
        title: titleLabel || `Plantilla WhatsApp — ${type}`,
        text,
        match: item
      })
    }
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
          setSuccessBanner('¡Cita reprogramada! Se ha generado una fila de reintento y actualizado el calendario.')
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

  const handleDispatchYesterdayFeedback = async () => {
    if (!window.confirm("¿Deseas despachar los correos de feedback para las citas realizadas de ayer en Modo de Prueba Seguro a agente.sti.col@gmail.com?")) {
      return
    }
    setDispatchingFeedback(true)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/calendar/feedback/dispatch-automated?simulation_mode=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await res.json()
      if (res.ok) {
        setSuccessBanner(data.message || `Despacho completado: ${data.dispatched_count || 0} citas notificadas en modo seguro.`)
        fetchCalendar()
      } else {
        alert(`Error al despachar: ${data.detail || 'Ocurrió un error'}`)
      }
    } catch (err) {
      alert("Error de conexión al despachar feedback.")
    } finally {
      setDispatchingFeedback(false)
    }
  }

  const handleSendSingleFeedbackTest = async (item) => {
    const calId = item.calendar_id || item.id
    if (!calId) return
    if (!window.confirm(`¿Enviar correo de feedback de prueba para la cita entre ${item.person_a} y ${item.person_b} a agente.sti.col@gmail.com?`)) {
      return
    }
    setSingleSendingId(calId)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/calendar/${calId}/send-feedback-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          simulation_mode: true,
          target_override_email: 'agente.sti.col@gmail.com'
        })
      })
      const data = await res.json()
      if (res.ok) {
        setSuccessBanner(data.message || `Correo de prueba enviado para la cita #${calId}.`)
        fetchCalendar()
      } else {
        alert(`Error: ${data.detail || 'No se pudo enviar el correo de prueba'}`)
      }
    } catch (err) {
      alert("Error de conexión al enviar correo de prueba.")
    } finally {
      setSingleSendingId(null)
    }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1650, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <CalendarIcon size={28} style={{ color: 'var(--color-primary)' }} />
            Citas Aceptadas (Agendamiento & Mensajería)
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Pestaña operativa sincronizada con la hoja canónica <strong>Citas Aceptadas</strong>. Control cronológico de citas confirmadas, plantillas WhatsApp (Confirmación, Día Antes, Hoy) y gestión de reprogramaciones con selector de restaurantes.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={handleDispatchYesterdayFeedback}
            disabled={dispatchingFeedback}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 700,
              color: '#60A5FA',
              cursor: dispatchingFeedback ? 'not-allowed' : 'pointer'
            }}
            title="Despachar feedback automático matutino de citas de ayer en Modo Seguro Piloto (agente.sti.col@gmail.com)"
          >
            <Mail size={15} className={dispatchingFeedback ? 'animate-spin' : ''} />
            {dispatchingFeedback ? 'Despachando...' : '⚡ Despachar Feedbacks Ayer (Piloto)'}
          </button>

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
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Citas Aceptadas</div>
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

      {/* Barra de Acceso Rápido por Fecha */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
        flexWrap: 'wrap'
      }}>
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          ⚡ Vistas Rápidas:
        </span>
        {[
          { id: 'today', label: '📅 Citas de Hoy', activeBg: '#10B981', color: '#fff' },
          { id: 'yesterday', label: '⏮️ Citas de Ayer', activeBg: '#3B82F6', color: '#fff' },
          { id: 'tomorrow', label: '⏭️ Citas de Mañana', activeBg: '#8B5CF6', color: '#fff' },
          { id: 'this_week', label: '🗓️ Esta Semana', activeBg: '#F59E0B', color: '#fff' },
          { id: 'all', label: '🌐 Todas las Citas', activeBg: '#B8324F', color: '#fff' },
        ].map(btn => {
          const isActive = quickDateFilter === btn.id
          return (
            <button
              key={btn.id}
              onClick={() => handleQuickDate(btn.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 20,
                border: isActive ? `1.5px solid ${btn.activeBg}` : '1px solid var(--border-color)',
                background: isActive ? btn.activeBg : 'var(--bg-card)',
                color: isActive ? btn.color : 'var(--text-secondary)',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.25)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {btn.label}
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 10,
        padding: '14px 18px',
        marginBottom: 20,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Ciudad:</span>
          <select
            value={selectedCity}
            onChange={e => setSelectedCity(e.target.value)}
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
            onChange={e => {
              setDateFrom(e.target.value)
              setQuickDateFilter('custom')
            }}
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
            onChange={e => {
              setDateTo(e.target.value)
              setQuickDateFilter('custom')
            }}
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
          <div className="empty-state" style={{ padding: 40 }}>Cargando citas aceptadas...</div>
        ) : calendarDates.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <CalendarIcon size={36} style={{ color: 'var(--color-primary)', margin: '0 auto 12px', display: 'block' }} />
            No hay citas confirmadas en el rango seleccionado.
          </div>
        ) : (
          <div className="table-container" style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1050 }}>
              <thead>
                <tr style={{ background: 'rgba(150,21,0,0.06)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 10px', fontSize: 11, textAlign: 'left', fontWeight: 700, width: 45 }}>#</th>
                  <th style={{ padding: '12px 10px', fontSize: 11, textAlign: 'left', fontWeight: 700, width: 130 }}>Fecha Cita</th>
                  <th style={{ padding: '12px 10px', fontSize: 11, textAlign: 'left', fontWeight: 700, width: 150 }}>Persona A (Cliente)</th>
                  <th style={{ padding: '12px 10px', fontSize: 11, textAlign: 'left', fontWeight: 700, width: 150 }}>Persona B (Candidato)</th>
                  <th style={{ padding: '12px 10px', fontSize: 11, textAlign: 'left', fontWeight: 700, width: 170 }}>Lugar / Restaurante</th>
                  <th style={{ padding: '12px 10px', fontSize: 11, textAlign: 'left', fontWeight: 700, width: 85 }}>Ciudad</th>
                  <th style={{ padding: '12px 10px', fontSize: 11, textAlign: 'center', fontWeight: 700, width: 95 }}>Reserva</th>
                  <th style={{ padding: '12px 10px', fontSize: 11, textAlign: 'center', fontWeight: 700, width: 190 }}>Mensajería WhatsApp</th>
                  <th style={{ padding: '12px 10px', fontSize: 11, textAlign: 'center', fontWeight: 700, width: 95 }}>Reprogramar</th>
                  <th style={{ padding: '12px 10px', fontSize: 11, textAlign: 'center', fontWeight: 700, width: 115 }}>Seguimiento &amp; Feedback</th>
                </tr>
              </thead>
              <tbody>
                {calendarDates.map(c => (
                  <tr key={c.calendar_id || c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{c.calendar_id || c.id}</td>
                    <td style={{ padding: '10px 10px', fontWeight: 700, color: 'var(--color-primary)', maxWidth: 130 }}>
                      <button
                        onClick={() => {
                          setRescheduleModalItem({ ...c, _isDirectAssign: true })
                        }}
                        title={`Clic para cambiar o asignar fecha y hora: ${c.scheduled_date || c.date_time || 'Por definir'}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: (c.scheduled_date || c.date_time) && (c.scheduled_date || c.date_time) !== 'Por definir' ? 'var(--color-primary)' : '#D97706',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: 12,
                          textAlign: 'left',
                          padding: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          maxWidth: 120,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        📅 {c.scheduled_date || c.date_time || 'Por definir'}
                      </button>
                    </td>
                    <td style={{ padding: '10px 10px', fontWeight: 700, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <CrmPersonLink name={c.person_a} crmId={c.person_a_crm_id} />
                    </td>
                    <td style={{ padding: '10px 10px', fontWeight: 700, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <CrmPersonLink name={c.person_b} crmId={c.person_b_crm_id} />
                    </td>
                    <td style={{ padding: '10px 10px', fontSize: 13, maxWidth: 170 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span 
                          title={c.venue && !c.venue.toLowerCase().includes('por definir') ? c.venue : 'Restaurante por definir'}
                          style={{ 
                            color: c.venue && !c.venue.toLowerCase().includes('por definir') ? 'var(--text-primary)' : 'var(--text-muted)',
                            maxWidth: 110,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'inline-block'
                          }}
                        >
                          📍 {c.venue && !c.venue.toLowerCase().includes('por definir') ? c.venue : 'Por definir'}
                        </span>
                        <button
                          onClick={() => {
                            setRescheduleModalItem({ ...c, _isDirectAssign: true })
                          }}
                          style={{
                            background: 'rgba(184, 50, 79, 0.12)',
                            color: '#B8324F',
                            border: '1px solid rgba(184, 50, 79, 0.3)',
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}
                          title="Abrir filtros para escoger restaurante y horario"
                        >
                          {c.venue && !c.venue.toLowerCase().includes('por definir') ? 'Cambiar' : 'Asignar'}
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '10px 10px', fontSize: 13 }}>
                      {c.city || 'Bogotá'}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleUpdateDate(c.calendar_id || c.id, { reservation_confirmed: !c.reservation_confirmed })}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: 11,
                          background: c.reservation_confirmed ? '#B4A7D6' : '#EFEFEF',
                          color: c.reservation_confirmed ? '#3C1F5C' : '#666666'
                        }}
                      >
                        {c.reservation_confirmed ? '📌 Reservada' : 'Marcar reserva'}
                      </button>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          onClick={() => copyToClipboard(
                            buildCanonicalWhatsAppMessage(c, 'confirmacion'),
                            'confirmación',
                            c.calendar_id || c.id,
                            c,
                            '📩 Confirmación de Cita'
                          )}
                          style={{
                            background: copiedId === `${c.calendar_id || c.id}-confirmación` ? '#10B981' : 'var(--bg-base)',
                            color: copiedId === `${c.calendar_id || c.id}-confirmación` ? '#fff' : 'var(--text-primary)',
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
                          title="Copiar y abrir plantilla de confirmación"
                        >
                          📩 Confirmar
                        </button>
                        <button
                          onClick={() => copyToClipboard(
                            buildCanonicalWhatsAppMessage(c, 'dia_antes'),
                            'día antes',
                            c.calendar_id || c.id,
                            c,
                            '⏰ Recordatorio Día Antes'
                          )}
                          style={{
                            background: copiedId === `${c.calendar_id || c.id}-día antes` ? '#10B981' : 'var(--bg-base)',
                            color: copiedId === `${c.calendar_id || c.id}-día antes` ? '#fff' : 'var(--text-primary)',
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
                          title="Copiar y abrir recordatorio del día antes"
                        >
                          ⏰ Día Antes
                        </button>
                        <button
                          onClick={() => copyToClipboard(
                            buildCanonicalWhatsAppMessage(c, 'hoy'),
                            'hoy',
                            c.calendar_id || c.id,
                            c,
                            '🚀 Recordatorio Hoy (Día de la Cita)'
                          )}
                          style={{
                            background: copiedId === `${c.calendar_id || c.id}-hoy` ? '#10B981' : 'var(--bg-base)',
                            color: copiedId === `${c.calendar_id || c.id}-hoy` ? '#fff' : 'var(--text-primary)',
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
                          title="Copiar y abrir recordatorio de hoy"
                        >
                          🚀 Hoy
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <button
                        onClick={() => setRescheduleModalItem({ ...c, _isDirectAssign: false })}
                        style={{
                          background: 'rgba(217,119,6,0.15)',
                          color: '#D97706',
                          border: '1px solid rgba(217,119,6,0.3)',
                          borderRadius: 6,
                          padding: '5px 10px',
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
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          {c.feedback && c.feedback.includes('NO-SHOW') ? (
                            <button
                              onClick={() => setNoShowModalItem(c)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.2)',
                                color: '#EF4444',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                borderRadius: 6,
                                padding: '4px 8px',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              title={c.feedback}
                            >
                              🚨 No-Show
                            </button>
                          ) : (
                            <button
                              onClick={() => setNoShowModalItem(c)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.12)',
                                color: '#EF4444',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: 6,
                                padding: '4px 8px',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              title="Registrar inasistencia o plantón"
                            >
                              <AlertTriangle size={12} /> No-Show
                            </button>
                          )}

                          {c.had_date && c.feedback && !c.feedback.includes('NO-SHOW') ? (
                            <button
                              onClick={() => setFeedbackModalItem(c)}
                              style={{
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#10B981',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                borderRadius: 6,
                                padding: '4px 8px',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              title={c.feedback}
                            >
                              ⭐ Evaluada
                            </button>
                          ) : (
                            <button
                              onClick={() => setFeedbackModalItem(c)}
                              style={{
                                background: 'rgba(168, 85, 247, 0.15)',
                                color: '#C084FC',
                                border: '1px solid rgba(168, 85, 247, 0.35)',
                                borderRadius: 6,
                                padding: '4px 8px',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              title="Cargar calificación y retroalimentación post-cita"
                            >
                              ⭐ Feedback
                            </button>
                          )}
                        </div>

                        {/* Indicador y disparador de correo de prueba */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {c.feedback_email_sent_at ? (
                            <span
                              title={`Enviado el ${new Date(c.feedback_email_sent_at).toLocaleString()} a ${c.feedback_email_target || 'agente.sti.col@gmail.com'}`}
                              style={{
                                background: 'rgba(59, 130, 246, 0.15)',
                                color: '#60A5FA',
                                border: '1px solid rgba(59, 130, 246, 0.35)',
                                borderRadius: 4,
                                padding: '2px 6px',
                                fontSize: 10,
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3
                              }}
                            >
                              <Mail size={10} /> Correo Enviado (Test)
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSendSingleFeedbackTest(c)}
                              disabled={singleSendingId === (c.calendar_id || c.id)}
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 4,
                                padding: '2px 6px',
                                fontSize: 10,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3
                              }}
                              title="Disparar correo de evaluación piloto a agente.sti.col@gmail.com"
                            >
                              <Send size={10} className={singleSendingId === (c.calendar_id || c.id) ? 'animate-spin' : ''} />
                              {singleSendingId === (c.calendar_id || c.id) ? 'Enviando...' : 'Test Correo'}
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rescheduleModalItem && (
        <RestaurantFilterModal
          match={rescheduleModalItem}
          initialDate={rescheduleModalItem.scheduled_date || rescheduleModalItem.date_time}
          initialVenue={rescheduleModalItem.venue && !rescheduleModalItem.venue.toLowerCase().includes('por definir') ? rescheduleModalItem.venue : ''}
          onClose={() => setRescheduleModalItem(null)}
          onConfirm={(newDateTime, newVenue) => {
            const isDirect = rescheduleModalItem._isDirectAssign
            const targetId = rescheduleModalItem.calendar_id || rescheduleModalItem.id
            return handleUpdateDate(targetId, {
              reschedule: !isDirect,
              date_time: newDateTime,
              scheduled_date: newDateTime,
              new_scheduled_date: newDateTime,
              venue: newVenue,
              reschedule_reason: isDirect ? 'Asignación de restaurante y fecha' : 'Reprogramación de cita'
            })
          }}
        />
      )}

      {noShowModalItem && (
        <NoShowModal
          item={noShowModalItem}
          onClose={() => setNoShowModalItem(null)}
          onSuccess={(msg) => {
            setSuccessBanner(msg)
            setTimeout(() => setSuccessBanner(''), 4000)
            fetchCalendar()
          }}
        />
      )}

      {feedbackModalItem && (
        <FeedbackModal
          item={feedbackModalItem}
          onClose={() => setFeedbackModalItem(null)}
          onSuccess={(msg) => {
            setSuccessBanner(msg)
            setTimeout(() => setSuccessBanner(''), 4000)
            fetchCalendar()
          }}
        />
      )}

      {waModalTarget && (
        <div
          className="modal-overlay"
          onClick={() => setWaModalTarget(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: 16
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 16,
              width: '100%',
              maxWidth: 560,
              padding: 24,
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {waModalTarget.title}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#10B981', fontWeight: 600 }}>
                  ✅ Mensaje copiado al portapapeles. Puedes editarlo o enviarlo directo por WhatsApp:
                </p>
              </div>
              <button
                onClick={() => setWaModalTarget(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <textarea
              rows={5}
              value={waModalTarget.text || ''}
              onChange={e => setWaModalTarget(prev => ({ ...prev, text: e.target.value }))}
              style={{
                width: '100%',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: 12,
                color: 'var(--text-primary)',
                fontSize: 13,
                lineHeight: 1.5,
                marginBottom: 14
              }}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {waModalTarget.match?.person_a && (
                  <button
                    onClick={() => {
                      const rawPhone = (waModalTarget.match.person_a_phone || '').replace(/\D/g, '')
                      const cleanPhone = rawPhone ? (rawPhone.startsWith('57') ? rawPhone : `57${rawPhone}`) : ''
                      const url = cleanPhone
                        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waModalTarget.text)}`
                        : `https://wa.me/?text=${encodeURIComponent(waModalTarget.text)}`
                      window.open(url, '_blank')
                    }}
                    style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10B981',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    📱 WhatsApp a {waModalTarget.match.person_a}
                  </button>
                )}
                {waModalTarget.match?.person_b && (
                  <button
                    onClick={() => {
                      const rawPhone = (waModalTarget.match.person_b_phone || '').replace(/\D/g, '')
                      const cleanPhone = rawPhone ? (rawPhone.startsWith('57') ? rawPhone : `57${rawPhone}`) : ''
                      const url = cleanPhone
                        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waModalTarget.text)}`
                        : `https://wa.me/?text=${encodeURIComponent(waModalTarget.text)}`
                      window.open(url, '_blank')
                    }}
                    style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10B981',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    📱 WhatsApp a {waModalTarget.match.person_b}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(waModalTarget.text || '')
                    setSuccessBanner('¡Mensaje copiado nuevamente al portapapeles!')
                    setTimeout(() => setSuccessBanner(''), 2500)
                  }}
                  style={{
                    background: 'var(--color-primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  <Copy size={13} /> Copiar Texto
                </button>
                <button
                  onClick={() => setWaModalTarget(null)}
                  style={{
                    background: 'var(--bg-base)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
