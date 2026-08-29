import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext()

const API = 'https://prueba-daily.agentesia.cloud'

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
      .finally(() => setLoading(false))
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
    user && (
      user.role === 'Admin' ||
      user.role === 'Super Admin' ||
      (user.role && user.role.toLowerCase().includes('admin')) ||
      (user.email && (
        user.email.toLowerCase().includes('admin') ||
        user.email.toLowerCase().includes('maria') ||
        user.email.toLowerCase().includes('miguel')
      ))
    )
  )

  const effectiveRole = previewRole || user?.role || ''

  const effectiveUser = user ? {
    ...user,
    role: effectiveRole,
    name: previewRole ? `${user.name} [Ver como: ${previewRole}]` : user.name,
    isPreview: Boolean(previewRole)
  } : null

  const hasPermission = (module, action) => {
    if (!user) return false

    // Si está activo el modo "Ver como" (Role preview)
    if (previewRole) {
      if (previewRole === 'María') {
        return true // Acceso completo de supervisión
      }
      if (previewRole === 'Psicóloga') {
        if (['roles', 'usuarios', 'empleados', 'nomina', 'comisiones', 'ingresos', 'gastos', 'flujo_caja', 'proveedores'].includes(module)) {
          return false
        }
        if (module === 'dashboard' && action === 'view') return true
        if (module === 'clientes' && action === 'view') return true
        if (module === 'matching' && action === 'view') return true
        if (module === 'importar' && action === 'view') return true
        return false
      }
      if (previewRole === 'Servicio al Cliente') {
        if (['roles', 'usuarios', 'empleados', 'nomina', 'comisiones', 'ingresos', 'gastos', 'flujo_caja', 'proveedores', 'importar', 'eventos'].includes(module)) {
          return false
        }
        if (module === 'dashboard' && action === 'view') return true
        if (module === 'clientes' && action === 'view') return true
        if (module === 'matching' && action === 'view') return true
        return false
      }
      if (previewRole === 'Lina (Refunds)') {
        if (['roles', 'usuarios', 'empleados', 'nomina', 'comisiones', 'proveedores', 'importar', 'eventos', 'dashboard'].includes(module)) {
          return false
        }
        if (module === 'clientes' && action === 'view') return true
        if (module === 'matching' && action === 'view') return true
        if (['ingresos', 'gastos', 'flujo_caja'].includes(module) && action === 'view') return true
        return false
      }
    }

    // Modo normal sin preview: If Admin or Super Admin, full access
    if (user.role === 'Admin' || user.role === 'Super Admin' || (user.role && user.role.toLowerCase().includes('admin'))) return true
    // Matching and Dashboard view allowed for psychologists/team members
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
