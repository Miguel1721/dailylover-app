import React, { useState, useEffect, useRef } from 'react'
import {
  Bell, Check, ExternalLink, RefreshCw, X, Sparkles,
  AlertTriangle, Flame, Heart, Headphones, Volume2, Monitor
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia')))
  ? window.location.origin
  : 'https://daily-lover.agentesia.cloud'

export default function CsNovedadesNotificationBell() {
  const { token, user } = useAuth()
  const {
    unreadCount,
    alertsHistory,
    desktopPermission,
    requestDesktopPermission,
    simulateAlert,
    playChime,
    refreshAlerts
  } = useNotifications()

  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('todas') // 'todas' | 'novedades_cs'
  const [simulating, setSimulating] = useState(false)
  const dropdownRef = useRef(null)

  // Cerrar al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleGoToLink = (link, clientName) => {
    setIsOpen(false)
    if (link) {
      navigate(link)
    } else if (clientName) {
      navigate(`/clientes?q=${encodeURIComponent(clientName)}`)
    }
    window.dispatchEvent(new Event('popstate'))
  }

  const handleSimulate = async (type) => {
    setSimulating(true)
    await simulateAlert(type)
    setSimulating(false)
  }

  const getAlertIcon = (iconType, urgency) => {
    switch (iconType) {
      case 'approval':
        return <Sparkles size={14} color="#10B981" />
      case 'no_show':
        return <AlertTriangle size={14} color="#EF4444" />
      case 'trouble':
        return <Flame size={14} color="#FF6B35" />
      case 'hecho':
        return <Heart size={14} color="#A855F7" />
      case 'novedad':
        return <Headphones size={14} color="#3B82F6" />
      default:
        return urgency === 'urgent'
          ? <AlertTriangle size={14} color="#EF4444" />
          : <Bell size={14} color="var(--color-primary)" />
    }
  }

  const filteredAlerts = activeTab === 'novedades_cs'
    ? alertsHistory.filter(a => a.category === 'CS_NOVEDAD')
    : alertsHistory

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          background: isOpen ? 'rgba(150, 21, 0, 0.18)' : 'transparent',
          border: `1px solid ${unreadCount > 0 ? '#EF4444' : 'var(--border-color)'}`,
          borderRadius: 8,
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: unreadCount > 0 ? '#EF4444' : 'var(--text-secondary)',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.2s'
        }}
        title={`Centro de Notificaciones en Vivo (${unreadCount} sin resolver)`}
      >
        <Bell size={17} className={unreadCount > 0 ? 'pulse' : ''} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -4,
            right: -4,
            background: '#EF4444',
            color: '#fff',
            fontSize: 10,
            fontWeight: 800,
            borderRadius: 10,
            padding: '1px 5px',
            lineHeight: '13px',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.6)'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 8,
          width: 390,
          maxWidth: '92vw',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 14,
          boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
          zIndex: 2000,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(150, 21, 0, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={16} color="var(--color-primary)" />
              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>
                Centro de Notificaciones en Vivo
              </span>
              {unreadCount > 0 && (
                <span style={{
                  background: '#EF4444',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '1px 6px',
                  fontSize: 10,
                  fontWeight: 800
                }}>
                  {unreadCount}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                onClick={() => playChime()}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 3 }}
                title="Probar sonido sutil"
              >
                <Volume2 size={14} />
              </button>
              <button
                onClick={refreshAlerts}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 3 }}
                title="Recargar alertas"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Sub-tabs */}
          <div style={{
            display: 'flex',
            padding: '6px 12px',
            background: 'var(--bg-base)',
            borderBottom: '1px solid var(--border-color)',
            gap: 6
          }}>
            <button
              onClick={() => setActiveTab('todas')}
              style={{
                background: activeTab === 'todas' ? 'var(--bg-card)' : 'transparent',
                border: activeTab === 'todas' ? '1px solid var(--border-color)' : 'none',
                color: activeTab === 'todas' ? 'var(--text-primary)' : 'var(--text-muted)',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Todas ({alertsHistory.length})
            </button>
            <button
              onClick={() => setActiveTab('novedades_cs')}
              style={{
                background: activeTab === 'novedades_cs' ? 'var(--bg-card)' : 'transparent',
                border: activeTab === 'novedades_cs' ? '1px solid var(--border-color)' : 'none',
                color: activeTab === 'novedades_cs' ? '#3B82F6' : 'var(--text-muted)',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              📢 Novedades CS ({unreadCount})
            </button>
          </div>

          {/* Permiso Web Push Banner si no está habilitado */}
          {desktopPermission !== 'granted' && (
            <div style={{
              background: 'rgba(59, 130, 246, 0.08)',
              borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3B82F6' }}>
                <Monitor size={14} />
                <span>¿Activar alertas en tu PC / Celular?</span>
              </div>
              <button
                onClick={requestDesktopPermission}
                style={{
                  background: '#3B82F6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Activar Web Push
              </button>
            </div>
          )}

          {/* Lista de Alertas */}
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {filteredAlerts.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                ✨ No hay eventos recientes en el sistema.
              </div>
            ) : (
              filteredAlerts.map(alert => (
                <div
                  key={alert.id}
                  onClick={() => handleGoToLink(alert.link, alert.target_person)}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  className="search-result-item"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {getAlertIcon(alert.icon_type, alert.urgency)}
                      <span style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: alert.urgency === 'urgent' ? '#EF4444' : 'var(--text-primary)'
                      }}>
                        {alert.title}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {alert.created_at ? alert.created_at.slice(11, 16) : ''}
                    </span>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, paddingLeft: 20 }}>
                    {alert.message}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* SIMULADOR EN VIVO (Para que el usuario experimente cómo llega la notificación) */}
          <div style={{
            padding: '10px 14px',
            background: 'var(--bg-base)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              ⚡ Probar Alerta en Vivo (Simulador Instantáneo)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button
                disabled={simulating}
                onClick={() => handleSimulate('APPROVAL')}
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#10B981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 6,
                  padding: '5px 8px',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Sparkles size={11} /> Cita Aprobada
              </button>

              <button
                disabled={simulating}
                onClick={() => handleSimulate('NO_SHOW')}
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#EF4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 6,
                  padding: '5px 8px',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <AlertTriangle size={11} /> Alerta No-Show
              </button>

              <button
                disabled={simulating}
                onClick={() => handleSimulate('STATUS_CHANGE')}
                style={{
                  background: 'rgba(168, 85, 247, 0.12)',
                  color: '#A855F7',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  borderRadius: 6,
                  padding: '5px 8px',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Heart size={11} /> Match Hecho
              </button>

              <button
                disabled={simulating}
                onClick={() => handleSimulate('TROUBLE')}
                style={{
                  background: 'rgba(255, 107, 53, 0.12)',
                  color: '#FF6B35',
                  border: '1px solid rgba(255, 107, 53, 0.3)',
                  borderRadius: 6,
                  padding: '5px 8px',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Flame size={11} /> Alerta Trouble
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
