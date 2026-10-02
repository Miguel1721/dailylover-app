import React, { useState, useEffect, useCallback, useRef } from 'react'
import { 
  ShieldCheck, Headphones, Search, RefreshCw, CheckCircle, Clock, MapPin, 
  User, AlertTriangle, PhoneCall, ExternalLink, Filter, X, Calendar as CalendarIcon,
  Check, ArrowRight, Undo2, MessageSquare, Sparkles, Heart, Briefcase
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import CrmPersonLink from '../../components/CrmPersonLink'
import UserAvatar from '../../components/UserAvatar'
import RestaurantFilterModal from '../../components/RestaurantFilterModal'

// Burbujas del CRM: Social Group, estatura, religión y política (cada una independiente)
const burbujaCrm = (t, strong) => (
  <span key={t} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap',
    background: strong ? 'rgba(124, 58, 237, 0.12)' : 'rgba(255,255,255,0.06)',
    color: strong ? '#7C3AED' : 'var(--text-secondary)',
    border: strong ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid var(--border-color)' }}>{t}</span>
)
const burbujasCrm = (sg, est, rel, pol) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '4px 0 8px' }}>
    {burbujaCrm(sg ? `Social Group ${sg}` : 'Social Group: sin dato', true)}
    {est ? burbujaCrm(`Estatura ${est}`) : null}
    {rel ? burbujaCrm(`Religión ${rel}`) : null}
    {pol ? burbujaCrm(`Política ${pol}`) : null}
  </div>
)

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

const PSYCHOLOGIST_LIST = [
  'Todas', 'SILVI', 'JENN', 'ANA', 'STEFFY', 'ISA', 'PIA', 'MAPE D', 'MPS'
]

const CITIES = [
  'Todas', 'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga',
  'Pereira', 'Cartagena', 'Manizales', 'Santa Marta', 'Miami', 'Madrid'
]

const REJECTION_CATEGORIES = [
  { id: 'Físico', label: 'Físico' },
  { id: 'Estilo de vida', label: 'Estilo de vida' },
  { id: 'Edad', label: 'Edad' },
  { id: 'Valores / Proyecto', label: 'Valores / Proyecto' },
  { id: 'Ya se conocen', label: 'Ya se conocen' },
  { id: 'Otro', label: 'Otro' }
]

// Chat de notas de la pareja: lo ven y lo escriben Servicio al Cliente y María
function ChatNotas({ matchId, total, API, token }) {
  const [abierto, setAbierto] = useState(false)
  const [notas, setNotas] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cuenta, setCuenta] = useState(total || 0)
  const listaRef = useRef(null)

  const cargar = useCallback(() => {
    fetch(`${API}/api/v1/matchmaking/matches/${matchId}/notas`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setNotas(d.notas || []); setCuenta((d.notas || []).length) })
      .catch(() => {})
  }, [API, matchId, token])

  useEffect(() => {
    if (!abierto) return undefined
    cargar()
    const t = setInterval(cargar, 10000)   // se actualiza solo para ver lo que escriben las demás
    return () => clearInterval(t)
  }, [abierto, cargar])

  useEffect(() => {
    if (abierto && listaRef.current) listaRef.current.scrollTop = listaRef.current.scrollHeight
  }, [notas.length, abierto])

  const enviar = async () => {
    const t = texto.trim()
    if (!t || enviando) return
    setEnviando(true)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${matchId}/notas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ texto: t })
      })
      if (res.ok) { setTexto(''); cargar() }
      else alert('No se pudo enviar el mensaje.')
    } catch (e) {
      alert('Error de conexión.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button type="button" onClick={() => setAbierto(a => !a)}
        style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
        {abierto ? 'Cerrar chat de notas' : `Chat de notas${cuenta > 0 ? ` (${cuenta})` : ''}`}
      </button>
      {abierto && (
        <div style={{ marginTop: 8, border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-base)', overflow: 'hidden' }}>
          <div ref={listaRef} style={{ maxHeight: 280, minHeight: 90, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notas.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '18px 0' }}>Aún no hay mensajes de esta pareja. Escribe el primero.</div>}
            {notas.map(n => (
              <div key={n.id} style={{ alignSelf: n.es_mio ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 2, textAlign: n.es_mio ? 'right' : 'left' }}>{n.es_mio ? 'Tú' : n.autor} · {n.fecha}</div>
                <div style={{ padding: '8px 12px', borderRadius: n.es_mio ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: n.es_mio ? '#B8324F' : 'var(--bg-card)', color: n.es_mio ? '#fff' : 'var(--text-primary)', border: n.es_mio ? 'none' : '1px solid var(--border-color)', fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{n.texto}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--border-color)' }}>
            <input type="text" value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') enviar() }}
              placeholder="Escribe un mensaje sobre esta pareja (llamadas, novedades, preferencias)"
              style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-input, transparent)', color: 'var(--text-primary)', fontSize: 13 }} />
            <button type="button" onClick={enviar} disabled={enviando || !texto.trim()}
              style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#B8324F', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', opacity: texto.trim() ? 1 : 0.5 }}>
              {enviando ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AprobadosMaria() {
  const { token, user } = useAuth()

  const userEmail = (user?.email || '').trim().toLowerCase()
  const userName = (user?.name || '').trim().toLowerCase()
  const userRole = (user?.role || '').trim()

  const isMpsOrAdmin = 
    userRole === 'Admin' ||
    userRole === 'Super Admin' ||
    userRole === 'María' ||
    userEmail.includes('maria') ||
    userEmail.includes('admin') ||
    userName.includes('maria paula salinas') ||
    userName.includes('maría paula salinas') ||
    userName.includes('maria salinas')
  
  // Pestaña activa: 'revision' (Cola de Aprobación de María) o 'servicio' (CS - Citas por agendar)
  const isCsOnly = user?.role === 'Servicio al Cliente'
  const [activeTab, setActiveTab] = useState(isCsOnly ? 'servicio' : 'revision')
  useEffect(() => { if (isCsOnly && activeTab !== 'servicio') setActiveTab('servicio') }, [isCsOnly, activeTab])

  // Filtros
  const [selectedPsyc, setSelectedPsyc] = useState('Todas')
  const [selectedCity, setSelectedCity] = useState('Todas')
  const [searchTerm, setSearchTerm] = useState('')
  const [approvalDate, setApprovalDate] = useState('')
  const [analisisIA, setAnalisisIA] = useState({})      // match_id -> analisis generado en esta sesion
  const [analizando, setAnalizando] = useState(null)
  const [modalAnalisis, setModalAnalisis] = useState(null)   // id del match cuyo analisis esta abierto
  const [errorIA, setErrorIA] = useState({})
  const [ordenRev, setOrdenRev] = useState('cliente_antiguo')   // cliente_antiguo | oldest_first | newest_first

  // Estado de Cola de Revisión de María
  const [reviewQueue, setReviewQueue] = useState([])
  const [totalReview, setTotalReview] = useState(0)
  const [pageReview, setPageReview] = useState(1)
  const [totalPagesReview, setTotalPagesReview] = useState(1)
  const [pageSizeReview, setPageSizeReview] = useState(20)
  const [loadingReview, setLoadingReview] = useState(true)
  const [approvingId, setApprovingId] = useState(null)
  const [rejectModalMatch, setRejectModalMatch] = useState(null)
  const [rejectCategory, setRejectCategory] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  // Estado de Servicio al Cliente (Citas por Agendar)
  const [serviceMatches, setServiceMatches] = useState([])
  const [loadingService, setLoadingService] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [scheduleModalMatch, setScheduleModalMatch] = useState(null)

  // Notificaciones y UI
  const [notification, setNotification] = useState('')

  const analizarPar = async (item, regenerar = false) => {
    setAnalizando(item.id)
    setErrorIA(prev => ({ ...prev, [item.id]: '' }))
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${item.id}/analisis-ia?regenerar=${regenerar}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.analisis) setAnalisisIA(prev => ({ ...prev, [item.id]: d.analisis }))
      else setErrorIA(prev => ({ ...prev, [item.id]: d.detail || 'No se pudo generar el análisis.' }))
    } catch (e) {
      setErrorIA(prev => ({ ...prev, [item.id]: 'Error de conexión.' }))
    } finally {
      setAnalizando(null)
    }
  }

  const abrirAnalisis = (item) => {
    setModalAnalisis(item.id)
    if (!(analisisIA[item.id] || item.analisis_ia)) analizarPar(item)
  }

  // 1. Cargar Cola de Revisión de María
  const fetchReviewQueue = useCallback(() => {
    if (!isMpsOrAdmin) { setReviewQueue([]); setTotalReview(0); setLoadingReview(false); return }
    setLoadingReview(true)
    let url = `${API}/api/v1/matchmaking/approval-queue?sort_by=${ordenRev}&page=${pageReview}&page_size=${pageSizeReview}&`
    if (selectedPsyc && selectedPsyc !== 'Todas') url += `psychologist=${encodeURIComponent(selectedPsyc)}&`
    if (selectedCity && selectedCity !== 'Todas') url += `city=${encodeURIComponent(selectedCity)}&`
    if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`
    if (approvalDate) url += `date=${encodeURIComponent(approvalDate)}&`

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setReviewQueue(data.queue || [])
        setTotalReview(data.total ?? (data.queue || []).length)
        setTotalPagesReview(data.total_pages || 1)
        setLoadingReview(false)
      })
      .catch(err => {
        console.error('Error cargando cola de aprobación:', err)
        setReviewQueue([])
        setTotalReview(0)
        setTotalPagesReview(1)
        setLoadingReview(false)
      })
  }, [selectedPsyc, selectedCity, searchTerm, approvalDate, ordenRev, pageReview, pageSizeReview, token, isMpsOrAdmin])

  // 2. Cargar Cola de Servicio al Cliente (Aprobados por María)
  const fetchServiceQueue = useCallback(() => {
    setLoadingService(true)
    let url = `${API}/api/v1/matchmaking/pending-service?sort_by=oldest_first&`
    if (selectedPsyc && selectedPsyc !== 'Todas') url += `psychologist=${encodeURIComponent(selectedPsyc)}&`
    if (selectedCity && selectedCity !== 'Todas') url += `city=${encodeURIComponent(selectedCity)}&`
    if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`
    if (approvalDate) url += `approval_date=${encodeURIComponent(approvalDate)}&`

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setServiceMatches(data.matches || [])
        setLoadingService(false)
      })
      .catch(err => {
        console.error('Error cargando citas por agendar:', err)
        setServiceMatches([])
        setLoadingService(false)
      })
  }, [selectedPsyc, selectedCity, searchTerm, approvalDate, token])

  useEffect(() => {
    fetchReviewQueue()
    fetchServiceQueue()
  }, [fetchReviewQueue, fetchServiceQueue])

  // Aprobar match definitivo por María (1 solo clic)
  const handleApproveMatch = async (matchId) => {
    setApprovingId(matchId)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${matchId}/approve-by-maria`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notes: "Aprobado oficialmente por María", force: true })
      })
      if (res.ok) {
        setNotification('✓ Match aprobado con éxito (1 clic). Se ha enviado a Servicio al Cliente (Citas por Agendar).')
        setTimeout(() => setNotification(''), 6000)
        fetchReviewQueue()
        fetchServiceQueue()
      } else {
        const err = await res.json()
        alert(`Error al aprobar match: ${err.detail || 'Operación no completada'}`)
      }
    } catch (e) {
      alert('Error de conexión al aprobar match.')
    } finally {
      setApprovingId(null)
    }
  }

  // Rechazar o devolver propuesta con motivo obligatorio (1 clic)
  const handleRejectMatch = async () => {
    if (!rejectModalMatch) return
    if (!rejectCategory) {
      alert('Por favor selecciona un motivo principal de rechazo.')
      return
    }
    setRejecting(true)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${rejectModalMatch.id}/reject-by-maria`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          rejection_category: rejectCategory,
          rejection_reason: rejectReason.trim()
        })
      })
      if (res.ok) {
        setNotification(`✕ Match rechazado por motivo [${rejectCategory}]. Se devolvió a ${rejectModalMatch.psychologist_name} con el motivo visible y se liberó a ${rejectModalMatch.person_b}.`)
        setTimeout(() => setNotification(''), 6000)
        setRejectModalMatch(null)
        setRejectCategory('')
        setRejectReason('')
        fetchReviewQueue()
      } else {
        const err = await res.json()
        alert(`Error al devolver match: ${err.detail || 'Operación no completada'}`)
      }
    } catch (e) {
      alert('Error de conexión al devolver match.')
    } finally {
      setRejecting(false)
    }
  }

  // Actualizar estado de CS (Por llamar, Llamado 1, etc.)
  const ESTADOS_PERSONA = [
    ['Pendiente', 'Pendiente', '#F59E0B'],
    ['Aceptó', 'Confirmó la cita', '#10B981'],
    ['Rechazó', 'Rechazó la cita', '#EF4444'],
    ['No contesta', 'No contesta', '#6B7280'],
    ['De viaje', 'De viaje', '#3B82F6'],
    ['Reprogramar', 'Reprogramar', '#8B5CF6']
  ]

  const cambiarConfirmacion = async (match, lado, estado) => {
    setUpdatingId(match.id)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${match.id}/confirmacion-persona`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ persona: lado, estado })
      })
      if (res.ok) fetchServiceQueue()
      else alert('No se pudo actualizar el estado de la persona.')
    } catch (e) {
      alert('Error de conexión.')
    } finally {
      setUpdatingId(null)
    }
  }

  // Estado de la persona frente a la cita, debajo de su nombre
  const estadoPersona = (match, lado) => {
    const actual = match[`confirmation_${lado}`] || 'Pendiente'
    const lista = ESTADOS_PERSONA.some(e => e[0] === actual) ? ESTADOS_PERSONA : [...ESTADOS_PERSONA, [actual, actual, '#6B7280']]
    const col = (lista.find(e => e[0] === actual) || [])[2] || '#6B7280'
    return (
      <select value={actual} onChange={e => cambiarConfirmacion(match, lado, e.target.value)} disabled={updatingId === match.id}
        style={{ marginTop: 8, padding: '5px 8px', borderRadius: 8, border: `1.5px solid ${col}`, background: `${col}18`, color: col, fontSize: 12, fontWeight: 800, cursor: 'pointer', maxWidth: '100%' }}>
        {lista.map(e => <option key={e[0]} value={e[0]}>{e[1]}</option>)}
      </select>
    )
  }

  const handleUpdateServiceStatus = async (matchId, statusVal) => {
    setUpdatingId(matchId)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${matchId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ service_status: statusVal })
      })
      if (res.ok) {
        fetchServiceQueue()
      } else {
        alert('Error al actualizar estado de servicio.')
      }
    } catch (e) {
      alert('Error de conexión.')
    } finally {
      setUpdatingId(null)
    }
  }

  // Guardar agendamiento de cita
  const handleSaveSchedule = async (data) => {
    if (!scheduleModalMatch) return
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${scheduleModalMatch.id}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      })
      if (res.ok) {
        setNotification(`🎉 Cita agendada exitosamente para ${scheduleModalMatch.person_a} y ${scheduleModalMatch.person_b} en ${data.venue || data.restaurant_name || 'Restaurante'}.`)
        setTimeout(() => setNotification(''), 6000)
        setScheduleModalMatch(null)
        fetchServiceQueue()
      } else {
        const err = await res.json()
        alert(`Error al agendar cita: ${err.detail || 'No se pudo guardar'}`)
      }
    } catch (e) {
      alert('Error de red al guardar la cita.')
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
            <ShieldCheck size={32} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Aprobados por María
              </h1>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 20,
                background: 'rgba(184, 50, 79, 0.2)',
                color: '#FF758F',
                border: '1px solid rgba(184, 50, 79, 0.4)'
              }}>
                Filtro Oficial
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Circuito de aprobación clínica: las propuestas de entrevista pasan primero por aquí antes de llegar a MATCHES.
            </p>
          </div>
        </div>

        <div>
          <button
            onClick={() => { fetchReviewQueue(); fetchServiceQueue(); }}
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
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={14} className={loadingReview || loadingService ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Notificación de éxito */}
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

      {/* Selector de Pestañas: Revisión vs Aprobados/Servicio */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: 12
      }}>
        {!isCsOnly && (
        <button
          type="button"
          onClick={() => setActiveTab('revision')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            border: activeTab === 'revision' ? '1.5px solid #B8324F' : '1px solid var(--border-color)',
            background: activeTab === 'revision' ? 'rgba(184, 50, 79, 0.2)' : 'var(--bg-card)',
            color: activeTab === 'revision' ? '#FFFFFF' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <ShieldCheck size={16} color={activeTab === 'revision' ? '#FF758F' : 'var(--text-muted)'} />
          <span>📋 Pendientes de Aprobar</span>
          <span style={{
            background: activeTab === 'revision' ? '#B8324F' : 'rgba(255,255,255,0.08)',
            color: '#FFFFFF',
            padding: '2px 8px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 800
          }}>
            {totalReview || reviewQueue.length}
          </span>
        </button>
      )}

        <button
          type="button"
          onClick={() => setActiveTab('servicio')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            border: activeTab === 'servicio' ? '1.5px solid #10B981' : '1px solid var(--border-color)',
            background: activeTab === 'servicio' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
            color: activeTab === 'servicio' ? '#FFFFFF' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <CheckCircle size={16} color={activeTab === 'servicio' ? '#10B981' : 'var(--text-muted)'} />
          <span>🛡️ Aprobados por María / Citas por Agendar</span>
          <span style={{
            background: activeTab === 'servicio' ? '#10B981' : 'rgba(255,255,255,0.08)',
            color: '#FFFFFF',
            padding: '2px 8px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 800
          }}>
            {serviceMatches.length}
          </span>
        </button>
      </div>

      {/* Barra de Filtros Globales */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
        marginBottom: 24,
        padding: 16,
        borderRadius: 12,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)'
      }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Buscar por nombre
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Nombre cliente o candidata..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPageReview(1); }}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                color: 'var(--text-primary)',
                fontSize: 13,
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Psicóloga Asignada
          </label>
          <select
            value={selectedPsyc}
            onChange={e => { setSelectedPsyc(e.target.value); setPageReview(1); }}
            style={{
              width: '100%',
              padding: '9px 12px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              fontSize: 13,
              boxSizing: 'border-box'
            }}
          >
            {PSYCHOLOGIST_LIST.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Ciudad
          </label>
          <select
            value={selectedCity}
            onChange={e => { setSelectedCity(e.target.value); setPageReview(1); }}
            style={{
              width: '100%',
              padding: '9px 12px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              fontSize: 13,
              boxSizing: 'border-box'
            }}
          >
            {CITIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#10B981', marginBottom: 6 }}>
            📅 Fecha de Aprobación
          </label>
          <div style={{ position: 'relative', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="date"
              value={approvalDate}
              onChange={e => { setApprovalDate(e.target.value); setPageReview(1); }}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-base)',
                border: approvalDate ? '1.5px solid #10B981' : '1px solid var(--border-color)',
                borderRadius: 8,
                color: 'var(--text-primary)',
                fontSize: 13,
                boxSizing: 'border-box'
              }}
            />
            {approvalDate && (
              <button
                type="button"
                onClick={() => setApprovalDate('')}
                title="Limpiar fecha de aprobación"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'revision' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '0 0 16px' }}>
          <label htmlFor="orden-rev" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Ordenar por</label>
          <select id="orden-rev" value={ordenRev} onChange={e => { setOrdenRev(e.target.value); setPageReview(1) }}
            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
            <option value="cliente_antiguo">Cliente que más lleva esperando</option>
            <option value="oldest_first">Propuesta más antigua</option>
            <option value="newest_first">Propuesta más reciente</option>
          </select>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VISTA 1: COLA DE REVISIÓN Y APROBACIÓN DE MARÍA                     */}
      {/* ==================================================================== */}
      {/* ==================================================================== */}
      {/* VISTA 1: COLA DE REVISIÓN Y APROBACIÓN DE MARÍA                     */}
      {/* ==================================================================== */}
      {activeTab === 'revision' && (
        <div>
          {!isMpsOrAdmin ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 24px',
              background: 'var(--bg-card)',
              borderRadius: 16,
              border: '1px solid var(--border-color)',
              maxWidth: 600,
              margin: '30px auto'
            }}>
              <ShieldCheck size={52} style={{ color: '#B8324F', margin: '0 auto 16px' }} />
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                Bandeja Exclusiva de Dirección Clínica
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 20px' }}>
                La cola de aprobación de propuestas ("Por aprobar") está reservada únicamente para María Paula Salinas y Administración.
              </p>
              {isCsOnly && (
                <button
                  type="button"
                  onClick={() => setActiveTab('servicio')}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    background: '#10B981',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Ir a Citas por Agendar (Servicio al Cliente)
                </button>
              )}
            </div>
          ) : (
            <>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Mostrando <strong style={{ color: 'var(--text-primary)' }}>{reviewQueue.length}</strong> de <strong style={{ color: 'var(--text-primary)' }}>{totalReview}</strong> propuestas pendientes de aprobación por María
                  {totalPagesReview > 1 && ` (Página ${pageReview} de ${totalPagesReview})`}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: '#10B981',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(16, 185, 129, 0.25)'
                }}>
                  <ShieldCheck size={13} />
                  <span>Aprobar con 1 solo clic pasa el match directo a Servicio al Cliente (Citas por Agendar).</span>
                </div>
              </div>

              {loadingReview ? (
                <div style={{
                  textAlign: 'center',
                  padding: 60,
                  background: 'var(--bg-card)',
                  borderRadius: 14,
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)'
                }}>
                  <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: '#B8324F' }} />
                  <p style={{ margin: 0, fontSize: 14 }}>Cargando cola de revisión clínica...</p>
                </div>
              ) : reviewQueue.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: 60,
                  background: 'var(--bg-card)',
                  borderRadius: 14,
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)'
                }}>
                  <CheckCircle size={40} style={{ color: '#10B981', margin: '0 auto 12px' }} />
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                    Cola al día
                  </h3>
                  <p style={{ fontSize: 13, margin: 0, color: 'var(--text-muted)' }}>
                    No hay propuestas pendientes de visto bueno. Todos los matches propuestos han sido procesados.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {reviewQueue.map(item => (
                    <div
                      key={item.id}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 16,
                        padding: 22,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.08)'
                      }}
                    >
                      {/* Cabecera de la Tarjeta */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 10,
                        borderBottom: '1px solid var(--border-color)',
                        paddingBottom: 12
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 8,
                            background: 'rgba(124, 58, 237, 0.15)',
                            color: '#A78BFA',
                            border: '1px solid rgba(124, 58, 237, 0.3)'
                          }}>
                            <User size={13} /> {item.psychologist_name || 'Psicóloga'}
                          </span>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '3px 10px',
                            borderRadius: 8,
                            background: 'rgba(255,255,255,0.06)',
                            color: 'var(--text-secondary)'
                          }}>
                            <MapPin size={13} /> {item.city || 'Bogotá'}
                          </span>
                        </div>
                        {item.fecha_propuesta_label && item.fecha_propuesta_label !== '-' ? (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <Clock size={13} /> Propuesto: {item.fecha_propuesta_label}
                          </span>
                        ) : item.fecha_hecho && item.fecha_hecho !== '-' && !item.fecha_hecho.startsWith("2026-08-23") ? (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <Clock size={13} /> Propuesto: {item.fecha_hecho}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <Clock size={13} /> Propuesto: -
                          </span>
                        )}
                      </div>

                      {/* PERSONA A Y PERSONA B LADO A LADO */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                        gap: 16,
                        alignItems: 'stretch'
                      }}>
                        {/* Tarjeta Persona A */}
                        <div style={{
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 12,
                          padding: 16,
                          display: 'flex',
                          gap: 14
                        }}>
                          <UserAvatar url={item.person_a_photo_url} name={item.person_a} size={56} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>
                              Persona A (Cliente)
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <CrmPersonLink crmId={item.person_a_crm_id} name={item.person_a} style={{ fontWeight: 800, color: 'var(--text-primary)' }} />
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                              {item.person_a_age ? `${item.person_a_age} años` : 'Edad no registrada'} • {item.person_a_city || item.city || 'Bogotá'}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Briefcase size={12} /> {item.person_a_occupation || 'Ocupación no especificada'}
                            </div>
                            {burbujasCrm(item.person_a_social_group, item.person_a_estatura, item.person_a_religion, item.person_a_politica)}
                            {item.cliente_desde && (
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                                Cliente en espera desde {item.cliente_desde}{item.dias_espera_cliente != null ? ` (${item.dias_espera_cliente} días)` : ''}
                              </div>
                            )}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: 'rgba(184, 50, 79, 0.15)',
                                border: '1px solid rgba(184, 50, 79, 0.3)',
                                color: '#FF758F'
                              }}>
                                {item.person_a_plan_tier || item.plan_tier || 'Estándar'}
                              </span>
                              <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: item.person_a_dates_remaining > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                border: `1px solid ${item.person_a_dates_remaining > 0 ? '#10B98150' : '#EF444450'}`,
                                color: item.person_a_dates_remaining > 0 ? '#10B981' : '#EF4444'
                              }}>
                                {item.person_a_dates_remaining > 0 ? `${item.person_a_dates_remaining} citas restantes` : '0 citas restantes'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Tarjeta Persona B */}
                        <div style={{
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 12,
                          padding: 16,
                          display: 'flex',
                          gap: 14
                        }}>
                          <UserAvatar url={item.person_b_photo_url} name={item.person_b} size={56} bg="linear-gradient(135deg, #065f46, #10b981)" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#10B981', textTransform: 'uppercase', marginBottom: 2 }}>
                              Persona B (Candidata)
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#10B981', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {item.person_b && item.person_b.trim() ? (
                                <CrmPersonLink crmId={item.person_b_crm_id} name={item.person_b} style={{ fontWeight: 800, color: '#10B981' }} />
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>Por definir</span>
                              )}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                              {item.person_b_age ? `${item.person_b_age} años` : 'Edad no registrada'} • {item.person_b_city || item.city || 'Bogotá'}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Briefcase size={12} /> {item.person_b_occupation || 'Ocupación no especificada'}
                            </div>
                            {burbujasCrm(item.person_b_social_group, item.person_b_estatura, item.person_b_religion, item.person_b_politica)}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                color: '#10B981'
                              }}>
                                {item.person_b_plan_tier || 'Candidata activa'}
                              </span>
                              <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: item.person_b_dates_remaining > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                border: `1px solid ${item.person_b_dates_remaining > 0 ? '#10B98150' : '#F59E0B50'}`,
                                color: item.person_b_dates_remaining > 0 ? '#10B981' : '#F59E0B'
                              }}>
                                {item.person_b_dates_remaining > 0 ? `${item.person_b_dates_remaining} citas restantes` : '0 citas (Oportunidad comercial)'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Análisis con IA de la pareja: se abre en un modal */}
                      {(() => {
                        const an = analisisIA[item.id] || item.analisis_ia
                        const col = !an ? '#6B7280' : an.puntaje >= 7 ? '#10B981' : an.puntaje >= 5 ? '#F59E0B' : '#EF4444'
                        const lista = (titulo, arr, color) => (arr && arr.length > 0) ? (
                          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: color, marginBottom: 6, textTransform: 'uppercase' }}>{titulo}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {arr.map((t, k) => (
                                <div key={k} style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, paddingLeft: 10, borderLeft: `3px solid ${color}` }}>{t}</div>
                              ))}
                            </div>
                          </div>
                        ) : null
                        return (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                              <button type="button" onClick={() => abrirAnalisis(item)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: '1px solid #B8324F', background: 'rgba(184, 50, 79, 0.10)', color: '#B8324F', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                                <Sparkles size={15} />
                                {an ? 'Ver análisis con IA' : 'Analizar con IA'}
                              </button>
                              {an && (
                                <>
                                  <span style={{ fontSize: 15, fontWeight: 900, color: col }}>{an.puntaje}/10</span>
                                  <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: col, color: '#fff' }}>{an.veredicto}</span>
                                </>
                              )}
                            </div>

                            {modalAnalisis === item.id && (
                              <div onClick={() => setModalAnalisis(null)}
                                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                                <div onClick={(e) => e.stopPropagation()}
                                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, width: '100%', maxWidth: 920, maxHeight: '92vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                                    <div>
                                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Análisis con IA de la pareja</div>
                                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                                        {item.person_a} <span style={{ color: '#B8324F' }}>x</span> <span style={{ color: '#10B981' }}>{item.person_b}</span>
                                      </div>
                                    </div>
                                    <button type="button" onClick={() => setModalAnalisis(null)}
                                      style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                                      Cerrar
                                    </button>
                                  </div>

                                  {analizando === item.id && !an && (
                                    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                                      Analizando la pareja con las notas y los datos del CRM. Puede tardar entre 10 y 40 segundos...
                                    </div>
                                  )}
                                  {errorIA[item.id] && (
                                    <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#EF4444', fontSize: 13, fontWeight: 600 }}>
                                      {errorIA[item.id]}
                                      <div style={{ marginTop: 8 }}>
                                        <button type="button" onClick={() => analizarPar(item)} disabled={analizando === item.id}
                                          style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#B8324F', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                                          Intentar de nuevo
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {an && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 34, fontWeight: 900, color: col }}>{an.puntaje}/10</span>
                                        <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 20, background: col, color: '#fff' }}>{an.veredicto}</span>
                                        {an.confirmar_foto && <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 20, border: '1px solid #F59E0B', color: '#B45309' }}>CONFIRMAR FOTO (máximo 7)</span>}
                                      </div>
                                      {an.resumen && <div style={{ fontSize: 14.5, color: 'var(--text-primary)', lineHeight: 1.55 }}>{an.resumen}</div>}

                                      {item.observations && (
                                        <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 10, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                                          <strong style={{ color: 'var(--text-primary)' }}>Nota de la psicóloga ({item.psychologist_name}): </strong>
                                          <em>{item.observations}</em>
                                        </div>
                                      )}

                                      {(an.perfil_a || an.perfil_b) && (
                                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                          {an.perfil_a && <div style={{ flex: '1 1 320px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}><strong style={{ color: 'var(--text-primary)' }}>{item.person_a}: </strong>{an.perfil_a}</div>}
                                          {an.perfil_b && <div style={{ flex: '1 1 320px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}><strong style={{ color: '#10B981' }}>{item.person_b}: </strong>{an.perfil_b}</div>}
                                        </div>
                                      )}

                                      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                                        {lista('Puntos fuertes', an.puntos_fuertes, '#10B981')}
                                        {lista('Puntos a considerar', an.puntos_a_considerar, '#F59E0B')}
                                      </div>
                                      {lista('Vetos', an.vetos, '#EF4444')}
                                      {lista('Preguntas para la psicóloga', an.preguntas_para_psicologa, '#3B82F6')}
                                      {an.condicion_para_subir_puntaje && <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}><strong>Para subir el puntaje: </strong>{an.condicion_para_subir_puntaje}</div>}
                                      {an.recomendacion && <div style={{ fontSize: 13.5, color: 'var(--text-primary)', background: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 8, lineHeight: 1.5 }}><strong>Qué haría: </strong>{an.recomendacion}</div>}
                                      {lista('Alertas de ficha', an.alertas_ficha, '#7C3AED')}
                                      {an.flag_inventario && <div style={{ fontSize: 13, color: '#B45309', fontWeight: 700 }}>Inventario: {an.flag_inventario}</div>}

                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Generado {an.generado_en} con {an.modelo}. Es una ayuda para decidir: la psicóloga confirma círculo social y fotos.</div>
                                        <button type="button" onClick={() => analizarPar(item, true)} disabled={analizando === item.id}
                                          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                          {analizando === item.id ? 'Analizando...' : 'Volver a analizar'}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        )
                      })()}

                      <ChatNotas matchId={item.id} total={item.notas_total} API={API} token={token} />

                      {/* Botones de Acción: Aprobar (1 clic) vs Rechazar (1 clic con motivo) */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
                        <button
                          onClick={() => { setRejectModalMatch(item); setRejectCategory(''); setRejectReason(''); }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 18px',
                            background: 'transparent',
                            color: '#EF4444',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <Undo2 size={15} />
                          Rechazar Match (1 clic con motivo)
                        </button>

                        <button
                          onClick={() => handleApproveMatch(item.id)}
                          disabled={approvingId === item.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 22px',
                            background: '#16A34A',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '0 2px 10px rgba(22, 163, 74, 0.35)',
                            opacity: approvingId === item.id ? 0.6 : 1,
                            transition: 'all 0.2s'
                          }}
                        >
                          {approvingId === item.id ? (
                            <>
                              <RefreshCw size={15} className="animate-spin" />
                              Aprobando...
                            </>
                          ) : (
                            <>
                              <Check size={16} />
                              Aprobar Match (1 solo clic)
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Controles de Paginación */}
                {totalPagesReview > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 24 }}>
                    <button
                      type="button"
                      disabled={pageReview <= 1 || loadingReview}
                      onClick={() => setPageReview(p => Math.max(1, p - 1))}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-card)',
                        color: pageReview <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: pageReview <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: 13,
                        fontWeight: 600
                      }}
                    >
                      ← Anterior
                    </button>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Página <strong style={{ color: 'var(--text-primary)' }}>{pageReview}</strong> de <strong style={{ color: 'var(--text-primary)' }}>{totalPagesReview}</strong>
                    </span>
                    <button
                      type="button"
                      disabled={pageReview >= totalPagesReview || loadingReview}
                      onClick={() => setPageReview(p => Math.min(totalPagesReview, p + 1))}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-card)',
                        color: pageReview >= totalPagesReview ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: pageReview >= totalPagesReview ? 'not-allowed' : 'pointer',
                        fontSize: 13,
                        fontWeight: 600
                      }}
                    >
                      Siguiente →
                    </button>
                  </div>
                )}
              </>
            )}
            </>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* VISTA 2: CITAS POR AGENDAR (SERVICIO AL CLIENTE)                     */}
      {/* ==================================================================== */}
      {activeTab === 'servicio' && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Mostrando <strong style={{ color: 'var(--text-primary)' }}>{serviceMatches.length}</strong> matches aprobados listos para agendamiento
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: '#3B82F6',
              background: 'rgba(59, 130, 246, 0.1)',
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid rgba(59, 130, 246, 0.25)'
            }}>
              <PhoneCall size={13} />
              <span>Gestión de llamadas a Persona A y Persona B para fecha y restaurante de la cita.</span>
            </div>
          </div>

          {loadingService ? (
            <div style={{
              textAlign: 'center',
              padding: 60,
              background: 'var(--bg-card)',
              borderRadius: 14,
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)'
            }}>
              <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: '#B8324F' }} />
              <p style={{ margin: 0, fontSize: 14 }}>Cargando citas por agendar...</p>
            </div>
          ) : serviceMatches.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: 60,
              background: 'var(--bg-card)',
              borderRadius: 14,
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)'
            }}>
              <CheckCircle size={40} style={{ color: '#10B981', margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                No hay citas pendientes por agendar
              </h3>
              <p style={{ fontSize: 13, margin: 0, color: 'var(--text-muted)' }}>
                Todos los matches aprobados ya han sido agendados o no hay registros pendientes en Servicio al Cliente.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {serviceMatches.map(match => (
                <div
                  key={match.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 14,
                    padding: 20,
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 18,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(184, 50, 79, 0.15)',
                        color: '#FF758F',
                        border: '1px solid rgba(184, 50, 79, 0.3)'
                      }}>
                        {match.psychologist_name || 'Psicóloga'}
                      </span>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--text-secondary)'
                      }}>
                        <MapPin size={12} /> {match.city || 'Bogotá'}
                      </span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: `${match.plan_color || '#555'}20`,
                        border: `1px solid ${match.plan_color || '#555'}50`,
                        color: match.plan_color || '#ccc'
                      }}>
                        {match.plan_tier || 'Estándar'}
                      </span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10B981',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <CheckCircle size={12} />
                        ✓ Aprobado por María {(match.approved_at || match.date) ? `• ${match.approved_at || match.date}` : ''}
                      </span>
                    </div>

                    {/* Nombres de los clientes */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                      <div style={{
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 10,
                        padding: 12
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>PERSONA A</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <UserAvatar url={match.person_a_photo_url} name={match.person_a} size={36} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <CrmPersonLink crmId={match.person_a_crm_id} name={match.person_a} style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }} />
                            </div>
                            {!isCsOnly && burbujasCrm(match.person_a_social_group, match.person_a_estatura, match.person_a_religion, match.person_a_politica)}
                            {estadoPersona(match, 'a')}
                            {match.person_a_phone && (
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'monospace' }}>
                                📞 {match.person_a_phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 10,
                        padding: 12
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>PERSONA B</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <UserAvatar url={match.person_b_photo_url} name={match.person_b} size={36} bg="linear-gradient(135deg, #065f46, #10b981)" />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#10B981', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {match.person_b && match.person_b.trim() ? (
                                <CrmPersonLink crmId={match.person_b_crm_id} name={match.person_b} style={{ fontWeight: 800, fontSize: 14, color: '#10B981' }} />
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>Por definir</span>
                              )}
                            </div>
                            {!isCsOnly && burbujasCrm(match.person_b_social_group, match.person_b_estatura, match.person_b_religion, match.person_b_politica)}
                            {estadoPersona(match, 'b')}
                            {match.person_b_phone && (
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'monospace' }}>
                                📞 {match.person_b_phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Chat de notas de la pareja */}
                    <ChatNotas matchId={match.id} total={match.notas_total} API={API} token={token} />
                  </div>

                  {/* Acciones de CS */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', minWidth: 200 }}>
                    <button
                      onClick={() => setScheduleModalMatch(match)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '10px 18px',
                        background: '#B8324F',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(184, 50, 79, 0.3)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <CalendarIcon size={14} />
                      Agendar Cita en Restaurante
                    </button>

                    <select
                      value={match.service_status || 'Por Llamar'}
                      onChange={e => handleUpdateServiceStatus(match.id, e.target.value)}
                      disabled={updatingId === match.id}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="Por Llamar">📞 Por Llamar</option>
                      <option value="Llamado 1">📞 Llamado 1</option>
                      <option value="En Conversación">💬 En Conversación</option>
                      <option value="Rechazó Match">❌ Rechazó Match</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal para Devolver / Rechazar Propuesta por María */}
      {rejectModalMatch && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          padding: 16
        }}>
          <div style={{
            width: '100%',
            maxWidth: 520,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: 14,
              marginBottom: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#B8324F', fontWeight: 800, fontSize: 16 }}>
                <Undo2 size={18} />
                <span>Rechazar Propuesta de Match</span>
              </div>
              <button
                onClick={() => setRejectModalMatch(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
              Rechazar match entre <strong style={{ color: 'var(--text-primary)' }}>{rejectModalMatch.person_a}</strong> y <strong style={{ color: '#10B981' }}>{rejectModalMatch.person_b}</strong>. Se devolverá a la psicóloga <strong style={{ color: 'var(--text-primary)' }}>{rejectModalMatch.psychologist_name}</strong> con el motivo visible, y el motor no volverá a sugerir esta pareja.
            </p>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                Motivo principal de rechazo (1 clic obligatorio):
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {REJECTION_CATEGORIES.map(cat => {
                  const isSelected = rejectCategory === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setRejectCategory(cat.id)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: isSelected ? 800 : 600,
                        border: isSelected ? '2px solid #B8324F' : '1px solid var(--border-color)',
                        background: isSelected ? 'rgba(184, 50, 79, 0.2)' : 'var(--bg-base)',
                        color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        transition: 'all 0.15s'
                      }}
                    >
                      {isSelected && <Check size={14} color="#FF758F" />}
                      <span>{cat.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Detalle adicional para la psicóloga (opcional)
              </label>
              <textarea
                rows={3}
                placeholder="Observación complementaria sobre el criterio clínico..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: 12,
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10,
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                  resize: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setRejectModalMatch(null)}
                style={{
                  padding: '9px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleRejectMatch}
                disabled={rejecting || !rejectCategory}
                style={{
                  padding: '10px 20px',
                  background: '#B8324F',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: rejectCategory ? 'pointer' : 'not-allowed',
                  opacity: (rejecting || !rejectCategory) ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {rejecting ? 'Rechazando...' : 'Confirmar Rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Agendamiento en Restaurante */}
      {scheduleModalMatch && (
        <RestaurantFilterModal
          match={scheduleModalMatch}
          onClose={() => setScheduleModalMatch(null)}
          onConfirm={async (fullDateTime, finalVenueName, details) => {
            await handleSaveSchedule({
              scheduled_date: fullDateTime,
              venue: finalVenueName,
              city: details?.city || scheduleModalMatch.city || 'Bogotá'
            })
          }}
        />
      )}
    </div>
  )
}
