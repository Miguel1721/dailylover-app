import React, { useState, useEffect, useCallback } from 'react'
import { Calendar as CalendarIcon, Clock, Users, UserCheck, Phone, CheckCircle, ExternalLink, ShieldCheck, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const DEFAULT_AGENDA = {
  psychologist: 'SILVI',
  total_interviews: 0,
  total_assigned_clients: 0,
  interviews: [],
  assigned_clients: []
}

const DEFAULT_WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0].map(dow => ({
  day_of_week: dow,
  start_time: '09:00',
  end_time: '17:00',
  is_active: dow >= 1 && dow <= 5
}))

export default function AgendaPsicologa() {
  const { user, token } = useAuth()
  const [agenda, setAgenda] = useState(DEFAULT_AGENDA)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('entrevistas')

  const psychologistName = user?.name ? (user.name.split(' ')[0].toUpperCase()) : 'SILVI'

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

  useEffect(() => {
    fetchAgenda()
  }, [fetchAgenda])


  const [availabilityList, setAvailabilityList] = useState(DEFAULT_WEEK_DAYS)
  const [savingDay, setSavingDay] = useState(null)

  const fetchAvailability = useCallback(() => {
    fetch(`${API}/api/v1/admin/psychologist/availability?psychologist_name=${encodeURIComponent(psychologistName)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        if (d && Array.isArray(d.availability) && d.availability.length > 0) {
          const mapServer = {}
          d.availability.forEach(item => {
            mapServer[item.day_of_week] = item
          })
          setAvailabilityList(prev => prev.map(day => mapServer[day.day_of_week] ? mapServer[day.day_of_week] : day))
        }
      })
      .catch(() => {})
  }, [psychologistName, token])

  useEffect(() => {
    fetchAvailability()
  }, [fetchAvailability])

  const handleSaveDayAvailability = (dayData) => {
    setSavingDay(dayData.day_of_week)

    setAvailabilityList(prev => prev.map(item => item.day_of_week === dayData.day_of_week ? { ...item, ...dayData } : item))

    fetch(`${API}/api/v1/admin/psychologist/availability`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        psychologist_name: psychologistName,
        day_of_week: dayData.day_of_week,
        start_time: dayData.start_time,
        end_time: dayData.end_time,
        is_active: dayData.is_active,
        slot_duration_minutes: 45
      })
    })
      .catch(() => {})
      .finally(() => setSavingDay(null))
  }



  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>🗓️ Mi Agenda de Entrevistas</span>
            <span style={{
              background: 'linear-gradient(135deg, #6c3ff5, #a855f7)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              padding: '3px 12px',
              borderRadius: 20,
              letterSpacing: 1
            }}>
              PSICÓLOGA {agenda?.psychologist || psychologistName}
            </span>
          </h1>
          <p className="page-subtitle">Gestión de entrevistas agendadas, disponibilidad horaria y clientes asignados</p>
        </div>
      </div>


      <div className="content-area">
        {/* KPI CARDS */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
              <CalendarIcon size={20} />
            </div>
            <div className="stat-number">{loading ? '...' : (agenda?.total_interviews || 0)}</div>
            <div className="stat-label">Entrevistas Agendadas</div>
            <div className="stat-trend" style={{ color: '#4CAF50' }}>Agenda activa de ingresos</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(33, 150, 243, 0.15)', color: '#2196F3' }}>
              <Users size={20} />
            </div>
            <div className="stat-number">{loading ? '...' : (agenda?.total_assigned_clients || 0)}</div>
            <div className="stat-label">Clientes Asignados</div>
            <div className="stat-trend">Bajo tu acompañamiento clínico</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(76, 175, 80, 0.15)', color: '#4CAF50' }}>
              <ShieldCheck size={20} />
            </div>
            <div className="stat-number">100%</div>
            <div className="stat-label">Asignación Neutra</div>
            <div className="stat-trend">Orden de lista por IA</div>
          </div>
        </div>

        {/* TABS */}
        <div className="tabs-header-container" style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 20, gap: 16 }}>

          <button
            className="btn btn-ghost"
            style={{
              borderRadius: 0,
              borderBottom: activeTab === 'entrevistas' ? '2px solid var(--color-primary)' : 'none',
              color: activeTab === 'entrevistas' ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              padding: '10px 18px',
              fontSize: 14
            }}
            onClick={() => setActiveTab('entrevistas')}
          >
            🗓️ Entrevistas Programadas ({agenda?.interviews?.length || 0})
          </button>

          <button
            className="btn btn-ghost"
            style={{
              borderRadius: 0,
              borderBottom: activeTab === 'clientes' ? '2px solid var(--color-primary)' : 'none',
              color: activeTab === 'clientes' ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              padding: '10px 18px',
              fontSize: 14
            }}
            onClick={() => setActiveTab('clientes')}
          >
            👥 Mis Clientes Asignados ({agenda?.assigned_clients?.length || 0})
          </button>

          <button
            className="btn btn-ghost"
            style={{
              borderRadius: 0,
              borderBottom: activeTab === 'disponibilidad' ? '2px solid var(--color-primary)' : 'none',
              color: activeTab === 'disponibilidad' ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              padding: '10px 18px',
              fontSize: 14
            }}
            onClick={() => setActiveTab('disponibilidad')}
          >
            ⚙️ Mi Disponibilidad Semanal
          </button>
        </div>

        {/* CONTENIDO DE TAB */}
        {loading ? (
          <div className="card"><div className="empty-state">Cargando agenda clínica personal...</div></div>
        ) : activeTab === 'entrevistas' ? (
          <div className="card">
            <div className="card-title">Citas de Entrevista Inicial Reservadas por Clientes</div>
            {agenda?.interviews?.length === 0 ? (
              <div className="empty-state">
                <CalendarIcon size={36} style={{ color: 'var(--color-primary)', margin: '0 auto 12px', display: 'block' }} />
                No tienes entrevistas agendadas pendientes en este momento.
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha & Hora</th>
                      <th>Cliente DL-Code</th>
                      <th>Teléfono / WhatsApp</th>
                      <th>Estado</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agenda.interviews.map(inv => (
                      <tr key={inv.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>📅 {inv.date}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 600 }}>⏰ {inv.time}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{inv.user_name}</div>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#a855f7', fontWeight: 700 }}>{inv.client_code}</span>
                        </td>
                        <td>
                          {inv.whatsapp_link ? (
                            <a href={inv.whatsapp_link} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ color: '#25D366', borderColor: 'rgba(37,211,102,0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Phone size={14} /> {inv.phone}
                            </a>
                          ) : (
                            <span>{inv.phone || 'Sin número'}</span>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-green">{inv.status}</span>
                        </td>
                        <td>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
                            👁️ Ver Ficha
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'clientes' ? (
          <div className="card">
            <div className="card-title">Listado de Clientes Bajo Tu Acompañamiento Clínico</div>
            {agenda?.assigned_clients?.length === 0 ? (
              <div className="empty-state">No hay clientes asignados a tu perfil actualmente.</div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Código DL</th>
                      <th>Nombre del Cliente</th>
                      <th>Ciudad</th>
                      <th>Edad</th>
                      <th>Motivación</th>
                      <th>WhatsApp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agenda.assigned_clients.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#a855f7' }}>{c.client_code}</td>
                        <td style={{ fontWeight: 700 }}>{c.name}</td>
                        <td>📍 {c.city}</td>
                        <td>🎂 {c.age ? `${c.age} años` : 'Sin edad'}</td>
                        <td>
                          <span className="badge badge-blue">{(c.motivacion || 'conexion_profunda').replace('_', ' ')}</span>
                        </td>
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
          <div className="card">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>⚙️ Horarios de Disponibilidad Semanal</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Configura tus horas de trabajo o inactiva días de descanso</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Define los días y franjas horarias en las que te encuentras disponible para realizar entrevistas. Los clientes verán la suma consolidada de cupos de forma neutra.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              {[1, 2, 3, 4, 5, 6, 0].map(dow => {
                const dayItem = availabilityList.find(a => a.day_of_week === dow) || {
                  day_of_week: dow,
                  start_time: '09:00',
                  end_time: '17:00',
                  is_active: dow >= 1 && dow <= 5
                }

                return (
                  <div key={dow} style={{
                    background: 'var(--bg-base)',
                    border: dayItem.is_active ? '1px solid var(--border-color)' : '1px dashed rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    padding: 18,
                    opacity: dayItem.is_active ? 1 : 0.6
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: dayItem.is_active ? 'var(--color-primary)' : 'var(--text-muted)', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{DAYS_ES[dow]}</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{
                          fontSize: 11,
                          padding: '3px 10px',
                          borderRadius: 20,
                          background: dayItem.is_active ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)',
                          color: dayItem.is_active ? '#4CAF50' : '#F44336',
                          borderColor: dayItem.is_active ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                        onClick={() => handleSaveDayAvailability({ ...dayItem, is_active: !dayItem.is_active })}
                      >
                        {dayItem.is_active ? '🟢 Laboral (Disponible)' : '🔴 No Laboral (Inactivo)'}
                      </button>
                    </div>

                    {dayItem.is_active ? (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                          <div>
                            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Hora Inicio</label>
                            <select
                              className="form-control"
                              style={{ fontSize: 12, padding: '6px 8px' }}
                              value={dayItem.start_time}
                              onChange={(e) => handleSaveDayAvailability({ ...dayItem, start_time: e.target.value })}
                            >
                              {['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00'].map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Hora Fin</label>
                            <select
                              className="form-control"
                              style={{ fontSize: 12, padding: '6px 8px' }}
                              value={dayItem.end_time}
                              onChange={(e) => handleSaveDayAvailability({ ...dayItem, end_time: e.target.value })}
                            >
                              {['12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'].map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                          <span>Franja: {dayItem.start_time} — {dayItem.end_time}</span>
                          {savingDay === dow && <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Guardando...</span>}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px 0' }}>
                        Día marcado como no laboral. No se ofrecerán citas a clientes este día.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


