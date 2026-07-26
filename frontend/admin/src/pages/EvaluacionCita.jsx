import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Heart, Star, CheckCircle, MapPin, Calendar, UserCheck, Send, ShieldAlert } from 'lucide-react'


const API = 'https://prueba-daily.agentesia.cloud'

export default function EvaluacionCita() {
  const [searchParams] = useSearchParams()
  const matchId = searchParams.get('match_id')
  const userId = searchParams.get('user_id')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  const [venueRating, setVenueRating] = useState(5)
  const [punctualityRating, setPunctualityRating] = useState(5)
  const [chemistryRating, setChemistryRating] = useState(5)
  const [wouldRepeat, setWouldRepeat] = useState(true)
  const [comments, setComments] = useState('')

  useEffect(() => {
    if (matchId && userId) {
      fetch(`${API}/api/v1/client/feedback-form?match_id=${matchId}&user_id=${userId}`)
        .then(r => {
          if (!r.ok) throw new Error('Cita no encontrada o expirada')
          return r.json()
        })
        .then(d => {
          setFormData(d)
          if (d.already_completed) {
            setSubmitted(true)
          }
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    } else {
      setError('Enlace de evaluación no válido o faltan parámetros')
      setLoading(false)
    }
  }, [matchId, userId])

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    fetch(`${API}/api/v1/client/submit-match-feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        match_id: parseInt(matchId),
        user_id: parseInt(userId),
        venue_rating: venueRating,
        punctuality_rating: punctualityRating,
        chemistry_rating: chemistryRating,
        would_repeat: wouldRepeat,
        feedback_comments: comments
      })
    })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setSubmitted(true)
        } else {
          setError(d.detail || 'Error guardando evaluación')
        }
      })
      .catch(() => setError('Error enviando la evaluación'))
      .finally(() => setSubmitting(false))
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0D0A0B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Heart size={40} className="spin-slow" style={{ color: '#961500', margin: '0 auto 16px' }} />
          <p style={{ fontSize: 14, color: '#9A8A8D' }}>Cargando evaluación de tu encuentro...</p>
        </div>
      </div>
    )
  }

  if (error || !formData) {
    return (
      <div style={{ minHeight: '100vh', background: '#0D0A0B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#1A1214', border: '1px solid rgba(150,21,0,0.3)', borderRadius: 16, padding: 32, maxWidth: 460, textAlign: 'center' }}>
          <ShieldAlert size={48} style={{ color: '#FF4D4D', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Enlace no Disponible</h2>
          <p style={{ fontSize: 14, color: '#9A8A8D' }}>{error || 'No se pudo cargar la información del encuentro.'}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#0D0A0B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#1A1214', border: '1px solid rgba(76,175,80,0.3)', borderRadius: 16, padding: 36, maxWidth: 500, textAlign: 'center' }}>
          <CheckCircle size={56} style={{ color: '#4CAF50', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>¡Evaluación Completada!</h2>
          <p style={{ fontSize: 14, color: '#9A8A8D', lineHeight: 1.6, marginBottom: 20 }}>
            Muchas gracias <strong>{formData.evaluator_name}</strong>. Tu retroalimentación sobre la cita con <strong>{formData.partner_name}</strong> ha sido guardada de forma confidencial.
          </p>
          <div style={{ background: 'rgba(76,175,80,0.1)', padding: 14, borderRadius: 10, fontSize: 13, color: '#4CAF50', fontWeight: 600 }}>
            🔓 Tu perfil ha sido desbloqueado exitosamente en el sistema de matchmaking.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0A0B', color: '#fff', padding: '30px 16px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 580, background: '#1A1214', border: '1px solid rgba(150,21,0,0.3)', borderRadius: 20, padding: 28, boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', borderBottom: '1px solid rgba(150,21,0,0.2)', paddingBottom: 20, marginBottom: 24 }}>
          <div style={{ color: '#961500', fontWeight: 800, fontSize: 22, letterSpacing: 1 }}>🌹 DAILY LOVER</div>
          <div style={{ fontSize: 13, color: '#9A8A8D', marginTop: 4 }}>Evaluación Obligatoria de Acompañamiento Post-Cita</div>
        </div>

        {/* Meeting Banner */}
        <div style={{ background: 'rgba(150,21,0,0.08)', borderLeft: '4px solid #961500', padding: 16, borderRadius: 10, marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#F5F0F1', marginBottom: 6 }}>
            Encuentro con: <span style={{ color: '#FF5A36' }}>{formData.partner_name}</span>
          </div>
          <div style={{ fontSize: 12, color: '#9A8A8D', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span>📅 {formData.match_date}</span>
            <span>📍 {formData.venue}</span>
            <span>👩‍⚕️ Psicóloga: {formData.matchmaker}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Rating Lugar */}
          <div>
            <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8, color: '#F5F0F1' }}>
              📍 1. ¿Cómo calificas el lugar y ambiente del encuentro?
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4, 5].map(val => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setVenueRating(val)}
                  style={{
                    background: val <= venueRating ? 'rgba(150,21,0,0.3)' : 'rgba(255,255,255,0.05)',
                    border: val <= venueRating ? '1px solid #961500' : '1px solid rgba(255,255,255,0.1)',
                    color: val <= venueRating ? '#FFD54F' : '#5A4A4D',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 16,
                    cursor: 'pointer',
                    flex: 1
                  }}
                >
                  <Star size={18} fill={val <= venueRating ? '#FFD54F' : 'none'} style={{ margin: '0 auto' }} />
                  <div style={{ fontSize: 11, marginTop: 2, color: '#fff' }}>{val}★</div>
                </button>
              ))}
            </div>
          </div>

          {/* Rating Puntualidad */}
          <div>
            <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8, color: '#F5F0F1' }}>
              ⏰ 2. Puntualidad y actitud de la persona
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4, 5].map(val => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setPunctualityRating(val)}
                  style={{
                    background: val <= punctualityRating ? 'rgba(150,21,0,0.3)' : 'rgba(255,255,255,0.05)',
                    border: val <= punctualityRating ? '1px solid #961500' : '1px solid rgba(255,255,255,0.1)',
                    color: val <= punctualityRating ? '#FFD54F' : '#5A4A4D',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 16,
                    cursor: 'pointer',
                    flex: 1
                  }}
                >
                  <Star size={18} fill={val <= punctualityRating ? '#FFD54F' : 'none'} style={{ margin: '0 auto' }} />
                  <div style={{ fontSize: 11, marginTop: 2, color: '#fff' }}>{val}★</div>
                </button>
              ))}
            </div>
          </div>

          {/* Rating Química */}
          <div>
            <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8, color: '#F5F0F1' }}>
              💘 3. Química & Conexión Mutua
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4, 5].map(val => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setChemistryRating(val)}
                  style={{
                    background: val <= chemistryRating ? 'rgba(150,21,0,0.3)' : 'rgba(255,255,255,0.05)',
                    border: val <= chemistryRating ? '1px solid #961500' : '1px solid rgba(255,255,255,0.1)',
                    color: val <= chemistryRating ? '#FFD54F' : '#5A4A4D',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 16,
                    cursor: 'pointer',
                    flex: 1
                  }}
                >
                  <Heart size={18} fill={val <= chemistryRating ? '#FF5A36' : 'none'} style={{ margin: '0 auto', color: val <= chemistryRating ? '#FF5A36' : '#5A4A4D' }} />
                  <div style={{ fontSize: 11, marginTop: 2, color: '#fff' }}>{val}★</div>
                </button>
              ))}
            </div>
          </div>

          {/* ¿Desea Segunda Cita? */}
          <div>
            <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8, color: '#F5F0F1' }}>
              💬 4. ¿Desearías agendar una 2da Cita con {formData.partner_name}?
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setWouldRepeat(true)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 10,
                  border: wouldRepeat ? '2px solid #4CAF50' : '1px solid rgba(255,255,255,0.1)',
                  background: wouldRepeat ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.05)',
                  color: wouldRepeat ? '#4CAF50' : '#9A8A8D',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                💚 Sí, me encantaría volver a verle
              </button>

              <button
                type="button"
                onClick={() => setWouldRepeat(false)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 10,
                  border: !wouldRepeat ? '2px solid #961500' : '1px solid rgba(255,255,255,0.1)',
                  background: !wouldRepeat ? 'rgba(150,21,0,0.15)' : 'rgba(255,255,255,0.05)',
                  color: !wouldRepeat ? '#FF5A36' : '#9A8A8D',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                💔 No por el momento (Buscar otra propuesta)
              </button>
            </div>
          </div>

          {/* Comentarios confidenciales para la psicóloga */}
          <div>
            <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 6, color: '#F5F0F1' }}>
              📝 Comentarios Confidenciales para tu Psicóloga:
            </label>
            <textarea
              rows={4}
              value={comments}
              onChange={e => setComments(e.target.value)}
              placeholder="Cuéntanos detalles de la conversación, aspectos positivos o sugerencias para tu psicóloga..."
              style={{
                width: '100%',
                background: '#0D0A0B',
                border: '1px solid rgba(150,21,0,0.3)',
                borderRadius: 10,
                color: '#fff',
                padding: 12,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: 14,
              fontSize: 15,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 10
            }}
          >
            <Send size={18} /> {submitting ? 'Guardando evaluación...' : 'Enviar Evaluación & Desbloquear Perfil'}
          </button>
        </form>
      </div>
    </div>
  )
}
