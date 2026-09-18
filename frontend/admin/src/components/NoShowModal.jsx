import React, { useState } from 'react'
import { AlertTriangle, X, CheckCircle, RotateCcw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

export default function NoShowModal({ item, onClose, onSuccess }) {
  const { token } = useAuth()
  const [personFailed, setPersonFailed] = useState('person_b')
  const [reason, setReason] = useState('Plantón / Sin aviso ni respuesta')
  const [action, setAction] = useState('reschedule')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!item) return null

  const calId = item.calendar_id || item.id

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`${API}/api/v1/matchmaking/calendar/${calId}/no-show`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          person_failed: personFailed,
          reason,
          action,
          notes
        })
      })

      const data = await res.json()
      if (res.ok) {
        if (onSuccess) onSuccess(data.message || 'No-Show registrado')
        onClose()
      } else {
        setError(data.detail || 'Error registrando No-Show')
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
        style={{ width: 540, maxWidth: '95vw', padding: 24, borderRadius: 14 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#EF4444'
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
                Registrar No-Show (Inasistencia)
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {item.person_a} ✕ {item.person_b} ({item.scheduled_date || item.date_time})
              </p>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ padding: '4px 8px', fontSize: 16 }}
          >
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ¿Quién faltó? */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
              ¿Quién faltó o canceló a última hora?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { id: 'person_a', label: item.person_a || 'Persona A' },
                { id: 'person_b', label: item.person_b || 'Persona B' },
                { id: 'both', label: 'Ambos' }
              ].map(opt => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setPersonFailed(opt.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: personFailed === opt.id ? '2px solid #EF4444' : '1px solid var(--border-color)',
                    background: personFailed === opt.id ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-base)',
                    color: personFailed === opt.id ? '#EF4444' : 'var(--text-primary)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'center',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Motivo de la inasistencia:
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
              <option value="Plantón / Sin aviso ni respuesta">Plantón / Dejó plantado(a) y no contestó</option>
              <option value="Avisó con menos de 2 horas">Avisó con menos de 2 horas de anticipación</option>
              <option value="Canceló el mismo día por motivos de trabajo">Canceló el mismo día por trabajo</option>
              <option value="Emergencia médica / fuerza mayor">Emergencia médica / Fuerza mayor comprobable</option>
              <option value="Confusión de horario o lugar">Confusión con horario o restaurante</option>
              <option value="Otro motivo">Otro motivo</option>
            </select>
          </div>

          {/* Acción */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Acción operativa a aplicar:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div
                onClick={() => setAction('reschedule')}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: action === 'reschedule' ? '2px solid #F59E0B' : '1px solid var(--border-color)',
                  background: action === 'reschedule' ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-base)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RotateCcw size={14} /> Reprogramar Cita
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Perdonar inasistencia y crear nueva fila para reagendar fecha sin costo adicional.
                </div>
              </div>

              <div
                onClick={() => setAction('penalty')}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: action === 'penalty' ? '2px solid #EF4444' : '1px solid var(--border-color)',
                  background: action === 'penalty' ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-base)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} /> Cobrar Penalidad
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Descontar la cita de la cuota del plan y exigir pago de multa para reagendar.
                </div>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Observaciones de Customer Service / Psicóloga (Opcional):
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Escribió a las 6:45pm diciendo que se le pinchó una llanta..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: 12,
                outline: 'none',
                resize: 'none'
              }}
            />
          </div>

          {/* Footer buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                background: '#EF4444',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '9px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
              disabled={submitting}
            >
              {submitting ? 'Guardando...' : '🚨 Confirmar No-Show'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
