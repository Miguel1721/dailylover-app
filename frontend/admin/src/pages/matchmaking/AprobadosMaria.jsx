import React, { useState, useEffect, useCallback } from 'react'
import { Headphones, Search, RefreshCw, CheckCircle, Clock, MapPin, User, AlertTriangle, PhoneCall, ExternalLink, Filter } from 'lucide-react'
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

export default function AprobadosMaria() {
  const { token } = useAuth()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPsyc, setSelectedPsyc] = useState('Todas')
  const [selectedCity, setSelectedCity] = useState('Todas')
  const [searchTerm, setSearchTerm] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [notification, setNotification] = useState('')

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

  const handleSchedulePrompt = async (match) => {
    const defaultDate = new Date()
    defaultDate.setDate(defaultDate.getDate() + 3)
    const formattedDefault = defaultDate.toISOString().slice(0, 16)

    const dateVal = window.prompt(`Ingresa fecha y hora confirmada para ${match.person_a} y ${match.person_b} (YYYY-MM-DD HH:mm):`, formattedDefault.replace('T', ' '))
    if (!dateVal) return

    const venueVal = window.prompt('Ingresa el lugar / restaurante:', match.venue || 'Restaurante sugerido')
    if (!venueVal) return

    try {
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
        alert('✓ Cita agendada exitosamente. Se ha promovido a la zona superior y al calendario de Citas Agendadas.')
        fetchPendingService()
      } else {
        const err = await res.json()
        alert(err.detail || 'Error al agendar cita')
      }
    } catch (e) {
      console.error(e)
      alert('Error al conectar con el servidor')
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
            Zona de espera de llamadas de Servicio al Cliente. Matches con visto bueno clínico listos para contactar, coordinar y confirmar cita.
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
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Pendientes de Agendar</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{matches.length}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid #FFE599', borderRadius: 10, padding: '16px' }}>
          <div style={{ fontSize: 11, color: '#7F6000', fontWeight: 700, textTransform: 'uppercase' }}>Por Confirmar / Agendando</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#D97706', marginTop: 4 }}>
            {matches.filter(m => (m.status || '').toLowerCase().includes('agendando') || (m.status || '').toLowerCase().includes('confirmar')).length}
          </div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid #F9CB9C', borderRadius: 10, padding: '16px' }}>
          <div style={{ fontSize: 11, color: '#783F04', fontWeight: 700, textTransform: 'uppercase' }}>En Pausa / Reprogramar</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#D97706', marginTop: 4 }}>
            {matches.filter(m => (m.status || '').toLowerCase().includes('reprogramar') || (m.status || '').toLowerCase().includes('viaje')).length}
          </div>
        </div>
      </div>

      {/* Notification Banner */}
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

        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
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
          <div className="empty-state" style={{ padding: 40 }}>Cargando matches en espera de Servicio al Cliente...</div>
        ) : matches.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <Headphones size={36} style={{ color: 'var(--color-primary)', margin: '0 auto 12px', display: 'block' }} />
            No hay matches pendientes de llamada bajo los filtros seleccionados.
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
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Estado de Llamada</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Observaciones</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'center', fontWeight: 700 }}>Acciones</th>
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
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-wine">{m.psychologist || 'SILVI'}</span>
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
                        onClick={() => handleSchedulePrompt(m)}
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
    </div>
  )
}
