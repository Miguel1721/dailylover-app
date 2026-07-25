import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plus, Search, Edit2, UserX, UserCheck } from 'lucide-react'

const API = 'https://prueba-daily.agentesia.cloud'

function EmployeeModal({ employee, onClose, onSaved }) {
  const { token } = useAuth()
  const [form, setForm] = useState(
    employee || { full_name: '', role: '', phone: '', email: '', base_salary: '', contract_type: 'nomina', hire_date: new Date().toISOString().split('T')[0], status: 'active' }
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isEdit = !!employee

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const url = isEdit ? `${API}/api/v1/admin/employees/${employee.id}` : `${API}/api/v1/admin/employees`
    const method = isEdit ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          base_salary: Number(form.base_salary)
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al guardar empleado')

      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivate = async () => {
    if (!window.confirm('¿Estás seguro de que deseas desactivar a este empleado? Se revocará también su acceso al panel.')) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/v1/admin/employees/${employee.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Error al desactivar')
      }
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
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{isEdit ? 'Editar Empleado' : 'Nuevo Empleado'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre Completo</label>
            <input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Cargo / Rol</label>
            <input required placeholder="Ej: Coordinadora de Eventos" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Teléfono</label>
              <input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Correo Electrónico</label>
              <input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Salario Base (COP)</label>
              <input type="number" required value={form.base_salary} onChange={e => setForm({ ...form, base_salary: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Tipo de Contrato</label>
              <select value={form.contract_type} onChange={e => setForm({ ...form, contract_type: e.target.value })}>
                <option value="nomina">Nómina</option>
                <option value="prestacion_servicios">Prestación de Servicios</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Fecha de Contratación</label>
            <input type="date" required value={form.hire_date} onChange={e => setForm({ ...form, hire_date: e.target.value })} />
          </div>

          {isEdit && (
            <div className="form-group">
              <label>Estado</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          )}

          {error && <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            {isEdit && employee.status === 'active' && (
              <button className="btn btn-ghost btn-sm" type="button" onClick={handleDeactivate} style={{ borderColor: '#ff6b6b', color: '#ff6b6b' }}>
                <UserX size={14} style={{ marginRight: 6 }} /> Desactivar
              </button>
            )}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginLeft: 'auto', flex: 1 }}>
              {loading ? 'Guardando...' : 'Guardar Empleado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Employees() {
  const { token, hasPermission } = useAuth()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [showModal, setShowModal] = useState(false)

  const fetchEmployees = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ search })
    fetch(`${API}/api/v1/admin/employees?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setEmployees(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error("Error fetching employees:", err)
        setEmployees([])
      })
      .finally(() => setLoading(false))
  }, [search, token])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Personal de Trabajo</h1>
          <p className="page-subtitle">{employees.length} empleados registrados</p>
        </div>
        {hasPermission('empleados', 'create') && (
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => { setSelected(null); setShowModal(true) }}>
            <Plus size={16} /> Nuevo Empleado
          </button>
        )}
      </div>

      <div className="content-area">
        <div className="filters-row">
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="search-bar"
              style={{ paddingLeft: 36 }}
              placeholder="Buscar empleado por nombre..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="card"><div className="empty-state">Cargando personal...</div></div>
        ) : employees.length === 0 ? (
          <div className="card"><div className="empty-state">No se encontraron empleados.</div></div>
        ) : (
          <div className="employees-grid">
            {employees.map(emp => {
              const initials = emp.full_name
                ? emp.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                : '?'
              
              return (
                <div
                  key={emp.id}
                  className="employee-card"
                  style={{ cursor: hasPermission('empleados', 'edit') ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (hasPermission('empleados', 'edit')) {
                      setSelected(emp)
                      setShowModal(true)
                    }
                  }}
                >
                  {hasPermission('empleados', 'edit') && (
                    <button
                      className="btn btn-ghost btn-sm employee-card-edit-btn"
                      onClick={e => {
                        e.stopPropagation()
                        setSelected(emp)
                        setShowModal(true)
                      }}
                    >
                      <Edit2 size={13} />
                    </button>
                  )}
                  
                  <div className="employee-card-avatar">{initials}</div>
                  <div className="employee-card-name">{emp.full_name}</div>
                  <div className="employee-card-role">{emp.role}</div>
                  
                  <div className="employee-card-details">
                    <div className="employee-card-detail-row">
                      <span className="employee-card-detail-label">Teléfono</span>
                      <span className="employee-card-detail-value" style={{ fontFamily: 'monospace' }}>{emp.phone || '—'}</span>
                    </div>
                    <div className="employee-card-detail-row">
                      <span className="employee-card-detail-label">Contrato</span>
                      <span className="employee-card-detail-value" style={{ textTransform: 'capitalize' }}>
                        {emp.contract_type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="employee-card-detail-row">
                      <span className="employee-card-detail-label">Salario Base</span>
                      <span className="employee-card-detail-value" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        COP {Number(emp.base_salary).toLocaleString('es-CO')}
                      </span>
                    </div>
                    <div className="employee-card-detail-row">
                      <span className="employee-card-detail-label">Estado</span>
                      <span className={`badge ${emp.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                        {emp.status === 'active' ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && <EmployeeModal employee={selected} onClose={() => setShowModal(false)} onSaved={fetchEmployees} />}
    </div>
  )
}
