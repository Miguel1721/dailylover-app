import React, { useState, useEffect, useCallback } from 'react'
import { Calendar as CalendarIcon, Users, Phone, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'
const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const HOURS_START = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00']
const HOURS_END   = ['12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00']

const DEFAULT_AGENDA = {
  psychologist: 'SILVI',
  total_interviews: 0,
  total_assigned_clients: 0,
  interviews: [],
  assigned_clients: []
}

// ─── Tarjeta individual por día — estado 100% aislado ────────────────────────
function DayCard({ dow, initialData, token, psychologistName }) {
  const [isActive, setIsActive]   = useState(initialData?.is_active ?? (dow >= 1 && dow <= 5))
  const [startTime, setStartTime] = useState(initialData?.start_time ? String(initialData.start_time).slice(0, 5) : '09:00')
  const [endTime, setEndTime]     = useState(initialData?.end_time   ? String(initialData.end_time).slice(0, 5)   : '17:00')
  const [status, setStatus]       = useState(null) // null | 'saving' | 'ok' | 'error'

  const persist = (overrides = {}) => {
    const payload = {
      psychologist_name: psychologistName,
      day_of_week: dow,
      start_time: startTime,
      end_time: endTime,
      is_active: isActive,
      slot_duration_minutes: 45,
      ...overrides
    }
    setStatus('saving')
    fetch(`${API}/api/v1/admin/psychologist/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(() => { setStatus('ok'); setTimeout(() => setStatus(null), 1800) })
      .catch(() => { setStatus('error'); setTimeout(() => setStatus(null), 2000) })
  }

  const toggleActive = () => {
    const next = !isActive
    setIsActive(next)
    persist({ is_active: next })
  }

  const changeStart = (val) => {
    setStartTime(val)
    persist({ start_time: val })
  }

  const changeEnd = (val) => {
    setEndTime(val)
    persist({ end_time: val })
  }

  const btnLabel = status === 'saving' ? '⏳ Guardando...'
    : status === 'ok'    ? '✅ Guardado'
    : status === 'error' ? '❌ Error'
    : isActive           ? '🟢 Laboral (Disponible)'
    :                      '🔴 No Laboral (Inactivo)'

  return (
    <div style={{
      background: 'var(--bg-base)',
      border: isActive ? '1px solid var(--border-color)' : '1px dashed rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: 18,
      opacity: isActive ? 1 : 0.6,
      transition: 'all 0.2s ease'
    }}>
      <div style={{ fontWeight: 800, fontSize: 16, color: isActive ? 'var(--color-primary)' : 'var(--text-muted)', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{DAYS_ES[dow]}</span>
        <button
          onClick={toggleActive}
          disabled={status === 'saving'}
          style={{
            fontSize: 11,
            padding: '3px 12px',
            borderRadius: 20,
            border: `1px solid ${isActive ? 'rgba(76,175,80,0.4)' : 'rgba(244,67,54,0.4)'}`,
            background: isActive ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)',
            color: status === 'ok' ? '#4CAF50' : status === 'error' ? '#F44336' : isActive ? '#4CAF50' : '#F44336',
            fontWeight: 700,
            cursor: status === 'saving' ? 'wait' : 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          {btnLabel}
        </button>
      </div>

      {isActive ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Hora Inicio</label>
              <select
                className="form-control"
                style={{ fontSize: 12, padding: '6px 8px' }}
                value={startTime}
                onChange={e => changeStart(e.target.value)}
                disabled={status === 'saving'}
              >
                {HOURS_START.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Hora Fin</label>
              <select
                className="form-control"
                style={{ fontSize: 12, padding: '6px 8px' }}
                value={endTime}
                onChange={e => changeEnd(e.target.value)}
                disabled={status === 'saving'}
              >
                {HOURS_END.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Franja: {startTime} — {endTime}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
          Día marcado como no laboral. No se ofrecerán citas a clientes este día.
        </div>
      )}
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function AgendaPsicologa() {
  const { user, token } = useAuth()
  const [agenda, setAgenda]           = useState(DEFAULT_AGENDA)
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState('entrevistas')
  const [availMap, setAvailMap]       = useState({})   // { [day_of_week]: data }
// Inside AgendaPsicologa component
  const [assignedCityFilter, setAssignedCityFilter] = useState('all')
  const [assignedPlanFilter, setAssignedPlanFilter] = useState('all')

  const filteredAssignedClients = (agenda?.assigned_clients || []).filter(c => {
    if (assignedCityFilter !== 'all' && !(c.city || '').toLowerCase().includes(assignedCityFilter.toLowerCase())) return false
    if (assignedPlanFilter !== 'all') {
      if (assignedPlanFilter === 'sin_plan' && c.plan_tier && c.plan_tier !== 'Sin Plan') return false
      if (assignedPlanFilter !== 'sin_plan' && !(c.plan_tier || '').toLowerCase().includes(assignedPlanFilter.toLowerCase())) return false
    }
    return true
  })


  const psychologistName = user?.name ? user.name.split(' ')[0].toUpperCase() : 'SILVI'

  // Carga agenda de entrevistas
  const fetchAgenda = useCallback(() => {
    setLoading(true)
    fetch(`${API}/api/v1/admin/psychologist/agenda?psychologist_name=${encodeURIComponent(psychologistName)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setAgenda(d && Array.isArray(d.interviews) ? d : DEFAULT_AGENDA))
      .catch(() => setAgenda(DEFAULT_AGENDA))
      .finally(() => setLoading(false))
  }, [psychologistName, token])

  // Carga disponibilidad UNA SOLA VEZ y la convierte en mapa por día
  const fetchAvailability = useCallback(() => {
    fetch(`${API}/api/v1/admin/psychologist/availability?psychologist_name=${encodeURIComponent(psychologistName)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        if (d && Array.isArray(d.availability)) {
          const map = {}
          d.availability.forEach(item => { map[item.day_of_week] = item })
          setAvailMap(map)
        }
        setAvailLoaded(true)
      })
      .catch(() => setAvailLoaded(true))
  }, [psychologistName, token])

  useEffect(() => { fetchAgenda() },    [fetchAgenda])
  useEffect(() => { fetchAvailability() }, [fetchAvailability])

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>🗓️ Mi Agenda de Entrevistas</span>
            <span style={{ background: 'linear-gradient(135deg, #6c3ff5, #a855f7)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20, letterSpacing: 1 }}>
              PSICÓLOGA {agenda?.psychologist || psychologistName}
            </span>
          </h1>
          <p className="page-subtitle">Gestión de entrevistas agendadas, disponibilidad horaria y clientes asignados</p>
        </div>
      </div>

      <div className="content-area">
        {/* KPIs */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}><CalendarIcon size={20} /></div>
            <div className="stat-number">{loading ? '...' : (agenda?.total_interviews || 0)}</div>
            <div className="stat-label">Entrevistas Agendadas</div>
            <div className="stat-trend" style={{ color: '#4CAF50' }}>Agenda activa</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(33,150,243,0.15)', color: '#2196F3' }}><Users size={20} /></div>
            <div className="stat-number">{loading ? '...' : (agenda?.total_assigned_clients || 0)}</div>
            <div className="stat-label">Clientes Asignados</div>
            <div className="stat-trend">Bajo tu acompañamiento</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(76,175,80,0.15)', color: '#4CAF50' }}><ShieldCheck size={20} /></div>
            <div className="stat-number">100%</div>
            <div className="stat-label">Asignación Neutra</div>
            <div className="stat-trend">Orden de lista por IA</div>
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 20, gap: 8 }}>
          {[
            { key: 'entrevistas',    label: `🗓️ Entrevistas (${agenda?.interviews?.length || 0})` },
            { key: 'clientes',       label: `👥 Clientes Asignados (${agenda?.assigned_clients?.length || 0})` },
            { key: 'disponibilidad', label: '⚙️ Disponibilidad Semanal' },
          ].map(tab => (
            <button key={tab.key} className="btn btn-ghost" onClick={() => setActiveTab(tab.key)} style={{ borderRadius: 0, borderBottom: activeTab === tab.key ? '2px solid var(--color-primary)' : 'none', color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--text-secondary)', fontWeight: 700, padding: '10px 16px', fontSize: 13 }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── ENTREVISTAS ── */}
        {loading ? (
          <div className="card"><div className="empty-state">Cargando agenda...</div></div>
        ) : activeTab === 'entrevistas' ? (
          <div className="card">
            <div className="card-title">Citas de Entrevista Inicial Reservadas</div>
            {agenda?.interviews?.length === 0 ? (
              <div className="empty-state">
                <CalendarIcon size={36} style={{ color: 'var(--color-primary)', margin: '0 auto 12px', display: 'block' }} />
                No tienes entrevistas agendadas pendientes.
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead><tr><th>Fecha & Hora</th><th>Cliente</th><th>Teléfono</th><th>Estado</th></tr></thead>
                  <tbody>
                    {agenda.interviews.map(inv => (
                      <tr key={inv.id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>📅 {inv.date}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 600 }}>⏰ {inv.time}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{inv.user_name}</div>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#a855f7', fontWeight: 700 }}>{inv.client_code}</span>
                        </td>
                        <td>
                          {inv.whatsapp_link
                            ? <a href={inv.whatsapp_link} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ color: '#25D366', borderColor: 'rgba(37,211,102,0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={14} /> {inv.phone}</a>
                            : <span>{inv.phone || 'Sin número'}</span>}
                        </td>
                        <td><span className="badge badge-green">{inv.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        ) : activeTab === 'clientes' ? (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>
                Clientes Bajo Tu Acompañamiento Clínico ({filteredAssignedClients.length})
              </div>

              {/* Filtros rápidos de Ciudad y Plan */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  style={{ padding: '6px 12px', fontSize: 12, height: 34, background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 8 }}
                  value={assignedCityFilter}
                  onChange={e => setAssignedCityFilter(e.target.value)}
                >
                  <option value="all">📍 Todas las Ciudades</option>
                  <option value="Bogotá">📍 Bogotá</option>
                  <option value="Medellín">📍 Medellín</option>
                  <option value="Cali">📍 Cali</option>
                </select>

                <select
                  style={{ padding: '6px 12px', fontSize: 12, height: 34, background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 8 }}
                  value={assignedPlanFilter}
                  onChange={e => setAssignedPlanFilter(e.target.value)}
                >
                  <option value="all">💳 Todos los Planes</option>
                  <option value="195">👑 VIP 195k</option>
                  <option value="150">💎 Premium 150k</option>
                  <option value="98">⭐ Estándar Plus 98k</option>
                  <option value="65">🔵 Estándar 65k</option>
                  <option value="40">🟢 Básico 40k</option>
                  <option value="sin_plan">⚠️ Sin Plan</option>
                </select>
              </div>
            </div>

            {filteredAssignedClients.length === 0 ? (
              <div className="empty-state">No se encontraron clientes bajo los filtros seleccionados.</div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Código DL</th>
                      <th>Nombre</th>
                      <th>Plan / Membresía</th>
                      <th>Ciudad</th>
                      <th>Edad</th>
                      <th>Inscripción</th>
                      <th>WhatsApp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssignedClients.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#a855f7' }}>{c.client_code}</td>
                        <td style={{ fontWeight: 700 }}>{c.name}</td>
                        <td>
                          <span className="badge" style={{ fontSize: 11, background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' }}>
                            💳 {c.plan_tier || 'Sin Plan'}
                          </span>
                        </td>
                        <td>📍 {c.city}</td>
                        <td>🎂 {c.age ? `${c.age} años` : '—'}</td>
                        <td>📅 {c.created_at && c.created_at !== '24/07/2026' ? c.created_at : '—'}</td>

                        <td>
                          <a href={`https://wa.me/${(c.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ color: '#25D366', fontWeight: 600, fontSize: 12 }}>
                            📱 {c.phone}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>


        ) : (
          /* ── DISPONIBILIDAD ── */
          <div className="card">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span>⚙️ Disponibilidad Semanal</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Los cambios se reflejan en el calendario general de citas automáticamente
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Cada día guarda de forma independiente. Al activar un día, los clientes podrán agendar entrevistas en esa franja horaria.
            </p>

            {!availLoaded ? (
              <div className="empty-state">Cargando disponibilidad...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                {[1, 2, 3, 4, 5, 6, 0].map(dow => (
                  <DayCard
                    key={dow}
                    dow={dow}
                    initialData={availMap[dow] || null}
                    token={token}
                    psychologistName={psychologistName}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
