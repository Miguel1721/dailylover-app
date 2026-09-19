import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Heart } from 'lucide-react'

export default function Login() {
  const { login, token } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showForgotModal, setShowForgotModal] = useState(false)
  const navigate = useNavigate()

  // Redirect if already authenticated
  if (token) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión. Verifica tus credenciales.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-base)',
      padding: 16
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: '40px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--color-primary)',
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            marginBottom: 8
          }}>
            <Heart size={24} fill="currentColor" />
            <span>Daily Lover</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Ingresa tus credenciales de acceso administrativo
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label style={{ color: 'var(--text-secondary)' }}>Correo Electrónico</label>
            <input
              type="email"
              required
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <label style={{ color: 'var(--text-secondary)' }}>Contraseña</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(150,21,0,0.1)',
              border: '1px solid rgba(150,21,0,0.2)',
              color: '#ff6b6b',
              fontSize: 13,
              padding: '10px 14px',
              borderRadius: 8,
              marginBottom: 16,
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px' }}
            disabled={loading}
          >
            {loading ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary, #9A8A8D)',
                fontSize: 13,
                cursor: 'pointer',
                textDecoration: 'underline',
                transition: 'color 0.2s'
              }}
              onMouseOver={e => e.target.style.color = '#c41a00'}
              onMouseOut={e => e.target.style.color = 'var(--text-secondary, #9A8A8D)'}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </form>

        {showForgotModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(10, 5, 6, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: 16
          }}>
            <div className="card" style={{
              width: '100%',
              maxWidth: 420,
              backgroundColor: '#160D0F',
              border: '1px solid rgba(150, 21, 0, 0.4)',
              borderRadius: 14,
              padding: '28px 24px',
              position: 'relative',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#F5F0F1', margin: 0 }}>
                  Recuperación de Contraseña
                </h3>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#9A8A8D',
                    cursor: 'pointer',
                    fontSize: 18,
                    lineHeight: 1
                  }}
                >
                  ✕
                </button>
              </div>

              <p style={{ color: '#9A8A8D', fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
                Por políticas de seguridad y protección de datos de los clientes, las cuentas de acceso del equipo son gestionadas de forma centralizada por la administración de Daily Lover.
              </p>

              <div style={{
                backgroundColor: 'rgba(150, 21, 0, 0.1)',
                border: '1px solid rgba(150, 21, 0, 0.25)',
                borderRadius: 10,
                padding: 14,
                marginBottom: 20
              }}>
                <div style={{ fontSize: 12, color: '#9A8A8D', marginBottom: 4 }}>Para solicitar tu restablecimiento o clave temporal:</div>
                <div style={{ color: '#F5F0F1', fontSize: 13.5, fontWeight: 600 }}>
                  Comunícate con el Administrador del Sistema
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <a
                  href="mailto:admin@dailylover.co?subject=Solicitud%20de%20Restablecimiento%20de%20Contrase%C3%B1a%20Daily%20Lover"
                  className="btn btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    textDecoration: 'none',
                    padding: '10px 14px',
                    fontSize: 13.5
                  }}
                >
                  ✉️ Enviar correo a admin@dailylover.co
                </a>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="btn btn-ghost"
                  style={{ width: '100%', padding: '10px', fontSize: 13.5 }}
                >
                  Volver al inicio de sesión
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
