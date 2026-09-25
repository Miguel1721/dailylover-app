import React, { useState, useEffect } from 'react'
import { 
  Headphones, Calendar, Clock, MapPin, CheckCircle2, AlertTriangle, 
  RotateCcw, Utensils, MessageSquare, Search, RefreshCw, Plus, ExternalLink,
  ShieldAlert, PhoneCall, ChevronRight, Check, Copy, CheckCheck, Star
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CrmPersonLink from '../components/CrmPersonLink'
import RegistrarNovedadModal from '../components/RegistrarNovedadModal'
import NoShowModal from '../components/NoShowModal'
import FeedbackModal from '../components/FeedbackModal'
import RestaurantFilterModal from '../components/RestaurantFilterModal'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

function formatAlertTime(dateStr) {
  if (!dateStr) return ''
  try {
    let str = String(dateStr)
    if (!str.endsWith('Z') && !str.includes('+') && !str.slice(10).includes('-')) {
      str += 'Z'
    }
    const d = new Date(str)
    if (isNaN(d.getTime())) return str.slice(11, 16)
    return d.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  } catch (e) {
    return String(dateStr).slice(11, 16)
  }
}

function extractDateOnly(str) {
  if (!str) return null
  const matchIso = str.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (matchIso) return `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`
  const matchSlash = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (matchSlash) {
    const day = matchSlash[1].padStart(2, '0')
    const month = matchSlash[2].padStart(2, '0')
    return `${matchSlash[3]}-${month}-${day}`
  }
  return null
}

export default function CustomerServiceDashboard() {
  const { token, user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [allCitas, setAllCitas] = useState([])
  const [citasHoy, setCitasHoy] = useState([])
  const [citasSemana, setCitasSemana] = useState([])
  const [citasPendientesMesa, setCitasPendientesMesa] = useState([])
  const [novedadesRecientes, setNovedadesRecientes] = useState([])
  const [activeTab, setActiveTab] = useState('hoy') // 'hoy', 'semana', 'pendientes', 'todas'
  const [copiedId, setCopiedId] = useState(null)
  const [stats, setStats] = useState({
    hoy: 0,
    pendientes_restaurante: 0,
    confirmadas: 0,
    novedades_activas: 0
  })

  // Modales
  const [modalNovedadOpen, setModalNovedadOpen] = useState(false)
  const [selectedMatchForNovedad, setSelectedMatchForNovedad] = useState(null)
  const [noShowModalItem, setNoShowModalItem] = useState(null)
  const [feedbackModalItem, setFeedbackModalItem] = useState(null)
  const [restaurantModalMatch, setRestaurantModalMatch] = useState(null)
  const [filterCity, setFilterCity] = useState('Todas')
  const [searchTerm, setSearchTerm] = useState('')

  const todayStr = new Date().toISOString().slice(0, 10)

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Citas del calendario real desde endpoint oficial
      const resCitas = await fetch(`${API}/api/v1/matchmaking/calendar`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const dataCitas = resCitas.ok ? await resCitas.json() : {}
      const rawList = Array.isArray(dataCitas) ? dataCitas : (dataCitas.calendar || [])

      // Normalizar campos para compatibilidad completa
      const normalizedList = rawList.map(m => {
        const dtStr = String(m.date_time || m.scheduled_date || '').trim()
        const isoDate = extractDateOnly(dtStr)
        const ven = String(m.venue || '').trim()
        const isVenuePending = !ven || ven.toLowerCase().includes('definir') || ven === '-'
        return {
          ...m,
          id: m.calendar_id || m.id,
          calendar_id: m.calendar_id || m.id,
          persona_a: m.person_a || '',
          persona_b: m.person_b || '',
          restaurante_asignado: ven,
          ciudad: m.city || 'Bogotá',
          fecha_cita: dtStr,
          iso_date: isoDate,
          hora: formatAlertTime(dtStr),
          is_venue_pending: isVenuePending
        }
      })

      setAllCitas(normalizedList)

      // Segmentación inteligente
      const hoy = normalizedList.filter(m => m.iso_date === todayStr)
      const semana = normalizedList.filter(m => m.iso_date && m.iso_date >= todayStr)
      const pendMesa = normalizedList.filter(m => m.is_venue_pending || !m.reservation_confirmed)

      setCitasHoy(hoy)
      setCitasSemana(semana)
      setCitasPendientesMesa(pendMesa)

      // Si no hay citas hoy, preseleccionar la pestaña de próximas o pendientes si tienen datos
      if (hoy.length === 0 && semana.length > 0 && activeTab === 'hoy') {
        // Mantener hoy pero dejar que el usuario vea la pestaña con el badge
      }

      // 2. Novedades activas desde endpoint oficial
      const resNov = await fetch(`${API}/api/v1/admin/cs-novedades?status_filter=ALL&limit=30`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const dataNov = resNov.ok ? await resNov.json() : {}
      const novList = Array.isArray(dataNov) ? dataNov : (dataNov.novedades || [])
      setNovedadesRecientes(novList)

      // Calcular estadísticas operativas
      const pendRestCount = pendMesa.length
      const confCount = normalizedList.filter(m => m.reservation_confirmed).length
      const novCount = (dataNov.unread_count !== undefined) 
        ? dataNov.unread_count 
        : novList.filter(n => n.status === 'PENDIENTE' || !n.status).length

      setStats({
        hoy: hoy.length,
        pendientes_restaurante: pendRestCount,
        confirmadas: confCount,
        novedades_activas: novCount
      })
    } catch (e) {
      console.error("Error cargando CustomerServiceDashboard:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [token])

  // Obtener lista según pestaña activa
  const getActiveList = () => {
    switch (activeTab) {
      case 'hoy': return citasHoy
      case 'semana': return citasSemana.length > 0 ? citasSemana : allCitas.slice(0, 50)
      case 'pendientes': return citasPendientesMesa
      case 'todas': return allCitas.slice(0, 100)
      default: return citasHoy
    }
  }

  const filteredCitas = getActiveList().filter(m => {
    const text = `${m.persona_a || ''} ${m.persona_b || ''} ${m.restaurante_asignado || ''} ${m.ciudad || ''}`.toLowerCase()
    const matchesSearch = !searchTerm || text.includes(searchTerm.toLowerCase())
    const matchesCity = filterCity === 'Todas' || (m.ciudad && m.ciudad.toLowerCase() === filterCity.toLowerCase())
    return matchesSearch && matchesCity
  })

  // Copiar plantilla WhatsApp al portapapeles
  const copyWhatsappMsg = (text, type, id) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedId(`${id}-${type}`)
    setTimeout(() => setCopiedId(null), 2500)
  }

  // Guardar asignación de restaurante
  const handleRestaurantConfirm = async (newDateTime, newVenue) => {
    if (!restaurantModalMatch) return
    const calId = restaurantModalMatch.calendar_id || restaurantModalMatch.id
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/calendar/${calId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date_time: newDateTime,
          scheduled_date: newDateTime,
          venue: newVenue,
          reservation_confirmed: true
        })
      })
      if (res.ok) {
        setRestaurantModalMatch(null)
        fetchData()
      } else {
        alert('Error al actualizar restaurante')
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Resolver novedad
  const handleResolveNovedad = async (novId) => {
    try {
      const res = await fetch(`${API}/api/v1/admin/cs-novedades/${novId}/resolve`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        fetchData()
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="content-area" style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26 }}>🎧</span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Mesa de Control — Servicio al Cliente</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 14 }}>
            Monitoreo logístico en vivo de citas ({allCitas.length} en base de datos), reservas con restaurantes aliados y novedades de última hora.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => { setSelectedMatchForNovedad(null); setModalNovedadOpen(true); }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 13 }}
          >
            <Plus size={16} />
            Registrar Novedad
          </button>
          <button
            onClick={fetchData}
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 13 }}
            title="Refrescar datos"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas de CS */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div 
          className="stat-card" 
          style={{ borderLeft: '4px solid #c41a00', cursor: 'pointer' }}
          onClick={() => setActiveTab('hoy')}
        >
          <div className="stat-icon" style={{ background: 'rgba(196, 26, 0, 0.15)', color: '#c41a00' }}>
            <Calendar size={20} />
          </div>
          <div className="stat-number">{loading ? '...' : stats.hoy}</div>
          <div className="stat-label">Citas Programadas para Hoy</div>
          <div className="stat-trend" style={{ color: stats.hoy > 0 ? '#4CAF50' : 'var(--text-muted)' }}>
            {stats.hoy > 0 ? 'En seguimiento activo' : 'Ver próximas citas'}
          </div>
        </div>

        <div 
          className="stat-card" 
          style={{ borderLeft: '4px solid #FFC107', cursor: 'pointer' }}
          onClick={() => setActiveTab('pendientes')}
        >
          <div className="stat-icon" style={{ background: 'rgba(255, 193, 7, 0.15)', color: '#FFC107' }}>
            <Utensils size={20} />
          </div>
          <div className="stat-number">{loading ? '...' : stats.pendientes_restaurante}</div>
          <div className="stat-label">Mesas Por Coordinar</div>
          <div className="stat-trend" style={{ color: '#FFC107' }}>Requieren reserva con aliado</div>
        </div>

        <div 
          className="stat-card" 
          style={{ borderLeft: '4px solid #4CAF50', cursor: 'pointer' }}
          onClick={() => setActiveTab('todas')}
        >
          <div className="stat-icon" style={{ background: 'rgba(76, 175, 80, 0.15)', color: '#4CAF50' }}>
            <CheckCircle2 size={20} />
          </div>
          <div className="stat-number">{loading ? '...' : stats.confirmadas}</div>
          <div className="stat-label">Reservas Confirmadas</div>
          <div className="stat-trend" style={{ color: '#4CAF50' }}>Parejas con restaurante listo</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #ff4d4d' }}>
          <div className="stat-icon" style={{ background: 'rgba(255, 77, 77, 0.15)', color: '#ff4d4d' }}>
            <AlertTriangle size={20} />
          </div>
          <div className="stat-number">{loading ? '...' : stats.novedades_activas}</div>
          <div className="stat-label">Novedades Operativas</div>
          <div className="stat-trend" style={{ color: stats.novedades_activas > 0 ? '#ff4d4d' : 'var(--text-muted)' }}>
            {stats.novedades_activas > 0 ? 'Retrasos / Reprogramaciones' : 'Operación al día'}
          </div>
        </div>
      </div>

      {/* Contenido Principal: Citas Agendadas + Novedades */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 24 }}>
        
        {/* Columna Izquierda: Citas */}
        <div className="card" style={{ padding: 24 }}>
          {/* Pestañas de Segmentación Operativa */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('hoy')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: activeTab === 'hoy' ? '1px solid var(--color-primary)' : '1px solid transparent',
                background: activeTab === 'hoy' ? 'rgba(150, 21, 0, 0.15)' : 'transparent',
                color: activeTab === 'hoy' ? 'var(--color-primary-light)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'hoy' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>📌 Hoy</span>
              <span className="badge badge-red" style={{ fontSize: 10 }}>{citasHoy.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('semana')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: activeTab === 'semana' ? '1px solid var(--color-primary)' : '1px solid transparent',
                background: activeTab === 'semana' ? 'rgba(150, 21, 0, 0.15)' : 'transparent',
                color: activeTab === 'semana' ? 'var(--color-primary-light)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'semana' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>📅 Próximas Citas</span>
              <span className="badge badge-gray" style={{ fontSize: 10 }}>{citasSemana.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('pendientes')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: activeTab === 'pendientes' ? '1px solid #FFC107' : '1px solid transparent',
                background: activeTab === 'pendientes' ? 'rgba(255, 193, 7, 0.15)' : 'transparent',
                color: activeTab === 'pendientes' ? '#FFC107' : 'var(--text-secondary)',
                fontWeight: activeTab === 'pendientes' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>🍽️ Mesas por Coordinar</span>
              <span className="badge badge-yellow" style={{ fontSize: 10 }}>{citasPendientesMesa.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('todas')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: activeTab === 'todas' ? '1px solid var(--color-primary)' : '1px solid transparent',
                background: activeTab === 'todas' ? 'rgba(150, 21, 0, 0.15)' : 'transparent',
                color: activeTab === 'todas' ? 'var(--color-primary-light)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'todas' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>📑 Todas</span>
              <span className="badge badge-gray" style={{ fontSize: 10 }}>{allCitas.length}</span>
            </button>
          </div>

          {/* Barra de Filtros */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={17} style={{ color: 'var(--color-primary)' }} />
              {activeTab === 'hoy' ? `Citas del Día (${filteredCitas.length})` :
               activeTab === 'semana' ? `Próximas Citas (${filteredCitas.length})` :
               activeTab === 'pendientes' ? `Mesas Pendientes de Reserva (${filteredCitas.length})` :
               `Listado de Citas (${filteredCitas.length})`}
            </h3>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Buscar persona o restaurante..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: '6px 10px 6px 30px',
                    fontSize: 12,
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    width: 200
                  }}
                />
              </div>

              <select
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  color: 'var(--text-primary)'
                }}
              >
                <option value="Todas">Todas las ciudades</option>
                <option value="Bogotá">Bogotá</option>
                <option value="Medellín">Medellín</option>
                <option value="Cali">Cali</option>
                <option value="Barranquilla">Barranquilla</option>
                <option value="Bucaramanga">Bucaramanga</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              Sincronizando base de datos de citas...
            </div>
          ) : filteredCitas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px dashed var(--border-color)' }}>
              <Calendar size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                {activeTab === 'hoy' ? 'No hay citas agendadas para el día de hoy' : 'No se encontraron citas con estos filtros'}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 16px' }}>
                {activeTab === 'hoy' ? 'Explora las próximas citas o revisa las mesas pendientes de asignación.' : 'Prueba cambiando la ciudad o el término de búsqueda.'}
              </p>
              {activeTab === 'hoy' && (
                <button
                  onClick={() => setActiveTab('semana')}
                  className="btn btn-primary btn-sm"
                >
                  Ver Próximas Citas ({citasSemana.length})
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '680px', overflowY: 'auto', paddingRight: 4 }}>
              {filteredCitas.map((m, idx) => {
                const tieneRestaurante = !m.is_venue_pending && m.restaurante_asignado
                return (
                  <div
                    key={m.id || idx}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${m.reservation_confirmed ? 'rgba(76, 175, 80, 0.3)' : 'var(--border-color)'}`,
                      borderRadius: 10,
                      padding: 16,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        background: tieneRestaurante ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 193, 7, 0.15)',
                        color: tieneRestaurante ? '#4CAF50' : '#FFC107',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 11,
                        lineHeight: 1.2,
                        padding: 4,
                        textAlign: 'center'
                      }}>
                        <span>{m.hora || 'PM'}</span>
                        <span style={{ fontSize: 9, opacity: 0.8 }}>{m.iso_date ? m.iso_date.slice(5) : ''}</span>
                      </div>

                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CrmPersonLink personName={m.persona_a} />
                          <span style={{ color: 'var(--color-primary)', fontWeight: 400 }}>♥</span>
                          <CrmPersonLink personName={m.persona_b} />
                          {m.reservation_confirmed && (
                            <span className="badge badge-green" style={{ fontSize: 10 }}>Confirmada</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <span>📍 {m.ciudad || 'Bogotá'}</span>
                          <span>🍽️ <strong>{tieneRestaurante ? m.restaurante_asignado : 'Mesa por coordinar'}</strong></span>
                          <span>📅 {m.fecha_cita || 'Fecha pendiente'}</span>
                          {m.reservation_name && <span>🏷️ Reserva: {m.reservation_name}</span>}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* Botón Asignar / Cambiar Mesa */}
                      <button
                        onClick={() => setRestaurantModalMatch(m)}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11 }}
                        title="Asignar o cambiar restaurante aliado"
                      >
                        <Utensils size={13} style={{ marginRight: 4 }} />
                        {tieneRestaurante ? 'Cambiar Mesa' : 'Asignar Mesa'}
                      </button>

                      {/* Botón Copiar WhatsApp Confirmación */}
                      {m.whatsapp_confirmacion && (
                        <button
                          onClick={() => copyWhatsappMsg(m.whatsapp_confirmacion, 'confirmacion', m.id)}
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11, color: copiedId === `${m.id}-confirmacion` ? '#4CAF50' : 'var(--text-secondary)' }}
                          title="Copiar mensaje de confirmación para WhatsApp"
                        >
                          {copiedId === `${m.id}-confirmacion` ? (
                            <><CheckCheck size={13} style={{ marginRight: 4 }} /> Copiado</>
                          ) : (
                            <><Copy size={13} style={{ marginRight: 4 }} /> Confirmación</>
                          )}
                        </button>
                      )}

                      {/* Botón Novedad */}
                      <button
                        onClick={() => { setSelectedMatchForNovedad(m); setModalNovedadOpen(true); }}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, borderColor: '#ff9800', color: '#ff9800' }}
                        title="Registrar novedad o solicitud de cliente"
                      >
                        <AlertTriangle size={13} style={{ marginRight: 4 }} />
                        Novedad
                      </button>

                      {/* Botón Feedback */}
                      <button
                        onClick={() => setFeedbackModalItem(m)}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, color: '#3B82F6' }}
                        title="Registrar feedback de la cita"
                      >
                        <Star size={13} style={{ marginRight: 4 }} />
                        Feedback
                      </button>

                      {/* Botón No-Show */}
                      <button
                        onClick={() => setNoShowModalItem(m)}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, borderColor: '#ff4d4d', color: '#ff4d4d' }}
                        title="Registrar inasistencia"
                      >
                        No-Show
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Columna Derecha: Novedades Recientes & Enlaces Operativos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Novedades Operativas */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} style={{ color: '#ff9800' }} />
                Novedades en Vivo ({novedadesRecientes.length})
              </h3>
              <span className="badge badge-red" style={{ fontSize: 10 }}>CS Live</span>
            </div>

            {novedadesRecientes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                ✓ Sin novedades críticas registradas
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '360px', overflowY: 'auto' }}>
                {novedadesRecientes.map((nov, idx) => (
                  <div
                    key={nov.id || idx}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      borderLeft: `3px solid ${nov.novedad_type === 'PAUSE' ? '#ff4d4d' : '#ff9800'}`,
                      borderRadius: 6,
                      padding: 10,
                      fontSize: 12
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span style={{ color: 'var(--text-primary)' }}>{nov.client_name || 'Cliente'}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{nov.created_at || ''}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span className="badge badge-yellow" style={{ fontSize: 10 }}>
                        {nov.novedad_type || 'NOVEDAD'}
                      </span>
                      {nov.status && (
                        <span className={`badge ${nov.status === 'PENDIENTE' ? 'badge-red' : 'badge-green'}`} style={{ fontSize: 9 }}>
                          {nov.status}
                        </span>
                      )}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 11 }}>
                      {nov.details || 'Sin detalle adicional'}
                    </div>
                    {nov.status === 'PENDIENTE' && (
                      <div style={{ marginTop: 6, textAlign: 'right' }}>
                        <button
                          onClick={() => handleResolveNovedad(nov.id)}
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 10, padding: '2px 8px', color: '#4CAF50' }}
                        >
                          ✓ Marcar Atendida
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Enlaces Operativos */}
          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Acciones de Mesa de Ayuda
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => navigate('/matchmaking/matches-aprobados')}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'space-between', width: '100%', padding: '10px 12px' }}
              >
                <span>📑 Mesa Oficial MATCHES</span>
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => navigate('/matchmaking/citas-agendadas')}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'space-between', width: '100%', padding: '10px 12px' }}
              >
                <span>📅 Ver Calendario Completo de Citas</span>
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => navigate('/matchmaking/aprobados-maria')}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'space-between', width: '100%', padding: '10px 12px' }}
              >
                <span>🛡️ Citas Aprobadas por María</span>
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => navigate('/proveedores')}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'space-between', width: '100%', padding: '10px 12px' }}
              >
                <span>🍽️ Directorio de Restaurantes Aliados</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Modales Compartidos con props corregidos */}
      {modalNovedadOpen && (
        <RegistrarNovedadModal
          preselectedClient={selectedMatchForNovedad ? { name: selectedMatchForNovedad.persona_a } : null}
          onClose={() => { setModalNovedadOpen(false); setSelectedMatchForNovedad(null); }}
          onSuccess={() => { setModalNovedadOpen(false); setSelectedMatchForNovedad(null); fetchData(); }}
        />
      )}

      {noShowModalItem && (
        <NoShowModal
          item={noShowModalItem}
          onClose={() => setNoShowModalItem(null)}
          onSuccess={() => { setNoShowModalItem(null); fetchData(); }}
        />
      )}

      {feedbackModalItem && (
        <FeedbackModal
          item={feedbackModalItem}
          onClose={() => setFeedbackModalItem(null)}
          onSuccess={() => { setFeedbackModalItem(null); fetchData(); }}
        />
      )}

      {restaurantModalMatch && (
        <RestaurantFilterModal
          match={restaurantModalMatch}
          initialDate={restaurantModalMatch.fecha_cita}
          initialVenue={restaurantModalMatch.restaurante_asignado}
          onClose={() => setRestaurantModalMatch(null)}
          onConfirm={handleRestaurantConfirm}
        />
      )}
    </div>
  )
}
