import React, { useState } from 'react'
import { UserPlus, X, CheckCircle, Sparkles } from 'lucide-react'
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

const PSYCHOLOGISTS = [
  { id: 'SILVI', label: '👩‍⚕️ Silvi / Silvana' },
  { id: 'STEFFY', label: '👩‍⚕️ Steffy / Estefania' },
  { id: 'MAPE', label: '👩‍⚕️ Mape / María Paula' },
  { id: 'JENN', label: '👩‍⚕️ Jenn / Jennifer' },
  { id: 'ANA', label: '👩‍⚕️ Ana Tolosa' },
  { id: 'MANU', label: '👩‍⚕️ Manu / Manuela' },
  { id: 'SOFI', label: '👩‍⚕️ Sofi / Sofia' },
  { id: 'ALEJA', label: '👩‍⚕️ Aleja' },
  { id: 'ISA', label: '👩‍⚕️ Isa' },
  { id: 'PIA', label: '👩‍⚕️ Pia' }
]

export default function NuevoClienteExpresModal({ onClose, onSuccess }) {
  const { token } = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('Bogotá')
  const [gender, setGender] = useState('Hombre')
  const [orientation, setOrientation] = useState('hetero')
  const [planTier, setPlanTier] = useState('Estándar 65k (2 citas)')
  const [responsable, setResponsable] = useState('SILVI')
  const [initialNotes, setInitialNotes] = useState('')
  const [createSlots, setCreateSlots] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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
          responsable,
          initial_notes: initialNotes,
          create_slots: createSlots
        })
      })

      const data = await res.json()
      if (res.ok) {
        if (onSuccess) onSuccess(data.message || 'Cliente creado exitosamente')
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
              background: 'rgba(150, 21, 0, 0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-primary)'
            }}>
              <UserPlus size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                Alta Rápida de Cliente Exprés
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Creación en 30 segundos con código único DL y slots automáticos
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
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Nombre Completo *
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
                {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Psicóloga Responsable
              </label>
              <select
                value={responsable}
                onChange={e => setResponsable(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              >
                {PSYCHOLOGISTS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Nota Inicial / Origen del Cliente (Opcional):
            </label>
            <input
              type="text"
              placeholder="Ej: Llegó por Instagram, pago confirmado vía Nequi..."
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
              style={{ padding: '9px 20px', fontSize: 13, fontWeight: 700 }}
              disabled={submitting}
            >
              {submitting ? 'Creando...' : '➕ Crear Cliente Exprés'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
