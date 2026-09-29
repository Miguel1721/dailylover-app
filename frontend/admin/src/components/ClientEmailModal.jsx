import React, { useState, useEffect } from 'react'
import { X, Mail, Send, Check, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia')))
  ? window.location.origin
  : 'https://daily-lover.agentesia.cloud'

/**
 * Modal para enviar un correo prearmado a una persona (botón "Correo" en Perfiles).
 * Elegir plantilla → vista previa con los datos de la persona → "Enviar ahora".
 * Los textos de las plantillas viven en el backend (services/client_email_templates.py).
 */
export default function ClientEmailModal({ person, onClose, onSent }) {
  const { token } = useAuth()
  const [templates, setTemplates] = useState([])
  const [selected, setSelected] = useState('')
  const [preview, setPreview] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }

  useEffect(() => {
    if (!person) return
    setSelected(''); setPreview(null); setError(''); setDone(false)
    fetch(`${API}/api/v1/matchmaking/client-emails/templates`, { headers })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('No se pudieron cargar las plantillas')))
      .then(d => setTemplates(d.templates || []))
      .catch(e => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person?.user_id])

  const choose = async (key) => {
    setSelected(key); setPreview(null); setError(''); setDone(false)
    setLoadingPreview(true)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/client-emails/preview`, {
        method: 'POST', headers, body: JSON.stringify({ user_id: person.user_id, template_key: key })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'No se pudo generar la vista previa')
      setPreview(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingPreview(false)
    }
  }

  const send = async () => {
    if (!selected || !preview?.has_email) return
    setSending(true); setError('')
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/client-emails/send`, {
        method: 'POST', headers, body: JSON.stringify({ user_id: person.user_id, template_key: selected })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'No se pudo enviar el correo')
      setDone(true)
      if (onSent) onSent(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  if (!person) return null

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 860, maxHeight: '92vh', overflowY: 'auto',
          background: 'var(--bg-card, #1A1214)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 22
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 800 }}>
              <Mail size={18} /> Enviar correo
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Para <strong>{person.name}</strong>{person.email ? ` · ${person.email}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} title="Cerrar">
            <X size={20} />
          </button>
        </div>

        {!person.email && (
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontSize: 13, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <AlertTriangle size={15} /> Esta persona no tiene correo registrado, no se le puede enviar.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 14 }}>
          {templates.map(t => (
            <button
              key={t.key}
              onClick={() => choose(t.key)}
              style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                background: selected === t.key ? 'rgba(212,175,55,0.15)' : 'var(--bg-base)',
                border: `1px solid ${selected === t.key ? '#D4AF37' : 'var(--border-color)'}`,
                color: 'var(--text-primary)'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13 }}>{t.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t.description}</div>
            </button>
          ))}
        </div>

        {loadingPreview && <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: 12 }}>Generando vista previa…</div>}

        {preview && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
              Asunto: <strong style={{ color: 'var(--text-primary)' }}>{preview.subject}</strong>
            </div>
            {preview.last_sent_at && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontSize: 12, marginBottom: 8 }}>
                Este mismo correo ya se le envió el {preview.last_sent_at}.
              </div>
            )}
            <iframe
              title="Vista previa del correo"
              sandbox=""
              srcDoc={preview.html}
              style={{ width: '100%', height: 360, border: '1px solid var(--border-color)', borderRadius: 10, background: '#0D0A0B' }}
            />
          </>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: '#F87171', fontSize: 13 }}>{error}</div>
        )}
        {done && (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.15)', color: '#34D399', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Check size={15} /> Correo enviado a {person.email}. Quedó registrado en el historial de la persona.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            {done ? 'Cerrar' : 'Cancelar'}
          </button>
          {!done && (
            <button
              onClick={send}
              disabled={!preview || !preview.has_email || sending}
              style={{
                padding: '9px 18px', borderRadius: 8, border: 'none', fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: (!preview || !preview.has_email || sending) ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg,#D4AF37,#AA820A)',
                color: '#0D0A0B', cursor: (!preview || !preview.has_email || sending) ? 'not-allowed' : 'pointer'
              }}
            >
              <Send size={15} /> {sending ? 'Enviando…' : 'Enviar ahora'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
