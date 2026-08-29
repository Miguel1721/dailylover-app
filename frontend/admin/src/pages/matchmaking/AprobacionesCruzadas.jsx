import React, { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, RefreshCw, Filter, User, MapPin, Sparkles, Tag, Search, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import CrmPersonLink from '../../components/CrmPersonLink'

const API = 'https://prueba-daily.agentesia.cloud'

const PSYCHOLOGIST_LIST = [
  'Todas', 'JENN', 'ANA', 'SILVI', 'STEFFY', 'SOFI', 'MAPE D', 'ALEJA', 'MANU', 'PIA', 'ISA'
]

export default function AprobacionesCruzadas() {
  const { token } = useAuth()
  const [crossMatches, setCrossMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPsyc, setSelectedPsyc] = useState('Todas')
  const [searchTerm, setSearchTerm] = useState('')
  const [notification, setNotification] = useState('')

  const fetchCrossApprovals = useCallback(() => {
    setLoading(true)
    fetch(`${API}/api/v1/matchmaking/cross-approvals`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        let list = data.cross_approvals || []
        if (selectedPsyc && selectedPsyc !== 'Todas') {
          list = list.filter(m => m.psychologist_a === selectedPsyc || m.psychologist_b === selectedPsyc)
        }
        if (searchTerm) {
          const s = searchTerm.toLowerCase()
          list = list.filter(m => (m.person_a || '').toLowerCase().includes(s) || (m.person_b || '').toLowerCase().includes(s))
        }
        setCrossMatches(list)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching cross approvals:', err)
        setCrossMatches([])
        setLoading(false)
      })
  }, [selectedPsyc, searchTerm, token])

  useEffect(() => {
    fetchCrossApprovals()
  }, [fetchCrossApprovals])

  const handleApproveCross = async (match) => {
    const obsB = window.prompt(`Observaciones clínicas de validación para ${match.person_b} (opcional):`, "")
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${match.id}/approve-cross`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ observations_b: obsB || "" })
      })
      if (res.ok) {
        setNotification(`✓ Propuesta validada por Psicóloga B (${match.psychologist_b}). Pasa a cola de aprobación de María.`)
        setTimeout(() => setNotification(''), 4000)
        fetchCrossApprovals()
      } else {
        alert('Error al validar aprobación cruzada')
      }
    } catch(e) {
      console.error(e)
      alert('Error de conexión')
    }
  }

  const handleRejectCross = async (match) => {
    const reason = window.prompt(`Motivo de rechazo de propuesta para ${match.person_b} (se creará reintento para ${match.person_a} en ${match.psychologist_a}):`, "")
    if (reason === null) return
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${match.id}/reject-cross`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: reason || "No compatible" })
      })
      if (res.ok) {
        setNotification(`❌ Propuesta rechazada. Se creó automáticamente una nueva fila para ${match.person_a} en la cola de ${match.psychologist_a}.`)
        setTimeout(() => setNotification(''), 4000)
        fetchCrossApprovals()
      } else {
        alert('Error al rechazar propuesta')
      }
    } catch(e) {
      console.error(e)
      alert('Error de conexión')
    }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1650, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={28} style={{ color: 'var(--color-primary)' }} />
            Aprobaciones Cruzadas (Psicóloga A ↔ B)
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Matches inter-psicólogas que requieren visto bueno de ambas especialistas antes de presentarse en la cola de María.
          </p>
        </div>

        <button
          onClick={fetchCrossApprovals}
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
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Pendientes de Validación</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{crossMatches.length}</div>
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

        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por cliente A o candidato B..."
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
          <div className="empty-state" style={{ padding: 40 }}>Cargando aprobaciones cruzadas...</div>
        ) : crossMatches.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <ShieldCheck size={36} style={{ color: 'var(--color-primary)', margin: '0 auto 12px', display: 'block' }} />
            No hay matches cruzados pendientes de validación entre psicólogas.
          </div>
        ) : (
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(150,21,0,0.06)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>#</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Cliente A (Propone)</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Psicóloga A</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Candidato B (Recibe)</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Psicóloga B</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Ciudad</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Plan</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'left', fontWeight: 700 }}>Estado Validación</th>
                  <th style={{ padding: '12px 16px', fontSize: 11, textAlign: 'center', fontWeight: 700 }}>Acción Psicóloga B</th>
                </tr>
              </thead>
              <tbody>
                {crossMatches.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>{m.id}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-primary)' }}>
                      <CrmPersonLink name={m.person_a} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-wine">{m.psychologist_a}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2196F3' }}>
                      <CrmPersonLink name={m.person_b} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-blue">{m.psychologist_b}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>📍 {m.city || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-gray">{m.plan_tier || '—'}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-yellow">⏳ {m.status || 'PENDIENTE VALIDACIÓN'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          onClick={() => handleApproveCross(m)}
                          style={{
                            background: '#2e7d32',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            padding: '6px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <CheckCircle size={12} /> Aprobar
                        </button>
                        <button
                          onClick={() => handleRejectCross(m)}
                          style={{
                            background: '#c62828',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            padding: '6px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <XCircle size={12} /> Rechazar
                        </button>
                      </div>
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
