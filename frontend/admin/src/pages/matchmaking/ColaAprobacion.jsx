import React, { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, CheckCircle, RefreshCw, Filter, User, MapPin, Sparkles, Tag, Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import CrmPersonLink from '../../components/CrmPersonLink'

const API = 'https://prueba-daily.agentesia.cloud'

const CITIES = [
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga',
  'Pereira', 'Cartagena', 'Manizales', 'Santa Marta', 'Miami', 'Madrid'
]

const PLAN_TIERS_LIST = [
  'Estándar 65k (2 citas)',
  'Estándar 65k (1 cita)',
  'Estándar Plus 98k',
  'Premium 150k',
  'VIP 195k',
  'VIP 295k',
  'VIP Oro',
  'Básico 40k',
  'Eventos Presenciales'
]

const PLAN_COLORS = {
  'Básico 40k': { bg: '#F3F3F3', color: '#434343' },
  'Estándar 65k (1 cita)': { bg: '#D9EAD3', color: '#274E13' },
  'Estándar 65k (2 citas)': { bg: '#B6D7A8', color: '#274E13' },
  'Estándar Plus 98k': { bg: '#A2C4C9', color: '#134F5C' },
  'Premium 150k': { bg: '#C9DAF8', color: '#1155CC' },
  'VIP 195k': { bg: '#FFE599', color: '#7F6000' },
}

const PSYCHOLOGISTS = [
  'Todas', 'JENN', 'ANA', 'SILVI', 'STEFFY', 'SOFI', 'MAPE D', 'ALEJA', 'MANU', 'PIA', 'ISA'
]

export default function ColaAprobacion() {
  const { token } = useAuth()
  const [selectedPsyc, setSelectedPsyc] = useState('Todas')
  const [selectedCity, setSelectedCity] = useState('all')
  const [selectedPlan, setSelectedPlan] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [psycList, setPsycList] = useState(PSYCHOLOGISTS)
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(false)
  const [approvingId, setApprovingId] = useState(null)
  const [successBanner, setSuccessBanner] = useState('')

  useEffect(() => {
    fetch(`${API}/api/v1/matchmaking/psychologists`)
      .then(r => r.json())
      .then(d => {
        if (d && d.names && d.names.length > 0) {
          setPsycList(['Todas', ...d.names])
        }
      })
      .catch(e => console.error('Error fetching psychologists:', e))
  }, [])

  const fetchQueue = useCallback(() => {
    setLoading(true)
    let url = `${API}/api/v1/matchmaking/approval-queue?`
    if (selectedPsyc && selectedPsyc !== 'Todas') {
      url += `psychologist=${encodeURIComponent(selectedPsyc)}&`
    }
    if (selectedCity && selectedCity !== 'all') {
      url += `city=${encodeURIComponent(selectedCity)}&`
    }
    if (selectedPlan && selectedPlan !== 'all') {
      url += `plan_tier=${encodeURIComponent(selectedPlan)}&`
    }
    if (searchTerm) {
      url += `search=${encodeURIComponent(searchTerm)}&`
    }

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setQueue(data.queue || [])
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching approval queue:', err)
        setLoading(false)
      })
  }, [selectedPsyc, selectedCity, selectedPlan, searchTerm, token])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const handleApprove = async (matchId, personA, personB) => {
    setApprovingId(matchId)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${matchId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await res.json()
      if (res.ok) {
        setSuccessBanner(`¡Match aprobado! ${personA} × ${personB} transferido a Pendientes de confirmación.`)
        setTimeout(() => setSuccessBanner(''), 4000)
        setQueue(prev => prev.filter(m => m.id !== matchId))
      } else {
        alert(data.detail || 'Error al aprobar match')
      }
    } catch (e) {
      alert('Error de conexión al aprobar')
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={28} color="#B8324F" />
            Cola de Aprobación — María Paula
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Matches marcados como <strong>HECHO</strong> por las psicólogas esperando autorización. La aprobación bloquea la fila y la transfiere a Servicio al Cliente.
          </p>
        </div>

        <button
          onClick={fetchQueue}
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

      {/* Success Notification Banner */}
      {successBanner && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10B981',
          color: '#065F46',
          padding: '12px 16px',
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

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 10, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Pendientes de Revisión</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#B8324F', marginTop: 4 }}>{queue.length}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 10, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Acción Exclusiva</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 8 }}>1-Click Aprobar Match</div>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 10, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Destino Inmediato</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#10B981', marginTop: 8 }}>Servicio al Cliente (Pendientes)</div>
        </div>
      </div>

      {/* Filtros Bar */}
      <div style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        background: 'var(--bg-card)',
        padding: '12px 16px',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        marginBottom: 16,
        flexWrap: 'wrap'
      }}>
        {/* Filtro Psicóloga */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <User size={13} color="var(--text-secondary)" />
          <select
            value={selectedPsyc}
            onChange={e => setSelectedPsyc(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none'
            }}
          >
            <option value="Todas">Todas las Psicólogas</option>
            {psycList.filter(p => p !== 'Todas').map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Filtro Ciudad */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={13} color="var(--text-secondary)" />
          <select
            value={selectedCity}
            onChange={e => setSelectedCity(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none'
            }}
          >
            <option value="all">Todas las Ciudades</option>
            {CITIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Filtro Plan */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tag size={13} color="var(--text-secondary)" />
          <select
            value={selectedPlan}
            onChange={e => setSelectedPlan(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none'
            }}
          >
            <option value="all">Todos los Planes</option>
            {PLAN_TIERS_LIST.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Buscador */}
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por Persona A, Persona B, Ciudad u Observaciones..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 32px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <button
          onClick={fetchQueue}
          title="Refrescar"
          style={{
            background: 'none',
            border: '1px solid var(--border-color)',
            borderRadius: 6,
            padding: '6px 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-secondary)'
          }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Main Queue Table */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        overflowX: 'auto'
      }}>
        <table style={{ width: '100%', minWidth: 960, borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap' }}>
              <th style={{ padding: '12px 14px', width: 110, fontWeight: 600 }}>PSICÓLOGA</th>
              <th style={{ padding: '12px 14px', minWidth: 160, fontWeight: 600 }}>PERSONA A (CLIENTE)</th>
              <th style={{ padding: '12px 14px', minWidth: 160, fontWeight: 600 }}>PERSONA B (CANDIDATO)</th>
              <th style={{ padding: '12px 12px', width: 100, fontWeight: 600 }}>CIUDAD</th>
              <th style={{ padding: '12px 12px', width: 140, fontWeight: 600 }}>PLAN</th>
              <th style={{ padding: '12px 12px', width: 120, fontWeight: 600 }}>MARCADO HECHO</th>
              <th style={{ padding: '12px 14px', minWidth: 180, fontWeight: 600 }}>OBSERVACIONES</th>
              <th style={{ padding: '12px 14px', width: 140, textAlign: 'center', fontWeight: 600 }}>ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            {loading && queue.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Cargando cola de aprobación...
                </td>
              </tr>
            ) : queue.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <CheckCircle size={32} color="#10B981" />
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>¡Todo al día!</span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No hay matches pendientes de aprobación para los filtros seleccionados.</span>
                  </div>
                </td>
              </tr>
            ) : (
              queue.map((item) => {
                const planCfg = PLAN_COLORS[item.plan_tier] || { bg: '#F3F3F3', color: '#434343' }
                const isApproving = approvingId === item.id

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#B8324F' }}>
                      {item.psychologist_name}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <CrmPersonLink name={item.person_a} crmId={item.person_a_crm_id} />
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <CrmPersonLink name={item.person_b} crmId={item.person_b_crm_id} />
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      {item.city || '—'}
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: planCfg.bg,
                        color: planCfg.color
                      }}>
                        {item.plan_tier}
                      </span>
                    </td>
                    <td style={{ padding: '12px 12px', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {item.fecha_hecho}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {item.observations || <span style={{ color: 'var(--text-muted)' }}>Sin observaciones</span>}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleApprove(item.id, item.person_a, item.person_b)}
                        disabled={isApproving}
                        style={{
                          background: '#B8324F',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: 6,
                          padding: '7px 14px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: isApproving ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: '0 2px 6px rgba(184, 50, 79, 0.25)',
                          transition: 'opacity 0.15s'
                        }}
                      >
                        {isApproving ? 'Aprobando...' : '✓ Aprobar Match'}
                      </button>
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
