import React, { useState, useEffect, useCallback } from 'react'
import { 
  Calendar, Clock, MapPin, Search, RefreshCw, PhoneCall, ExternalLink, 
  CheckCircle, AlertTriangle, Filter, Sparkles, User, MessageSquare, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import CrmPersonLink from '../../components/CrmPersonLink'
import RestaurantFilterModal from '../../components/RestaurantFilterModal'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

const CITIES = [
  'Todas', 'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga',
  'Pereira', 'Cartagena', 'Manizales', 'Santa Marta', 'Miami', 'Madrid'
]

const STAGES = [
  { value: 'todos', label: 'Todos los Estados' },
  { value: 'pendiente', label: '🟡 Pendiente Contacto' },
  { value: 'agendando', label: '🔵 Agendando / En Gestión' },
  { value: 'por confirmar', label: '🟠 Por Confirmar Pareja' },
  { value: 'agendada', label: '🟢 Cita Agendada' },
  { value: 'reprogramar', label: '🔴 Reprogramar' }
]

export default function MatchesAtrasados() {
  const { token, user } = useAuth()

  // Filtros
  const [selectedCity, setSelectedCity] = useState('Todas')
  const [selectedStage, setSelectedStage] = useState('todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)

  // Datos
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [updatingId, setUpdatingId] = useState(null)
  const [scheduleModalMatch, setScheduleModalMatch] = useState(null)
  const [notification, setNotification] = useState('')

  const fetchMatches = useCallback(() => {
    setLoading(true)
    let url = `${API}/api/v1/matchmaking/matches-atrasados?page=${page}&page_size=20&`
    if (selectedCity && selectedCity !== 'Todas') url += `city=${encodeURIComponent(selectedCity)}&`
    if (selectedStage && selectedStage !== 'todos') url += `status=${encodeURIComponent(selectedStage)}&`
    if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setMatches(data.matches || [])
        setTotalItems(data.total_items || 0)
        setTotalPages(data.total_pages || 1)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error cargando matches atrasados:', err)
        setMatches([])
        setLoading(false)
      })
  }, [selectedCity, selectedStage, searchTerm, page, token])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  const handleUpdateServiceStatus = async (matchId, status) => {
    setUpdatingId(matchId)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${matchId}/service-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      })
      if (res.ok) {
        fetchMatches()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleSaveSchedule = async (scheduleData) => {
    if (!scheduleModalMatch) return
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${scheduleModalMatch.id}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(scheduleData)
      })
      if (res.ok) {
        setNotification('Cita agendada exitosamente para este match atrasado.')
        setScheduleModalMatch(null)
        fetchMatches()
        setTimeout(() => setNotification(''), 4000)
      } else {
        const err = await res.json()
        alert(err.detail || 'Error al guardar la cita.')
      }
    } catch (e) {
      alert('Error de red al guardar la cita.')
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto', minHeight: '85vh' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'rgba(150, 21, 0, 0.15)',
              border: '1px solid rgba(150, 21, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary-light)'
            }}>
              <Calendar size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                Matches Atrasados (Cola Agosto 27)
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 20,
                  background: 'rgba(150, 21, 0, 0.2)',
                  color: 'var(--color-primary-light)',
                  border: '1px solid rgba(150, 21, 0, 0.3)'
                }}>
                  Destino Separado
                </span>
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Matches aprobados del backlog de Agosto 27. Servicio al Cliente gestiona aquí el contacto y agendamiento a su propio ritmo sin interferir con la operación del día.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchMatches}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 8,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Actualizar</span>
        </button>
      </div>

      {notification && (
        <div style={{
          background: 'rgba(76, 175, 80, 0.15)',
          border: '1px solid #4CAF50',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 20,
          color: '#81C784',
          fontSize: 13,
          fontWeight: 600
        }}>
          {notification}
        </div>
      )}

      {/* Barra de Filtros */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14
      }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
            Buscar por Nombre o Nota
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Persona A, Persona B o ciudad..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                borderRadius: 8,
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none'
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
            Ciudad
          </label>
          <select
            value={selectedCity}
            onChange={e => { setSelectedCity(e.target.value); setPage(1); }}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--bg-base)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none'
            }}
          >
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
            Estado de Gestión (CS)
          </label>
          <select
            value={selectedStage}
            onChange={e => { setSelectedStage(e.target.value); setPage(1); }}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--bg-base)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none'
            }}
          >
            {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Lista de Matches */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block', color: 'var(--color-primary)' }} />
          Cargando matches atrasados...
        </div>
      ) : matches.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 14,
          padding: '60px 20px',
          textAlign: 'center'
        }}>
          <Sparkles size={36} style={{ color: 'var(--color-primary-light)', margin: '0 auto 12px', display: 'block' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
            No hay matches atrasados en este momento
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            A medida que María vaya aprobando candidatos en la <strong>Cola de Atrasados</strong>, aparecerán aquí para su gestión y salida a cita.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {matches.map(m => (
            <div
              key={m.id}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 14,
                padding: 20,
                boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14
              }}
            >
              {/* Header Match */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: 'rgba(150, 21, 0, 0.15)',
                    color: 'var(--color-primary-light)',
                    padding: '2px 8px',
                    borderRadius: 6
                  }}>
                    Match #{m.id} • Backlog
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    📍 {m.city} • Psicóloga: <strong>{m.psychologist_name}</strong>
                  </span>
                </div>

                {/* Estado Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Estado CS:</span>
                  <select
                    value={m.cs_stage || 'pendiente'}
                    disabled={updatingId === m.id}
                    onChange={e => handleUpdateServiceStatus(m.id, e.target.value)}
                    style={{
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 6,
                      padding: '4px 8px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="pendiente">🟡 Pendiente Contacto</option>
                    <option value="agendando">🔵 Agendando / En Gestión</option>
                    <option value="por confirmar">🟠 Por Confirmar Pareja</option>
                    <option value="agendada">🟢 Cita Agendada</option>
                    <option value="esperar">⏳ Esperar</option>
                    <option value="de viaje">✈️ De Viaje</option>
                    <option value="no contestan">📵 No Contestan</option>
                    <option value="reprogramar">🔴 Reprogramar</option>
                  </select>
                </div>
              </div>

              {/* Pareja: Persona A y Persona B */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {/* Persona A */}
                <div style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10,
                  padding: 14
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary-light)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Persona A (Cliente)
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    <CrmPersonLink name={m.person_a} crmId={m.person_a_crm_id} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PhoneCall size={12} />
                    <span>{m.phone_a || 'Sin teléfono'}</span>
                  </div>
                </div>

                {/* Persona B */}
                <div style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10,
                  padding: 14
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#2196F3', textTransform: 'uppercase', marginBottom: 4 }}>
                    Persona B (Candidato/a Propuesto/a)
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    <CrmPersonLink name={m.person_b} crmId={m.person_b_crm_id} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PhoneCall size={12} />
                    <span>{m.phone_b || 'Sin teléfono'}</span>
                  </div>
                </div>
              </div>

              {/* Info de Agendamiento si existe */}
              {m.scheduled_date && (
                <div style={{
                  background: 'rgba(76, 175, 80, 0.1)',
                  border: '1px solid rgba(76, 175, 80, 0.3)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  flexWrap: 'wrap',
                  fontSize: 12,
                  color: '#A5D6A7'
                }}>
                  <span>📅 Fecha: <strong>{new Date(m.scheduled_date).toLocaleDateString()}</strong></span>
                  <span>⏰ Hora: <strong>{m.scheduled_time || 'Por definir'}</strong></span>
                  <span>🍽️ Restaurante: <strong>{m.restaurant_name || 'Por definir'}</strong></span>
                </div>
              )}

              {/* Observaciones */}
              {m.observations && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 6 }}>
                  📝 <em>{m.observations}</em>
                </div>
              )}

              {/* Botón de Agendar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6 }}>
                <button
                  onClick={() => setScheduleModalMatch(m)}
                  style={{
                    background: 'var(--color-primary)',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 8px rgba(150,21,0,0.3)'
                  }}
                >
                  <Calendar size={14} />
                  <span>{m.scheduled_date ? 'Editar Cita' : 'Agendar Cita en Restaurante'}</span>
                </button>
              </div>
            </div>
          ))}

          {/* Paginación */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '6px 14px',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: page <= 1 ? 0.5 : 1
                }}
              >
                <ChevronLeft size={14} style={{ verticalAlign: 'middle' }} /> Anterior
              </button>

              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Página {page} de {totalPages} ({totalItems} matches)
              </span>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '6px 14px',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: page >= totalPages ? 0.5 : 1
                }}
              >
                Siguiente <ChevronRight size={14} style={{ verticalAlign: 'middle' }} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal de Agendamiento en Restaurante */}
      {scheduleModalMatch && (
        <RestaurantFilterModal
          isOpen={Boolean(scheduleModalMatch)}
          onClose={() => setScheduleModalMatch(null)}
          onSave={handleSaveSchedule}
          matchData={{
            ...scheduleModalMatch,
            id: scheduleModalMatch.id,
            person_a: scheduleModalMatch.person_a,
            person_b: scheduleModalMatch.person_b,
            city: scheduleModalMatch.city || 'Bogotá'
          }}
        />
      )}
    </div>
  )
}
