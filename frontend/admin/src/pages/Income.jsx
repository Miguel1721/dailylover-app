import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plus, Search, ArrowUpRight } from 'lucide-react'

const API = 'https://prueba-daily.agentesia.cloud'

function IncomeModal({ onClose, onSaved }) {
  const { token } = useAuth()
  const [events, setEvents] = useState([])
  const [form, setForm] = useState({
    event_id: '',
    category: 'membresia',
    description: '',
    amount: '',
    payment_method: 'transferencia',
    received_at: new Date().toISOString().split('T')[0]
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
      const res = await fetch(`${API}/api/v1/admin/finance/income`, {
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
      if (!res.ok) throw new Error(data.detail || 'Error al guardar ingreso')
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
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Registrar Ingreso Manual</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Categoría</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="membresia">Membresía VIP</option>
              <option value="inscripcion">Inscripción Evento</option>
              <option value="otro">Otro Ingreso</option>
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
            <input required placeholder="Ej: Pago mensualidad VIP Juan Perez" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
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
            <label>Fecha de Recibo</label>
            <input type="date" required value={form.received_at} onChange={e => setForm({ ...form, received_at: e.target.value })} />
          </div>

          {error && <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 16 }}>
            {loading ? 'Registrando...' : 'Registrar Ingreso'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Income() {
  const { token, hasPermission } = useAuth()
  const [incomes, setIncomes] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showModal, setShowModal] = useState(false)

  const fetchIncome = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (categoryFilter) params.append('category', categoryFilter)
    
    fetch(`${API}/api/v1/admin/finance/income?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setIncomes(Array.isArray(data) ? data : []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [categoryFilter, token])

  useEffect(() => {
    fetchIncome()
  }, [fetchIncome])

  const totalIncomeSum = incomes.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Ingresos</h1>
          <p className="page-subtitle">Libro diario de ingresos y recaudos</p>
        </div>
        {hasPermission('ingresos', 'create') && (
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setShowModal(true)}>
            <Plus size={16} /> Registrar Ingreso
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
              background: 'rgba(76,175,80,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4CAF50'
            }}>
              <ArrowUpRight size={24} />
            </div>
            <div>
              <div className="stat-label">Total Ingresos Filtrados</div>
              <div className="stat-number" style={{ color: '#4CAF50', fontSize: 28, marginTop: 4 }}>
                COP {totalIncomeSum.toLocaleString('es-CO')}
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
              <option value="membresia">Membresía VIP</option>
              <option value="inscripcion">Inscripción Evento</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="card"><div className="empty-state">Cargando ingresos...</div></div>
        ) : incomes.length === 0 ? (
          <div className="card"><div className="empty-state">No se registraron ingresos en este periodo.</div></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {incomes.map(inc => (
              <div key={inc.id} style={{
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
                    background: inc.category === 'membresia' ? 'rgba(33,150,243,0.1)' : inc.category === 'inscripcion' ? 'rgba(76,175,80,0.1)' : 'rgba(155,155,155,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: inc.category === 'membresia' ? '#2196F3' : inc.category === 'inscripcion' ? '#4CAF50' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: 16
                  }}>
                    {inc.category === 'membresia' ? 'M' : inc.category === 'inscripcion' ? 'I' : 'O'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{inc.description}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      <span className={`badge ${inc.category === 'membresia' ? 'badge-blue' : inc.category === 'inscripcion' ? 'badge-green' : 'badge-gray'}`}>
                        {inc.category === 'membresia' ? 'Membresía' : inc.category === 'inscripcion' ? 'Inscripción' : inc.category}
                      </span>
                      {inc.payment_method && (
                        <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>
                          {inc.payment_method}
                        </span>
                      )}
                      {inc.event_name && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          • Evento: {inc.event_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'monospace', color: '#4CAF50', fontWeight: 700, fontSize: 16 }}>
                    + COP {Number(inc.amount).toLocaleString('es-CO')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {new Date(inc.received_at).toLocaleDateString('es-CO')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && <IncomeModal onClose={() => setShowModal(false)} onSaved={fetchIncome} />}
    </div>
  )
}
