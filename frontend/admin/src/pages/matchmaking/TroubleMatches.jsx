import React, { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle, Flame, UserX, Search, Filter, RefreshCw, Plus,
  ChevronLeft, ChevronRight, MessageSquare, Copy, CheckCircle,
  Edit3, ExternalLink, HelpCircle, UserCheck, HeartCrack, Info, X,
  Bell, Sparkles, Heart
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import CrmPersonLink from '../../components/CrmPersonLink'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia')))
  ? window.location.origin
  : 'https://daily-lover.agentesia.cloud'

const PSYCHOLOGISTS = [
  'Todas', 'MARI PAZ', 'MAPE', 'MANU', 'ANA', 'LAU', 'JENN', 'LINA'
]

const CITIES = [
  'Todas', 'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga',
  'Cartagena', 'Chía', 'Cúcuta', 'Villavicencio', 'Pereira'
]

export default function TroubleMatches() {
  const { token, user } = useAuth()
  const { simulateAlert } = useNotifications()
  const [simulating, setSimulating] = useState(false)

  const handleQuickSimulate = async (type) => {
    setSimulating(true)
    await simulateAlert(type)
    setSimulating(false)
  }

  // Estado general
  const [activeTab, setActiveTab] = useState('trouble_matches') // 'trouble_matches' | 'difficult_clients' | 'operational'
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [counts, setCounts] = useState({
    trouble_matches_count: 0,
    difficult_clients_count: 0,
    operational_trouble_count: 0
  })

  // Filtros
  const [search, setSearch] = useState('')
  const [selectedPsyc, setSelectedPsyc] = useState('Todas')
  const [selectedCity, setSelectedCity] = useState('Todas')
  const [copiedId, setCopiedId] = useState(null)
  const [notification, setNotification] = useState('')

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [detailModalItem, setDetailModalItem] = useState(null)

  // Formulario creación
  const [createForm, setCreateForm] = useState({
    type: 'trouble_match',
    person_a: '',
    person_b: '',
    psychologist: '',
    reason: '',
    notes: '',
    city: 'Bogotá',
    category: 'Caso Especial'
  })
  const [creating, setCreating] = useState(false)

  // Cargar datos desde la API
  const fetchTroubleCases = useCallback(async () => {
    setLoading(true)
    let url = `${API}/api/v1/matchmaking/trouble-cases?tab=${activeTab}&page=${page}&limit=${limit}`
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`
    if (selectedPsyc !== 'Todas') url += `&psychologist=${encodeURIComponent(selectedPsyc)}`
    if (selectedCity !== 'Todas') url += `&city=${encodeURIComponent(selectedCity)}`

    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
        setTotal(data.total || 0)
        if (data.counts) {
          setCounts(data.counts)
        }
      }
    } catch (err) {
      console.error('Error al cargar casos trouble:', err)
    } finally {
      setLoading(false)
    }
  }, [activeTab, page, limit, search, selectedPsyc, selectedCity, token])

  useEffect(() => {
    fetchTroubleCases()
  }, [fetchTroubleCases])

  // Reset page al cambiar tab o filtro
  const handleTabChange = (newTab) => {
    setActiveTab(newTab)
    setPage(1)
  }

  // Notificación flash
  const showToast = (msg) => {
    setNotification(msg)
    setTimeout(() => setNotification(''), 3000)
  }

  // Copiar al portapapeles
  const copyToClipboard = (text, id) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    showToast('Copiado al portapapeles')
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Guardar nuevo caso
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!createForm.person_a.trim()) {
      alert('Ingresa el nombre de la persona.')
      return
    }

    setCreating(true)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/trouble-cases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(createForm)
      })
      if (res.ok) {
        showToast('Caso registrado exitosamente')
        setShowCreateModal(false)
        setCreateForm({
          type: activeTab === 'difficult_clients' ? 'difficult_client' : 'trouble_match',
          person_a: '',
          person_b: '',
          psychologist: '',
          reason: '',
          notes: '',
          city: 'Bogotá',
          category: 'Caso Especial'
        })
        fetchTroubleCases()
      } else {
        alert('Error al registrar el caso')
      }
    } catch (err) {
      console.error(err)
      alert('Error de conexión')
    } finally {
      setCreating(false)
    }
  }

  // Guardar edición de notas
  const handleUpdateNotes = async () => {
    if (!editingItem) return
    try {
      const tableType = activeTab === 'difficult_clients' ? 'difficult_clients' : 'trouble_matches'
      const res = await fetch(`${API}/api/v1/matchmaking/trouble-cases/${tableType}/${editingItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          notes: editingItem.notes,
          reason: editingItem.reason,
          status: editingItem.status,
          category: editingItem.category
        })
      })
      if (res.ok) {
        showToast('Notas actualizadas correctamente')
        setEditingItem(null)
        fetchTroubleCases()
      } else {
        alert('No se pudo actualizar el registro')
      }
    } catch (err) {
      console.error(err)
      alert('Error de conexión')
    }
  }

  const totalPages = Math.ceil(total / limit) || 1

  return (
    <div className="trouble-page-container" style={{ padding: '20px 24px', minHeight: '100%', background: 'var(--bg-base)' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          background: '#10B981',
          color: '#FFFFFF',
          padding: '10px 18px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 700,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <CheckCircle size={16} /> {notification}
        </div>
      )}

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#EF4444',
              borderRadius: 10,
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                Gestión de Trouble & Casos Especiales
              </h1>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                Histórico de citas canceladas, clientes con restricciones clínicas y alertas operativas de matchmakers
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => fetchTroubleCases()}
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            title="Refrescar lista"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refrescar
          </button>
          <button
            onClick={() => {
              setCreateForm(prev => ({
                ...prev,
                type: activeTab === 'difficult_clients' ? 'difficult_client' : 'trouble_match'
              }))
              setShowCreateModal(true)
            }}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              background: '#961500',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            <Plus size={16} /> Registrar Caso
          </button>
        </div>
      </div>

      {/* HERRAMIENTAS DE DESARROLLO (SIMULADOR OCULTO PARA CS/OPERACIÓN) */}
      <details style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px dashed var(--border-color)',
        borderRadius: 10,
        padding: '10px 14px',
        marginBottom: 20
      }}>
        <summary style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--text-muted)',
          cursor: 'pointer',
          userSelect: 'none',
          outline: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <span>🔧 Herramientas de Desarrollo (Simulador de Alertas de Prueba - Uso Interno Técnico)</span>
        </summary>
        <div style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={16} color="var(--color-primary)" />
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                ⚡ Simulador de Alertas en Tiempo Real
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Toca cualquier botón para probar cómo te llega la notificación con audio y banner flotante:
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
            <button
              disabled={simulating}
              onClick={() => handleQuickSimulate('APPROVAL')}
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minHeight: 40
              }}
            >
              <Sparkles size={13} /> Cita Aprobada
            </button>
            <button
              disabled={simulating}
              onClick={() => handleQuickSimulate('NO_SHOW')}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#EF4444',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minHeight: 40
              }}
            >
              <AlertTriangle size={13} /> Alerta No-Show
            </button>
            <button
              disabled={simulating}
              onClick={() => handleQuickSimulate('STATUS_CHANGE')}
              style={{
                background: 'rgba(168, 85, 247, 0.15)',
                color: '#A855F7',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minHeight: 40
              }}
            >
              <Heart size={13} /> Match Hecho
            </button>
            <button
              disabled={simulating}
              onClick={() => handleQuickSimulate('TROUBLE')}
              style={{
                background: 'rgba(255, 107, 53, 0.15)',
                color: '#FF6B35',
                border: '1px solid rgba(255, 107, 53, 0.4)',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minHeight: 40
              }}
            >
              <Flame size={13} /> Alerta Trouble
            </button>
          </div>
        </div>
      </details>

      {/* KPI STAT CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        {/* Card 1: Parejas en Trouble */}
        <div
          onClick={() => handleTabChange('trouble_matches')}
          style={{
            background: activeTab === 'trouble_matches' ? 'rgba(150, 21, 0, 0.12)' : 'var(--bg-card)',
            border: `1px solid ${activeTab === 'trouble_matches' ? '#961500' : 'var(--border-color)'}`,
            borderRadius: 12,
            padding: '18px 20px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'trouble_matches' ? '0 0 16px rgba(150,21,0,0.2)' : 'none'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              💔 Parejas en Trouble (Histórico)
            </span>
            <HeartCrack size={18} color="#EF4444" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8 }}>
            {counts.trouble_matches_count.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Citas fallidas, cancelaciones y descartes mutuos
          </div>
        </div>

        {/* Card 2: Clientes Difíciles */}
        <div
          onClick={() => handleTabChange('difficult_clients')}
          style={{
            background: activeTab === 'difficult_clients' ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-card)',
            border: `1px solid ${activeTab === 'difficult_clients' ? '#F59E0B' : 'var(--border-color)'}`,
            borderRadius: 12,
            padding: '18px 20px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'difficult_clients' ? '0 0 16px rgba(245,158,11,0.2)' : 'none'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              ⚠️ Clientes Difíciles & Restricciones
            </span>
            <AlertTriangle size={18} color="#F59E0B" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8 }}>
            {counts.difficult_clients_count.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Perfiles con barreras clínicas, edad, estrato o ciudad
          </div>
        </div>

        {/* Card 3: Troubles Operativos */}
        <div
          onClick={() => handleTabChange('operational')}
          style={{
            background: activeTab === 'operational' ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-card)',
            border: `1px solid ${activeTab === 'operational' ? '#EF4444' : 'var(--border-color)'}`,
            borderRadius: 12,
            padding: '18px 20px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'operational' ? '0 0 16px rgba(239,68,68,0.2)' : 'none'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              🔥 Troubles Operativos (Activos)
            </span>
            <Flame size={18} color="#FF6B35" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8 }}>
            {counts.operational_trouble_count.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Slots en mesa de psicólogas marcados como rechazo
          </div>
        </div>
      </div>

      {/* BARRA DE TABS Y FILTROS */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        padding: '14px 18px',
        marginBottom: 20,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => handleTabChange('trouble_matches')}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: activeTab === 'trouble_matches' ? '1px solid #961500' : '1px solid transparent',
              background: activeTab === 'trouble_matches' ? '#961500' : 'transparent',
              color: activeTab === 'trouble_matches' ? '#fff' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <HeartCrack size={14} /> Parejas en Trouble ({counts.trouble_matches_count})
          </button>
          <button
            onClick={() => handleTabChange('difficult_clients')}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: activeTab === 'difficult_clients' ? '1px solid #F59E0B' : '1px solid transparent',
              background: activeTab === 'difficult_clients' ? '#F59E0B' : 'transparent',
              color: activeTab === 'difficult_clients' ? '#000' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <AlertTriangle size={14} /> Clientes Difíciles ({counts.difficult_clients_count})
          </button>
          <button
            onClick={() => handleTabChange('operational')}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: activeTab === 'operational' ? '1px solid #EF4444' : '1px solid transparent',
              background: activeTab === 'operational' ? '#EF4444' : 'transparent',
              color: activeTab === 'operational' ? '#fff' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Flame size={14} /> Rechazos en Mesa ({counts.operational_trouble_count})
          </button>
        </div>

        {/* Buscador y Dropdowns */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Input Buscador */}
          <div style={{ position: 'relative', width: 260 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar personas o notas..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none'
              }}
            />
            {search && (
              <X
                size={14}
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 10, top: 11, color: 'var(--text-muted)', cursor: 'pointer' }}
              />
            )}
          </div>

          {/* Filtro Psicóloga */}
          <select
            value={selectedPsyc}
            onChange={(e) => {
              setSelectedPsyc(e.target.value)
              setPage(1)
            }}
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: 8,
              padding: '7px 12px',
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            {PSYCHOLOGISTS.map(p => (
              <option key={p} value={p}>Psicóloga: {p}</option>
            ))}
          </select>

          {/* Filtro Ciudad */}
          <select
            value={selectedCity}
            onChange={(e) => {
              setSelectedCity(e.target.value)
              setPage(1)
            }}
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: 8,
              padding: '7px 12px',
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            {CITIES.map(c => (
              <option key={c} value={c}>Ciudad: {c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            Cargando registros clínicos...
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Info size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <div style={{ fontSize: 15, fontWeight: 600 }}>No se encontraron registros con los filtros aplicados</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Intenta cambiar el término de búsqueda o seleccionar otra psicóloga.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{
                  background: 'rgba(0,0,0,0.1)',
                  borderBottom: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  textAlign: 'left'
                }}>
                  {activeTab === 'trouble_matches' && (
                    <>
                      <th style={{ padding: '12px 16px', width: 60 }}>ID</th>
                      <th style={{ padding: '12px 16px' }}>Persona A</th>
                      <th style={{ padding: '12px 16px' }}>Persona B</th>
                      <th style={{ padding: '12px 16px' }}>Reportado Por</th>
                      <th style={{ padding: '12px 16px' }}>Motivo / Descarte</th>
                      <th style={{ padding: '12px 16px' }}>Notas Clínicas</th>
                      <th style={{ padding: '12px 16px', width: 100, textAlign: 'center' }}>Acciones</th>
                    </>
                  )}
                  {activeTab === 'difficult_clients' && (
                    <>
                      <th style={{ padding: '12px 16px', width: 50 }}>#</th>
                      <th style={{ padding: '12px 16px' }}>Cliente / Persona A</th>
                      <th style={{ padding: '12px 16px' }}>Ciudad</th>
                      <th style={{ padding: '12px 16px' }}>Psicóloga</th>
                      <th style={{ padding: '12px 16px' }}>Categoría</th>
                      <th style={{ padding: '12px 16px' }}>Observaciones Clínicas</th>
                      <th style={{ padding: '12px 16px', width: 100, textAlign: 'center' }}>Acciones</th>
                    </>
                  )}
                  {activeTab === 'operational' && (
                    <>
                      <th style={{ padding: '12px 16px', width: 60 }}>Slot</th>
                      <th style={{ padding: '12px 16px' }}>Persona A</th>
                      <th style={{ padding: '12px 16px' }}>Persona B</th>
                      <th style={{ padding: '12px 16px' }}>Psicóloga</th>
                      <th style={{ padding: '12px 16px' }}>Ciudad</th>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                      <th style={{ padding: '12px 16px' }}>Observaciones</th>
                      <th style={{ padding: '12px 16px', width: 120 }}>Actualizado</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  if (activeTab === 'trouble_matches') {
                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background 0.15s'
                        }}
                        className="table-row-hover"
                      >
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          #{item.id}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          <CrmPersonLink name={item.person_a} />
                        </td>
                        <td style={{ padding: '12px 16px', color: item.person_b ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {item.person_b ? <CrmPersonLink name={item.person_b} /> : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                          <span style={{
                            background: 'rgba(255,255,255,0.06)',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600
                          }}>
                            {item.reported_by || 'Staff'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {item.reason ? (
                            <span style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#EF4444',
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700
                            }}>
                              {item.reason}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Sin motivo especificado</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', maxWidth: 320 }}>
                          <div style={{
                            color: 'var(--text-primary)',
                            fontSize: 12,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer'
                          }}
                          onClick={() => setDetailModalItem(item)}
                          title="Clic para ver detalle"
                          >
                            {item.notes || '—'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              onClick={() => setEditingItem(item)}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 8px', borderRadius: 6 }}
                              title="Editar notas del caso"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => copyToClipboard(`${item.person_a} & ${item.person_b}: ${item.reason} - ${item.notes}`, item.id)}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 8px', borderRadius: 6 }}
                              title="Copiar resumen"
                            >
                              {copiedId === item.id ? <CheckCircle size={13} color="#10B981" /> : <Copy size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  if (activeTab === 'difficult_clients') {
                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background 0.15s'
                        }}
                        className="table-row-hover"
                      >
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {item.id}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          <CrmPersonLink name={item.client_name} />
                          {item.plan && (
                            <span style={{
                              marginLeft: 8,
                              fontSize: 10,
                              background: 'rgba(150,21,0,0.15)',
                              color: '#c41a00',
                              padding: '2px 6px',
                              borderRadius: 4
                            }}>
                              {item.plan}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                          <span style={{
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: '#3B82F6',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600
                          }}>
                            {item.city || 'Bogotá'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 600 }}>
                          <span style={{
                            background: 'rgba(168, 85, 247, 0.12)',
                            color: '#A855F7',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700
                          }}>
                            {item.interviewed_by || 'Sin asignar'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: item.category === 'Restricción Clínica' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                            color: item.category === 'Restricción Clínica' ? '#EF4444' : '#F59E0B',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700
                          }}>
                            {item.category}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', maxWidth: 360 }}>
                          <div
                            onClick={() => setDetailModalItem(item)}
                            style={{
                              color: 'var(--text-primary)',
                              fontSize: 13,
                              fontWeight: 500,
                              lineHeight: 1.4,
                              cursor: 'pointer'
                            }}
                            title="Clic para ver detalle completo"
                          >
                            {item.notes || '—'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              onClick={() => setEditingItem(item)}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 8px', borderRadius: 6 }}
                              title="Editar notas del cliente"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => copyToClipboard(`${item.client_name} (${item.interviewed_by}): ${item.notes}`, item.id)}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 8px', borderRadius: 6 }}
                              title="Copiar información"
                            >
                              {copiedId === item.id ? <CheckCircle size={13} color="#10B981" /> : <Copy size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  if (activeTab === 'operational') {
                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background 0.15s'
                        }}
                        className="table-row-hover"
                      >
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          Slot {item.slot_number || 1}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          <CrmPersonLink name={item.person_a} />
                        </td>
                        <td style={{ padding: '12px 16px', color: item.person_b ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {item.person_b ? <CrmPersonLink name={item.person_b} /> : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                          <span style={{
                            background: 'rgba(168, 85, 247, 0.12)',
                            color: '#A855F7',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700
                          }}>
                            {item.psychologist_name || 'Staff'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                          {item.city || 'Bogotá'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: '#FF6B35',
                            color: '#FFFFFF',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 800
                          }}>
                            {item.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', maxWidth: 300, color: 'var(--text-secondary)' }}>
                          {item.observations || 'Sin observaciones'}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 11 }}>
                          {item.updated_at ? item.updated_at.slice(0, 10) : '—'}
                        </td>
                      </tr>
                    )
                  }

                  return null
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINACIÓN */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Mostrando {items.length} de {total} registros en total
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                padding: '4px 8px',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                opacity: page <= 1 ? 0.4 : 1,
                color: 'var(--text-primary)'
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
              Pág. {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                padding: '4px 8px',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                opacity: page >= totalPages ? 0.4 : 1,
                color: 'var(--text-primary)'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DETALLE COMPLETO */}
      {detailModalItem && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 14,
            padding: 24,
            width: '100%',
            maxWidth: 500,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                Detalle del Caso
              </h3>
              <button
                onClick={() => setDetailModalItem(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Persona A / Cliente:
                </span>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                  {detailModalItem.client_name || detailModalItem.person_a}
                </div>
              </div>

              {detailModalItem.person_b && (
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Persona B:
                  </span>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 2 }}>
                    {detailModalItem.person_b}
                  </div>
                </div>
              )}

              {detailModalItem.reason && (
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Motivo / Restricción:
                  </span>
                  <div style={{ fontSize: 13, color: '#EF4444', fontWeight: 600, marginTop: 2 }}>
                    {detailModalItem.reason}
                  </div>
                </div>
              )}

              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Observaciones Clínicas:
                </span>
                <div style={{
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  marginTop: 4,
                  background: 'var(--bg-base)',
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap'
                }}>
                  {detailModalItem.notes || 'Sin observaciones registradas.'}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => {
                  setEditingItem(detailModalItem)
                  setDetailModalItem(null)
                }}
                className="btn btn-primary"
                style={{ fontSize: 12 }}
              >
                <Edit3 size={13} style={{ marginRight: 6 }} /> Editar Caso
              </button>
              <button
                onClick={() => setDetailModalItem(null)}
                className="btn btn-ghost"
                style={{ fontSize: 12 }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR NOTAS */}
      {editingItem && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 14,
            padding: 24,
            width: '100%',
            maxWidth: 520,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                Editar Caso: {editingItem.client_name || editingItem.person_a}
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Motivo o Restricción:
                </label>
                <input
                  type="text"
                  value={editingItem.reason || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, reason: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Observaciones Clínicas / Notas:
                </label>
                <textarea
                  rows={4}
                  value={editingItem.notes || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setEditingItem(null)}
                className="btn btn-ghost"
                style={{ fontSize: 13 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateNotes}
                className="btn btn-primary"
                style={{ fontSize: 13, background: '#961500', color: '#fff' }}
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR NUEVO CASO */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 14,
            padding: 24,
            width: '100%',
            maxWidth: 520,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                Registrar Nuevo Caso Trouble / Difícil
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Tipo de Registro:
                </label>
                <select
                  value={createForm.type}
                  onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13
                  }}
                >
                  <option value="trouble_match">💔 Pareja / Cita en Trouble (Fallo o Incompatibilidad)</option>
                  <option value="difficult_client">⚠️ Cliente Difícil (Restricción Clínica o Falta de Candidatos)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Persona A / Nombre del Cliente (*):
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Laura Gómez"
                  value={createForm.person_a}
                  onChange={(e) => setCreateForm({ ...createForm, person_a: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13
                  }}
                />
              </div>

              {createForm.type === 'trouble_match' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Persona B (Pareja con la que falló):
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Juan Carlos Pérez"
                    value={createForm.person_b}
                    onChange={(e) => setCreateForm({ ...createForm, person_b: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      color: 'var(--text-primary)',
                      fontSize: 13
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Psicóloga Responsable:
                  </label>
                  <select
                    value={createForm.psychologist}
                    onChange={(e) => setCreateForm({ ...createForm, psychologist: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      color: 'var(--text-primary)',
                      fontSize: 13
                    }}
                  >
                    <option value="">Seleccionar...</option>
                    {PSYCHOLOGISTS.filter(p => p !== 'Todas').map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Ciudad:
                  </label>
                  <select
                    value={createForm.city}
                    onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      color: 'var(--text-primary)',
                      fontSize: 13
                    }}
                  >
                    {CITIES.filter(c => c !== 'Todas').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Motivo Principal o Criterio Bloqueante:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Incompatibilidad de edad / Falta de candidatos en Cali"
                  value={createForm.reason}
                  onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Observaciones Clínicas Detalladas:
                </label>
                <textarea
                  rows={3}
                  placeholder="Anotaciones sobre requerimientos especiales, hijos, rangos de edad, estrato..."
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-ghost"
                  style={{ fontSize: 13 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn btn-primary"
                  style={{ fontSize: 13, background: '#961500', color: '#fff' }}
                >
                  {creating ? 'Guardando...' : 'Registrar Caso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
