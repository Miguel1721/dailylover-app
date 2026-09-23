import { useEffect, useState, useMemo } from 'react'
import {
  Heart, Users, Calendar, AlertTriangle, ArrowRight,
  CheckCircle, Clock, Eye, Plus, MessageCircle,
  CheckSquare, Square, RefreshCw, Sparkles, Filter, Lock,
  ChevronRight, Award, ShieldCheck
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia')))
  ? window.location.origin
  : 'https://daily-lover.agentesia.cloud'

const PRIORITY_BADGES = {
  URGENTE: { bg: 'rgba(255, 77, 77, 0.18)', color: '#FF4D4D', border: '1px solid rgba(255,77,77,0.3)', label: '🔴 URGENTE' },
  ALTA: { bg: 'rgba(255, 152, 0, 0.18)', color: '#FF9800', border: '1px solid rgba(255,152,0,0.3)', label: '🟠 ALTA' },
  MEDIA: { bg: 'rgba(255, 235, 59, 0.15)', color: '#FFD54F', border: '1px solid rgba(255,235,59,0.3)', label: '🟡 MEDIA' },
  BAJA: { bg: 'rgba(76, 175, 80, 0.15)', color: '#4CAF50', border: '1px solid rgba(76,175,80,0.3)', label: '🟢 BAJA' }
}

const OFFICIAL_PSYCHOLOGISTS = ["STEFFY", "SILVI", "ANA", "JENN", "PIA", "ISA", "MPS"]

const resolvePsycCode = (u) => {
  const name = (u?.name || '').toUpperCase()
  const email = (u?.email || '').toUpperCase()
  if (name.includes('MPS') || name.includes('SALINAS') || email.includes('SALINAS') || email.includes('MPS')) return 'MPS'
  if (name.includes('JENN') || email.includes('JENN')) return 'JENN'
  if (name.includes('ANA') || email.includes('ANA')) return 'ANA'
  if (name.includes('SILVI') || email.includes('SILVI')) return 'SILVI'
  if (name.includes('STEFF') || email.includes('STEFF')) return 'STEFFY'
  if (name.includes('PIA') || email.includes('PIA')) return 'PIA'
  if (name.includes('ISA') || email.includes('ISA')) return 'ISA'
  if (name.includes('ALEJA') || email.includes('ALEJA')) return 'ALEJA'
  if (name.includes('MANU') || email.includes('MANU')) return 'MANU'
  if (name.includes('SOFI') || email.includes('SOFI')) return 'SOFI'
  if (name.includes('MAPE') || email.includes('MAPE')) return 'MAPE D'
  return name.split(' ')[0] || 'SILVI'
}

function formatMatchDate(rawDate) {
  if (!rawDate) return 'Por agendar'
  const str = String(rawDate).trim()
  const num = parseFloat(str)
  if (!isNaN(num) && num > 30000 && num < 70000) {
    const d = new Date((num - 25569) * 86400 * 1000)
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    }
  }
  return str
}

export default function MatchmakerDashboard() {
  const { user, token } = useAuth()
  const navigate = useNavigate()

  const isAdmin = Boolean(
    user?.role && (
      user.role === 'Admin' ||
      user.role === 'Super Admin' ||
      user.role.toLowerCase().includes('admin') ||
      user.role.toLowerCase().includes('director')
    )
  )

  const defaultPsyc = resolvePsycCode(user)
  const [activePsyc, setActivePsyc] = useState(defaultPsyc)

  const [supervisionData, setSupervisionData] = useState(null)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const [pendingMatches, setPendingMatches] = useState([])
  const [assignedClients, setAssignedClients] = useState([])
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const [newReminder, setNewReminder] = useState({
    title: '',
    client_name: '',
    client_phone: '',
    priority: 'ALTA',
    due_date: 'Hoy',
    notes: ''
  })

  // Obtener exclusivamente el registro de rendimiento SSOT de la psicóloga activa
  const myPerformance = useMemo(() => {
    if (!supervisionData?.rendimiento_psicologas) return null
    return supervisionData.rendimiento_psicologas.find(
      r => r.psicologa.toUpperCase() === activePsyc.toUpperCase()
    ) || null
  }, [supervisionData, activePsyc])

  const fetchDashboardData = async (fDesde = fechaDesde, fHasta = fechaHasta) => {
    setLoading(true)
    try {
      let supUrl = `${API}/api/v1/matchmaking/supervision-maria`
      const params = new URLSearchParams()
      if (fDesde) params.append('fecha_desde', fDesde)
      if (fHasta) params.append('fecha_hasta', fHasta)
      if (params.toString()) supUrl += `?${params.toString()}`

      const [supRes, matchesRes, usersRes, remRes] = await Promise.all([
        fetch(supUrl, { headers: { 'Authorization': `Bearer ${token}` } })
          .then(r => r.json())
          .catch(() => null),
        fetch(`${API}/api/v1/matchmaking/my-matches?psychologist=${encodeURIComponent(activePsyc)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(r => r.json())
          .catch(() => ({ matches: [] })),
        fetch(`${API}/api/v1/admin/users?responsable=${encodeURIComponent(activePsyc)}&limit=6`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(r => r.json())
          .catch(() => ({ users: [], total: 0 })),
        fetch(`${API}/api/v1/admin/reminders?matchmaker=${encodeURIComponent(activePsyc)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(r => r.json())
          .catch(() => ({ reminders: [] }))
      ])

      if (supRes) {
        setSupervisionData(supRes)
      }

      const mList = matchesRes?.matches || []
      const pend = mList.filter(m =>
        (m.status || '').toLowerCase().includes('listo') ||
        (m.status || '').toUpperCase().includes('PENDIENTE') ||
        (m.status || '').toUpperCase().includes('REVISAR') ||
        !m.approved_by_maria
      ).slice(0, 6)
      setPendingMatches(pend)

      setAssignedClients(usersRes?.users || [])
      setReminders(remRes?.reminders || [])
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [activePsyc, token])

  const handleFilter = (e) => {
    e.preventDefault()
    fetchDashboardData(fechaDesde, fechaHasta)
  }

  const handleResetFilter = () => {
    setFechaDesde('')
    setFechaHasta('')
    fetchDashboardData('', '')
  }

  const handleToggleReminder = (id) => {
    fetch(`${API}/api/v1/admin/reminders/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(() => fetchDashboardData())
      .catch(() => {
        setReminders(prev => prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item))
      })
  }

  const handleCreateReminder = (e) => {
    e.preventDefault()
    if (!newReminder.title) return

    fetch(`${API}/api/v1/admin/reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ ...newReminder, matchmaker: activePsyc })
    })
      .then(() => {
        setShowModal(false)
        setNewReminder({ title: '', client_name: '', client_phone: '', priority: 'ALTA', due_date: 'Hoy', notes: '' })
        fetchDashboardData()
      })
      .catch(() => {
        setShowModal(false)
      })
  }

  const displayName = user?.name || activePsyc

  return (
    <div>
      {/* ─── HEADER DEL DASHBOARD ─── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 28 }}>🌹</span>
            <h1 style={{ margin: 0, wordBreak: 'break-word' }}>¡Hola, {displayName}!</h1>
            <span style={{
              background: 'rgba(150, 21, 0, 0.15)',
              border: '1px solid rgba(150, 21, 0, 0.3)',
              color: '#FF8585',
              borderRadius: 20,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 700
            }}>
              Psicóloga Asignada: {activePsyc}
            </span>
          </div>
          <p className="page-subtitle">Panel de Control Clínico & Desempeño Asignado (Métricas Personales SSOT)</p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', maxWidth: '100%' }}>
          <button 
            className="btn btn-ghost"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderColor: 'var(--color-primary)', color: 'var(--color-primary)', whiteSpace: 'nowrap' }}
            onClick={() => setShowModal(true)}
          >
            <Plus size={16} />
            Crear Recordatorio
          </button>

          <button 
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap' }}
            onClick={() => navigate('/matchmaking/mis-matches')}
          >
            <Heart size={16} />
            Ir a Mis Matches
          </button>
        </div>
      </div>

      <div className="content-area">
        {/* Selector de Psicóloga para Administradores */}
        {isAdmin && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(150, 21, 0, 0.3)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              <ShieldCheck size={18} style={{ color: 'var(--color-primary)' }} />
              <span>Vista de Administrador — Ver Métricas por Psicóloga:</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {OFFICIAL_PSYCHOLOGISTS.map(p => (
                <button
                  key={p}
                  onClick={() => setActivePsyc(p)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 16,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: activePsyc === p ? '#961500' : 'rgba(255, 255, 255, 0.06)',
                    color: activePsyc === p ? '#FFFFFF' : 'var(--text-secondary)',
                    boxShadow: activePsyc === p ? '0 2px 8px rgba(150, 21, 0, 0.4)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── 1. STAT CARDS (4 KPIs ALINEADOS A SUS MÉTRICAS SSOT) ─── */}
        <div className="stats-grid">
          <div 
            className="stat-card" 
            style={{ borderLeft: '4px solid #4CAF50', cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={() => navigate('/matchmaking/mis-matches?quick=aprobados')}
            title="Ver matches aprobados por María"
          >
            <div className="stat-icon" style={{ background: 'rgba(76, 175, 80, 0.15)', color: '#4CAF50' }}>
              <CheckCircle size={20} />
            </div>
            <div className="stat-number" style={{ color: '#4CAF50' }}>
              {loading ? '...' : (myPerformance?.aprobados ?? 0)}
            </div>
            <div className="stat-label">Matches Aprobados por María</div>
            <div className="stat-trend" style={{ color: '#4CAF50' }}>Validados técnicamente ➔</div>
          </div>

          <div 
            className="stat-card" 
            style={{ borderLeft: '4px solid #B8324F', cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={() => navigate('/matchmaking/mis-matches')}
            title="Ver mis matches asignados"
          >
            <div className="stat-icon" style={{ background: 'rgba(184, 50, 79, 0.15)', color: '#B8324F' }}>
              <Heart size={20} />
            </div>
            <div className="stat-number" style={{ color: '#FF8585' }}>
              {loading ? '...' : (myPerformance?.asignados_matches ?? 0)}
            </div>
            <div className="stat-label">Total Asignados en Mesa Matches</div>
            <div className="stat-trend" style={{ color: '#B8324F' }}>Mesa operativa de trabajo ➔</div>
          </div>

          <div 
            className="stat-card" 
            style={{ borderLeft: '4px solid #FFC107', cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={() => navigate('/matchmaking/profiles')}
            title="Ver clientes asignados sin trabajar"
          >
            <div className="stat-icon" style={{ background: 'rgba(255, 193, 7, 0.15)', color: '#FFC107' }}>
              <Clock size={20} />
            </div>
            <div className="stat-number" style={{ color: '#FFC107' }}>
              {loading ? '...' : (myPerformance?.sin_trabajar ?? 0)}
            </div>
            <div className="stat-label">Clientes Sin Trabajar (Gap)</div>
            <div className="stat-trend" style={{ color: '#FFC107' }}>
              {myPerformance?.fecha_en_blanco && myPerformance.fecha_en_blanco !== '—'
                ? `Más antiguo: ${myPerformance.fecha_en_blanco}`
                : 'Revisar clientes asignados ➔'}
            </div>
          </div>

          <div 
            className="stat-card" 
            style={{ borderLeft: '4px solid #FF4D4D', cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={() => navigate('/matchmaking/mis-matches?status=TROUBLE')}
            title="Ver casos Trouble & Refunds"
          >
            <div className="stat-icon" style={{ background: 'rgba(255, 77, 77, 0.15)', color: '#FF4D4D' }}>
              <AlertTriangle size={20} />
            </div>
            <div className="stat-number" style={{ color: '#FF4D4D' }}>
              {loading ? '...' : ((myPerformance?.trouble || 0) + (myPerformance?.refunds || 0))}
            </div>
            <div className="stat-label">Casos Trouble & Refunds</div>
            <div className="stat-trend" style={{ color: '#FF4D4D' }}>
              {myPerformance ? `${myPerformance.trouble || 0} Trouble · ${myPerformance.refunds || 0} Refunds` : 'Requiere atención ➔'}
            </div>
          </div>
        </div>

        {/* ─── 2. TABLA 1: RENDIMIENTO MATCHMAKER (13 COLUMNAS SSOT) ─── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(150, 21, 0, 0.3)', marginBottom: 28 }}>
          {/* Título Wine Red */}
          <div style={{
            background: '#961500',
            color: 'white',
            padding: '12px 18px',
            fontSize: 15,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Rendimiento Matchmaker</span>
              <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>
                (13 Columnas SSOT — Métricas Asignadas Exclusivas)
              </span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.9, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Psicóloga: <strong>{activePsyc}</strong></span>
              <button
                onClick={() => fetchDashboardData(fechaDesde, fechaHasta)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: 6,
                  color: 'white',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11
                }}
                title="Refrescar métricas"
              >
                <RefreshCw size={11} className={loading ? 'spinner' : ''} /> Refrescar
              </button>
            </div>
          </div>

          {/* Barra de Filtro de Fechas */}
          <form onSubmit={handleFilter} style={{
            padding: '10px 18px',
            background: 'rgba(26, 18, 20, 0.95)',
            borderBottom: '1px solid rgba(150, 21, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} style={{ color: 'var(--color-primary)' }} /> Rango:
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Desde:</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={e => setFechaDesde(e.target.value)}
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Hasta:</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={e => setFechaHasta(e.target.value)}
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  outline: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-sm"
              style={{ fontSize: 11.5, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw size={11} /> Filtrar
            </button>

            {(fechaDesde || fechaHasta) && (
              <button
                type="button"
                onClick={handleResetFilter}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11.5, padding: '4px 8px' }}
              >
                Limpiar
              </button>
            )}
          </form>

          {/* Banners de Grupo (Gestión de Matches / Gestión de Perfiles) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '130px repeat(7, 1fr) repeat(3, 1fr) 75px 100px',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textAlign: 'center'
          }}>
            <div style={{ background: '#1A1214', borderBottom: '1px solid rgba(255,255,255,0.08)' }} />
            <div style={{
              gridColumn: 'span 7',
              background: 'rgba(150, 21, 0, 0.25)',
              color: '#ffb3b3',
              padding: '6px 4px',
              borderBottom: '1px solid rgba(150, 21, 0, 0.3)',
              borderRight: '1px solid rgba(255,255,255,0.08)'
            }}>
              GESTIÓN DE MATCHES
            </div>
            <div style={{
              gridColumn: 'span 3',
              background: 'rgba(27, 54, 93, 0.35)',
              color: '#b3d1ff',
              padding: '6px 4px',
              borderBottom: '1px solid rgba(27, 54, 93, 0.4)',
              borderRight: '1px solid rgba(255,255,255,0.08)'
            }}>
              GESTIÓN DE PERFILES
            </div>
            <div style={{ background: '#1A1214', borderBottom: '1px solid rgba(255,255,255,0.08)' }} />
            <div style={{ background: '#1A1214', borderBottom: '1px solid rgba(255,255,255,0.08)' }} />
          </div>

          {/* Encabezados y Fila de las 13 columnas */}
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#201618', borderBottom: '1px solid rgba(150, 21, 0, 0.2)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-primary)', width: 130 }}>Psicóloga</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#ffb3b3', title: 'Asignados en PROFILES' }}>Tab Profile</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#ffb3b3', title: 'Asignados tab de Matches' }}>Asignados Matches</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#ffb3b3' }}>Hechos</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#4CAF50' }}>Aprobados</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#ff8585' }}>No aprob.</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#FFC107' }}>Trouble</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#9A8A8D' }}>No hay gente</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#b3d1ff' }}>Sin trabajar</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#b3d1ff', fontSize: 11 }}>Fecha en blanco</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#b3d1ff' }}>Listos Match</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#FFC107' }}>Refunds</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)', width: 100 }}>ESTADO</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                      Cargando métricas asignadas de {activePsyc}...
                    </td>
                  </tr>
                ) : !myPerformance ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                      No se encontraron registros activos para la psicóloga <strong>{activePsyc}</strong> en el rango seleccionado.
                    </td>
                  </tr>
                ) : (
                  <tr style={{
                    background: 'rgba(150, 21, 0, 0.08)',
                    borderBottom: '1px solid rgba(150, 21, 0, 0.2)'
                  }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#FFD54F', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>👤</span> {myPerformance.psicologa}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>
                      {myPerformance.tab_profile}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>
                      {myPerformance.asignados_matches}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>
                      {myPerformance.hechos}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, color: '#4CAF50', fontSize: 13 }}>
                      {myPerformance.aprobados}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: myPerformance.no_aprobados > 0 ? '#ff8585' : 'var(--text-muted)' }}>
                      {myPerformance.no_aprobados}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: myPerformance.trouble > 0 ? '#FFC107' : 'var(--text-muted)' }}>
                      {myPerformance.trouble}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: myPerformance.no_hay_gente > 0 ? '#ffb3b3' : 'var(--text-muted)' }}>
                      {myPerformance.no_hay_gente}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: myPerformance.sin_trabajar > 0 ? '#FF9800' : '#4CAF50', fontWeight: 700 }}>
                      {myPerformance.sin_trabajar}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {myPerformance.fecha_en_blanco || '—'}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600, color: '#64B5F6' }}>
                      {myPerformance.listos_match}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: myPerformance.refunds > 0 ? '#FF5252' : 'var(--text-muted)' }}>
                      {myPerformance.refunds}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span className={`badge ${
                        myPerformance.estado === 'Al día' ? 'badge-green' :
                        myPerformance.estado === 'Intermedio' ? 'badge-yellow' :
                        myPerformance.estado === 'Atrasado' ? 'badge-red' : 'badge-gray'
                      }`} style={{ fontWeight: 700 }}>
                        {myPerformance.estado}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── 3. RECORDATORIOS & TAREAS PRIORITARIAS ─── */}
        <div className="card reminders-widget-card" style={{ marginBottom: 20, border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: 16 }}>
              <span style={{ fontSize: 20 }}>📌</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>Recordatorios & Tareas Prioritarias de Seguimiento</span>
              <span style={{ fontSize: 11, background: 'rgba(255,77,77,0.15)', color: '#FF4D4D', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                {reminders.filter(r => !r.completed).length} Pendientes
              </span>
            </div>

            <button 
              className="btn btn-ghost btn-sm"
              onClick={() => setShowModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            >
              <Plus size={14} /> Nuevo Recordatorio
            </button>
          </div>

          {loading ? (
            <div className="empty-state">Cargando recordatorios prioritarios...</div>
          ) : reminders.filter(r => !r.completed).length === 0 ? (
            <div className="empty-state">No tienes recordatorios pendientes. ¡Todo al día!</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
              {reminders.filter(r => !r.completed).map(r => {
                const badge = PRIORITY_BADGES[r.priority] || PRIORITY_BADGES.ALTA
                return (
                  <div 
                    key={r.id}
                    style={{
                      background: r.completed ? 'var(--bg-base)' : 'var(--bg-card)',
                      border: r.completed ? '1px solid var(--border-color)' : (badge.border || '1px solid var(--border-color)'),
                      borderRadius: 12,
                      padding: '14px 16px',
                      opacity: r.completed ? 0.6 : 1,
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: r.completed ? 'none' : '0 2px 8px rgba(150, 21, 0, 0.05)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: badge.bg, color: badge.color }}>
                          {badge.label}
                        </span>

                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} /> {r.due_date}
                        </span>
                      </div>

                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4, textDecoration: r.completed ? 'line-through' : 'none' }}>
                        {r.title}
                      </div>

                      {r.client_name && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                          👤 Cliente: <strong style={{ color: 'var(--text-primary)' }}>{r.client_name}</strong>
                        </div>
                      )}

                      {r.notes && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', background: 'var(--bg-base)', border: '1px solid var(--border-color)', padding: '6px 8px', borderRadius: 6, marginBottom: 10 }}>
                          "{r.notes}"
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border-color)', marginTop: 8 }}>
                      <button 
                        onClick={() => handleToggleReminder(r.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: r.completed ? '#4CAF50' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                      >
                        {r.completed ? <CheckSquare size={16} style={{ color: '#4CAF50' }} /> : <Square size={16} />}
                        <span>{r.completed ? 'Completado' : 'Marcar Listo'}</span>
                      </button>

                      {r.whatsapp_link && (
                        <a 
                          href={r.whatsapp_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#25D366', borderColor: 'rgba(37,211,102,0.3)', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11 }}
                          onClick={e => e.stopPropagation()}
                        >
                          <MessageCircle size={13} /> WhatsApp 1-Clic
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ─── 4. MATCHES PENDIENTES & CLIENTES ASIGNADOS ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
          {/* Matches Pendientes por Trabajar */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} style={{ color: 'var(--color-primary)' }} />
                Matches Pendientes de Revisión ({activePsyc})
              </div>
              <button 
                className="btn btn-ghost btn-sm"
                onClick={() => navigate('/matchmaking/mis-matches')}
              >
                Ver todos <ArrowRight size={13} style={{ marginLeft: 4 }} />
              </button>
            </div>

            {loading ? (
              <div className="empty-state">Cargando matches pendientes...</div>
            ) : pendingMatches.length === 0 ? (
              <div className="empty-state">
                <CheckCircle size={32} style={{ color: '#4CAF50', margin: '0 auto 12px', display: 'block' }} />
                ¡Excelente! No tienes parejas pendientes de aprobación hoy.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pendingMatches.map(m => (
                  <div 
                    key={m.id}
                    style={{
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 10,
                      padding: '14px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'transform 0.2s',
                      cursor: 'pointer'
                    }}
                    onClick={() => navigate('/matchmaking/mis-matches')}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.person_a}</span>
                        <Heart size={14} style={{ color: 'var(--color-primary)', fill: 'var(--color-primary)' }} />
                        <span style={{ fontWeight: 700, color: m.person_b ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {m.person_b || 'Buscando candidato...'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span>📍 {m.city || 'Bogotá'}</span>
                        <span style={{ color: '#FFC107', fontWeight: 600 }}>🏷️ {m.status || 'Listo para match'}</span>
                        {m.plan_tier && <span style={{ color: '#64B5F6' }}>💳 {m.plan_tier}</span>}
                      </div>
                    </div>

                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={(e) => { e.stopPropagation(); navigate('/matchmaking/mis-matches') }}
                    >
                      Abrir en Mesa
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clientes Asignados a mi Cargo */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} style={{ color: 'var(--color-primary)' }} />
                Clientes Asignados a {activePsyc}
              </div>
              <button 
                className="btn btn-ghost btn-sm"
                onClick={() => navigate('/matchmaking/profiles')}
              >
                Ver todos
              </button>
            </div>

            {loading ? (
              <div className="empty-state">Cargando tus clientes asignados...</div>
            ) : assignedClients.length === 0 ? (
              <div className="empty-state">No tienes clientes asignados actualmente.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {assignedClients.map(c => (
                  <div 
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'rgba(150,21,0,0.04)',
                      borderRadius: 8,
                      border: '1px solid rgba(150,21,0,0.1)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name || 'Sin nombre'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.phone || c.email}</div>
                    </div>

                    <button 
                      className="btn btn-ghost btn-sm"
                      onClick={() => navigate(`/matchmaking/profiles?search=${encodeURIComponent(c.name || c.phone || '')}`)}
                      title="Ver perfil de cliente"
                    >
                      <Eye size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── MODAL CREAR RECORDATORIO ─── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 440, maxWidth: '92vw' }}>
            <div className="modal-header">
              <div style={{ fontWeight: 700, fontSize: 18 }}>📌 Crear Nuevo Recordatorio</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateReminder} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Título de la Tarea *</label>
                <input 
                  type="text"
                  placeholder="Ej: Llamar a cliente para feedback post-cita"
                  value={newReminder.title}
                  onChange={e => setNewReminder({ ...newReminder, title: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Nombre de Cliente</label>
                  <input 
                    type="text"
                    placeholder="Ej: Juan Diego Puerta"
                    value={newReminder.client_name}
                    onChange={e => setNewReminder({ ...newReminder, client_name: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>WhatsApp / Teléfono</label>
                  <input 
                    type="text"
                    placeholder="Ej: 3101234567"
                    value={newReminder.client_phone}
                    onChange={e => setNewReminder({ ...newReminder, client_phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Prioridad</label>
                  <select 
                    value={newReminder.priority}
                    onChange={e => setNewReminder({ ...newReminder, priority: e.target.value })}
                  >
                    <option value="URGENTE">🔴 URGENTE (Vence Hoy)</option>
                    <option value="ALTA">🟠 ALTA (Próximos 2 días)</option>
                    <option value="MEDIA">🟡 MEDIA (Esta semana)</option>
                    <option value="BAJA">🟢 BAJA (General)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Fecha Vencimiento</label>
                  <input 
                    type="text"
                    placeholder="Ej: Hoy, 5:00 PM"
                    value={newReminder.due_date}
                    onChange={e => setNewReminder({ ...newReminder, due_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Notas / Instrucciones</label>
                <textarea 
                  rows={2}
                  placeholder="Detalles sobre lo que se debe verificar..."
                  value={newReminder.notes}
                  onChange={e => setNewReminder({ ...newReminder, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Guardar Recordatorio</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
