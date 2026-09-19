import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Clock, Play, Pause, Square, AlertCircle, Coffee, ChevronDown, Check, DollarSign } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia')))
  ? window.location.origin
  : 'https://daily-lover.agentesia.cloud'

export default function WorkTimerWidget() {
  const { user, token, previewRole } = useAuth()
  
  // No mostrar el widget a clientes externos
  const effectiveRole = (previewRole || user?.role || '').toLowerCase()
  if (effectiveRole.includes('cliente')) return null

  const userName = user?.name || user?.full_name || (user?.email ? user.email.split('@')[0] : 'Psicóloga')
  const isPsych = effectiveRole.includes('psicolog') || effectiveRole.includes('matchmaker')

  const [session, setSession] = useState(null)
  const [activeSeconds, setActiveSeconds] = useState(0)
  const [isIdle, setIsIdle] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showIdleModal, setShowIdleModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState(10)
  const [actionFeedback, setActionFeedback] = useState('')

  const lastActivityRef = useRef(Date.now())
  const dropdownRef = useRef(null)

  // 1. Cargar estado de sesión actual del usuario o iniciar automáticamente al login
  const checkCurrentSession = useCallback(async () => {
    if (!userName) return
    try {
      const res = await fetch(`${API}/api/v1/work-time/session/current?user_name=${encodeURIComponent(userName)}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        if (data.has_active_session && data.session) {
          setSession(data.session)
          setActiveSeconds(data.session.active_seconds || 0)
        } else {
          // Iniciar turno automáticamente al iniciar sesión (Requisito #1)
          try {
            const startRes = await fetch(`${API}/api/v1/work-time/session/start`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_name: userName,
                user_role: effectiveRole || 'Psicóloga Matchmaker'
              })
            })
            if (startRes.ok) {
              const startData = await startRes.json()
              setSession({
                id: startData.session_id,
                user_name: startData.user_name,
                active_seconds: startData.active_seconds || 0,
                hourly_rate: startData.hourly_rate || 30000,
                status: 'active'
              })
              setActiveSeconds(startData.active_seconds || 0)
              setIsIdle(false)
              lastActivityRef.current = Date.now()
            }
          } catch (eStart) {
            console.warn('Auto start session warning:', eStart)
          }
        }
        if (data.idle_timeout_minutes) {
          setIdleTimeoutMinutes(data.idle_timeout_minutes || 10)
        }
      }
    } catch (err) {
      console.warn('Error verificando sesión de trabajo:', err)
    } finally {
      setLoading(false)
    }
  }, [userName, token, effectiveRole])

  useEffect(() => {
    checkCurrentSession()
  }, [checkCurrentSession])

  // 2. Ticker de segundos en vivo en el frontend (1 por segundo mientras esté 'active' y no idle)
  useEffect(() => {
    if (!session || session.status !== 'active' || isIdle) return

    const interval = setInterval(() => {
      setActiveSeconds(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [session?.status, isIdle])

  // 3. Detector de inactividad (Event Listeners de mouse, teclado, scroll)
  useEffect(() => {
    if (!session || session.status !== 'active') return

    const handleUserActivity = () => {
      lastActivityRef.current = Date.now()
      if (isIdle) {
        // El usuario volvió a mover el mouse
      }
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(ev => window.addEventListener(ev, handleUserActivity, { passive: true }))

    // Revisar cada 15 segundos si se superó el umbral de inactividad
    const idleChecker = setInterval(() => {
      const elapsedMinutes = (Date.now() - lastActivityRef.current) / (1000 * 60)
      if (elapsedMinutes >= idleTimeoutMinutes && !isIdle && session.status === 'active') {
        setIsIdle(true)
        setShowIdleModal(true)
        // Notificar al backend que está inactivo
        fetch(`${API}/api/v1/work-time/session/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: session.id, is_active: false })
        }).catch(() => {})
      }
    }, 15000)

    return () => {
      events.forEach(ev => window.removeEventListener(ev, handleUserActivity))
      clearInterval(idleChecker)
    }
  }, [session, isIdle, idleTimeoutMinutes])

  // 4. Heartbeat periódico al backend cada 60 segundos
  useEffect(() => {
    if (!session?.id) return

    const hbInterval = setInterval(async () => {
      try {
        const isActive = !isIdle && session.status === 'active'
        const res = await fetch(`${API}/api/v1/work-time/session/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: session.id, is_active: isActive })
        })
        if (res.ok) {
          const d = await res.json()
          if (d.active_seconds) {
            setActiveSeconds(d.active_seconds)
          }
        }
      } catch (err) {
        console.warn('Heartbeat error:', err)
      }
    }, 60000)

    return () => clearInterval(hbInterval)
  }, [session?.id, isIdle, session?.status])

  // 5. Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ─── ACCIONES DE TURNO ────────────────────────────────────────────────────
  const handleStart = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/v1/work-time/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: userName,
          user_role: effectiveRole || 'Psicóloga Matchmaker'
        })
      })
      if (res.ok) {
        const data = await res.json()
        setSession({
          id: data.session_id,
          user_name: data.user_name,
          active_seconds: data.active_seconds || 0,
          hourly_rate: data.hourly_rate || 30000,
          status: 'active'
        })
        setActiveSeconds(data.active_seconds || 0)
        setIsIdle(false)
        lastActivityRef.current = Date.now()
        showFeedback('Turno iniciado')
      }
    } catch (err) {
      alert('Error iniciando turno: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePause = async () => {
    if (!session) return
    try {
      await fetch(`${API}/api/v1/work-time/session/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id, reason: 'Pausa voluntaria' })
      })
      setSession(prev => ({ ...prev, status: 'paused' }))
      showFeedback('Turno en pausa')
    } catch (err) {
      console.error(err)
    }
  }

  const handleResume = async () => {
    if (!session) return
    try {
      await fetch(`${API}/api/v1/work-time/session/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id })
      })
      setSession(prev => ({ ...prev, status: 'active' }))
      setIsIdle(false)
      setShowIdleModal(false)
      lastActivityRef.current = Date.now()
      showFeedback('Turno reanudado')
    } catch (err) {
      console.error(err)
    }
  }

  const handleStop = async () => {
    if (!session) return
    const confirmStop = window.confirm('¿Deseas finalizar tu turno de trabajo actual?')
    if (!confirmStop) return

    try {
      const res = await fetch(`${API}/api/v1/work-time/session/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id, reason: 'manual_stop' })
      })
      if (res.ok) {
        const data = await res.json()
        alert(`Turno finalizado con éxito.\nTiempo trabajado: ${data.active_hours}h\nTotal a liquidar: $${Number(data.total_amount).toLocaleString('es-CO')} COP`)
        setSession(null)
        setActiveSeconds(0)
        setIsIdle(false)
        setShowDropdown(false)
      }
    } catch (err) {
      alert('Error al finalizar turno: ' + err.message)
    }
  }

  const showFeedback = (msg) => {
    setActionFeedback(msg)
    setTimeout(() => setActionFeedback(''), 2500)
  }

  // Formatear segundos a 00h 00m 00s
  const formatTimeFull = (secs) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return `${h > 0 ? `${h}h ` : ''}${m}m ${s < 10 ? '0' : ''}${s}s`
  }

  const formatTimeBadge = (secs) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return `${h > 0 ? `${h}h ` : ''}${m}m`
  }

  const estimatedPay = session?.hourly_rate
    ? Math.round((activeSeconds / 3600.0) * session.hourly_rate)
    : 0

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={dropdownRef}>
      {/* Botón / Insignia Principal en el Header */}
      {session ? (
        <button
          onClick={() => setShowDropdown(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '6px 12px',
            borderRadius: 20,
            background: isIdle
              ? 'rgba(245, 158, 11, 0.15)'
              : session.status === 'paused'
                ? 'rgba(156, 163, 175, 0.15)'
                : 'rgba(16, 185, 129, 0.15)',
            border: `1px solid ${
              isIdle
                ? 'rgba(245, 158, 11, 0.4)'
                : session.status === 'paused'
                  ? 'rgba(156, 163, 175, 0.3)'
                  : 'rgba(16, 185, 129, 0.4)'
            }`,
            color: isIdle
              ? '#F59E0B'
              : session.status === 'paused'
                ? '#9CA3AF'
                : '#10B981',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
            transition: 'all 0.2s',
            outline: 'none'
          }}
          title="Control de Horas Trabajadas"
        >
          {/* Punto de estado con animación de latido */}
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isIdle ? '#F59E0B' : session.status === 'paused' ? '#9CA3AF' : '#10B981',
              boxShadow: session.status === 'active' && !isIdle ? '0 0 8px #10B981' : 'none',
              animation: session.status === 'active' && !isIdle ? 'pulse 1.8s infinite' : 'none'
            }}
          />
          <span>
            {isIdle
              ? 'Pausa Inactividad'
              : session.status === 'paused'
                ? 'En Pausa'
                : `En Turno: ${formatTimeBadge(activeSeconds)}`}
          </span>
          <ChevronDown size={14} style={{ opacity: 0.7 }} />
        </button>
      ) : (
        <button
          onClick={handleStart}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 20,
            background: 'rgba(150, 21, 0, 0.12)',
            border: '1px solid rgba(150, 21, 0, 0.3)',
            color: 'var(--color-primary-light, #c41a00)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
            transition: 'all 0.2s'
          }}
          title="Haz clic para iniciar tu turno de trabajo"
        >
          <Clock size={13} />
          <span>Iniciar Turno</span>
        </button>
      )}

      {/* Menú Desplegable con Detalles de la Jornada */}
      {showDropdown && session && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            width: 280,
            background: 'var(--bg-card, #1A1214)',
            border: '1px solid var(--border-color, rgba(150, 21, 0, 0.2))',
            borderRadius: 12,
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
            padding: 16,
            zIndex: 1000,
            color: 'var(--text-primary, #F5F0F1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{userName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Jornada Activa de Psicóloga</div>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 12,
                background: session.status === 'active' && !isIdle ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: session.status === 'active' && !isIdle ? '#10B981' : '#F59E0B'
              }}
            >
              {session.status === 'active' && !isIdle ? 'ACTIVO' : 'PAUSADO'}
            </span>
          </div>

          {/* Métricas de tiempo y pago */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tiempo Activo</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#10B981', marginTop: 2 }}>
                {formatTimeFull(activeSeconds)}
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Liquidación Est.</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#F59E0B', marginTop: 2 }}>
                ${estimatedPay.toLocaleString('es-CO')}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 14 }}>
            Tarifa: <strong>${Number(session.hourly_rate || 30000).toLocaleString('es-CO')} COP/h</strong>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              Pausa automática si no hay actividad en {idleTimeoutMinutes} min.
            </div>
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', gap: 8 }}>
            {session.status === 'active' && !isIdle ? (
              <button
                onClick={handlePause}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  background: 'rgba(245, 158, 11, 0.1)',
                  color: '#F59E0B',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                <Coffee size={13} />
                Pausar
              </button>
            ) : (
              <button
                onClick={handleResume}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10B981',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                <Play size={13} />
                Reanudar
              </button>
            )}

            <button
              onClick={handleStop}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(239, 68, 68, 0.4)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#EF4444',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              <Square size={13} />
              Finalizar
            </button>
          </div>

          {actionFeedback && (
            <div style={{ marginTop: 10, fontSize: 11, textAlign: 'center', color: '#10B981', fontWeight: 600 }}>
              ✓ {actionFeedback}
            </div>
          )}
        </div>
      )}

      {/* Modal de Alerta por Inactividad (15 min sin interacción) */}
      {showIdleModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16
          }}
        >
          <div
            style={{
              background: 'var(--bg-card, #1A1214)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: 16,
              maxWidth: 420,
              width: '100%',
              padding: 24,
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}
            >
              <Coffee size={28} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>
              ¿Sigues trabajando?
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 20px' }}>
              Detectamos <strong>{idleTimeoutMinutes} minutos sin actividad</strong> en el sistema. Tu turno de trabajo se ha pausado para no registrar horas inactivas.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleResume}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  background: '#10B981',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                ▶️ Reanudar mi Turno
              </button>
              <button
                onClick={handleStop}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  background: 'transparent',
                  color: '#EF4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Finalizar Jornada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
