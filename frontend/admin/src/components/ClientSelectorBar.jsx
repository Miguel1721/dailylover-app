import React, { useState, useEffect, useRef } from 'react'
import { Search, User, CheckCircle2, Clock, X, ChevronRight, FileCheck, FilePlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

export default function ClientSelectorBar({
  selectedClient,
  onSelectClient,
  onClearClient,
  lastUpdated,
  updatedBy,
  exists = false
}) {
  const { token } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Handle clicking outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto search on query change
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(() => {
      setLoading(true)
      // Call dedicated matchmaking client search first
      fetch(`${API}/api/v1/matchmaking/client-search?query=${encodeURIComponent(query.trim())}`)
        .then(r => r.json())
        .then(data => {
          const list = data.clients || []
          setResults(list)
          setIsOpen(true)
          setLoading(false)
        })
        .catch(err => {
          console.error('Error searching clients:', err)
          setLoading(false)
        })
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = (client) => {
    onSelectClient(client)
    setQuery('')
    setIsOpen(false)
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 14,
      padding: '18px 24px',
      marginBottom: 24,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
    }}>
      {!selectedClient ? (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                Buscar Cliente
              </span>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Escribe el nombre, teléfono o código DL para cargar sus formularios
              </p>
            </div>
            <span style={{
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 6,
              background: 'rgba(150, 21, 0, 0.12)',
              color: 'var(--color-primary)',
              fontWeight: 600
            }}>
              Paso 1: Seleccionar Persona
            </span>
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={18} style={{ position: 'absolute', left: 14, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Ej: Samuel Moreno, Laura Castillo, 319..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { if (results.length > 0) setIsOpen(true) }}
              style={{
                width: '100%',
                padding: '12px 14px 12px 44px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                color: 'var(--text-primary)',
                fontSize: 14,
                outline: 'none'
              }}
            />
            {loading && (
              <span style={{ position: 'absolute', right: 14, fontSize: 12, color: 'var(--text-muted)' }}>
                Buscando...
              </span>
            )}
          </div>

          {/* Search Dropdown */}
          {isOpen && results.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 6,
              background: '#1A1214',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              boxShadow: '0 8px 30px rgba(0,0,0,0.7)',
              zIndex: 100,
              maxHeight: 280,
              overflowY: 'auto'
            }}>
              {results.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(150,21,0,0.08)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'background 0.15s'
                  }}
                  className="client-search-item"
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(150, 21, 0, 0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                      {c.name || 'Sin nombre'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {c.phone || 'Sin teléfono'} {c.client_code ? `• Código: ${c.client_code}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {c.has_extended ? (
                      <span style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 10,
                        background: 'rgba(76, 175, 80, 0.15)',
                        color: '#4CAF50',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3
                      }}>
                        <FileCheck size={11} /> Con datos
                      </span>
                    ) : (
                      <span style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 10,
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-muted)'
                      }}>
                        Sin datos
                      </span>
                    )}
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {isOpen && !loading && query.length >= 2 && results.length === 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 6,
              background: '#1A1214',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              padding: 16,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
              zIndex: 100
            }}>
              No se encontraron clientes con "{query}".
            </div>
          )}
        </div>
      ) : (
        /* Selected Client Banner */
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 46,
              height: 46,
              borderRadius: '50%',
              background: 'rgba(150, 21, 0, 0.25)',
              border: '2px solid var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 18
            }}>
              {selectedClient.name ? selectedClient.name.charAt(0).toUpperCase() : <User size={20} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>
                  {selectedClient.name || 'Sin nombre'}
                </span>
                {exists ? (
                  <span style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: 'rgba(76, 175, 80, 0.15)',
                    color: '#4CAF50',
                    border: '1px solid rgba(76,175,80,0.3)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <CheckCircle2 size={12} /> Datos guardados
                  </span>
                ) : (
                  <span style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: 'rgba(255, 193, 7, 0.15)',
                    color: '#FFC107',
                    border: '1px solid rgba(255,193,7,0.3)',
                    fontWeight: 600
                  }}>
                    Formulario sin guardar
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>📞 {selectedClient.phone || '—'}</span>
                {selectedClient.client_code && <span>ID: {selectedClient.client_code}</span>}
                {lastUpdated && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                    <Clock size={12} /> Actualizado: {new Date(lastUpdated).toLocaleDateString('es-CO')} {updatedBy ? `por ${updatedBy}` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClearClient}
            className="btn btn-ghost btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)'
            }}
          >
            <X size={14} /> Cambiar de Cliente
          </button>
        </div>
      )}
    </div>
  )
}
