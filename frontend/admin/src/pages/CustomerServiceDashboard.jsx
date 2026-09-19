import React, { useState, useEffect } from 'react'
import { 
  Headphones, Calendar, Clock, MapPin, CheckCircle2, AlertTriangle, 
  RotateCcw, Utensils, MessageSquare, Search, RefreshCw, Plus, ExternalLink,
  ShieldAlert, PhoneCall, ChevronRight, Check
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

export default function CustomerServiceDashboard() {
  const { token, user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [citasHoy, setCitasHoy] = useState([])
  const [citasSemana, setCitasSemana] = useState([])
  const [novedadesRecientes, setNovedadesRecientes] = useState([])
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
      // 1. Citas del calendario
      const resCitas = await fetch(`${API}/api/v1/matchmaking/calendar-dates?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const dataCitas = resCitas.ok ? await resCitas.json() : []
      const list = Array.isArray(dataCitas) ? dataCitas : (dataCitas.matches || [])

      // Separar hoy vs semana
      const hoy = list.filter(m => {
        const fecha = String(m.fecha_cita || m.fecha || '').slice(0, 10)
        return fecha === todayStr
      })
      const semana = list.filter(m => {
        const fecha = String(m.fecha_cita || m.fecha || '').slice(0, 10)
        return fecha && fecha !== todayStr
      })

      setCitasHoy(hoy)
      setCitasSemana(semana)

      // 2. Novedades activas
      const resNov = await fetch(`${API}/api/v1/admin/novedades-operativas?limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const dataNov = resNov.ok ? await resNov.json() : []
      const novList = Array.isArray(dataNov) ? dataNov : (dataNov.novedades || [])
      setNovedadesRecientes(novList)

      // Calcular estadísticas operativas
      const pendRest = list.filter(m => !m.restaurante_asignado || m.restaurante_asignado === 'Por asignar' || m.restaurante_asignado === '-').length
      const conf = list.filter(m => m.restaurante_asignado && m.restaurante_asignado !== 'Por asignar' && m.restaurante_asignado !== '-').length

      setStats({
        hoy: hoy.length,
        pendientes_restaurante: pendRest,
        confirmadas: conf,
        novedades_activas: novList.filter(n => n.estado === 'ABIERTO' || !n.estado).length
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

  const filteredHoy = citasHoy.filter(m => {
    const text = `${m.persona_a || ''} ${m.persona_b || ''} ${m.restaurante_asignado || ''} ${m.ciudad || ''}`.toLowerCase()
    const matchesSearch = !searchTerm || text.includes(searchTerm.toLowerCase())
    const matchesCity = filterCity === 'Todas' || (m.ciudad && m.ciudad.toLowerCase() === filterCity.toLowerCase())
    return matchesSearch && matchesCity
  })

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
            Monitoreo logístico en vivo de citas, reservas con restaurantes aliados y novedades de última hora.
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
        <div className="stat-card" style={{ borderLeft: '4px solid #c41a00' }}>
          <div className="stat-icon" style={{ background: 'rgba(196, 26, 0, 0.15)', color: '#c41a00' }}>
            <Calendar size={20} />
          </div>
          <div className="stat-number">{loading ? '...' : stats.hoy}</div>
          <div className="stat-label">Citas Programadas para Hoy</div>
          <div className="stat-trend" style={{ color: stats.hoy > 0 ? '#4CAF50' : 'var(--text-muted)' }}>
            {stats.hoy > 0 ? 'En seguimiento activo' : 'Sin citas hoy'}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #FFC107' }}>
          <div className="stat-icon" style={{ background: 'rgba(255, 193, 7, 0.15)', color: '#FFC107' }}>
            <Utensils size={20} />
          </div>
          <div className="stat-number">{loading ? '...' : stats.pendientes_restaurante}</div>
          <div className="stat-label">Mesas Por Coordinar</div>
          <div className="stat-trend" style={{ color: '#FFC107' }}>Requieren reserva con aliado</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #4CAF50' }}>
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

      {/* Contenido Principal: Citas de Hoy + Novedades */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 24 }}>
        
        {/* Columna Izquierda: Citas de Hoy */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} style={{ color: 'var(--color-primary)' }} />
              Citas del Día ({filteredHoy.length})
            </h3>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Buscar pareja o sede..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: '6px 10px 6px 30px',
                    fontSize: 12,
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    width: 180
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
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              Cargando citas del día...
            </div>
          ) : filteredHoy.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px dashed var(--border-color)' }}>
              <Calendar size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No hay citas agendadas para hoy</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 16px' }}>
                Revisa las citas de los próximos días en la sección de Citas Agendadas.
              </p>
              <button
                onClick={() => navigate('/matchmaking/citas-agendadas')}
                className="btn btn-ghost btn-sm"
              >
                Ver Citas de la Semana
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredHoy.map((m, idx) => {
                const tieneRestaurante = m.restaurante_asignado && m.restaurante_asignado !== 'Por asignar' && m.restaurante_asignado !== '-'
                return (
                  <div
                    key={m.id || idx}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 10,
                      padding: 16,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        background: tieneRestaurante ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 193, 7, 0.15)',
                        color: tieneRestaurante ? '#4CAF50' : '#FFC107',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 12
                      }}>
                        <span>{m.hora || 'PM'}</span>
                      </div>

                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CrmPersonLink personName={m.persona_a} />
                          <span style={{ color: 'var(--color-primary)', fontWeight: 400 }}>♥</span>
                          <CrmPersonLink personName={m.persona_b} />
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 12 }}>
                          <span>📍 {m.ciudad || 'Bogotá'}</span>
                          <span>🍽️ <strong>{tieneRestaurante ? m.restaurante_asignado : 'Por asignar'}</strong></span>
                          <span>👩‍⚕️ {m.responsable || 'Psicóloga'}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setRestaurantModalMatch(m)}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11 }}
                        title="Asignar o cambiar restaurante aliado"
                      >
                        <Utensils size={13} style={{ marginRight: 4 }} />
                        {tieneRestaurante ? 'Cambiar Mesa' : 'Asignar Mesa'}
                      </button>

                      <button
                        onClick={() => { setSelectedMatchForNovedad(m); setModalNovedadOpen(true); }}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, borderColor: '#ff9800', color: '#ff9800' }}
                        title="Registrar retraso o cambio de sede"
                      >
                        <AlertTriangle size={13} style={{ marginRight: 4 }} />
                        Novedad
                      </button>

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

        {/* Columna Derecha: Novedades Recientes & Acceso Rápido */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Novedades Operativas */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} style={{ color: '#ff9800' }} />
                Novedades en Vivo
              </h3>
              <span className="badge badge-red" style={{ fontSize: 10 }}>Tiempo Real</span>
            </div>

            {novedadesRecientes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                ✓ Sin novedades críticas registradas
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {novedadesRecientes.slice(0, 5).map((nov, idx) => (
                  <div
                    key={nov.id || idx}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      borderLeft: `3px solid ${nov.tipo === 'NO_SHOW' ? '#ff4d4d' : '#ff9800'}`,
                      borderRadius: 6,
                      padding: 10,
                      fontSize: 12
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>{nov.tipo || 'Novedad'}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{nov.time_col || formatAlertTime(nov.created_at)}</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 2, fontSize: 11 }}>
                      {nov.descripcion || nov.notas || 'Sin detalle adicional'}
                    </div>
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

      {/* Modales Compartidos */}
      {modalNovedadOpen && (
        <RegistrarNovedadModal
          match={selectedMatchForNovedad}
          onClose={() => { setModalNovedadOpen(false); setSelectedMatchForNovedad(null); }}
          onSaved={fetchData}
        />
      )}

      {noShowModalItem && (
        <NoShowModal
          match={noShowModalItem}
          onClose={() => setNoShowModalItem(null)}
          onSuccess={fetchData}
        />
      )}

      {feedbackModalItem && (
        <FeedbackModal
          match={feedbackModalItem}
          onClose={() => setFeedbackModalItem(null)}
          onSuccess={fetchData}
        />
      )}

      {restaurantModalMatch && (
        <RestaurantFilterModal
          match={restaurantModalMatch}
          onClose={() => setRestaurantModalMatch(null)}
          onSelected={() => { setRestaurantModalMatch(null); fetchData(); }}
        />
      )}
    </div>
  )
}
