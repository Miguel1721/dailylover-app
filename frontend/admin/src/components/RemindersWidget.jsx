import React, { useEffect, useState } from 'react'
import { Clock, Plus, CheckSquare, Square, MessageCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

const PRIORITY_BADGES = {
  URGENTE: { bg: 'rgba(255, 77, 77, 0.18)', color: '#FF4D4D', border: '1px solid rgba(255,77,77,0.3)', label: '🔴 URGENTE' },
  ALTA: { bg: 'rgba(255, 152, 0, 0.18)', color: '#FF9800', border: '1px solid rgba(255,152,0,0.3)', label: '🟠 ALTA' },
  MEDIA: { bg: 'rgba(255, 235, 59, 0.15)', color: '#FFD54F', border: '1px solid rgba(255,235,59,0.3)', label: '🟡 MEDIA' },
  BAJA: { bg: 'rgba(76, 175, 80, 0.15)', color: '#4CAF50', border: '1px solid rgba(76,175,80,0.3)', label: '🟢 BAJA' }
}

export default function RemindersWidget() {
  const { user, token } = useAuth()
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filterPriority, setFilterPriority] = useState('ALL')

  const [newReminder, setNewReminder] = useState({
    title: '',
    client_name: '',
    client_phone: '',
    priority: 'ALTA',
    due_date: 'Hoy',
    notes: ''
  })

  const psychologistName = user?.name ? user.name.toUpperCase() : ''

  const fetchReminders = () => {
    setLoading(true)
    fetch(`${API}/api/v1/admin/reminders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setReminders(data.reminders || [])
        setLoading(false)
      })
      .catch(() => {
        setReminders([
          { id: 1, title: 'Llamar para feedback post-cita', client_name: 'Juan Diego Puerta', client_phone: '+573101234567', priority: 'URGENTE', matchmaker: 'SILVI', due_date: 'Hoy, 5:00 PM', completed: false, notes: 'Verificar impresión de la cita', whatsapp_link: 'https://wa.me/573101234567' },
          { id: 2, title: 'Aprobar propuesta de match con María Camila', client_name: 'María Camila Rodríguez', client_phone: '+573159876543', priority: 'ALTA', matchmaker: 'SILVI', due_date: 'Hoy, 6:30 PM', completed: false, notes: 'Revisar fotos de lookbook lado a lado', whatsapp_link: 'https://wa.me/573159876543' },
          { id: 3, title: 'Confirmar asistencia a evento del sábado', client_name: 'Carlos Eduardo Silva', client_phone: '+573005551234', priority: 'MEDIA', matchmaker: 'STEFFY', due_date: 'Mañana, 10:00 AM', completed: false, notes: 'Enviar código QR y lugar de encuentro', whatsapp_link: 'https://wa.me/573005551234' },
          { id: 4, title: 'Solicitar actualización de foto de perfil', client_name: 'Valentina Ruiz', client_phone: '+573204449988', priority: 'BAJA', matchmaker: 'MANU', due_date: '28 Jul', completed: false, notes: 'Foto actual no cumple calidad mínima', whatsapp_link: 'https://wa.me/573204449988' }
        ])
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchReminders()
  }, [token])

  const handleToggleReminder = (id) => {
    fetch(`${API}/api/v1/admin/reminders/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(() => fetchReminders())
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
      body: JSON.stringify({ ...newReminder, matchmaker: psychologistName || 'SILVI' })
    })
      .then(() => {
        setShowModal(false)
        setNewReminder({ title: '', client_name: '', client_phone: '', priority: 'ALTA', due_date: 'Hoy', notes: '' })
        fetchReminders()
      })
      .catch(() => {
        setShowModal(false)
      })
  }

  const filtered = reminders.filter(r => filterPriority === 'ALL' || r.priority === filterPriority)

  return (
    <div className="card" style={{ marginBottom: 24, border: '1px solid rgba(255,77,77,0.3)', background: 'linear-gradient(180deg, #1D1316 0%, #170E10 100%)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: 16 }}>
          <span style={{ fontSize: 22 }}>📌</span>
          <div>
            <div style={{ fontWeight: 800, color: 'white' }}>Recordatorios & Tareas Prioritarias</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>Seguimiento a clientes, citas y visto bueno de matches</div>
          </div>
          <span style={{ fontSize: 11, background: 'rgba(255,77,77,0.2)', color: '#FF4D4D', padding: '2px 10px', borderRadius: 12, fontWeight: 700, marginLeft: 8 }}>
            {reminders.filter(r => !r.completed).length} Pendientes
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Priority filter tabs */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 3, gap: 2 }}>
            {['ALL', 'URGENTE', 'ALTA', 'MEDIA', 'BAJA'].map(p => (
              <button
                key={p}
                onClick={() => setFilterPriority(p)}
                style={{
                  background: filterPriority === p ? 'var(--color-primary)' : 'transparent',
                  color: filterPriority === p ? 'white' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {p === 'ALL' ? 'Todos' : p}
              </button>
            ))}
          </div>

          <button 
            className="btn btn-primary btn-sm"
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }}
          >
            <Plus size={14} /> Nuevo Pendiente
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Cargando tareas prioritarias...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">No hay tareas pendientes en este filtro. ¡Excelente!</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 14 }}>
          {filtered.map(r => {
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
                  justifyContent: 'space-between',
                  boxShadow: r.completed ? 'none' : '0 4px 14px rgba(0,0,0,0.3)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: badge.bg, color: badge.color, letterSpacing: '0.03em' }}>
                      {badge.label}
                    </span>

                    <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> {r.due_date}
                    </span>
                  </div>

                  <div style={{ fontWeight: 700, fontSize: 14, color: 'white', marginBottom: 6, textDecoration: r.completed ? 'line-through' : 'none' }}>
                    {r.title}
                  </div>

                  {r.client_name && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      👤 Cliente: <strong style={{ color: 'var(--text-primary)' }}>{r.client_name}</strong>
                    </div>
                  )}

                  {r.notes && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: 6, marginBottom: 10 }}>
                      "{r.notes}"
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 8 }}>
                  <button 
                    onClick={() => handleToggleReminder(r.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: r.completed ? '#4CAF50' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}
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
                      style={{ color: '#25D366', borderColor: 'rgba(37,211,102,0.4)', display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 11, background: 'rgba(37,211,102,0.08)' }}
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

      {/* CREATE REMINDER MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} style={{ zIndex: 2000 }}>
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
