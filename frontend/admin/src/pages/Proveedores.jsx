import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { Search, Plus, Edit2, Clock, X, ChevronDown } from 'lucide-react'

const API = 'https://prueba-daily.agentesia.cloud'

// ─── Category badge color map ────────────────────────────────────────────────
const CATEGORY_BADGE = {
  catering:        'badge-green',
  logistica:       'badge-blue',
  marketing:       'badge-yellow',
  seguridad:       'badge-red',
  entretenimiento: 'badge-purple',
  otro:            'badge-gray',
}

// Inline purple badge (not in original CSS, so we define a style override)
const CATEGORY_STYLE = {
  entretenimiento: { background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' },
}

// ─── Status badge map ────────────────────────────────────────────────────────
const STATUS_BADGE = {
  activo:    'badge-green',
  inactivo:  'badge-red',
  potencial: 'badge-yellow',
}

// ─── Star Rating ─────────────────────────────────────────────────────────────
function StarRating({ value = 0, max = 5 }) {
  return (
    <span style={{ fontSize: 15, letterSpacing: 1 }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ color: i < value ? '#f59e0b' : 'var(--border-color)' }}>★</span>
      ))}
    </span>
  )
}

// ─── Category Badge Component ─────────────────────────────────────────────────
function CategoryBadge({ category }) {
  const cls = CATEGORY_BADGE[category] || 'badge-gray'
  const extraStyle = CATEGORY_STYLE[category] || {}
  return (
    <span className={`badge ${cls}`} style={extraStyle}>
      {category}
    </span>
  )
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────
const EMPTY_FORM = {
  name: '',
  category: 'catering',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  rating: 3,
  status: 'activo',
  notes: '',
}

function VendorModal({ vendor, onClose, onSaved }) {
  const { token } = useAuth()
  const [form, setForm] = useState(vendor ? { ...vendor } : { ...EMPTY_FORM })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isEdit = !!vendor

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const url = isEdit
      ? `${API}/api/v1/admin/vendors/${vendor.id}`
      : `${API}/api/v1/admin/vendors`
    const method = isEdit ? 'PUT' : 'POST'
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...form, rating: Number(form.rating) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al guardar proveedor')
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
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540, width: '100%' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{isEdit ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div className="form-group">
            <label className="form-label">Nombre *</label>
            <input
              className="input"
              required
              placeholder="Nombre del proveedor o aliado"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          {/* Category + Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="catering">Catering</option>
                <option value="logistica">Logística</option>
                <option value="marketing">Marketing</option>
                <option value="seguridad">Seguridad</option>
                <option value="entretenimiento">Entretenimiento</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="potencial">Potencial</option>
              </select>
            </div>
          </div>

          {/* Contact */}
          <div className="form-group">
            <label className="form-label">Nombre de Contacto</label>
            <input
              className="input"
              placeholder="Persona de contacto"
              value={form.contact_name}
              onChange={e => set('contact_name', e.target.value)}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input
                className="input"
                placeholder="+57 300 000 0000"
                value={form.contact_phone}
                onChange={e => set('contact_phone', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Correo Electrónico</label>
              <input
                className="input"
                type="email"
                placeholder="correo@ejemplo.com"
                value={form.contact_email}
                onChange={e => set('contact_email', e.target.value)}
              />
            </div>
          </div>

          {/* Rating */}
          <div className="form-group">
            <label className="form-label">Calificación (1–5)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                className="input"
                type="number"
                min={1}
                max={5}
                value={form.rating}
                onChange={e => set('rating', e.target.value)}
                style={{ width: 80 }}
              />
              <StarRating value={Number(form.rating)} />
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notas</label>
            <textarea
              placeholder="Observaciones, condiciones, etc."
              rows={3}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: 13,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {error && <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── History Modal ────────────────────────────────────────────────────────────
const EMPTY_HISTORY_FORM = {
  event_id: '',
  role: '',
  amount_paid: '',
  notes: '',
}

function HistoryModal({ vendor, onClose }) {
  const { token } = useAuth()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_HISTORY_FORM })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  const fetchHistory = useCallback(() => {
    setLoading(true)
    fetch(`${API}/api/v1/admin/vendors/${vendor.id}/history`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setHistory(Array.isArray(data) ? data : (data.history || [])))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [vendor.id, token])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const handleAddHistory = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch(`${API}/api/v1/admin/vendors/${vendor.id}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          event_id: Number(form.event_id),
          amount_paid: Number(form.amount_paid),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al registrar participación')
      setForm({ ...EMPTY_HISTORY_FORM })
      setShowForm(false)
      fetchHistory()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const setF = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 560, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Historial de Participaciones</h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{vendor.name}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 8px' }}>
          {loading ? (
            <div className="empty-state" style={{ padding: 32 }}>Cargando historial...</div>
          ) : history.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              No hay participaciones registradas aún.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {history.map((item, idx) => (
                <div key={item.id || idx} style={{
                  display: 'flex',
                  gap: 12,
                  padding: '14px 0',
                  borderBottom: idx < history.length - 1 ? '1px solid var(--border-color)' : 'none',
                }}>
                  {/* Timeline dot */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: 'var(--color-primary)', flexShrink: 0,
                    }} />
                    {idx < history.length - 1 && (
                      <div style={{ width: 2, flex: 1, background: 'var(--border-color)', marginTop: 4 }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {item.event_name || `Evento #${item.event_id}`}
                      </div>
                      {item.date && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                          {new Date(item.date).toLocaleDateString('es-CO')}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: item.notes ? 6 : 0 }}>
                      {item.role && (
                        <span className="badge badge-gray">{item.role}</span>
                      )}
                      {item.amount_paid != null && (
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          COP {Number(item.amount_paid).toLocaleString('es-CO')}
                        </span>
                      )}
                      {item.rating != null && (
                        <StarRating value={item.rating} />
                      )}
                    </div>
                    {item.notes && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{item.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Inline add-participation form */}
          {showForm && (
            <form
              onSubmit={handleAddHistory}
              style={{
                marginTop: 16,
                padding: 16,
                background: 'var(--bg-base)',
                borderRadius: 10,
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Registrar Nueva Participación</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>ID de Evento *</label>
                  <input
                    className="input"
                    type="number"
                    required
                    placeholder="ID del evento"
                    value={form.event_id}
                    onChange={e => setF('event_id', e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>Rol</label>
                  <input
                    className="input"
                    placeholder="Ej: Catering principal"
                    value={form.role}
                    onChange={e => setF('role', e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 10, marginBottom: 10 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Monto Pagado (COP)</label>
                <input
                  className="input"
                  type="number"
                  placeholder="0"
                  value={form.amount_paid}
                  onChange={e => setF('amount_paid', e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Notas</label>
                <input
                  className="input"
                  placeholder="Observaciones opcionales"
                  value={form.notes}
                  onChange={e => setF('notes', e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>
              {formError && <div style={{ color: '#ff6b6b', fontSize: 12, marginBottom: 10 }}>{formError}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setForm({ ...EMPTY_HISTORY_FORM }) }}>Cancelar</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                  {submitting ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer action */}
        {!showForm && (
          <div style={{ flexShrink: 0, paddingTop: 12, borderTop: '1px solid var(--border-color)', marginTop: 4 }}>
            <button
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => setShowForm(true)}
            >
              <Plus size={14} /> Registrar Participación
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Vendor Card ──────────────────────────────────────────────────────────────
function VendorCard({ vendor, onEdit, onHistory }) {
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        padding: '20px',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '' }}
    >
      {/* Top row: name + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', flex: 1, paddingRight: 8 }}>
          {vendor.name}
        </div>
        <span className={`badge ${STATUS_BADGE[vendor.status] || 'badge-gray'}`} style={{ flexShrink: 0 }}>
          {vendor.status}
        </span>
      </div>

      {/* Category */}
      <div style={{ marginBottom: 10 }}>
        <CategoryBadge category={vendor.category} />
      </div>

      {/* Rating */}
      <div style={{ marginBottom: 10 }}>
        <StarRating value={vendor.rating || 0} />
      </div>

      {/* Contact info */}
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
        {vendor.contact_name && (
          <div style={{ marginBottom: 2 }}>
            <span style={{ color: 'var(--text-muted)' }}>Contacto: </span>
            {vendor.contact_name}
          </div>
        )}
        {vendor.contact_phone && (
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Tel: </span>
            <span style={{ fontFamily: 'monospace' }}>{vendor.contact_phone}</span>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-color)' }}>
        <button
          className="btn btn-ghost btn-sm"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
          onClick={() => onHistory(vendor)}
        >
          <Clock size={13} /> Ver Historial
        </button>
        <button
          className="btn btn-ghost btn-sm"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
          onClick={() => onEdit(vendor)}
        >
          <Edit2 size={13} /> Editar
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Proveedores() {
  const { token } = useAuth()
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modals
  const [editVendor, setEditVendor] = useState(null)       // null = closed, {} = new, {id,...} = edit
  const [showEditModal, setShowEditModal] = useState(false)
  const [historyVendor, setHistoryVendor] = useState(null) // null = closed

  const fetchVendors = useCallback(() => {
    setLoading(true)
    fetch(`${API}/api/v1/admin/vendors`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setVendors(Array.isArray(data) ? data : (data.vendors || [])))
      .catch(() => setVendors([]))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => { fetchVendors() }, [fetchVendors])

  // Client-side filter by name
  const filtered = vendors.filter(v =>
    !search.trim() || v.name?.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => { setEditVendor(null); setShowEditModal(true) }
  const openEdit   = (v) => { setEditVendor(v);   setShowEditModal(true) }
  const closeEdit  = () => setShowEditModal(false)

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Proveedores &amp; Aliados</h1>
          <p className="page-subtitle">Gestión de proveedores, aliados y colaboradores estratégicos</p>
        </div>
        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={openCreate}
        >
          <Plus size={16} /> Nuevo Proveedor
        </button>
      </div>

      <div className="content-area">
        {/* Toolbar */}
        <div className="filters-row">
          <div style={{ position: 'relative' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              className="search-bar"
              style={{ paddingLeft: 36 }}
              placeholder="Buscar proveedor por nombre..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            {filtered.length} {filtered.length === 1 ? 'proveedor' : 'proveedores'}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="card"><div className="empty-state">Cargando proveedores...</div></div>
        ) : filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              {search ? 'No se encontraron proveedores con ese nombre.' : 'No hay proveedores registrados aún.'}
              {!search && (
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-primary btn-sm" onClick={openCreate}>
                    <Plus size={14} style={{ marginRight: 6 }} /> Crear primer proveedor
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {filtered.map(v => (
              <VendorCard
                key={v.id}
                vendor={v}
                onEdit={openEdit}
                onHistory={v => setHistoryVendor(v)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showEditModal && (
        <VendorModal
          vendor={editVendor}
          onClose={closeEdit}
          onSaved={fetchVendors}
        />
      )}

      {/* History Modal */}
      {historyVendor && (
        <HistoryModal
          vendor={historyVendor}
          onClose={() => setHistoryVendor(null)}
        />
      )}
    </div>
  )
}
