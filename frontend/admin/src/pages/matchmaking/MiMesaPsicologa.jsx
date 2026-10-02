import React, { useState, useEffect, useCallback } from 'react'
import { 
  Heart, User, Sparkles, CheckCircle, Clock, MapPin, Briefcase, 
  Search, RefreshCw, X, Check, Undo2, AlertTriangle, ChevronRight,
  Eye, Calendar, MessageSquare, Flame, ShieldAlert, Award
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import CrmPersonLink from '../../components/CrmPersonLink'
import UserAvatar from '../../components/UserAvatar'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) 
  ? window.location.origin 
  : 'https://daily-lover.agentesia.cloud'

const PSYCHOLOGISTS = [
  'SILVI', 'JENN', 'ANA', 'STEFFY', 'ISA', 'PIA', 'MAPE D', 'MPS'
]

const DISCARD_REASONS = [
  { id: 'Físico', label: 'Físico' },
  { id: 'Estilo de vida', label: 'Estilo de vida' },
  { id: 'Edad', label: 'Edad' },
  { id: 'Valores / Proyecto', label: 'Valores / Proyecto' },
  { id: 'Ya se conocen', label: 'Ya se conocen' },
  { id: 'Otro', label: 'Otro' }
]

export default function MiMesaPsicologa() {
  const { token, user } = useAuth()

  // Detección de rol y psicóloga
  const userRole = (user?.role || '').trim()
  const userName = (user?.name || '').trim().toUpperCase()
  const isAdmin = userRole === 'Admin' || userRole === 'Super Admin' || userName.includes('ADMIN') || user?.email?.includes('admin')

  // Psicóloga predeterminada según usuario logueado
  const getInitialPsyc = () => {
    for (const p of PSYCHOLOGISTS) {
      if (userName.includes(p)) return p
    }
    if (userName.includes('SILVANA') || userName.includes('SILVIA')) return 'SILVI'
    if (userName.includes('JENNIFER')) return 'JENN'
    if (userName.includes('STEPHANIE') || userName.includes('TEFFY')) return 'STEFFY'
    if (userName.includes('ISABELA') || userName.includes('ISABELLA')) return 'ISA'
    if (userName.includes('MARIA PAULA SALINAS') || userName.includes('MARÍA PAULA SALINAS')) return 'MPS'
    if (userName.includes('DE LA ESPRIELLA') || userName.includes('MAPE')) return 'MAPE D'
    return 'SILVI'
  }

  const [currentPsyc, setCurrentPsyc] = useState(getInitialPsyc())
  const [activeTab, setActiveTab] = useState('por_proponer') // 'por_proponer', 'en_revision', 'aprobados', 'rechazados'
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ por_proponer: [], en_revision: [], aprobados: [], rechazados: [], troublemakers: [], summary: {} })
  const [notification, setNotification] = useState('')

  // Panel "Proponer match"
  const [proposingClient, setProposingClient] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [candidatesError, setCandidatesError] = useState(null)
  const [expandedCandidateId, setExpandedCandidateId] = useState(null)

  // Modal Elegir (confirmación con nota opcional para María)
  const [choosingCandidate, setChoosingCandidate] = useState(null)
  const [proposalNote, setProposalNote] = useState('')
  const [manualB, setManualB] = useState({})   // Persona B puesta a mano, por fila
  const [submittingProposal, setSubmittingProposal] = useState(false)

  // Modal Descartar (1 clic obligatorio de 30 días)
  const [discardingCandidate, setDiscardingCandidate] = useState(null)
  const [selectedDiscardReason, setSelectedDiscardReason] = useState('')
  const [discardNotes, setDiscardNotes] = useState('')
  const [submittingDiscard, setSubmittingDiscard] = useState(false)

  // 1. Cargar mesa de psicóloga (3 bandejas)
  const fetchMesa = useCallback(() => {
    if (!token) return
    setLoading(true)
    let url = `${API}/api/v1/matchmaking/mesa-psicologa?psychologist=${encodeURIComponent(currentPsyc)}`
    if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`

    fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(res => {
        setData(res || { por_proponer: [], en_revision: [], aprobados: [], rechazados: [], troublemakers: [], summary: {} })
        setLoading(false)
      })
      .catch(err => {
        console.error('Error cargando mesa de psicóloga:', err)
        setData({ por_proponer: [], en_revision: [], aprobados: [], rechazados: [], troublemakers: [], summary: {} })
        setLoading(false)
      })
  }, [currentPsyc, searchTerm, token])

  useEffect(() => {
    fetchMesa()
  }, [fetchMesa])

  // 2. Abrir panel "Proponer match": busca 3 a 5 candidatas filtradas por el motor
  const handleOpenProponer = (clientRow) => {
    setProposingClient(clientRow)
    setCandidates([])
    setCandidatesError(null)
    setLoadingCandidates(true)
    setExpandedCandidateId(null)

    const cId = clientRow.user_id_a || clientRow.person_a_crm_id || clientRow.person_a
    const url = `${API}/api/v1/matchmaking/candidate-matches-engine?client_id=${encodeURIComponent(cId)}&limit=5`

    fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(async r => {
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}))
          throw new Error(errData.detail || `Error ${r.status}: No se pudo consultar el motor de candidatas`)
        }
        return r.json()
      })
      .then(res => {
        const list = res.candidates || res.suggested_matches || res.viable_matches || []
        setCandidates(list.slice(0, 5))
        setLoadingCandidates(false)
      })
      .catch(err => {
        console.error('Error obteniendo candidatas del motor:', err)
        setCandidatesError(err.message || 'Error de conexión con el motor de matching')
        setCandidates([])
        setLoadingCandidates(false)
      })
  }

  // Persona B puesta a mano (URL del CRM o nombre) -> se envía a María igual que una candidata del motor
  const setMB = (id, patch) => setManualB(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }))

  const SLOT_ESTADO = {
    rojo: { label: 'Not approved', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.10)' },
    amarillo: { label: 'En proceso', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.10)' },
    verde: { label: 'Listo para cita', color: '#10B981', bg: 'rgba(16, 185, 129, 0.10)' }
  }

  const buscarPersonaB = async (row, key) => {
    const q = (manualB[key]?.text || '').trim()
    if (q.length < 3) return
    setMB(key, { loading: true, error: '', found: null })
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/resolve-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ url_or_query: q })
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.found && d.user_id) {
        if (d.user_id === row.user_id_a) setMB(key, { loading: false, error: 'Esa es la misma persona que la Persona A.' })
        else if ((row.slots_detalle || []).some(s => s.user_id_b === d.user_id && s.estado !== 'rojo')) setMB(key, { loading: false, error: 'Esa persona ya está en otro slot de este cliente.' })
        else setMB(key, { loading: false, found: d })
      } else if (res.ok && d.found) {
        setMB(key, { loading: false, error: 'Esa persona no está registrada como usuaria del sistema.' })
      } else {
        setMB(key, { loading: false, error: 'No se encontró. Pega la URL del CRM o escribe el nombre completo.' })
      }
    } catch (e) {
      setMB(key, { loading: false, error: 'Error de conexión.' })
    }
  }

  const enviarPersonaB = async (row, key) => {
    const f = manualB[key]?.found
    if (!f) return
    setMB(key, { sending: true, error: '' })
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/propose-candidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          match_id: row.id,
          candidate_user_id: f.user_id,
          candidate_name: f.name,
          candidate_crm_id: f.crm_id || '',
          notes: 'Persona B elegida a mano por la psicóloga'
        })
      })
      if (res.ok) {
        setNotification(`Propuesta enviada a María: ${row.person_a} x ${f.name}`)
        setTimeout(() => setNotification(''), 6000)
        setManualB(prev => { const n = { ...prev }; delete n[key]; return n })
        fetchMesa()
      } else {
        const err = await res.json().catch(() => ({}))
        setMB(key, { sending: false, error: err.detail || 'No se pudo enviar la propuesta.' })
      }
    } catch (e) {
      setMB(key, { sending: false, error: 'Error de conexión.' })
    }
  }

  // 3. Confirmar "Elegir" candidata -> Enviar propuesta a María
  const handleConfirmChoose = async () => {
    if (!proposingClient || !choosingCandidate) return
    setSubmittingProposal(true)
    try {
      const payload = {
        match_id: proposingClient.id,
        candidate_user_id: choosingCandidate.user_id,
        candidate_name: choosingCandidate.name,
        candidate_crm_id: choosingCandidate.crm_id || '',
        notes: proposalNote.trim() || undefined,
        compatibility_score: choosingCandidate.score || choosingCandidate.compatibility_pct,
        compatibility_verdict: choosingCandidate.veredicto,
        analysis: choosingCandidate.decision_trace || choosingCandidate.match_analysis || null
      }

      const res = await fetch(`${API}/api/v1/matchmaking/matches/propose-candidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        setNotification(`✓ Propuesta enviada a María: ${proposingClient.person_a} x ${choosingCandidate.name}`)
        setTimeout(() => setNotification(''), 6000)
        setChoosingCandidate(null)
        setProposalNote('')
        setProposingClient(null)
        fetchMesa()
        setActiveTab('en_revision')
      } else {
        const err = await res.json()
        alert(`Error al enviar propuesta: ${err.detail || 'Operación no completada'}`)
      }
    } catch (e) {
      alert('Error de conexión al enviar la propuesta.')
    } finally {
      setSubmittingProposal(false)
    }
  }

  // 4. Confirmar "Descartar" candidata -> Guarda en match_discards por 30 días
  const handleConfirmDiscard = async () => {
    if (!proposingClient || !discardingCandidate || !selectedDiscardReason) {
      alert('Por favor selecciona un motivo de descarte.')
      return
    }
    setSubmittingDiscard(true)
    try {
      const payload = {
        match_id: proposingClient.id,
        person_a: proposingClient.person_a,
        person_b: discardingCandidate.name,
        user_id_a: proposingClient.user_id_a || null,
        user_id_b: discardingCandidate.user_id || null,
        psychologist_name: currentPsyc,
        discard_reason: selectedDiscardReason,
        discard_notes: discardNotes.trim() || undefined
      }

      const res = await fetch(`${API}/api/v1/matchmaking/matches/discard-candidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        // Remover candidata de la lista en vivo
        setCandidates(prev => prev.filter(c => c.user_id !== discardingCandidate.user_id))
        setNotification(`Candidata ${discardingCandidate.name} descartada (${selectedDiscardReason}) — no se mostrará por 30 días.`)
        setTimeout(() => setNotification(''), 5000)
        setDiscardingCandidate(null)
        setSelectedDiscardReason('')
        setDiscardNotes('')
      } else {
        const err = await res.json()
        alert(`Error al descartar candidata: ${err.detail || 'Operación no completada'}`)
      }
    } catch (e) {
      alert('Error de conexión al descartar candidata.')
    } finally {
      setSubmittingDiscard(false)
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', minHeight: '85vh' }}>
      {/* Encabezado */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        marginBottom: 24
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            padding: 12,
            borderRadius: 14,
            background: 'rgba(184, 50, 79, 0.15)',
            border: '1px solid rgba(184, 50, 79, 0.3)',
            color: '#B8324F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Heart size={30} fill="#B8324F" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Mi Mesa
              </h1>
              <span style={{
                fontSize: 12,
                fontWeight: 800,
                padding: '3px 12px',
                borderRadius: 20,
                background: 'rgba(124, 58, 237, 0.2)',
                color: '#C4B5FD',
                border: '1px solid rgba(124, 58, 237, 0.4)'
              }}>
                Psicóloga: {currentPsyc}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Gestión simple en 3 bandejas: cartera propia y heredada unificada, con 3–5 candidatas filtradas por el motor.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Cambiar Mesa:</span>
              <select
                value={currentPsyc}
                onChange={e => setCurrentPsyc(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 700
                }}
              >
                {PSYCHOLOGISTS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={fetchMesa}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Notificación flotante */}
      {notification && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 18px',
          borderRadius: 10,
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10B981',
          color: '#10B981',
          marginBottom: 20,
          fontSize: 13,
          fontWeight: 600
        }}>
          <CheckCircle size={18} />
          <span>{notification}</span>
        </div>
      )}

      {/* Buscador Rápido */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ position: 'relative', maxWidth: 420 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por cliente o ciudad..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              color: 'var(--text-primary)',
              fontSize: 13,
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* TRES BANDEJAS */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: 12
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('por_proponer')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            border: activeTab === 'por_proponer' ? '1.5px solid #B8324F' : '1px solid var(--border-color)',
            background: activeTab === 'por_proponer' ? 'rgba(184, 50, 79, 0.2)' : 'var(--bg-card)',
            color: activeTab === 'por_proponer' ? '#FFFFFF' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          <Sparkles size={16} color={activeTab === 'por_proponer' ? '#FF758F' : 'var(--text-muted)'} />
          <span>📋 Por proponer</span>
          <span style={{
            background: activeTab === 'por_proponer' ? '#B8324F' : 'rgba(255,255,255,0.08)',
            color: '#FFFFFF',
            padding: '2px 8px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 800
          }}>
            {data.por_proponer?.length || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('en_revision')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            border: activeTab === 'en_revision' ? '1.5px solid #F59E0B' : '1px solid var(--border-color)',
            background: activeTab === 'en_revision' ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-card)',
            color: activeTab === 'en_revision' ? '#FFFFFF' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          <Clock size={16} color={activeTab === 'en_revision' ? '#FBBF24' : 'var(--text-muted)'} />
          <span>⏳ En revisión de María</span>
          <span style={{
            background: activeTab === 'en_revision' ? '#D97706' : 'rgba(255,255,255,0.08)',
            color: '#FFFFFF',
            padding: '2px 8px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 800
          }}>
            {data.en_revision?.length || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('aprobados')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            border: activeTab === 'aprobados' ? '1.5px solid #10B981' : '1px solid var(--border-color)',
            background: activeTab === 'aprobados' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
            color: activeTab === 'aprobados' ? '#FFFFFF' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          <CheckCircle size={16} color={activeTab === 'aprobados' ? '#10B981' : 'var(--text-muted)'} />
          <span>✅ Aprobados</span>
          <span style={{
            background: activeTab === 'aprobados' ? '#10B981' : 'rgba(255,255,255,0.08)',
            color: '#FFFFFF',
            padding: '2px 8px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 800
          }}>
            {data.aprobados?.length || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rechazados')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            border: activeTab === 'rechazados' ? '1.5px solid #EF4444' : '1px solid var(--border-color)',
            background: activeTab === 'rechazados' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-card)',
            color: activeTab === 'rechazados' ? '#FFFFFF' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          <span>Not approved</span>
          <span style={{
            background: activeTab === 'rechazados' ? '#EF4444' : 'rgba(255,255,255,0.08)',
            color: '#FFFFFF',
            padding: '2px 8px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 800
          }}>
            {data.rechazados?.length || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('troublemakers')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            border: activeTab === 'troublemakers' ? '1.5px solid #8B5CF6' : '1px solid var(--border-color)',
            background: activeTab === 'troublemakers' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
            color: activeTab === 'troublemakers' ? '#FFFFFF' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          <span>Troublemakers</span>
          <span style={{
            background: activeTab === 'troublemakers' ? '#8B5CF6' : 'rgba(255,255,255,0.08)',
            color: '#FFFFFF',
            padding: '2px 8px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 800
          }}>
            {data.troublemakers?.length || 0}
          </span>
        </button>
      </div>

      {/* CONTENIDO DE BANDEJAS */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-card)', borderRadius: 14 }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: '#B8324F' }} />
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>Cargando mesa de trabajo...</p>
        </div>
      ) : (
        <>
          {/* BANDEJA 1: POR PROPONER */}
          {activeTab === 'por_proponer' && (
            <div>
              {data.por_proponer.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-card)', borderRadius: 14 }}>
                  <CheckCircle size={40} color="#10B981" style={{ margin: '0 auto 12px' }} />
                  <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>¡Excelente! No tienes clientes pendientes de propuesta</h3>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Todos los clientes de tu cartera tienen propuesta activa o cita en curso.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {data.por_proponer.map(row => (
                    <div
                      key={row.id}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 14,
                        padding: 18,
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 16,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 300px', minWidth: 280 }}>
                        <UserAvatar url={row.person_a_photo_url} name={row.person_a} size={48} />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <CrmPersonLink
                              crmId={row.person_a_crm_id}
                              name={row.person_a}
                              style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}
                            />
                            {row.is_inherited && (
                              <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: 'rgba(124, 58, 237, 0.15)',
                                color: '#A78BFA',
                                border: '1px solid rgba(124, 58, 237, 0.3)'
                              }}>
                                Heredada de {row.inherited_from}
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span>{row.person_a_age ? `${row.person_a_age} años` : 'Edad no reg.'}</span>
                            <span>•</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <MapPin size={12} /> {row.person_a_city}
                            </span>
                            <span>•</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Briefcase size={12} /> {row.person_a_occupation || 'Ocupación no esp.'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                            {row.dias_label && row.dias_label !== '-' && (
                              <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: (row.dias_esperando || 0) >= 15 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: (row.dias_esperando || 0) >= 15 ? '#EF4444' : '#F59E0B',
                                border: `1px solid ${(row.dias_esperando || 0) >= 15 ? '#EF444450' : '#F59E0B50'}`
                              }}>
                                ⏰ {row.dias_label}
                              </span>
                            )}

                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: 'rgba(255,255,255,0.06)',
                              color: 'var(--text-secondary)'
                            }}>
                              Plan: {row.plan_tier || 'Estándar'}
                            </span>

                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: (row.citas_restantes && row.citas_restantes > 0)
                                ? 'rgba(16, 185, 129, 0.15)'
                                : (row.citas_label === 'Citas por confirmar')
                                  ? 'rgba(59, 130, 246, 0.15)'
                                  : 'rgba(239, 68, 68, 0.15)',
                              color: (row.citas_restantes && row.citas_restantes > 0)
                                ? '#10B981'
                                : (row.citas_label === 'Citas por confirmar')
                                  ? '#60A5FA'
                                  : '#EF4444',
                              border: `1px solid ${(row.citas_restantes && row.citas_restantes > 0)
                                ? '#10B98150'
                                : (row.citas_label === 'Citas por confirmar')
                                  ? '#3B82F650'
                                  : '#EF444450'}`
                            }}>
                              {row.citas_label || (row.citas_restantes > 0 ? `${row.citas_restantes} citas restantes` : '0 citas restantes')}
                            </span>
                          </div>

                          {/* Motivo de rechazo de María visible */}
                          {row.rejection_reason && (
                            <div style={{
                              marginTop: 10,
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#EF4444',
                              fontSize: 12,
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}>
                              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                              <span>Devuelto por María: {row.rejection_reason}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Lista de slots del plan: llenos bloqueados con color, libres con campo para la Persona B */}
                          <div style={{ flex: '2 1 440px', minWidth: 300, maxWidth: 760 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                              {row.slots_total ? `Slots del plan: ${row.slots_total} (${row.slots_libres} libres)` : 'Slots: por confirmar'}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {(row.slots_detalle || []).map((sl, i) => {
                                const est = SLOT_ESTADO[sl.estado] || SLOT_ESTADO.amarillo
                                return (
                                  <div key={sl.match_id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '7px 10px', borderRadius: 8, background: est.bg, border: `1px solid ${est.color}55`, borderLeft: `4px solid ${est.color}` }}>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: est.color, minWidth: 46 }}>Slot {i + 1}</span>
                                    <UserAvatar url={sl.person_b_photo_url} name={sl.person_b} size={26} />
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flex: '1 1 160px' }}>
                                      {sl.person_b}{sl.person_b_age ? ` · ${sl.person_b_age} años` : ''}
                                    </span>
                                    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 20, background: est.color, color: '#fff' }}>{est.label}</span>
                                    {sl.estado === 'rojo' && sl.motivo && (
                                      <span style={{ flexBasis: '100%', fontSize: 12, color: est.color, fontWeight: 600 }}>{sl.motivo}</span>
                                    )}
                                  </div>
                                )
                              })}
                              {Array.from({ length: row.slots_libres || 0 }).map((_, k) => {
                                const key = `${row.id}:${k}`
                                const mb = manualB[key] || {}
                                return (
                                  <div key={key} style={{ padding: '7px 10px', borderRadius: 8, border: '1px dashed var(--border-color)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', minWidth: 46 }}>Slot {(row.slots_detalle || []).length + k + 1}</span>
                                      <input
                                        type="text"
                                        value={mb.text || ''}
                                        onChange={(e) => setMB(key, { text: e.target.value, found: null, error: '' })}
                                        onKeyDown={(e) => { if (e.key === 'Enter') buscarPersonaB(row, key) }}
                                        placeholder="Pega la URL del CRM o escribe el nombre de la Persona B"
                                        style={{ flex: '1 1 240px', minWidth: 0, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-input, transparent)', color: 'var(--text-primary)', fontSize: 13 }}
                                      />
                                      <button type="button" onClick={() => buscarPersonaB(row, key)} disabled={mb.loading}
                                        style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                        {mb.loading ? 'Buscando...' : 'Buscar'}
                                      </button>
                                    </div>
                                    {mb.error && (
                                      <div style={{ marginTop: 6, fontSize: 12, color: '#EF4444', fontWeight: 600 }}>{mb.error}</div>
                                    )}
                                    {mb.found && (
                                      <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                                          <b>{mb.found.name}</b>
                                          {mb.found.age ? ` · ${mb.found.age} años` : ''}
                                          {mb.found.city ? ` · ${mb.found.city}` : ''}
                                          {mb.found.plan_tier ? ` · ${mb.found.plan_tier}` : ''}
                                        </span>
                                        <button type="button" onClick={() => enviarPersonaB(row, key)} disabled={mb.sending}
                                          style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#10B981', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                                          {mb.sending ? 'Enviando...' : 'Enviar a María'}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                      {/* Botón único para proponer match */}
                      <div>
                        <button
                          type="button"
                          onClick={() => handleOpenProponer(row)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 20px',
                            background: '#B8324F',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(184, 50, 79, 0.35)',
                            transition: 'all 0.15s'
                          }}
                        >
                          <Sparkles size={15} />
                          Proponer match
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* BANDEJA 2: EN REVISIÓN DE MARÍA */}
          {activeTab === 'en_revision' && (
            <div>
              {data.en_revision.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-card)', borderRadius: 14 }}>
                  <Clock size={40} color="#F59E0B" style={{ margin: '0 auto 12px' }} />
                  <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>No tienes propuestas en revisión de María</h3>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Cuando propongas candidatas, aparecerán aquí esperando visto bueno.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {data.en_revision.map(row => (
                    <div
                      key={row.id}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 14,
                        padding: 18,
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 16
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 280 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <UserAvatar url={row.person_a_photo_url} name={row.person_a} size={42} />
                          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{row.person_a}</span>
                        </div>

                        <div style={{ color: '#B8324F', fontWeight: 800 }}>VS</div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <UserAvatar url={row.person_b_photo_url} name={row.person_b} size={42} bg="linear-gradient(135deg, #065f46, #10b981)" />
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#10B981' }}>{row.person_b}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {row.compatibility_score && (
                          <span style={{
                            fontSize: 12,
                            fontWeight: 800,
                            padding: '3px 10px',
                            borderRadius: 6,
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10B981'
                          }}>
                            {row.compatibility_score}/100 • {row.compatibility_verdict || 'RECOMENDADO'}
                          </span>
                        )}

                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '6px 12px',
                          borderRadius: 8,
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#F59E0B',
                          border: '1px solid rgba(245, 158, 11, 0.3)'
                        }}>
                          <Clock size={13} /> En revisión de María
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* BANDEJA 3: APROBADOS */}
          {activeTab === 'rechazados' && (
            <div>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                Propuestas que María no aprobó. Revisa el motivo y propone otra opción.
              </p>
              {(data.rechazados || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-card)', borderRadius: 14 }}>
                  <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>No hay propuestas rechazadas en esta vista</h3>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {data.rechazados.map(row => (
                    <div
                      key={row.id}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderLeft: '4px solid #EF4444',
                        borderRadius: 14,
                        padding: 18,
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 16
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <UserAvatar url={row.person_a_photo_url} name={row.person_a} size={40} />
                          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{row.person_a}</span>
                          <span style={{ color: '#EF4444', fontWeight: 800 }}>con</span>
                          <UserAvatar url={row.person_b_photo_url} name={row.person_b || '?'} size={40} />
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#EF4444' }}>{row.person_b || 'Sin candidata registrada'}</span>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                          {row.status} · {row.fecha_creacion}{row.is_inherited && row.inherited_from ? ' · heredada de ' + row.inherited_from : ''}
                        </div>
                        {(row.rejection_reason || row.observations) && (
                          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 760 }}>
                            {(row.rejection_reason || row.observations || '').slice(0, 400)}
                          </div>
                        )}
                      </div>
                      <div>
                      <button type="button" onClick={() => handleOpenProponer(row)} style={{ background: '#B8324F', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        Proponer otro match
                      </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'troublemakers' && (
            <div>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                Matches que María aprobó pero Servicio al Cliente rechazó.
              </p>
              {(data.troublemakers || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-card)', borderRadius: 14 }}>
                  <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>No hay troublemakers en esta vista</h3>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {data.troublemakers.map(row => (
                    <div
                      key={row.id}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderLeft: '4px solid #8B5CF6',
                        borderRadius: 14,
                        padding: 18,
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 16
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <UserAvatar url={row.person_a_photo_url} name={row.person_a} size={40} />
                          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{row.person_a}</span>
                          <span style={{ color: '#8B5CF6', fontWeight: 800 }}>con</span>
                          <UserAvatar url={row.person_b_photo_url} name={row.person_b || '?'} size={40} />
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#8B5CF6' }}>{row.person_b || 'Sin candidata registrada'}</span>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                          {row.status} · {row.fecha_creacion}{row.is_inherited && row.inherited_from ? ' · heredada de ' + row.inherited_from : ''}
                        </div>
                        {(row.rejection_reason || row.observations) && (
                          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 760 }}>
                            {(row.rejection_reason || row.observations || '').slice(0, 400)}
                          </div>
                        )}
                      </div>
                      <div>
                      <button type="button" onClick={() => handleOpenProponer(row)} style={{ background: '#B8324F', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        Proponer otro match
                      </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'aprobados' && (
            <div>
              {data.aprobados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-card)', borderRadius: 14 }}>
                  <Award size={40} color="#10B981" style={{ margin: '0 auto 12px' }} />
                  <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>No hay matches aprobados en esta vista</h3>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {data.aprobados.map(row => (
                    <div
                      key={row.id}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 14,
                        padding: 18,
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 16
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 280 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <UserAvatar url={row.person_a_photo_url} name={row.person_a} size={42} />
                          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{row.person_a}</span>
                        </div>

                        <div style={{ color: '#10B981', fontWeight: 800 }}>♥</div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <UserAvatar url={row.person_b_photo_url} name={row.person_b} size={42} bg="linear-gradient(135deg, #065f46, #10b981)" />
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#10B981' }}>{row.person_b}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {row.scheduled_venue ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '6px 12px',
                            borderRadius: 8,
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#3B82F6',
                            border: '1px solid rgba(59, 130, 246, 0.3)'
                          }}>
                            <Calendar size={13} /> Cita: {row.scheduled_venue} {row.scheduled_date_time ? `(${row.scheduled_date_time})` : ''}
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '6px 12px',
                            borderRadius: 8,
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10B981',
                            border: '1px solid rgba(16, 185, 129, 0.3)'
                          }}>
                            <CheckCircle size={13} /> Aprobado por María (En agendamiento)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* PANEL DRAWER / MODAL: PROPONER MATCH (3 a 5 candidatas del motor) */}
      {proposingClient && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(5px)',
          padding: 16
        }}>
          <div style={{
            width: '100%',
            maxWidth: 820,
            maxHeight: '90vh',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 18,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px rgba(0,0,0,0.6)'
          }}>
            {/* Header del panel */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.02)'
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Proponer match para:
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <UserAvatar url={proposingClient.person_a_photo_url} name={proposingClient.person_a} size={32} />
                  <span>{proposingClient.person_a}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    ({proposingClient.person_a_age ? `${proposingClient.person_a_age}a` : 'Edad no reg.'} • {proposingClient.person_a_city})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setProposingClient(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 6 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Lista de candidatas compactas */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {loadingCandidates ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: '#B8324F' }} />
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Evaluando y filtrando candidatas con el motor clínico...</p>
                </div>
              ) : candidatesError ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                  <AlertTriangle size={36} color="#EF4444" style={{ margin: '0 auto 12px' }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#EF4444' }}>Error al consultar el motor de matching</p>
                  <p style={{ margin: '6px 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>{candidatesError}</p>
                  <button
                    type="button"
                    onClick={() => handleOpenProponer(proposingClient)}
                    style={{
                      padding: '8px 18px',
                      background: '#B8324F',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                  >
                    Reintentar consulta
                  </button>
                </div>
              ) : candidates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                  <AlertTriangle size={36} color="#F59E0B" style={{ margin: '0 auto 12px' }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>No se encontraron candidatas viables bajo los filtros estrictos</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    Todas las candidatas potenciales ya tuvieron cita, están en otro match activo o no cumplen compatibilidad bidireccional.
                  </p>
                </div>
              ) : (
                candidates.map((cand, idx) => {
                  const scoreVal = cand.score || cand.compatibility_pct || 80
                  const isExpanded = expandedCandidateId === cand.user_id
                  return (
                    <div
                      key={cand.user_id || idx}
                      style={{
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 14,
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12
                      }}
                    >
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
                        {/* Info Candidata: Foto grande, Nombre, Edad, Ciudad, Ocupación */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 260 }}>
                          <UserAvatar url={cand.photo_url} name={cand.name} size={64} />
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>
                              <CrmPersonLink crmId={cand.crm_id} name={cand.name} style={{ fontWeight: 800, color: 'var(--text-primary)' }} />
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                              {cand.age ? `${cand.age} años` : 'Edad no reg.'} • {cand.city || 'Bogotá'}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Briefcase size={12} /> {cand.occupation || 'Ocupación no especificada'}
                            </div>
                          </div>
                        </div>

                        {/* Puntaje único y Veredicto */}
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            fontSize: 14,
                            fontWeight: 800,
                            padding: '4px 12px',
                            borderRadius: 8,
                            background: scoreVal >= 75 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                            color: scoreVal >= 75 ? '#34D399' : '#FBBF24',
                            border: `1px solid ${scoreVal >= 75 ? '#10B98150' : '#F59E0B50'}`
                          }}>
                            {scoreVal}/100 • {cand.veredicto || 'RECOMENDADO'}
                          </span>

                          {/* Aviso comercial si aplica */}
                          {cand.opportunity_badge && (
                            <div style={{
                              marginTop: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#F59E0B',
                              background: 'rgba(245, 158, 11, 0.1)',
                              padding: '2px 8px',
                              borderRadius: 6
                            }}>
                              {cand.opportunity_badge}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 3 Razones con evidencia */}
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                          3 Razones Principales:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {(cand.strengths || cand.reasons || [
                            `Afinidad etaria armónica (${cand.age}a y ${proposingClient.person_a_age}a)`,
                            `Compatibilidad territorial en ${cand.city || proposingClient.person_a_city}`,
                            `Perfil verificado en CRM y sin bloqueos clínicos`
                          ]).slice(0, 3).map((r, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: 'var(--text-primary)' }}>
                              <CheckCircle size={13} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
                              <span>{r}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Botones: Elegir y Descartar + Ver Detalle */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
                        <button
                          type="button"
                          onClick={() => setExpandedCandidateId(isExpanded ? null : cand.user_id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <Eye size={13} />
                          {isExpanded ? 'Ocultar detalle' : 'Ver detalle clínico'}
                        </button>

                        <div style={{ display: 'flex', gap: 10 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setDiscardingCandidate(cand)
                              setSelectedDiscardReason('')
                              setDiscardNotes('')
                            }}
                            style={{
                              padding: '8px 14px',
                              background: 'transparent',
                              color: '#EF4444',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Descartar
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setChoosingCandidate(cand)
                              setProposalNote('')
                            }}
                            style={{
                              padding: '8px 18px',
                              background: '#16A34A',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
                            }}
                          >
                            Elegir (Enviar a María)
                          </button>
                        </div>
                      </div>

                      {/* Acordión de Detalle Clínico Expandido */}
                      {isExpanded && (
                        <div style={{
                          marginTop: 8,
                          padding: 12,
                          background: 'rgba(0,0,0,0.2)',
                          borderRadius: 8,
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          lineHeight: 1.4
                        }}>
                          {cand.synthesis && (
                            <p style={{ margin: '0 0 8px' }}>
                              <strong style={{ color: 'var(--text-primary)' }}>Síntesis:</strong> {cand.synthesis}
                            </p>
                          )}
                          {cand.bio_notes && (
                            <p style={{ margin: 0, fontStyle: 'italic' }}>
                              <strong style={{ color: 'var(--text-primary)' }}>Notas ficha:</strong> {cand.bio_notes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELEGIR (Confirmación con nota opcional para María) */}
      {choosingCandidate && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)',
          padding: 16
        }}>
          <div style={{
            width: '100%',
            maxWidth: 480,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 16,
            padding: 24
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
              Confirmar propuesta de match
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.4 }}>
              Enviar a <strong style={{ color: 'var(--text-primary)' }}>{choosingCandidate.name}</strong> como candidata para <strong style={{ color: 'var(--text-primary)' }}>{proposingClient.person_a}</strong> a revisión y aprobación de María Paula Salinas.
            </p>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Nota o justificación para María (opcional)
              </label>
              <textarea
                rows={3}
                placeholder="Ej. Ambos buscan relación formal, comparten intereses de viaje y estilo de vida afín..."
                value={proposalNote}
                onChange={e => setProposalNote(e.target.value)}
                style={{
                  width: '100%',
                  padding: 10,
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                  resize: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setChoosingCandidate(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmChoose}
                disabled={submittingProposal}
                style={{
                  padding: '9px 18px',
                  background: '#16A34A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  opacity: submittingProposal ? 0.6 : 1
                }}
              >
                {submittingProposal ? 'Enviando...' : 'Enviar a María'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DESCARTAR (1 clic obligatorio de motivo + persistencia 30 días) */}
      {discardingCandidate && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)',
          padding: 16
        }}>
          <div style={{
            width: '100%',
            maxWidth: 480,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 16,
            padding: 24
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: '#EF4444' }}>
              Descartar candidata por 30 días
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.4 }}>
              Descartar a <strong style={{ color: 'var(--text-primary)' }}>{discardingCandidate.name}</strong> para <strong style={{ color: 'var(--text-primary)' }}>{proposingClient.person_a}</strong>. No volverá a sugerirse durante 30 días.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                Motivo del descarte (obligatorio):
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {DISCARD_REASONS.map(cat => {
                  const isSelected = selectedDiscardReason === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedDiscardReason(cat.id)}
                      style={{
                        padding: '9px 12px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: isSelected ? 800 : 600,
                        border: isSelected ? '2px solid #EF4444' : '1px solid var(--border-color)',
                        background: isSelected ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-base)',
                        color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4
                      }}
                    >
                      {isSelected && <Check size={12} color="#EF4444" />}
                      <span>{cat.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Nota complementaria (opcional)
              </label>
              <textarea
                rows={2}
                placeholder="Observación clínica sobre el motivo..."
                value={discardNotes}
                onChange={e => setDiscardNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: 10,
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                  resize: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setDiscardingCandidate(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                disabled={submittingDiscard || !selectedDiscardReason}
                style={{
                  padding: '9px 18px',
                  background: '#EF4444',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: selectedDiscardReason ? 'pointer' : 'not-allowed',
                  opacity: (submittingDiscard || !selectedDiscardReason) ? 0.5 : 1
                }}
              >
                {submittingDiscard ? 'Descartando...' : 'Confirmar Descarte'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
