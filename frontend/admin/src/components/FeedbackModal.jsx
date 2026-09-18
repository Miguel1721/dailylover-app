import React, { useState } from 'react'
import { Star, Heart, X, CheckCircle, MessageSquare } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

function StarRating({ value, onChange, label }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{label}:</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            type="button"
            key={star}
            onClick={() => onChange(star)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              color: star <= value ? '#FFD700' : 'rgba(255,255,255,0.15)',
              transition: 'transform 0.1s'
            }}
          >
            <Star size={18} fill={star <= value ? '#FFD700' : 'none'} />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function FeedbackModal({ item, onClose, onSuccess }) {
  const { token } = useAuth()
  const [ratingGeneral, setRatingGeneral] = useState(5)
  const [quimica, setQuimica] = useState(5)
  const [atraccion, setAtraccion] = useState(5)
  const [valores, setValores] = useState(5)
  const [secondDate, setSecondDate] = useState('si')
  const [recommendCandidate, setRecommendCandidate] = useState(true)
  const [feedbackElla, setFeedbackElla] = useState('')
  const [feedbackEl, setFeedbackEl] = useState('')
  const [generalNotes, setGeneralNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!item) return null

  const calId = item.calendar_id || item.id

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`${API}/api/v1/matchmaking/calendar/${calId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rating_general: ratingGeneral,
          quimica,
          atraccion,
          valores,
          second_date: secondDate,
          recommend_candidate: recommendCandidate,
          feedback_ella: feedbackElla,
          feedback_el: feedbackEl,
          general_notes: generalNotes
        })
      })

      const data = await res.json()
      if (res.ok) {
        if (onSuccess) onSuccess(data.message || 'Feedback guardado')
        onClose()
      } else {
        setError(data.detail || 'Error guardando feedback')
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
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(168, 85, 247, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#A855F7'
            }}>
              <Star size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
                Evaluación &amp; Feedback Post-Cita
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {item.person_a} 💘 {item.person_b} • {item.venue || 'Restaurante'}
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
          {/* Calificaciones por Estrellas */}
          <div style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            <StarRating label="⭐ Calificación General de la Experiencia" value={ratingGeneral} onChange={setRatingGeneral} />
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
            <StarRating label="🔥 Química &amp; Chispa" value={quimica} onChange={setQuimica} />
            <StarRating label="👀 Atracción Física" value={atraccion} onChange={setAtraccion} />
            <StarRating label="🗣️ Afinidad de Conversación / Valores" value={valores} onChange={setValores} />
          </div>

          {/* ¿Segunda Cita? */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
              ¿Aceptaría tener una 2da cita con este match?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { id: 'si', label: '💖 Sí, con gusto', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
                { id: 'no', label: '❌ No hubo interés', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
                { id: 'amistad', label: '🤝 Solo amistad', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
              ].map(btn => (
                <button
                  type="button"
                  key={btn.id}
                  onClick={() => setSecondDate(btn.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: secondDate === btn.id ? `2px solid ${btn.color}` : '1px solid var(--border-color)',
                    background: secondDate === btn.id ? btn.bg : 'var(--bg-base)',
                    color: secondDate === btn.id ? btn.color : 'var(--text-primary)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Candidato Recomendable */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-base)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <input
              type="checkbox"
              id="recommend_chk"
              checked={recommendCandidate}
              onChange={e => setRecommendCandidate(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#10B981' }}
            />
            <label htmlFor="recommend_chk" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
              👍 Candidato recomendable para otros clientes (sin red flags)
            </label>
          </div>

          {/* Feedback Separado Ella / Él */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                💬 Qué dijo {item.person_a}:
              </label>
              <textarea
                rows={2}
                value={feedbackElla}
                onChange={e => setFeedbackElla(e.target.value)}
                placeholder="Impresiones de Persona A..."
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  outline: 'none',
                  resize: 'none'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                💬 Qué dijo {item.person_b}:
              </label>
              <textarea
                rows={2}
                value={feedbackEl}
                onChange={e => setFeedbackEl(e.target.value)}
                placeholder="Impresiones de Persona B..."
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  outline: 'none',
                  resize: 'none'
                }}
              />
            </div>
          </div>

          {/* Observaciones Generales */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Síntesis Clínica / Comentarios de Cierre:
            </label>
            <textarea
              rows={2}
              value={generalNotes}
              onChange={e => setGeneralNotes(e.target.value)}
              placeholder="Ej: Hubo muy buena energía, salieron a caminar después. Silvi sugiere darles espacio para 2da cita propia."
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
                background: '#A855F7',
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
              {submitting ? 'Guardando...' : '⭐ Guardar Feedback & Cerrar Cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
