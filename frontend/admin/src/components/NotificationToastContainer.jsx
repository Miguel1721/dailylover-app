import React from 'react'
import {
  Bell, CheckCircle, AlertTriangle, Flame,
  Heart, Headphones, X, ArrowRight, Sparkles
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'

export default function NotificationToastContainer() {
  const { toasts, dismissToast } = useNotifications()
  const navigate = useNavigate()

  if (!toasts || toasts.length === 0) return null

  const getIcon = (iconType, urgency) => {
    switch (iconType) {
      case 'approval':
        return <Sparkles size={18} color="#10B981" />
      case 'no_show':
        return <AlertTriangle size={18} color="#EF4444" />
      case 'trouble':
        return <Flame size={18} color="#FF6B35" />
      case 'hecho':
        return <Heart size={18} color="#A855F7" />
      case 'novedad':
        return <Headphones size={18} color="#3B82F6" />
      default:
        return urgency === 'urgent'
          ? <AlertTriangle size={18} color="#EF4444" />
          : <Bell size={18} color="var(--color-primary)" />
    }
  }

  const getBorderColor = (urgency) => {
    if (urgency === 'urgent') return '#EF4444'
    if (urgency === 'high') return '#F59E0B'
    return 'var(--color-primary)'
  }

  return (
    <div style={{
      position: 'fixed',
      top: 68,
      right: 24,
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      maxWidth: 380,
      width: 'calc(100vw - 32px)',
      pointerEvents: 'none'
    }}>
      {toasts.map(toast => {
        const borderColor = getBorderColor(toast.urgency)
        return (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              background: 'var(--bg-card)',
              border: `1px solid ${borderColor}`,
              borderLeft: `5px solid ${borderColor}`,
              borderRadius: 12,
              padding: '14px 16px',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45), 0 0 16px rgba(150, 21, 0, 0.15)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              transition: 'all 0.2s'
            }}
          >
            {/* Header Toast */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 8,
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {getIcon(toast.icon_type, toast.urgency)}
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                  {toast.title}
                </div>
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex'
                }}
                title="Cerrar notificación"
              >
                <X size={15} />
              </button>
            </div>

            {/* Mensaje */}
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, paddingLeft: 4 }}>
              {toast.message}
            </div>

            {/* Acciones */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 4,
              paddingTop: 6,
              borderTop: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                hace un momento
              </span>

              {toast.link && (
                <button
                  onClick={() => {
                    navigate(toast.link)
                    dismissToast(toast.id)
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-primary-light, #EF4444)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 6px',
                    borderRadius: 4
                  }}
                >
                  Ver caso <ArrowRight size={12} />
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
