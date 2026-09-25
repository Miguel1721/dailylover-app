import React, { useState } from 'react'
import { UserX, AlertTriangle, CheckCircle, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

const DEACTIVATION_REASONS = [
  'En una relación actualmente',
  'Desistimiento voluntario por demora',
  'Desistimiento voluntario por motivos personales',
  'Descalificación clínica / seguridad',
  'Insatisfacción con el servicio / Reclamo',
  'Inactividad prolongada / No contesta',
  'Culminó citas del plan / No renovó',
  'Otro motivo'
]

export default function DarDeBajaModal({ client, onClose, onSuccess }) {
  const { token } = useAuth()
  const [reason, setReason] = useState(DEACTIVATION_REASONS[0])
  const [notes, setNotes] = useState('')
  const [cancelSlots, setCancelSlots] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!client) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`${API}/api/v1/admin/users/${client.id}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reason,
          notes,
          cancel_slots: cancelSlots
        })
      })

      const data = await res.json()
      if (res.ok) {
        if (onSuccess) onSuccess(data.message || `Cliente ${client.name} dado de baja exitosamente`)
        onClose()
      } else {
        setError(data.detail || 'Error al dar de baja al usuario')
      }
    } catch (err) {
      setError('Error de conexión con el servidor')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal"
        style={{
          width: 520,
          maxWidth: '95vw',
          padding: 24,
          borderRadius: 14,
          background: '#1A1214',
          border: '1px solid rgba(239, 68, 68, 0.4)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#EF4444',
              border: '1px solid rgba(239, 68, 68, 0.4)'
            }}>
              <UserX size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#FCA5A5' }}>
                Dar de Baja a Cliente
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {client.name} {client.client_code ? `(${client.client_code})` : ''}
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
          {/* Motivo de la baja */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Motivo Principal de la Baja *
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none'
              }}
            >
              {DEACTIVATION_REASONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Notas adicionales */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Detalles / Observaciones Adicionales
            </label>
            <textarea
              rows={3}
              placeholder="Explica las razones del cliente, acuerdos alcanzados o detalles clínicos relevantes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: 12.5,
                outline: 'none',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Cancelar slots activos */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            background: 'rgba(239, 68, 68, 0.08)',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid rgba(239, 68, 68, 0.25)'
          }}>
            <input
              type="checkbox"
              id="cancel_slots_chk"
              checked={cancelSlots}
              onChange={e => setCancelSlots(e.target.checked)}
              style={{ width: 16, height: 16, marginTop: 2, cursor: 'pointer', accentColor: '#EF4444' }}
            />
            <label htmlFor="cancel_slots_chk" style={{ fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <strong>Cancelar slots activos pendientes en mesa de matches</strong>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Evita que las psicólogas continúen buscando candidatos para este usuario mientras esté dado de baja.
              </div>
            </label>
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '9px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {submitting ? 'Procesando...' : '🚫 Confirmar Baja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
