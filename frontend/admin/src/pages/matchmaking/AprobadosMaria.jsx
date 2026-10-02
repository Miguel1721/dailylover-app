import React, { useState, useEffect, useCallback } from 'react'
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

  // Filtros
  const [selectedPsyc, setSelectedPsyc] = useState('Todas')
  const [selectedCity, setSelectedCity] = useState('Todas')
  const [searchTerm, setSearchTerm] = useState('')
  const [approvalDate, setApprovalDate] = useState('')

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

  // 1. Cargar Cola de Revisión de María
  const fetchReviewQueue = useCallback(() => {
    setLoadingReview(true)
    let url = `${API}/api/v1/matchmaking/approval-queue?sort_by=oldest_first&page=${pageReview}&page_size=${pageSizeReview}&`
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
  }, [selectedPsyc, selectedCity, searchTerm, approvalDate, pageReview, pageSizeReview, token])

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

                      {/* Puntaje único, 3 Razones y Justificación */}
                      <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 12,
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12
                      }}>
                        {/* Veredicto */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                          <span style={{
                            fontSize: 13,
                            fontWeight: 800,
                            padding: '4px 12px',
                            borderRadius: 8,
                            background: item.compatibility_score >= 75 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                            color: item.compatibility_score >= 75 ? '#34D399' : '#FBBF24',
                            border: `1px solid ${item.compatibility_score >= 75 ? '#10B98150' : '#F59E0B50'}`
                          }}>
                            {item.compatibility_score || 80}/100 • {item.compatibility_verdict || 'RECOMENDADO'}
                          </span>
                        </div>

                        {/* 3 Razones Principales */}
                        {item.reasons && item.reasons.length > 0 && (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                              3 Razones Principales del Match:
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {item.reasons.map((r, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--text-primary)' }}>
                                  <CheckCircle size={14} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
                                  <span>{r}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Nota de la Psicóloga */}
                        {item.observations && (
                          <div style={{
                            background: 'var(--bg-base)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 8,
                            padding: 10,
                            fontSize: 12,
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8
                          }}>
                            <Sparkles size={14} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} />
                            <div>
                              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 2 }}>
                                Nota de la Psicóloga ({item.psychologist_name}):
                              </strong>
                              <p style={{ margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>{item.observations}</p>
                            </div>
                          </div>
                        )}
                      </div>

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
                            {burbujasCrm(match.person_a_social_group, match.person_a_estatura, match.person_a_religion, match.person_a_politica)}
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
                            {burbujasCrm(match.person_b_social_group, match.person_b_estatura, match.person_b_religion, match.person_b_politica)}
                            {match.person_b_phone && (
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'monospace' }}>
                                📞 {match.person_b_phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
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
