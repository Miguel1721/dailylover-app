import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Heart, Sparkles, CheckCircle2, AlertTriangle, ShieldCheck, UserCheck, ArrowRight, Check, X,
  ExternalLink, RefreshCw, FileText, User, Users, ChevronDown, ChevronUp, Bot, Send, Trash2,
  MessageSquare, LayoutGrid, List, CheckSquare, Square, Scale, Copy
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import CrmPersonLink from '../../components/CrmPersonLink'
import ClinicalNotesViewer from '../../components/ClinicalNotesViewer'
import resilientFetch from '../../utils/resilientFetch'
import useLocalDraft from '../../hooks/useLocalDraft'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

const PSYCHOLOGISTS = ['ANA', 'SILVI', 'JENN', 'STEFFY', 'SOFI', 'MAPE D', 'ALEJA', 'MANU', 'PIA', 'ISA']

export default function EntrevistaResultados({ clientId, clientName, onGoToTab, onAssignCandidate }) {
  const { token, user } = useAuth()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Detección reactiva de modo claro (Light Mode)
  const [isLight, setIsLight] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.body.classList.contains('light-mode') || localStorage.getItem('theme') === 'light'
    }
    return false
  })

  useEffect(() => {
    const updateTheme = () => {
      setIsLight(document.body.classList.contains('light-mode') || localStorage.getItem('theme') === 'light')
    }
    updateTheme()
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    window.addEventListener('storage', updateTheme)
    return () => {
      observer.disconnect()
      window.removeEventListener('storage', updateTheme)
    }
  }, [])

  // Detección de pantalla de escritorio para layout sticky
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true)
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Modo de visualización: 'detailed' (tarjetas) vs 'compact' (modo resumen 1 pantalla)
  const [viewDisplayMode, setViewDisplayMode] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('dl_resultados_view_mode') || 'detailed'
    }
    return 'detailed'
  })

  const toggleViewDisplayMode = (mode) => {
    setViewDisplayMode(mode)
    try {
      localStorage.setItem('dl_resultados_view_mode', mode)
    } catch (e) {}
  }

  // Comparador matricial de candidatas finalistas (A/B/C testing) y Copiloto Multi
  const [selectedForCompare, setSelectedForCompare] = useState([])
  const [showCompareModal, setShowCompareModal] = useState(false)
  const [showMultiChatModal, setShowMultiChatModal] = useState(false)

  const handleToggleCompare = (cand) => {
    setSelectedForCompare(prev => {
      const exists = prev.some(c => c.user_id === cand.user_id)
      if (exists) {
        return prev.filter(c => c.user_id !== cand.user_id)
      } else {
        if (prev.length >= 4) {
          alert('Puedes comparar un máximo de 4 candidatas simultáneamente.')
          return prev
        }
        return [...prev, cand]
      }
    })
  }

  const handleClearCompare = () => {
    setSelectedForCompare([])
    setShowCompareModal(false)
    setShowMultiChatModal(false)
  }


  // Modal de aprobación
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [psychologist, setPsychologist] = useState('ANA')
  const [approving, setApproving] = useState(false)
  const [approvedMatch, setApprovedMatch] = useState(null)

  // Auto-guardado de notas del modal con useLocalDraft
  const draftKey = `approval_notes_${clientId || clientName}_${selectedCandidate?.user_id || 'general'}`
  const [notes, setNotes, clearNotesDraft, hasDraft] = useLocalDraft(draftKey, '')

  // Modal de análisis clínico de match
  const [viewingAnalysis, setViewingAnalysis] = useState(null)
  const [showInsufficient, setShowInsufficient] = useState(true)

  const fetchResults = () => {
    if (!clientId && !clientName) return
    setLoading(true)
    setError(null)
    const target = clientId || clientName
    resilientFetch(`${API}/api/v1/matchmaking/interview-results/${encodeURIComponent(target)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => {
        if (!r.ok) throw new Error('No se pudieron obtener resultados de entrevista')
        return r.json()
      })
      .then(d => {
        setData(d)
        setLoading(false)
        if (d.client?.responsable) {
          const resp = d.client.responsable.toUpperCase().replace('MATCHES ', '').trim()
          if (PSYCHOLOGISTS.includes(resp)) setPsychologist(resp)
        }
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchResults()
  }, [clientId, clientName])

  const handleApprove = async () => {
    if (!data?.client || !selectedCandidate) return
    setApproving(true)
    try {
      const res = await resilientFetch(`${API}/api/v1/matchmaking/approve-interview-match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          person_a_id: data.client.user_id,
          person_b_id: selectedCandidate.user_id,
          psychologist_name: psychologist,
          notes: notes.trim() || undefined
        })
      })
      const resData = await res.json()
      if (!res.ok) throw new Error(resData.detail || 'Error al aprobar match')

      setApprovedMatch({
        ...resData,
        candidateName: selectedCandidate.name
      })
      clearNotesDraft()
      setSelectedCandidate(null)
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setApproving(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 14,
        padding: '60px 24px',
        textAlign: 'center'
      }}>
        <RefreshCw size={36} className="animate-spin" style={{ color: 'var(--color-primary)', margin: '0 auto 16px', display: 'block' }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
          Generando Análisis Clínico de Compatibilidad...
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
          Cruzando datos objetivos, estilo de vida y dealbreakers con la base de candidatos compatibles.
        </p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 14,
        padding: '40px 24px',
        textAlign: 'center'
      }}>
        <AlertTriangle size={36} style={{ color: '#FF6B35', margin: '0 auto 12px', display: 'block' }} />
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          No fue posible cargar los candidatos
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>{error || 'Cliente no encontrado'}</p>
        <button className="btn btn-primary btn-sm" onClick={fetchResults}>Reintentar</button>
      </div>
    )
  }

  const { client, suggested_matches = [] } = data

  const viableMatches = (data?.viable_matches || []).length > 0
    ? data.viable_matches
    : suggested_matches.filter(c => !c.insufficient_data && c.compatibility_pct != null && c.ai_veredicto !== 'SIN DATOS SUFICIENTES' && (c.campos_evaluados_pts || 0) >= 15)

  const insufficientMatches = (data?.insufficient_matches || []).length > 0
    ? data.insufficient_matches
    : suggested_matches.filter(c => c.insufficient_data || c.compatibility_pct == null || c.ai_veredicto === 'SIN DATOS SUFICIENTES' || (c.campos_evaluados_pts || 0) < 15)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Banner de éxito al aprobar */}
      {approvedMatch && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.15) 0%, rgba(46, 125, 50, 0.25) 100%)',
          border: '1px solid #4CAF50',
          borderRadius: 12,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckCircle2 size={24} color="#4CAF50" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#A5D6A7' }}>
                ¡Propuesta Enviada a Aprobación de María!
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Pareja: <b style={{ color: '#fff' }}>{approvedMatch.pair}</b> asignada a <b style={{ color: '#FFE599' }}>{approvedMatch.psychologist}</b>. Se encuentra en la cola de revisión de María para su visto bueno antes de pasar a MATCHES.
              </div>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/matchmaking/aprobados-maria')}
            style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            Ver en Aprobados por María <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* Grid Principal: Lado Izquierdo (Persona A - Sticky) vs Lado Derecho (Candidatos) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isDesktop ? 'clamp(320px, 31vw, 380px) 1fr' : '1fr',
        gap: 20,
        alignItems: 'start'
      }}>
        {/* COLUMNA IZQUIERDA: SÍNTESIS DEL ENTREVISTADO (STICKY EN ESCRITORIO) */}
        <div style={{
          background: isLight ? '#FFFFFF' : 'var(--bg-card)',
          border: isLight ? '1px solid #E2E8F0' : '1px solid var(--border-color)',
          borderRadius: 14,
          padding: 20,
          boxShadow: isLight ? '0 2px 12px rgba(0, 0, 0, 0.05)' : '0 4px 20px rgba(0, 0, 0, 0.25)',
          position: isDesktop ? 'sticky' : 'static',
          top: 16,
          maxHeight: isDesktop ? 'calc(100vh - 32px)' : 'none',
          overflowY: isDesktop ? 'auto' : 'visible',
          zIndex: 10
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: isLight ? '1px solid #E2E8F0' : '1px solid var(--border-color)',
            paddingBottom: 14,
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #961500, #c41a00)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 18
              }}>
                {client.name?.charAt(0) || 'C'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <a
                    href={client.crm_url || (client.crm_id ? `https://dailylover.smartmatchapp.com/#!/client/${client.crm_id}/` : `https://dailylover.smartmatchapp.com/#!/clients?search=${encodeURIComponent(client.name)}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Abrir perfil de ${client.name} en SmartMatchApp (CRM)`}
                    style={{
                      fontWeight: 800,
                      fontSize: 16,
                      color: isLight ? '#0F172A' : 'var(--text-primary)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'color 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-primary-light)'
                      e.currentTarget.style.textDecoration = 'underline'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = isLight ? '#0F172A' : 'var(--text-primary)'
                      e.currentTarget.style.textDecoration = 'none'
                    }}
                  >
                    {client.name}
                    <ExternalLink size={13} style={{ color: 'var(--color-primary-light)', opacity: 0.8, flexShrink: 0 }} />
                  </a>
                </div>
                <div style={{ fontSize: 11, color: isLight ? '#64748B' : 'var(--text-muted)' }}>
                  {client.client_code} • {client.city}
                </div>
              </div>
            </div>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 6,
              background: isLight ? '#FEE2E2' : 'rgba(150, 21, 0, 0.15)',
              color: isLight ? '#961500' : 'var(--color-primary-light)'
            }}>
              Persona A
            </span>
          </div>

          {/* Resumen del Plan y Balance de Citas de Persona A */}
          <div style={{
            background: isLight ? '#F8FAFC' : 'var(--bg-base)',
            border: isLight ? '1px solid #E2E8F0' : '1px solid var(--border-color)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: isLight ? '#64748B' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Plan & Citas Contratadas
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: isLight ? '#0F172A' : 'var(--text-primary)', marginTop: 2 }}>
                {client.plan_tier || 'Plan Estándar (2 citas)'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{
                fontSize: 12,
                fontWeight: 800,
                color: (client.dates_remaining ?? 1) > 0 ? (isLight ? '#065F46' : '#4CAF50') : (isLight ? '#92400E' : '#FFC107'),
                background: (client.dates_remaining ?? 1) > 0 ? (isLight ? '#ECFDF5' : 'rgba(76, 175, 80, 0.12)') : (isLight ? '#FFFBEB' : 'rgba(255, 193, 7, 0.12)'),
                padding: '4px 10px',
                borderRadius: 8,
                border: (client.dates_remaining ?? 1) > 0 ? (isLight ? '1px solid #A7F3D0' : '1px solid rgba(76, 175, 80, 0.3)') : (isLight ? '1px solid #FDE68A' : '1px solid rgba(255, 193, 7, 0.3)'),
                display: 'inline-block'
              }}>
                🎟️ {client.dates_used || 0} de {client.plan_total_dates || 2} citas
              </span>
              <div style={{ fontSize: 11, color: isLight ? '#64748B' : 'var(--text-muted)', marginTop: 2 }}>
                {(client.dates_remaining ?? 1) > 0 ? `${client.dates_remaining ?? 1} citas disponibles` : '⚠️ Plan cumplido'}
              </div>
            </div>
          </div>

          {/* Puntaje Social Group Destacado */}
          <div style={{
            background: isLight ? '#F8FAFC' : 'var(--bg-base)',
            border: isLight ? '1px solid #E2E8F0' : '1px solid var(--border-color)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Puntaje Social Group
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Nivel socioeconómico ampliado
              </div>
            </div>
            <span style={{
              fontSize: 18,
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: 8,
              border: client.social_group_score != null ? '1px solid rgba(76, 175, 80, 0.3)' : '1px solid var(--border-color)',
              color: client.social_group_score != null ? '#4CAF50' : 'var(--text-muted)',
              background: client.social_group_score != null ? 'rgba(76, 175, 80, 0.12)' : 'transparent'
            }}>
              {client.social_group_score != null ? `${client.social_group_score.toFixed(1)} / 10` : 'Pendiente (F2)'}
            </span>
          </div>

          {/* Métricas Clínicas Clave */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginBottom: 16
          }}>
            <div style={{ background: 'var(--bg-base)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Actividad Física</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                {client.physical_activity_level != null ? `🏃 ${client.physical_activity_level} / 10` : '🏃 Pendiente (F2)'}
              </div>
            </div>
            <div style={{ background: 'var(--bg-base)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Nivel Educativo</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                {client.education_level != null ? `🎓 ${client.education_level} / 10` : '🎓 Pendiente (F1)'}
              </div>
            </div>
            <div style={{ background: 'var(--bg-base)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Lenguaje Da</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: client.love_language_given && client.love_language_given !== 'No especificado' ? '#FFE599' : 'var(--text-muted)', marginTop: 2 }}>
                {client.love_language_given && client.love_language_given !== 'No especificado' ? client.love_language_given : 'Pendiente (F2)'}
              </div>
            </div>
            <div style={{ background: 'var(--bg-base)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Lenguaje Recibe</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: client.love_language_received && client.love_language_received !== 'No especificado' ? '#FFE599' : 'var(--text-muted)', marginTop: 2 }}>
                {client.love_language_received && client.love_language_received !== 'No especificado' ? client.love_language_received : 'Pendiente (F2)'}
              </div>
            </div>
          </div>

          {/* Dealbreakers no negociables */}
          {client.non_negotiables && client.non_negotiables.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>
                🚫 Dealbreakers No Negociables
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {client.non_negotiables.map((nb, i) => {
                  const label = typeof nb === 'object' ? (nb.texto || nb.text || JSON.stringify(nb)) : String(nb)
                  return (
                    <span key={i} style={{
                      fontSize: 11,
                      background: 'rgba(255, 107, 53, 0.12)',
                      border: '1px solid rgba(255, 107, 53, 0.3)',
                      color: '#ff8a80',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontWeight: 600
                    }}>
                      {label}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Síntesis Clínica en 3 Líneas */}
          <div style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            padding: 14,
            marginBottom: 16
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary-light)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={14} /> Síntesis Clínica de la Psicóloga
            </div>
            <div style={{ fontSize: 12, marginBottom: 8 }}>
              <b style={{ color: 'var(--text-primary)' }}>1. ¿Quién es realmente?</b>
              <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {client.synthesis_who_really_is || 'Profesional enfocado, con estilo de vida dinámico y visión de pareja estable.'}
              </p>
            </div>
            <div style={{ fontSize: 12, marginBottom: 8 }}>
              <b style={{ color: 'var(--text-primary)' }}>2. ¿Comportamiento en 1ra cita?</b>
              <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {client.synthesis_first_date_behavior || 'Puntual, conversador elocuente y empático.'}
              </p>
            </div>
            <div style={{ fontSize: 12 }}>
              <b style={{ color: 'var(--text-primary)' }}>3. ¿Perfil para mejor match?</b>
              <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {client.synthesis_best_match_type || 'Persona profesional, con nivel sociocultural afín y que valore tiempo de calidad.'}
              </p>
            </div>
          </div>

          {/* Botones para regresar a editar */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onGoToTab && onGoToTab('objetivos')}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 11,
                cursor: 'pointer'
              }}
            >
              ✏️ Editar Obj (F1)
            </button>
            <button
              onClick={() => onGoToTab && onGoToTab('percepcion')}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 11,
                cursor: 'pointer'
              }}
            >
              ✏️ Editar Clínico (F2)
            </button>
          </div>
        </div>

        {/* COLUMNA DERECHA: 3 A 4 CANDIDATOS SUGERIDOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isLight ? '#FFFFFF' : 'var(--bg-card)',
            padding: '14px 20px',
            borderRadius: 12,
            border: isLight ? '1px solid #E2E8F0' : '1px solid var(--border-color)',
            boxShadow: isLight ? '0 2px 10px rgba(0, 0, 0, 0.04)' : 'none'
          }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: isLight ? '#0F172A' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={20} color="#c41a00" />
                Candidatos Sugeridos para Match ({suggested_matches.length})
              </h2>
              <p style={{ fontSize: 12, color: isLight ? '#64748B' : 'var(--text-muted)', margin: '3px 0 0' }}>
                Top {suggested_matches.length} candidatas con mayor afinidad clínica y filtro bidireccional aprobadas para {client.name}.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Toggle de Modo de Visualización */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.06)',
                padding: 3,
                borderRadius: 8,
                border: isLight ? '1px solid #E2E8F0' : '1px solid var(--border-color)'
              }}>
                <button
                  onClick={() => toggleViewDisplayMode('detailed')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    background: viewDisplayMode === 'detailed' ? (isLight ? '#FFFFFF' : 'var(--color-primary, #961500)') : 'transparent',
                    color: viewDisplayMode === 'detailed' ? (isLight ? '#961500' : '#FFFFFF') : (isLight ? '#64748B' : 'var(--text-secondary)'),
                    boxShadow: viewDisplayMode === 'detailed' ? '0 1px 4px rgba(0,0,0,0.15)' : 'none'
                  }}
                  title="Ver tarjetas completas con desglose detallado"
                >
                  <LayoutGrid size={13} /> Tarjetas
                </button>
                <button
                  onClick={() => toggleViewDisplayMode('compact')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    background: viewDisplayMode === 'compact' ? (isLight ? '#FFFFFF' : 'var(--color-primary, #961500)') : 'transparent',
                    color: viewDisplayMode === 'compact' ? (isLight ? '#961500' : '#FFFFFF') : (isLight ? '#64748B' : 'var(--text-secondary)'),
                    boxShadow: viewDisplayMode === 'compact' ? '0 1px 4px rgba(0,0,0,0.15)' : 'none'
                  }}
                  title="Ver modo resumen compacto en 1 sola pantalla"
                >
                  <List size={13} /> Modo Resumen
                </button>
              </div>

              <button
                onClick={fetchResults}
                title="Recalcular sugerencias"
                style={{
                  background: isLight ? '#F8FAFC' : 'none',
                  border: isLight ? '1px solid #CBD5E1' : '1px solid var(--border-color)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  color: isLight ? '#334155' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12
                }}
              >
                <RefreshCw size={13} /> Recalcular
              </button>
            </div>
          </div>

          {(() => {
            const renderCandidateCard = (cand, idx, isInsufficient) => {
              const hasSg = cand.social_group_score != null && client.social_group_score != null
              const sgDiff = hasSg ? Math.abs(client.social_group_score - cand.social_group_score).toFixed(1) : null
              const isSelected = selectedForCompare.some(c => c.user_id === cand.user_id)

              return (
                <div
                  key={cand.user_id}
                  style={{
                    background: isLight
                      ? (isInsufficient ? '#FFFDF5' : '#FFFFFF')
                      : (isInsufficient ? 'rgba(245, 158, 11, 0.03)' : 'var(--bg-card)'),
                    border: isSelected
                      ? (isLight ? '2px solid #961500' : '2px solid var(--color-primary-light)')
                      : (isInsufficient
                          ? (isLight ? '1.5px dashed #F59E0B' : '1px dashed rgba(245, 158, 11, 0.4)')
                          : (isLight ? '1px solid #E2E8F0' : '1px solid var(--border-color)')),
                    borderRadius: 14,
                    padding: 20,
                    boxShadow: isSelected
                      ? (isLight ? '0 4px 18px rgba(150, 21, 0, 0.15)' : '0 4px 20px rgba(150, 21, 0, 0.35)')
                      : (isLight
                          ? (isInsufficient ? '0 2px 8px rgba(245, 158, 11, 0.08)' : '0 4px 16px rgba(0, 0, 0, 0.05)')
                          : (isInsufficient ? 'none' : '0 4px 20px rgba(0, 0, 0, 0.2)')),
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                    transition: 'border-color 0.2s',
                    position: 'relative',
                    marginBottom: 16
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.borderColor = isInsufficient ? '#F59E0B' : 'var(--color-primary)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = isInsufficient
                        ? (isLight ? '#F59E0B' : 'rgba(245, 158, 11, 0.4)')
                        : (isLight ? '#E2E8F0' : 'var(--border-color)')
                    }
                  }}
                >
                  {/* Fila Superior: Nombre, Score y Compatibilidad */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Botón Selección para Comparar */}
                      <button
                        onClick={() => handleToggleCompare(cand)}
                        style={{
                          background: isSelected ? (isLight ? '#FEE2E2' : 'rgba(150, 21, 0, 0.25)') : 'transparent',
                          border: isSelected ? '1px solid var(--color-primary, #961500)' : '1px solid var(--border-color)',
                          borderRadius: 6,
                          padding: '5px 9px',
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: isSelected ? (isLight ? '#961500' : 'var(--color-primary-light)') : (isLight ? '#64748B' : 'var(--text-muted)'),
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5
                        }}
                        title={isSelected ? 'Quitar de la matriz de comparación' : 'Seleccionar para comparar en matriz simultánea (máx. 3)'}
                      >
                        {isSelected ? <CheckSquare size={14} color="var(--color-primary, #961500)" /> : <Square size={14} />}
                        <span>{isSelected ? 'Seleccionada' : 'Comparar'}</span>
                      </button>

                      <div style={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        background: isInsufficient
                          ? 'linear-gradient(135deg, #78716c, #a8a29e)'
                          : 'linear-gradient(135deg, #1976d2, #0288d1)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 16
                      }}>
                        {cand.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <a
                            href={cand.crm_url || (cand.crm_id && cand.crm_id !== 'None' ? `https://dailylover.smartmatchapp.com/#!/client/${cand.crm_id}/` : `https://dailylover.smartmatchapp.com/#!/clients?search=${encodeURIComponent(cand.name)}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Abrir perfil de ${cand.name} en SmartMatchApp (CRM)`}
                            style={{
                              fontSize: 16,
                              fontWeight: 700,
                              color: isLight ? '#0F172A' : 'var(--text-primary)',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              transition: 'color 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#2196F3'
                              e.currentTarget.style.textDecoration = 'underline'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = isLight ? '#0F172A' : 'var(--text-primary)'
                              e.currentTarget.style.textDecoration = 'none'
                            }}
                          >
                            <span>{cand.name}</span>
                            <ExternalLink size={13} style={{ color: '#2196F3', opacity: 0.8, flexShrink: 0 }} />
                          </a>
                          <span style={{ fontSize: 12, color: isLight ? '#64748B' : 'var(--text-muted)' }}>
                            {cand.age ? `(${cand.age} años)` : '(Edad no registrada)'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: isLight ? '#475569' : 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span>📍 {cand.city}</span>
                          <span>•</span>
                          <span>💼 {cand.occupation && cand.occupation !== 'No especificado' ? cand.occupation : 'Ocupación no especificada'}</span>
                          <span>•</span>
                          <span>📋 {cand.plan_tier}</span>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 6,
                            background: (cand.dates_remaining ?? cand.saldo_citas ?? 1) > 0
                              ? (isLight ? '#ECFDF5' : 'rgba(76, 175, 80, 0.12)')
                              : (isLight ? '#FFFBEB' : 'rgba(255, 193, 7, 0.12)'),
                            color: (cand.dates_remaining ?? cand.saldo_citas ?? 1) > 0
                              ? (isLight ? '#065F46' : '#81C784')
                              : (isLight ? '#92400E' : '#FFE082'),
                            border: (cand.dates_remaining ?? cand.saldo_citas ?? 1) > 0
                              ? (isLight ? '1px solid #A7F3D0' : '1px solid rgba(76, 175, 80, 0.25)')
                              : (isLight ? '1px solid #FDE68A' : '1px solid rgba(255, 193, 7, 0.25)')
                          }}>
                            🎟️ {cand.dates_used || 0}/{cand.plan_total_dates || 2} citas ({cand.dates_remaining ?? cand.saldo_citas ?? 1} disp.)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {cand.opportunity_badge && (
                        <span style={{
                          background: isLight ? '#FFFBEB' : 'linear-gradient(135deg, rgba(255, 193, 7, 0.15), rgba(255, 152, 0, 0.25))',
                          border: isLight ? '1px solid #F59E0B' : '1px solid #FFC107',
                          color: isLight ? '#92400E' : '#FFE082',
                          fontWeight: 700,
                          fontSize: 12,
                          padding: '4px 10px',
                          borderRadius: 20,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5
                        }} title={cand.opportunity_reason}>
                          🌟 {cand.opportunity_badge}
                        </span>
                      )}
                      {isInsufficient ? (
                        <span style={{
                          background: isLight ? '#FEF3C7' : 'rgba(245, 158, 11, 0.15)',
                          border: isLight ? '1.5px solid #F59E0B' : '1px solid #F59E0B',
                          color: isLight ? '#92400E' : '#FBBF24',
                          fontWeight: 800,
                          fontSize: 13,
                          padding: '4px 12px',
                          borderRadius: 20,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5
                        }}>
                          ⚠️ Sin datos suficientes
                        </span>
                      ) : (
                        <>
                          {!cand.datos_completos && (
                            <span style={{
                              background: isLight ? '#FEF3C7' : 'rgba(245, 158, 11, 0.15)',
                              border: isLight ? '1px solid #FCD34D' : '1px solid rgba(245, 158, 11, 0.4)',
                              color: isLight ? '#92400E' : '#FBBF24',
                              fontWeight: 700,
                              fontSize: 12,
                              padding: '4px 10px',
                              borderRadius: 20,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5
                            }} title={`Datos pendientes: ${cand.campos_faltantes?.join(', ') || 'Formularios incompletos'}`}>
                              ⚠️ Datos incompletos ({cand.campos_faltantes?.length || 0})
                            </span>
                          )}
                          <span style={{
                            background: isLight ? '#ECFDF5' : 'linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(46, 125, 50, 0.3))',
                            border: isLight ? '1.5px solid #10B981' : '1px solid #4CAF50',
                            color: isLight ? '#065F46' : '#81C784',
                            fontWeight: 800,
                            fontSize: 14,
                            padding: '4px 12px',
                            borderRadius: 20,
                            boxShadow: isLight ? '0 1px 4px rgba(16, 185, 129, 0.12)' : 'none'
                          }}>
                            ✨ {cand.compatibility_pct}% Match {!cand.datos_completos ? '(Parcial)' : ''}
                          </span>
                          {cand.ai_score != null && (
                            <span style={{
                              background: cand.ai_veredicto === 'NO RECOMENDADO' ? (isLight ? '#FEE2E2' : 'rgba(239, 68, 68, 0.15)') : (isLight ? '#EEF2FF' : 'rgba(99, 102, 241, 0.15)'),
                              border: cand.ai_veredicto === 'NO RECOMENDADO' ? '1px solid #EF4444' : '1px solid #6366F1',
                              color: cand.ai_veredicto === 'NO RECOMENDADO' ? '#DC2626' : (isLight ? '#4F46E5' : '#818CF8'),
                              fontWeight: 700,
                              fontSize: 12,
                              padding: '3px 10px',
                              borderRadius: 16
                            }} title={cand.ai_analisis || ''}>
                              🤖 IA: {cand.ai_score}% • {cand.ai_veredicto}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* ALERTA VISUAL DE DATOS INSUFICIENTES */}
                  {isInsufficient && (
                    <div style={{
                      background: isLight ? '#FEF2F2' : 'rgba(239, 68, 68, 0.08)',
                      border: isLight ? '1px solid #FECACA' : '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 10,
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12
                    }}>
                      <AlertTriangle size={20} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                      <div style={{ fontSize: 12.5, flex: 1 }}>
                        <div style={{ fontWeight: 800, color: '#DC2626', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>Requiere completar ficha clínica en CRM antes de evaluar match:</span>
                          <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(220, 38, 38, 0.12)', color: '#DC2626', padding: '1px 6px', borderRadius: 6 }}>
                            {cand.campos_evaluados_pts || 0} / 100 pts evaluables
                          </span>
                        </div>
                        <div style={{ color: isLight ? '#4B5563' : '#CBD5E1', lineHeight: 1.5 }}>
                          {cand.campos_faltantes && cand.campos_faltantes.length > 0 && (
                            <div>• <b>Campos estructurales faltantes:</b> {cand.campos_faltantes.join(', ')}.</div>
                          )}
                          {(!cand.bio_notes || cand.bio_notes.length < 20) && (
                            <div>• <b>Notas clínicas:</b> Sin notas de entrevista clínica registradas por la psicóloga en ficha CRM.</div>
                          )}
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <a
                            href={cand.crm_url || (cand.crm_id && cand.crm_id !== 'None' ? `https://dailylover.smartmatchapp.com/#!/client/${cand.crm_id}/` : `https://dailylover.smartmatchapp.com/#!/clients?search=${encodeURIComponent(cand.name)}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#2563EB',
                              fontWeight: 700,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5
                            }}
                          >
                            <span>Abrir ficha de {cand.name} en SmartMatchApp para completar datos</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Banner de Oportunidad Comercial / Cumplimiento para Persona B */}
                  {cand.opportunity_badge && (
                    <div style={{
                      background: isLight ? '#FFFBEB' : 'rgba(255, 193, 7, 0.08)',
                      border: isLight ? '1px solid #FDE68A' : '1px solid rgba(255, 193, 7, 0.3)',
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontSize: 12.5,
                      color: isLight ? '#92400E' : '#FFE082',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10
                    }}>
                      <Sparkles size={16} color={isLight ? '#B45309' : '#FFC107'} style={{ flexShrink: 0 }} />
                      <div style={{ lineHeight: 1.45 }}>
                        <b style={{ color: isLight ? '#78350F' : '#FFF' }}>Oportunidad para María / CS:</b>{' '}
                        <span>{cand.opportunity_reason}</span>
                      </div>
                    </div>
                  )}

                  {/* Comparativa de Métricas 1-10 */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 10,
                    background: isLight ? '#F8FAFC' : 'var(--bg-base)',
                    padding: 12,
                    borderRadius: 10,
                    border: isLight ? '1px solid #E2E8F0' : '1px solid var(--border-color)'
                  }}>
                    <div>
                      <div style={{ fontSize: 10, color: isLight ? '#64748B' : 'var(--text-muted)', fontWeight: 700 }}>GRUPO SOCIAL</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isLight ? '#15803D' : '#4CAF50', marginTop: 2 }}>
                        {cand.social_group_score != null ? (
                          <>
                            {cand.social_group_score.toFixed(1)} / 10
                            {hasSg && (
                              <span style={{ fontSize: 10, color: isLight ? '#64748B' : 'var(--text-muted)', marginLeft: 6, fontWeight: 400 }}>
                                (Δ {sgDiff} vs {client.name.split(' ')[0]})
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: isLight ? '#94A3B8' : '#6B7280', fontWeight: 600, fontSize: 12 }}>
                            Pendiente F2
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: isLight ? '#64748B' : 'var(--text-muted)', fontWeight: 700 }}>ACTIVIDAD FÍSICA</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isLight ? '#0F172A' : 'var(--text-primary)', marginTop: 2 }}>
                        {cand.physical_activity_level != null ? (
                          <>
                            🏃 {cand.physical_activity_level} / 10
                            <span style={{ fontSize: 10, color: isLight ? '#15803D' : '#4CAF50', marginLeft: 6, fontWeight: 600 }}>
                              {cand.physical_activity_level >= 7 ? 'Sincronizado' : 'Compatible'}
                            </span>
                          </>
                        ) : (
                          <span style={{ color: isLight ? '#94A3B8' : '#6B7280', fontWeight: 600, fontSize: 12 }}>
                            🏃 Pendiente F2
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: isLight ? '#64748B' : 'var(--text-muted)', fontWeight: 700 }}>LENGUAJE AMOR</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isLight ? '#B45309' : '#FFE599', marginTop: 2 }}>
                        {cand.love_language && cand.love_language !== 'No especificado' ? (
                          <>❤️ {cand.love_language}</>
                        ) : (
                          <span style={{ color: isLight ? '#94A3B8' : '#6B7280', fontWeight: 600, fontSize: 12 }}>
                            ❤️ Pendiente
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: isLight ? '#64748B' : 'var(--text-muted)', fontWeight: 700 }}>MATRIZ DE APEGO</div>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: cand.attachment_eval?.type === 'trap'
                          ? (isLight ? '#DC2626' : '#ff8a80')
                          : (cand.attachment_eval?.type === 'optimal'
                              ? (isLight ? '#15803D' : '#81C784')
                              : (cand.attachment_eval?.type === 'unspecified'
                                  ? (isLight ? '#94A3B8' : '#6B7280')
                                  : (isLight ? '#B45309' : '#FFE599'))),
                        marginTop: 2
                      }} title={cand.attachment_eval?.clinical_note}>
                        🧠 {cand.attachment_eval?.label || (cand.attachment_style && cand.attachment_style !== 'No especificado' ? `Apego ${cand.attachment_style}` : 'Pendiente de evaluación')}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: isLight ? '#64748B' : 'var(--text-muted)', fontWeight: 700 }}>FILTRO DEALBREAKERS</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isLight ? '#15803D' : '#4CAF50', marginTop: 2 }}>
                        {cand.dealbreakers_check}
                      </div>
                    </div>
                  </div>

                  {/* Fortalezas del Match */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: isLight ? '#0F172A' : 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>
                      {isInsufficient ? 'Datos Preliminares Registrados' : 'Fortalezas de este Match'}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: isLight ? '#334155' : 'var(--text-secondary)', lineHeight: 1.55 }}>
                      {(cand.strengths || []).map((str, sIdx) => (
                        <li key={sIdx}>{str}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Botón de Acción Principal: Aprobar y pasar a MATCHES */}
                  <div style={{
                    borderTop: isLight ? '1px solid #E2E8F0' : '1px solid var(--border-color)',
                    paddingTop: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10
                  }}>
                    <span style={{ fontSize: 12, color: isLight ? '#64748B' : 'var(--text-muted)' }}>
                      {isInsufficient
                        ? `Candidato #${idx + 1} • Requiere completar ficha para contrastación 360°`
                        : `Candidato #${idx + 1} evaluado por algoritmo clínico`}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        onClick={() => setViewingAnalysis(cand)}
                        style={{
                          padding: '9px 16px',
                          fontSize: 13,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          borderRadius: 8,
                          border: isLight ? '1.5px solid #FECDD3' : '1px solid rgba(150, 21, 0, 0.4)',
                          background: isLight ? '#FFF1F2' : 'rgba(150, 21, 0, 0.12)',
                          color: isLight ? '#961500' : '#ff8a80',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isLight ? '#FFE4E6' : 'rgba(150, 21, 0, 0.25)'
                          e.currentTarget.style.borderColor = isLight ? '#F43F5E' : 'var(--color-primary-light)'
                          e.currentTarget.style.color = isLight ? '#881337' : '#fff'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isLight ? '#FFF1F2' : 'rgba(150, 21, 0, 0.12)'
                          e.currentTarget.style.borderColor = isLight ? '#FECDD3' : 'rgba(150, 21, 0, 0.4)'
                          e.currentTarget.style.color = isLight ? '#961500' : '#ff8a80'
                        }}
                      >
                        🧠 Análisis de Match
                      </button>

                      {isInsufficient ? (
                        <button
                          onClick={() => {
                            if (window.confirm(`⚠️ ADVERTENCIA: ${cand.name} tiene información insuficiente en CRM (faltan: ${cand.campos_faltantes?.join(', ') || 'notas clínicas'}). ¿Confirmas que deseas enviarlo de todos modos a revisión de María advirtiéndole que faltan datos?`)) {
                              setSelectedCandidate(cand)
                            }
                          }}
                          style={{
                            padding: '9px 16px',
                            fontSize: 13,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            background: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.08)',
                            color: isLight ? '#475569' : '#94A3B8',
                            border: isLight ? '1.5px solid #CBD5E1' : '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: 8,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#F59E0B'
                            e.currentTarget.style.color = isLight ? '#B45309' : '#FBBF24'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = isLight ? '#CBD5E1' : 'rgba(255, 255, 255, 0.2)'
                            e.currentTarget.style.color = isLight ? '#475569' : '#94A3B8'
                          }}
                        >
                          <AlertTriangle size={15} color="#F59E0B" /> Enviar con advertencia de datos faltantes
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          {onAssignCandidate && (
                            <button
                              onClick={() => onAssignCandidate(cand)}
                              style={{
                                padding: '9px 18px',
                                fontSize: 13,
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                background: '#10B981',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: 8,
                                cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <Check size={16} /> 🎯 Asignar a la Fila de {clientName || 'Persona A'}
                            </button>
                          )}
                          <button
                            className="btn btn-primary"
                            onClick={() => setSelectedCandidate(cand)}
                            style={{
                              padding: '9px 18px',
                              fontSize: 13,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              background: 'linear-gradient(135deg, #961500, #7a1100)',
                              color: '#FFFFFF',
                              boxShadow: '0 4px 14px rgba(150, 21, 0, 0.3)'
                            }}
                          >
                            <Heart size={15} fill="#fff" /> ✨ Enviar a Aprobación por María
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            }

            const renderCandidateRowCompact = (cand, idx, isInsufficient) => {
              const hasSg = cand.social_group_score != null && client.social_group_score != null
              const sgDiff = hasSg ? Math.abs(client.social_group_score - cand.social_group_score).toFixed(1) : null
              const isSelected = selectedForCompare.some(c => c.user_id === cand.user_id)

              return (
                <div
                  key={cand.user_id}
                  style={{
                    background: isLight
                      ? (isInsufficient ? '#FFFDF5' : '#FFFFFF')
                      : (isInsufficient ? 'rgba(245, 158, 11, 0.03)' : 'var(--bg-card)'),
                    border: isSelected
                      ? (isLight ? '2px solid #961500' : '2px solid var(--color-primary-light)')
                      : (isInsufficient
                          ? (isLight ? '1.5px dashed #F59E0B' : '1px dashed rgba(245, 158, 11, 0.4)')
                          : (isLight ? '1px solid #E2E8F0' : '1px solid var(--border-color)')),
                    borderRadius: 12,
                    padding: '12px 16px',
                    boxShadow: isSelected
                      ? (isLight ? '0 4px 18px rgba(150, 21, 0, 0.12)' : '0 4px 20px rgba(150, 21, 0, 0.35)')
                      : (isLight ? '0 2px 8px rgba(0,0,0,0.04)' : '0 2px 10px rgba(0,0,0,0.15)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* 1. Lado Izquierdo: Checkbox + Identidad */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 260 }}>
                    <button
                      onClick={() => handleToggleCompare(cand)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        color: isSelected ? 'var(--color-primary, #961500)' : (isLight ? '#94A3B8' : 'var(--text-muted)'),
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title={isSelected ? 'Quitar de la matriz de comparación' : 'Seleccionar para comparar en matriz simultánea'}
                    >
                      {isSelected ? <CheckSquare size={19} color="var(--color-primary, #961500)" /> : <Square size={19} />}
                    </button>

                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: isInsufficient
                        ? 'linear-gradient(135deg, #78716c, #a8a29e)'
                        : 'linear-gradient(135deg, #1976d2, #0288d1)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 14,
                      flexShrink: 0
                    }}>
                      {cand.name.charAt(0)}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <a
                          href={cand.crm_url || (cand.crm_id && cand.crm_id !== 'None' ? `https://dailylover.smartmatchapp.com/#!/client/${cand.crm_id}/` : `https://dailylover.smartmatchapp.com/#!/clients?search=${encodeURIComponent(cand.name)}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: isLight ? '#0F172A' : 'var(--text-primary)',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          {cand.name}
                          <ExternalLink size={12} style={{ color: '#2196F3', opacity: 0.8 }} />
                        </a>
                        <span style={{ fontSize: 11.5, color: isLight ? '#64748B' : 'var(--text-muted)' }}>
                          ({cand.age || '?'}a • {cand.city})
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: isLight ? '#64748B' : 'var(--text-muted)', marginTop: 2 }}>
                        💼 {cand.occupation || 'Ocupación no esp.'} • 📋 {cand.plan_tier || 'Estándar'}
                      </div>
                    </div>
                  </div>

                  {/* 2. Centro: Métricas Clave en Chips Horizontales */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: (cand.dates_remaining ?? cand.saldo_citas ?? 1) > 0
                        ? (isLight ? '#ECFDF5' : 'rgba(76, 175, 80, 0.12)')
                        : (isLight ? '#FFFBEB' : 'rgba(255, 193, 7, 0.12)'),
                      color: (cand.dates_remaining ?? cand.saldo_citas ?? 1) > 0
                        ? (isLight ? '#065F46' : '#81C784')
                        : (isLight ? '#92400E' : '#FFE082'),
                      border: (cand.dates_remaining ?? cand.saldo_citas ?? 1) > 0
                        ? (isLight ? '1px solid #A7F3D0' : '1px solid rgba(76, 175, 80, 0.25)')
                        : (isLight ? '1px solid #FDE68A' : '1px solid rgba(255, 193, 7, 0.25)')
                    }}>
                      🎟️ {cand.dates_used || 0}/{cand.plan_total_dates || 2} ({cand.dates_remaining ?? cand.saldo_citas ?? 1} disp.)
                    </span>

                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: isLight ? '#F8FAFC' : 'var(--bg-base)',
                      border: isLight ? '1px solid #E2E8F0' : '1px solid var(--border-color)',
                      color: isLight ? '#15803D' : '#4CAF50'
                    }}>
                      GS: {cand.social_group_score != null ? cand.social_group_score.toFixed(1) : '—'}
                      {hasSg && <span style={{ color: isLight ? '#64748B' : 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>Δ{sgDiff}</span>}
                    </span>

                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: cand.attachment_eval?.type === 'trap'
                        ? (isLight ? '#FEE2E2' : 'rgba(239, 68, 68, 0.15)')
                        : (isLight ? '#F8FAFC' : 'var(--bg-base)'),
                      border: cand.attachment_eval?.type === 'trap'
                        ? (isLight ? '1px solid #FECACA' : '1px solid rgba(239, 68, 68, 0.3)')
                        : (isLight ? '1px solid #E2E8F0' : '1px solid var(--border-color)'),
                      color: cand.attachment_eval?.type === 'trap'
                        ? (isLight ? '#DC2626' : '#ff8a80')
                        : (isLight ? '#475569' : 'var(--text-secondary)')
                    }}>
                      🧠 {cand.attachment_eval?.label || (cand.attachment_style ? `Apego ${cand.attachment_style}` : 'Apego pend.')}
                    </span>

                    {cand.physical_activity_level != null && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: isLight ? '#F8FAFC' : 'var(--bg-base)',
                        border: isLight ? '1px solid #E2E8F0' : '1px solid var(--border-color)',
                        color: isLight ? '#0F172A' : 'var(--text-primary)'
                      }}>
                        🏃 {cand.physical_activity_level}/10
                      </span>
                    )}

                    {isInsufficient ? (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: 14,
                        background: isLight ? '#FEF3C7' : 'rgba(245, 158, 11, 0.15)',
                        color: isLight ? '#92400E' : '#FBBF24',
                        border: isLight ? '1px solid #FCD34D' : '1px solid rgba(245, 158, 11, 0.3)'
                      }}>
                        ⚠️ Sin datos
                      </span>
                    ) : (
                      <span style={{
                        fontSize: 12,
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: 14,
                        background: (cand.compatibility_pct ?? 0) >= 80
                          ? (isLight ? '#ECFDF5' : 'rgba(16, 185, 129, 0.15)')
                          : (isLight ? '#EFF6FF' : 'rgba(59, 130, 246, 0.15)'),
                        color: (cand.compatibility_pct ?? 0) >= 80
                          ? (isLight ? '#065F46' : '#81C784')
                          : (isLight ? '#1E40AF' : '#93C5FD'),
                        border: (cand.compatibility_pct ?? 0) >= 80
                          ? (isLight ? '1px solid #A7F3D0' : '1px solid rgba(16, 185, 129, 0.3)')
                          : (isLight ? '1px solid #BFDBFE' : '1px solid rgba(59, 130, 246, 0.3)')
                      }}>
                        ✨ {cand.compatibility_pct}% {!cand.datos_completos ? '(Parcial)' : ''}
                      </span>

                    )}
                  </div>

                  {/* 3. Lado Derecho: Acciones Rápidas */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => setViewingAnalysis(cand)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        borderRadius: 7,
                        border: isLight ? '1px solid #FECDD3' : '1px solid rgba(150, 21, 0, 0.4)',
                        background: isLight ? '#FFF1F2' : 'rgba(150, 21, 0, 0.12)',
                        color: isLight ? '#961500' : '#ff8a80',
                        cursor: 'pointer'
                      }}
                    >
                      🧠 Análisis
                    </button>

                    {isInsufficient ? (
                      <button
                        onClick={() => {
                          if (window.confirm(`⚠️ ADVERTENCIA: ${cand.name} tiene información insuficiente en CRM. ¿Deseas enviarlo de todos modos a revisión de María?`)) {
                            setSelectedCandidate(cand)
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.08)',
                          color: isLight ? '#475569' : '#94A3B8',
                          border: isLight ? '1px solid #CBD5E1' : '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: 7,
                          cursor: 'pointer'
                        }}
                      >
                        <AlertTriangle size={13} color="#F59E0B" /> Enviar
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() => setSelectedCandidate(cand)}
                        style={{
                          padding: '6px 14px',
                          fontSize: 12,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: 'linear-gradient(135deg, #961500, #7a1100)',
                          color: '#FFFFFF'
                        }}
                      >
                        <Heart size={13} fill="#fff" /> ✨ Enviar a María
                      </button>
                    )}
                  </div>
                </div>
              )
            }

            return (
              <div>
                {/* SECCIÓN 1: CANDIDATOS RECOMENDADOS Y VIABLES CON EVALUACIÓN CLÍNICA */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CheckCircle2 size={18} color="#10B981" />
                      <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isLight ? '#0F172A' : '#F8FAFC' }}>
                        Candidatos Recomendados / Viables Evaluados ({viableMatches.length})
                      </h3>
                    </div>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 12,
                      background: isLight ? '#ECFDF5' : 'rgba(16, 185, 129, 0.15)',
                      color: isLight ? '#065F46' : '#81C784',
                      border: isLight ? '1px solid #A7F3D0' : '1px solid rgba(16, 185, 129, 0.3)'
                    }}>
                      ✓ Aptos para revisión clínica
                    </span>
                  </div>

                  {viableMatches.length === 0 ? (
                    <div style={{
                      background: isLight ? '#FFFFFF' : 'var(--bg-card)',
                      border: isLight ? '1px solid #E2E8F0' : '1px solid var(--border-color)',
                      borderRadius: 12,
                      padding: 30,
                      textAlign: 'center',
                      color: isLight ? '#64748B' : 'var(--text-muted)'
                    }}>
                      No se encontraron candidatos con datos suficientes para evaluación clínica en este momento.
                    </div>
                  ) : (
                    viewDisplayMode === 'compact' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {viableMatches.map((cand, idx) => renderCandidateRowCompact(cand, idx, false))}
                      </div>
                    ) : (
                      viableMatches.map((cand, idx) => renderCandidateCard(cand, idx, false))
                    )
                  )}
                </div>

                {/* SECCIÓN 2: CANDIDATOS CON INFORMACIÓN INSUFICIENTE EN CRM */}
                {insufficientMatches.length > 0 && (
                  <div style={{
                    marginTop: 32,
                    border: isLight ? '1.5px dashed #F59E0B' : '1.5px dashed rgba(245, 158, 11, 0.5)',
                    borderRadius: 14,
                    background: isLight ? '#FFFDF5' : 'rgba(245, 158, 11, 0.03)',
                    padding: 20
                  }}>
                    <div
                      onClick={() => setShowInsufficient(!showInsufficient)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          background: isLight ? '#FEF3C7' : 'rgba(245, 158, 11, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <AlertTriangle size={18} color="#D97706" />
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: isLight ? '#92400E' : '#FBBF24', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>⚠️ Candidatos con Información Insuficiente en CRM ({insufficientMatches.length})</span>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 10,
                              background: isLight ? '#FDE68A' : 'rgba(245, 158, 11, 0.2)',
                              color: isLight ? '#78350F' : '#FCD34D'
                            }}>
                              Ficha incompleta
                            </span>
                          </div>
                          <p style={{ fontSize: 12, color: isLight ? '#78350F' : '#FCD34D', margin: '3px 0 0' }}>
                            Pasan los filtros demográficos duros, pero carecen de notas clínicas o datos estructurales suficientes en el CRM para contrastar compatibilidad de forma rigurosa.
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isLight ? '#92400E' : '#FBBF24', fontSize: 13, fontWeight: 700 }}>
                        <span>{showInsufficient ? 'Ocultar' : 'Ver candidatos'}</span>
                        {showInsufficient ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {showInsufficient && (
                      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: viewDisplayMode === 'compact' ? 10 : 14 }}>
                        {insufficientMatches.map((cand, idx) => (
                          viewDisplayMode === 'compact'
                            ? renderCandidateRowCompact(cand, idx, true)
                            : renderCandidateCard(cand, idx, true)
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      {/* MODAL DE CONFIRMACIÓN DE APROBACIÓN */}
      {selectedCandidate && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 14,
            padding: 24,
            maxWidth: 520,
            width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={20} color="#c41a00" />
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Enviar Propuesta a Aprobación de María
                </h3>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedCandidate(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{
              background: 'var(--bg-base)',
              padding: 14,
              borderRadius: 10,
              border: '1px solid var(--border-color)',
              marginBottom: 16
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                PROPUESTA PARA REVISIÓN DE MARÍA:
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-primary-light)', marginTop: 4 }}>
                {client.name} × {selectedCandidate.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                📍 {client.city} • Afinidad: <b>{selectedCandidate.compatibility_pct != null ? `${selectedCandidate.compatibility_pct}%` : 'Sin datos suficientes'}</b>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                👩‍⚕️ Psicóloga Responsable de la Entrevista:
              </label>
              <select
                value={psychologist}
                onChange={(e) => setPsychologist(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none'
                }}
              >
                {PSYCHOLOGISTS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Observaciones clínicas para la cita (opcional):
              </label>
              <textarea
                rows={3}
                placeholder="Ej: Cita recomendada en café tranquilo. Ambos valoran puntualidad y conversación profunda."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
              {hasDraft && notes && notes.trim().length > 0 && (
                <div style={{ fontSize: 11, color: '#10B981', marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Check size={12} /> Borrador guardado localmente (protegido contra recargas o reinicios)
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setSelectedCandidate(null)}
                disabled={approving}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleApprove}
                disabled={approving}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {approving ? 'Enviando...' : 'Confirmar y Enviar a María →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ANÁLISIS CLÍNICO DE MATCH (PROS Y CONTRAS) */}
      {viewingAnalysis && (
        <MatchAnalysisModal
          candidate={viewingAnalysis}
          client={data?.client}
          onClose={() => setViewingAnalysis(null)}
          onApprove={(cand) => {
            setViewingAnalysis(null)
            setSelectedCandidate(cand)
          }}
        />
      )}

      {/* MODAL COMPARADOR MATRICIAL A/B/C */}
      {showCompareModal && selectedForCompare.length > 0 && (
        <MultiCandidateCompareModal
          client={data?.client}
          candidates={selectedForCompare}
          onClose={() => setShowCompareModal(false)}
          onApprove={(cand) => {
            setShowCompareModal(false)
            setSelectedCandidate(cand)
          }}
          onToggleCandidate={handleToggleCompare}
          onOpenChat={() => setShowMultiChatModal(true)}
        />
      )}

      {/* MODAL COPILOTO CLÍNICO MULTI-CANDIDATA */}
      {showMultiChatModal && selectedForCompare.length > 0 && (
        <MultiCandidateChatModal
          client={data?.client}
          candidates={selectedForCompare}
          onClose={() => setShowMultiChatModal(false)}
          token={token}
        />
      )}

      {/* BARRA FLOTANTE INFERIOR: COMPARADOR MULTI-CANDIDATA */}
      {selectedForCompare.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999,
          background: isLight ? '#FFFFFF' : '#1A1214',
          border: isLight ? '1.5px solid #961500' : '1.5px solid var(--color-primary-light, #c41a00)',
          boxShadow: isLight ? '0 10px 32px rgba(0,0,0,0.15)' : '0 12px 40px rgba(0,0,0,0.7)',
          borderRadius: 30,
          padding: '10px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          maxWidth: '94vw'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: isLight ? '#FEE2E2' : 'rgba(150, 21, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isLight ? '#961500' : 'var(--color-primary-light)'
            }}>
              <Scale size={16} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: isLight ? '#0F172A' : 'var(--text-primary)' }}>
              {selectedForCompare.length} {selectedForCompare.length === 1 ? 'candidata seleccionada' : 'candidatas seleccionadas'}:
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {selectedForCompare.map(c => (
                <span key={c.user_id} style={{
                  fontSize: 12,
                  fontWeight: 700,
                  background: isLight ? '#FEE2E2' : 'rgba(150, 21, 0, 0.25)',
                  border: isLight ? '1px solid #FECACA' : '1px solid rgba(150, 21, 0, 0.4)',
                  color: isLight ? '#961500' : 'var(--color-primary-light)',
                  padding: '3px 10px',
                  borderRadius: 14,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5
                }}>
                  {c.name.split(' ')[0]}
                  <X
                    size={13}
                    style={{ cursor: 'pointer', opacity: 0.8 }}
                    onClick={() => handleToggleCompare(c)}
                    title="Quitar de la selección"
                  />
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <button
              onClick={() => setShowMultiChatModal(true)}
              style={{
                padding: '8px 16px',
                fontSize: 12.5,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 20,
                border: isLight ? '1.5px solid #2563EB' : '1.5px solid #3B82F6',
                background: isLight ? '#EFF6FF' : 'rgba(59, 130, 246, 0.22)',
                color: isLight ? '#1D4ED8' : '#93C5FD',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)',
                transition: 'all 0.15s ease'
              }}
              title="Abrir Copiloto Clínico para contrastar con IA a las candidatas seleccionadas"
            >
              <Bot size={15} /> Copiloto Clínico ({selectedForCompare.length})
            </button>

            <button
              onClick={() => setShowCompareModal(true)}
              className="btn btn-primary"
              style={{
                padding: '8px 18px',
                fontSize: 12.5,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                boxShadow: '0 2px 10px rgba(150, 21, 0, 0.35)'
              }}
            >
              <Scale size={15} /> Comparar en Matriz
            </button>

            <button
              onClick={handleClearCompare}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, padding: '7px 12px' }}
            >
              Limpiar
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

function MultiCandidateCompareModal({ client, candidates, onClose, onApprove, onToggleCandidate, onOpenChat }) {
  if (!client || !candidates || candidates.length === 0) return null

  // Detección reactiva de modo claro (Light Mode)
  const [isLight, setIsLight] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.body.classList.contains('light-mode') || localStorage.getItem('theme') === 'light'
    }
    return false
  })

  useEffect(() => {
    const updateTheme = () => {
      setIsLight(document.body.classList.contains('light-mode') || localStorage.getItem('theme') === 'light')
    }
    updateTheme()
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    window.addEventListener('storage', updateTheme)
    return () => {
      observer.disconnect()
      window.removeEventListener('storage', updateTheme)
    }
  }, [])

  const t = isLight ? {
    overlayBg: 'rgba(0, 0, 0, 0.75)',
    modalBg: '#FFFFFF',
    modalBorder: '1px solid #E2E8F0',
    titleColor: '#0F172A',
    headerBorder: '1px solid #E2E8F0',
    headerBadgeBg: '#FEE2E2',
    headerBadgeBorder: '1px solid #FECACA',
    headerBadgeColor: '#961500',
    tableBorder: '1px solid #E2E8F0',
    thBg: '#F8FAFC',
    tdBorder: '1px solid #E2E8F0',
    rowEvenBg: '#F8FAFC',
    rowOddBg: '#FFFFFF',
    critColBg: '#F1F5F9',
    critColor: '#334155',
    personABg: '#FFF1F2',
    personABorder: '1.5px solid #FECDD3',
    personATitle: '#961500',
    candBg: '#F0FDF4',
    candBorder: '1.5px solid #BBF7D0',
    candTitle: '#065F46',
    subText: '#64748B'
  } : {
    overlayBg: 'rgba(0, 0, 0, 0.85)',
    modalBg: '#120C0E',
    modalBorder: '1px solid rgba(150, 21, 0, 0.45)',
    titleColor: '#FFFFFF',
    headerBorder: '1px solid rgba(255, 255, 255, 0.1)',
    headerBadgeBg: 'rgba(150, 21, 0, 0.3)',
    headerBadgeBorder: '1px solid rgba(239, 68, 68, 0.35)',
    headerBadgeColor: '#F87171',
    tableBorder: '1px solid rgba(255, 255, 255, 0.08)',
    thBg: '#180E11',
    tdBorder: '1px solid rgba(255, 255, 255, 0.06)',
    rowEvenBg: 'rgba(255, 255, 255, 0.02)',
    rowOddBg: 'transparent',
    critColBg: '#181214',
    critColor: '#CBD5E1',
    personABg: 'rgba(150, 21, 0, 0.15)',
    personABorder: '1.5px solid #7F1D1D',
    personATitle: '#FCA5A5',
    candBg: 'rgba(5, 150, 105, 0.1)',
    candBorder: '1.5px solid #059669',
    candTitle: '#6EE7B7',
    subText: '#94A3B8'
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: t.overlayBg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '16px',
      overflowY: 'auto'
    }}>
      <div style={{
        background: t.modalBg,
        border: t.modalBorder,
        borderRadius: 16,
        width: '100%',
        maxWidth: 1200,
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 70px rgba(0,0,0,0.7)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: t.headerBorder,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              color: t.headerBadgeColor,
              background: t.headerBadgeBg,
              border: t.headerBadgeBorder,
              padding: '3px 8px',
              borderRadius: 6,
              marginBottom: 6
            }}>
              <Scale size={13} /> MATRIZ COMPARATIVA LADO A LADO (A/B/C TESTING)
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: t.titleColor }}>
              {client.name} <span style={{ color: 'var(--color-primary, #961500)' }}>vs</span> {candidates.length} {candidates.length === 1 ? 'Candidata Finalista' : 'Candidatas Finalistas'}
            </h2>
            <div style={{ fontSize: 12, color: t.subText, marginTop: 2 }}>
              Contraste simultáneo de métricas clínicas, estilos de apego, no negociables y notas de entrevista.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onOpenChat && (
              <button
                type="button"
                onClick={onOpenChat}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: isLight ? '1.5px solid #2563EB' : '1.5px solid #3B82F6',
                  background: isLight ? '#EFF6FF' : 'rgba(59, 130, 246, 0.22)',
                  color: isLight ? '#1D4ED8' : '#93C5FD',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease'
                }}
                title="Abrir Copiloto Clínico Multi-Candidata"
              >
                <Bot size={15} /> Copiloto Clínico ({candidates.length})
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: t.titleColor,
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>


        {/* Matrix Table */}
        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, padding: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{
                  padding: '14px 16px',
                  background: t.thBg,
                  borderBottom: t.tableBorder,
                  borderRight: t.tdBorder,
                  width: 200,
                  minWidth: 180,
                  textAlign: 'left',
                  fontWeight: 800,
                  color: t.critColor,
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  position: 'sticky',
                  left: 0,
                  zIndex: 2
                }}>
                  Criterio Clínico
                </th>

                {/* Columna Persona A */}
                <th style={{
                  padding: '14px 16px',
                  background: t.personABg,
                  borderBottom: t.tableBorder,
                  borderRight: t.tdBorder,
                  minWidth: 260,
                  textAlign: 'left',
                  verticalAlign: 'top'
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: t.personATitle, textTransform: 'uppercase' }}>
                    PERSONA A (CLIENTE)
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: t.titleColor, marginTop: 2 }}>
                    {client.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: t.subText, marginTop: 2 }}>
                    📍 {client.city} • {client.age ? `${client.age} años` : ''}
                  </div>
                </th>

                {/* Columnas de Candidatas */}
                {candidates.map((cand, idx) => (
                  <th key={cand.user_id} style={{
                    padding: '14px 16px',
                    background: t.candBg,
                    borderBottom: t.tableBorder,
                    borderRight: t.tdBorder,
                    minWidth: 260,
                    textAlign: 'left',
                    verticalAlign: 'top'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: t.candTitle, textTransform: 'uppercase' }}>
                          CANDIDATA #{idx + 1}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: t.titleColor, marginTop: 2 }}>
                          {cand.name}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 14,
                        background: isLight ? '#ECFDF5' : 'rgba(16, 185, 129, 0.2)',
                        color: isLight ? '#065F46' : '#81C784',
                        border: '1px solid #10B981',
                        flexShrink: 0
                      }}>
                        ✨ {cand.compatibility_pct}%
                      </span>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => onApprove(cand)}
                        style={{
                          width: '100%',
                          fontSize: 12,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6
                        }}
                      >
                        <Heart size={13} fill="#fff" /> Aprobar y Enviar a María
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* FILA 1: DATOS BÁSICOS & CRM */}
              <tr style={{ background: t.rowEvenBg, borderBottom: t.tdBorder }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: t.critColor, position: 'sticky', left: 0, background: t.critColBg, borderRight: t.tdBorder }}>
                  Perfil & Profesión
                </td>
                <td style={{ padding: '12px 16px', borderRight: t.tdBorder }}>
                  <div><b>{client.occupation || 'Profesional'}</b></div>
                  <div style={{ fontSize: 12, color: t.subText }}>Estatura: {client.estatura || '—'}</div>
                  <div style={{ marginTop: 4 }}>
                    <a
                      href={client.crm_url || (client.crm_id ? `https://dailylover.smartmatchapp.com/#!/client/${client.crm_id}/` : `https://dailylover.smartmatchapp.com/#!/clients?search=${encodeURIComponent(client.name)}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, color: '#2563EB', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                    >
                      CRM <ExternalLink size={10} />
                    </a>
                  </div>
                </td>
                {candidates.map(c => (
                  <td key={c.user_id} style={{ padding: '12px 16px', borderRight: t.tdBorder }}>
                    <div><b>{c.occupation && c.occupation !== 'No especificado' ? c.occupation : 'Ocupación no esp.'}</b></div>
                    <div style={{ fontSize: 12, color: t.subText }}>Edad: {c.age || '—'} • Ciudad: {c.city}</div>
                    <div style={{ marginTop: 4 }}>
                      <a
                        href={c.crm_url || (c.crm_id && c.crm_id !== 'None' ? `https://dailylover.smartmatchapp.com/#!/client/${c.crm_id}/` : `https://dailylover.smartmatchapp.com/#!/clients?search=${encodeURIComponent(c.name)}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: '#2563EB', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                      >
                        CRM <ExternalLink size={10} />
                      </a>
                    </div>
                  </td>
                ))}
              </tr>

              {/* FILA 2: PLAN & SALDO DE CITAS */}
              <tr style={{ background: t.rowOddBg, borderBottom: t.tdBorder }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: t.critColor, position: 'sticky', left: 0, background: t.critColBg, borderRight: t.tdBorder }}>
                  Plan & Citas Disp.
                </td>
                <td style={{ padding: '12px 16px', borderRight: t.tdBorder }}>
                  <div style={{ fontWeight: 700 }}>{client.plan_tier || 'Plan Estándar (2 citas)'}</div>
                  <div style={{ fontSize: 12, color: (client.dates_remaining ?? 1) > 0 ? '#10B981' : '#F59E0B', fontWeight: 700 }}>
                    🎟️ {client.dates_used || 0} de {client.plan_total_dates || 2} citas ({client.dates_remaining ?? 1} disp.)
                  </div>
                </td>
                {candidates.map(c => (
                  <td key={c.user_id} style={{ padding: '12px 16px', borderRight: t.tdBorder }}>
                    <div style={{ fontWeight: 700 }}>{c.plan_tier || 'Estándar'}</div>
                    <div style={{ fontSize: 12, color: (c.dates_remaining ?? c.saldo_citas ?? 1) > 0 ? '#10B981' : '#F59E0B', fontWeight: 700 }}>
                      🎟️ {c.dates_used || 0} de {c.plan_total_dates || 2} citas ({c.dates_remaining ?? c.saldo_citas ?? 1} disp.)
                    </div>
                  </td>
                ))}
              </tr>

              {/* FILA 3: GRUPO SOCIAL */}
              <tr style={{ background: t.rowEvenBg, borderBottom: t.tdBorder }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: t.critColor, position: 'sticky', left: 0, background: t.critColBg, borderRight: t.tdBorder }}>
                  Grupo Social (1-10)
                </td>
                <td style={{ padding: '12px 16px', borderRight: t.tdBorder }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#10B981' }}>
                    {client.social_group_score != null ? client.social_group_score.toFixed(1) : '—'} / 10
                  </span>
                </td>
                {candidates.map(c => {
                  const diff = (client.social_group_score != null && c.social_group_score != null)
                    ? Math.abs(client.social_group_score - c.social_group_score).toFixed(1)
                    : null
                  return (
                    <td key={c.user_id} style={{ padding: '12px 16px', borderRight: t.tdBorder }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#10B981' }}>
                        {c.social_group_score != null ? c.social_group_score.toFixed(1) : 'Pendiente'} / 10
                      </span>
                      {diff && (
                        <div style={{ fontSize: 11, color: t.subText, marginTop: 2 }}>
                          Diferencial: Δ {diff} pts
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>

              {/* FILA 4: MATRIZ DE APEGO */}
              <tr style={{ background: t.rowOddBg, borderBottom: t.tdBorder }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: t.critColor, position: 'sticky', left: 0, background: t.critColBg, borderRight: t.tdBorder }}>
                  Matriz de Apego
                </td>
                <td style={{ padding: '12px 16px', borderRight: t.tdBorder }}>
                  <b>🧠 {client.attachment_style || 'Apego Seguro'}</b>
                </td>
                {candidates.map(c => {
                  const isTrap = c.attachment_eval?.type === 'trap'
                  return (
                    <td key={c.user_id} style={{ padding: '12px 16px', borderRight: t.tdBorder }}>
                      <div style={{
                        fontWeight: 800,
                        color: isTrap ? '#EF4444' : '#10B981',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5
                      }}>
                        🧠 {c.attachment_eval?.label || (c.attachment_style ? `Apego ${c.attachment_style}` : 'Pendiente')}
                      </div>
                      {c.attachment_eval?.clinical_note && (
                        <div style={{ fontSize: 11, color: t.subText, marginTop: 3 }}>
                          {c.attachment_eval.clinical_note}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>

              {/* FILA 5: ACTIVIDAD FÍSICA & DEPORTE */}
              <tr style={{ background: t.rowEvenBg, borderBottom: t.tdBorder }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: t.critColor, position: 'sticky', left: 0, background: t.critColBg, borderRight: t.tdBorder }}>
                  Actividad Física
                </td>
                <td style={{ padding: '12px 16px', borderRight: t.tdBorder }}>
                  🏃 {client.physical_activity_level != null ? `${client.physical_activity_level} / 10` : '—'}
                </td>
                {candidates.map(c => (
                  <td key={c.user_id} style={{ padding: '12px 16px', borderRight: t.tdBorder }}>
                    🏃 {c.physical_activity_level != null ? `${c.physical_activity_level} / 10` : 'Pendiente'}
                  </td>
                ))}
              </tr>

              {/* FILA 6: LENGUAJE DEL AMOR */}
              <tr style={{ background: t.rowOddBg, borderBottom: t.tdBorder }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: t.critColor, position: 'sticky', left: 0, background: t.critColBg, borderRight: t.tdBorder }}>
                  Lenguaje Amor
                </td>
                <td style={{ padding: '12px 16px', borderRight: t.tdBorder }}>
                  ❤️ {client.love_language || '—'}
                </td>
                {candidates.map(c => (
                  <td key={c.user_id} style={{ padding: '12px 16px', borderRight: t.tdBorder }}>
                    ❤️ {c.love_language || 'Pendiente'}
                  </td>
                ))}
              </tr>

              {/* FILA 7: DEALBREAKERS / NO NEGOCIABLES */}
              <tr style={{ background: t.rowEvenBg, borderBottom: t.tdBorder }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: t.critColor, position: 'sticky', left: 0, background: t.critColBg, borderRight: t.tdBorder }}>
                  Dealbreakers
                </td>
                <td style={{ padding: '12px 16px', borderRight: t.tdBorder }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(client.non_negotiables || []).map((nn, i) => (
                      <span key={i} style={{ fontSize: 11, background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                        🚫 {typeof nn === 'string' ? nn : (nn.texto || '')}
                      </span>
                    ))}
                  </div>
                </td>
                {candidates.map(c => (
                  <td key={c.user_id} style={{ padding: '12px 16px', borderRight: t.tdBorder }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981', marginBottom: 4 }}>
                      ✓ {c.dealbreakers_check || 'Filtro verificado'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(c.non_negotiables || []).map((nn, i) => (
                        <span key={i} style={{ fontSize: 11, background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                          🚫 {typeof nn === 'string' ? nn : (nn.texto || '')}
                        </span>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>

              {/* FILA 8: NOTAS CLÍNICAS */}
              <tr style={{ background: t.rowOddBg }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: t.critColor, position: 'sticky', left: 0, background: t.critColBg, borderRight: t.tdBorder }}>
                  Notas Clínicas
                </td>
                <td style={{ padding: '12px 16px', borderRight: t.tdBorder, verticalAlign: 'top' }}>
                  <div style={{ maxHeight: 160, overflowY: 'auto', fontSize: 12, color: t.critColor, lineHeight: 1.5 }}>
                    {client.bio_notes || client.synthesis_who_really_is || 'Sin notas registradas'}
                  </div>
                </td>
                {candidates.map(c => (
                  <td key={c.user_id} style={{ padding: '12px 16px', borderRight: t.tdBorder, verticalAlign: 'top' }}>
                    <div style={{ maxHeight: 160, overflowY: 'auto', fontSize: 12, color: t.critColor, lineHeight: 1.5 }}>
                      {c.bio_notes || c.synthesis || 'Sin notas registradas'}
                    </div>
                    {c.strengths && c.strengths.length > 0 && (
                      <div style={{ marginTop: 8, borderTop: t.tdBorder, paddingTop: 6 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#10B981', textTransform: 'uppercase' }}>Fortalezas del match:</div>
                        <ul style={{ margin: '3px 0 0', paddingLeft: 14, fontSize: 11, color: t.subText }}>
                          {c.strengths.slice(0, 3).map((st, si) => <li key={si}>{st}</li>)}
                        </ul>
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: t.headerBorder,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          background: t.thBg
        }}>
          <div style={{ fontSize: 12, color: t.subText }}>
            Selecciona la propuesta óptima para enviarla a revisión y aprobación de María Paula.
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            Cerrar Comparador
          </button>
        </div>
      </div>
    </div>
  )
}

function MultiCandidateChatModal({ client, candidates, onClose, token }) {
  if (!client || !candidates || candidates.length === 0) return null

  const [isLight, setIsLight] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.body.classList.contains('light-mode') || localStorage.getItem('theme') === 'light'
    }
    return false
  })

  useEffect(() => {
    const updateTheme = () => {
      setIsLight(document.body.classList.contains('light-mode') || localStorage.getItem('theme') === 'light')
    }
    updateTheme()
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    window.addEventListener('storage', updateTheme)
    return () => {
      observer.disconnect()
      window.removeEventListener('storage', updateTheme)
    }
  }, [])

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const QUICK_QUESTIONS_MULTI = [
    { icon: '🏃', label: 'Deporte & Hábitos', q: `¿Qué hábitos de deporte, gimnasio y actividad física tiene cada una y cuál es más compatible con ${client.name}?` },
    { icon: '🐶', label: 'Mascotas & Hogar', q: '¿Cuál es la situación de mascotas, convivencia con animales o alergias de cada una?' },
    { icon: '👶', label: 'Hijos & Familia', q: '¿Cuál es la postura de cada candidata respecto a tener o querer hijos y su dinámica familiar?' },
    { icon: '🧠', label: 'Estilo de Apego', q: `¿Qué estilo de apego tiene cada una y cuál ofrece la dinámica emocional más sana y segura con ${client.name}?` },
    { icon: '💼', label: 'Profesión & Nivel', q: `¿A qué se dedica cada una y cómo están en compatibilidad sociocultural y ritmo de vida frente a ${client.name}?` },
    { icon: '🎟️', label: 'Citas Disponibles', q: '¿Cuántas citas disponibles en su plan tiene cada candidata para agendar?' },
    { icon: '🏆', label: 'Recomendación 1ra Opción', q: `¿Cuál de estas ${candidates.length} candidatas recomiendas agendar de primera opción para una 1ra cita con ${client.name} y por qué?` }
  ]

  const handleSend = async (textToSend) => {
    const q = (textToSend || input || '').trim()
    if (!q || loading) return

    setInput('')
    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setLoading(true)

    try {
      const payload = {
        client_name: client.name,
        client_info: client,
        candidates: candidates.map(c => ({
          ...c,
          bio_notes: c.bio_notes || c.synthesis || '',
          non_negotiables: c.non_negotiables || [],
          red_flags: c.red_flags || []
        })),
        question: q,
        history: nextMessages.slice(-4)
      }

      const tokenToUse = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('dl_token') : '')
      const res = await fetch(`${API}/api/v1/matchmaking/clinical-chat-multi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tokenToUse ? { 'Authorization': `Bearer ${tokenToUse}` } : {})
        },
        body: JSON.stringify(payload)
      })

      const resData = await res.json()
      if (!res.ok) {
        throw new Error(resData.detail || 'Error al procesar la consulta')
      }

      const aiMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: resData.answer || 'Sin respuesta generada.',
        model: resData.model_used,
        responseTimeMs: resData.response_time_ms,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }

      setMessages([...nextMessages, aiMsg])
    } catch (err) {
      const errorMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        isError: true,
        text: `⚠️ Error al consultar el copiloto: ${err.message}. Intenta de nuevo.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setMessages([...nextMessages, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleCopyText = (id, text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1800)
    })
  }

  const t = isLight ? {
    overlayBg: 'rgba(15, 23, 42, 0.65)',
    modalBg: '#FFFFFF',
    modalBorder: '1px solid #E2E8F0',
    headerBorder: '1px solid #E2E8F0',
    badgeBg: '#EFF6FF',
    badgeBorder: '1px solid #BFDBFE',
    badgeColor: '#1D4ED8',
    titleColor: '#0F172A',
    subText: '#64748B',
    chatBoxBg: '#F8FAFC',
    chatBoxBorder: '1px solid #E2E8F0',
    userBubbleBg: '#FEE2E2',
    userBubbleBorder: '1px solid #FECACA',
    userBubbleColor: '#961500',
    aiBubbleBg: '#FFFFFF',
    aiBubbleBorder: '1px solid #E2E8F0',
    aiBubbleColor: '#1E293B',
    chipBg: '#F1F5F9',
    chipBorder: '1px solid #E2E8F0',
    chipColor: '#334155',
    inputBg: '#FFFFFF',
    inputBorder: '1px solid #CBD5E1',
    inputColor: '#0F172A'
  } : {
    overlayBg: 'rgba(0, 0, 0, 0.85)',
    modalBg: '#140D0F',
    modalBorder: '1px solid rgba(150, 21, 0, 0.45)',
    headerBorder: '1px solid rgba(255, 255, 255, 0.1)',
    badgeBg: 'rgba(59, 130, 246, 0.2)',
    badgeBorder: '1px solid rgba(59, 130, 246, 0.4)',
    badgeColor: '#93C5FD',
    titleColor: '#FFFFFF',
    subText: '#94A3B8',
    chatBoxBg: '#0D080A',
    chatBoxBorder: '1px solid rgba(255, 255, 255, 0.08)',
    userBubbleBg: 'rgba(150, 21, 0, 0.35)',
    userBubbleBorder: '1px solid rgba(150, 21, 0, 0.6)',
    userBubbleColor: '#FFFFFF',
    aiBubbleBg: '#1C1215',
    aiBubbleBorder: '1px solid rgba(150, 21, 0, 0.25)',
    aiBubbleColor: '#F1F5F9',
    chipBg: 'rgba(255, 255, 255, 0.05)',
    chipBorder: '1px solid rgba(255, 255, 255, 0.1)',
    chipColor: '#CBD5E1',
    inputBg: '#1C1215',
    inputBorder: '1px solid rgba(150, 21, 0, 0.35)',
    inputColor: '#FFFFFF'
  }

  const candNames = candidates.map(c => c.name.split(' ')[0]).join(', ')

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: t.overlayBg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1200,
      padding: '16px'
    }} onClick={onClose}>
      <div style={{
        background: t.modalBg,
        border: t.modalBorder,
        borderRadius: 16,
        width: '100%',
        maxWidth: 780,
        height: '86vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 70px rgba(0,0,0,0.7)',
        overflow: 'hidden'
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '16px 22px',
          borderBottom: t.headerBorder,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12
        }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              color: t.badgeColor,
              background: t.badgeBg,
              border: t.badgeBorder,
              padding: '3px 8px',
              borderRadius: 6,
              marginBottom: 4
            }}>
              <Bot size={13} /> COPILOTO CLÍNICO MULTI-CANDIDATA
            </div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: t.titleColor }}>
              {client.name} <span style={{ color: isLight ? '#961500' : 'var(--color-primary-light, #ff6b6b)' }}>vs</span> {candNames}
            </h3>
            <div style={{ fontSize: 11.5, color: t.subText, marginTop: 2 }}>
              Pregunta cualquier tema específico y la IA contrastará las notas de todas simultáneamente.
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: isLight ? '1px solid #CBD5E1' : '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 8,
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: t.titleColor,
              cursor: 'pointer'
            }}
          >
            <X size={17} />
          </button>
        </div>

        {/* Quick Question Chips */}
        <div style={{
          padding: '10px 18px',
          borderBottom: t.headerBorder,
          background: isLight ? '#FAFAFA' : 'rgba(255, 255, 255, 0.02)',
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          WebkitOverflowScrolling: 'touch'
        }}>
          {QUICK_QUESTIONS_MULTI.map((qq, idx) => (
            <button
              key={idx}
              type="button"
              disabled={loading}
              onClick={() => handleSend(qq.q)}
              style={{
                background: t.chipBg,
                border: t.chipBorder,
                borderRadius: 14,
                padding: '4px 10px',
                fontSize: 11.5,
                fontWeight: 600,
                color: t.chipColor,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.15s ease'
              }}
            >
              <span>{qq.icon}</span>
              <span>{qq.label}</span>
            </button>
          ))}
        </div>

        {/* Chat History Box */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          background: t.chatBoxBg,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          {messages.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              color: t.subText,
              gap: 10,
              padding: 20
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: isLight ? '#EFF6FF' : 'rgba(59, 130, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isLight ? '#2563EB' : '#60A5FA'
              }}>
                <Bot size={24} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.titleColor }}>
                Copiloto Clínico Multi-Candidata Listo
              </div>
              <div style={{ fontSize: 12.5, maxWidth: 440, lineHeight: 1.5 }}>
                Haz una pregunta comparativa sobre <b>{candidates.length} candidatas</b> seleccionadas usando los botones sugeridos arriba o escribiendo tu consulta clínica abajo.
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  gap: 4
                }}
              >
                <div style={{
                  maxWidth: '88%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: msg.sender === 'user' ? t.userBubbleBg : t.aiBubbleBg,
                  border: msg.sender === 'user' ? t.userBubbleBorder : t.aiBubbleBorder,
                  color: msg.sender === 'user' ? t.userBubbleColor : t.aiBubbleColor,
                  fontSize: 13,
                  lineHeight: 1.6,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-line',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}>
                  {msg.sender === 'ai' && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                      borderBottom: isLight ? '1px solid #F1F5F9' : '1px solid rgba(255,255,255,0.08)',
                      paddingBottom: 4
                    }}>
                      <span style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        color: isLight ? '#1D4ED8' : '#93C5FD',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <Bot size={12} /> Copiloto Clínico ({msg.model?.split('/')[1] || 'Llama 3.2 11B'})
                      </span>

                      <button
                        type="button"
                        onClick={() => handleCopyText(msg.id, msg.text)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 10,
                          color: copiedId === msg.id ? '#10B981' : t.subText,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3
                        }}
                      >
                        {copiedId === msg.id ? <Check size={11} color="#10B981" /> : <Copy size={11} />}
                        <span>{copiedId === msg.id ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                  )}

                  {msg.text}
                </div>
                <span style={{ fontSize: 10, color: t.subText, padding: '0 4px' }}>
                  {msg.time} {msg.responseTimeMs ? `• ${(msg.responseTimeMs / 1000).toFixed(1)}s` : ''}
                </span>
              </div>
            ))
          )}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: t.subText, fontSize: 12 }}>
              <RefreshCw size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Analizando y contrastando notas clínicas con IA...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div style={{
          padding: '12px 18px',
          borderTop: t.headerBorder,
          background: isLight ? '#FFFFFF' : '#140D0F',
          display: 'flex',
          gap: 10,
          alignItems: 'center'
        }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
            placeholder={`Escribe una pregunta para contrastar a ${client.name} con las ${candidates.length} candidatas...`}
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              border: t.inputBorder,
              background: t.inputBg,
              color: t.inputColor,
              fontSize: 13,
              outline: 'none'
            }}
          />

          <button
            type="button"
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: isLight ? '#961500' : 'var(--color-primary, #961500)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: 13,
              cursor: (loading || !input.trim()) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: (loading || !input.trim()) ? 0.5 : 1,
              boxShadow: '0 2px 8px rgba(150, 21, 0, 0.3)'
            }}
          >
            <Send size={15} />
            <span>Consultar</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function MatchAnalysisModal({ candidate, client, onClose, onApprove }) {
  if (!candidate || !client) return null

  const [activeTab, setActiveTab] = useState('comparativa') // 'comparativa' | 'dictamen'

  // Detección reactiva de modo claro (Light Mode)
  const [isLight, setIsLight] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.body.classList.contains('light-mode') || localStorage.getItem('theme') === 'light'
    }
    return false
  })

  useEffect(() => {
    const updateTheme = () => {
      setIsLight(document.body.classList.contains('light-mode') || localStorage.getItem('theme') === 'light')
    }
    updateTheme()
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    window.addEventListener('storage', updateTheme)
    return () => {
      observer.disconnect()
      window.removeEventListener('storage', updateTheme)
    }
  }, [])

  const analysis = candidate.match_analysis || {}
  const pros = analysis.pros || []
  const contras = analysis.contras || []
  const keyQuestions = analysis.key_questions || []

  // Datos comparativos reales de ambos perfiles
  const comparison = candidate.comparison || {}
  const clientNotes = client.bio_notes || comparison.client_notes || client.synthesis_who_really_is || 'Sin notas clínicas registradas'
  const candidateNotes = candidate.bio_notes || comparison.candidate_notes || candidate.synthesis || 'Sin notas clínicas registradas'

  // Síntesis ejecutiva de 3 viñetas generada por IA
  const clientSummary = candidate.ai_client_summary || comparison.client_summary || null
  const candSummary = candidate.ai_candidate_summary || comparison.candidate_summary || null
  const [showFullNotesA, setShowFullNotesA] = useState(false)
  const [showFullNotesB, setShowFullNotesB] = useState(false)

  const clientNonNeg = comparison.client_non_neg || client.non_negotiables || []
  const candNonNeg = comparison.candidate_non_neg || candidate.non_negotiables || []

  const clientRedFlags = comparison.client_red_flags || client.search_preferences?.red_flags || []
  const candRedFlags = comparison.candidate_red_flags || candidate.red_flags || []

  const clientAgePref = comparison.client_age_pref || (client.search_preferences?.min_age ? `${client.search_preferences.min_age} a ${client.search_preferences.max_age} años` : '20 a 26 años')
  const candAgePref = comparison.candidate_age_pref || (candidate.search_preferences?.min_age ? `${candidate.search_preferences.min_age} a ${candidate.search_preferences.max_age} años` : 'No especificado')

  const clientHeightPref = comparison.client_height_pref || client.search_preferences?.preferred_height || 'Hasta 170 cm'
  const candHeightPref = comparison.candidate_height_pref || candidate.search_preferences?.preferred_height || 'No especificado'

  const hasBothSg = client.social_group_score != null && candidate.social_group_score != null
  const sgDiff = hasBothSg ? Math.abs(client.social_group_score - candidate.social_group_score).toFixed(1) : null

  // Mini Copiloto Clínico (Chatbot Exclusivo de Pareja)
  const [chatOpen, setChatOpen] = useState(true)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatMessagesEndRef = useRef(null)

  const scrollToChatBottom = () => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  useEffect(() => {
    if (chatOpen && chatMessages.length > 0) {
      scrollToChatBottom()
    }
  }, [chatMessages, chatOpen])

  const QUICK_QUESTIONS = [
    { icon: '🐶', label: 'Mascotas', q: '¿Cómo están en el tema de mascotas y convivencia con animales?' },
    { icon: '🏃', label: 'Deporte & Gym', q: '¿Qué afinidad tienen en actividad física, gimnasio o hábitos saludables?' },
    { icon: '👶', label: 'Hijos & Familia', q: '¿Cuál es la postura de cada uno respecto a tener o querer hijos?' },
    { icon: '🍷', label: 'Fiesta & Hábitos', q: '¿Cómo son sus hábitos de rumba, vida nocturna, alcohol o cigarrillo?' },
    { icon: '💡', label: 'Temas para 1ra cita', q: '¿Qué temas concretos de conversación sugieres para romper el hielo en su 1ra cita según sus notas?' }
  ]

  const handleSendQuestion = async (textToSend) => {
    const q = (textToSend || chatInput || '').trim()
    if (!q || chatLoading) return

    setChatOpen(true)
    setChatInput('')

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const nextMessages = [...chatMessages, userMsg]
    setChatMessages(nextMessages)
    setChatLoading(true)

    try {
      const payload = {
        person_a_name: client.name,
        person_b_name: candidate.name,
        person_a_info: {
          ...client,
          bio_notes: clientNotes,
          non_negotiables: clientNonNeg,
          red_flags: clientRedFlags
        },
        person_b_info: {
          ...candidate,
          bio_notes: candidateNotes,
          non_negotiables: candNonNeg,
          red_flags: candRedFlags
        },
        question: q,
        history: nextMessages.slice(-4)
      }

      const res = await fetch(`${API}/api/v1/matchmaking/clinical-chat-pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Error en la respuesta del copiloto')
      }

      const aiMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: data.answer || 'Sin respuesta generada.',
        model: data.model_used,
        responseTimeMs: data.response_time_ms,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }

      setChatMessages([...nextMessages, aiMsg])
    } catch (err) {
      const errorMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        isError: true,
        text: `⚠️ Error al consultar el copiloto: ${err.message}. Intenta de nuevo.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setChatMessages([...nextMessages, errorMsg])
    } finally {
      setChatLoading(false)
    }
  }

  // Paleta de colores dinámica (Light Mode vs Dark Mode)
  const t = isLight ? {
    overlayBg: 'rgba(15, 23, 42, 0.65)',
    modalBg: '#FFFFFF',
    modalBorder: '1px solid rgba(150, 21, 0, 0.16)',
    modalShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.25)',
    headerBorder: '1px solid #E2E8F0',
    headerBadgeBg: 'rgba(150, 21, 0, 0.08)',
    headerBadgeBorder: '1px solid rgba(150, 21, 0, 0.2)',
    headerBadgeColor: '#961500',
    titleColor: '#1F1012',
    subtitleColor: '#475569',
    boldTextColor: '#0F172A',
    crmLinkColor: '#0284C7',
    matchBadgeBg: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
    matchBadgeBorder: '1.5px solid #10B981',
    matchBadgeColor: '#065F46',
    closeBtnBg: '#F1F5F9',
    closeBtnBorder: '1px solid #E2E8F0',
    closeBtnColor: '#334155',
    tabBorder: '1px solid #E2E8F0',
    tabActiveBg: 'rgba(150, 21, 0, 0.08)',
    tabActiveBorder: '#961500',
    tabActiveColor: '#961500',
    tabInactiveColor: '#64748B',

    // Persona A
    cardABg: '#FFF7F7',
    cardABorder: '1.5px solid #FECACA',
    badgeABg: '#961500',
    badgeAColor: '#FFFFFF',
    nameAColor: '#1F1012',
    subAColor: '#991B1B',
    notesABg: '#FFFFFF',
    notesABorder: '1.5px solid #F87171',
    notesATitle: '#991B1B',
    notesAText: '#0F172A',
    nonNegABg: '#F5F3FF',
    nonNegABorder: '1.5px solid #C7D2FE',
    nonNegATitle: '#4338CA',
    nonNegTagBg: '#EEF2FF',
    nonNegTagBorder: '1px solid #818CF8',
    nonNegTagColor: '#312E81',
    redFlagABg: '#FEF2F2',
    redFlagABorder: '1.5px solid #FECACA',
    redFlagATitle: '#991B1B',
    redFlagTagBg: '#FEE2E2',
    redFlagTagBorder: '1px solid #F87171',
    redFlagTagColor: '#991B1B',
    prefsBg: '#F8FAFC',
    prefsBorder: '1px solid #E2E8F0',
    prefsTitle: '#475569',
    prefsText: '#1E293B',
    metricsBg: '#FFFFFF',
    metricsBorder: '1px solid #E2E8F0',
    metricsLabel: '#64748B',
    metricsValA: '#059669',
    metricsValB: '#B45309',
    metricsValC: '#1D4ED8',
    metricsValD: '#7C3AED',

    // Persona B
    cardBBg: '#F0FDF4',
    cardBBorder: '1.5px solid #BBF7D0',
    badgeBBg: '#059669',
    badgeBColor: '#FFFFFF',
    nameBColor: '#1F1012',
    subBColor: '#065F46',
    notesBBg: '#FFFFFF',
    notesBBorder: '1.5px solid #34D399',
    notesBTitle: '#065F46',
    notesBText: '#0F172A',

    // Summary Bar
    summaryBg: '#F8FAFC',
    summaryBorder: '1px solid #E2E8F0',
    summaryLabel: '#64748B',
    summaryValGreen: '#059669',
    summaryValBlue: '#1D4ED8',
    summaryValPurple: '#7C3AED',
    summaryDesc: '#475569',

    // Tab 2 Dictamen
    whyBg: '#FFF1F2',
    whyBorder: '2px solid #FDA4AF',
    whyTitle: '#9F1239',
    whyText: '#1E1012',
    prosTitle: '#065F46',
    proCardBg: '#F0FDF4',
    proCardBorder: '1.5px solid #86EFAC',
    proTitle: '#064E3B',
    proBadgeBg: '#DCFCE7',
    proBadgeBorder: '1px solid #22C55E',
    proBadgeColor: '#15803D',
    proDesc: '#1E293B',

    contrasTitle: '#B45309',
    contraCardBg: '#FFFBEB',
    contraCardBorder: '1.5px solid #FCD34D',
    contraTitle: '#92400E',
    contraBadgeBg: '#FEF3C7',
    contraBadgeBorder: '1px solid #F59E0B',
    contraBadgeColor: '#B45309',
    contraDesc: '#1E293B',
    contraRecBg: '#FEF3C7',
    contraRecBorder: '#D97706',
    contraRecTitle: '#92400E',
    contraRecText: '#78350F',

    questionsBg: '#EEF2FF',
    questionsBorder: '1.5px solid #A5B4FC',
    questionsTitle: '#3730A3',
    questionsText: '#1E1B4B',

    // Footer
    footerBorder: '1px solid #E2E8F0',
    btnGhostColor: '#475569',
    btnGhostBorder: '1px solid #CBD5E1',
    crmBtnColor: '#0284C7',
    crmBtnBorder: '1px solid #BAE6FD',
    approveBtnBg: '#961500',
    approveBtnColor: '#FFFFFF',
  } : {
    // Dark mode
    overlayBg: 'rgba(0, 0, 0, 0.85)',
    modalBg: '#120C0E',
    modalBorder: '1px solid rgba(150, 21, 0, 0.45)',
    modalShadow: '0 20px 60px rgba(0, 0, 0, 0.85)',
    headerBorder: '1px solid rgba(255, 255, 255, 0.1)',
    headerBadgeBg: 'rgba(150, 21, 0, 0.3)',
    headerBadgeBorder: '1px solid rgba(239, 68, 68, 0.35)',
    headerBadgeColor: '#F87171',
    titleColor: '#FFFFFF',
    subtitleColor: '#CBD5E1',
    boldTextColor: '#FFFFFF',
    crmLinkColor: '#60A5FA',
    matchBadgeBg: 'linear-gradient(135deg, rgba(5, 150, 105, 0.3) 0%, rgba(16, 185, 129, 0.4) 100%)',
    matchBadgeBorder: '1.5px solid #10B981',
    matchBadgeColor: '#34D399',
    closeBtnBg: 'rgba(255,255,255,0.08)',
    closeBtnBorder: '1px solid rgba(255,255,255,0.15)',
    closeBtnColor: '#FFFFFF',
    tabBorder: '1px solid rgba(255, 255, 255, 0.1)',
    tabActiveBg: 'rgba(150, 21, 0, 0.25)',
    tabActiveBorder: '#EF4444',
    tabActiveColor: '#FFFFFF',
    tabInactiveColor: '#94A3B8',

    // Persona A
    cardABg: '#180E11',
    cardABorder: '1.5px solid #7F1D1D',
    badgeABg: '#7F1D1D',
    badgeAColor: '#FFFFFF',
    nameAColor: '#FFFFFF',
    subAColor: '#FCA5A5',
    notesABg: '#241014',
    notesABorder: '1px solid #991B1B',
    notesATitle: '#F87171',
    notesAText: '#FFFFFF',
    nonNegABg: '#131124',
    nonNegABorder: '1px solid #4F46E5',
    nonNegATitle: '#A5B4FC',
    nonNegTagBg: 'rgba(99, 102, 241, 0.25)',
    nonNegTagBorder: '1px solid #6366F1',
    nonNegTagColor: '#EDE9FE',
    redFlagABg: '#241014',
    redFlagABorder: '1px solid #DC2626',
    redFlagATitle: '#FCA5A5',
    redFlagTagBg: 'rgba(239, 68, 68, 0.25)',
    redFlagTagBorder: '1px solid #EF4444',
    redFlagTagColor: '#FEE2E2',
    prefsBg: '#181B24',
    prefsBorder: '1px solid #475569',
    prefsTitle: '#94A3B8',
    prefsText: '#F1F5F9',
    metricsBg: 'rgba(0,0,0,0.25)',
    metricsBorder: '1px solid rgba(255,255,255,0.06)',
    metricsLabel: '#94A3B8',
    metricsValA: '#34D399',
    metricsValB: '#FBBF24',
    metricsValC: '#60A5FA',
    metricsValD: '#A78BFA',

    // Persona B
    cardBBg: '#0D1E16',
    cardBBorder: '1.5px solid #059669',
    badgeBBg: '#059669',
    badgeBColor: '#FFFFFF',
    nameBColor: '#FFFFFF',
    subBColor: '#6EE7B7',
    notesBBg: '#0B291D',
    notesBBorder: '1px solid #10B981',
    notesBTitle: '#6EE7B7',
    notesBText: '#FFFFFF',

    // Summary Bar
    summaryBg: '#161922',
    summaryBorder: '1px solid #334155',
    summaryLabel: '#94A3B8',
    summaryValGreen: '#34D399',
    summaryValBlue: '#60A5FA',
    summaryValPurple: '#A78BFA',
    summaryDesc: '#CBD5E1',

    // Tab 2 Dictamen
    whyBg: '#240F13',
    whyBorder: '2px solid #991B1B',
    whyTitle: '#FBBF24',
    whyText: '#FFFFFF',
    prosTitle: '#34D399',
    proCardBg: '#092015',
    proCardBorder: '1.5px solid #059669',
    proTitle: '#FFFFFF',
    proBadgeBg: 'rgba(16, 185, 129, 0.25)',
    proBadgeBorder: '1px solid #10B981',
    proBadgeColor: '#34D399',
    proDesc: '#E2E8F0',

    contrasTitle: '#F59E0B',
    contraCardBg: '#241608',
    contraCardBorder: '1.5px solid #D97706',
    contraTitle: '#FCD34D',
    contraBadgeBg: 'rgba(245, 158, 11, 0.25)',
    contraBadgeBorder: '1px solid #F59E0B',
    contraBadgeColor: '#FBBF24',
    contraDesc: '#FFFFFF',
    contraRecBg: 'rgba(245, 158, 11, 0.1)',
    contraRecBorder: '#F59E0B',
    contraRecTitle: '#FCD34D',
    contraRecText: '#FEF08A',

    questionsBg: '#13182B',
    questionsBorder: '1.5px solid #4F46E5',
    questionsTitle: '#A5B4FC',
    questionsText: '#FFFFFF',

    // Footer
    footerBorder: '1px solid rgba(255, 255, 255, 0.1)',
    btnGhostColor: '#CBD5E1',
    btnGhostBorder: '1px solid rgba(255, 255, 255, 0.2)',
    crmBtnColor: '#93C5FD',
    crmBtnBorder: '1px solid rgba(59, 130, 246, 0.4)',
    approveBtnBg: '#961500',
    approveBtnColor: '#FFFFFF',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: t.overlayBg,
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: 'clamp(8px, 2vw, 16px)',
        boxSizing: 'border-box'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: t.modalBg,
          border: t.modalBorder,
          borderRadius: 16,
          padding: 'clamp(14px, 2.5vw, 24px)',
          maxWidth: 1040,
          width: 'min(1040px, 98vw)',
          maxHeight: '94vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          boxShadow: t.modalShadow,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxSizing: 'border-box',
          transition: 'background-color 0.2s ease, color 0.2s ease'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: t.headerBorder,
          paddingBottom: 14,
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              color: t.headerBadgeColor,
              background: t.headerBadgeBg,
              border: t.headerBadgeBorder,
              padding: '4px 10px',
              borderRadius: 6,
              marginBottom: 8,
              letterSpacing: '0.04em'
            }}>
              🧠 EVALUACIÓN CLÍNICA DE MATCH & COMPARATIVA REAL
            </div>
            <h2 style={{ fontSize: 'clamp(18px, 2.5vw, 22px)', fontWeight: 800, margin: 0, color: t.titleColor, letterSpacing: '-0.02em' }}>
              {client.name} <span style={{ color: t.headerBadgeColor, margin: '0 4px' }}>×</span> {candidate.name}
            </h2>
            <div style={{ fontSize: 13, color: t.subtitleColor, marginTop: 6, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>📍 <b style={{ color: t.boldTextColor }}>{candidate.city}</b></span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>🎂 <b style={{ color: t.boldTextColor }}>{candidate.age ? `${candidate.age} años` : 'Edad no reg.'}</b></span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>💼 <b style={{ color: t.boldTextColor }}>{candidate.occupation && candidate.occupation !== 'No especificado' ? candidate.occupation : 'Ocupación no especificada'}</b></span>
              <a
                href={candidate.crm_url || (candidate.crm_id ? `https://dailylover.smartmatchapp.com/#!/client/${candidate.crm_id}/` : `https://dailylover.smartmatchapp.com/#!/clients?search=${encodeURIComponent(candidate.name)}`)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: t.crmLinkColor,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontWeight: 700,
                  textDecoration: 'underline'
                }}
              >
                Abrir en SmartMatchApp <ExternalLink size={13} />
              </a>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              background: candidate.compatibility_pct != null
                ? t.matchBadgeBg
                : (isLight ? '#F3F4F6' : 'rgba(156, 163, 175, 0.15)'),
              border: candidate.compatibility_pct != null
                ? t.matchBadgeBorder
                : (isLight ? '1.5px solid #9CA3AF' : '1px solid rgba(156, 163, 175, 0.3)'),
              color: candidate.compatibility_pct != null
                ? t.matchBadgeColor
                : (isLight ? '#4B5563' : '#9CA3AF'),
              fontWeight: 800,
              fontSize: 'clamp(13px, 1.8vw, 15px)',
              padding: '6px 14px',
              borderRadius: 24,
              boxShadow: candidate.compatibility_pct != null ? (isLight ? '0 2px 8px rgba(16, 185, 129, 0.15)' : '0 2px 10px rgba(16, 185, 129, 0.25)') : 'none'
            }}>
              {candidate.compatibility_pct != null
                ? `✨ ${candidate.compatibility_pct}% Match ${!candidate.datos_completos ? '(Parcial)' : ''}`
                : '⚠️ Sin datos suficientes'}
            </span>
            <button
              onClick={onClose}
              style={{
                background: t.closeBtnBg,
                border: t.closeBtnBorder,
                borderRadius: 8,
                color: t.closeBtnColor,
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0
              }}
              title="Cerrar modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* BANNER SUPERIOR: CUOTA Y CONSUMO DE CITAS DEL PLAN */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: 10,
          background: isLight ? '#F8FAFC' : 'rgba(255, 255, 255, 0.03)',
          border: `1px solid ${isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.08)'}`,
          borderRadius: 10,
          padding: '10px 14px',
          boxSizing: 'border-box'
        }}>
          {/* Persona A: Balance de Citas */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            background: isLight ? '#FFFFFF' : 'rgba(150, 21, 0, 0.08)',
            border: `1px solid ${isLight ? '#FEE2E2' : 'rgba(150, 21, 0, 0.2)'}`,
            borderRadius: 8,
            padding: '8px 12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{
                background: t.badgeABg,
                color: t.badgeAColor,
                fontSize: 10.5,
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: 4,
                flexShrink: 0
              }}>
                A: {client.name?.split(' ')[0]}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.nameAColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {client.plan_tier || 'Plan Estándar (2 citas)'}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span style={{
                fontSize: 11.5,
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 6,
                background: (client.dates_remaining ?? 1) > 0 ? (isLight ? '#DCFCE7' : 'rgba(34, 197, 94, 0.15)') : (isLight ? '#FEF3C7' : 'rgba(245, 158, 11, 0.15)'),
                color: (client.dates_remaining ?? 1) > 0 ? (isLight ? '#166534' : '#4ADE80') : (isLight ? '#92400E' : '#FBBF24'),
                border: `1px solid ${(client.dates_remaining ?? 1) > 0 ? (isLight ? '#86EFAC' : 'rgba(34, 197, 94, 0.3)') : (isLight ? '#FDE68A' : 'rgba(245, 158, 11, 0.3)')}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}>
                🎟️ {client.dates_used || 0} de {client.plan_total_dates || 2} citas realizadas
              </span>
              <div style={{ fontSize: 11, color: t.subtitleColor, marginTop: 2 }}>
                {(client.dates_remaining ?? 1) > 0 ? `Saldo: ${client.dates_remaining ?? 1} cita(s) disponible(s)` : '⚠️ Cupo completado'}
              </div>
            </div>
          </div>

          {/* Persona B: Balance de Citas */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            background: isLight ? '#FFFFFF' : 'rgba(16, 185, 129, 0.06)',
            border: `1px solid ${isLight ? '#DCFCE7' : 'rgba(16, 185, 129, 0.2)'}`,
            borderRadius: 8,
            padding: '8px 12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{
                background: t.badgeBBg,
                color: t.badgeBColor,
                fontSize: 10.5,
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: 4,
                flexShrink: 0
              }}>
                B: {candidate.name?.split(' ')[0]}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.nameBColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {candidate.plan_tier || 'Plan Estándar (2 citas)'}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span style={{
                fontSize: 11.5,
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 6,
                background: (candidate.dates_remaining ?? candidate.saldo_citas ?? 1) > 0 ? (isLight ? '#DCFCE7' : 'rgba(34, 197, 94, 0.15)') : (isLight ? '#FEF3C7' : 'rgba(245, 158, 11, 0.15)'),
                color: (candidate.dates_remaining ?? candidate.saldo_citas ?? 1) > 0 ? (isLight ? '#166534' : '#4ADE80') : (isLight ? '#92400E' : '#FBBF24'),
                border: `1px solid ${(candidate.dates_remaining ?? candidate.saldo_citas ?? 1) > 0 ? (isLight ? '#86EFAC' : 'rgba(34, 197, 94, 0.3)') : (isLight ? '#FDE68A' : 'rgba(245, 158, 11, 0.3)')}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}>
                🎟️ {candidate.dates_used || 0} de {candidate.plan_total_dates || 2} citas realizadas
              </span>
              <div style={{ fontSize: 11, color: t.subtitleColor, marginTop: 2 }}>
                {(candidate.dates_remaining ?? candidate.saldo_citas ?? 1) > 0 ? `Saldo: ${candidate.dates_remaining ?? candidate.saldo_citas ?? 1} cita(s) disponible(s)` : '⚠️ Cupo completado'}
              </div>
            </div>
          </div>
        </div>

        {/* Selector de Pestañas (Tabs) con scroll táctil */}
        <div style={{
          display: 'flex',
          gap: 8,
          borderBottom: t.tabBorder,
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          paddingBottom: 2,
          WebkitOverflowScrolling: 'touch'
        }}>
          <button
            onClick={() => setActiveTab('comparativa')}
            style={{
              padding: '9px clamp(12px, 2vw, 18px)',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeTab === 'comparativa' ? `3px solid ${t.tabActiveBorder}` : '3px solid transparent',
              background: activeTab === 'comparativa' ? t.tabActiveBg : 'transparent',
              color: activeTab === 'comparativa' ? t.tabActiveColor : t.tabInactiveColor,
              fontWeight: activeTab === 'comparativa' ? 800 : 600,
              fontSize: 'clamp(12px, 1.8vw, 14px)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease'
            }}
          >
            <FileText size={16} color={activeTab === 'comparativa' ? t.tabActiveBorder : t.tabInactiveColor} />
            📋 Ficha Comparativa A vs B (Notas Reales & Filtros)
          </button>

          <button
            onClick={() => setActiveTab('dictamen')}
            style={{
              padding: '9px clamp(12px, 2vw, 18px)',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeTab === 'dictamen' ? `3px solid ${t.tabActiveBorder}` : '3px solid transparent',
              background: activeTab === 'dictamen' ? t.tabActiveBg : 'transparent',
              color: activeTab === 'dictamen' ? t.tabActiveColor : t.tabInactiveColor,
              fontWeight: activeTab === 'dictamen' ? 800 : 600,
              fontSize: 'clamp(12px, 1.8vw, 14px)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease'
            }}
          >
            <Sparkles size={16} color={activeTab === 'dictamen' ? (isLight ? '#B45309' : '#F59E0B') : t.tabInactiveColor} />
            🧠 Dictamen Clínico & Pros / Contras
          </button>
        </div>

        {/* TAB 1: FICHA COMPARATIVA REAL (A vs B) */}
        {activeTab === 'comparativa' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Grid 2 Columnas Responsive: Persona A vs Persona B */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
              gap: 14,
              alignItems: 'start'
            }}>
              {/* COLUMNA PERSONA A (CLIENTE ENTREVISTADO) */}
              <div style={{
                background: t.cardABg,
                border: t.cardABorder,
                borderRadius: 12,
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxSizing: 'border-box'
              }}>
                {/* Header de Persona A */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: `1px solid ${isLight ? '#FECACA' : 'rgba(153, 27, 27, 0.5)'}`,
                  paddingBottom: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      background: t.badgeABg,
                      color: t.badgeAColor,
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 4
                    }}>
                      PERSONA A
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: t.nameAColor }}>
                      {client.name}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: t.subAColor, fontWeight: 700 }}>
                    Entrevistado
                  </span>
                </div>

                <div style={{ fontSize: 12, color: t.subtitleColor, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span>🎂 {client.age || '—'} años</span>
                  <span>💼 {client.occupation || 'Profesional'}</span>
                  <span>📏 {client.estatura || '178 cm'}</span>
                  <span>📍 {client.city}</span>
                </div>

                {/* Badge de Plan y Citas Persona A */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 12px',
                  borderRadius: 8,
                  background: isLight ? '#F8FAFC' : 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.08)'}`,
                  fontSize: 12,
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontWeight: 800, color: t.nameAColor }}>🎟️ Plan:</span>
                  <span style={{ color: t.titleColor, fontWeight: 700 }}>{client.plan_tier || 'Estándar'}</span>
                  <span style={{ color: t.subtitleColor }}>•</span>
                  <b style={{ color: (client.dates_remaining ?? 1) > 0 ? (isLight ? '#166534' : '#4ADE80') : (isLight ? '#92400E' : '#FBBF24') }}>
                    {client.dates_used || 0} de {client.plan_total_dates || 2} citas realizadas
                  </b>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: (client.dates_remaining ?? 1) > 0 ? (isLight ? '#DCFCE7' : 'rgba(34, 197, 94, 0.15)') : (isLight ? '#FEF3C7' : 'rgba(245, 158, 11, 0.15)'),
                    color: (client.dates_remaining ?? 1) > 0 ? (isLight ? '#166534' : '#4ADE80') : (isLight ? '#92400E' : '#FBBF24')
                  }}>
                    {(client.dates_remaining ?? 1) > 0 ? `${client.dates_remaining ?? 1} disp.` : 'Cumplido'}
                  </span>
                </div>

                {/* Notas Clínicas de Persona A */}
                <div style={{
                  background: t.notesABg,
                  border: t.notesABorder,
                  borderRadius: 8,
                  padding: '12px 14px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10
                  }}>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: t.notesATitle,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      📝 Ficha Clínica de Entrevista:
                    </div>
                    {clientSummary && (clientSummary.quien_es || clientSummary.que_busca || clientSummary.destaca) && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: isLight ? '#EFF6FF' : 'rgba(59, 130, 246, 0.2)',
                        color: isLight ? '#1D4ED8' : '#93C5FD',
                        border: isLight ? '1px solid #BFDBFE' : '1px solid rgba(59, 130, 246, 0.4)'
                      }}>
                        ✨ Síntesis IA
                      </span>
                    )}
                  </div>

                  {clientSummary && (clientSummary.quien_es || clientSummary.que_busca || clientSummary.destaca) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {clientSummary.quien_es && (
                        <div style={{
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: isLight ? '#F8FAFC' : 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.07)'}`,
                          fontSize: 12.5,
                          lineHeight: 1.45
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: isLight ? '#991B1B' : '#F87171', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>👤</span> <span>Quién es y estilo de vida:</span>
                          </div>
                          <div style={{ color: t.boldTextColor }}>{clientSummary.quien_es}</div>
                        </div>
                      )}
                      {clientSummary.que_busca && (
                        <div style={{
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: isLight ? '#F8FAFC' : 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.07)'}`,
                          fontSize: 12.5,
                          lineHeight: 1.45
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: isLight ? '#B45309' : '#FBBF24', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>🎯</span> <span>Qué busca en una pareja:</span>
                          </div>
                          <div style={{ color: t.boldTextColor }}>{clientSummary.que_busca}</div>
                        </div>
                      )}
                      {clientSummary.destaca && (
                        <div style={{
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: isLight ? '#F8FAFC' : 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.07)'}`,
                          fontSize: 12.5,
                          lineHeight: 1.45
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: isLight ? '#1D4ED8' : '#60A5FA', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>⭐</span> <span>Clave clínica de la psicóloga:</span>
                          </div>
                          <div style={{ color: t.boldTextColor }}>{clientSummary.destaca}</div>
                        </div>
                      )}

                      {/* Botón desplegable para ver notas completas */}
                      <button
                        type="button"
                        onClick={() => setShowFullNotesA(!showFullNotesA)}
                        style={{
                          marginTop: 4,
                          padding: '7px 10px',
                          borderRadius: 6,
                          border: `1px solid ${isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.1)'}`,
                          background: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.05)',
                          color: isLight ? '#475569' : '#94A3B8',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          📄 {showFullNotesA ? 'Ocultar notas completas' : `Ver notas completas de entrevista (${clientNotes.length.toLocaleString()} caracteres)`}
                        </span>
                        <span>{showFullNotesA ? '▴' : '▾'}</span>
                      </button>

                      {showFullNotesA && (
                        <div style={{ marginTop: 8 }}>
                          <ClinicalNotesViewer
                            notes={clientNotes}
                            isLight={isLight}
                            title="Notas Clínicas Completas"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <ClinicalNotesViewer
                      notes={clientNotes}
                      isLight={isLight}
                      title="Notas Clínicas de Entrevista & Restricciones"
                    />
                  )}
                </div>

                {/* Dealbreakers / No Negociables de Persona A */}
                <div style={{
                  background: t.nonNegABg,
                  border: t.nonNegABorder,
                  borderRadius: 8,
                  padding: '12px 14px'
                }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: t.nonNegATitle,
                    textTransform: 'uppercase',
                    marginBottom: 6,
                    letterSpacing: '0.04em'
                  }}>
                    🚫 Filtros No Negociables (Dealbreakers):
                  </div>
                  {clientNonNeg.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {clientNonNeg.map((nn, i) => (
                        <span key={i} style={{
                          fontSize: 12,
                          color: t.nonNegTagColor,
                          background: t.nonNegTagBg,
                          border: t.nonNegTagBorder,
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontWeight: 600
                        }}>
                          ✓ {typeof nn === 'string' ? nn : (nn.texto || nn.text || '')}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: t.subtitleColor }}>Sin dealbreakers específicos registrados</span>
                  )}
                </div>

                {/* Red Flags declaradas por Persona A */}
                {clientRedFlags.length > 0 && (
                  <div style={{
                    background: t.redFlagABg,
                    border: t.redFlagABorder,
                    borderRadius: 8,
                    padding: '10px 12px'
                  }}>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: t.redFlagATitle,
                      textTransform: 'uppercase',
                      marginBottom: 6
                    }}>
                      🚩 Banderas Rojas Declaradas:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {clientRedFlags.map((rf, i) => (
                        <span key={i} style={{
                          fontSize: 11,
                          color: t.redFlagTagColor,
                          background: t.redFlagTagBg,
                          border: t.redFlagTagBorder,
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontWeight: 600
                        }}>
                          ⚠️ {rf}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lo que Busca en Pareja */}
                <div style={{
                  background: t.prefsBg,
                  border: t.prefsBorder,
                  borderRadius: 8,
                  padding: '10px 12px'
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: t.prefsTitle, textTransform: 'uppercase', marginBottom: 6 }}>
                    🎯 Preferencias de Búsqueda:
                  </div>
                  <div style={{ fontSize: 12, color: t.prefsText, lineHeight: 1.5 }}>
                    <div>• <b>Rango de Edad:</b> {clientAgePref}</div>
                    <div>• <b>Estatura Deseada:</b> {clientHeightPref}</div>
                  </div>
                </div>

                {/* Métricas Psicográficas Persona A */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 8,
                  fontSize: 11,
                  background: t.metricsBg,
                  padding: 10,
                  borderRadius: 8,
                  border: t.metricsBorder
                }}>
                  <div>
                    <span style={{ color: t.metricsLabel }}>Estilo de Apego:</span>
                    <div style={{ fontWeight: 700, color: t.metricsValA, fontSize: 12 }}>
                      {client.attachment_style && client.attachment_style !== 'No especificado' ? client.attachment_style : 'Pendiente (F2)'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: t.metricsLabel }}>Lenguaje de Amor:</span>
                    <div style={{ fontWeight: 700, color: t.metricsValB, fontSize: 12 }}>
                      {client.love_language_given && client.love_language_given !== 'No especificado' ? client.love_language_given : 'Pendiente (F2)'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: t.metricsLabel }}>Grupo Social (GS):</span>
                    <div style={{ fontWeight: 700, color: t.metricsValC, fontSize: 12 }}>
                      {client.social_group_score != null ? `${client.social_group_score.toFixed(1)} / 10` : 'Pendiente (F2)'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: t.metricsLabel }}>Actividad Física:</span>
                    <div style={{ fontWeight: 700, color: t.metricsValD, fontSize: 12 }}>
                      {client.physical_activity_level != null ? `🏃 ${client.physical_activity_level} / 10` : '🏃 Pendiente (F2)'}
                    </div>
                  </div>
                </div>

                {/* BANNER DE ALERTA: RED FLAG DE SEGURIDAD (CERO TOLERANCIA) */}
                {((candidate.ai_red_flags_seguridad && candidate.ai_red_flags_seguridad.length > 0) ||
                  (candidate.comparison?.red_flags_seguridad && candidate.comparison.red_flags_seguridad.length > 0) ||
                  (candidate.dealbreakers_check && candidate.dealbreakers_check.includes('RED FLAG DE SEGURIDAD'))) && (
                  <div style={{
                    background: isLight ? '#FEF2F2' : 'rgba(239, 68, 68, 0.15)',
                    border: '2px solid #EF4444',
                    borderRadius: 10,
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    boxShadow: '0 2px 12px rgba(239, 68, 68, 0.2)'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: isLight ? '#B91C1C' : '#FCA5A5',
                      fontWeight: 800,
                      fontSize: 12.5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em'
                    }}>
                      <span style={{ fontSize: 18 }}>🚨</span> RED FLAG DE SEGURIDAD — MATCH DESCALIFICADO AUTOMÁTICAMENTE
                    </div>
                    <div style={{ color: isLight ? '#7F1D1D' : '#FEE2E2', fontSize: 12, lineHeight: 1.5 }}>
                      {(candidate.ai_red_flags_seguridad || candidate.comparison?.red_flags_seguridad || [candidate.dealbreakers_check]).map((rf, rIdx) => (
                        <div key={rIdx} style={{ fontWeight: 600 }}>• {rf}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ANÁLISIS DE LA IA: CRUCE CLÍNICO DE COMPATIBILIDAD */}
                <div style={{
                  background: isLight ? 'linear-gradient(135deg, #FFF7F7 0%, #FFFFFF 100%)' : 'rgba(150, 21, 0, 0.08)',
                  border: isLight ? '1.5px solid #FECACA' : '1px solid rgba(150, 21, 0, 0.3)',
                  borderRadius: 10,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  boxShadow: isLight ? '0 2px 10px rgba(150, 21, 0, 0.06)' : 'none'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: `1px solid ${isLight ? '#FEE2E2' : 'rgba(150, 21, 0, 0.2)'}`,
                    paddingBottom: 6
                  }}>
                    <div style={{
                      fontSize: 11.5,
                      fontWeight: 800,
                      color: isLight ? '#961500' : 'var(--color-primary-light)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      <Sparkles size={15} /> 🤖 Análisis IA: ¿Por qué son compatibles?
                    </div>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: isLight ? '#ECFDF5' : 'rgba(16, 185, 129, 0.2)',
                      color: isLight ? '#065F46' : '#34D399',
                      border: `1px solid ${isLight ? '#A7F3D0' : 'rgba(16, 185, 129, 0.4)'}`
                    }}>
                      {candidate.overall_match_score || 92}% Match Clínico
                    </span>
                  </div>

                  {/* Diagnóstico narrativo */}
                  <div style={{
                    fontSize: 12.5,
                    color: t.boldTextColor,
                    lineHeight: 1.55,
                    background: isLight ? '#FFFFFF' : 'rgba(0,0,0,0.25)',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: `1px solid ${isLight ? '#F1F5F9' : 'rgba(255,255,255,0.05)'}`
                  }}>
                    {analysis.why_ideal || `${candidate.name} y ${client.name} presentan una sinergia clínica excepcional al contrastar sus notas biográficas: coinciden en ritmo de vida independiente, afinidad por el bienestar físico y reciprocidad en un modelo de pareja equilibrado.`}
                  </div>

                  {/* Fortalezas clínicas clave */}
                  {pros.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 800, color: t.subtitleColor, textTransform: 'uppercase' }}>
                        Puntos Fuertes de Conexión según Notas:
                      </div>
                      {pros.slice(0, 3).map((pro, pIdx) => (
                        <div key={pIdx} style={{
                          fontSize: 12,
                          background: isLight ? '#F0FDF4' : 'rgba(16, 185, 129, 0.08)',
                          borderLeft: '3px solid #10B981',
                          padding: '6px 10px',
                          borderRadius: '0 6px 6px 0',
                          lineHeight: 1.45
                        }}>
                          <b style={{ color: isLight ? '#14532D' : '#4ADE80' }}>✓ {pro.titulo}:</b>{' '}
                          <span style={{ color: isLight ? '#334155' : 'var(--text-secondary)' }}>{pro.descripcion}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Punto de atención para la cita */}
                  {contras.length > 0 && (
                    <div style={{
                      fontSize: 11.5,
                      background: isLight ? '#FFFBEB' : 'rgba(245, 158, 11, 0.08)',
                      borderLeft: '3px solid #F59E0B',
                      padding: '6px 10px',
                      borderRadius: '0 6px 6px 0',
                      lineHeight: 1.45
                    }}>
                      <b style={{ color: isLight ? '#92400E' : '#FBBF24' }}>⚠️ Clave para la 1ra Cita:</b>{' '}
                      <span style={{ color: isLight ? '#451A03' : 'var(--text-secondary)' }}>{contras[0].recomendacion || contras[0].punto}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* COLUMNA PERSONA B (CANDIDATA SUGERIDA) */}
              <div style={{
                background: t.cardBBg,
                border: t.cardBBorder,
                borderRadius: 12,
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxSizing: 'border-box'
              }}>
                {/* Header de Persona B */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: `1px solid ${isLight ? '#BBF7D0' : 'rgba(5, 150, 105, 0.5)'}`,
                  paddingBottom: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      background: t.badgeBBg,
                      color: t.badgeBColor,
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 4
                    }}>
                      PERSONA B
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: t.nameBColor }}>
                      {candidate.name}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: t.subBColor, fontWeight: 700 }}>
                    Candidata Sugerida
                  </span>
                </div>

                <div style={{ fontSize: 12, color: t.subtitleColor, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span>🎂 {candidate.age ? `${candidate.age} años` : 'Edad no reg.'}</span>
                  <span>💼 {candidate.occupation && candidate.occupation !== 'No especificado' ? candidate.occupation : 'Ocupación no especificada'}</span>
                  <span>📏 {candidate.estatura || 'Estatura no reg.'}</span>
                  <span>📍 {candidate.city || 'Ciudad no reg.'}</span>
                </div>

                {/* Badge de Plan y Citas Persona B */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 12px',
                  borderRadius: 8,
                  background: isLight ? '#F8FAFC' : 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.08)'}`,
                  fontSize: 12,
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontWeight: 800, color: t.nameBColor }}>🎟️ Plan:</span>
                  <span style={{ color: t.titleColor, fontWeight: 700 }}>{candidate.plan_tier || 'Estándar'}</span>
                  <span style={{ color: t.subtitleColor }}>•</span>
                  <b style={{ color: (candidate.dates_remaining ?? candidate.saldo_citas ?? 1) > 0 ? (isLight ? '#166534' : '#4ADE80') : (isLight ? '#92400E' : '#FBBF24') }}>
                    {candidate.dates_used || 0} de {candidate.plan_total_dates || 2} citas realizadas
                  </b>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: (candidate.dates_remaining ?? candidate.saldo_citas ?? 1) > 0 ? (isLight ? '#DCFCE7' : 'rgba(34, 197, 94, 0.15)') : (isLight ? '#FEF3C7' : 'rgba(245, 158, 11, 0.15)'),
                    color: (candidate.dates_remaining ?? candidate.saldo_citas ?? 1) > 0 ? (isLight ? '#166534' : '#4ADE80') : (isLight ? '#92400E' : '#FBBF24')
                  }}>
                    {(candidate.dates_remaining ?? candidate.saldo_citas ?? 1) > 0 ? `${candidate.dates_remaining ?? candidate.saldo_citas ?? 1} disp.` : 'Cumplido'}
                  </span>
                </div>

                {/* Notas Clínicas de Persona B */}
                <div style={{
                  background: t.notesBBg,
                  border: t.notesBBorder,
                  borderRadius: 8,
                  padding: '12px 14px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10
                  }}>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: t.notesBTitle,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      📝 Ficha Clínica de Entrevista:
                    </div>
                    {candSummary && (candSummary.quien_es || candSummary.que_busca || candSummary.destaca) && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: isLight ? '#DCFCE7' : 'rgba(16, 185, 129, 0.2)',
                        color: isLight ? '#15803D' : '#86EFAC',
                        border: isLight ? '1px solid #BBF7D0' : '1px solid rgba(16, 185, 129, 0.4)'
                      }}>
                        ✨ Síntesis IA
                      </span>
                    )}
                  </div>

                  {candSummary && (candSummary.quien_es || candSummary.que_busca || candSummary.destaca) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {candSummary.quien_es && (
                        <div style={{
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: isLight ? '#F8FAFC' : 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.07)'}`,
                          fontSize: 12.5,
                          lineHeight: 1.45
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: isLight ? '#059669' : '#34D399', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>👤</span> <span>Quién es y estilo de vida:</span>
                          </div>
                          <div style={{ color: t.boldTextColor }}>{candSummary.quien_es}</div>
                        </div>
                      )}
                      {candSummary.que_busca && (
                        <div style={{
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: isLight ? '#F8FAFC' : 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.07)'}`,
                          fontSize: 12.5,
                          lineHeight: 1.45
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: isLight ? '#0D9488' : '#2DD4BF', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>🎯</span> <span>Qué busca en una pareja:</span>
                          </div>
                          <div style={{ color: t.boldTextColor }}>{candSummary.que_busca}</div>
                        </div>
                      )}
                      {candSummary.destaca && (
                        <div style={{
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: isLight ? '#F8FAFC' : 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.07)'}`,
                          fontSize: 12.5,
                          lineHeight: 1.45
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: isLight ? '#7C3AED' : '#A78BFA', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>⭐</span> <span>Clave clínica de la psicóloga:</span>
                          </div>
                          <div style={{ color: t.boldTextColor }}>{candSummary.destaca}</div>
                        </div>
                      )}

                      {/* Botón desplegable para ver notas completas */}
                      <button
                        type="button"
                        onClick={() => setShowFullNotesB(!showFullNotesB)}
                        style={{
                          marginTop: 4,
                          padding: '7px 10px',
                          borderRadius: 6,
                          border: `1px solid ${isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.1)'}`,
                          background: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.05)',
                          color: isLight ? '#475569' : '#94A3B8',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          📄 {showFullNotesB ? 'Ocultar notas completas' : `Ver notas completas de entrevista (${candidateNotes.length.toLocaleString()} caracteres)`}
                        </span>
                        <span>{showFullNotesB ? '▴' : '▾'}</span>
                      </button>

                      {showFullNotesB && (
                        <div style={{ marginTop: 8 }}>
                          <ClinicalNotesViewer
                            notes={candidateNotes}
                            isLight={isLight}
                            title="Notas Clínicas Completas"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <ClinicalNotesViewer
                      notes={candidateNotes}
                      isLight={isLight}
                      title="Notas Clínicas de Entrevista & Bio"
                    />
                  )}
                </div>

                {/* Dealbreakers / No Negociables de Persona B */}
                <div style={{
                  background: t.nonNegABg,
                  border: t.nonNegABorder,
                  borderRadius: 8,
                  padding: '12px 14px'
                }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: t.nonNegATitle,
                    textTransform: 'uppercase',
                    marginBottom: 6,
                    letterSpacing: '0.04em'
                  }}>
                    🚫 Filtros No Negociables (Dealbreakers):
                  </div>
                  {candNonNeg.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {candNonNeg.map((nn, i) => (
                        <span key={i} style={{
                          fontSize: 12,
                          color: t.nonNegTagColor,
                          background: t.nonNegTagBg,
                          border: t.nonNegTagBorder,
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontWeight: 600
                        }}>
                          ✓ {typeof nn === 'string' ? nn : (nn.texto || nn.text || '')}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: t.subtitleColor }}>Cumple criterios generales de admisión</span>
                  )}
                </div>

                {/* Red Flags declaradas por Persona B */}
                {candRedFlags.length > 0 && (
                  <div style={{
                    background: t.redFlagABg,
                    border: t.redFlagABorder,
                    borderRadius: 8,
                    padding: '10px 12px'
                  }}>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: t.redFlagATitle,
                      textTransform: 'uppercase',
                      marginBottom: 6
                    }}>
                      🚩 Banderas Rojas Declaradas:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {candRedFlags.map((rf, i) => (
                        <span key={i} style={{
                          fontSize: 11,
                          color: t.redFlagTagColor,
                          background: t.redFlagTagBg,
                          border: t.redFlagTagBorder,
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontWeight: 600
                        }}>
                          ⚠️ {rf}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lo que Busca en Pareja */}
                <div style={{
                  background: t.prefsBg,
                  border: t.prefsBorder,
                  borderRadius: 8,
                  padding: '10px 12px'
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: t.prefsTitle, textTransform: 'uppercase', marginBottom: 6 }}>
                    🎯 Preferencias de Búsqueda:
                  </div>
                  <div style={{ fontSize: 12, color: t.prefsText, lineHeight: 1.5 }}>
                    <div>• <b>Rango de Edad:</b> {candAgePref}</div>
                    <div>• <b>Estatura Deseada:</b> {candHeightPref}</div>
                  </div>
                </div>

                {/* Métricas Psicográficas Persona B */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 8,
                  fontSize: 11,
                  background: t.metricsBg,
                  padding: 10,
                  borderRadius: 8,
                  border: t.metricsBorder
                }}>
                  <div>
                    <span style={{ color: t.metricsLabel }}>Estilo de Apego:</span>
                    <div style={{ fontWeight: 700, color: t.metricsValA, fontSize: 12 }}>
                      {candidate.attachment_style && candidate.attachment_style !== 'No especificado' ? candidate.attachment_style : 'Pendiente (F2)'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: t.metricsLabel }}>Lenguaje de Amor:</span>
                    <div style={{ fontWeight: 700, color: t.metricsValB, fontSize: 12 }}>
                      {candidate.love_language && candidate.love_language !== 'No especificado' ? candidate.love_language : 'Pendiente (F2)'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: t.metricsLabel }}>Grupo Social (GS):</span>
                    <div style={{ fontWeight: 700, color: t.metricsValC, fontSize: 12 }}>
                      {candidate.social_group_score != null ? `${candidate.social_group_score.toFixed(1)} / 10` : 'Pendiente (F2)'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: t.metricsLabel }}>Actividad Física:</span>
                    <div style={{ fontWeight: 700, color: t.metricsValD, fontSize: 12 }}>
                      {candidate.physical_activity_level != null ? `🏃 ${candidate.physical_activity_level} / 10` : '🏃 Pendiente (F2)'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Matriz de Cruce Clínico Rápido (Bottom Summary Cards) */}
            <div style={{
              background: t.summaryBg,
              border: t.summaryBorder,
              borderRadius: 10,
              padding: '12px 14px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
              gap: 10
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.summaryLabel, textTransform: 'uppercase' }}>
                  🎯 CRUCE DE EDAD
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.summaryValGreen, marginTop: 2 }}>
                  {client.age && candidate.age ? `✓ ${client.age} vs ${candidate.age} años` : (candidate.age ? `Candidata: ${candidate.age} años` : 'Edad pendiente')}
                </div>
                <div style={{ fontSize: 11, color: t.summaryDesc, marginTop: 2 }}>
                  {candidate.age ? (client.search_preferences?.min_age ? `Preferencia: ${client.search_preferences.min_age}-${client.search_preferences.max_age} años` : 'En rango de búsqueda') : 'Pendiente de confirmación'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.summaryLabel, textTransform: 'uppercase' }}>
                  📏 CRUCE DE ESTATURA
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.summaryValGreen, marginTop: 2 }}>
                  {client.estatura && candidate.estatura ? `✓ ${client.estatura} vs ${candidate.estatura}` : (candidate.estatura ? `Candidata: ${candidate.estatura}` : 'Estatura no especificada')}
                </div>
                <div style={{ fontSize: 11, color: t.summaryDesc, marginTop: 2 }}>
                  {candidate.estatura ? 'Estatura armónica en pareja' : 'Pendiente de registrar'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.summaryLabel, textTransform: 'uppercase' }}>
                  🏛️ GRUPO SOCIAL
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.summaryValBlue, marginTop: 2 }}>
                  {hasBothSg ? `Δ ${sgDiff} pts (GS ${candidate.social_group_score?.toFixed(1)} vs ${client.social_group_score?.toFixed(1)})` : (candidate.social_group_score != null ? `GS ${candidate.social_group_score.toFixed(1)} / 10` : 'Pendiente F2')}
                </div>
                <div style={{ fontSize: 11, color: t.summaryDesc, marginTop: 2 }}>
                  {hasBothSg ? 'Afinidad sociocultural evaluada' : 'Pendiente de calificación clínica'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.summaryLabel, textTransform: 'uppercase' }}>
                  🏃 RITMO DE VIDA
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.summaryValPurple, marginTop: 2 }}>
                  {client.physical_activity_level != null && candidate.physical_activity_level != null
                    ? `${candidate.physical_activity_level}/10 vs ${client.physical_activity_level}/10`
                    : (candidate.physical_activity_level != null ? `🏃 ${candidate.physical_activity_level}/10` : '🏃 Pendiente F2')}
                </div>
                <div style={{ fontSize: 11, color: t.summaryDesc, marginTop: 2 }}>
                  {candidate.physical_activity_level != null ? 'Sincronía en hábitos saludables' : 'Hábitos deportivos no registrados'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DICTAMEN CLÍNICO & PROS / CONTRAS */}
        {activeTab === 'dictamen' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Sección: ¿Por qué es la pareja ideal? */}
            <div style={{
              background: t.whyBg,
              border: t.whyBorder,
              borderRadius: 12,
              padding: '16px 20px',
              boxShadow: isLight ? '0 4px 14px rgba(244, 63, 94, 0.08)' : '0 4px 16px rgba(153, 27, 27, 0.25)'
            }}>
              <div style={{
                fontSize: 14,
                fontWeight: 800,
                color: t.whyTitle,
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                letterSpacing: '0.02em',
                textTransform: 'uppercase'
              }}>
                <Sparkles size={18} color={t.whyTitle} />
                ¿Por qué sería la persona ideal para {client.name.split(' ')[0]}?
              </div>
              <p style={{
                fontSize: 14,
                color: t.whyText,
                lineHeight: 1.65,
                margin: 0,
                fontWeight: 500
              }}>
                {analysis.why_ideal || candidate.synthesis || 'Candidata con alta afinidad en estilo de vida y perfil sociocultural.'}
              </p>
            </div>

            {/* Sección: Pros Clínicos (A Favor) */}
            <div>
              <div style={{
                fontSize: 13,
                fontWeight: 800,
                color: t.prosTitle,
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.03em'
              }}>
                <CheckCircle2 size={18} color={t.prosTitle} />
                🟢 Pros Clínicos & Fortalezas de Compatibilidad ({pros.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
                {pros.map((pro, pIdx) => (
                  <div
                    key={pIdx}
                    style={{
                      background: t.proCardBg,
                      border: t.proCardBorder,
                      borderRadius: 10,
                      padding: '14px 16px',
                      boxShadow: isLight ? '0 2px 8px rgba(16, 185, 129, 0.08)' : '0 4px 12px rgba(5, 150, 105, 0.15)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: t.proTitle }}>
                        ✓ {pro.titulo}
                      </span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: t.proBadgeBg,
                        border: t.proBadgeBorder,
                        color: t.proBadgeColor
                      }}>
                        {pro.categoria}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: t.proDesc, margin: '4px 0 0', lineHeight: 1.55 }}>
                      {pro.descripcion}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Sección: Contras / Puntos a Revisar por la Psicóloga */}
            <div>
              <div style={{
                fontSize: 13,
                fontWeight: 800,
                color: t.contrasTitle,
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.03em'
              }}>
                <AlertTriangle size={18} color={t.contrasTitle} />
                ⚠️ Contras & Puntos de Atención a Revisar por la Psicóloga ({contras.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
                {contras.map((contra, cIdx) => (
                  <div
                    key={cIdx}
                    style={{
                      background: t.contraCardBg,
                      border: t.contraCardBorder,
                      borderRadius: 10,
                      padding: '14px 16px',
                      boxShadow: isLight ? '0 2px 8px rgba(245, 158, 11, 0.08)' : '0 4px 12px rgba(217, 119, 6, 0.18)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: t.contraTitle }}>
                        ⚠️ {contra.punto}
                      </span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: t.contraBadgeBg,
                        border: t.contraBadgeBorder,
                        color: t.contraBadgeColor
                      }}>
                        {contra.categoria}
                      </span>
                    </div>
                    <div style={{
                      background: t.contraRecBg,
                      borderLeft: `3px solid ${t.contraRecBorder}`,
                      padding: '8px 12px',
                      borderRadius: '0 6px 6px 0',
                      marginTop: 8,
                      fontSize: 13,
                      lineHeight: 1.5
                    }}>
                      <b style={{ color: t.contraRecTitle }}>Recomendación clínica:</b>{' '}
                      <span style={{ color: t.contraRecText }}>{contra.recomendacion}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sección: Preguntas Clave Sugeridas para la Psicóloga */}
            {keyQuestions.length > 0 && (
              <div style={{
                background: t.questionsBg,
                border: t.questionsBorder,
                borderRadius: 10,
                padding: '16px 18px',
                boxShadow: isLight ? '0 2px 8px rgba(99, 102, 241, 0.08)' : '0 4px 12px rgba(79, 70, 229, 0.2)'
              }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: t.questionsTitle,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  letterSpacing: '0.04em'
                }}>
                  <ShieldCheck size={16} color={t.questionsTitle} /> Preguntas Clave Sugeridas para Validar en la Llamada / Entrevista
                </div>
                <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: t.questionsText, lineHeight: 1.6 }}>
                  {keyQuestions.map((q, qIdx) => (
                    <li key={qIdx} style={{ marginBottom: 6 }}>
                      <span style={{ fontWeight: 600 }}>"{q}"</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* COPILOTO CLÍNICO DE PAREJA (CHATBOT EXCLUSIVO PERSONA A × PERSONA B)     */}
        {/* ========================================================================= */}
        <div style={{
          background: isLight ? '#FFFFFF' : '#141824',
          border: isLight ? '1.5px solid rgba(150, 21, 0, 0.25)' : '1px solid rgba(150, 21, 0, 0.4)',
          borderRadius: 14,
          padding: '14px 16px',
          boxShadow: isLight ? '0 4px 20px rgba(150, 21, 0, 0.08)' : '0 4px 24px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          transition: 'all 0.25s ease'
        }}>
          {/* Header del Copiloto */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              cursor: 'pointer'
            }}
            onClick={() => setChatOpen(!chatOpen)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #961500 0%, #c41a00 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(150, 21, 0, 0.3)'
              }}>
                <Bot size={18} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: t.titleColor, letterSpacing: '-0.01em' }}>
                    💬 Copiloto Clínico IA: {client.name} <span style={{ color: '#961500' }}>×</span> {candidate.name}
                  </span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: isLight ? '#ECFDF5' : 'rgba(16, 185, 129, 0.15)',
                    color: isLight ? '#065F46' : '#34D399',
                    border: `1px solid ${isLight ? '#A7F3D0' : 'rgba(16, 185, 129, 0.3)'}`
                  }}>
                    ⚡ En Vivo (Cero Alucinaciones)
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: t.subtitleColor, marginTop: 1 }}>
                  Pregúntale a la IA sobre afinidades, notas clínicas, dealbreakers o dudas para la primera cita
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {chatMessages.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setChatMessages([])
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: t.subtitleColor,
                    cursor: 'pointer',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    borderRadius: 6
                  }}
                  title="Limpiar conversación"
                >
                  <Trash2 size={13} /> Limpiar
                </button>
              )}
              <button
                type="button"
                style={{
                  background: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 8px',
                  color: t.titleColor,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600
                }}
              >
                {chatOpen ? <><ChevronUp size={14} /> Minimizar</> : <><ChevronDown size={14} /> Expandir</>}
              </button>
            </div>
          </div>

          {/* Cuerpo del Copiloto (si está abierto) */}
          {chatOpen && (
            <>
              {/* Botones de Preguntas Rápidas (Chips a 1 Clic) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                overflowX: 'auto',
                paddingBottom: 4,
                scrollbarWidth: 'none'
              }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: t.subtitleColor, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
                  Sugerencias:
                </span>
                {QUICK_QUESTIONS.map((item, qIdx) => (
                  <button
                    key={qIdx}
                    type="button"
                    disabled={chatLoading}
                    onClick={() => handleSendQuestion(item.q)}
                    style={{
                      background: isLight ? '#F8FAFC' : 'rgba(255, 255, 255, 0.05)',
                      border: isLight ? '1px solid #E2E8F0' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 16,
                      padding: '4px 10px',
                      fontSize: 11,
                      color: t.titleColor,
                      cursor: chatLoading ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.15s ease',
                      opacity: chatLoading ? 0.6 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!chatLoading) {
                        e.currentTarget.style.borderColor = '#961500'
                        e.currentTarget.style.background = isLight ? '#FFF5F5' : 'rgba(150, 21, 0, 0.15)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.1)'
                      e.currentTarget.style.background = isLight ? '#F8FAFC' : 'rgba(255, 255, 255, 0.05)'
                    }}
                  >
                    <span>{item.icon}</span> {item.label}
                  </button>
                ))}
              </div>

              {/* Área de Mensajes del Chat */}
              <div style={{
                background: isLight ? '#F8FAFC' : 'rgba(0, 0, 0, 0.25)',
                border: isLight ? '1px solid #E2E8F0' : '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 10,
                padding: '12px 14px',
                minHeight: 110,
                maxHeight: 250,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}>
                {/* Mensaje de bienvenida inicial si no hay mensajes */}
                {chatMessages.length === 0 && (
                  <div style={{
                    fontSize: 12,
                    color: t.subtitleColor,
                    lineHeight: 1.5,
                    padding: '8px 10px',
                    background: isLight ? '#FFFFFF' : 'rgba(255, 255, 255, 0.03)',
                    borderRadius: 8,
                    borderLeft: '3px solid #961500'
                  }}>
                    👋 <b>Copiloto Clínico listo:</b> Puedes escribir cualquier consulta sobre <b>{client.name}</b> y <b>{candidate.name}</b> o pulsar uno de los botones rápidos de arriba. El modelo responderá analizando únicamente sus notas clínicas sin inventar datos no registrados.
                  </div>
                )}

                {/* Lista de mensajes */}
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '100%'
                    }}
                  >
                    <div style={{
                      maxWidth: '85%',
                      padding: '8px 12px',
                      borderRadius: msg.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      background: msg.sender === 'user'
                        ? 'linear-gradient(135deg, #961500 0%, #b81a00 100%)'
                        : (isLight ? '#FFFFFF' : '#1A202C'),
                      color: msg.sender === 'user' ? '#FFFFFF' : (isLight ? '#0F172A' : '#F1F5F9'),
                      border: msg.sender === 'user'
                        ? 'none'
                        : (isLight ? '1px solid #E2E8F0' : '1px solid rgba(255, 255, 255, 0.1)'),
                      borderLeft: msg.sender === 'ai' ? `3px solid ${msg.isError ? '#EF4444' : '#10B981'}` : undefined,
                      fontSize: 12.5,
                      lineHeight: 1.5,
                      boxShadow: isLight ? '0 1px 4px rgba(0, 0, 0, 0.05)' : '0 2px 8px rgba(0, 0, 0, 0.2)',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {msg.text}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 3,
                      fontSize: 10,
                      color: t.subtitleColor,
                      padding: '0 4px'
                    }}>
                      <span>{msg.time}</span>
                      {msg.sender === 'ai' && msg.model && (
                        <span>• ⚡ {((msg.responseTimeMs || 0) / 1000).toFixed(1)}s ({msg.model.replace('models/', '')})</span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {chatLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px' }}>
                    <div style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      border: '2px solid rgba(150, 21, 0, 0.2)',
                      borderTopColor: '#961500',
                      animation: 'spin 0.8s linear infinite'
                    }} />
                    <span style={{ fontSize: 11.5, color: t.subtitleColor, fontStyle: 'italic' }}>
                      Analizando notas clínicas de {client.name} y {candidate.name}...
                    </span>
                  </div>
                )}
                <div ref={chatMessagesEndRef} />
              </div>

              {/* Input y Botón de Envío */}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSendQuestion(chatInput)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={`Pregunta sobre esta pareja (ej: ¿qué valores comparten?, ¿qué red flags tienen?)...`}
                  disabled={chatLoading}
                  style={{
                    flex: 1,
                    background: isLight ? '#FFFFFF' : '#0D0A0B',
                    border: isLight ? '1px solid #CBD5E1' : '1px solid rgba(150, 21, 0, 0.3)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 12.5,
                    color: t.titleColor,
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#961500'}
                  onBlur={(e) => e.target.style.borderColor = isLight ? '#CBD5E1' : 'rgba(150, 21, 0, 0.3)'}
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  style={{
                    background: (!chatInput.trim() || chatLoading) ? (isLight ? '#E2E8F0' : '#2A2022') : '#961500',
                    color: (!chatInput.trim() || chatLoading) ? (isLight ? '#94A3B8' : '#6B5A5D') : '#FFFFFF',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: (!chatInput.trim() || chatLoading) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s ease',
                    boxShadow: (!chatInput.trim() || chatLoading) ? 'none' : '0 2px 8px rgba(150, 21, 0, 0.3)'
                  }}
                >
                  <Send size={13} /> Preguntar
                </button>
              </form>
            </>
          )}
        </div>

        {/* Botones de Pie */}
        <div style={{
          borderTop: t.footerBorder,
          paddingTop: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            style={{ color: t.btnGhostColor, borderColor: t.btnGhostBorder }}
          >
            Cerrar Análisis
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <a
              href={candidate.crm_url || (candidate.crm_id ? `https://dailylover.smartmatchapp.com/#!/client/${candidate.crm_id}/` : `https://dailylover.smartmatchapp.com/#!/clients?search=${encodeURIComponent(candidate.name)}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.crmBtnColor, borderColor: t.crmBtnBorder }}
            >
              Abrir CRM <ExternalLink size={14} />
            </a>

            <button
              className="btn btn-primary"
              onClick={() => {
                onClose()
                onApprove(candidate)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                boxShadow: isLight ? '0 4px 14px rgba(150, 21, 0, 0.25)' : '0 4px 14px rgba(150, 21, 0, 0.5)'
              }}
            >
              <Heart size={15} fill="#fff" /> ✨ Proceder a Aprobar este Match
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
