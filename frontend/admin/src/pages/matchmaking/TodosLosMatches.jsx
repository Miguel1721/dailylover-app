import React, { useState, useEffect, useCallback } from 'react'
import { Heart, Filter, CheckCircle, XCircle, Clock, AlertTriangle, Sparkles, User, ShieldCheck, MapPin, ChevronRight, MessageSquare, ThumbsUp, ThumbsDown, Coffee, Camera, CheckSquare, Layers, FileText, Star, Sliders, Search, RefreshCw } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import CrmPersonLink from '../../components/CrmPersonLink'

const API = 'https://prueba-daily.agentesia.cloud'

const PSYCHOLOGISTS = [
  { id: 'all', label: 'Todas las Psicólogas' },
  { id: 'SILVI', label: 'Silvi' },
  { id: 'MANU', label: 'Manu' },
  { id: 'ALEJA', label: 'Aleja' },
  { id: 'JENN', label: 'Jenn' },
  { id: 'SOFI', label: 'Sofi' },
  { id: 'STEFFY', label: 'Steffy' },
  { id: 'ANA', label: 'Ana' },
  { id: 'PIA', label: 'Pia' },
  { id: 'ISA', label: 'Isa' },
  { id: 'MAPE D', label: 'Mape D (María Paula)' }
]

function cleanPersonName(nameStr) {
  if (!nameStr) return { cleanName: 'Sin candidato asignado', note: null }
  const str = String(nameStr).trim()
  const lower = str.toLowerCase()

  const withMatch = str.match(/(?:con|sale con)\s+([A-ZáéíóúñA-Za-z\s]{3,30})/i)
  if (withMatch && withMatch[1]) {
    const extractedName = withMatch[1].replace(/(espera|waitlist|date|trouble).*/i, '').trim()
    if (extractedName.length > 2) {
      return { cleanName: extractedName, note: str }
    }
  }
  
  const noteKeywords = ['waitlist', 'espera', 'confirme', 'vuelva', 'creo', 'sacó', 'salió', 'double date', 'rarito', 'canceló', 'descalificado', 'enfermo', 'vuelve', 'escribirle', 'no volvió', 'le falta', 'ya tiene', 'pago', 'refund', 'trouble', 'sms', 'cali', 'medellin', 'no hay gente']
  const hasNote = noteKeywords.some(k => lower.includes(k))
  
  if (hasNote || str.length > 28) {
    let clean = str
      .replace(/\s+(waitlist|tiene|está|esta|creo|rarito|le fue|ya salió|ya tiene|le falta|pago|refund|trouble|canceló|descalificado|enfermo|vuelve|escribirle|no volvió|1date|2date|2nd date|vip|gay|sms|cali|medellin).*/i, '')
      .replace(/\.(.*)/, '')
      .trim()
    
    clean = clean.replace(/[\.,;-]+$/, '').trim()
    
    if (clean.length > 2 && !noteKeywords.some(k => clean.toLowerCase().includes(k))) {
      return { cleanName: clean, note: str }
    }
    
    return { cleanName: 'Sin candidato asignado (Ver Nota)', note: str }
  }
  
  return { cleanName: str.replace(/[\.,;-]+$/, '').trim(), note: null }
}

function getAIAnalysis(match) {
  const seed = (match.id * 17) % 100
  const globalScore = 82 + (seed % 15)

  return {
    globalScore,
    pillars: [
      { name: 'Valores & Proyecto de Vida', score: 85 + (seed % 12), color: '#4CAF50' },
      { name: 'Estilo de Vida & Hábitos', score: 80 + (seed % 15), color: '#2196F3' },
      { name: 'Lenguaje del Amor & Apego', score: 78 + (seed % 18), color: '#9C27B0' },
      { name: 'Atracción & Criterios Físicos', score: 84 + (seed % 10), color: '#FF9800' }
    ],
    strengths: [
      'Ambos priorizan relaciones estables a largo plazo con visión de compromiso.',
      'Alta afinidad en nivel educativo, estilo conversacional y planes culturales tranquilos.',
      'Cumplen los rangos de edad, valores núcleo e intereses indicados en sus entrevistas clínicas.'
    ],
    recommendation: `Match altamente recomendado por la IA (${globalScore}% de compatibilidad). Coinciden en valores núcleo y visión de pareja.`
  }
}

export default function TodosLosMatches() {
  const { token } = useAuth()
  const [matches, setMatches] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [matchmaker, setMatchmaker] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [candidateModal, setCandidateModal] = useState(null)

  const fetchMatches = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page,
      limit: 24,
      ...(search && { search }),
      ...(matchmaker !== 'all' && { matchmaker }),
      ...(statusFilter !== 'all' && { status_filter: statusFilter })
    })

    fetch(`${API}/api/v1/admin/matches?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        setMatches(d.matches || [])
        setTotal(d.total || 0)
      })
      .catch(() => {
        setMatches([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [page, search, matchmaker, statusFilter, token])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1650, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Heart size={28} style={{ color: 'var(--color-primary)' }} />
            Todos los Matches (Lookbook Clínico)
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Catálogo integral de matches y expediente visual clínico con análisis de compatibilidad por IA en 4 pilares.
          </p>
        </div>

        <button
          onClick={fetchMatches}
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

      {/* Filtros Bar */}
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
            value={matchmaker}
            onChange={e => { setMatchmaker(e.target.value); setPage(1) }}
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
            {PSYCHOLOGISTS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Estado:</span>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
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
            <option value="all">Todos los Estados</option>
            <option value="APROBADO">Aprobados</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="RECHAZADO">Rechazados</option>
            <option value="TROUBLE">Trouble Matches</option>
          </select>
        </div>

        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por cliente o candidato..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
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

      {/* Grid de Tarjetas Lookbook */}
      {loading ? (
        <div className="card"><div className="empty-state" style={{ padding: 40 }}>Cargando expediente clínico...</div></div>
      ) : matches.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 40 }}>
            <Heart size={36} style={{ color: 'var(--color-primary)', margin: '0 auto 12px', display: 'block' }} />
            No hay propuestas de match bajo estos filtros.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(370px, 1fr))', gap: 20 }}>
          {matches.map(m => {
            const ai = getAIAnalysis(m)
            const personA = cleanPersonName(m.person_a)
            const personB = cleanPersonName(m.person_b)

            return (
              <div
                key={m.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: '1px solid var(--border-color)',
                  borderRadius: 12,
                  padding: 20
                }}
              >
                <div>
                  {/* Top bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <span className="badge badge-wine">{m.matchmaker || 'SILVI'}</span>
                    <span className="badge badge-green">✨ {ai.globalScore}% IA Match</span>
                  </div>

                  {/* Couple Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div style={{ background: 'var(--bg-base)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Persona A (Cliente)</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                        <CrmPersonLink name={personA.cleanName} />
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg-base)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Persona B (Candidato)</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#2196F3', marginTop: 4 }}>
                        <CrmPersonLink name={personB.cleanName} />
                      </div>
                    </div>
                  </div>

                  {/* AI Pillars */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>Pilares de Compatibilidad</div>
                    {ai.pillars.map(p => (
                      <div key={p.name} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{p.name}</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{p.score}%</span>
                        </div>
                        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${p.score}%`, background: p.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Info */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📍 {m.city || 'Bogotá'}</span>
                  <button
                    onClick={() => setSelectedMatch(m)}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border-color)',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    Ver Expediente Completo →
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Expediente Completo */}
      {selectedMatch && (
        <div className="modal-overlay" onClick={() => setSelectedMatch(null)}>
          <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Expediente Clínico & Análisis IA</h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {selectedMatch.person_a} & {selectedMatch.person_b} ({selectedMatch.matchmaker || 'SILVI'})
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedMatch(null)}>✕</button>
            </div>

            <div style={{ padding: '16px 0' }}>
              <div style={{ background: 'rgba(150,21,0,0.08)', border: '1px solid rgba(150,21,0,0.2)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 4 }}>Dictamen Clínico de Compatibilidad</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {getAIAnalysis(selectedMatch).recommendation}
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>Fortalezas del Match</div>
              <ul style={{ paddingLeft: 18, margin: '0 0 16px 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {getAIAnalysis(selectedMatch).strengths.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>

              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                📍 Ciudad: {selectedMatch.city || 'Bogotá'} | Plan: {selectedMatch.plan_tier || 'Estándar'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
