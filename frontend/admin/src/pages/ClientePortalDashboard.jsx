import React, { useState } from 'react'
import { Heart, Calendar, Clock, MapPin, Sparkles, Star, MessageSquare, CheckCircle, ExternalLink, Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function ClientePortalDashboard() {
  const { user } = useAuth()
  const [rating, setRating] = useState(0)
  const [quimica, setQuimica] = useState('')
  const [segundaCita, setSegundaCita] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [feedbackNotes, setFeedbackNotes] = useState('')

  // Datos de demostración o del cliente actual
  const clientName = user?.name?.split(' ')[0] || 'Camila'
  const cita = {
    fecha: 'Viernes, 25 de Septiembre',
    hora: '7:30 PM',
    restaurante: 'Cantina La 15',
    ciudad: 'Bogotá D.C.',
    direccion: 'Calle 85 # 12-21, Zona T',
    mapLink: 'https://maps.google.com/?q=Cantina+La+15+Bogota',
    dressCode: 'Smart Casual / Elegante',
    mesaReservada: 'Mesa #12 — Reserva bajo el nombre Daily Lover',
    matchFirstName: 'Felipe',
    matchAge: 32,
    matchProfession: 'Arquitecto & Diseñador',
    matchHobbies: 'Amante de la gastronomía, tenis y viajes culturales'
  }

  const handleSendFeedback = (e) => {
    e.preventDefault()
    setFeedbackSent(true)
  }

  return (
    <div className="content-area" style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header Romántico */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'rgba(150, 21, 0, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          color: 'var(--color-primary)'
        }}>
          <Heart size={28} fill="currentColor" />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
          ¡Hola, {clientName}!
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, margin: 0 }}>
          Bienvenido(a) a tu espacio personal en <strong>Daily Lover Matchmaking</strong>.
        </p>
      </div>

      {/* Tarjeta de Próxima Cita */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(26, 18, 20, 0.9) 0%, rgba(35, 15, 18, 0.95) 100%)',
        border: '1px solid rgba(150, 21, 0, 0.3)',
        borderRadius: 16,
        padding: 32,
        marginBottom: 28,
        boxShadow: '0 8px 32px rgba(150, 21, 0, 0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Tu Próximo Encuentro
            </span>
          </div>
          <span className="badge badge-green" style={{ fontSize: 11, padding: '4px 12px' }}>
            ✓ Mesa Confirmada
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <Calendar size={20} style={{ color: 'var(--color-primary)', marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fecha</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{cita.fecha}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <Clock size={20} style={{ color: 'var(--color-primary)', marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hora acordada</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{cita.hora}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <MapPin size={20} style={{ color: 'var(--color-primary)', marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lugar del encuentro</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{cita.restaurante}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{cita.direccion}</div>
            </div>
          </div>
        </div>

        {/* Resumen del Match */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: 12,
          padding: 20,
          marginBottom: 20
        }}>
          <div style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
            Sobre la persona que conocerás:
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {cita.matchFirstName}, {cita.matchAge} años
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {cita.matchProfession}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '8px 0 0', fontStyle: 'italic' }}>
            "{cita.matchHobbies}"
          </p>
        </div>

        {/* Recomendaciones y Mapa */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            👗 <strong>Código de vestimenta:</strong> {cita.dressCode} • 🍽️ {cita.mesaReservada}
          </div>
          <a
            href={cita.mapLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
          >
            <MapPin size={14} />
            Abrir en Google Maps / Waze
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Módulo de Evaluación de Cita (Feedback) */}
      <div className="card" style={{ padding: 28, marginBottom: 28 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageSquare size={18} style={{ color: 'var(--color-primary)' }} />
          ¿Ya tuviste tu cita? Cuéntale a tu psicóloga
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 20px' }}>
          Tu retroalimentación es 100% confidencial y nos permite afinar tus futuras recomendaciones.
        </p>

        {feedbackSent ? (
          <div style={{
            background: 'rgba(76, 175, 80, 0.1)',
            border: '1px solid rgba(76, 175, 80, 0.3)',
            borderRadius: 12,
            padding: 24,
            textAlign: 'center',
            color: '#4CAF50'
          }}>
            <CheckCircle size={32} style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: 16, fontWeight: 700 }}>¡Gracias por compartir tu experiencia!</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
              Tu psicóloga asignada revisará tus respuestas para dar el siguiente paso en tu proceso.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSendFeedback} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>
                1. ¿Cómo calificarías tu experiencia general en la cita?
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: star <= rating ? '#FFC107' : 'var(--text-muted)',
                      transition: 'transform 0.15s'
                    }}
                    title={`${star} estrellas`}
                  >
                    <Star size={28} fill={star <= rating ? '#FFC107' : 'none'} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>
                2. ¿Sentiste química o afinidad con {cita.matchFirstName}?
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                {['Mucha química', 'Buena conversación', 'Poca o nula conexión'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setQuimica(opt)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: `1px solid ${quimica === opt ? 'var(--color-primary)' : 'var(--border-color)'}`,
                      background: quimica === opt ? 'rgba(150, 21, 0, 0.2)' : 'var(--bg-card)',
                      color: quimica === opt ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>
                3. ¿Te gustaría tener una segunda cita con esta persona?
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                {['Sí, definitivamente', 'Quizás / Por verse', 'No, prefiero otra opción'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSegundaCita(opt)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: `1px solid ${segundaCita === opt ? 'var(--color-primary)' : 'var(--border-color)'}`,
                      background: segundaCita === opt ? 'rgba(150, 21, 0, 0.2)' : 'var(--bg-card)',
                      color: segundaCita === opt ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Comentarios adicionales o notas para tu psicóloga:
              </label>
              <textarea
                rows={3}
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
                placeholder="Cuéntanos qué te gustó, detalles de la conversación, o aspectos clave a considerar..."
                style={{ width: '100%', resize: 'vertical', fontSize: 13 }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start', padding: '10px 24px' }}
            >
              Enviar Evaluación Confidencial
            </button>
          </form>
        )}
      </div>

      {/* Estado de Membresía */}
      <div className="card" style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Shield size={22} style={{ color: 'var(--color-primary)' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Membresía VIP Experience</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              1 de 3 citas realizadas • Tu psicóloga de cabecera: <strong>Steffy</strong>
            </div>
          </div>
        </div>
        <span className="badge badge-yellow">En Proceso Activo</span>
      </div>
    </div>
  )
}
