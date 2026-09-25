import React, { useState } from 'react'
import { UserPlus, Calendar, Crown, X, CheckCircle, ExternalLink, Copy } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

const CITIES = [
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga',
  'Pereira', 'Cartagena', 'Manizales', 'Santa Marta', 'Miami', 'Madrid'
]

const VIP_PLANS = [
  'VIP 195k',
  'VIP 295k',
  'VIP Oro',
  'Premium 150k',
  'Matchmaking Experience'
]

const NON_VIP_PLANS = [
  'Estándar 65k (2 citas)',
  'Estándar 65k (1 cita)',
  'Estándar Plus 98k',
  'Básico 40k'
]

export default function NuevoClienteExpresModal({ onClose, onSuccess, initialMode = 'vip' }) {
  const { token } = useAuth()
  const [mode, setMode] = useState(initialMode) // 'vip' | 'novip'
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('Bogotá')
  const [gender, setGender] = useState('Hombre')
  const [orientation, setOrientation] = useState('hetero')
  const [planTier, setPlanTier] = useState(initialMode === 'vip' ? 'VIP 195k' : 'Estándar 65k (2 citas)')
  const [initialNotes, setInitialNotes] = useState('')
  const [createSlots, setCreateSlots] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)

  const CALENDLY_URL = 'https://calendly.com/maria-salinas-dailylover/blind-dates-1-1'

  const handleModeChange = (newMode) => {
    setMode(newMode)
    if (newMode === 'vip') {
      setPlanTier('VIP 195k')
      setCreateSlots(true)
    } else {
      setPlanTier('Estándar 65k (2 citas)')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`${API}/api/v1/admin/users/quick-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          phone,
          city,
          gender,
          orientation,
          plan_tier: planTier,
          responsable: 'SIN_ASIGNAR',
          initial_notes: initialNotes,
          create_slots: createSlots
        })
      })

      const data = await res.json()
      if (res.ok) {
        if (onSuccess) onSuccess(data.message || 'Cliente registrado exitosamente')
        onClose()
      } else {
        setError(data.detail || 'Error al registrar cliente')
      }
    } catch (err) {
      setError('Error de conexión con el servidor')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyCalendly = () => {
    navigator.clipboard.writeText(CALENDLY_URL)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  const currentPlans = mode === 'vip' ? VIP_PLANS : NON_VIP_PLANS

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 580, maxWidth: '95vw', padding: 24, borderRadius: 14, maxHeight: '92vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              background: mode === 'vip' ? 'rgba(255, 215, 0, 0.15)' : 'rgba(59, 130, 246, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: mode === 'vip' ? '#FFD700' : '#3B82F6',
              border: `1px solid ${mode === 'vip' ? 'rgba(255, 215, 0, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`
            }}>
              {mode === 'vip' ? <Crown size={22} /> : <Calendar size={22} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                {mode === 'vip' ? '👑 Registro de Cliente VIP' : '📅 Cliente No-VIP (Agendar Cita)'}
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {mode === 'vip'
                  ? 'Alta directa e inmediata en sistema con slot prioritario de búsqueda'
                  : 'Los clientes No-VIP deben agendar cita 1-1 en Calendly'}
              </p>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '4px 8px', fontSize: 16 }}>
            ✕
          </button>
        </div>

        {/* Segmented Switcher: VIP vs No-VIP */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
          background: 'var(--bg-base)',
          padding: 4,
          borderRadius: 10,
          border: '1px solid var(--border-color)',
          marginBottom: 16
        }}>
          <button
            type="button"
            onClick={() => handleModeChange('vip')}
            style={{
              padding: '9px 12px',
              borderRadius: 8,
              border: 'none',
              background: mode === 'vip' ? 'rgba(255, 215, 0, 0.18)' : 'transparent',
              color: mode === 'vip' ? '#FFD700' : 'var(--text-secondary)',
              fontWeight: mode === 'vip' ? 800 : 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.15s ease'
            }}
          >
            <Crown size={16} /> 👑 Cliente VIP (Registrar)
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('novip')}
            style={{
              padding: '9px 12px',
              borderRadius: 8,
              border: 'none',
              background: mode === 'novip' ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
              color: mode === 'novip' ? '#60A5FA' : 'var(--text-secondary)',
              fontWeight: mode === 'novip' ? 800 : 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.15s ease'
            }}
          >
            <Calendar size={16} /> 📅 No-VIP (Agendar Cita)
          </button>
        </div>

        {/* SECCIÓN ESPECIAL NO-VIP: AGENDAR CITA EN CALENDLY */}
        {mode === 'novip' && (
          <div style={{
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: 10,
            padding: 14,
            marginBottom: 16
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#60A5FA', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              📅 Flujo No-VIP: Agendamiento de Cita Requerido
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: 1.4 }}>
              Los clientes estándar / no-VIP deben ingresar a Calendly y seleccionar su fecha/hora disponible para la cita de bienvenida.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a
                href={CALENDLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#2563EB',
                  color: '#fff',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <ExternalLink size={14} /> Abrir Calendly para Agendar Cita
              </a>
              <button
                type="button"
                onClick={handleCopyCalendly}
                style={{
                  background: copiedLink ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-card)',
                  border: '1px solid ' + (copiedLink ? '#10B981' : 'var(--border-color)'),
                  color: copiedLink ? '#10B981' : 'var(--text-primary)',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {copiedLink ? <CheckCircle size={14} /> : <Copy size={14} />}
                {copiedLink ? '¡Enlace Copiado!' : 'Copiar Link Calendly'}
              </button>
            </div>
          </div>
        )}

        {/* SECCIÓN ESPECIAL VIP: BADGE INFORMATIVO */}
        {mode === 'vip' && (
          <div style={{
            background: 'rgba(255, 215, 0, 0.08)',
            border: '1px solid rgba(255, 215, 0, 0.25)',
            borderRadius: 10,
            padding: 12,
            marginBottom: 16,
            fontSize: 12,
            color: '#FFD700',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span>👑 <strong>Membresía VIP:</strong> Se registra directamente con código oficial DL y entra a la mesa de trabajo de la psicóloga con prioridad alta.</span>
          </div>
        )}

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
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Nombre Completo del Cliente *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Edwin Leonardo Peña"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8,
                background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                color: 'var(--text-primary)', fontSize: 13, outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                WhatsApp / Celular *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: 3101234567"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Ciudad
              </label>
              <select
                value={city}
                onChange={e => setCity(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              >
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Género
              </label>
              <select
                value={gender}
                onChange={e => setGender(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              >
                <option value="Hombre">Hombre</option>
                <option value="Mujer">Mujer</option>
                <option value="No binario">No binario</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Orientación (Búsqueda)
              </label>
              <select
                value={orientation}
                onChange={e => setOrientation(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              >
                <option value="hetero">Heterosexual</option>
                <option value="gay">Gay</option>
                <option value="lesb">Lesbiana</option>
                <option value="bi">Bisexual</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Plan Contratado
            </label>
            <select
              value={planTier}
              onChange={e => setPlanTier(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8,
                background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                color: 'var(--text-primary)', fontSize: 13, outline: 'none'
              }}
            >
              {currentPlans.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Nota Inicial / Origen del Cliente (Opcional):
            </label>
            <input
              type="text"
              placeholder="Ej: Pago verificado vía Nequi, interesado en perfiles profesionales..."
              value={initialNotes}
              onChange={e => setInitialNotes(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                color: 'var(--text-primary)', fontSize: 12, outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-base)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <input
              type="checkbox"
              id="slots_chk"
              checked={createSlots}
              onChange={e => setCreateSlots(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
            />
            <label htmlFor="slots_chk" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
              ⚡ Habilitar búsqueda inmediata (Crear slot en mesa de matches de la psicóloga)
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                padding: '9px 20px',
                fontSize: 13,
                fontWeight: 700,
                background: mode === 'vip' ? 'linear-gradient(135deg, #B8860B, #FFD700)' : 'var(--color-primary)',
                color: mode === 'vip' ? '#000' : '#fff'
              }}
              disabled={submitting}
            >
              {submitting
                ? 'Registrando...'
                : (mode === 'vip' ? '👑 Registrar Cliente VIP' : '📅 Registrar Cliente Agendado')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
