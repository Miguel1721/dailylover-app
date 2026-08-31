import React, { useState, useEffect, useCallback } from 'react'
import { Headphones, Search, RefreshCw, CheckCircle, Clock, MapPin, User, AlertTriangle, PhoneCall, ExternalLink, Filter, X, Calendar as CalendarIcon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import CrmPersonLink from '../../components/CrmPersonLink'

const API = 'https://prueba-daily.agentesia.cloud'

const PSYCHOLOGIST_LIST = [
  'Todas', 'JENN', 'ANA', 'SILVI', 'STEFFY', 'SOFI', 'MAPE D', 'ALEJA', 'MANU', 'PIA', 'ISA'
]

const CITIES = [
  'Todas', 'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga',
  'Pereira', 'Cartagena', 'Manizales', 'Santa Marta', 'Miami', 'Madrid'
]

const RESTAURANTS_LIST = [
  'Mora Pastelería (Zona G)',
  'Primi Restaurante (Zona T)',
  'Cantina y Punto (Zona G)',
  'Criterión (Zona G)',
  'El Bandido Bistro (Zona G)',
  'Harry Sasson (Zona G)',
  'Osaka Cocina Nikkei (Zona G)',
  'Café San Alberto (Usaquén)',
  'Abasto (Usaquén)',
  'Storia D’Amore (Zona T / Usaquén)',
  'Matiz Restaurante (Chicó)',
  'Otro lugar por definir'
]

function ScheduleModal({ match, onClose, onScheduled }) {
  const defaultDate = new Date()
  defaultDate.setDate(defaultDate.getDate() + 2)
  defaultDate.setHours(19, 30, 0, 0)
  const defaultDateStr = defaultDate.toISOString().slice(0, 16)

  const [dateVal, setDateVal] = useState(defaultDateStr)
  const [venueVal, setVenueVal] = useState(RESTAURANTS_LIST[0])
  const [customVenue, setCustomVenue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!dateVal) {
      alert('Por favor selecciona la fecha y hora en el calendario.')
      return
    }

    const effectiveVenue = venueVal === 'Otro lugar por definir' ? (customVenue || 'Por definir') : venueVal
    setSubmitting(true)

    try {
      const formattedDate = dateVal.replace('T', ' ')
      await onScheduled(match, formattedDate, effectiveVenue)
      onClose()
    } catch (err) {
      alert(err.message || 'Error al agendar cita')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }} onClick={onClose}>
      <div style={{
        background: '#1A1214', border: '1px solid var(--border-color)', borderRadius: 16,
        padding: 28, maxWidth: 500, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarIcon size={20} style={{ color: 'var(--color-primary)' }} />
            Agendar Fecha Real de Cita
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ background: 'rgba(150,21,0,0.08)', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pareja Confirmada</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
            {match.person_a} <span style={{ color: 'var(--color-primary)' }}>×</span> {match.person_b}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            📍 Ciudad: {match.city || 'Bogotá'}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              📅 Fecha y Hora Real (Selector Interactivo de Calendario):
            </label>
            <input
              type="datetime-local"
              required
              value={dateVal}
              onChange={e => setDateVal(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                color: 'var(--text-primary)', fontSize: 14, outline: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              📍 Lugar / Restaurante Catálogo:
            </label>
            <select
              value={venueVal}
              onChange={e => setVenueVal(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                color: 'var(--text-primary)', fontSize: 13, outline: 'none'
              }}
            >
              {RESTAURANTS_LIST.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {venueVal === 'Otro lugar por definir' && (
            <div style={{ marginBottom: 20 }}>
              <input
                type="text"
                placeholder="Especifica el nombre del restaurante o lugar..."
                value={customVenue}
                onChange={e => setCustomVenue(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
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
              type="submit"
              disabled={submitting}
              style={{
                padding: '9px 20px', borderRadius: 8, border: 'none',
                background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer'
              }}
            >
              {submitting ? 'Guardando...' : 'Confirmar y Activar Cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AprobadosMaria() {
  const { token } = useAuth()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPsyc, setSelectedPsyc] = useState('Todas')
  const [selectedCity, setSelectedCity] = useState('Todas')
  const [searchTerm, setSearchTerm] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [notification, setNotification] = useState('')
  const [scheduleModalMatch, setScheduleModalMatch] = useState(null)

  const fetchPendingService = useCallback(() => {
    setLoading(true)
    let url = `${API}/api/v1/matchmaking/pending-service?`
    if (selectedPsyc && selectedPsyc !== 'Todas') url += `psychologist=${encodeURIComponent(selectedPsyc)}&`
    if (selectedCity && selectedCity !== 'Todas') url += `city=${encodeURIComponent(selectedCity)}&`
    if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setMatches(data.matches || [])
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching pending service matches:', err)
        setMatches([])
        setLoading(false)
      })
  }, [selectedPsyc, selectedCity, searchTerm, token])

  useEffect(() => {
    fetchPendingService()
  }, [fetchPendingService])

  const handleUpdateStatus = async (matchId, status) => {
    setUpdatingId(matchId)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${matchId}/service-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ service_status: status })
      })
      if (res.ok) {
        setNotification(`Estado de llamada actualizado a '${status}'`)
        setTimeout(() => setNotification(''), 3500)
        fetchPendingService()
      } else {
        alert('Error al actualizar estado')
      }
    } catch (e) {
      console.error(e)
      alert('Error de conexión')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleScheduledConfirm = async (match, dateVal, venueVal) => {
    const res = await fetch(`${API}/api/v1/matchmaking/matches/${match.id}/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        scheduled_date: dateVal,
        venue: venueVal
      })
    })
    if (res.ok) {
      setNotification(`✓ Cita agendada para ${dateVal} en ${venueVal}. Promovida a Citas Agendadas.`)
      setTimeout(() => setNotification(''), 5000)
      fetchPendingService()
    } else {
      const err = await res.json()
      throw new Error(err.detail || 'Error al agendar cita')
    }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1650, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Headphones size={28} style={{ color: 'var(--color-primary)' }} />
            Aprobados por María (Servicio al Cliente)
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Zona de espera de llamadas de Servicio al Cliente. Matches con visto bueno clínico listos para contactar, coordinar y confirmar fecha real con el calendario.
          </p>
        </div>

        <button
          onClick={fetchPendingService}
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
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>En Espera de Contacto</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-primary)', marginTop: 4 }}>{matches.length}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid #CFE2F3', borderRadius: 10, padding: '16px' }}>
          <div style={{ fontSize: 11, color: '#1155CC', fontWeight: 700, textTransform: 'uppercase' }}>Agendando</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1155CC', marginTop: 4 }}>
            {matches.filter(m => m.status === 'agendando').length}
          </div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid #FCE5CD', borderRadius: 10, padding: '16px' }}>
          <div style={{ fontSize: 11, color: '#783F04', fontWeight: 700, textTransform: 'uppercase' }}>Por Confirmar</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#D97706', marginTop: 4 }}>
            {matches.filter(m => m.status === 'por confirmar').length}
          </div>
        </div>
      </div>

      {/* Notification banner */}
      {notification && (
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
          {notification}
        </div>
      )}

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
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Psicóloga:</span>
          <select
            value={selectedPsyc}
            onChange={e => setSelectedPsyc(e.target.value)}
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
            {PSYCHOLOGIST_LIST.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

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

        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por cliente o candidato..."
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
          <div className="empty-state" style={{ padding: 40 }}>Cargando zona de espera...</div>
        ) : matches.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <CheckCircle size={36} style={{ color: '#10B981', margin: '0 auto 12px', display: 'block' }} />
            No hay llamadas pendientes de Servicio al Cliente.
          </div>
        ) : (
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(150,21,0,0.06)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>#</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Persona A (Cliente)</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Persona B (Candidato)</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Psicóloga</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Ciudad</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Plan</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Estado Seguimiento</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Observaciones</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'center', fontWeight: 700 }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {matches.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>{m.id}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                      <CrmPersonLink name={m.person_a} />
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                      <CrmPersonLink name={m.person_b} />
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12 }}>
                      <span className="badge badge-gray">{m.psychologist_name || '—'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>📍 {m.city || 'Bogotá'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-gray">{m.plan_tier || 'Estándar'}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <select
                        value={m.status || 'pendiente'}
                        disabled={updatingId === m.id}
                        onChange={e => handleUpdateStatus(m.id, e.target.value)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-base)',
                          color: 'var(--text-primary)',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="agendando">Agendando</option>
                        <option value="por confirmar">Por confirmar</option>
                        <option value="esperar">Esperar</option>
                        <option value="de viaje">De viaje</option>
                        <option value="problemas personales">Problemas personales</option>
                        <option value="no contestan">No contestan</option>
                        <option value="reprogramar">Reprogramar</option>
                        <option value="esperar que salgan con su date">Esperar salida con date</option>
                        <option value="TROUBLEMAKER">Troublemaker</option>
                      </select>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 260 }}>
                      {m.observations || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => setScheduleModalMatch(m)}
                        style={{
                          background: 'var(--color-primary)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 14px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <Clock size={13} /> Agendar Cita
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {scheduleModalMatch && (
        <ScheduleModal
          match={scheduleModalMatch}
          onClose={() => setScheduleModalMatch(null)}
          onScheduled={handleScheduledConfirm}
        />
      )}
    </div>
  )
}
