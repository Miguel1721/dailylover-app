import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ShieldAlert, Lock, KeyRound } from 'lucide-react'

const API = 'https://prueba-daily.agentesia.cloud'

function MustChangePasswordScreen() {
  const { token, user, setUser, logout } = useAuth()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    
    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword
        })
      })
      
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Error al cambiar contraseña')
      }
      
      setSuccess(true)
      // Update local storage user state
      const updatedUser = { ...user, must_change_password: false }
      localStorage.setItem('dl_user', JSON.stringify(updatedUser))
      
      // Delay slightly so the user sees the success checkmark
      setTimeout(() => {
        setUser(updatedUser)
      }, 1500)
      
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      padding: 24
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 440, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--color-primary-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: 'var(--color-primary)'
          }}>
            <KeyRound size={24} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Cambiar Contraseña Temporal</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Debes actualizar tu contraseña antes de ingresar al panel administrativo.
          </p>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', color: '#4CAF50', padding: '16px 0' }}>
            <span style={{ fontSize: 18, fontWeight: 600 }}>✓ ¡Contraseña Actualizada!</span>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 8 }}>
              Cargando panel de administración...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Contraseña Actual</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                placeholder="Ingresa la contraseña temporal recibida"
              />
            </div>
            <div className="form-group">
              <label>Nueva Contraseña</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="form-group">
              <label>Confirmar Nueva Contraseña</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repite la nueva contraseña"
              />
            </div>

            {error && <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</div>}

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginBottom: 12 }}>
              {loading ? 'Guardando...' : 'Cambiar Contraseña'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={logout} style={{ width: '100%' }}>
              Cerrar Sesión
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export function ProtectedRoute({ children, module, action }) {
  const { token, user, hasPermission } = useAuth()

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (user?.must_change_password) {
    return <MustChangePasswordScreen />
  }

  if (module && action && !hasPermission(module, action)) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        textAlign: 'center',
        padding: 32
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'rgba(150, 21, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          color: 'var(--color-primary)'
        }}>
          <ShieldAlert size={32} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Acceso Restringido</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 460, fontSize: 14, marginBottom: 24 }}>
          No tienes los permisos requeridos para ver este módulo ({module}.{action}). 
          Si consideras que deberías tener acceso, solicita al administrador del sistema que reasigne tu rol.
        </p>
      </div>
    )
  }

  return children
}
