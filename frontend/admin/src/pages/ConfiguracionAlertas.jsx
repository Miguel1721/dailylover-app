import React, { useState, useEffect, useCallback } from 'react'
import {
  Bell, BellRing, Settings, Shield, Plus, Edit2, Trash2, CheckCircle,
  AlertTriangle, RefreshCw, Smartphone, Volume2, Sparkles, MessageCircle,
  Flame, Heart, Headphones, ArrowRight, ExternalLink, X, Save, RotateCcw, Filter
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia')))
  ? window.location.origin
  : 'https://daily-lover.agentesia.cloud'

const CATEGORIES = [
  'Todas',
  'Matchmaking Clínico',
  'Seguimiento & Prioridades',
  'Clientes & Facturación',
  'Citas & Asistencia',
  'Servicio al Cliente',
  'Recordatorios para Clientes'
]

const ROLE_OPTIONS = [
  'Psicólogas',
  'Psicólogas & Dirección',
  'María Paula (MPS)',
  'María Paula (Supervisión)',
  'Servicio al Cliente (CS)',
  'CS & Dirección',
  'Psicóloga Asignada',
  'Clientes de la Cita',
  'Todos los Roles'
]

const URGENCY_COLORS = {
  normal: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', border: 'rgba(59, 130, 246, 0.3)' },
  high: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.3)' },
  urgent: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.3)' }
}

export default function ConfiguracionAlertas() {
  const { token, user } = useAuth()
  const { simulateAlert, triggerToast } = useNotifications()

  const [rules, setRules] = useState([])
  const [metrics, setMetrics] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [activeCategory, setActiveCategory] = useState('Todas')
  const [searchQuery, setSearchQuery] = useState('')
  const [toastMsg, setToastMsg] = useState('')

  // Modal de edición / creación
  const [modalMode, setModalMode] = useState(null) // 'edit' | 'create' | null
  const [formData, setFormData] = useState({
    id: null,
    code: '',
    title: '',
    category: 'Seguimiento & Prioridades',
    target_role: 'Psicólogas',
    trigger_event: '',
    channels: ['push', 'campana', 'toast'],
    urgency: 'high',
    target_link: '/matchmaking/mis-matches',
    is_active: true,
    threshold_days: 0,
    message_template: ''
  })

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/v1/admin/alerts/config`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        setRules(data.rules || [])
        setMetrics(data.metrics || {})
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3500)
  }

  // Toggle Activar / Desactivar
  const handleToggleActive = async (rule) => {
    setSavingId(rule.id)
    const nextState = !rule.is_active
    try {
      const res = await fetch(`${API}/api/v1/admin/alerts/config/${rule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: nextState })
      })
      if (res.ok) {
        setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: nextState } : r))
        showToast(`✓ Alerta "${rule.title}" ${nextState ? 'activada' : 'desactivada'}`)
      }
    } catch (e) {
      alert('Error al actualizar estado de la alerta')
    } finally {
      setSavingId(null)
    }
  }

  // Guardar Cambios en Modal
  const handleSaveForm = async (e) => {
    e.preventDefault()
    setSavingId('modal')
    try {
      if (modalMode === 'edit') {
        const res = await fetch(`${API}/api/v1/admin/alerts/config/${formData.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        })
        if (res.ok) {
          showToast('✓ Regla de alerta actualizada correctamente')
          setModalMode(null)
          fetchRules()
        }
      } else {
        const res = await fetch(`${API}/api/v1/admin/alerts/config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        })
        if (res.ok) {
          showToast('✓ Nueva regla de alerta creada con éxito')
          setModalMode(null)
          fetchRules()
        }
      }
    } catch (e) {
      alert('Error al guardar configuración')
    } finally {
      setSavingId(null)
    }
  }

  // Eliminar Regla
  const handleDeleteRule = async (rule) => {
    if (!window.confirm(`¿Estás seguro de eliminar la alerta "${rule.title}"?`)) return
    try {
      const res = await fetch(`${API}/api/v1/admin/alerts/config/${rule.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        showToast('✓ Regla eliminada')
        fetchRules()
      }
    } catch (e) {
      alert('Error al eliminar')
    }
  }

  // Restablecer por defecto
  const handleResetDefaults = async () => {
    if (!window.confirm('¿Deseas restablecer todas las alertas a la configuración oficial de Daily Lover?')) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/v1/admin/alerts/config/reset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        showToast('✓ Alertas restablecidas a la configuración oficial')
        fetchRules()
      }
    } catch (e) {
      alert('Error al restablecer')
    } finally {
      setLoading(false)
    }
  }

  // Probar simulación
  const handleTestSimulation = (code) => {
    if (code === 'INACTIVITY_15D') simulateAlert('INACTIVITY_15D')
    else if (code === 'VIP_650K') simulateAlert('VIP_650K')
    else if (code === 'MATCH_APROBADO') simulateAlert('APPROVAL')
    else if (code === 'NO_SHOW') simulateAlert('NO_SHOW')
    else if (code === 'TROUBLE_REPORT') simulateAlert('TROUBLE')
    else if (code === 'CS_NOVEDAD') simulateAlert('CS_NOVEDAD')
    else simulateAlert('STATUS_CHANGE')
  }

  // Filtros
  const filteredRules = rules.filter(r => {
    const matchesCategory = activeCategory === 'Todas' || r.category === activeCategory
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q ||
      r.title.toLowerCase().includes(q) ||
      r.target_role.toLowerCase().includes(q) ||
      r.trigger_event.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q)
    return matchesCategory && matchesSearch
  })

  return (
    <div className="content-area" style={{ padding: '24px 32px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              background: 'rgba(150, 21, 0, 0.15)',
              padding: 8,
              borderRadius: 10,
              color: 'var(--color-primary)'
            }}>
              <BellRing size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Configuración de Alertas & Notificaciones
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                Administra qué notificaciones se disparan, quién las recibe, por qué canales y a dónde dirigen.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={handleResetDefaults}
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '8px 14px' }}
            title="Restablecer reglas predeterminadas oficiales"
          >
            <RotateCcw size={14} /> Restablecer Oficiales
          </button>

          <button
            onClick={() => {
              setFormData({
                id: null,
                code: `ALERTA_${Date.now().toString().slice(-4)}`,
                title: '',
                category: 'Seguimiento & Prioridades',
                target_role: 'Psicólogas',
                trigger_event: '',
                channels: ['push', 'campana', 'toast'],
                urgency: 'high',
                target_link: '/matchmaking/mis-matches',
                is_active: true,
                threshold_days: 0,
                message_template: ''
              })
              setModalMode('create')
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '8px 16px' }}
          >
            <Plus size={15} /> + Nueva Regla de Alerta
          </button>
        </div>
      </div>

      {toastMsg && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10B981',
          color: '#10B981',
          padding: '10px 16px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 20
        }}>
          {toastMsg}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        <div className="card" style={{ padding: 18, borderLeft: '4px solid #10B981' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
            Alertas Activas
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
            {metrics.active_rules || 0} / {metrics.total_rules || 0}
          </div>
          <div style={{ fontSize: 11, color: '#10B981', marginTop: 4 }}>
            ✓ Monitoreo en tiempo real
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: '4px solid #A855F7' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
            Para Psicólogas
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#A855F7', marginTop: 4 }}>
            {metrics.for_psychologists || 0}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Inactividad 15d, Trouble, CS
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: '4px solid #10B981' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
            Para María Paula (Dirección)
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#10B981', marginTop: 4 }}>
            {metrics.for_maria || 0}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Matchmaking Service, Matches Hechos, Prioritarios
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: '4px solid #3B82F6' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
            Para Servicio al Cliente
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#3B82F6', marginTop: 4 }}>
            {metrics.for_cs || 0}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Aprobados para agendar, No-Shows
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: '4px solid #EC4899' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
            Para Clientes (Automáticas)
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#EC4899', marginTop: 4 }}>
            {metrics.for_clients || 0}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Recordatorios 24h y Día del Date
          </div>
        </div>
      </div>

      {/* Categorías y Buscador */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="btn btn-ghost btn-sm"
              style={{
                fontSize: 12,
                borderRadius: 8,
                background: activeCategory === cat ? 'var(--color-primary)' : 'var(--bg-card)',
                color: activeCategory === cat ? '#fff' : 'var(--text-secondary)',
                borderColor: activeCategory === cat ? 'var(--color-primary)' : 'var(--border-color)',
                fontWeight: activeCategory === cat ? 700 : 500
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ width: 260 }}>
          <input
            type="text"
            placeholder="Buscar alerta o rol..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 12px',
              borderRadius: 8,
              background: 'var(--bg-base)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: 12
            }}
          />
        </div>
      </div>

      {/* Grid de Reglas de Alerta */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="spin" />
          <p style={{ marginTop: 10, fontSize: 13 }}>Cargando configuración de alertas...</p>
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No se encontraron alertas para los filtros aplicados.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredRules.map(rule => {
            const urg = URGENCY_COLORS[rule.urgency] || URGENCY_COLORS.high
            const isSaving = savingId === rule.id

            return (
              <div
                key={rule.id}
                className="card"
                style={{
                  padding: '16px 20px',
                  borderLeft: `4px solid ${rule.is_active ? urg.text : 'var(--text-muted)'}`,
                  opacity: rule.is_active ? 1 : 0.6,
                  transition: 'all 0.2s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16
                }}
              >
                {/* Info Principal */}
                <div style={{ flex: 1, minWidth: 280 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {rule.title}
                    </span>

                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.06)',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.04em'
                    }}>
                      {rule.code}
                    </span>

                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: urg.bg,
                      color: urg.text,
                      border: `1px solid ${urg.border}`
                    }}>
                      {rule.urgency.toUpperCase()}
                    </span>

                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: 'rgba(150, 21, 0, 0.1)',
                      color: 'var(--color-primary-light)',
                      border: '1px solid rgba(150, 21, 0, 0.2)'
                    }}>
                      {rule.category}
                    </span>
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.4 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Disparador:</strong> {rule.trigger_event}
                    {rule.threshold_days > 0 && (
                      <span style={{ color: '#F59E0B', marginLeft: 6, fontWeight: 700 }}>
                        (Umbral: &gt;={rule.threshold_days} días)
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <div>
                      <strong>Para quién:</strong>{' '}
                      <span style={{ color: '#A855F7', fontWeight: 700 }}>{rule.target_role}</span>
                    </div>

                    <div>
                      <strong>Canales:</strong>{' '}
                      <span style={{ color: 'var(--text-primary)' }}>
                        {rule.channels.join(' · ')}
                      </span>
                    </div>

                    <div>
                      <strong>Lleva a:</strong>{' '}
                      <code style={{ fontSize: 11, background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4, color: '#3B82F6' }}>
                        {rule.target_link}
                      </code>
                    </div>
                  </div>
                </div>

                {/* Acciones Rápidas */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  {/* Botón Simular Prueba */}
                  <button
                    onClick={() => handleTestSimulation(rule.code)}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: '#10B981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                    title="Simular disparo en vivo"
                  >
                    <Sparkles size={13} /> Probar
                  </button>

                  {/* Botón Editar */}
                  <button
                    onClick={() => {
                      setFormData({ ...rule })
                      setModalMode('edit')
                    }}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Edit2 size={13} /> Editar
                  </button>

                  {/* Switch Activo/Inactivo */}
                  <button
                    disabled={isSaving}
                    onClick={() => handleToggleActive(rule)}
                    style={{
                      background: rule.is_active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                      color: rule.is_active ? '#10B981' : '#EF4444',
                      border: `1px solid ${rule.is_active ? '#10B981' : '#EF4444'}`,
                      borderRadius: 20,
                      padding: '5px 14px',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: rule.is_active ? '#10B981' : '#EF4444'
                    }} />
                    {rule.is_active ? 'ACTIVA' : 'INACTIVA'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL DE EDICIÓN / CREACIÓN */}
      {modalMode && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 600, width: '90%' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={18} color="var(--color-primary)" />
                {modalMode === 'edit' ? `Configurar Alerta: ${formData.title}` : 'Crear Nueva Regla de Alerta'}
              </h2>
              <button onClick={() => setModalMode(null)} className="modal-close">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveForm}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Nombre de la Alerta *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ej: Inactividad Crítica 25d"
                  />
                </div>

                <div className="form-group">
                  <label>Código Identificador (Único) *</label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === 'edit'}
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    placeholder="EJ: ALERTA_CRITICA"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Categoría</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                  >
                    {CATEGORIES.filter(c => c !== 'Todas').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>¿Para quién? (Destinatarios) *</label>
                  <select
                    value={formData.target_role}
                    onChange={e => setFormData({ ...formData, target_role: e.target.value })}
                  >
                    {ROLE_OPTIONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Disparador / Cuándo se genera la alerta *</label>
                <input
                  type="text"
                  required
                  value={formData.trigger_event}
                  onChange={e => setFormData({ ...formData, trigger_event: e.target.value })}
                  placeholder="Ej: Cuando un cliente supera los 15 días sin cita..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Nivel de Urgencia</label>
                  <select
                    value={formData.urgency}
                    onChange={e => setFormData({ ...formData, urgency: e.target.value })}
                  >
                    <option value="normal">Normal (Informativa)</option>
                    <option value="high">Alta (Requiere Atención)</option>
                    <option value="urgent">Urgente (Crítica / Inmediata)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Umbral de Días (Opcional)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.threshold_days}
                    onChange={e => setFormData({ ...formData, threshold_days: parseInt(e.target.value) || 0 })}
                    placeholder="Ej: 15"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Enlace de Acción Directa (A dónde lleva al hacer clic) *</label>
                <input
                  type="text"
                  required
                  value={formData.target_link}
                  onChange={e => setFormData({ ...formData, target_link: e.target.value })}
                  placeholder="/matchmaking/mis-matches?filter=prioritarios..."
                />
              </div>

              <div className="form-group">
                <label>Plantilla del Mensaje</label>
                <textarea
                  rows="2"
                  value={formData.message_template}
                  onChange={e => setFormData({ ...formData, message_template: e.target.value })}
                  placeholder="Texto base que aparecerá en la notificación..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                {modalMode === 'edit' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteRule(formData)}
                    className="btn btn-ghost btn-sm"
                    style={{ color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.4)', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Trash2 size={13} /> Eliminar
                  </button>
                )}

                <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="btn btn-ghost"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingId === 'modal'}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Save size={15} /> Guardar Configuración
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
