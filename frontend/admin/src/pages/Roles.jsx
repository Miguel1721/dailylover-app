import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plus, Shield, CheckSquare, Trash2, Edit2 } from 'lucide-react'

const API = 'https://prueba-daily.agentesia.cloud'

function RoleModal({ onClose, onSaved }) {
  const { token } = useAuth()
  const [form, setForm] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/v1/admin/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al crear rol')
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
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Nuevo Rol de Sistema</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre del Rol</label>
            <input required placeholder="Ej: Ventas, Logística, etc." value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Descripción / Responsabilidades</label>
            <textarea placeholder="Describe qué permisos generales tiene este perfil..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>

          {error && <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 16 }}>
            {loading ? 'Creando...' : 'Crear Rol'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Roles() {
  const { token } = useAuth()
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [selectedRole, setSelectedRole] = useState(null) // Role object being configured
  const [selectedRolePerms, setSelectedRolePerms] = useState([]) // Array of permission IDs
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState(null)

  const fetchRoles = useCallback(() => {
    setLoading(true)
    fetch(`${API}/api/v1/admin/roles`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setRoles(Array.isArray(data) ? data : []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    fetchRoles()
    
    // Load permission catalog once
    fetch(`${API}/api/v1/admin/permissions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setPermissions(Array.isArray(data) ? data : []))
      .catch(err => console.error(err))
  }, [fetchRoles, token])

  const handleSelectRole = async (role) => {
    setSelectedRole(role)
    setError(null)
    if (role.is_system) {
      setSelectedRolePerms([])
      return
    }
    
    try {
      const res = await fetch(`${API}/api/v1/admin/roles/${role.id}/permissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setSelectedRolePerms(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    }
  }

  const handleTogglePermission = (permId) => {
    setSelectedRolePerms(prev => 
      prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
    )
  }

  const handleSavePermissions = async () => {
    if (!selectedRole) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/v1/admin/roles/${selectedRole.id}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ permission_ids: selectedRolePerms })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Error al guardar permisos')
      }
      alert('¡Permisos guardados correctamente!')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRole = async (roleId) => {
    if (!window.confirm('¿Estás seguro de eliminar este rol de sistema?')) return
    try {
      const res = await fetch(`${API}/api/v1/admin/roles/${roleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al borrar')
      
      setSelectedRole(null)
      fetchRoles()
    } catch (err) {
      alert(err.message)
    }
  }

  // Group permission catalog by module
  const groupedPermissions = permissions.reduce((acc, curr) => {
    if (!acc[curr.module]) {
      acc[curr.module] = []
    }
    acc[curr.module].push(curr)
    return acc
  }, {})

  const MODULE_TRANSLATIONS = {
    "dashboard": "Dashboard",
    "clientes": "Clientes (CRM)",
    "eventos": "Eventos",
    "importar": "Importar Excel",
    "matching": "Matchmaking (Compatibilidad)",
    "empleados": "Empleados (Nómina)",
    "nomina": "Nómina",
    "comisiones": "Comisiones",
    "ingresos": "Ingresos",
    "gastos": "Gastos",
    "flujo_caja": "Flujo de Caja",
    "roles": "Roles de Sistema",
    "usuarios": "Cuentas de Acceso"
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Roles y Permisos</h1>
          <p className="page-subtitle">Configura perfiles de acceso y asocia permisos modulares</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setShowModal(true)}>
          <Plus size={16} /> Nuevo Rol
        </button>
      </div>

      <div className="content-area">
        <div className="responsive-grid-2" style={{ gridTemplateColumns: '1fr 1.5fr' }}>
          {/* Roles list */}
          <div className="card" style={{ height: 'fit-content' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Shield size={18} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Roles Registrados</h3>
            </div>

            {loading ? (
              <div className="empty-state">Cargando roles...</div>
            ) : (
              <div>
                {roles.map(role => (
                  <div
                    key={role.id}
                    style={{
                      background: selectedRole?.id === role.id ? 'rgba(150,21,0,0.08)' : 'var(--bg-base)',
                      border: selectedRole?.id === role.id ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                      borderRadius: 10,
                      padding: 16,
                      marginBottom: 10,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start'
                    }}
                    onClick={() => handleSelectRole(role)}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{role.name}</span>
                        {role.is_system && <span className="badge badge-red">Sistema (Admin)</span>}
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {role.description || 'Sin descripción'}
                      </p>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                        {role.user_count} usuarios asignados
                      </div>
                    </div>
                    {!role.is_system && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#ff6b6b', borderColor: 'transparent', padding: 4 }}
                        onClick={e => { e.stopPropagation(); handleDeleteRole(role.id) }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Permissions grid */}
          <div className="card">
            {selectedRole ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>Configuración de Permisos: {selectedRole.name}</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {selectedRole.is_system ? 'Este rol tiene privilegios totales en todos los módulos.' : 'Marca las casillas correspondientes de acceso.'}
                    </p>
                  </div>
                  {!selectedRole.is_system && (
                    <button className="btn btn-primary btn-sm" onClick={handleSavePermissions} disabled={saving}>
                      {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                  )}
                </div>

                {error && (
                  <div style={{ color: '#ff6b6b', background: 'rgba(150,21,0,0.1)', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                    {error}
                  </div>
                )}

                {selectedRole.is_system ? (
                  <div className="empty-state" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 12 }}>
                    El rol Administrador de Sistema cuenta con acceso total implícito. No es necesario ni posible restringir sus permisos.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {Object.entries(groupedPermissions).map(([module, perms]) => (
                      <div key={module} style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--color-primary-light)', borderBottom: '1px solid rgba(150,21,0,0.08)', paddingBottom: 6 }}>
                          {MODULE_TRANSLATIONS[module] || module}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          {perms.map(p => (
                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', margin: 0 }}>
                              <input
                                type="checkbox"
                                checked={selectedRolePerms.includes(p.id)}
                                onChange={() => handleTogglePermission(p.id)}
                                style={{ margin: 0, width: 16, height: 16 }}
                              />
                              <span style={{ color: selectedRolePerms.includes(p.id) ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                {p.label.split(' ')[0]}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                Selecciona un rol del listado lateral para configurar sus permisos modulares.
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && <RoleModal onClose={() => setShowModal(false)} onSaved={fetchRoles} />}
    </div>
  )
}
