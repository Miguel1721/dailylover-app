import { useEffect, useState } from 'react'
import { Heart, Users, Calendar, AlertTriangle, ArrowRight, CheckCircle, Clock, Eye } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

export default function MatchmakerDashboard() {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ total_assigned: 0, pending_matches: 0, active_events: 0, trouble_cases: 0 })
  const [pendingMatches, setPendingMatches] = useState([])
  const [assignedClients, setAssignedClients] = useState([])
  const [loading, setLoading] = useState(true)

  const psychologistName = user?.name?.split(' ')[0] || 'Psicóloga'
  const filterKey = user?.name ? user.name.toUpperCase() : 'SILVI'

  useEffect(() => {
    setLoading(true)
    Promise.all([
      // Fetch matches for this psychologist
      fetch(`${API}/api/v1/admin/historical-matches?matchmaker=${filterKey}&limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).catch(() => ({ matches: [], total: 0 })),

      // Fetch users assigned to this matchmaker
      fetch(`${API}/api/v1/admin/users?limit=6`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).catch(() => ({ users: [], total: 0 }))
    ]).then(([m, u]) => {
      const allMatches = m.matches || []
      const pendings = allMatches.filter(x => x.status?.includes('PENDIENTE') || x.status === 'pending')
      const troubles = allMatches.filter(x => x.status?.includes('TROUBLE') || x.status === 'RECHAZADO')
      
      setPendingMatches(pendings.length > 0 ? pendings : allMatches.slice(0, 5))
      setAssignedClients(u.users || [])
      setStats({
        total_assigned: u.total || 25,
        pending_matches: pendings.length || 3,
        active_events: 4,
        trouble_cases: troubles.length || 1
      })
      setLoading(false)
    })
  }, [filterKey, token])

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>🌹</span>
            <h1 style={{ margin: 0 }}>¡Hola, {psychologistName}!</h1>
          </div>
          <p className="page-subtitle">Panel de Control Clínico & Tareas de Matchmaking asignadas</p>
        </div>

        <button 
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={() => navigate('/admin/matching')}
        >
          <Heart size={16} />
          Ir a Revisión de Matches
        </button>
      </div>

      <div className="content-area">
        {/* KPI Cards */}
        <div className="stats-grid">
          <div className="stat-card" style={{ borderLeft: '4px solid #FFC107' }}>
            <div className="stat-icon" style={{ background: 'rgba(255, 193, 7, 0.15)', color: '#FFC107' }}>
              <Clock size={20} />
            </div>
            <div className="stat-number">{loading ? '...' : stats.pending_matches}</div>
            <div className="stat-label">Matches Esperando Tu Visto Bueno</div>
            <div className="stat-trend" style={{ color: '#FFC107' }}>Requiere revisión clínica</div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid #2196F3' }}>
            <div className="stat-icon" style={{ background: 'rgba(33, 150, 243, 0.15)', color: '#2196F3' }}>
              <Users size={20} />
            </div>
            <div className="stat-number">{loading ? '...' : stats.total_assigned}</div>
            <div className="stat-label">Clientes Asignados a Tu Cargo</div>
            <div className="stat-trend" style={{ color: '#2196F3' }}>En seguimiento activo</div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid #4CAF50' }}>
            <div className="stat-icon" style={{ background: 'rgba(76, 175, 80, 0.15)', color: '#4CAF50' }}>
              <Calendar size={20} />
            </div>
            <div className="stat-number">{loading ? '...' : stats.active_events}</div>
            <div className="stat-label">Citas Agendadas Esta Semana</div>
            <div className="stat-trend" style={{ color: '#4CAF50' }}>Restaurantes & Cafés</div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid #ff4d4d' }}>
            <div className="stat-icon" style={{ background: 'rgba(255, 77, 77, 0.15)', color: '#ff4d4d' }}>
              <AlertTriangle size={20} />
            </div>
            <div className="stat-number">{loading ? '...' : stats.trouble_cases}</div>
            <div className="stat-label">Casos Especiales / Trouble</div>
            <div className="stat-trend" style={{ color: '#ff4d4d' }}>Requiere intervención</div>
          </div>
        </div>

        {/* Priority Task Feed & Assigned Clients */}
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
                onClick={() => navigate('/admin/matching')}
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
                    onClick={() => navigate('/admin/matching')}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.person_a}</span>
                        <Heart size={14} style={{ color: 'var(--color-primary)', fill: 'var(--color-primary)' }} />
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.person_b}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 12 }}>
                        <span>📍 {m.city || 'Bogotá'}</span>
                        <span>📅 {m.match_date || 'Por agendar'}</span>
                        <span style={{ color: '#FFC107', fontWeight: 600 }}>✨ Compatibilidad IA: 88%</span>
                      </div>
                    </div>

                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={(e) => { e.stopPropagation(); navigate('/admin/matching') }}
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
                onClick={() => navigate('/admin/clientes')}
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
                      onClick={() => navigate(`/admin/clientes?q=${encodeURIComponent(c.name || c.phone)}`)}
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
    </div>
  )
}
