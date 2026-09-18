import React, { useState, useEffect, useRef } from 'react'
import { Bell, Check, ExternalLink, RefreshCw, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

export default function CsNovedadesNotificationBell() {
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const [novedades, setNovedades] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef(null)

  const fetchNovedades = () => {
    if (!token) return
    fetch(`${API}/api/v1/admin/cs-novedades?status_filter=PENDIENTE&limit=20`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        setNovedades(d.novedades || [])
        setUnreadCount(d.unread_count || 0)
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchNovedades()
    const interval = setInterval(fetchNovedades, 45000) // cada 45s
    return () => clearInterval(interval)
  }, [token])

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

  const handleResolve = async (novedadId, e) => {
    e.stopPropagation()
    try {
      const res = await fetch(`${API}/api/v1/admin/cs-novedades/${novedadId}/resolve`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        setNovedades(prev => prev.filter(n => n.id !== novedadId))
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleGoToClient = (clientName) => {
    setIsOpen(false)
    navigate(`/clientes?q=${encodeURIComponent(clientName)}`)
    window.dispatchEvent(new Event('popstate'))
  }

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          background: isOpen ? 'rgba(150, 21, 0, 0.15)' : 'transparent',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: unreadCount > 0 ? '#3B82F6' : 'var(--text-secondary)',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.2s'
        }}
        title={`Novedades de Customer Service (${unreadCount} pendientes)`}
      >
        <Bell size={17} />
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
            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.5)'
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
          width: 360,
          maxWidth: '90vw',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
          zIndex: 200,
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>
                📢 Novedades CS
              </span>
              <span style={{
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#3B82F6',
                borderRadius: 10,
                padding: '2px 7px',
                fontSize: 11,
                fontWeight: 700
              }}>
                {unreadCount}
              </span>
            </div>
            <button
              onClick={fetchNovedades}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
              title="Recargar"
            >
              <RefreshCw size={13} />
            </button>
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {novedades.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                ✨ No hay novedades pendientes de Customer Service.
              </div>
            ) : (
              novedades.map(nov => (
                <div
                  key={nov.id}
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    transition: 'background 0.15s'
                  }}
                  className="search-result-item"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      onClick={() => handleGoToClient(nov.client_name)}
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        color: 'var(--color-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      title="Ver expediente del cliente"
                    >
                      {nov.client_name} <ExternalLink size={11} />
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {nov.created_at}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {nov.details}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      De: <strong>{nov.created_by}</strong> ➔ 👩‍⚕️ {nov.assigned_to}
                    </span>
                    <button
                      onClick={(e) => handleResolve(nov.id, e)}
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: '#10B981',
                        borderRadius: 6,
                        padding: '2px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      title="Marcar como atendida"
                    >
                      <Check size={12} /> Atendida
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
