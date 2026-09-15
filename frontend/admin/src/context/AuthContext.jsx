import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext()

const API = 'https://prueba-daily.agentesia.cloud'

export const ADMIN_EMAILS = [
  'mariapaula@dailylover.com',
  'admin@dailylover.co',
  'admin@dailylover.com',
  'miguel.lozano1408@gmail.com'
]

export const ADMIN_ROLES = [
  'Admin',
  'Super Admin',
  'SUPERADMIN',
  'María'
]

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('dl_user')
    return savedUser ? JSON.parse(savedUser) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem('dl_token'))
  const [config, setConfig] = useState({ demo_mode: false })
  const [loading, setLoading] = useState(true)
  const [previewRole, setPreviewRole] = useState(() => sessionStorage.getItem('dl_preview_role') || null)

  useEffect(() => {
    // Fetch configuration settings on load
    fetch(`${API}/api/v1/config`)
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error("Error loading config:", err))

    // Automatically refresh user role and permissions from DB
    const tokenToUse = localStorage.getItem('dl_token')
    if (tokenToUse) {
      fetch(`${API}/api/v1/auth/me`, {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
      })
        .then(res => {
          if (res.ok) return res.json()
          return null
        })
        .then(freshUser => {
          if (freshUser) {
            const isAtrasados = freshUser.role === 'atrasados_only' || freshUser.email?.toLowerCase().includes('atrasados')
            const isAdm = !isAtrasados && freshUser.email && ADMIN_EMAILS.includes(freshUser.email.trim().toLowerCase())
            const roleToAssign = freshUser.role || (isAdm ? 'Super Admin' : 'Sin Asignar')
            const updated = {
              ...freshUser,
              role: roleToAssign
            }
            localStorage.setItem('dl_user', JSON.stringify(updated))
            setUser(updated)
          }
        })
        .catch(err => console.error("Error refreshing user:", err))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const handleSetPreviewRole = (role) => {
    if (role) {
      sessionStorage.setItem('dl_preview_role', role)
      setPreviewRole(role)
    } else {
      sessionStorage.removeItem('dl_preview_role')
      setPreviewRole(null)
    }
  }

  const isOriginalAdmin = Boolean(
    user && user.role !== 'atrasados_only' && !user.email?.toLowerCase().includes('atrasados') && (
      ADMIN_ROLES.includes(user.role) ||
      (user.email && ADMIN_EMAILS.includes(user.email.trim().toLowerCase()))
    )
  )

  const effectiveRole = previewRole || user?.role || (isOriginalAdmin ? 'Super Admin' : '')

  const effectiveUser = user ? {
    ...user,
    role: effectiveRole || (isOriginalAdmin ? 'Super Admin' : user.role || 'Sin Asignar'),
    name: previewRole ? `${user.name || user.email} [Ver como: ${previewRole}]` : (user.name || user.email),
    isPreview: Boolean(previewRole)
  } : null

  const hasPermission = (module, action) => {
    if (!user) return false

    // Rol restringido de atrasados: SOLO matching view para sus 2 páginas permitidas
    if (effectiveRole === 'atrasados_only' || user?.role === 'atrasados_only') {
      if (module === 'matching' && action === 'view') return true
      return false
    }

    // Admins and Maria Paula always have full access when not simulating
    if (!previewRole && isOriginalAdmin) {
      return true
    }

    const role = previewRole || user?.role || (isOriginalAdmin ? 'Super Admin' : '')

    // Admin and Super Admin roles have total access
    if (ADMIN_ROLES.includes(role)) {
      return true
    }

    if (role === 'Psicóloga' || (typeof role === 'string' && (role.toLowerCase().includes('psicolog') || role.toLowerCase().includes('matchmaker')))) {
      if (['roles', 'usuarios', 'empleados', 'nomina', 'comisiones', 'ingresos', 'gastos', 'flujo_caja', 'proveedores', 'importar', 'eventos'].includes(module)) {
        return false
      }
      if (module === 'dashboard' && action === 'view') return true
      if (module === 'clientes' && action === 'view') return true
      if (module === 'matching' && action === 'view') return true
      return false
    }

    if (role === 'Servicio al Cliente') {
      if (['roles', 'usuarios', 'empleados', 'nomina', 'comisiones', 'ingresos', 'gastos', 'flujo_caja', 'proveedores', 'importar', 'eventos', 'dashboard'].includes(module)) {
        return false
      }
      if (module === 'clientes' && action === 'view') return true
      if (module === 'matching' && action === 'view') return true
      return false
    }

    if (role === 'Lina (Refunds)') {
      if (['roles', 'usuarios', 'empleados', 'nomina', 'comisiones', 'proveedores', 'importar', 'eventos', 'dashboard', 'clientes'].includes(module)) {
        return false
      }
      if (module === 'matching' && action === 'view') return true
      if (module === 'flujo_caja' && action === 'view') return true
      return false
    }

    // Default safety: allow matching and dashboard view so nobody is ever locked out
    if (module === 'matching' && action === 'view') return true
    if (module === 'dashboard' && action === 'view') return true

    const permissionKey = `${module}.${action}`
    return user.permissions?.includes(permissionKey) || false
  }

  const login = async (email, password) => {
    const res = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || 'Error de autenticación')
    }
    
    localStorage.setItem('dl_token', data.access_token)
    localStorage.setItem('dl_user', JSON.stringify(data.user))
    setToken(data.access_token)
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    localStorage.removeItem('dl_token')
    localStorage.removeItem('dl_user')
    sessionStorage.removeItem('dl_preview_role')
    setPreviewRole(null)
    setToken(null)
    setUser(null)
  }

  const refreshUser = async () => {
    if (!token) return
    try {
      const res = await fetch(`${API}/api/v1/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const freshUser = await res.json()
        const updatedUser = {
          ...user,
          role: freshUser.role,
          permissions: freshUser.permissions,
          must_change_password: freshUser.must_change_password
        }
        localStorage.setItem('dl_user', JSON.stringify(updatedUser))
        setUser(updatedUser)
      }
    } catch (e) {
      console.error("Error refreshing user details:", e)
    }
  }

  return (
    <AuthContext.Provider value={{
      user: effectiveUser,
      realUser: user,
      token,
      config,
      loading,
      hasPermission,
      login,
      logout,
      refreshUser,
      setUser,
      isOriginalAdmin,
      previewRole,
      setPreviewRole: handleSetPreviewRole
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
