import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plus, Users, Calendar, AlertCircle, Heart, MapPin, DollarSign, FileText } from 'lucide-react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const API = 'https://prueba-daily.agentesia.cloud'

// ─── Severity helpers ────────────────────────────────────────────────────────
const SEVERITY_COLORS = {
  critical: { bg: 'rgba(220,38,38,0.15)', color: '#dc2626', label: 'Crítico' },
  high:     { bg: 'rgba(234,88,12,0.15)', color: '#ea580c', label: 'Alto' },
  medium:   { bg: 'rgba(202,138,4,0.15)', color: '#ca8a04', label: 'Medio' },
  low:      { bg: 'rgba(37,99,235,0.15)', color: '#2563eb', label: 'Bajo' },
}

function SeverityBadge({ severity }) {
  const s = SEVERITY_COLORS[severity] || SEVERITY_COLORS.low
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700
    }}>
      {s.label}
    </span>
  )
}

// ─── EventoForm ──────────────────────────────────────────────────────────────
function EventoForm({ onClose, onCreated }) {
  const { token } = useAuth()
  const [form, setForm] = useState({
    name: '',
    date: '',
    location: '',
    format: '',
    capacity: '',
    price: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/v1/admin/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          capacity: form.capacity ? Number(form.capacity) : undefined,
          price: form.price ? Number(form.price) : undefined
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Error al crear evento')
      }
      onCreated()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Nuevo Evento</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre del Evento</label>
            <input
              required
              placeholder="Ej: Speed Dating Rooftop Bogotá"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Fecha y Hora</label>
            <input
              type="datetime-local"
              required
              value={form.date}
              onChange={e => set('date', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Lugar</label>
            <input
              placeholder="Ej: Zona Rosa, Bogotá"
              value={form.location}
              onChange={e => set('location', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Formato</label>
            <input
              placeholder="Speed Dating, Padel, Rooftop, Cena..."
              value={form.format}
              onChange={e => set('format', e.target.value)}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Capacidad</label>
              <input
                type="number"
                min="1"
                placeholder="20"
                value={form.capacity}
                onChange={e => set('capacity', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Precio (COP)</label>
              <input
                type="number"
                min="0"
                placeholder="150000"
                value={form.price}
                onChange={e => set('price', e.target.value)}
              />
            </div>
          </div>
          {error && (
            <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: 'rgba(255,107,107,0.08)', borderRadius: 6 }}>
              {error}
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
            {loading ? 'Creando...' : 'Crear Evento'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── EventDetailModal (Asistentes + Bitácora + Presupuesto) ──────────────────
function EventDetailModal({ evento, onClose }) {
  const { token } = useAuth()

  // ── Tab state ──
  const [activeEventTab, setActiveEventTab] = useState('asistentes')

  // ── Asistentes state ──
  const [attendees, setAttendees] = useState([])
  const [attendeesLoading, setAttendeesLoading] = useState(true)

  // ── Bitácora state ──
  const [incidents, setIncidents] = useState([])
  const [incidentsLoading, setIncidentsLoading] = useState(false)
  const [showIncidentForm, setShowIncidentForm] = useState(false)
  const [incidentForm, setIncidentForm] = useState({
    category: 'seguridad',
    severity: 'medium',
    description: ''
  })
  const [incidentSubmitting, setIncidentSubmitting] = useState(false)

  // ── Presupuesto state ──
  const [budgetData, setBudgetData] = useState(null)
  const [budgetLoading, setBudgetLoading] = useState(false)
  const [budgetForm, setBudgetForm] = useState({ budget_income: '', budget_expenses: '' })
  const [budgetSubmitting, setBudgetSubmitting] = useState(false)

  const BADGES = {
    confirmed: 'badge-green',
    pending: 'badge-yellow',
    attended: 'badge-green',
    cancelled: 'badge-red',
    no_show: 'badge-gray'
  }

  // ── Fetch attendees ──
  useEffect(() => {
    setAttendeesLoading(true)
    fetch(`${API}/api/v1/admin/events/${evento.id}/attendees`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setAttendees(d.attendees || []))
      .catch(() => setAttendees([]))
      .finally(() => setAttendeesLoading(false))
  }, [evento.id, token])

  // ── Fetch incidents ──
  const fetchIncidents = () => {
    setIncidentsLoading(true)
    fetch(`${API}/api/v1/admin/events/${evento.id}/incidents`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setIncidents(Array.isArray(d) ? d : (d.incidents || [])))
      .catch(() => setIncidents([]))
      .finally(() => setIncidentsLoading(false))
  }

  // ── Fetch budget ──
  const fetchBudget = () => {
    setBudgetLoading(true)
    fetch(`${API}/api/v1/admin/events/${evento.id}/budget-comparison`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        setBudgetData(d)
        setBudgetForm({
          budget_income: d.budget_income ?? '',
          budget_expenses: d.budget_expenses ?? ''
        })
      })
      .catch(() => setBudgetData(null))
      .finally(() => setBudgetLoading(false))
  }

  // ── Trigger fetches when tab changes ──
  useEffect(() => {
    if (activeEventTab === 'bitacora') fetchIncidents()
    if (activeEventTab === 'presupuesto') fetchBudget()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEventTab, evento.id])

  // ── Resolve incident ──
  const resolveIncident = async (incidentId) => {
    await fetch(`${API}/api/v1/admin/incidents/${incidentId}/resolve`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    fetchIncidents()
  }

  // ── Submit new incident ──
  const submitIncident = async (e) => {
    e.preventDefault()
    setIncidentSubmitting(true)
    try {
      await fetch(`${API}/api/v1/admin/events/${evento.id}/incidents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(incidentForm)
      })
      setShowIncidentForm(false)
      setIncidentForm({ category: 'seguridad', severity: 'medium', description: '' })
      fetchIncidents()
    } finally {
      setIncidentSubmitting(false)
    }
  }

  // ── Submit budget update ──
  const submitBudget = async (e) => {
    e.preventDefault()
    setBudgetSubmitting(true)
    try {
      await fetch(`${API}/api/v1/admin/events/${evento.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          budget_income: Number(budgetForm.budget_income),
          budget_expenses: Number(budgetForm.budget_expenses)
        })
      })
      fetchBudget()
    } finally {
      setBudgetSubmitting(false)
    }
  }

  // ── Budget chart data ──
  const chartData = budgetData ? {
    labels: ['Ingresos', 'Gastos'],
    datasets: [
      {
        label: 'Presupuestado',
        data: [budgetData.budget_income || 0, budgetData.budget_expenses || 0],
        backgroundColor: 'rgba(37,99,235,0.7)',
        borderRadius: 6
      },
      {
        label: 'Real',
        data: [budgetData.real_income || 0, budgetData.real_expenses || 0],
        backgroundColor: 'rgba(219,39,119,0.7)',
        borderRadius: 6
      }
    ]
  } : null

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top', labels: { color: 'var(--text-secondary)', font: { size: 12 } } },
      title: { display: false }
    },
    scales: {
      x: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: {
        ticks: {
          color: 'var(--text-secondary)',
          callback: v => `$${Number(v).toLocaleString('es-CO')}`
        },
        grid: { color: 'rgba(255,255,255,0.05)' }
      }
    }
  }

  const verdictColor = {
    superavit: '#22c55e',
    deficit: '#ef4444',
    equilibrio: '#ca8a04'
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: '680px', maxWidth: '96vw' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{evento.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              {new Date(evento.date).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* PDF Export — Mejora 7 */}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => window.open(`${API}/api/v1/admin/events/${evento.id}/export-pdf`, '_blank')}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <FileText size={14} /> ⬇️ Exportar PDF
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border-color)', paddingBottom: 12, marginBottom: 16 }}>
          {[
            { key: 'asistentes', label: `Asistentes (${attendees.length})` },
            { key: 'bitacora',   label: '📋 Bitácora' },
            { key: 'presupuesto', label: '📊 Presupuesto' }
          ].map(tab => (
            <button
              key={tab.key}
              className={`btn btn-sm ${activeEventTab === tab.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveEventTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB: Asistentes ── */}
        {activeEventTab === 'asistentes' && (
          <>
            {attendeesLoading ? (
              <div className="empty-state">Cargando asistentes...</div>
            ) : attendees.length === 0 ? (
              <div className="empty-state">
                <Users size={28} style={{ color: 'var(--text-muted)', margin: '0 auto 12px', display: 'block' }} />
                No hay asistentes registrados aún.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {attendees.length} asistente{attendees.length !== 1 ? 's' : ''}
                </div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Teléfono</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendees.map(a => (
                        <tr key={a.user_id || a.user_phone}>
                          <td>{a.user_name || '—'}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.user_phone}</td>
                          <td>
                            <span className={`badge ${BADGES[a.status] || 'badge-gray'}`}>
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* ── TAB: Bitácora ── */}
        {activeEventTab === 'bitacora' && (
          <div>
            {/* Report incident button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => setShowIncidentForm(v => !v)}
              >
                {showIncidentForm ? '✕ Cancelar' : '+ Reportar Incidente'}
              </button>
            </div>

            {/* Inline incident form */}
            {showIncidentForm && (
              <form onSubmit={submitIncident} style={{
                background: 'var(--bg-sidebar)', borderRadius: 10, padding: 16, marginBottom: 18,
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Nuevo Incidente</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Categoría</label>
                    <select
                      value={incidentForm.category}
                      onChange={e => setIncidentForm(f => ({ ...f, category: e.target.value }))}
                    >
                      {['seguridad', 'tecnico', 'medico', 'comportamiento', 'logistica', 'otro'].map(c => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Severidad</label>
                    <select
                      value={incidentForm.severity}
                      onChange={e => setIncidentForm(f => ({ ...f, severity: e.target.value }))}
                    >
                      {['low', 'medium', 'high', 'critical'].map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>Descripción</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe el incidente..."
                    value={incidentForm.description}
                    onChange={e => setIncidentForm(f => ({ ...f, description: e.target.value }))}
                    style={{ resize: 'vertical' }}
                  />
                </div>
                <button className="btn btn-primary btn-sm" type="submit" disabled={incidentSubmitting}>
                  {incidentSubmitting ? 'Guardando...' : 'Guardar Incidente'}
                </button>
              </form>
            )}

            {/* Incident timeline */}
            {incidentsLoading ? (
              <div className="empty-state">Cargando bitácora...</div>
            ) : incidents.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                No hay incidentes registrados para este evento.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {incidents.map((inc, idx) => (
                  <div key={inc.id || idx} style={{ display: 'flex', gap: 14, position: 'relative' }}>
                    {/* Timeline line */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                        background: SEVERITY_COLORS[inc.severity]?.color || '#6b7280',
                        border: '2px solid var(--bg-card)'
                      }} />
                      {idx < incidents.length - 1 && (
                        <div style={{ width: 2, flex: 1, background: 'var(--border-color)', marginTop: 2 }} />
                      )}
                    </div>
                    {/* Card */}
                    <div style={{
                      flex: 1, background: 'var(--bg-sidebar)', borderRadius: 8, padding: '10px 14px',
                      marginBottom: 12, border: '1px solid var(--border-color)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                        <SeverityBadge severity={inc.severity} />
                        <span style={{
                          background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)',
                          padding: '2px 8px', borderRadius: 10, fontSize: 11, textTransform: 'capitalize'
                        }}>
                          {inc.category}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                          {inc.created_at ? new Date(inc.created_at).toLocaleString('es-CO') : '—'}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: '1.5', marginBottom: 8 }}>
                        {inc.description}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12 }}>
                          {inc.resolved
                            ? <span style={{ color: '#22c55e', fontWeight: 600 }}>✓ Resuelto</span>
                            : <span style={{ color: '#ef4444', fontWeight: 600 }}>✗ Pendiente</span>
                          }
                        </span>
                        {!inc.resolved && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, padding: '2px 10px' }}
                            onClick={() => resolveIncident(inc.id)}
                          >
                            Marcar Resuelto
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Presupuesto ── */}
        {activeEventTab === 'presupuesto' && (
          <div>
            {/* Budget set/update form */}
            <form onSubmit={submitBudget} style={{
              background: 'var(--bg-sidebar)', borderRadius: 10, padding: 16, marginBottom: 20,
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Establecer Presupuesto</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Ingresos Presupuestados (COP)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={budgetForm.budget_income}
                    onChange={e => setBudgetForm(f => ({ ...f, budget_income: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Gastos Presupuestados (COP)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={budgetForm.budget_expenses}
                    onChange={e => setBudgetForm(f => ({ ...f, budget_expenses: e.target.value }))}
                  />
                </div>
              </div>
              <button className="btn btn-primary btn-sm" type="submit" disabled={budgetSubmitting}>
                {budgetSubmitting ? 'Guardando...' : 'Actualizar Presupuesto'}
              </button>
            </form>

            {/* Chart + KPIs */}
            {budgetLoading ? (
              <div className="empty-state">Cargando datos de presupuesto...</div>
            ) : !budgetData ? (
              <div className="empty-state">No hay datos de presupuesto disponibles.</div>
            ) : (
              <>
                {/* Grouped bar chart */}
                <div style={{ background: 'var(--bg-sidebar)', borderRadius: 10, padding: 16, marginBottom: 16, border: '1px solid var(--border-color)' }}>
                  <Bar data={chartData} options={chartOptions} height={180} />
                </div>

                {/* Verdict badge */}
                {budgetData.verdict && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                    <span style={{
                      background: `${verdictColor[budgetData.verdict] || '#6b7280'}22`,
                      color: verdictColor[budgetData.verdict] || '#6b7280',
                      padding: '4px 18px', borderRadius: 20, fontWeight: 700, fontSize: 13,
                      textTransform: 'capitalize', border: `1px solid ${verdictColor[budgetData.verdict] || '#6b7280'}55`
                    }}>
                      {budgetData.verdict}
                    </span>
                  </div>
                )}

                {/* KPI comparison row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    {
                      label: 'Utilidad Neta Presupuestada',
                      value: budgetData.net_profit_budget,
                      color: (budgetData.net_profit_budget || 0) >= 0 ? '#22c55e' : '#ef4444'
                    },
                    {
                      label: 'Utilidad Neta Real',
                      value: budgetData.net_profit_real,
                      color: (budgetData.net_profit_real || 0) >= 0 ? '#22c55e' : '#ef4444'
                    }
                  ].map(kpi => (
                    <div key={kpi.label} style={{
                      background: 'var(--bg-sidebar)', borderRadius: 10, padding: '14px 16px',
                      border: '1px solid var(--border-color)', textAlign: 'center'
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{kpi.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: kpi.color }}>
                        {kpi.value != null
                          ? `$${Number(kpi.value).toLocaleString('es-CO')}`
                          : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CloseEventModal ─────────────────────────────────────────────────────────
function CloseEventModal({ evento, onClose, onClosed }) {
  const { token } = useAuth()
  // Default revenue = price * attendee_count
  const defaultRevenue = (evento.price || 0) * (evento.attendee_count || 0)
  const [revenue, setRevenue] = useState(defaultRevenue)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/v1/admin/events/${evento.id}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ revenue: Number(revenue) })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al cerrar evento')
      onClosed()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Cerrar Evento</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ background: 'rgba(150, 21, 0, 0.05)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertCircle size={18} style={{ color: 'var(--color-primary)', marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: '1.4em' }}>
              Al cerrar el evento se registrará el ingreso en finanzas y se calcularán automáticamente las comisiones de los empleados asociados.
            </div>
          </div>
          
          <div className="form-group">
            <label>Evento</label>
            <input disabled value={evento.name} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Asistentes</label>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{evento.attendee_count} personas</div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Precio Entrada</label>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>COP {Number(evento.price || 0).toLocaleString('es-CO')}</div>
            </div>
          </div>
          <div className="form-group">
            <label>Ingreso Recaudado Total (COP)</label>
            <input type="number" required value={revenue} onChange={e => setRevenue(e.target.value)} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
              Valor de recaudo sugerido en base al precio y asistencia.
            </span>
          </div>

          {error && <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 16 }}>
            {loading ? 'Cerrando Evento...' : 'Confirmar Cierre y Liquidar'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── EventCompatibilityModal ─────────────────────────────────────────────────
function EventCompatibilityModal({ evento, onClose }) {
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('groups')

  useEffect(() => {
    fetch(`${API}/api/v1/admin/events/${evento.id}/compatibility`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [evento.id, token])

  const getHeatmapColor = (score) => {
    if (score >= 90) return 'rgba(150, 21, 0, 0.85)'
    if (score >= 75) return 'rgba(150, 21, 0, 0.6)'
    if (score >= 50) return 'rgba(150, 21, 0, 0.35)'
    return 'rgba(150, 21, 0, 0.1)'
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: '800px', maxWidth: '95vw', background: 'var(--bg-card)' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Compatibilidad IA — {evento.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Análisis algorítmico y agrupamiento inteligente</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="empty-state" style={{ height: 300 }}>Procesando compatibilidad con IA...</div>
        ) : !data || data.groups.length === 0 ? (
          <div className="empty-state" style={{ height: 300 }}>No hay suficientes asistentes registrados para calcular compatibilidad.</div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
              <button
                className={`btn btn-sm ${activeTab === 'groups' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('groups')}
              >
                Mesas Sugeridas por IA
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'matrix' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('matrix')}
              >
                Matriz de Compatibilidad (Heatmap)
              </button>
            </div>

            {activeTab === 'groups' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, maxHeight: '50vh', overflowY: 'auto', padding: 4 }}>
                {data.groups.map((g, idx) => (
                  <div key={idx} className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: 18 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-primary)', marginBottom: 8 }}>{g.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, fontStyle: 'italic', lineHeight: '1.4' }}>{g.explanation}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {g.members.map((m, mIdx) => (
                        <div key={mIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-base)', borderRadius: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</span>
                          <span className="badge badge-gray" style={{ fontSize: 10 }}>{m.profile_summary}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: '50vh', padding: 4 }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600 }}>
                  <thead>
                    <tr>
                      <th style={{ background: 'var(--bg-sidebar)', padding: 8, fontSize: 11, border: '1px solid var(--border-color)', position: 'sticky', left: 0, zIndex: 5 }}>Nombre</th>
                      {data.matrix.names.map((name, idx) => (
                        <th key={idx} style={{ background: 'var(--bg-sidebar)', padding: 8, fontSize: 10, border: '1px solid var(--border-color)', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', maxHeight: 80 }}>
                          {name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.matrix.names.map((name, rowIdx) => (
                      <tr key={rowIdx}>
                        <td style={{ background: 'var(--bg-sidebar)', padding: '6px 10px', fontSize: 11, fontWeight: 600, border: '1px solid var(--border-color)', position: 'sticky', left: 0, zIndex: 4, whiteSpace: 'nowrap' }}>
                          {name}
                        </td>
                        {data.matrix.scores[rowIdx].map((score, colIdx) => (
                          <td
                            key={colIdx}
                            style={{
                              padding: 6,
                              fontSize: 10,
                              fontWeight: 700,
                              textAlign: 'center',
                              border: '1px solid rgba(150, 21, 0, 0.15)',
                              background: getHeatmapColor(score),
                              color: score >= 75 ? '#FFF' : 'var(--text-primary)',
                              cursor: 'default'
                            }}
                            title={`${name} vs ${data.matrix.names[colIdx]}: ${score}%`}
                          >
                            {score}%
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Eventos page ───────────────────────────────────────────────────────
export default function Eventos() {
  const { token, hasPermission } = useAuth()
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showAttendees, setShowAttendees] = useState(null)
  const [closingEvent, setClosingEvent] = useState(null)
  const [showCompatibility, setShowCompatibility] = useState(null)

  const fetchEventos = () => {
    setLoading(true)
    fetch(`${API}/api/v1/admin/events`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setEventos(d.events || []))
      .catch(() => setEventos([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchEventos() }, [])

  const isUpcoming = d => new Date(d) > new Date()

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Eventos</h1>
          <p className="page-subtitle">{eventos.length} eventos registrados</p>
        </div>
        {hasPermission('eventos', 'create') && (
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 32 }}
            onClick={() => setShowForm(true)}
          >
            <Plus size={16} /> Nuevo Evento
          </button>
        )}
      </div>
      <div className="content-area">
        {loading ? (
          <div className="card"><div className="empty-state">Cargando eventos...</div></div>
        ) : eventos.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              No hay eventos aún.<br />Crea tu primer evento con el botón de arriba.
            </div>
          </div>
        ) : (
          <div className="events-grid">
            {eventos.map(ev => {
              const upcoming = isUpcoming(ev.date)
              const attendeeCount = ev.attendee_count || 0
              const capacity = ev.capacity || 1
              const fillPercentage = Math.min(Math.round((attendeeCount / capacity) * 100), 100)
              
              return (
                <div key={ev.id} className="event-card">
                  <div>
                    <div className="event-card-header">
                      <span className="event-card-format">{ev.format || 'Otro Formato'}</span>
                      <span className={`badge ${upcoming ? 'badge-green' : 'badge-gray'}`}>
                        {upcoming ? 'Próximo' : 'Pasado'}
                      </span>
                    </div>
                    
                    <div className="event-card-title">{ev.name}</div>
                    
                    <div className="event-card-details">
                      <div className="event-card-detail-item">
                        <Calendar size={14} />
                        <span>
                          {new Date(ev.date).toLocaleDateString('es-CO', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="event-card-detail-item">
                        <MapPin size={14} />
                        <span>{ev.location || 'Sin ubicación'}</span>
                      </div>
                      <div className="event-card-detail-item">
                        <DollarSign size={14} />
                        <span>{ev.price ? `$${Number(ev.price).toLocaleString('es-CO')} COP` : 'Gratuito'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="event-card-capacity">
                      <div className="event-card-capacity-text">
                        <span>Aforo</span>
                        <span>{attendeeCount} / {ev.capacity || '∞'}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${fillPercentage}%` }} />
                      </div>
                    </div>
                    
                    <div className="event-card-actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                        onClick={() => setShowAttendees(ev)}
                      >
                        <Users size={13} /> Asistentes ({attendeeCount})
                      </button>
                      
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                        onClick={() => setShowCompatibility(ev)}
                      >
                        <Heart size={13} style={{ color: 'var(--color-primary)' }} /> Compatibilidad IA
                      </button>
                      
                      {!upcoming && hasPermission('eventos', 'close') && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, borderColor: 'var(--color-primary-glow)', color: 'var(--color-primary-light)' }}
                          onClick={() => setClosingEvent(ev)}
                        >
                          Cerrar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showForm && <EventoForm onClose={() => setShowForm(false)} onCreated={fetchEventos} />}
      {showAttendees && <EventDetailModal evento={showAttendees} onClose={() => setShowAttendees(null)} />}
      {closingEvent && <CloseEventModal evento={closingEvent} onClose={() => setClosingEvent(null)} onClosed={fetchEventos} />}
      {showCompatibility && <EventCompatibilityModal evento={showCompatibility} onClose={() => setShowCompatibility(null)} />}
    </div>
  )
}
