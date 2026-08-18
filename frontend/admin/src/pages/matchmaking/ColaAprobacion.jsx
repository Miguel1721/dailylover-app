import React, { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, CheckCircle, RefreshCw, Filter, User, MapPin, Sparkles } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

const PLAN_COLORS = {
  'Básico 40k': { bg: '#F3F3F3', color: '#434343' },
  'Estándar 65k (1 cita)': { bg: '#D9EAD3', color: '#274E13' },
  'Estándar 65k (2 citas)': { bg: '#B6D7A8', color: '#274E13' },
  'Estándar Plus 98k': { bg: '#A2C4C9', color: '#134F5C' },
  'Premium 150k': { bg: '#C9DAF8', color: '#1155CC' },
  'VIP 195k': { bg: '#FFE599', color: '#7F6000' },
}

const PSYCHOLOGISTS = [
  'Todas', 'JENN', 'ANA', 'SILVI', 'STEFFY', 'SOFI', 'MAPE D', 'ALEJA', 'MANU 1', 'MANU 2', 'PIA'
]

export default function ColaAprobacion() {
  const { token } = useAuth()
  const [selectedPsyc, setSelectedPsyc] = useState('Todas')
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
    let url = `${API}/api/v1/matchmaking/approval-queue`
    if (selectedPsyc && selectedPsyc !== 'Todas') {
      url += `?psychologist=${encodeURIComponent(selectedPsyc)}`
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
  }, [selectedPsyc, token])

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

      {/* Filter Tabs by Psychologist */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
        {psycList.map(p => {
          const isActive = selectedPsyc === p
          return (
            <button
              key={p}
              onClick={() => setSelectedPsyc(p)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                border: isActive ? '1px solid #B8324F' : '1px solid var(--border-color)',
                background: isActive ? '#B8324F' : 'var(--bg-card)',
                color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {p === 'Todas' ? 'Todas las Psicólogas' : p}
            </button>
          )
        })}
      </div>

      {/* Main Queue Table */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        overflowX: 'auto'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 14px', width: 110 }}>Psicóloga</th>
              <th style={{ padding: '12px 14px', minWidth: 160 }}>Persona A (Cliente)</th>
              <th style={{ padding: '12px 14px', minWidth: 160 }}>Persona B (Candidato)</th>
              <th style={{ padding: '12px 12px', width: 100 }}>Ciudad</th>
              <th style={{ padding: '12px 12px', width: 140 }}>Plan</th>
              <th style={{ padding: '12px 12px', width: 120 }}>Marcado HECHO</th>
              <th style={{ padding: '12px 14px', minWidth: 180 }}>Observaciones</th>
              <th style={{ padding: '12px 14px', width: 140, textAlign: 'center' }}>Acción</th>
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
                    <span style={{ fontSize: 13 }}>No hay matches pendientes de aprobación para esta psicóloga.</span>
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
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.person_a}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#134F5C' }}>
                      {item.person_b || '—'}
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
