import React, { useState, useEffect } from 'react'
import { BellRing, X, Search, CheckCircle, CreditCard, MapPin, PauseCircle, MessageSquare } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

const CITIES = [
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga',
  'Pereira', 'Cartagena', 'Manizales', 'Santa Marta', 'Miami', 'Madrid'
]

const PLANS = [
  'Estándar 65k (2 citas)',
  'Estándar 65k (1 cita)',
  'Estándar Plus 98k',
  'Premium 150k',
  'VIP 195k',
  'VIP 295k',
  'Básico 40k',
  'Matchmaking Experience'
]

export default function RegistrarNovedadModal({ preselectedClient, onClose, onSuccess }) {
  const { token, user } = useAuth()
  const [clientSearch, setClientSearch] = useState(preselectedClient?.name || '')
  const [selectedClient, setSelectedClient] = useState(preselectedClient || null)
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  const [novedadType, setNovedadType] = useState('EXTRA_DATE')
  const [extraDates, setExtraDates] = useState(1)
  const [newCity, setNewCity] = useState('Bogotá')
  const [newPlan, setNewPlan] = useState('VIP 195k')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Búsqueda en vivo de clientes
  useEffect(() => {
    if (!clientSearch.trim() || selectedClient) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(() => {
      setSearching(true)
      fetch(`${API}/api/v1/admin/users?search=${encodeURIComponent(clientSearch)}&limit=6`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(d => {
          setSearchResults(d.users || [])
          setSearching(false)
        })
        .catch(() => setSearching(false))
    }, 250)
    return () => clearTimeout(timer)
  }, [clientSearch, selectedClient, token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedClient && !clientSearch.trim()) {
      setError('Debes especificar o seleccionar un cliente')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`${API}/api/v1/admin/client-notes/novedad`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          client_id: selectedClient?.id || null,
          client_name: selectedClient?.name || clientSearch.trim(),
          novedad_type: novedadType,
          details: details.trim() || (
            novedadType === 'EXTRA_DATE' ? `Pago de ${extraDates} cita(s) extra` :
            novedadType === 'CITY_CHANGE' ? `Cambio de ciudad a ${newCity}` :
            novedadType === 'UPGRADE_PLAN' ? `Upgrade a ${newPlan}` :
            novedadType === 'PAUSE' ? 'Cliente solicitó pausar cuenta temporalmente' : 'Nota de CS'
          ),
          extra_dates: novedadType === 'EXTRA_DATE' ? Number(extraDates) : 0,
          new_city: novedadType === 'CITY_CHANGE' ? newCity : null,
          new_plan: novedadType === 'UPGRADE_PLAN' ? newPlan : null,
          assigned_to: selectedClient?.responsable || null
        })
      })

      const data = await res.json()
      if (res.ok) {
        if (onSuccess) onSuccess(data.message || 'Novedad registrada')
        onClose()
      } else {
        setError(data.detail || 'Error al registrar novedad')
      }
    } catch (err) {
      setError('Error de conexión con el servidor')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 560, maxWidth: '95vw', padding: 24, borderRadius: 14, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#3B82F6'
            }}>
              <BellRing size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                Registrar Novedad / Cita Extra
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Puente Customer Service ➔ Psicóloga (pagos extras, ciudades, pausas)
              </p>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '4px 8px', fontSize: 16 }}>
            ✕
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #EF4444',
            color: '#EF4444',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 12,
            marginBottom: 14
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Selector de Cliente */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Cliente *
            </label>
            {selectedClient ? (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', borderRadius: 8, background: 'rgba(150, 21, 0, 0.12)',
                border: '1px solid var(--color-primary)'
              }}>
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedClient.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                    {selectedClient.client_code || `#${selectedClient.id}`} • 👩‍⚕️ {selectedClient.responsable || 'Silvi'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedClient(null); setClientSearch('') }}
                  style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Buscar cliente por nombre o teléfono..."
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px 9px 32px', borderRadius: 8,
                    background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                  }}
                />
                {searchResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: 8, marginTop: 4, maxHeight: 180, overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                  }}>
                    {searchResults.map(u => (
                      <div
                        key={u.id}
                        onClick={() => { setSelectedClient(u); setClientSearch(u.name) }}
                        style={{
                          padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                          cursor: 'pointer', fontSize: 12
                        }}
                        className="search-result-item"
                      >
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {u.client_code || `#${u.id}`} • {u.phone} • 👩‍⚕️ {u.responsable || 'General'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tipo de Novedad */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Tipo de Novedad:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {[
                { id: 'EXTRA_DATE', label: '💳 Compra Cita Extra', icon: CreditCard },
                { id: 'UPGRADE_PLAN', label: '💎 Upgrade Plan', icon: CheckCircle },
                { id: 'CITY_CHANGE', label: '📍 Cambio Ciudad', icon: MapPin },
                { id: 'PAUSE', label: '⏸️ Pausa Temporal', icon: PauseCircle },
              ].map(opt => {
                const Icon = opt.icon
                const isSelected = novedadType === opt.id
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setNovedadType(opt.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 12px', borderRadius: 8,
                      border: isSelected ? '2px solid #3B82F6' : '1px solid var(--border-color)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-base)',
                      color: isSelected ? '#3B82F6' : 'var(--text-secondary)',
                      fontSize: 12.5, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    <Icon size={16} />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Campos dinámicos según el tipo de novedad */}
          {novedadType === 'EXTRA_DATE' && (
            <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: 12, borderRadius: 8, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#3B82F6', marginBottom: 4 }}>
                Cantidad de Citas Adicionales Pagadas:
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[1, 2, 3, 4].map(num => (
                  <button
                    type="button"
                    key={num}
                    onClick={() => setExtraDates(num)}
                    style={{
                      flex: 1, padding: '8px', borderRadius: 8,
                      border: extraDates === num ? '2px solid #3B82F6' : '1px solid var(--border-color)',
                      background: extraDates === num ? '#3B82F6' : 'var(--bg-base)',
                      color: extraDates === num ? '#fff' : 'var(--text-primary)',
                      fontWeight: 800, fontSize: 14, cursor: 'pointer'
                    }}
                  >
                    +{num} {num === 1 ? 'Cita' : 'Citas'}
                  </button>
                ))}
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                ⚡ Se crearán automáticamente los slots correspondientes en la mesa de la psicóloga.
              </p>
            </div>
          )}

          {novedadType === 'CITY_CHANGE' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Nueva Ciudad de Residencia:
              </label>
              <select
                value={newCity}
                onChange={e => setNewCity(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              >
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {novedadType === 'UPGRADE_PLAN' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Nuevo Plan de Membresía:
              </label>
              <select
                value={newPlan}
                onChange={e => setNewPlan(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              >
                {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          {/* Detalles / Mensaje */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Detalles / Mensaje para la Psicóloga:
            </label>
            <textarea
              rows={3}
              required
              placeholder="Ej: Pagó 2 dates más por transferencia Nequi, pide que el match tenga más de 30 años..."
              value={details}
              onChange={e => setDetails(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                color: 'var(--text-primary)', fontSize: 12, outline: 'none', resize: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8,
                padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer'
              }}
              disabled={submitting}
            >
              {submitting ? 'Enviando...' : '📢 Registrar Novedad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
