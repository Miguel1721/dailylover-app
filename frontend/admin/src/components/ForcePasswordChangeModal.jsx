import React, { useState } from 'react'
import { KeyRound, ShieldAlert, CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

export default function ForcePasswordChangeModal() {
  const { user, token, setUser } = useAuth()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  if (!user || !user.must_change_password) {
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden. Por favor verifícalas.')
      return
    }

    if (newPassword === oldPassword) {
      setError('La nueva contraseña no puede ser igual a la contraseña temporal.')
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
        throw new Error(data.detail || 'No se pudo actualizar la contraseña. Revisa la contraseña temporal.')
      }

      setSuccess(true)

      // Actualizar estado local
      const updatedUser = {
        ...user,
        must_change_password: false
      }
      localStorage.setItem('dl_user', JSON.stringify(updatedUser))
      
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
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(10, 5, 6, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: 16
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: 440,
        backgroundColor: '#160D0F',
        border: '1px solid rgba(150, 21, 0, 0.4)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(150,21,0,0.2)',
        borderRadius: 16,
        padding: '36px 28px',
        animation: 'fadeIn 0.3s ease-out'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            backgroundColor: 'rgba(150, 21, 0, 0.15)',
            color: '#c41a00',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            border: '1px solid rgba(150, 21, 0, 0.3)'
          }}>
            <KeyRound size={28} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#F5F0F1', marginBottom: 8 }}>
            Cambio Obligatorio de Contraseña
          </h2>
          <p style={{ color: '#9A8A8D', fontSize: 13, lineHeight: 1.5 }}>
            Hola <strong style={{ color: '#F5F0F1' }}>{user.name || user.email}</strong>. Por seguridad de la plataforma y de los clientes, debes actualizar tu contraseña temporal antes de comenzar a trabajar.
          </p>
        </div>

        {success ? (
          <div style={{
            padding: 20,
            borderRadius: 10,
            backgroundColor: 'rgba(46, 125, 50, 0.15)',
            border: '1px solid rgba(46, 125, 50, 0.4)',
            color: '#81c784',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12
          }}>
            <CheckCircle2 size={32} color="#66bb6a" />
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>¡Contraseña actualizada exitosamente!</div>
              <div style={{ fontSize: 13, color: '#a5d6a7', marginTop: 4 }}>Ingresando al panel de Daily Lover...</div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label style={{ color: '#9A8A8D', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Contraseña Temporal Actual
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showOld ? "text" : "password"}
                  required
                  placeholder="La clave que te fue asignada"
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 14px',
                    backgroundColor: '#0D0A0B',
                    border: '1px solid rgba(150, 21, 0, 0.25)',
                    borderRadius: 8,
                    color: '#F5F0F1',
                    fontSize: 14
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowOld(!showOld)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#9A8A8D',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label style={{ color: '#9A8A8D', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Nueva Contraseña Personal (Mínimo 6 caracteres)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? "text" : "password"}
                  required
                  placeholder="Tu nueva clave privada"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 14px',
                    backgroundColor: '#0D0A0B',
                    border: '1px solid rgba(150, 21, 0, 0.25)',
                    borderRadius: 8,
                    color: '#F5F0F1',
                    fontSize: 14
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#9A8A8D',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label style={{ color: '#9A8A8D', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Confirmar Nueva Contraseña
              </label>
              <input
                type="password"
                required
                placeholder="Repite tu nueva clave"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#0D0A0B',
                  border: '1px solid rgba(150, 21, 0, 0.25)',
                  borderRadius: 8,
                  color: '#F5F0F1',
                  fontSize: 14
                }}
              />
            </div>

            {error && (
              <div style={{
                backgroundColor: 'rgba(150, 21, 0, 0.15)',
                border: '1px solid rgba(150, 21, 0, 0.3)',
                color: '#ff6b6b',
                fontSize: 12.5,
                padding: '10px 12px',
                borderRadius: 8,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                fontWeight: 600,
                fontSize: 14,
                backgroundColor: '#961500',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <Lock size={16} />
              {loading ? 'Guardando contraseña...' : 'Actualizar y Entrar al Sistema'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
