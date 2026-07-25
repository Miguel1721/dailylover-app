import React, { useState, createContext, useContext, useEffect, useRef } from 'react'
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  Heart, Calendar, MapPin, Users, ArrowLeft, CheckCircle,
  Award, Coffee, MessageSquare, Compass, User, Shield,
  Send, ChevronRight, AlertTriangle, MessageCircle,
  Mic, MicOff, Sparkles, BrainCircuit, Zap, CheckCircle2, ArrowRight
} from 'lucide-react'
import { mockEvent, mockCheckin, mockPoints, mockTableMates, mockUpcomingEvents, mockProfile, mockChat } from './data/mockData'
import './index.css'

// Create global AppState context
const AppStateContext = createContext()

export function AppStateProvider({ children }) {
  const [checkedIn, setCheckedIn] = useState(() => {
    return localStorage.getItem('dl_preview_checkedin') === 'true'
  })
  const [matchEnabled, setMatchEnabled] = useState(() => {
    return localStorage.getItem('dl_preview_matchenabled') === 'true'
  })
  const [chatMessages, setChatMessages] = useState(() => {
    const saved = localStorage.getItem('dl_preview_chat')
    return saved ? JSON.parse(saved) : mockChat
  })
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)

  useEffect(() => {
    localStorage.setItem('dl_preview_checkedin', checkedIn)
  }, [checkedIn])

  useEffect(() => {
    localStorage.setItem('dl_preview_matchenabled', matchEnabled)
  }, [matchEnabled])

  useEffect(() => {
    localStorage.setItem('dl_preview_chat', JSON.stringify(chatMessages))
  }, [chatMessages])

  const resetState = () => {
    setCheckedIn(false)
    setMatchEnabled(false)
    setChatMessages(mockChat)
    setEmergencyOpen(false)
    setShowQrModal(false)
    localStorage.clear()
  }

  return (
    <AppStateContext.Provider value={{
      checkedIn, setCheckedIn,
      matchEnabled, setMatchEnabled,
      chatMessages, setChatMessages,
      emergencyOpen, setEmergencyOpen,
      showQrModal, setShowQrModal,
      resetState
    }}>
      {children}
    </AppStateContext.Provider>
  )
}

function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { checkedIn, emergencyOpen, setEmergencyOpen, showQrModal, setShowQrModal, resetState } = useContext(AppStateContext)
  const isSplash = location.pathname === '/'
  const isAuthOrRegister = location.pathname === '/' || location.pathname === '/registro' || location.pathname === '/login'
  const [safetyCallStatus, setSafetyCallStatus] = useState(null)

  const handleSafetyCall = (type) => {
    setSafetyCallStatus(`Conectando con ${type}...`)
    setTimeout(() => {
      setSafetyCallStatus(`✓ Alerta enviada a ${type}. Un miembro del staff se acerca a tu ubicación.`)
      setTimeout(() => {
        setSafetyCallStatus(null)
        setEmergencyOpen(false)
      }, 3000)
    }, 1500)
  }

  return (
    <div className="phone-container">
      {/* Top Header Bar for all screens except splash */}
      {!isSplash && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          background: 'rgba(15, 9, 10, 0.8)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--border-color)',
          zIndex: 10
        }}>
          {/* Emergency shield button */}
          <button className="emergency-btn" onClick={() => setEmergencyOpen(true)} title="Seguridad">
            <Shield size={18} fill="currentColor" />
          </button>
          
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
            DAILY LOVER
          </span>

          <div style={{ width: 24 }} />
        </div>
      )}

      {children}

      {/* Bottom Tab Navigation (visible only inside logged-in app screens) */}
      {!isAuthOrRegister && (
        <nav className="tab-bar">
          <button 
            className={`tab-item ${location.pathname === '/evento' || location.pathname === '/confirmacion' || location.pathname === '/mesa' ? 'active' : ''}`}
            onClick={() => navigate(checkedIn ? '/confirmacion' : '/evento')}
          >
            <Calendar className="tab-icon" size={20} />
            <span>Evento</span>
          </button>

          <button 
            className={`tab-item ${location.pathname === '/profiler' ? 'active' : ''}`}
            onClick={() => navigate('/profiler')}
          >
            <Mic className="tab-icon" size={20} />
            <span>Profiler IA</span>
          </button>

          <button 
            className={`tab-item ${location.pathname === '/mensajes' ? 'active' : ''}`}
            onClick={() => navigate('/mensajes')}
          >
            <MessageSquare className="tab-icon" size={20} />
            <span>Mensajes</span>
          </button>

          <button 
            className={`tab-item ${location.pathname === '/explorar' ? 'active' : ''}`}
            onClick={() => navigate('/explorar')}
          >
            <Compass className="tab-icon" size={20} />
            <span>Explorar</span>
          </button>

          <button 
            className={`tab-item ${location.pathname === '/perfil' ? 'active' : ''}`}
            onClick={() => navigate('/perfil')}
          >
            <User className="tab-icon" size={20} />
            <span>Perfil</span>
          </button>
        </nav>
      )}

      {/* Emergency safety overlay modal (Idea 7) */}
      {emergencyOpen && (
        <div className="emergency-overlay">
          <div className="emergency-modal">
            {safetyCallStatus ? (
              <div style={{ padding: '10px 0' }}>
                <div className="spinner" style={{ margin: '0 auto 20px', width: 40, height: 40, borderWidth: 4 }} />
                <p style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, lineHeight: '1.4em' }}>
                  {safetyCallStatus}
                </p>
              </div>
            ) : (
              <>
                <div style={{ color: 'var(--color-primary-light)', display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  <AlertTriangle size={48} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Asistente de Seguridad
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: '1.4em' }}>
                  ¿Necesitas asistencia o deseas reportar una situación incómoda de forma 100% discreta?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <button className="btn btn-primary" onClick={() => handleSafetyCall('Seguridad del Lugar')} style={{ background: '#C41A00' }}>
                    Llamar Seguridad del Lugar
                  </button>
                  <button className="btn btn-primary" onClick={() => handleSafetyCall('Organizadores (María Paula)')} style={{ background: 'var(--color-coral)' }}>
                    Alertar al Organizador Staff
                  </button>
                  <button className="btn btn-secondary" onClick={() => setEmergencyOpen(false)}>
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* QR Code and points popup modal (Idea 6) */}
      {showQrModal && (
        <div className="emergency-overlay" onClick={() => setShowQrModal(false)}>
          <div className="emergency-modal" style={{ background: 'var(--bg-dark-card)', border: '1px solid var(--border-color)', boxShadow: '0 10px 40px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tu Código de Consumo
              </span>
              <button 
                onClick={() => setShowQrModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{
              padding: 16,
              background: 'white',
              borderRadius: 20,
              display: 'inline-flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16
            }}>
              <QRCodeSVG value="DAILYLOVER-DEMO-USER-001" size={160} fgColor="#0F090A" bgColor="white" />
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: '1.4em', marginBottom: 20 }}>
              Muestra este código al mesero antes de pagar tu orden para acumular puntos.
            </p>

            <div style={{ fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: 12, textAlign: 'left' }}>
              <strong>Línea de acumulación:</strong> {mockPoints.rate}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Splash() {
  const navigate = useNavigate()
  const [loginMethod, setLoginMethod] = useState('email') // 'email' or 'phone'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleClientLogin = () => {
    if (loginMethod === 'email' && (!email || !password)) {
      setError('Por favor ingresa tu correo y contraseña')
      return
    }
    if (loginMethod === 'phone' && !phone) {
      setError('Por favor ingresa tu celular')
      return
    }

    setLoading(true)
    setError('')
    const body = loginMethod === 'email' ? { email, password } : { phone }

    fetch('/api/v1/auth/client-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(res => res.json())
      .then(data => {
        if (data.access_token) {
          localStorage.setItem('dl_client_token', data.access_token)
          localStorage.setItem('dl_client_user', JSON.stringify(data.client))
          // Save for biometric quick access
          localStorage.setItem('dl_biometric_enabled', 'true')
          navigate('/perfil')
        } else {
          setError(data.detail || 'Credenciales incorrectas')
        }
      })
      .catch(() => setError('Error conectando al servidor'))
      .finally(() => setLoading(false))
  }

  const handleBiometricAuth = async () => {
    setError('')
    const savedToken = localStorage.getItem('dl_client_token')
    if (savedToken) {
      setLoading(true)
      fetch('/api/v1/client/me', { headers: { Authorization: `Bearer ${savedToken}` } })
        .then(r => r.ok ? r.json() : null)
        .then(user => {
          if (user) {
            navigate('/perfil')
          } else {
            setError('Sesión biométrica expirada. Inicia sesión con clave.')
          }
        })
        .catch(() => setError('Error validando huella / FaceID'))
        .finally(() => setLoading(false))
    } else {
      setError('No hay huella o FaceID vinculada aún. Inicia sesión con tu clave primero.')
    }
  }

  return (
    <div className="screen-wrapper" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div style={{
        width: 86,
        height: 86,
        borderRadius: '50%',
        background: 'rgba(196, 26, 0, 0.1)',
        border: '2px solid var(--color-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        boxShadow: '0 0 30px var(--color-primary-glow)'
      }}>
        <Heart size={42} fill="var(--color-primary)" color="var(--color-primary)" />
      </div>
      
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #FFF, #C7B5B7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Daily Lover
      </h1>
      
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20, padding: '0 20px', lineHeight: '1.4em' }}>
        Portal exclusivo de citas y eventos de matchmaking
      </p>

      {/* Tabs for Login Method */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'var(--bg-dark-card)', padding: 4, borderRadius: 10, width: '100%', maxWidth: 300 }}>
        <button
          type="button"
          onClick={() => { setLoginMethod('email'); setError(''); }}
          style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: loginMethod === 'email' ? 'var(--color-primary)' : 'transparent', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Correo y Clave
        </button>
        <button
          type="button"
          onClick={() => { setLoginMethod('phone'); setError(''); }}
          style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: loginMethod === 'phone' ? 'var(--color-primary)' : 'transparent', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Por Celular
        </button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleClientLogin(); }} style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loginMethod === 'email' ? (
          <>
            <input
              type="email"
              placeholder="Correo Electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--bg-dark-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none'
              }}
            />
            <input
              type="password"
              placeholder="Contraseña Alfanumérica"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--bg-dark-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none'
              }}
            />
          </>
        ) : (
          <input
            type="tel"
            placeholder="Número de Celular / WhatsApp"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--bg-dark-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: 13,
              textAlign: 'center',
              outline: 'none'
            }}
          />
        )}

        {error && <div style={{ color: '#FF5A36', fontSize: 12 }}>{error}</div>}

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '12px' }}>
          {loading ? 'Iniciando sesión...' : 'Ingresar a mi Cuenta'}
        </button>

        {/* Biometric login button */}
        <button
          type="button"
          onClick={handleBiometricAuth}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: 'var(--text-primary)',
            padding: '10px',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: 'pointer'
          }}
        >
          <span>👤 Ingresar con Huella / Face ID</span>
        </button>

        <div style={{ height: 1, background: 'var(--border-color)', margin: '6px 0' }} />

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate('/registro')}
          style={{ width: '100%', border: '1px solid var(--color-coral)', color: 'var(--color-coral)', padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}
        >
          ✨ Crear Nueva Cuenta (Registrarse en Evento)
        </button>
      </form>
    </div>
  )
}

function EventDetails() {
  const navigate = useNavigate()
  const { checkedIn, setCheckedIn } = useContext(AppStateContext)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (checkedIn) {
      navigate('/confirmacion')
    }
  }, [checkedIn, navigate])

  const handleCheckin = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setCheckedIn(true)
      navigate('/confirmacion')
    }, 1800)
  }

  return (
    <div className="screen-wrapper">
      <div className="screen-header">
        <span className="screen-title">Mi Evento</span>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 20 }}>
          <div className="spinner" style={{ width: 48, height: 48, borderWidth: 4 }} />
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>Confirmando tu ingreso...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="card" style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{
              display: 'inline-flex',
              padding: '6px 12px',
              borderRadius: 20,
              background: 'rgba(76, 175, 80, 0.15)',
              color: 'var(--color-success)',
              fontSize: 12,
              fontWeight: 700,
              alignSelf: 'flex-start',
              marginBottom: 16,
              textTransform: 'uppercase'
            }}>
              ✓ {mockEvent.status}
            </div>

            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 20, lineHeight: '1.2em' }}>
              {mockEvent.name}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, color: 'var(--text-secondary)', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Calendar size={18} style={{ color: 'var(--color-coral)' }} />
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fecha y Hora</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{mockEvent.date}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <MapPin size={18} style={{ color: 'var(--color-coral)' }} />
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Lugar</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{mockEvent.venue}</div>
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 90, 54, 0.05)',
              border: '1px solid var(--border-color)',
              borderRadius: 16,
              padding: 16,
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: '1.4em',
              textAlign: 'center'
            }}>
              Presenta tu ingreso al llegar para descubrir tu mesa asignada.
            </div>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: 20 }}>
            <button className="btn btn-primary" onClick={handleCheckin}>
              Ya llegué
            </button>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, marginTop: 8 }}>
              Toca cuando estés en el lugar para activar tu ingreso.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Confirmation() {
  const navigate = useNavigate()
  const { checkedIn } = useContext(AppStateContext)

  useEffect(() => {
    if (!checkedIn) {
      navigate('/evento')
    }
  }, [checkedIn, navigate])

  return (
    <div className="screen-wrapper">
      <div className="screen-header">
        <span className="screen-title">Ingreso</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', flex: 1 }}>
        <div style={{
          width: 54,
          height: 54,
          borderRadius: '50%',
          background: 'rgba(76, 175, 80, 0.15)',
          color: 'var(--color-success)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
          animation: 'scaleIn 0.5s ease'
        }}>
          <CheckCircle size={30} />
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 800 }}>¡Ingreso Confirmado!</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
          Llegada registrada a las {mockCheckin.time}
        </p>

        <div className="card" style={{ width: '100%', padding: 20, marginTop: 16, position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'linear-gradient(to right, var(--color-primary-light), var(--color-coral))'
          }} />
          
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Tu mesa asignada es la
          </div>
          
          <div style={{
            fontSize: 56,
            fontWeight: 800,
            color: 'var(--color-coral)',
            margin: '8px 0',
            lineHeight: 1,
            textShadow: '0 0 20px var(--color-coral-glow)'
          }}>
            MESA {mockCheckin.table}
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: '1.45em', textAlign: 'left', background: 'var(--bg-dark)', padding: 12, borderRadius: 12, border: '1px solid rgba(255, 90, 54, 0.08)' }}>
            "{mockCheckin.explanation}"
          </p>

          {/* Icebreaker mission card (Idea 4) */}
          <div className="mission-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Coffee size={16} style={{ color: 'var(--color-coral)' }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-coral)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Misión Rompehielos
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: '1.4em', fontWeight: 500 }}>
              {mockCheckin.mission}
            </p>
          </div>
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto', paddingTop: 16 }}>
          <button className="btn btn-primary" onClick={() => navigate('/mesa')}>
            <Users size={16} /> Ver compatibilidad de mi mesa
          </button>
        </div>
      </div>
    </div>
  )
}

function TableMates() {
  const navigate = useNavigate()
  return (
    <div className="screen-wrapper">
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigate('/confirmacion')}><ArrowLeft size={16} /></button>
        <span className="screen-title">Mi Mesa</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Mesa {mockCheckin.table} — 5 personas</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Tus compañeros de afinidad para esta noche</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, marginBottom: 16 }}>
          {mockTableMates.map((mate, idx) => (
            <div key={idx} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, margin: 0 }}>
              <div className="avatar" style={{ width: 44, height: 44, minWidth: 44, fontSize: 15, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-primary) 100%)' }}>
                {mate.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{mate.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{mate.age} años</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: '1.3em' }}>
                  {mate.note}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          background: 'rgba(196, 26, 0, 0.05)',
          border: '1px solid var(--border-color)',
          borderRadius: 16,
          padding: 16,
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: '1.4em',
          textAlign: 'center',
          marginBottom: 12
        }}>
          "Este grupo fue armado pensando en compatibilidad de personalidad, no en apariencia."
        </div>

        <div style={{ width: '100%', marginTop: 'auto' }}>
          <button className="btn btn-primary" onClick={() => navigate('/confirmacion')}>
            Volver a la Mesa
          </button>
        </div>
      </div>
    </div>
  )
}

function Messages() {
  const { matchEnabled, setMatchEnabled, chatMessages, setChatMessages } = useContext(AppStateContext)
  const [typedMessage, setTypedMessage] = useState('')
  const chatEndRef = useRef(null)

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, matchEnabled])

  const handleSend = (e) => {
    e.preventDefault()
    if (!typedMessage.trim()) return

    const newMsg = { sender: 'Tú', text: typedMessage, time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) }
    setChatMessages(prev => [...prev, newMsg])
    setTypedMessage('')

    // Simulate response from Andrés after 1.5 seconds
    setTimeout(() => {
      const responseMsg = {
        sender: 'Andrés',
        text: '¡Dale! Me parece súper buen plan. Quedamos así entonces ☕😊',
        time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      }
      setChatMessages(prev => [...prev, responseMsg])
    }, 1500)
  }

  return (
    <div className="screen-wrapper" style={{ paddingBottom: matchEnabled ? '96px' : '90px' }}>
      <div className="screen-header">
        <span className="screen-title">Mensajes</span>
      </div>

      {!matchEnabled ? (
        // Simulated push notification modal (Idea 2)
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, padding: '0 8px' }}>
          <div className="card" style={{ 
            padding: 24, 
            textAlign: 'center', 
            border: '1.5px solid var(--color-coral)',
            background: 'linear-gradient(135deg, var(--bg-dark-card) 0%, rgba(196, 26, 0, 0.05) 100%)',
            boxShadow: '0 8px 30px var(--color-primary-glow)' 
          }}>
            <div style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: 'rgba(255, 90, 54, 0.1)',
              color: 'var(--color-coral)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <MessageCircle size={26} />
            </div>
            
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-coral)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Compatibilidad Post-Evento
            </span>

            <h3 style={{ fontSize: 18, fontWeight: 800, marginTop: 8, marginBottom: 12 }}>
              ¿Buena química con Andrés?
            </h3>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: '1.45em', marginBottom: 24 }}>
              Nuestro algoritmo notó una excelente sinergia en la Mesa 7. Andrés desea seguir la conversación, ¿quieres habilitar el chat?
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                className="btn btn-primary" 
                onClick={() => setMatchEnabled(true)}
                style={{ flex: 1, padding: '12px' }}
              >
                Sí, hablar
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => {}}
                style={{ flex: 1, padding: '12px' }}
              >
                No
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Simulated Chat Screen (Idea 3)
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255, 90, 54, 0.08)', paddingBottom: 12, marginBottom: 12 }}>
            <div className="avatar" style={{ width: 36, height: 36, fontSize: 13 }}>A</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Andrés</div>
              <div style={{ fontSize: 10, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} /> Activo ahora
              </div>
            </div>
            <button 
              onClick={() => setMatchEnabled(false)}
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}
            >
              Cerrar chat
            </button>
          </div>

          {/* Chat Timeline */}
          <div className="chat-container">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`chat-bubble ${msg.sender === 'Tú' ? 'me' : 'them'}`}>
                <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 2, opacity: 0.8 }}>
                  {msg.sender}
                </div>
                <div>{msg.text}</div>
                <div className="chat-bubble-time">{msg.time}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input form */}
          <form className="chat-input-wrapper" onSubmit={handleSend}>
            <input 
              type="text" 
              className="chat-input" 
              placeholder="Escribe un mensaje..." 
              value={typedMessage} 
              onChange={e => setTypedMessage(e.target.value)} 
            />
            <button type="submit" className="chat-send-btn">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function Explore() {
  const [interestedEvents, setInterestedEvents] = useState({})

  const toggleInterest = (eventId) => {
    setInterestedEvents(prev => ({
      ...prev,
      [eventId]: !prev[eventId]
    }))
  }

  return (
    <div className="screen-wrapper">
      <div className="screen-header">
        <span className="screen-title">Descubrir</span>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Próximos Eventos</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          Recomendaciones personalizadas basadas en tu energía social
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {mockUpcomingEvents.map((ev, idx) => (
          <div key={idx} className="card" style={{ display: 'flex', flexDirection: 'column', padding: 20, margin: 0, border: '1px solid rgba(255, 90, 54, 0.08)' }}>
            {/* Tag de afinidad */}
            <div style={{
              alignSelf: 'flex-start',
              padding: '4px 10px',
              borderRadius: 12,
              background: 'rgba(255, 90, 54, 0.1)',
              color: 'var(--color-coral)',
              fontSize: 10,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 12
            }}>
              {ev.recommendation}
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
              {ev.name}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--text-secondary)', fontSize: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                <span>{ev.date}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={13} style={{ color: 'var(--text-muted)' }} />
                <span>{ev.venue}</span>
              </div>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 10, lineHeight: '1.4em', marginBottom: 16 }}>
              {ev.reason}
            </p>

            <button 
              className={`btn ${interestedEvents[idx] ? 'btn-secondary' : 'btn-primary'}`} 
              onClick={() => toggleInterest(idx)}
              style={{ padding: '10px 16px', fontSize: 13, borderRadius: 12 }}
            >
              {interestedEvents[idx] ? '✓ ¡Te agendamos!' : 'Me interesa asistir'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function Profile() {
  const navigate = useNavigate()
  const { setShowQrModal } = useContext(AppStateContext)
  const [profileData, setProfileData] = useState(null)
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('dl_client_token')
    if (!token) {
      setLoading(false)
      return
    }

    Promise.all([
      fetch('/api/v1/client/me', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch('/api/v1/client/my-matches', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null)
    ])
      .then(([p, m]) => {
        if (p) setProfileData(p)
        if (m?.matches) setMatches(m.matches)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('dl_client_token')
    localStorage.removeItem('dl_client_user')
    navigate('/')
  }

  const p = profileData || {}
  const displayName = p.name || 'Cliente Daily Lover'
  const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  const ageStr = p.age ? `${p.age} años` : 'Edad no especificada'
  const cityStr = p.city || 'Bogotá'
  const matchesCount = matches.length
  const pct = 82

  return (
    <div className="screen-wrapper">
      <div className="screen-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="screen-title">Mi Cuenta</span>
        <button onClick={handleLogout} style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: 11, padding: '4px 10px', borderRadius: 8, cursor: 'pointer' }}>
          Cerrar Sesión
        </button>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
        </div>
      ) : (
        <>
          {/* Profile summary card */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20 }}>
            {p.photo_url ? (
              <img src={p.photo_url} alt={displayName} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }} />
            ) : (
              <div className="avatar" style={{ width: 56, height: 56, fontSize: 18 }}>{initials}</div>
            )}
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{displayName}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ageStr}</span>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-muted)' }} />
                <span style={{ fontSize: 12, color: 'var(--color-coral)', fontWeight: 600 }}>📍 {cityStr}</span>
              </div>
            </div>
          </div>

          {/* Stats indicators */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="card" style={{ padding: 16, textAlign: 'center', margin: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-coral)' }}>
                {matchesCount}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Citas / Matches</div>
            </div>
            
            <div className="card" style={{ padding: 16, textAlign: 'center', margin: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#4CAF50' }}>
                {p.responsable ? 'Activo' : 'Registrado'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Membresía VIP</div>
            </div>
          </div>

          {/* QR Code section */}
          <div className="card" style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Nivel acumulado</div>
            <span className="level-badge" style={{ marginTop: 2, marginBottom: 12 }}>Conector Daily Lover</span>

            {/* Progress bar level */}
            <div className="progress-bar-level">
              <div className="progress-bar-level-fill" style={{ width: `${pct}%` }} />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 6, marginBottom: 16 }}>
              <span>Progreso a Nivel Embajador</span>
              <span>{pct}%</span>
            </div>

            <button 
              className="btn btn-primary" 
              onClick={() => setShowQrModal(true)}
              style={{ padding: '12px 16px', fontSize: 13, borderRadius: 12, width: '100%' }}
            >
              Presentar Código QR
            </button>
          </div>

          {/* Real Matches List */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 12 }}>
              Mis Citas y Matches ({matchesCount})
            </h3>

            {matches.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                Aún no tienes citas registradas. Tu psicóloga te notificará cuando haya un nuevo match.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {matches.map((m, idx) => (
                  <div key={idx} style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>💘 {m.partner_name}</div>
                      <span className="level-badge" style={{ fontSize: 10 }}>{m.status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      📅 {m.date} | 📍 {m.venue}
                    </div>
                    {m.notes && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', padding: 6, borderRadius: 6 }}>
                        💬 "{m.notes}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── VoiceProfiler Component (Conversational Voice AI Onboarding) ───────────
function VoiceProfiler() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [currentAnalysis, setCurrentAnalysis] = useState(null)
  const timerRef = useRef(null)

  const QUESTIONS = [
    {
      aiText: "¡Hola! Soy Camila, tu Profiler & Matchmaker de IA. Para diseñar tu experiencia ideal de citas, cuéntame en una nota de voz: ¿cómo sería tu domingo perfecto y qué cosas de un ambiente te hacen sentir realmente cómodo?",
      samplePresets: [
        {
          label: "Muestra 1: Tranquilo & Naturaleza",
          text: "Amo madrugar el domingo, salir a trotar o montar bici en la montaña. Prefiero las cenas tranquilas con vino antes que discotecas ruidosas. Valoro la conversación lenta.",
          analytics: {
            ocean: { apertura: 92, extroversion: 42, amabilidad: 88, estabilidad: 85 },
            apego: "Seguro (94% Confianza)",
            valores: ["Naturaleza", "Tranquilidad", "Conversación Profunda", "Salud"],
            subtexto: "Alta inteligencia emocional, baja necesidad de estimulación masiva, busca parejas autónomas y estables.",
            dealbreaker: "Rechazo estricto a ambientes ruidosos y superficialidad."
          }
        },
        {
          label: "Muestra 2: Emprendedor & Cultura",
          text: "Soy emprendedor en tecnología. En mi tiempo libre disfruto el arte contemporáneo, viajes culturales y cine independiente. Busco a alguien apasionada por sus propios proyectos.",
          analytics: {
            ocean: { apertura: 96, extroversion: 74, amabilidad: 78, estabilidad: 90 },
            apego: "Seguro / Ambicioso",
            valores: ["Ambición", "Cultura", "Independencia", "Crecimiento continuo"],
            subtexto: "Percepción de estatus socio-cultural alto, lenguaje enfocado en metas, alta tolerancia al riesgo.",
            dealbreaker: "Falta de metas personales o baja curiosidad intelectual."
          }
        }
      ]
    },
    {
      aiText: "¡Excelente! Mencionaste que valoras los ambientes tranquilos y la naturaleza. Cuando estás compartiendo una cena en una primera cita, ¿qué tema de conversación te hace sentir química instantánea?",
      samplePresets: [
        {
          label: "Muestra 1: Proyectos & Sueños",
          text: "Me encanta hablar de proyectos futuros, viajes culturales, cine independiente y sueños de vida sin estar viendo el reloj.",
          analytics: {
            ocean: { apertura: 95, extroversion: 58, amabilidad: 90, estabilidad: 88 },
            apego: "Seguro (96% Confianza)",
            valores: ["Proyectos", "Viajes", "Cine", "Conexión Lenta"],
            subtexto: "Alta receptividad a conversaciones existenciales. Química basada en valores compartidos.",
            dealbreaker: "Uso excesivo del teléfono móvil durante la cita."
          }
        }
      ]
    },
    {
      aiText: "Me queda súper claro. He detectado un perfil reflexivo con alta apertura intelectual. Una última pregunta: ¿cuál es ese valor o cualidad no negociable que necesitas ver en una pareja?",
      samplePresets: [
        {
          label: "Muestra 1: Lealtad & Empatía",
          text: "Para mí la lealtad, la estabilidad emocional, el sentido del humor inteligente y la capacidad de escuchar sin juzgar son indispensables.",
          analytics: {
            ocean: { apertura: 90, extroversion: 50, amabilidad: 96, estabilidad: 92 },
            apego: "Seguro / Cálido",
            valores: ["Lealtad", "Empatía", "Humor Inteligente", "Escucha Activa"],
            subtexto: "Perfil altamente empático. Requiere parejas con madurez emocional comprobada.",
            dealbreaker: "Falta de empatía o comunicación agresiva."
          }
        }
      ]
    }
  ]

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1)
      }, 1000)
    } else {
      clearInterval(timerRef.current)
      setRecordingTime(0)
    }
    return () => clearInterval(timerRef.current)
  }, [isRecording])

  const processAudioData = (preset) => {
    setIsRecording(false)
    setIsAnalyzing(true)

    setTimeout(() => {
      setIsAnalyzing(false)
      setCurrentAnalysis(preset.analytics)
    }, 1500)
  }

  const handleToggleRecord = () => {
    if (isRecording) {
      const currentQuestion = QUESTIONS[step]
      processAudioData(currentQuestion.samplePresets[0])
    } else {
      setIsRecording(true)
    }
  }

  const currentQ = QUESTIONS[step]

  return (
    <div className="screen-wrapper">
      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ padding: 8, borderRadius: '50%' }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>Profiler IA Conversacional</h2>
            <span style={{ fontSize: 9, background: 'rgba(255, 90, 54, 0.2)', color: 'var(--color-coral)', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
              FASE 2 PREVIEW
            </span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Entrevista adaptativa por voz • Análisis estratégico en tiempo real
          </p>
        </div>
      </div>

      {/* AI Profiler Persona Card */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(28, 17, 19, 0.95) 0%, rgba(55, 18, 24, 0.95) 100%)',
        border: '1px solid var(--color-coral-glow)',
        padding: 16,
        marginBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-coral))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px var(--color-primary-glow)'
          }}>
            <Sparkles size={22} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
              Camila — AI Profiler & Matchmaker
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-coral)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <BrainCircuit size={12} />
              <span>Extracción Multimodal de Subtexto & Valores</span>
            </div>
          </div>
        </div>

        {/* Question Bubble */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          borderLeft: '3px solid var(--color-coral)',
          padding: '12px 14px',
          borderRadius: '0 12px 12px 0',
          fontSize: 13,
          lineHeight: '1.5em',
          color: 'var(--text-primary)'
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pregunta Adaptativa {step + 1} de {QUESTIONS.length}
          </span>
          {currentQ.aiText}
        </div>
      </div>

      {/* Analyzing Pulse Overlay */}
      {isAnalyzing && (
        <div className="card" style={{ padding: 24, textAlign: 'center', marginBottom: 16, background: 'rgba(255,90,54,0.06)', border: '1px solid var(--color-coral)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', width: 36, height: 36, borderWidth: 3 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-coral)', marginBottom: 4 }}>
            🧠 Procesando Frecuencias de Voz & Patrones Léxicos...
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Extrayendo OCEAN, Estilo de Apego y Filtros No-Negociables
          </p>
        </div>
      )}

      {/* Voice Note Recording Controls */}
      {!isAnalyzing && (
        <div className="card" style={{ padding: 20, textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            {isRecording ? `🔴 GRABANDO NOTA DE VOZ (00:${recordingTime < 10 ? '0' + recordingTime : recordingTime})` : 'Presiona para Grabar Nota de Voz'}
          </div>

          {/* Glowing Mic Button */}
          <button
            onClick={handleToggleRecord}
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: isRecording ? '#dc2626' : 'linear-gradient(135deg, var(--color-primary), var(--color-coral))',
              border: 'none',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              cursor: 'pointer',
              boxShadow: isRecording ? '0 0 30px rgba(220, 38, 38, 0.6)' : '0 0 25px var(--color-primary-glow)',
              transition: 'all 0.3s ease',
              transform: isRecording ? 'scale(1.1)' : 'scale(1)'
            }}
          >
            {isRecording ? <MicOff size={32} /> : <Mic size={32} />}
          </button>

          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
            {isRecording ? "Habla libremente. Presiona de nuevo al terminar." : "O prueba una nota de voz demostrativa en 1 clic:"}
          </p>

          {/* Sample Preset Audio Buttons for 1-click testing */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {currentQ.samplePresets.map((preset, idx) => (
              <button
                key={idx}
                className="btn btn-ghost"
                onClick={() => processAudioData(preset)}
                style={{
                  fontSize: 12,
                  padding: '10px 14px',
                  borderRadius: 10,
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.03)'
                }}
              >
                <span>{preset.label}</span>
                <Zap size={14} color="var(--color-coral)" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Extracted Strategic Analytics Card (WOW Factor!) */}
      {currentAnalysis && (
        <div className="card" style={{
          padding: 20,
          background: 'rgba(28, 17, 19, 0.95)',
          border: '1px solid rgba(76, 175, 80, 0.4)',
          marginBottom: 16,
          boxShadow: '0 8px 30px rgba(76, 175, 80, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={18} color="#4CAF50" />
              <span style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>
                Análisis Estratégico Extraído
              </span>
            </div>
            <span style={{ fontSize: 10, background: 'rgba(76, 175, 80, 0.15)', color: '#4CAF50', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
              IA VERIFICADA
            </span>
          </div>

          {/* OCEAN Radar Bars */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
              Perfil OCEAN (Big Five) Extraído de la Voz
            </div>
            {[
              { label: 'Apertura Intelectual', val: currentAnalysis.ocean.apertura, color: '#FF5A36' },
              { label: 'Extroversión Social', val: currentAnalysis.ocean.extroversion, color: '#3B82F6' },
              { label: 'Amabilidad & Empatía', val: currentAnalysis.ocean.amabilidad, color: '#4CAF50' },
              { label: 'Estabilidad Emocional', val: currentAnalysis.ocean.estabilidad, color: '#8B5CF6' }
            ].map(item => (
              <div key={item.label} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                  <span style={{ color: 'white', fontWeight: 700 }}>{item.val}%</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${item.val}%`, height: '100%', background: item.color, borderRadius: 3, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Attachment Style */}
          <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Estilo de Apego Detectado:</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#4CAF50' }}>{currentAnalysis.apego}</span>
          </div>

          {/* Extracted Core Values */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Valores Clave Identificados:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {currentAnalysis.valores.map(v => (
                <span key={v} style={{ fontSize: 11, background: 'rgba(255, 90, 54, 0.15)', color: 'var(--color-coral)', padding: '3px 10px', borderRadius: 12, fontWeight: 600 }}>
                  ✦ {v}
                </span>
              ))}
            </div>
          </div>

          {/* Subtext Analysis */}
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: '1.4em', background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, marginBottom: 12 }}>
            <strong>Subtexto Detectado:</strong> {currentAnalysis.subtexto}
          </div>

          {/* Dealbreaker */}
          <div style={{ fontSize: 11, color: '#FF5A36', background: 'rgba(255, 90, 54, 0.1)', padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⛔ <strong>Filtro No-Negociable:</strong> {currentAnalysis.dealbreaker}</span>
          </div>

          {/* Dynamic Next Question Button */}
          {step < QUESTIONS.length - 1 && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setStep(s => s + 1)
                setCurrentAnalysis(null)
              }}
              style={{ width: '100%', marginTop: 16, padding: '12px', fontSize: 13, borderRadius: 12, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
            >
              <span>Continuar Entrevista Adaptativa</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Register() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [showLegalModal, setShowLegalModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    city: 'Bogotá',
    age: '',
    gender: 'Hombre',
    orientation: 'Heterosexual',
    estatura: '',
    occupation: '',
    motivacion: 'conexion_profunda',
    rumba: 'fines_de_semana',
    hijos: 'desea_hijos',
    bio: '',
    accepted_terms: true
  })

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name || !formData.phone || !formData.email || !formData.password) {
      setError('Nombre, celular, correo y contraseña son obligatorios')
      return
    }
    if (!formData.accepted_terms) {
      setError('Debes autorizar el Tratamiento de Datos Personales (Ley 1581 de 2012 / Habeas Data) para crear tu perfil.')
      return
    }

    setLoading(true)
    setError('')

    const payload = {
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      password: formData.password,
      city: formData.city,
      age: formData.age ? parseInt(formData.age) : null,
      gender: formData.gender,
      orientation: formData.orientation,
      estatura: formData.estatura,
      occupation: formData.occupation,
      motivacion: formData.motivacion,
      accepted_terms: formData.accepted_terms,
      lifestyle: { rumba: formData.rumba, hijos: formData.hijos, bio: formData.bio },
      search_preferences: {}
    }

    fetch('/api/v1/auth/client-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (data.access_token) {
          localStorage.setItem('dl_client_token', data.access_token)
          localStorage.setItem('dl_client_user', JSON.stringify(data.client))
          navigate('/perfil')
        } else {
          setError(data.detail || 'Error registrando perfil')
        }
      })
      .catch(() => setError('Error de conexión con el servidor'))
      .finally(() => setLoading(false))
  }

  return (
    <div className="screen-wrapper">
      <div className="screen-header" style={{ justifyContent: 'center' }}>
        <span className="screen-title" style={{ fontSize: 18, fontWeight: 800 }}>REGISTRO EN EVENTO</span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Progress indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: step >= i ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)' }} />
          ))}
        </div>

        {error && <div style={{ color: '#FF5A36', fontSize: 13, marginBottom: 12, textAlign: 'center', fontWeight: 600 }}>{error}</div>}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>Paso 1: Accesos & Datos Personales</h2>
            
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nombre Completo *</label>
              <input
                type="text"
                placeholder="Ej: Laura Sofía Mendoza"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-dark-card)', border: '1px solid var(--border-color)', color: 'white', fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Correo Electrónico (Tu usuario de ingreso) *</label>
              <input
                type="email"
                placeholder="ejemplo@gmail.com"
                value={formData.email}
                onChange={e => handleChange('email', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-dark-card)', border: '1px solid var(--border-color)', color: 'white', fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Contraseña Alfanumérica (Ej: Daily2026!) *</label>
              <input
                type="password"
                placeholder="Crea tu contraseña de acceso"
                value={formData.password}
                onChange={e => handleChange('password', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-dark-card)', border: '1px solid var(--border-color)', color: 'white', fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>WhatsApp / Celular *</label>
              <input
                type="tel"
                placeholder="Ej: 3101234567"
                value={formData.phone}
                onChange={e => handleChange('phone', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-dark-card)', border: '1px solid var(--border-color)', color: 'white', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Ciudad</label>
                <select
                  value={formData.city}
                  onChange={e => handleChange('city', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-dark-card)', border: '1px solid var(--border-color)', color: 'white', fontSize: 13 }}
                >
                  <option value="Bogotá">Bogotá</option>
                  <option value="Medellín">Medellín</option>
                  <option value="Cali">Cali</option>
                  <option value="Barranquilla">Barranquilla</option>
                  <option value="Otra">Otra</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Edad</label>
                <input
                  type="number"
                  placeholder="Ej: 28"
                  value={formData.age}
                  onChange={e => handleChange('age', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-dark-card)', border: '1px solid var(--border-color)', color: 'white', fontSize: 13 }}
                />
              </div>
            </div>

            <button className="btn btn-primary" onClick={() => {
              if (!formData.name || !formData.phone || !formData.email || !formData.password) {
                setError('Por favor completa nombre, correo, clave y celular');
              } else {
                setError('');
                setStep(2);
              }
            }} style={{ marginTop: 6, padding: '12px', width: '100%' }}>
              Siguiente: Preferencias ➔
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>Paso 2: Perfil y Matchmaking</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Género</label>
                <select
                  value={formData.gender}
                  onChange={e => handleChange('gender', e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'var(--bg-dark-card)', border: '1px solid var(--border-color)', color: 'white' }}
                >
                  <option value="Mujer">Mujer</option>
                  <option value="Hombre">Hombre</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Orientación</label>
                <select
                  value={formData.orientation}
                  onChange={e => handleChange('orientation', e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'var(--bg-dark-card)', border: '1px solid var(--border-color)', color: 'white' }}
                >
                  <option value="Heterosexual">Heterosexual</option>
                  <option value="Homosexual">Homosexual</option>
                  <option value="Bisexual">Bisexual</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Estatura (m)</label>
              <input
                type="text"
                placeholder="Ej: 1.72m"
                value={formData.estatura}
                onChange={e => handleChange('estatura', e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'var(--bg-dark-card)', border: '1px solid var(--border-color)', color: 'white' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Profesión / Ocupación</label>
              <input
                type="text"
                placeholder="Ej: Ingeniera, Arquitecto, Empresario"
                value={formData.occupation}
                onChange={e => handleChange('occupation', e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'var(--bg-dark-card)', border: '1px solid var(--border-color)', color: 'white' }}
              />
            </div>

            <button className="btn btn-primary" onClick={() => setStep(3)} style={{ marginTop: 10, padding: '12px', width: '100%' }}>
              Siguiente: Estilo de Vida ➔
            </button>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>Paso 3: Estilo de Vida</h2>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>¿Qué buscas en Daily Lover?</label>
              <select
                value={formData.motivacion}
                onChange={e => handleChange('motivacion', e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'var(--bg-dark-card)', border: '1px solid var(--border-color)', color: 'white' }}
              >
                <option value="conexion_profunda">Conexión profunda / Pareja estable</option>
                <option value="exploracion">Exploración / Salir a citas</option>
                <option value="matrimonio">Relación formal / Matrimonio</option>
                <option value="diversion">Conocer gente divertida</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>¿Visión sobre hijos?</label>
              <select
                value={formData.hijos}
                onChange={e => handleChange('hijos', e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'var(--bg-dark-card)', border: '1px solid var(--border-color)', color: 'white' }}
              >
                <option value="desea_hijos">Quiero tener hijos</option>
                <option value="no_desea_hijos">No quiero tener hijos</option>
                <option value="ya_tiene_hijos">Ya tengo hijos</option>
                <option value="abierto">Abierto(a) a la posibilidad</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Breve Biografía / Pasatiempos</label>
              <textarea
                rows={2}
                placeholder="Cuéntanos un poco sobre tus gustos o hobbies favoritos..."
                value={formData.bio}
                onChange={e => handleChange('bio', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-dark-card)', border: '1px solid var(--border-color)', color: 'white', fontFamily: 'inherit', fontSize: 13 }}
              />
            </div>

            {/* HABEAS DATA & LEGAL CONSENT CHECKBOX CARD */}
            <div style={{
              background: formData.accepted_terms ? 'rgba(76, 175, 80, 0.14)' : 'rgba(255, 90, 54, 0.14)',
              padding: 14,
              borderRadius: 12,
              border: formData.accepted_terms ? '1px solid rgba(76, 175, 80, 0.4)' : '1px solid rgba(255, 90, 54, 0.4)',
              marginTop: 4
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.accepted_terms}
                  onChange={e => handleChange('accepted_terms', e.target.checked)}
                  style={{ accentColor: '#4CAF50', width: 22, height: 22, cursor: 'pointer', flexShrink: 0 }}
                />
                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: '1.4em' }}>
                  <strong style={{ color: formData.accepted_terms ? '#4CAF50' : '#FF5A36', display: 'block', marginBottom: 2 }}>
                    {formData.accepted_terms ? '✓ Autorización Seleccionada' : '⚠️ Haz clic para autorizar'}
                  </strong>
                  <span>
                    Acepto el <strong>Tratamiento de Datos Personales</strong> (Ley 1581 / Habeas Data) y los <span style={{ color: 'var(--color-coral)', textDecoration: 'underline', fontWeight: 700 }} onClick={e => { e.preventDefault(); e.stopPropagation(); setShowLegalModal(true); }}>Términos del Servicio</span>.
                  </span>
                </div>
              </label>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading || !formData.accepted_terms}
              style={{ marginTop: 10, padding: '14px', width: '100%', fontSize: 15, fontWeight: 700, opacity: formData.accepted_terms ? 1 : 0.6 }}
            >
              {loading ? 'Creando Perfil...' : '✨ Finalizar Registro'}
            </button>
          </div>
        )}

        {/* LEGAL HABEAS DATA MODAL */}
        {showLegalModal && (
          <div className="modal-overlay" onClick={() => setShowLegalModal(false)} style={{ zIndex: 3000, background: 'rgba(0,0,0,0.85)' }}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 450, maxHeight: '80vh', overflowY: 'auto', background: '#181113', padding: 24, borderRadius: 16, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'white' }}>📜 Política de Tratamiento de Datos Personales</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowLegalModal(false)}>✕</button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: '1.6em' }}>
                <p><strong>RESPONSABLE DEL TRATAMIENTO:</strong> Daily Lover S.A.S. en cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013 de la República de Colombia.</p>
                <br/>
                <p><strong>FINALIDAD DEL TRATAMIENTO:</strong> Sus datos personales, gustos, orientación y respuestas a cuestionarios serán utilizados exclusivamente para:</p>
                <ul style={{ paddingLeft: 16, marginTop: 6, marginBottom: 10 }}>
                  <li>Calcular compatibilidad algorítmica de matchmaking con IA.</li>
                  <li>Coordinar la logística de citas y asistencia a eventos.</li>
                  <li>Evaluaciones clínicas confidenciales por parte de las psicólogas del equipo.</li>
                </ul>
                <p><strong>DERECHOS DEL TITULAR (ARCO):</strong> Como titular de la información, usted tiene derecho a conocer, actualizar, rectificar y solicitar la supresión de sus datos personales en cualquier momento escribiendo a <code>privacidad@dailylover.com</code>.</p>
                <br/>
                <p><strong>CONFIDENCIALIDAD:</strong> Sus datos de contacto o comentarios internos nunca serán vendidos ni compartidos con terceros sin su consentimiento explícito previo.</p>
              </div>
              <button className="btn btn-primary" onClick={() => { handleChange('accepted_terms', true); setShowLegalModal(false); }} style={{ width: '100%', marginTop: 18 }}>
                Entendido y Aceptar Términos
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppStateProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Splash />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/evento" element={<EventDetails />} />
            <Route path="/confirmacion" element={<Confirmation />} />
            <Route path="/mesa" element={<TableMates />} />
            <Route path="/profiler" element={<VoiceProfiler />} />
            <Route path="/mensajes" element={<Messages />} />
            <Route path="/explorar" element={<Explore />} />
            <Route path="/perfil" element={<Profile />} />
          </Routes>
        </Layout>
      </HashRouter>
    </AppStateProvider>
  )
}
