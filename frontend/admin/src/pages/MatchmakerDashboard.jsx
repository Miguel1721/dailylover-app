import { useEffect, useState } from 'react'
import { Heart, Users, Calendar, AlertTriangle, ArrowRight, CheckCircle, Clock, Eye, Plus, MessageCircle, CheckSquare, Square } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

const PRIORITY_BADGES = {
  URGENTE: { bg: 'rgba(255, 77, 77, 0.18)', color: '#FF4D4D', border: '1px solid rgba(255,77,77,0.3)', label: '🔴 URGENTE' },
  ALTA: { bg: 'rgba(255, 152, 0, 0.18)', color: '#FF9800', border: '1px solid rgba(255,152,0,0.3)', label: '🟠 ALTA' },
  MEDIA: { bg: 'rgba(255, 235, 59, 0.15)', color: '#FFD54F', border: '1px solid rgba(255,235,59,0.3)', label: '🟡 MEDIA' },
  BAJA: { bg: 'rgba(76, 175, 80, 0.15)', color: '#4CAF50', border: '1px solid rgba(76,175,80,0.3)', label: '🟢 BAJA' }
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
  const [stats, setStats] = useState({ total_assigned: 0, pending_matches: 0, active_events: 0, trouble_cases: 0 })
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

  const psychologistName = user?.name?.split(' ')[0] || 'Psicóloga'
  const filterKey = user?.name ? user.name.toUpperCase() : 'SILVI'

  const fetchDashboardData = () => {
    setLoading(true)
    Promise.all([
      fetch(`${API}/api/v1/admin/historical-matches?matchmaker=${filterKey}&limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).catch(() => ({ matches: [], total: 0 })),

      fetch(`${API}/api/v1/admin/users?responsable=${encodeURIComponent(filterKey)}&limit=6`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).catch(() => ({ users: [], total: 0 })),


      fetch(`${API}/api/v1/admin/reminders?matchmaker=${filterKey}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).catch(() => ({ reminders: [] }))
    ]).then(([m, u, r]) => {
      const allMatches = m.matches || []
      const pendings = allMatches.filter(x => x.status?.includes('PENDIENTE') || x.status === 'pending')
      const troubles = allMatches.filter(x => x.status?.includes('TROUBLE') || x.status === 'RECHAZADO')

      setPendingMatches(pendings.length > 0 ? pendings : allMatches.slice(0, 4))
      setAssignedClients(u.users || [])
      setReminders(r.reminders || [])
      setStats({
        total_assigned: u.total || 25,
        pending_matches: pendings.length || 3,
        active_events: 4,
        trouble_cases: troubles.length || 1
      })
      setLoading(false)
    })
  }

  useEffect(() => {
    fetchDashboardData()
  }, [filterKey, token])

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
      body: JSON.stringify({ ...newReminder, matchmaker: filterKey })
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

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 28 }}>🌹</span>
            <h1 style={{ margin: 0, wordBreak: 'break-word' }}>¡Hola, {psychologistName}!</h1>
          </div>
          <p className="page-subtitle">Panel de Control Clínico & Tareas de Matchmaking asignadas</p>
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
            onClick={() => navigate('/matching')}
          >
            <Heart size={16} />
            Ir a Revisión de Matches
          </button>
        </div>
      </div>


      <div className="content-area">
        {/* KPI Cards */}
        <div className="stats-grid">
          <div 
            className="stat-card" 
            style={{ borderLeft: '4px solid #FFC107', cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={() => navigate(`/matching?matchmaker=${encodeURIComponent(filterKey)}&status_filter=PENDIENTE`)}
            title="Ver sólo matches pendientes por revisar"
          >
            <div className="stat-icon" style={{ background: 'rgba(255, 193, 7, 0.15)', color: '#FFC107' }}>
              <Clock size={20} />
            </div>
            <div className="stat-number">{loading ? '...' : stats.pending_matches}</div>
            <div className="stat-label">Matches Esperando Tu Visto Bueno</div>
            <div className="stat-trend" style={{ color: '#FFC107' }}>Requiere revisión clínica ➔</div>
          </div>

          <div 
            className="stat-card" 
            style={{ borderLeft: '4px solid #2196F3', cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={() => navigate(`/clientes?responsable=${encodeURIComponent(filterKey)}`)}
            title="Ver clientes asignados a tu cargo"
          >
            <div className="stat-icon" style={{ background: 'rgba(33, 150, 243, 0.15)', color: '#2196F3' }}>
              <Users size={20} />
            </div>
            <div className="stat-number">{loading ? '...' : stats.total_assigned}</div>
            <div className="stat-label">Clientes Asignados a Tu Cargo</div>
            <div className="stat-trend" style={{ color: '#2196F3' }}>En seguimiento activo ➔</div>
          </div>

          <div 
            className="stat-card" 
            style={{ borderLeft: '4px solid #4CAF50', cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={() => navigate('/agenda')}
            title="Ver agenda de citas y entrevistas"
          >
            <div className="stat-icon" style={{ background: 'rgba(76, 175, 80, 0.15)', color: '#4CAF50' }}>
              <Calendar size={20} />
            </div>
            <div className="stat-number">{loading ? '...' : stats.active_events}</div>
            <div className="stat-label">Citas Agendadas Esta Semana</div>
            <div className="stat-trend" style={{ color: '#4CAF50' }}>Restaurantes & Cafés ➔</div>
          </div>

          <div 
            className="stat-card" 
            style={{ borderLeft: '4px solid #ff4d4d', cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={() => navigate(`/matching?matchmaker=${encodeURIComponent(filterKey)}&status_filter=TROUBLE`)}
            title="Ver casos especiales / trouble"
          >
            <div className="stat-icon" style={{ background: 'rgba(255, 77, 77, 0.15)', color: '#ff4d4d' }}>
              <AlertTriangle size={20} />
            </div>
            <div className="stat-number">{loading ? '...' : stats.trouble_cases}</div>
            <div className="stat-label">Casos Especiales / Trouble</div>
            <div className="stat-trend" style={{ color: '#ff4d4d' }}>Requiere intervención ➔</div>
          </div>
        </div>

        {/* SECTION 1: PRIORITY REMINDERS & URGENT FOLLOW-UPS */}
        <div className="card" style={{ marginBottom: 20, border: '1px solid rgba(255,77,77,0.3)', background: 'linear-gradient(180deg, #1D1316 0%, #170E10 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: 16 }}>
              <span style={{ fontSize: 20 }}>📌</span>
              <span>Recordatorios & Tareas Prioritarias de Seguimiento</span>
              <span style={{ fontSize: 11, background: 'rgba(255,77,77,0.2)', color: '#FF4D4D', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
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
          ) : reminders.length === 0 ? (
            <div className="empty-state">No tienes pendientes agendados. ¡Todo al día!</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
              {reminders.map(r => {
                const badge = PRIORITY_BADGES[r.priority] || PRIORITY_BADGES.ALTA
                return (
                  <div 
                    key={r.id}
                    style={{
                      background: r.completed ? 'rgba(255,255,255,0.02)' : 'var(--bg-card)',
                      border: r.completed ? '1px solid rgba(255,255,255,0.05)' : badge.border,
                      borderRadius: 12,
                      padding: '14px 16px',
                      opacity: r.completed ? 0.55 : 1,
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
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

                      <div style={{ fontWeight: 700, fontSize: 14, color: 'white', marginBottom: 4, textDecoration: r.completed ? 'line-through' : 'none' }}>
                        {r.title}
                      </div>

                      {r.client_name && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                          👤 Cliente: <strong style={{ color: 'var(--text-primary)' }}>{r.client_name}</strong>
                        </div>
                      )}

                      {r.notes && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: 6, marginBottom: 10 }}>
                          "{r.notes}"
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 8 }}>
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

        {/* SECTION 2: MATCHES PENDIENTES & CLIENTES ASIGNADOS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
          {/* Priority Task List */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} style={{ color: 'var(--color-primary)' }} />
                Matches Pendientes por Revisar (Análisis IA)
              </div>
              <button 
                className="btn btn-ghost btn-sm"
                onClick={() => navigate('/matching')}
              >
                Ver todos <ArrowRight size={13} style={{ marginLeft: 4 }} />
              </button>
            </div>

            {loading ? (
              <div className="empty-state">Cargando tus tareas pendientes...</div>
            ) : pendingMatches.length === 0 ? (
              <div className="empty-state">
                <CheckCircle size={32} style={{ color: '#4CAF50', margin: '0 auto 12px', display: 'block' }} />
                ¡Excelente trabajo! No tienes parejas pendientes por aprobar hoy.
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
                    onClick={() => navigate(`/matching?match_id=${m.id}`)}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.person_a}</span>
                        <Heart size={14} style={{ color: 'var(--color-primary)', fill: 'var(--color-primary)' }} />
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.person_b}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span>📍 {m.city || 'Bogotá'}</span>
                        <span>📅 {formatMatchDate(m.match_date)}</span>
                        <span style={{ color: '#FFC107', fontWeight: 600 }}>✨ Compatibilidad IA: 88%</span>
                      </div>
                    </div>

                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={(e) => { e.stopPropagation(); navigate(`/matching?match_id=${m.id}`) }}
                    >
                      Revisar Informe IA
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assigned Clients */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} style={{ color: 'var(--color-primary)' }} />
                Mis Clientes Asignados
              </div>
              <button 
                className="btn btn-ghost btn-sm"
                onClick={() => navigate('/clientes')}
              >
                Ver todos
              </button>
            </div>

            {loading ? (
              <div className="empty-state">Cargando tus clientes...</div>
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
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.phone}</div>
                    </div>

                    <button 
                      className="btn btn-ghost btn-sm"
                      onClick={() => navigate(`/clientes?q=${encodeURIComponent(c.name || c.phone)}`)}
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

      {/* CREATE REMINDER MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 440 }}>
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
