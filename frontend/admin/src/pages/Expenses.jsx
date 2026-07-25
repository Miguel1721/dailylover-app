import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plus, Search, ArrowDownRight } from 'lucide-react'

const API = 'https://prueba-daily.agentesia.cloud'

function ExpenseModal({ onClose, onSaved }) {
  const { token } = useAuth()
  const [events, setEvents] = useState([])
  const [form, setForm] = useState({
    event_id: '',
    category: 'logistica',
    description: '',
    amount: '',
    payment_method: 'transferencia',
    paid_at: new Date().toISOString().split('T')[0]
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API}/api/v1/admin/events`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setEvents(data.events || []))
      .catch(err => console.error(err))
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/v1/admin/finance/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          event_id: form.event_id ? Number(form.event_id) : null,
          amount: Number(form.amount)
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al guardar gasto')
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
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Registrar Gasto Manual</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Categoría</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="logistica">Logística Evento</option>
              <option value="marketing">Publicidad y Marketing</option>
              <option value="nomina">Nómina / Salarios</option>
              <option value="arriendo">Arriendo de Oficina</option>
              <option value="comision_aliado">Comisión Aliado</option>
              <option value="otro">Otro Gasto</option>
            </select>
          </div>
          <div className="form-group">
            <label>Asociar a Evento (Opcional)</label>
            <select value={form.event_id} onChange={e => setForm({ ...form, event_id: e.target.value })}>
              <option value="">-- No asociado --</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.name} ({new Date(ev.date).toLocaleDateString('es-CO')})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Descripción / Concepto</label>
            <input required placeholder="Ej: Compra de copas y decoración speed dating" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Monto (COP)</label>
              <input type="number" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Método de Pago</label>
              <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
                <option value="transferencia">Transferencia Bancaria</option>
                <option value="nequi">Nequi / Daviplata</option>
                <option value="tarjeta">Tarjeta Crédito/Débito</option>
                <option value="efectivo">Efectivo</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Fecha de Pago</label>
            <input type="date" required value={form.paid_at} onChange={e => setForm({ ...form, paid_at: e.target.value })} />
          </div>

          {error && <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 16 }}>
            {loading ? 'Registrando...' : 'Registrar Gasto'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Expenses() {
  const { token, hasPermission } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showModal, setShowModal] = useState(false)

  const fetchExpenses = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (categoryFilter) params.append('category', categoryFilter)
    
    fetch(`${API}/api/v1/admin/finance/expenses?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setExpenses(Array.isArray(data) ? data : []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [categoryFilter, token])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  const totalExpenseSum = expenses.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Gastos</h1>
          <p className="page-subtitle">Libro de egresos y facturación de la empresa</p>
        </div>
        {hasPermission('gastos', 'create') && (
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setShowModal(true)}>
            <Plus size={16} /> Registrar Gasto
          </button>
        )}
      </div>

      <div className="content-area">
        {/* Stats card */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 20 }}>
          <div className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(150,21,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)'
            }}>
              <ArrowDownRight size={24} />
            </div>
            <div>
              <div className="stat-label">Total Gastos Filtrados</div>
              <div className="stat-number" style={{ color: '#ff6b6b', fontSize: 28, marginTop: 4 }}>
                COP {totalExpenseSum.toLocaleString('es-CO')}
              </div>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Filtrar por Categoría:</span>
            <select
              style={{ width: 200, marginBottom: 0 }}
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              <option value="logistica">Logística Evento</option>
              <option value="marketing">Publicidad y Marketing</option>
              <option value="nomina">Nómina / Salarios</option>
              <option value="arriendo">Arriendo de Oficina</option>
              <option value="comision_aliado">Comisión Aliado</option>
              <option value="otro">Otro Gasto</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="card"><div className="empty-state">Cargando gastos...</div></div>
        ) : expenses.length === 0 ? (
          <div className="card"><div className="empty-state">No se registraron gastos en este periodo.</div></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {expenses.map(exp => (
              <div key={exp.id} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s',
              }}
              className="matching-card"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: exp.category === 'nomina' ? 'rgba(255,193,7,0.1)' : exp.category === 'marketing' ? 'rgba(33,150,243,0.1)' : 'rgba(150,21,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: exp.category === 'nomina' ? '#FFC107' : exp.category === 'marketing' ? '#2196F3' : 'var(--color-primary-light)',
                    fontWeight: 700,
                    fontSize: 16
                  }}>
                    {exp.category === 'nomina' ? 'N' : exp.category === 'marketing' ? 'M' : exp.category === 'logistica' ? 'L' : 'G'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{exp.description}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      <span className={`badge ${exp.category === 'nomina' ? 'badge-yellow' : exp.category === 'marketing' ? 'badge-blue' : 'badge-gray'}`}>
                        {exp.category === 'logistica' ? 'Logística' : exp.category === 'nomina' ? 'Nómina' : exp.category === 'comision_aliado' ? 'Comisión Aliado' : exp.category}
                      </span>
                      {exp.payment_method && (
                        <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>
                          {exp.payment_method}
                        </span>
                      )}
                      {exp.event_name && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          • Evento: {exp.event_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'monospace', color: '#ff6b6b', fontWeight: 700, fontSize: 16 }}>
                    - COP {Number(exp.amount).toLocaleString('es-CO')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {new Date(exp.paid_at).toLocaleDateString('es-CO')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && <ExpenseModal onClose={() => setShowModal(false)} onSaved={fetchExpenses} />}
    </div>
  )
}
