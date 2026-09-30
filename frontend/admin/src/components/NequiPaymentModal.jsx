import React, { useState, useRef } from 'react'
import { X, CheckCircle, Copy, Check, MessageSquare, ExternalLink, Upload, Image as ImageIcon, Trash2, Calendar } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia')))
  ? window.location.origin 
  : 'https://daily-lover.agentesia.cloud'

const CALENDLY_URL = 'https://calendly.com/maria-salinas-dailylover/blind-dates-1-1'

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

export default function NequiPaymentModal({ isOpen, onClose, onSuccess }) {
  const { token } = useAuth()
  const fileInputRef = useRef(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('Bogotá')
  const [gender, setGender] = useState('Mujer')
  const [planTier, setPlanTier] = useState('Estándar 65k (2 citas)')
  const [amountCop, setAmountCop] = useState(65000)

  // Carga de Comprobante (Imagen)
  const [receiptBase64, setReceiptBase64] = useState('')
  const [receiptPreview, setReceiptPreview] = useState('')
  const [receiptFileName, setReceiptFileName] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successData, setSuccessData] = useState(null)
  const [copied, setCopied] = useState(false)
  const [copiedCalendly, setCopiedCalendly] = useState(false)

  if (!isOpen) return null

  const handlePlanChange = (e) => {
    const selected = e.target.value
    setPlanTier(selected)
    const found = PLANS.find(p => p.name === selected)
    if (found) setAmountCop(found.price)
  }

  const handleImageSelect = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona una imagen válida (JPG, PNG o WebP).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen no puede pesar más de 10 MB.')
      return
    }

    setError('')
    setReceiptFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const b64 = e.target.result
      setReceiptBase64(b64)
      setReceiptPreview(b64)
    }
    reader.readAsDataURL(file)
  }

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0]
    handleImageSelect(file)
  }

  const handleRemoveImage = () => {
    setReceiptBase64('')
    setReceiptPreview('')
    setReceiptFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCopyCalendly = () => {
    navigator.clipboard.writeText(CALENDLY_URL)
    setCopiedCalendly(true)
    setTimeout(() => setCopiedCalendly(false), 2500)
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
          responsable: 'SIN_ASIGNAR',
          receipt_base64: receiptBase64 || undefined
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
    setReceiptBase64('')
    setReceiptPreview('')
    setReceiptFileName('')
    setSuccessData(null)
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: 16
    }}>
      <div style={{
        background: 'var(--bg-card, #1A1214)',
        borderRadius: 14,
        border: '1px solid var(--border-color, #333)',
        width: '100%',
        maxWidth: 540,
        boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
        overflow: 'hidden',
        color: 'var(--text-primary, #FFF)',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(235, 0, 141, 0.18) 0%, rgba(30, 20, 24, 0.6) 100%)',
          borderBottom: '1px solid var(--border-color, #333)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0
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
                Registro ágil de pago y comprobante • Cita 1-1
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

        {/* Body (scrollable if needed) */}
        <div style={{ padding: 20, overflowY: 'auto' }}>
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
              {/* Nombre y Celular */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
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
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
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

              {/* Ciudad y Género (Sin psicóloga, ya que no se asigna en esta fase) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
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
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
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
              </div>

              {/* Plan y Monto */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
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
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
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

              {/* Cargar Comprobante de Pago (Imagen) */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
                  Comprobante de Pago Nequi (Captura de Pantalla)
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileInputChange}
                  style={{ display: 'none' }}
                />

                {!receiptPreview ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed rgba(235, 0, 141, 0.35)',
                      borderRadius: 10,
                      padding: '16px 14px',
                      background: 'rgba(235, 0, 141, 0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'rgba(235, 0, 141, 0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#EB008D'
                    }}>
                      <Upload size={20} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#FFF' }}>
                        Cargar comprobante de pago (Imagen)
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary, #888)', marginTop: 2 }}>
                        Haz clic aquí para seleccionar captura JPG, PNG o WebP
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    border: '1px solid rgba(235, 0, 141, 0.4)',
                    borderRadius: 10,
                    padding: 10,
                    background: 'rgba(235, 0, 141, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
                      <img
                        src={receiptPreview}
                        alt="Comprobante"
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 6,
                          objectFit: 'cover',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}
                      />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#FFF', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {receiptFileName || 'Comprobante cargado'}
                        </div>
                        <div style={{ fontSize: 11, color: '#10B981', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Check size={13} /> Listo para optimizar y guardar
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      title="Quitar imagen"
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#EF4444',
                        padding: '6px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Trash2 size={13} /> Quitar
                    </button>
                  </div>
                )}
              </div>

              {/* Enlace Oficial de Agendamiento Calendly */}
              <div style={{
                background: 'rgba(235, 0, 141, 0.08)',
                border: '1px solid rgba(235, 0, 141, 0.25)',
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10
              }}>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#EB008D', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} /> Enlace Calendly para Agendar Cita (1-1):
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #999)', marginTop: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {CALENDLY_URL}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCalendly}
                  style={{
                    background: copiedCalendly ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-card, #222)',
                    border: '1px solid ' + (copiedCalendly ? '#10B981' : 'var(--border-color, #444)'),
                    color: copiedCalendly ? '#10B981' : 'var(--text-primary, #FFF)',
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {copiedCalendly ? '✓ Copiado' : 'Copiar Link'}
                </button>
              </div>

              {/* Botones de Acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                textAlign: 'center', padding: '16px 12px',
                background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: 10
              }}>
                <CheckCircle size={36} color="#10B981" style={{ margin: '0 auto 8px' }} />
                <h3 style={{ margin: 0, fontSize: 16, color: '#10B981', fontWeight: 700 }}>
                  ¡Pago Registrado Exitosamente!
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-primary)' }}>
                  Cliente: <strong>{successData.name}</strong> • Código: <span style={{ color: '#F59E0B', fontWeight: 800 }}>{successData.client_code}</span>
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#999' }}>
                  Monto: ${successData.amount_cop?.toLocaleString()} COP • Nequi
                </p>
                {successData.receipt_url && (
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#10B981' }}>
                    ✓ Comprobante guardado en sistema
                  </p>
                )}
              </div>

              {/* Mensaje WhatsApp generado */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
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

              {/* Acciones principales */}
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

              {/* Acceso rápido a Calendly */}
              <div style={{
                background: 'rgba(235, 0, 141, 0.08)',
                border: '1px solid rgba(235, 0, 141, 0.25)',
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10
              }}>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#EB008D' }}>
                    📅 Link de Agendamiento Calendly:
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #999)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {CALENDLY_URL}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCalendly}
                  style={{
                    background: copiedCalendly ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-card, #222)',
                    border: '1px solid ' + (copiedCalendly ? '#10B981' : 'var(--border-color, #444)'),
                    color: copiedCalendly ? '#10B981' : 'var(--text-primary, #FFF)',
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {copiedCalendly ? '✓ Copiado' : 'Copiar Link'}
                </button>
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
