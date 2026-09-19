import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from './AuthContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia')))
  ? window.location.origin
  : 'https://daily-lover.agentesia.cloud'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { token, user } = useAuth()
  const [toasts, setToasts] = useState([])
  const [alertsHistory, setAlertsHistory] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [desktopPermission, setDesktopPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  )

  const lastSeenAlertIdRef = useRef(null)
  const audioCtxRef = useRef(null)

  // Generador de sonido sutil con Web Audio API (Cero descargas mp3, 100% confiable)
  const playChime = useCallback(() => {
    try {
      if (typeof window === 'undefined') return
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext
      if (!AudioCtxClass) return

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtxClass()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const now = ctx.currentTime

      // Nota 1 (Do5 - 523.25 Hz)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(523.25, now)
      gain1.gain.setValueAtTime(0.08, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.3)

      // Nota 2 (Mi5 - 659.25 Hz - sonido positivo)
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(659.25, now + 0.12)
      gain2.gain.setValueAtTime(0.1, now + 0.12)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now + 0.12)
      osc2.stop(now + 0.5)
    } catch (e) {
      // Ignorar si el navegador bloquea audio antes de interacción
    }
  }, [])

  // Solicitar permiso de escritorio
  const requestDesktopPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission()
      setDesktopPermission(perm)
      return perm
    }
    return 'denied'
  }, [])

  // Disparar notificación de escritorio / móvil del sistema operativo
  const triggerDesktopNotification = useCallback((title, body, url = '/admin/', tag = null) => {
    if (typeof window === 'undefined') return

    // Vibración física táctil si el hardware lo soporta
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([200, 100, 200])
      }
    } catch (e) {}

    // Verificar permiso concedido
    const hasPerm = typeof Notification !== 'undefined' && Notification.permission === 'granted'
    if (!hasPerm) return

    try {
      const notifTag = tag || `dl_${Date.now()}`
      const notifOptions = {
        body: body || 'Nueva actualización en el sistema',
        icon: '/admin/icon-192.png',
        badge: '/admin/icon-192.png',
        tag: notifTag,
        vibrate: [200, 100, 200],
        renotify: false, // Deduplicación nativa del SO: si el tag ya existe no repite el banner
        data: { url: url || '/admin/' }
      }

      // Vía Service Worker (Móviles Android Chrome y Safari iOS PWA)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration('/admin/').then(reg => {
          if (reg && reg.showNotification) {
            return reg.showNotification(`💌 Daily Lover · ${title}`, notifOptions)
          }
          return navigator.serviceWorker.ready.then(activeReg => {
            if (activeReg && activeReg.showNotification) {
              return activeReg.showNotification(`💌 Daily Lover · ${title}`, notifOptions)
            }
            tryDesktopConstructor()
          })
        }).catch(() => {
          tryDesktopConstructor()
        })
      } else {
        tryDesktopConstructor()
      }

      function tryDesktopConstructor() {
        try {
          const notif = new Notification(`💌 Daily Lover · ${title}`, notifOptions)
          notif.onclick = () => {
            window.focus()
            if (url) window.location.href = url
            notif.close()
          }
        } catch (e) {
          // Ignorado si móvil restringe constructor
        }
      }
    } catch (e) {
      console.warn('Error al disparar notificación de escritorio/móvil:', e)
    }
  }, [])

  // Descartar Toast
  const dismissToast = useCallback((toastId) => {
    setToasts(prev => prev.filter(t => t.id !== toastId))
  }, [])

  // Disparar nuevo Toast visual
  const triggerToast = useCallback((toastData) => {
    const id = toastData.id || (Date.now() + Math.random().toString(36).substring(2, 6))
    const newToast = {
      id,
      title: toastData.title || 'Alerta del Sistema',
      message: toastData.message || '',
      urgency: toastData.urgency || 'normal', // 'normal', 'high', 'urgent'
      icon_type: toastData.icon_type || 'info', // 'hecho', 'approval', 'no_show', 'trouble', 'novedad', 'info'
      link: toastData.link || null,
      target_person: toastData.target_person || null,
      created_at: new Date()
    }

    // Prevenir duplicados visuales por ID
    setToasts(prev => {
      if (prev.some(t => t.id === id)) return prev
      return [newToast, ...prev.slice(0, 4)]
    })
    playChime()
    triggerDesktopNotification(newToast.title, newToast.message, newToast.link, id)

    // Auto-dismiss tras 7 segundos
    setTimeout(() => {
      dismissToast(id)
    }, 7000)
  }, [playChime, triggerDesktopNotification, dismissToast])

  // Polling de alertas en vivo desde el backend
  const fetchLiveAlerts = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${API}/api/v1/admin/live-alerts?limit=25`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        const incomingAlerts = data.alerts || []
        setAlertsHistory(incomingAlerts)
        setUnreadCount(data.unread_count || 0)

        // Verificar si hay eventos nuevos desde el último poll
        if (incomingAlerts.length > 0) {
          const newest = incomingAlerts[0]
          if (lastSeenAlertIdRef.current && lastSeenAlertIdRef.current !== newest.id) {
            // Se detectó un nuevo evento en tiempo real
            triggerToast({
              id: newest.id,
              title: newest.title,
              message: newest.message,
              urgency: newest.urgency,
              icon_type: newest.icon_type,
              link: newest.link,
              target_person: newest.target_person
            })
          }
          lastSeenAlertIdRef.current = newest.id
        }
      }
    } catch (e) {
      // Silenciar errores de red periódicos
    }
  }, [token, triggerToast])

  useEffect(() => {
    fetchLiveAlerts()
    const interval = setInterval(fetchLiveAlerts, 15000) // cada 15 segundos
    return () => clearInterval(interval)
  }, [fetchLiveAlerts])

  // Función para simular una alerta en vivo (para pruebas directas del usuario)
  const simulateAlert = useCallback(async (type = 'APPROVAL') => {
    if (!token) return
    try {
      const res = await fetch(`${API}/api/v1/admin/live-alerts/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type })
      })
      if (res.ok) {
        const data = await res.json()
        const alertId = data.alert_id || `sim_${Date.now()}`
        
        // Sincronizar inmediatamente el ID visto para evitar duplicación con el próximo poll
        lastSeenAlertIdRef.current = alertId

        triggerToast({
          id: alertId,
          title: type === 'APPROVAL' ? '🎉 Match Aprobado por María Paula' :
                 type === 'NO_SHOW' ? '🚨 Alerta: Inasistencia (No-Show)' :
                 type === 'TROUBLE' ? '⚠️ Alerta de Trouble Clínico' :
                 type === 'CS_NOVEDAD' ? '📢 Cita Extra Comprada (+1)' : '✨ Match Listo (HECHO)',
          message: data.details,
          urgency: type === 'NO_SHOW' ? 'urgent' : 'high',
          icon_type: type.toLowerCase(),
          link: '/matchmaking/citas-agendadas',
          target_person: 'Carlos Mendoza & Laura Rincón'
        })
      }
    } catch (e) {
      console.error(e)
    }
  }, [token, triggerToast])

  return (
    <NotificationContext.Provider value={{
      toasts,
      alertsHistory,
      unreadCount,
      desktopPermission,
      requestDesktopPermission,
      triggerToast,
      dismissToast,
      playChime,
      simulateAlert,
      refreshAlerts: fetchLiveAlerts
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return ctx
}
