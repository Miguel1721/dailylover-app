import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plus, UserCheck, ShieldAlert, Key } from 'lucide-react'

const API = 'https://prueba-daily.agentesia.cloud'

function UserModal({ roles, onClose, onSaved }) {
  const { token } = useAuth()
  const [employees, setEmployees] = useState([])
  const [form, setForm] = useState({ employee_id: '', email: '', role_id: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [createdCredentials, setCreatedCredentials] = useState(null) // { email, temp_pass }

  useEffect(() => {
    // Fetch all employees
    const fetchEmployees = async () => {
      try {
        const empRes = await fetch(`${API}/api/v1/admin/employees`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const emps = await empRes.json()
        
        // Fetch existing accounts to filter out employees who already have one
        const accRes = await fetch(`${API}/api/v1/admin/user-accounts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const accs = await accRes.json()
        const existingEmpIds = new Set(accs.map(a => a.employee_id))
        
        setEmployees(Array.isArray(emps) ? emps.filter(e => e.status === 'active' && !existingEmpIds.has(e.id)) : [])
      } catch (e) {
        console.error(e)
      }
    }
    
    fetchEmployees()
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.employee_id || !form.role_id) {
      setError('Por favor selecciona empleado y rol.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/v1/admin/user-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al crear cuenta')
      
      setCreatedCredentials({
        email: data.email,
        password: data.temporary_password
      })
      onSaved()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={createdCredentials ? undefined : onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Dar Acceso al Sistema</h2>
          {!createdCredentials && <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>}
        </div>

        {createdCredentials ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(76,175,80,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#4CAF50'
            }}>
              <Key size={28} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#4CAF50' }}>¡Acceso Generado con Éxito!</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, marginBottom: 24 }}>
              Copia y comparte estas credenciales con el empleado. No se volverán a mostrar.
            </p>

            <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 16, textAlign: 'left', marginBottom: 24 }}>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Correo de Ingreso</span>
                <div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'monospace', marginTop: 3 }}>{createdCredentials.email}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Contraseña Temporal</span>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-primary-light)', marginTop: 3 }}>
                  {createdCredentials.password}
                </div>
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%' }} onClick={onClose}>
              Entendido y Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Seleccionar Empleado</label>
              <select required value={form.employee_id} onChange={e => {
                const emp = employees.find(x => x.id === e.target.value)
                setForm({ ...form, employee_id: e.target.value, email: emp?.email || '' })
              }}>
                <option value="">-- Elige un empleado sin cuenta --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.role})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Correo Electrónico de Acceso</label>
              <input type="email" required placeholder="correo@dailylover.co" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Rol Asignado</label>
              <select required value={form.role_id} onChange={e => setForm({ ...form, role_id: e.target.value })}>
                <option value="">-- Asigna un rol de permisos --</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            {error && <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>{error}</div>}

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 16 }}>
              {loading ? 'Generando...' : 'Dar Acceso'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function UserAccounts() {
  const { token } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const fetchRoles = useCallback(() => {
    fetch(`${API}/api/v1/admin/roles`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setRoles(Array.isArray(data) ? data : []))
      .catch(err => console.error(err))
  }, [token])

  const fetchAccounts = useCallback(() => {
    setLoading(true)
    fetch(`${API}/api/v1/admin/user-accounts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setAccounts(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error(err)
        setAccounts([])
      })
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    fetchAccounts()
    fetchRoles()
  }, [fetchAccounts, fetchRoles])

  const handleRoleChange = async (accountId, roleId) => {
    try {
      const res = await fetch(`${API}/api/v1/admin/user-accounts/${accountId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role_id: roleId })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Error al reasignar rol')
      }
      fetchAccounts()
    } catch (e) {
      alert(e.message)
    }
  }

  const handleToggleStatus = async (accountId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active'
    if (newStatus === 'suspended' && !window.confirm('¿Estás seguro de suspender el acceso de este usuario?')) return
    
    try {
      const res = await fetch(`${API}/api/v1/admin/user-accounts/${accountId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al cambiar estado')
      fetchAccounts()
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Cuentas de Acceso</h1>
          <p className="page-subtitle">Gestión de accesos y credenciales del personal al panel</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setShowModal(true)}>
          <Plus size={16} /> Dar Acceso a Empleado
        </button>
      </div>

      <div className="content-area">
        <div className="card">
          {loading ? (
            <div className="empty-state">Cargando cuentas...</div>
          ) : accounts.length === 0 ? (
            <div className="empty-state">No hay cuentas de acceso creadas aún.</div>
          ) : (
            <div className="accounts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {accounts.map(acc => (
                <div key={acc.id} className="account-card" style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 12,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'var(--color-primary-glow)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-primary-light)',
                      fontWeight: 700,
                      fontSize: 14
                    }}>
                      {acc.employee_name ? acc.employee_name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {acc.employee_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {acc.email}
                      </div>
                    </div>
                    <span className={`badge ${acc.status === 'active' ? 'badge-green' : 'badge-red'}`} style={{ height: 'fit-content' }}>
                      {acc.status === 'active' ? 'Activo' : 'Suspendido'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, borderTop: '1px solid rgba(150,21,0,0.06)', paddingTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Rol en el Panel:</span>
                      <select
                        style={{ margin: 0, padding: '4px 8px', fontSize: 12, width: 140, background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 6 }}
                        value={acc.role_id || ''}
                        disabled={acc.role_name === 'Admin'}
                        onChange={e => handleRoleChange(acc.id, e.target.value)}
                      >
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Último ingreso:</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {acc.last_login_at ? new Date(acc.last_login_at).toLocaleDateString('es-CO') + ' ' + new Date(acc.last_login_at).toLocaleTimeString('es-CO', {hour: '2-digit', minute:'2-digit'}) : 'Nunca'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                    <button
                      className={`btn btn-sm ${acc.status === 'active' ? 'btn-ghost' : 'btn-primary'}`}
                      style={{
                        padding: '6px 12px',
                        fontSize: 11,
                        color: acc.status === 'active' ? '#ff6b6b' : 'white',
                        borderColor: acc.status === 'active' ? 'rgba(150,21,0,0.2)' : 'transparent',
                        width: '100%'
                      }}
                      disabled={acc.role_name === 'Admin' && acc.status === 'active' && accounts.filter(a => a.role_name === 'Admin' && a.status === 'active').length <= 1}
                      onClick={() => handleToggleStatus(acc.id, acc.status)}
                    >
                      {acc.status === 'active' ? 'Suspender Acceso' : 'Activar Acceso'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && <UserModal roles={roles} onClose={() => setShowModal(false)} onSaved={fetchAccounts} />}
    </div>
  )
}
