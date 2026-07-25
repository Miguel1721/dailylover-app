import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plus, Percent, Clock, CheckCircle } from 'lucide-react'

const API = 'https://prueba-daily.agentesia.cloud'

function RuleModal({ onClose, onSaved }) {
  const { token } = useAuth()
  const [employees, setEmployees] = useState([])
  const [form, setForm] = useState({ employee_id: '', commission_type: 'percentage', value: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API}/api/v1/admin/employees`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setEmployees(Array.isArray(data) ? data.filter(e => e.status === 'active') : []))
      .catch(err => console.error("Error loading employees:", err))
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.employee_id) {
      setError('Debes seleccionar un empleado.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API}/api/v1/admin/commission-rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          employee_id: form.employee_id,
          commission_type: form.commission_type,
          value: Number(form.value)
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al guardar regla')

      onSaved()
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
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Nueva Regla de Comisión</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Seleccionar Empleado</label>
            <select required value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}>
              <option value="">-- Elige un empleado activo --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.role})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Tipo de Comisión</label>
            <select value={form.commission_type} onChange={e => setForm({ ...form, commission_type: e.target.value })}>
              <option value="percentage">Porcentaje (%) del ingreso del evento</option>
              <option value="fixed">Valor Fijo (COP) por evento cerrado</option>
            </select>
          </div>
          <div className="form-group">
            <label>Valor ({form.commission_type === 'percentage' ? '%' : 'COP'})</label>
            <input type="number" required placeholder={form.commission_type === 'percentage' ? 'Ej: 2' : 'Ej: 80000'} value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
          </div>

          {error && <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 16 }}>
            {loading ? 'Creando...' : 'Crear Regla'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Commissions() {
  const { token, hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState('rules') // 'rules' or 'pending'
  const [rules, setRules] = useState([])
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const loadData = useCallback(() => {
    setLoading(true)
    const endpoint = activeTab === 'rules' ? 'commission-rules' : 'commissions/pending'
    fetch(`${API}/api/v1/admin/${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (activeTab === 'rules') {
          setRules(Array.isArray(data) ? data : [])
        } else {
          setPending(Array.isArray(data) ? data : [])
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [activeTab, token])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggleRule = async (ruleId) => {
    try {
      const res = await fetch(`${API}/api/v1/admin/commission-rules/${ruleId}/toggle`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        loadData()
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Calculate sum of pending commissions grouped by employee
  const groupedPending = pending.reduce((acc, curr) => {
    if (!acc[curr.employee_name]) {
      acc[curr.employee_name] = { id: curr.employee_id, total: 0, items: [] }
    }
    acc[curr.employee_name].total += curr.amount
    acc[curr.employee_name].items.push(curr)
    return acc
  }, {})

  const totalPendingSum = pending.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Comisiones</h1>
          <p className="page-subtitle">Configuración y monitoreo de incentivos por evento</p>
        </div>
        {activeTab === 'rules' && hasPermission('comisiones', 'manage') && (
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setShowModal(true)}>
            <Plus size={16} /> Nueva Regla
          </button>
        )}
      </div>

      <div className="content-area">
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
          <button
            className={`btn btn-sm ${activeTab === 'rules' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setActiveTab('rules')}
          >
            <Percent size={14} /> Reglas Activas
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'pending' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setActiveTab('pending')}
          >
            <Clock size={14} /> Comisiones Pendientes
          </button>
        </div>

        {activeTab === 'rules' ? (
          <div>
            {loading ? (
              <div className="card"><div className="empty-state">Cargando reglas...</div></div>
            ) : rules.length === 0 ? (
              <div className="card"><div className="empty-state">No hay reglas de comisión activas.</div></div>
            ) : (
              <div className="employees-grid">
                {rules.map(rule => (
                  <div key={rule.id} className="employee-card" style={{ minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px', textAlign: 'left', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{rule.employee_name}</h3>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aplica a: {rule.applies_to}</span>
                      </div>
                      <span className={`badge ${rule.active ? 'badge-green' : 'badge-gray'}`}>
                        {rule.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>

                    <div style={{ background: 'rgba(150, 21, 0, 0.05)', padding: '12px 16px', borderRadius: 8, margin: '12px 0', border: '1px solid rgba(150, 21, 0, 0.1)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        {rule.commission_type === 'percentage' ? 'Porcentaje por Evento' : 'Valor Fijo por Evento'}
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-primary-light)' }}>
                        {rule.commission_type === 'percentage' ? `${rule.value}%` : `COP ${rule.value.toLocaleString('es-CO')}`}
                      </div>
                    </div>

                    {hasPermission('comisiones', 'manage') && (
                      <div style={{ borderTop: '1px solid rgba(150, 21, 0, 0.08)', paddingTop: 12, marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          className={`btn btn-sm ${rule.active ? 'btn-ghost' : 'btn-primary'}`}
                          style={{ padding: '6px 12px', fontSize: 12 }}
                          onClick={() => handleToggleRule(rule.id)}
                        >
                          {rule.active ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Pending Commissions Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 20 }}>
              <div className="stat-card" style={{ padding: 24 }}>
                <div className="stat-label">Comisiones Pendientes Totales</div>
                <div className="stat-number" style={{ color: 'var(--color-primary)', fontSize: 36, marginTop: 8 }}>
                  COP {totalPendingSum.toLocaleString('es-CO')}
                </div>
                <div className="stat-trend" style={{ marginTop: 12 }}>
                  Se liquidarán automáticamente en la nómina del periodo correspondiente.
                </div>
              </div>
            </div>

            {loading ? (
              <div className="card"><div className="empty-state">Cargando comisiones...</div></div>
            ) : Object.keys(groupedPending).length === 0 ? (
              <div className="card"><div className="empty-state">No hay comisiones acumuladas pendientes.</div></div>
            ) : (
              <div>
                {Object.entries(groupedPending).map(([employeeName, data]) => (
                  <div key={employeeName} style={{ marginBottom: 28, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(150, 21, 0, 0.1)', paddingBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar-circle" style={{ margin: 0, width: 36, height: 36 }}>
                          {employeeName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 16 }}>{employeeName}</span>
                      </div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                        Acumulado: <strong style={{ color: 'var(--color-primary-light)', fontSize: 16 }}>COP {data.total.toLocaleString('es-CO')}</strong>
                      </span>
                    </div>
                    
                    {/* Vertical Connection Cards / Timeline */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {data.items.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 0, 0, 0.2)', padding: '12px 16px', borderRadius: 8, border: '1px solid rgba(150, 21, 0, 0.05)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{item.event_name}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {new Date(item.event_date).toLocaleDateString('es-CO')}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary-light)' }}>
                              + COP {item.amount.toLocaleString('es-CO')}
                            </span>
                            <span className="badge badge-yellow" style={{ fontSize: 10 }}>Pendiente</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && <RuleModal onClose={() => setShowModal(false)} onSaved={loadData} />}
    </div>
  )
}
