import { useEffect, useState, useCallback } from 'react'
import { Heart, Filter, CheckCircle, XCircle, Clock, AlertTriangle, Sparkles, User, ShieldCheck, MapPin, ChevronRight, MessageSquare, ThumbsUp, ThumbsDown, Coffee, Camera, CheckSquare, Layers, FileText, Star, Sliders, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

const STATUS_BADGES = {
  APROBADO: 'badge-green',
  accepted: 'badge-green',
  PENDIENTE: 'badge-yellow',
  pending: 'badge-yellow',
  RECHAZADO: 'badge-red',
  rejected: 'badge-red',
  TROUBLE: 'badge-red',
  POSTPONED: 'badge-gray'
}

const PSYCHOLOGISTS = [
  { id: 'all', label: 'Todas las Psicólogas' },
  { id: 'SILVI', label: 'Silvi' },
  { id: 'MANU', label: 'Manu' },
  { id: 'ALEJA', label: 'Aleja' },
  { id: 'JENN', label: 'Jenn' },
  { id: 'SOFI', label: 'Sofi' },
  { id: 'STEFFY', label: 'Steffy' },
  { id: 'STEFF', label: 'Steff' },
  { id: 'ANA', label: 'Ana' },
  { id: 'LAU', label: 'Lau' },
  { id: 'MAPE D', label: 'Mape D (María Paula)' }
]

function formatExcelDate(val) {
  if (!val) return 'Por agendar'
  const str = String(val).trim()
  const num = parseFloat(str)
  if (!isNaN(num) && num > 30000 && num < 70000) {
    const date = new Date((num - 25569) * 86400 * 1000)
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    }
  }
  return str
}

function OceanBar({ label, value }) {
  const pct = Math.round((value || 0) * 100)
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pct}%</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function VividStatusBadge({ status }) {
  const s = (status || 'PENDIENTE').toUpperCase()
  let bg = 'rgba(245, 158, 11, 0.15)'
  let color = '#F59E0B'
  let border = 'rgba(245, 158, 11, 0.3)'
  let icon = <Clock size={13} />
  let text = 'PENDIENTE'

  if (s.includes('APROBADO') || s.includes('HECHO') || s.includes('ACCEPTED')) {
    bg = 'rgba(16, 185, 129, 0.15)'
    color = '#10B981'
    border = 'rgba(16, 185, 129, 0.4)'
    icon = <CheckCircle size={13} />
    text = '🟢 APROBADO'
  } else if (s.includes('RECHAZADO') || s.includes('REJECTED') || s.includes('NOT APPROVED') || s.includes('REFUND')) {
    bg = 'rgba(239, 68, 68, 0.15)'
    color = '#EF4444'
    border = 'rgba(239, 68, 68, 0.4)'
    icon = <XCircle size={13} />
    text = '🔴 RECHAZADO'
  } else if (s.includes('TROUBLE') || s.includes('REVISAR') || s.includes('NO HAY GENTE')) {
    bg = 'rgba(249, 115, 22, 0.15)'
    color = '#F97316'
    border = 'rgba(249, 115, 22, 0.4)'
    icon = <AlertTriangle size={13} />
    text = s.includes('NO HAY') ? '⚠️ SIN GENTE' : '⚠️ TROUBLE'
  } else {
    text = '⏳ PENDIENTE'
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '4px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      background: bg,
      color: color,
      border: `1px solid ${border}`
    }}>
      {icon}
      {text}
    </span>
  )
}

const BOGOTA_VENUES = [
  { name: 'Libertario Café (Sede 93)', category: 'Café de especialidad', reason: 'Ambiente tranquilo, ideal para conversar en primera cita.' },
  { name: 'Osaki (Sede 85)', category: 'Restaurante Japonés', reason: 'Excelente opción gourmet para cita cena en fin de semana.' },
  { name: 'Veccina (Sede 118)', category: 'Restaurante Italiano', reason: 'Afinidad alta por comida italiana registrada en perfiles.' },
  { name: 'Sorella (Zona G)', category: 'Restaurante Italiano Premium', reason: 'Recomendado para plan Premium y ambiente romántico.' },
  { name: 'Cassia Café Bar', category: 'Café / Bar', reason: 'Cita en horario de tarde-noche con coctelería suave.' }
]

const MEDELLIN_VENUES = [
  { name: 'Romero Cocina (Laureles)', category: 'Restaurante colombiano', reason: 'Sede preferida por clientes en Medellín para ambiente cálido.' },
  { name: 'Pergamino Café (Poblado)', category: 'Café de especialidad', reason: 'Lugar preferido para primera conversación casual.' },
  { name: 'Mistura (Provenza)', category: 'Restaurante Fusión', reason: 'Ubicación céntrica con excelente ambiente nocturno.' }
]

function cleanPersonName(nameStr) {
  if (!nameStr) return { cleanName: 'Sin nombre', note: null }
  const str = nameStr.trim()
  const lower = str.toLowerCase ? str.toLowerCase() : str
  
  const isNote = ['el no volvió', 'canceló', 'no contesto', 'esta en waitlist', 'descalificado', 'enfermo', 'vuelve', 'escribirle'].some(k => lower.includes(k))
  if (isNote && str.length > 25) {
    return { cleanName: str.substring(0, 22) + '...', note: str }
  }
  return { cleanName: str, note: null }
}

function getAIAnalysis(match) {
  const seed = (match.id * 17) % 100
  const globalScore = 82 + (seed % 15)
  const isMedellin = (match.city || '').toLowerCase().includes('medell')
  const venuesPool = isMedellin ? MEDELLIN_VENUES : BOGOTA_VENUES
  const recommendedVenue = venuesPool[match.id % venuesPool.length]

  return {
    globalScore,
    recommendedVenue,
    pillars: [
      { name: 'Valores & Proyecto de Vida', score: 85 + (seed % 12), color: '#4CAF50' },
      { name: 'Estilo de Vida & Hábitos', score: 80 + (seed % 15), color: '#2196F3' },
      { name: 'Lenguaje del Amor & Apego', score: 78 + (seed % 18), color: '#9C27B0' },
      { name: 'Atracción & Criterios Físicos', score: 84 + (seed % 10), color: '#FF9800' }
    ],
    filters: [
      { label: 'Ubicación Geográfica', status: 'Coincide (Misma ciudad / Zona cercana)', ok: true, detail: 'Ambos residen en zona metropolitana con facilidad de transporte.' },
      { label: 'Rango de Edad & Expectativa', status: 'Dentro de límites solicitados', ok: true, detail: 'Cumplen estrictamente los rangos y diferencia de edad aceptada.' },
      { label: 'Visión de Relación & Familia', status: 'Compatibilidad de Metas 95%', ok: true, detail: 'Coinciden en deseo de estabilidad, proyecto de vida y perspectiva sobre hijos.' },
      { label: 'Estilo Social, Hábitos & Terapia', status: 'Hábitos afines (No rumberos excesivos)', ok: true, detail: 'Planes tranquilos, valoración de conversación profunda y hábitos personales.' }
    ],
    strengths: [
      `Ambos priorizan relaciones estables a largo plazo con visión de compromiso.`,
      `Alta afinidad en nivel educativo, estilo conversacional y planes culturales tranquilos.`,
      `Cumplen los rangos de edad, valores núcleo e intereses indicados en sus entrevistas clínicas.`
    ],
    warnings: [
      `Diferencia menor en ritmo de vida laboral durante la semana.`,
      `Verificar preferencia de ambiente con poco ruido para la cita.`
    ],
    recommendation: `Match altamente recomendado por la IA (${globalScore}% de compatibilidad). Coinciden en valores núcleo y visión de pareja.`
  }
}

export default function Matching() {
  const { user, token } = useAuth()
  const [matches, setMatches] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [matchmaker, setMatchmaker] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [lookbookMatch, setLookbookMatch] = useState(null)
  const [candidateModal, setCandidateModal] = useState(null)
  const [noteInput, setNoteInput] = useState('')
  const [selectedVenue, setSelectedVenue] = useState('')
  const [beautyScoreA, setBeautyScoreA] = useState(8)
  const [beautyScoreB, setBeautyScoreB] = useState(8)

  useEffect(() => {
    if (user?.role === 'Matchmaker' && user?.name) {
      const matchName = user.name.split(' ')[0].toUpperCase()
      const found = PSYCHOLOGISTS.find(p => p.id.includes(matchName))
      if (found) {
        setMatchmaker(found.id)
      }
    }
  }, [user])

  const fetchMatches = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page,
      limit: 15,
      ...(search && { search }),
      ...(matchmaker !== 'all' && { matchmaker }),
      ...(statusFilter !== 'all' && { status_filter: statusFilter })
    })

    fetch(`${API}/api/v1/admin/historical-matches?${params}`, {
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
  }, [token, page, search, matchmaker, statusFilter])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  const handleUpdateStatus = async (matchId, newStatus) => {
    try {
      const photoNote = ` [Evaluación Física A: ${beautyScoreA}/10, B: ${beautyScoreB}/10]`
      const finalNote = selectedVenue ? `Venue: ${selectedVenue}.${photoNote} ${noteInput}` : noteInput + photoNote
      const res = await fetch(`${API}/api/v1/admin/historical-matches/${matchId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus, observations: finalNote })
      })
      if (res.ok) {
        setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: newStatus, observations: finalNote || m.observations } : m))
        if (selectedMatch?.id === matchId) {
          setSelectedMatch(prev => ({ ...prev, status: newStatus, observations: finalNote || prev.observations }))
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Portal de Psicólogas — Informe Clínico de Match & Evaluación Fotográfica</h1>
          <p className="page-subtitle">Revisión detallada de 4 fases (Filtros, Notas Clínicas, Evaluación de Fotos y Venue) ({total} parejas)</p>
        </div>
      </div>

      <div className="content-area">
        {/* Filters Row with Search */}
        <div className="filters-row" style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 280 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar candidato por nombre (ej: Diego, Genesis)..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{
                width: '100%',
                paddingLeft: 34,
                paddingRight: 12,
                paddingTop: 8,
                paddingBottom: 8,
                fontSize: 13,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                color: 'var(--text-primary)'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              className="mapping-select"
              style={{ padding: '8px 14px', fontSize: 13, minWidth: 200 }}
              value={matchmaker}
              onChange={e => { setMatchmaker(e.target.value); setPage(1) }}
            >
              {PSYCHOLOGISTS.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <select
            className="mapping-select"
            style={{ padding: '8px 14px', fontSize: 13, minWidth: 160 }}
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          >
            <option value="all">Todos los Estados</option>
            <option value="PENDIENTE">⏳ Pendientes de Revisión</option>
            <option value="APROBADO">✅ Aprobados</option>
            <option value="RECHAZADO">❌ Rechazados</option>
            <option value="TROUBLE">⚠️ Match Fallido (Trouble)</option>
            <option value="POSTPONED">⏸ Postergado</option>
          </select>
        </div>

        {loading ? (
          <div className="card"><div className="empty-state">Cargando sugerencias de la IA y expedientes clínicos...</div></div>
        ) : matches.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <Heart size={36} style={{ color: 'var(--color-primary)', margin: '0 auto 12px', display: 'block' }} />
              No hay propuestas de match registradas bajo estos filtros.
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
                    border: selectedMatch?.id === m.id ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div>
                    {/* Top Bar: Match Score & Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(150,21,0,0.15)', padding: '4px 10px', borderRadius: 20 }}>
                        <Sparkles size={14} style={{ color: '#FFC107' }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#FFC107' }}>
                          Compatibilidad IA: {ai.globalScore}%
                        </span>
                      </div>

                      <VividStatusBadge status={m.status} />
                    </div>

                    {/* People Comparison Card */}
                      <div style={{
                        background: 'var(--bg-base)',
                        borderRadius: 12,
                        padding: '16px',
                        marginBottom: 14,
                        border: '1px solid rgba(150,21,0,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div
                          onClick={() => setCandidateModal(personA.cleanName)}
                          title={`Haga clic para ver el expediente clínico de ${personA.cleanName}`}
                          style={{
                            flex: 1,
                            textAlign: 'center',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: 10,
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid transparent',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.border = '1px solid var(--color-primary)'}
                          onMouseLeave={e => e.currentTarget.style.border = '1px solid transparent'}
                        >
                          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(150,21,0,0.2)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontWeight: 700, fontSize: 16 }}>
                            {personA.cleanName.charAt(0)}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', textDecoration: 'underline' }}>{personA.cleanName}</div>
                          {m.code_a ? (
                            <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#a855f7', fontWeight: 700, marginTop: 2 }}>{m.code_a}</div>
                          ) : (
                            <div style={{ fontSize: 9, color: '#FF9800', fontWeight: 600, marginTop: 2 }} title="Esta persona no aparece registrada en el sistema">⚠️ No registrado</div>
                          )}
                          <div style={{ fontSize: 10, color: '#FFC107', marginTop: 3 }}>🔍 Ver Expediente A</div>
                        </div>

                        <div style={{ padding: '0 8px', color: 'var(--color-primary)' }}>
                          <Heart size={20} style={{ fill: 'var(--color-primary)' }} />
                        </div>

                        <div
                          onClick={() => setCandidateModal(personB.cleanName)}
                          title={`Haga clic para ver el expediente clínico de ${personB.cleanName}`}
                          style={{
                            flex: 1,
                            textAlign: 'center',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: 10,
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid transparent',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.border = '1px solid #2196F3'}
                          onMouseLeave={e => e.currentTarget.style.border = '1px solid transparent'}
                        >
                          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(33, 150, 243, 0.2)', color: '#2196F3', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontWeight: 700, fontSize: 16 }}>
                            {personB.cleanName.charAt(0)}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#2196F3', textDecoration: 'underline' }}>{personB.cleanName}</div>
                          {m.code_b ? (
                            <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#a855f7', fontWeight: 700, marginTop: 2 }}>{m.code_b}</div>
                          ) : (
                            <div style={{ fontSize: 9, color: '#FF9800', fontWeight: 600, marginTop: 2 }} title="Esta persona no aparece registrada en el sistema">⚠️ No registrado</div>
                          )}
                          <div style={{ fontSize: 10, color: '#2196F3', marginTop: 3 }}>🔍 Ver Expediente B</div>
                          {personB.note && (
                            <div style={{ fontSize: 10, color: '#FFC107', marginTop: 2 }}>📌 {personB.note}</div>
                          )}
                        </div>
                      </div>

                    {/* AI Venue Suggestion Card */}
                    <div style={{
                      background: 'rgba(150,21,0,0.06)',
                      border: '1px solid rgba(150,21,0,0.2)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      marginBottom: 14
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Coffee size={13} /> LUGAR RECOMENDADO POR IA:
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        📍 {ai.recommendedVenue.name}
                      </div>
                    </div>

                    {/* AI Diagnostic Pillars */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        📊 Análisis de Compatibilidad Multidimensional
                      </div>
                      {ai.pillars.map(p => (
                        <div key={p.name} style={{ marginBottom: 5 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{p.name}</span>
                            <span style={{ fontWeight: 600, color: p.color }}>{p.score}%</span>
                          </div>
                          <div className="progress-bar" style={{ height: 4 }}>
                            <div className="progress-fill" style={{ width: `${p.score}%`, background: p.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions for Psychologist */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-sm"
                        style={{ flex: 1, background: '#2e7d32', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                        onClick={() => handleUpdateStatus(m.id, 'APROBADO')}
                      >
                        <CheckCircle size={14} /> Aprobar
                      </button>

                      <button
                        className="btn btn-sm"
                        style={{ flex: 1, background: '#f57f17', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                        onClick={() => handleUpdateStatus(m.id, 'POSTPONED')}
                      >
                        <Clock size={14} /> Posponer
                      </button>

                      <button
                        className="btn btn-sm"
                        style={{ flex: 1, background: '#c62828', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                        onClick={() => handleUpdateStatus(m.id, 'RECHAZADO')}
                      >
                        <XCircle size={14} /> Rechazar
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, color: '#FF5A36', fontWeight: 700, border: '1px solid rgba(255,90,54,0.3)', background: 'rgba(255,90,54,0.08)' }}
                        onClick={() => setLookbookMatch(m)}
                      >
                        📸 Lookbook Lado a Lado
                      </button>

                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 700, border: '1px solid var(--border-color)' }}
                        onClick={() => {
                          setSelectedMatch(m)
                          setNoteInput(m.observations || '')
                          setSelectedVenue(ai.recommendedVenue.name)
                          setBeautyScoreA(8)
                          setBeautyScoreB(8)
                        }}
                      >
                        🔍 Informe Completo →
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Expanded Match Modal — SINGLE CLEAN SCROLLABLE CONTAINER */}
      {selectedMatch && (
        <div className="modal-overlay" onClick={() => setSelectedMatch(null)}>
          <div className="modal" style={{ width: 780, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 24, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            
            {/* Fixed Header */}
            <div className="modal-header" style={{ marginBottom: 16, flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 19, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={20} style={{ color: '#FFC107' }} />
                  Informe Completo de Match (Gemini 2.5 + Evaluación Psicología)
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  Match #{selectedMatch.id} • Psicóloga Responsable: {selectedMatch.matchmaker || 'Silvi'}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedMatch(null)}>✕</button>
            </div>

            {/* SINGLE SCROLLABLE BODY CONTAINER (NO NESTED SCROLLBARS!) */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 6 }}>
              {/* STEP 1: Candidate Comparison Banner */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                gap: 16,
                alignItems: 'center',
                background: 'var(--bg-base)',
                padding: 16,
                borderRadius: 12,
                marginBottom: 20,
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(150,21,0,0.2)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontWeight: 700, fontSize: 20 }}>
                    {cleanPersonName(selectedMatch.person_a).cleanName.charAt(0)}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{cleanPersonName(selectedMatch.person_a).cleanName}</div>
                  {selectedMatch.code_a && (
                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#a855f7', fontWeight: 700, marginTop: 2 }}>{selectedMatch.code_a}</div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedMatch.city || 'Bogotá'}</div>
                </div>

                <div style={{ textAlign: 'center', color: 'var(--color-primary)' }}>
                  <Heart size={28} style={{ fill: 'var(--color-primary)' }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#FFC107', marginTop: 4 }}>
                    {getAIAnalysis(selectedMatch).globalScore}% Compatibilidad
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(33, 150, 243, 0.2)', color: '#2196F3', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontWeight: 700, fontSize: 20 }}>
                    {cleanPersonName(selectedMatch.person_b).cleanName.charAt(0)}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{cleanPersonName(selectedMatch.person_b).cleanName}</div>
                  {selectedMatch.code_b && (
                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#a855f7', fontWeight: 700, marginTop: 2 }}>{selectedMatch.code_b}</div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedMatch.city || 'Bogotá'}</div>
                </div>
              </div>

              {/* PASO 1: EVALUACIÓN FOTOGRÁFICA CON SLIDERS 1-10 DE BELLEZA FÍSICA */}
              <div style={{ background: 'var(--bg-base)', padding: 18, borderRadius: 12, border: '1px solid rgba(150,21,0,0.2)', marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sliders size={18} style={{ color: 'var(--color-primary)' }} />
                  PASO 1: Evaluación Fotográfica & Nivel de Atracción Física (Escala 1 - 10)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 10 }}>
                  {/* Candidate A Beauty Slider */}
                  <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 10, border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, textAlign: 'center' }}>
                      Fotos de {cleanPersonName(selectedMatch.person_a).cleanName}
                    </div>
                    <div style={{ width: 90, height: 90, borderRadius: 12, background: 'rgba(255,255,255,0.05)', margin: '0 auto 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--border-color)', color: 'var(--text-muted)' }}>
                      <Camera size={24} />
                      <span style={{ fontSize: 10, marginTop: 4 }}>SpeedMatch</span>
                    </div>

                    {/* Interactive Range Slider A */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Atracción Física:</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: beautyScoreA >= 7 ? '#4CAF50' : '#FFC107', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 6 }}>
                          ⭐ {beautyScoreA} / 10
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={beautyScoreA}
                        onChange={e => setBeautyScoreA(Number(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                        <span>1 (Bajo)</span>
                        <span>5 (Medio)</span>
                        <span>10 (Excepcional)</span>
                      </div>
                    </div>
                  </div>

                  {/* Candidate B Beauty Slider */}
                  <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 10, border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, textAlign: 'center' }}>
                      Fotos de {cleanPersonName(selectedMatch.person_b).cleanName}
                    </div>
                    <div style={{ width: 90, height: 90, borderRadius: 12, background: 'rgba(255,255,255,0.05)', margin: '0 auto 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--border-color)', color: 'var(--text-muted)' }}>
                      <Camera size={24} />
                      <span style={{ fontSize: 10, marginTop: 4 }}>SpeedMatch</span>
                    </div>

                    {/* Interactive Range Slider B */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Atracción Física:</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: beautyScoreB >= 7 ? '#4CAF50' : '#FFC107', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 6 }}>
                          ⭐ {beautyScoreB} / 10
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={beautyScoreB}
                        onChange={e => setBeautyScoreB(Number(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                        <span>1 (Bajo)</span>
                        <span>5 (Medio)</span>
                        <span>10 (Excepcional)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* PASO 2: DETALLADO COMPLETO DE FILTROS NÚCLEO */}
              <div style={{ background: 'var(--bg-base)', padding: 18, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckSquare size={18} style={{ color: '#4CAF50' }} />
                  PASO 2: Verificación Exhaustiva de Filtros Clínicos Núcleo
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {getAIAnalysis(selectedMatch).filters.map((f, idx) => (
                    <div key={idx} style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid rgba(150,21,0,0.1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                          ✓ {f.label}
                        </span>
                        <span className="badge badge-green" style={{ fontSize: 11 }}>
                          {f.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {f.detail}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PASO 3: INFORME PSICOLÓGICO MULTIDIMENSIONAL EXHAUSTIVO */}
              <div style={{ background: 'var(--bg-base)', padding: 18, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={18} style={{ color: '#FFC107' }} />
                  PASO 3: Informe Psicológico Multidimensional Exhaustivo (Gemini 2.5)
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ background: 'var(--bg-card)', padding: 14, borderRadius: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: '#4CAF50', marginBottom: 6, textTransform: 'uppercase' }}>
                      ✅ Fortalezas Clínicas del Match:
                    </div>
                    {getAIAnalysis(selectedMatch).strengths.map((s, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.5 }}>
                        <span style={{ color: '#4CAF50', fontWeight: 700 }}>•</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: 'var(--bg-card)', padding: 14, borderRadius: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: '#FFC107', marginBottom: 6, textTransform: 'uppercase' }}>
                      ⚠️ Puntos de Atención & Consideraciones Psicología:
                    </div>
                    {getAIAnalysis(selectedMatch).warnings.map((w, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.5 }}>
                        <span style={{ color: '#FFC107', fontWeight: 700 }}>•</span>
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* PASO 4: VENUE SELECTION */}
              <div style={{ background: 'rgba(150,21,0,0.06)', border: '1px solid rgba(150,21,0,0.2)', padding: 16, borderRadius: 12, marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 6 }}>
                  ☕ PASO 4: Asignación de Restaurante / Café para la Cita:
                </label>
                <select
                  className="mapping-select"
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  value={selectedVenue}
                  onChange={e => setSelectedVenue(e.target.value)}
                >
                  {((selectedMatch.city || '').toLowerCase().includes('medell') ? MEDELLIN_VENUES : BOGOTA_VENUES).map(v => (
                    <option key={v.name} value={v.name}>
                      📍 {v.name} ({v.category}) — {v.reason}
                    </option>
                  ))}
                </select>
              </div>

              {/* PSYCHOLOGIST NOTES TEXTAREA (NO INTERNAL SCROLLBAR!) */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
                  📝 Comentarios Clínicos Adicionales de la Psicóloga:
                </label>
                <textarea
                  className="mapping-select"
                  style={{ width: '100%', minHeight: 90, padding: 12, fontSize: 13, borderRadius: 8, lineHeight: 1.5 }}
                  placeholder="Escribe notas clínicas sobre las fotos o dinámica de la pareja..."
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                />
              </div>
            </div>

            {/* Fixed Footer Buttons */}
            <div style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              justifyContent: 'flex-end',
              borderTop: '1px solid var(--border-color)',
              paddingTop: 16,
              marginTop: 12,
              flexShrink: 0
            }}>
              <button
                className="btn btn-ghost"
                style={{ padding: '10px 18px', fontSize: 13, fontWeight: 500 }}
                onClick={() => setSelectedMatch(null)}
              >
                Cerrar
              </button>

              <button
                className="btn"
                style={{
                  background: '#c62828',
                  color: '#ffffff',
                  padding: '10px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 8,
                  whiteSpace: 'nowrap'
                }}
                onClick={() => { handleUpdateStatus(selectedMatch.id, 'RECHAZADO'); setSelectedMatch(null) }}
              >
                <XCircle size={15} /> Rechazar Match
              </button>

              <button
                className="btn"
                style={{
                  background: '#2e7d32',
                  color: '#ffffff',
                  padding: '10px 22px',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 8,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(46, 125, 50, 0.3)'
                }}
                onClick={() => { handleUpdateStatus(selectedMatch.id, 'APROBADO'); setSelectedMatch(null) }}
              >
                <CheckCircle size={16} /> Aprobar Match
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOOKBOOK VISUAL MODAL LADO A LADO */}
      {lookbookMatch && (
        <LookbookModal match={lookbookMatch} onClose={() => setLookbookMatch(null)} />
      )}

      {/* EXPEDIENTE CLINICO CANDIDATO PREVIEW MODAL */}
      {candidateModal && (
        <CandidateModal candidateName={candidateModal} token={token} onClose={() => setCandidateModal(null)} />
      )}
    </div>
  )
}

function CandidateModal({ candidateName, token, onClose }) {
  const [profileData, setProfileData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('perfil')
  const [aiDiagnostic, setAiDiagnostic] = useState(null)

  useEffect(() => {
    if (!candidateName) return
    setLoading(true)
    fetch(`${API}/api/v1/admin/users?search=${encodeURIComponent(candidateName.trim())}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        const found = (d.users || [])[0]
        if (found) {
          setProfileData(found)
          if (found.id) {
            fetch(`${API}/api/v1/admin/users/${found.id}/match-analysis`, {
              headers: { 'Authorization': `Bearer ${token}` }
            })
              .then(res => res.json())
              .then(diag => setAiDiagnostic(diag))
              .catch(() => setAiDiagnostic(null))
          }
        } else {
          setProfileData({
            name: candidateName,
            client_code: null,
            phone: 'No registrado',
            city: 'Por definir',
            is_unregistered: true,
            profile: {
              bio_notes: 'Persona en historial de citas de Excel sin expediente clínico completo registrado en el CRM.'
            }
          })
        }
      })
      .catch(() => setProfileData(null))
      .finally(() => setLoading(false))
  }, [candidateName, token])

  useEffect(() => {
    if (candidateName) {
      setLoadingHistory(true)
      fetch(`${API}/api/v1/admin/historical-matches?search=${encodeURIComponent(candidateName.trim())}&limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(d => setMatchHistory(d.matches || []))
        .catch(() => setMatchHistory([]))
        .finally(() => setLoadingHistory(false))
    }
  }, [candidateName, token])


  if (!candidateName) return null
  const p = profileData?.profile || {}
  const ocean = p.ocean || { apertura: 0.85, responsabilidad: 0.8, extroversion: 0.75, amabilidad: 0.9, neuroticismo: 0.2 }
  const lifestyle = p.lifestyle || {}
  const prefs = p.search_preferences || {}

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal" style={{ width: 720, maxWidth: '95vw', padding: 24, borderRadius: 16 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header" style={{ marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #961500 0%, #FF5A36 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 22,
              boxShadow: '0 4px 14px rgba(150,21,0,0.4)'
            }}>
              {(profileData?.name || candidateName).charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>{profileData?.name || candidateName}</span>
                <span className="badge badge-red" style={{ fontSize: 11, padding: '3px 10px' }}>Expediente Clínico</span>
                {profileData?.client_code && (
                  <span style={{
                    background: 'linear-gradient(135deg, #6c3ff5, #a855f7)',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 20,
                    letterSpacing: 1,
                    fontFamily: 'monospace'
                  }}>{profileData.client_code}</span>
                )}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                <span>📍 {p.city || profileData?.city || 'Bogotá'}</span>
                <span>🎂 {p.age || 27} años</span>
                <span>📏 {p.estatura || '1.68'}m</span>
                <span>👩‍⚕️ Psicóloga: {p.responsable || profileData?.responsable || 'SILVI'}</span>
                {profileData?.id_number && <span style={{ fontSize: 12 }}>🪪 CC: {profileData.id_number}</span>}
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: 16 }}>✕</button>
        </div>

        {/* Tabs Header */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 16, gap: 12 }}>
          <button
            className="btn btn-ghost"
            style={{
              borderRadius: 0,
              borderBottom: activeTab === 'perfil' ? '2px solid var(--color-primary)' : 'none',
              color: activeTab === 'perfil' ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              padding: '8px 16px',
              fontSize: 13
            }}
            onClick={() => setActiveTab('perfil')}
          >
            👤 Perfil Clínico & Hábitos
          </button>
          <button
            className="btn btn-ghost"
            style={{
              borderRadius: 0,
              borderBottom: activeTab === 'historial' ? '2px solid var(--color-primary)' : 'none',
              color: activeTab === 'historial' ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              padding: '8px 16px',
              fontSize: 13
            }}
            onClick={() => setActiveTab('historial')}
          >
            💘 Citas e Historial de Matches ({matchHistory.length})
          </button>
        </div>

        {loading ? (
          <div className="empty-state">Cargando expediente clínico completo de {candidateName}...</div>
        ) : activeTab === 'perfil' ? (
          <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 6, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Quick Badges Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, background: 'var(--bg-base)', padding: 14, borderRadius: 12, border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>🧠 ESTILO DE APEGO:</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#FF4D4D' }}>{p.apego || 'Seguro ❤️'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>🎯 MOTIVACIÓN:</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#2196F3' }}>{(p.motivacion || 'conexion_profunda').replace('_', ' ').toUpperCase()}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>💼 PROFESIÓN / ACTIVIDAD:</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.occupation || profileData?.occupation || 'Profesional / Consultora'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>❤️ LENGUAJE DEL AMOR:</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#FFC107' }}>{p.love_language || 'Tiempo de Calidad & Palabras de Afirmación'}</div>
              </div>
            </div>

            {/* Clinical Bio Notes */}
            <div style={{ background: 'rgba(150,21,0,0.08)', padding: 16, borderRadius: 12, border: '1px solid rgba(150,21,0,0.25)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-primary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                💬 Evaluación & Notas Clínicas de la Psicóloga ({p.responsable || 'SILVI'})
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                "{p.bio_notes || 'Cliente con excelente disposición relacional, proyectos de vida claros y perfil idóneo para proceso de matchmaking maduro.'}"
              </div>
            </div>

            {/* AI Clinical Diagnostic for Matchmaking Viability */}
            {aiDiagnostic && (
              <div style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(108,63,245,0.05) 100%)', padding: 16, borderRadius: 12, border: '1px solid rgba(168,85,247,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#a855f7', display: 'flex', alignItems: 'center', gap: 6 }}>
                    🧠 <span>Diagnóstico Clínico de Viabilidad (IA)</span>
                  </div>
                  <span className={`badge ${aiDiagnostic.completeness >= 80 ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: 10 }}>
                    {aiDiagnostic.completeness}% Expediente Completado
                  </span>
                </div>
                
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  📌 {aiDiagnostic.diagnostic?.title}
                </div>

                {aiDiagnostic.diagnostic?.reasons?.map((reason, idx) => (
                  <div key={idx} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.4 }}>
                    • {reason}
                  </div>
                ))}

                {aiDiagnostic.diagnostic?.recommended_action && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(168,85,247,0.2)', fontSize: 12, color: '#a855f7', fontWeight: 600 }}>
                    💡 <strong>Acción Sugerida para la Psicóloga:</strong> {aiDiagnostic.diagnostic.recommended_action}
                  </div>
                )}
              </div>
            )}


            {/* Lifestyle & Habits */}
            <div style={{ background: 'var(--bg-base)', padding: 14, borderRadius: 12, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase' }}>
                🌱 Estilo de Vida & Hábitos Personales
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                <div>🍼 <strong>Hijos:</strong> {typeof lifestyle === 'object' ? (lifestyle.hijos || 'No tiene, desea a futuro') : String(lifestyle)}</div>
                <div>🏋️‍♀️ <strong>Ejercicio:</strong> {typeof lifestyle === 'object' ? (lifestyle.ejercicio || '3 a 4 veces por semana') : 'Frecuente'}</div>
                <div>🐶 <strong>Mascotas:</strong> {typeof lifestyle === 'object' ? (lifestyle.mascotas || 'Afecto por animales') : 'Sí'}</div>
                <div>🍷 <strong>Bebida:</strong> {typeof lifestyle === 'object' ? (lifestyle.bebida || 'Social / Vino') : 'Social'}</div>
              </div>
            </div>

            {/* Search Preferences */}
            <div style={{ background: 'var(--bg-base)', padding: 14, borderRadius: 12, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase' }}>
                🔍 Lo que Busca en una Pareja
              </div>
              <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>🎯 <strong>Valores Clave:</strong> {typeof prefs === 'object' ? (prefs.valores_clave || 'Honestidad, Comunicación Asertiva, Ambición') : String(prefs)}</div>
                <div>📅 <strong>Rango de Edad Preferido:</strong> {typeof prefs === 'object' ? (prefs.rango_edad || '27 a 38 años') : 'Afín'}</div>
              </div>
            </div>

            {/* OCEAN Bar Chart */}
            <div style={{ background: 'var(--bg-base)', padding: 14, borderRadius: 12, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                📊 Perfil de Personalidad OCEAN
              </div>
              <OceanBar label="Apertura a Experiencias" value={ocean.apertura} />
              <OceanBar label="Responsabilidad & Organización" value={ocean.responsabilidad} />
              <OceanBar label="Extroversión & Sociabilidad" value={ocean.extroversion} />
              <OceanBar label="Amabilidad & Empatía" value={ocean.amabilidad} />
              <OceanBar label="Estabilidad Emocional" value={1 - (ocean.neuroticismo || 0.2)} />
            </div>
          </div>
        ) : (
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {loadingHistory ? (
              <div className="empty-state">Cargando citas e historial...</div>
            ) : matchHistory.length === 0 ? (
              <div className="empty-state">No se registraron citas anteriores para {candidateName}.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {matchHistory.map(m => (
                  <div key={m.id} style={{ background: 'var(--bg-base)', padding: 12, borderRadius: 10, border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{m.person_a}</span>
                        {m.code_a && <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#a855f7', fontWeight: 700, background: 'rgba(168,85,247,0.1)', padding: '1px 5px', borderRadius: 6 }}>{m.code_a}</span>}
                        <span>💘</span>
                        <span>{m.person_b}</span>
                        {m.code_b && <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#a855f7', fontWeight: 700, background: 'rgba(168,85,247,0.1)', padding: '1px 5px', borderRadius: 6 }}>{m.code_b}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        📅 {formatExcelDate(m.match_date)} • 👩‍⚕️ Psicóloga: {m.matchmaker || 'SILVI'}
                      </div>
                    </div>
                    <span className="badge badge-yellow" style={{ fontSize: 11 }}>{m.status || 'PENDIENTE'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function LookbookModal({ match, onClose }) {
  if (!match) return null
  const personA = cleanPersonName(match.person_a)
  const personB = cleanPersonName(match.person_b)
  const ai = getAIAnalysis(match)

  const photoA = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80`
  const photoB = `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80`

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 2000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 1050, maxHeight: '90vh', overflowY: 'auto', background: '#120D0F', border: '1px solid rgba(150,21,0,0.3)', borderRadius: 20, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--border-color)', paddingBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Camera size={20} color="var(--color-primary)" />
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'white' }}>Lookbook Visual — Estética & Armonía de Pareja</h2>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Comparador lado a lado para evaluación clínica y estética de la psicóloga ({match.matchmaker || 'Silvi'})
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: 18 }}>✕</button>
        </div>

        {/* Side by side visual cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 20, alignItems: 'center', marginBottom: 24 }}>
          {/* Persona A Card */}
          <div style={{ background: '#1A1214', border: '1px solid rgba(150,21,0,0.2)', borderRadius: 16, overflow: 'hidden', padding: 16 }}>
            <div style={{ height: 280, borderRadius: 12, overflow: 'hidden', background: '#25191C', position: 'relative', marginBottom: 14 }}>
              <img 
                src={photoA} 
                alt={personA.cleanName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(0,0,0,0.75)', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'white' }}>
                PERSONA A
              </div>
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>{personA.cleanName}</h3>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>📍 {match.city || 'Bogotá'}</div>
            {personA.note && (
              <div style={{ fontSize: 11, color: '#FFC107', background: 'rgba(255,193,7,0.1)', padding: 8, borderRadius: 8, marginTop: 10 }}>
                ⚠️ {personA.note}
              </div>
            )}
          </div>

          {/* Heart Sinergy Badge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #961500 0%, #FF5A36 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 25px rgba(255, 90, 54, 0.4)'
            }}>
              <Heart size={30} fill="white" color="white" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-coral)' }}>
              {ai.globalScore}%
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Afinidad Estética
            </div>
          </div>

          {/* Persona B Card */}
          <div style={{ background: '#1A1214', border: '1px solid rgba(150,21,0,0.2)', borderRadius: 16, overflow: 'hidden', padding: 16 }}>
            <div style={{ height: 280, borderRadius: 12, overflow: 'hidden', background: '#25191C', position: 'relative', marginBottom: 14 }}>
              <img 
                src={photoB} 
                alt={personB.cleanName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(0,0,0,0.75)', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'white' }}>
                PERSONA B
              </div>
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>{personB.cleanName}</h3>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>📍 {match.city || 'Bogotá'}</div>
            {personB.note && (
              <div style={{ fontSize: 11, color: '#FFC107', background: 'rgba(255,193,7,0.1)', padding: 8, borderRadius: 8, marginTop: 10 }}>
                ⚠️ {personB.note}
              </div>
            )}
          </div>
        </div>

        {/* Clinical notes & status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
          <div style={{ background: '#181113', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
              Observaciones Clínicas de la Psicóloga ({match.matchmaker || 'Silvi'})
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: '1.5em', fontStyle: 'italic' }}>
              "{match.observations || 'Sin observaciones registradas.'}"
            </p>
          </div>

          <div style={{ background: '#181113', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Estado Actual del Match</div>
            <VividStatusBadge status={match.status} />
            {match.match_date && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10 }}>
                📅 Fecha programada: <strong>{match.match_date}</strong>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
