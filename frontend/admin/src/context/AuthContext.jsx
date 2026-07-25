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

  useEffect(() => {
    // Fetch configuration settings on load
    fetch(`${API}/api/v1/config`)
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error("Error loading config:", err))
      .finally(() => setLoading(false))
  }, [])

  const hasPermission = (module, action) => {
    if (!user) return false
    // If the role name is 'Admin', they automatically have full access
    if (user.role === 'Admin') return true
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
    <AuthContext.Provider value={{ user, token, config, loading, hasPermission, login, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
