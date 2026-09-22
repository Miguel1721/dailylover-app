import React, { useState } from 'react'
import { X, CheckCircle, Copy, Check, MessageSquare, ExternalLink, ShieldCheck, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia')))
  ? window.location.origin 
  : 'https://daily-lover.agentesia.cloud'

const CITIES = [
  'Bogotá', 'Medellín', 'Cali', 'Miami',
  'Pereira (Eje Cafetero)', 'Manizales (Eje Cafetero)', 'Armenia (Eje Cafetero)', 'Dosquebradas (Eje Cafetero)',
  'Barranquilla', 'Bucaramanga', 'Cartagena', 'Madrid', 'Otras'
]

const PLANS = [
  { name: 'Estándar 65k (2 citas)', price: 65000 },
  { name: 'Estándar 65k (1 cita)', price: 65000 },
  { name: 'Básico 40k', price: 40000 },
  { name: 'Estándar Plus 98k', price: 98000 },
  { name: 'Premium 150k', price: 150000 },
  { name: 'VIP 195k', price: 195000 },
  { name: 'VIP 295k', price: 295000 }
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

export default function NequiPaymentModal({ isOpen, onClose, onSuccess }) {
  const { token } = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('Bogotá')
  const [gender, setGender] = useState('Mujer')
  const [planTier, setPlanTier] = useState('Estándar 65k (2 citas)')
  const [amountCop, setAmountCop] = useState(65000)
  const [reference, setReference] = useState('')
  const [responsable, setResponsable] = useState('SILVI')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successData, setSuccessData] = useState(null)
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handlePlanChange = (e) => {
    const selected = e.target.value
    setPlanTier(selected)
    const found = PLANS.find(p => p.name === selected)
    if (found) setAmountCop(found.price)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    // Limpiar ciudad si tiene anotación
    const cleanCity = city.includes('(') ? city.split('(')[0].trim() : city

    try {
      const res = await fetch(`${API}/api/v1/admin/finance/nequi-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          city: cleanCity,
          gender,
          plan_tier: planTier,
          amount_cop: parseFloat(amountCop),
          payment_reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
          responsable
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Error al registrar el pago')
      }

      setSuccessData(data)
      if (onSuccess) onSuccess(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopy = () => {
    if (!successData?.whatsapp_message) return
    navigator.clipboard.writeText(successData.whatsapp_message)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const handleResetAndClose = () => {
    setName('')
    setPhone('')
    setCity('Bogotá')
    setGender('Mujer')
    setPlanTier('Estándar 65k (2 citas)')
    setAmountCop(65000)
    setReference('')
    setNotes('')
    setSuccessData(null)
    setError('')
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: 16
    }}>
      <div style={{
        background: 'var(--bg-card, #1A1A1A)',
        borderRadius: 14,
        border: '1px solid var(--border-color, #333)',
        width: '100%',
        maxWidth: 540,
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        color: 'var(--text-primary, #FFF)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(235, 0, 141, 0.15) 0%, rgba(30, 30, 40, 0.4) 100%)',
          borderBottom: '1px solid var(--border-color, #333)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: '#EB008D', color: '#FFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 16
            }}>
              N
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                Registrar Pago Nequi / Instagram
              </h2>
              <p style={{ fontSize: 11, color: 'var(--text-secondary, #999)', margin: 0 }}>
                Registro express en 30s para Nina y equipo comercial
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            style={{
              background: 'transparent', border: 'none', color: '#999',
              cursor: 'pointer', padding: 4, borderRadius: 6
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 14,
              background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#F87171', fontSize: 12
            }}>
              ⚠️ {error}
            </div>
          )}

          {!successData ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#DDD' }}>
                    Nombre del Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Camila Restrepo"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 6,
                      background: 'var(--bg-base, #111)', border: '1px solid var(--border-color, #444)',
                      color: '#FFF', fontSize: 13
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#DDD' }}>
                    Celular (WhatsApp) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: 3101234567"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 6,
                      background: 'var(--bg-base, #111)', border: '1px solid var(--border-color, #444)',
                      color: '#FFF', fontSize: 13
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#DDD' }}>
                    Ciudad
                  </label>
                  <select
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 6,
                      background: 'var(--bg-base, #111)', border: '1px solid var(--border-color, #444)',
                      color: '#FFF', fontSize: 12
                    }}
                  >
                    {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#DDD' }}>
                    Género
                  </label>
                  <select
                    value={gender}
                    onChange={e => setGender(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 6,
                      background: 'var(--bg-base, #111)', border: '1px solid var(--border-color, #444)',
                      color: '#FFF', fontSize: 12
                    }}
                  >
                    <option value="Mujer">Mujer</option>
                    <option value="Hombre">Hombre</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#DDD' }}>
                    Psicóloga
                  </label>
                  <select
                    value={responsable}
                    onChange={e => setResponsable(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 6,
                      background: 'var(--bg-base, #111)', border: '1px solid var(--border-color, #444)',
                      color: '#FFF', fontSize: 12
                    }}
                  >
                    {PSYCHOLOGISTS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#DDD' }}>
                    Plan Adquirido
                  </label>
                  <select
                    value={planTier}
                    onChange={handlePlanChange}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 6,
                      background: 'var(--bg-base, #111)', border: '1px solid var(--border-color, #444)',
                      color: '#FFF', fontSize: 12
                    }}
                  >
                    {PLANS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#DDD' }}>
                    Monto COP *
                  </label>
                  <input
                    type="number"
                    required
                    value={amountCop}
                    onChange={e => setAmountCop(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 6,
                      background: 'var(--bg-base, #111)', border: '1px solid var(--border-color, #444)',
                      color: '#FFF', fontSize: 13, fontWeight: 700
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#DDD' }}>
                    # Comprobante / Ref Nequi (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: M12345678"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 6,
                      background: 'var(--bg-base, #111)', border: '1px solid var(--border-color, #444)',
                      color: '#FFF', fontSize: 13
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#DDD' }}>
                    Notas de Instagram / Origen (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Chat DM Nina @camila_r"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 6,
                      background: 'var(--bg-base, #111)', border: '1px solid var(--border-color, #444)',
                      color: '#FFF', fontSize: 13
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  style={{
                    padding: '9px 16px', borderRadius: 7, border: '1px solid var(--border-color, #444)',
                    background: 'transparent', color: '#BBB', fontSize: 12, cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '9px 20px', borderRadius: 7, border: 'none',
                    background: 'linear-gradient(135deg, #EB008D 0%, #B8324F 100%)',
                    color: '#FFF', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  {submitting ? 'Registrando...' : '✓ Registrar Pago Nequi'}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                textAlign: 'center', padding: '16px 12px',
                background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: 10
              }}>
                <CheckCircle size={36} color="#10B981" style={{ margin: '0 auto 8px' }} />
                <h3 style={{ margin: 0, fontSize: 16, color: '#10B981', fontWeight: 700 }}>
                  ¡Pago Registrado Exitosamente!
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#DDD' }}>
                  Cliente: <strong>{successData.name}</strong> • Código: <span style={{ color: '#F59E0B', fontWeight: 800 }}>{successData.client_code}</span>
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#999' }}>
                  Monto: ${successData.amount_cop?.toLocaleString()} COP • Nequi
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#DDD' }}>
                  Mensaje listo para enviar por WhatsApp o Instagram:
                </label>
                <div style={{
                  background: '#111', border: '1px solid #333', borderRadius: 8,
                  padding: 12, fontSize: 12, lineHeight: 1.5, color: '#EEE',
                  whiteSpace: 'pre-wrap', maxHeight: 150, overflowY: 'auto'
                }}>
                  {successData.whatsapp_message}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{
                    padding: '10px 14px', borderRadius: 8, border: '1px solid #444',
                    background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.06)',
                    color: copied ? '#10B981' : '#FFF', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                  }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? '¡Copiado al Portapapeles!' : 'Copiar Mensaje'}
                </button>

                {successData.whatsapp_url ? (
                  <button
                    type="button"
                    onClick={() => window.open(successData.whatsapp_url, '_blank')}
                    style={{
                      padding: '10px 14px', borderRadius: 8, border: 'none',
                      background: '#25D366', color: '#FFF', fontSize: 13, fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}
                  >
                    <MessageSquare size={16} />
                    Abrir WhatsApp Web
                  </button>
                ) : null}
              </div>

              <div style={{ textAlign: 'center', marginTop: 4 }}>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  style={{
                    background: 'transparent', border: 'none', color: '#888',
                    fontSize: 12, cursor: 'pointer', textDecoration: 'underline'
                  }}
                >
                  Cerrar y registrar otro cliente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
