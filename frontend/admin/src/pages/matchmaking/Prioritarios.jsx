import React, { useState, useEffect, useCallback } from 'react'
import { 
  Flame, Search, Filter, RefreshCw, ExternalLink, Plus, 
  CheckCircle, AlertTriangle, Clock, User, Check, X, 
  Edit3, Sparkles, Heart, MessageSquare, ChevronRight, ShieldCheck
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

const PSYCHOLOGISTS = [
  'STEFF', 'MAPE', 'SILVI', 'ANA', 'JENN', 'ALEJA', 'MANU', 'LAU', 'SOFI', 'PIA'
]

const STATUS_BADGES = {
  'APROBADO': { bg: 'rgba(106, 168, 79, 0.2)', color: '#6AA84F', border: 'rgba(106, 168, 79, 0.4)' },
  'RESUELTO': { bg: 'rgba(106, 168, 79, 0.2)', color: '#6AA84F', border: 'rgba(106, 168, 79, 0.4)' },
  'NOT APPROVED': { bg: 'rgba(234, 153, 153, 0.2)', color: '#EA9999', border: 'rgba(234, 153, 153, 0.4)' },
  'REFUND': { bg: 'rgba(234, 153, 153, 0.2)', color: '#EA9999', border: 'rgba(234, 153, 153, 0.4)' },
  'Pendiente': { bg: 'rgba(255, 242, 204, 0.15)', color: '#FFD966', border: 'rgba(255, 217, 102, 0.3)' },
  'Urgente': { bg: 'rgba(224, 102, 102, 0.2)', color: '#E06666', border: 'rgba(224, 102, 102, 0.4)' },
  'default_hecho': { bg: 'rgba(162, 196, 201, 0.2)', color: '#A2C4C9', border: 'rgba(162, 196, 201, 0.4)' }
}

function getStatusBadgeStyle(status = '') {
  const st = status.trim().toUpperCase()
  if (st.includes('APROBADO') || st.includes('RESUELTO')) return STATUS_BADGES['APROBADO']
  if (st.includes('NOT APPROVED') || st.includes('REFUND')) return STATUS_BADGES['NOT APPROVED']
  if (st.includes('HECHO')) return STATUS_BADGES['default_hecho']
  if (st.includes('URGENTE')) return STATUS_BADGES['Urgente']
  return STATUS_BADGES['Pendiente']
}

function getUrgencyBadge(days, level) {
  if (days > 30 || level === 'CRITICA') {
    return {
      label: `🔴 ${days}d inactivo`,
      bg: 'rgba(224, 102, 102, 0.18)',
      color: '#ff6b6b',
      border: 'rgba(224, 102, 102, 0.4)'
    }
  }
  if (days >= 21 || level === 'ALTA') {
    return {
      label: `🟠 ${days}d inactivo`,
      bg: 'rgba(255, 145, 0, 0.18)',
      color: '#FF9100',
      border: 'rgba(255, 145, 0, 0.4)'
    }
  }
  return {
    label: `🟡 ${days}d inactivo`,
    bg: 'rgba(255, 217, 102, 0.18)',
    color: '#FFD966',
    border: 'rgba(255, 217, 102, 0.4)'
  }
}

// ─── MODAL: BÚSQUEDA Y ASIGNACIÓN DE MATCH BIDIRECCIONAL ─────────────────────
function BuscarMatchPrioritarioModal({ caseItem, onClose, onAssigned }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [candidates, setCandidates] = useState([])
  const [clientData, setClientData] = useState(null)
  const [selectedCand, setSelectedCand] = useState(null)
  const [psychologist, setPsychologist] = useState(
    caseItem.assigned_psychologist && caseItem.assigned_psychologist !== 'Sin asignar' 
      ? caseItem.assigned_psychologist 
      : (user?.name || 'Steff')
  )
  const [mmComment, setMmComment] = useState(caseItem.matchmaker_comment || '')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/api/v1/matchmaking/prioritarios/${caseItem.id}/candidates`)
      .then(r => r.json())
      .then(d => {
        setCandidates(d.suggested_matches || [])
        setClientData(d.client || null)
        if (d.suggested_matches && d.suggested_matches.length > 0) {
          setSelectedCand(d.suggested_matches[0])
          if (!mmComment) {
            setMmComment(d.suggested_matches[0].match_analysis?.why_ideal || '')
          }
        }
      })
      .catch(err => console.error('Error fetching candidates:', err))
      .finally(() => setLoading(false))
  }, [caseItem.id])

  const handleSelect = (cand) => {
    setSelectedCand(cand)
    if (cand.match_analysis?.why_ideal) {
      setMmComment(cand.match_analysis.why_ideal)
    }
  }

  const handleSaveProposal = async () => {
    if (!selectedCand) {
      alert('Por favor selecciona una candidata propuesta.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/prioritarios/${caseItem.id}/propose-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: selectedCand.user_id,
          candidate_name: selectedCand.name,
          candidate_crm_id: selectedCand.crm_id,
          psychologist_name: psychologist,
          matchmaker_comment: mmComment || 'Candidata con alta afinidad sociocultural y estilo de vida compatible.'
        })
      })
      const data = await res.json()
      if (res.ok) {
        onAssigned(data)
        onClose()
      } else {
        alert(data.detail || 'Error al guardar la propuesta.')
      }
    } catch (err) {
      alert('Error de conexión: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20
    }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{
        background: '#1A1214', border: '1px solid rgba(150, 21, 0, 0.3)', borderRadius: 16,
        width: 860, maxWidth: '96vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Cabecera Modal */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid rgba(150, 21, 0, 0.2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#130C0E'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                Buscar Match para: {caseItem.client_name}
              </span>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 6,
                background: 'rgba(150, 21, 0, 0.2)', color: 'var(--color-primary-light)', fontWeight: 600
              }}>
                Filtro Bidireccional A ↔ B
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {caseItem.city} • {caseItem.plan_tier} • Alerta: "{caseItem.cs_comment || '15+ días sin cita'}"
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ border: 'none', fontSize: 16 }}>✕</button>
        </div>

        {/* Contenido */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
              <RefreshCw className="spinner" size={28} style={{ margin: '0 auto 12px', display: 'block' }} />
              Analizando compatibilidad mutua (edad, estatura, grupo social, dealbreakers)...
            </div>
          ) : candidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0' }}>
              <AlertTriangle size={36} style={{ color: '#FFD966', margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>No se encontraron candidatas directas automáticas</div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 500, margin: '0 auto 20px' }}>
                Puedes proponer el nombre de la candidata manualmente escribiéndolo en el campo de abajo.
              </p>
              <div style={{ maxWidth: 400, margin: '0 auto', textAlign: 'left' }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Nombre de Candidata Propuesta</label>
                <input 
                  type="text" 
                  placeholder="Ej: Laura Sofía Martínez"
                  value={selectedCand?.name || ''} 
                  onChange={e => setSelectedCand({ name: e.target.value, user_id: null })}
                  style={{
                    width: '100%', padding: '10px 14px', background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)'
                  }}
                />
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Candidatas Compatibles Sugeridas por IA ({candidates.length})
              </div>

              {/* Grid de Candidatas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14, marginBottom: 20 }}>
                {candidates.map(cand => {
                  const isSel = selectedCand?.name === cand.name
                  return (
                    <div 
                      key={cand.name}
                      onClick={() => handleSelect(cand)}
                      style={{
                        background: isSel ? 'rgba(150, 21, 0, 0.15)' : 'var(--bg-card)',
                        border: `1.5px solid ${isSel ? 'var(--color-primary)' : 'var(--border-color)'}`,
                        borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: isSel ? '0 4px 16px rgba(150, 21, 0, 0.25)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {cand.name}
                            {cand.crm_url && (
                              <a 
                                href={cand.crm_url} target="_blank" rel="noopener noreferrer" 
                                onClick={e => e.stopPropagation()} 
                                title="Ver perfil en CRM"
                                style={{ color: 'var(--color-primary-light)', display: 'inline-flex' }}
                              >
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {cand.age} años • {cand.occupation || 'Profesional'} • {cand.city}
                          </div>
                        </div>
                        <div style={{
                          background: cand.compatibility_pct >= 90 ? 'rgba(76, 175, 80, 0.18)' : 'rgba(255, 193, 7, 0.18)',
                          color: cand.compatibility_pct >= 90 ? '#4CAF50' : '#FFC107',
                          border: `1px solid ${cand.compatibility_pct >= 90 ? 'rgba(76, 175, 80, 0.4)' : 'rgba(255, 193, 7, 0.4)'}`,
                          padding: '3px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700
                        }}>
                          {cand.compatibility_pct}% match
                        </div>
                      </div>

                      {/* Dealbreakers & Compatibilidad mutua */}
                      <div style={{
                        fontSize: 11, padding: '4px 8px', borderRadius: 6, marginBottom: 8,
                        background: cand.dealbreakers_clean ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 193, 7, 0.1)',
                        color: cand.dealbreakers_clean ? '#81C784' : '#FFD54F'
                      }}>
                        {cand.dealbreakers_check}
                      </div>

                      {/* Puntos fuertes */}
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {cand.strengths?.[0] || 'Excelente afinidad en ritmo de vida y metas profesionales.'}
                      </div>

                      {isSel && (
                        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-primary-light)', fontSize: 12, fontWeight: 600 }}>
                          <Check size={14} /> Seleccionada para propuesta
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Formulario de Asignación */}
          <div style={{
            background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)',
            borderRadius: 12, padding: 18, marginTop: 10
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                  Psicóloga Responsable que hace el Match:
                </label>
                <select
                  value={psychologist}
                  onChange={e => setPsychologist(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13
                  }}
                >
                  {PSYCHOLOGISTS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                  Candidata seleccionada:
                </label>
                <input 
                  type="text"
                  disabled
                  value={selectedCand ? `${selectedCand.name} (${selectedCand.compatibility_pct || 90}% match)` : 'Ninguna'}
                  style={{
                    width: '100%', padding: '8px 12px', background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, opacity: 0.8
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                Comentario Matchmaker (Justificación clínica para Supervisión de María):
              </label>
              <textarea
                rows={3}
                placeholder="Explica por qué esta pareja funciona: afinidad de intereses, estilo de vida, acuerdos de ubicación..."
                value={mmComment}
                onChange={e => setMmComment(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer Modal */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid rgba(150, 21, 0, 0.2)',
          display: 'flex', justifyContent: 'flex-end', gap: 12, background: '#130C0E'
        }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button 
            className="btn btn-primary" 
            onClick={handleSaveProposal}
            disabled={submitting || !selectedCand}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {submitting ? 'Guardando...' : `Guardar Propuesta (HECHO POR ${psychologist.toUpperCase()})`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL: EDITAR COMENTARIO CUSTOMER SERVICE ──────────────────────────────
function EditarComentarioModal({ caseItem, onClose, onSaved }) {
  const [comment, setComment] = useState(caseItem.cs_comment || '')
  const [psychologist, setPsychologist] = useState(caseItem.assigned_psychologist || 'Sin asignar')
  const [urgency, setUrgency] = useState(caseItem.urgency_level || 'ALTA')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/prioritarios/${caseItem.id}/comment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cs_comment: comment,
          assigned_psychologist: psychologist,
          urgency_level: urgency
        })
      })
      if (res.ok) {
        onSaved()
        onClose()
      } else {
        alert('Error al actualizar comentario.')
      }
    } catch (err) {
      alert('Error de conexión: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20
    }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{
        background: '#1A1214', border: '1px solid rgba(150, 21, 0, 0.3)', borderRadius: 14,
        width: 520, maxWidth: '95vw', padding: 24
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            Editar Nota de Customer Service: {caseItem.client_name}
          </h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ border: 'none' }}>✕</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Comentario Customer Service / Razón de Prioridad:
          </label>
          <textarea
            rows={4}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Ej: Lleva 20 días esperando segundo match, cliente molesto o solicita chica deportista..."
            style={{
              width: '100%', padding: '10px 12px', background: 'var(--bg-base)',
              border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Psicóloga Asignada:
            </label>
            <select
              value={psychologist}
              onChange={e => setPsychologist(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', background: 'var(--bg-base)',
                border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13
              }}
            >
              <option value="Sin asignar">Sin asignar</option>
              {PSYCHOLOGISTS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Nivel de Urgencia:
            </label>
            <select
              value={urgency}
              onChange={e => setUrgency(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', background: 'var(--bg-base)',
                border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13
              }}
            >
              <option value="CRITICA">🔴 Crítica (+30 días / Riesgo)</option>
              <option value="ALTA">🟠 Alta (21-30 días)</option>
              <option value="MODERADA">🟡 Moderada (15-20 días)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL: NUEVO CASO MANUAL ───────────────────────────────────────────────
function NuevoCasoModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    client_name: '',
    city: 'Bogotá',
    plan_tier: 'Estándar 65k (2 citas)',
    cs_comment: '',
    assigned_psychologist: 'Sin asignar',
    urgency_level: 'ALTA'
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.client_name.trim()) {
      alert('Por favor escribe el nombre del cliente.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/prioritarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (res.ok) {
        onCreated()
        onClose()
      } else {
        alert(data.detail || 'Error al crear el caso prioritario.')
      }
    } catch (err) {
      alert('Error de conexión: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20
    }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{
        background: '#1A1214', border: '1px solid rgba(150, 21, 0, 0.3)', borderRadius: 14,
        width: 520, maxWidth: '95vw', padding: 24
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Flame size={18} style={{ color: 'var(--color-primary-light)' }} /> Agregar Cliente a Prioritarios
          </h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ border: 'none' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Nombre Completo del Cliente:
            </label>
            <input
              required
              type="text"
              placeholder="Ej: Wilson Nocobe"
              value={form.client_name}
              onChange={e => setForm({ ...form, client_name: e.target.value })}
              style={{
                width: '100%', padding: '9px 12px', background: 'var(--bg-base)',
                border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Ciudad:</label>
              <select
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
                style={{
                  width: '100%', padding: '8px 12px', background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)'
                }}
              >
                {['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga', 'Miami', 'Madrid'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Plan:</label>
              <select
                value={form.plan_tier}
                onChange={e => setForm({ ...form, plan_tier: e.target.value })}
                style={{
                  width: '100%', padding: '8px 12px', background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)'
                }}
              >
                {['Estándar 65k (2 citas)', 'Estándar 65k (1 cita)', 'VIP 195k', 'Premium 150k', 'Matchmaking Experience'].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Comentario de Customer Service (¿Por qué entra a prioritarios?):
            </label>
            <textarea
              required
              rows={3}
              placeholder="Ej: Se va de viaje el 15 y le falta su segundo match..."
              value={form.cs_comment}
              onChange={e => setForm({ ...form, cs_comment: e.target.value })}
              style={{
                width: '100%', padding: '9px 12px', background: 'var(--bg-base)',
                border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Asignar Psicóloga:</label>
              <select
                value={form.assigned_psychologist}
                onChange={e => setForm({ ...form, assigned_psychologist: e.target.value })}
                style={{
                  width: '100%', padding: '8px 12px', background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)'
                }}
              >
                <option value="Sin asignar">Sin asignar</option>
                {PSYCHOLOGISTS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Urgencia:</label>
              <select
                value={form.urgency_level}
                onChange={e => setForm({ ...form, urgency_level: e.target.value })}
                style={{
                  width: '100%', padding: '8px 12px', background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)'
                }}
              >
                <option value="CRITICA">🔴 Crítica</option>
                <option value="ALTA">🟠 Alta</option>
                <option value="MODERADA">🟡 Moderada</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Crear Caso Prioritario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── PÁGINA PRINCIPAL PRIORITARIOS ──────────────────────────────────────────
export default function Prioritarios() {
  const { user } = useAuth()
  const [cases, setCases] = useState([])
  const [kpis, setKpis] = useState({
    total_activos: 0,
    criticos_30d: 0,
    pendientes_match: 0,
    hechos_por_revisar: 0,
    resueltos_totales: 0
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [psycFilter, setPsycFilter] = useState('todas')

  // Modales
  const [matchModalCase, setMatchModalCase] = useState(null)
  const [commentModalCase, setCommentModalCase] = useState(null)
  const [showNuevoModal, setShowNuevoModal] = useState(false)
  const [approvingId, setApprovingId] = useState(null)

  const fetchCases = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== 'todos') params.set('status', statusFilter)
    if (psycFilter !== 'todas') params.set('psychologist', psycFilter)
    if (search.trim()) params.set('search', search.trim())

    fetch(`${API}/api/v1/matchmaking/prioritarios?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        setCases(d.cases || [])
        if (d.kpis) setKpis(d.kpis)
      })
      .catch(err => console.error('Error fetching prioritarios:', err))
      .finally(() => setLoading(false))
  }, [statusFilter, psycFilter, search])

  useEffect(() => {
    fetchCases()
  }, [fetchCases])

  // Aprobación rápida por María / Supervisión
  const handleApprove = async (caseItem) => {
    if (!caseItem.candidate_name) {
      alert('Debes proponer una candidata antes de aprobar.')
      return
    }
    const confirmMsg = `¿Aprobar match entre ${caseItem.client_name} y ${caseItem.candidate_name}? Esto lo trasladará oficialmente a la mesa de MATCHES.`
    if (!window.confirm(confirmMsg)) return

    setApprovingId(caseItem.id)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/prioritarios/${caseItem.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver_name: user?.name || 'María Paula' })
      })
      const data = await res.json()
      if (res.ok) {
        fetchCases()
      } else {
        alert(data.detail || 'Error al aprobar match prioritario.')
      }
    } catch (err) {
      alert('Error de conexión: ' + err.message)
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1>🔥 Prioritarios (15+ Días)</h1>
            <span style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 20,
              background: 'rgba(150, 21, 0, 0.2)', color: 'var(--color-primary-light)',
              fontWeight: 700, border: '1px solid rgba(150, 21, 0, 0.4)'
            }}>
              Ex-Corazoncito SSOT
            </span>
          </div>
          <p className="page-subtitle">
            Monitoreo y desatoro operativo de clientes con más de 15 días sin cita ni match nuevo, contingencias o quejas.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button 
            className="btn btn-ghost"
            onClick={fetchCases}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            title="Refrescar datos"
          >
            <RefreshCw size={14} className={loading ? 'spinner' : ''} /> Refrescar
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setShowNuevoModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> + Agregar Caso CS
          </button>
        </div>
      </div>

      <div className="content-area">
        {/* KPI Cards */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
          <div className="stat-card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Activos</span>
              <Flame size={16} style={{ color: 'var(--color-primary-light)' }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
              {kpis.total_activos}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              Casos en seguimiento
            </div>
          </div>

          <div className="stat-card" style={{ padding: '16px 18px', borderLeft: '3px solid #ff6b6b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Críticos (&gt;30 días)</span>
              <Clock size={16} style={{ color: '#ff6b6b' }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#ff6b6b' }}>
              {kpis.criticos_30d}
            </div>
            <div style={{ fontSize: 11, color: '#ff8585', marginTop: 4 }}>
              Riesgo inminente de queja
            </div>
          </div>

          <div className="stat-card" style={{ padding: '16px 18px', borderLeft: '3px solid #FFD966' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pendientes de Match</span>
              <AlertTriangle size={16} style={{ color: '#FFD966' }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#FFD966' }}>
              {kpis.pendientes_match}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Esperando propuesta psicóloga
            </div>
          </div>

          <div className="stat-card" style={{ padding: '16px 18px', borderLeft: '3px solid #A2C4C9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Hechos por Revisar</span>
              <Sparkles size={16} style={{ color: '#A2C4C9' }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#A2C4C9' }}>
              {kpis.hechos_por_revisar}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Esperando visto bueno María
            </div>
          </div>

          <div className="stat-card" style={{ padding: '16px 18px', borderLeft: '3px solid #4CAF50' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Resueltos / Aprobados</span>
              <CheckCircle size={16} style={{ color: '#4CAF50' }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#4CAF50' }}>
              {kpis.resueltos_totales}
            </div>
            <div style={{ fontSize: 11, color: '#81C784', marginTop: 4 }}>
              Trasladados a MATCHES
            </div>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 20,
          display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 280 }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar por cliente, candidata o comentario..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px 8px 36px', background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13
                }}
              />
            </div>

            {/* Filtro Estado */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                padding: '8px 12px', background: 'var(--bg-base)',
                border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13
              }}
            >
              <option value="todos">Todos los Estados</option>
              <option value="pendientes">⏳ Pendientes de Match</option>
              <option value="hechos">✨ Hechos por Revisar</option>
              <option value="criticos">🔴 Críticos (+30 días)</option>
              <option value="aprobados">✓ Aprobados</option>
            </select>

            {/* Filtro Psicóloga */}
            <select
              value={psycFilter}
              onChange={e => setPsycFilter(e.target.value)}
              style={{
                padding: '8px 12px', background: 'var(--bg-base)',
                border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13
              }}
            >
              <option value="todas">Todas las Psicólogas</option>
              {PSYCHOLOGISTS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Mostrando <strong>{cases.length}</strong> casos prioritarios
          </div>
        </div>

        {/* Tabla Operativa */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw className="spinner" size={24} style={{ margin: '0 auto 12px', display: 'block' }} />
              Cargando casos prioritarios...
            </div>
          ) : cases.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Flame size={36} style={{ color: 'var(--color-primary)', margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontWeight: 600, fontSize: 16 }}>No se encontraron casos prioritarios</div>
              <p style={{ fontSize: 13, marginTop: 4 }}>No hay clientes que coincidan con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', width: 140 }}>Urgencia</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', minWidth: 190 }}>Cliente (Persona A)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', minWidth: 220 }}>Comentario Customer Service</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', minWidth: 190 }}>Match Propuesto</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', width: 120 }}>Hecho por</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', minWidth: 200 }}>Comentario Matchmaker</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', width: 130 }}>Estado</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', width: 140 }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((item, idx) => {
                    const urgBadge = getUrgencyBadge(item.inactivity_days, item.urgency_level)
                    const stStyle = getStatusBadgeStyle(item.status)
                    const isApproved = item.status === 'APROBADO' || item.status === 'RESUELTO'

                    return (
                      <tr 
                        key={item.id || idx}
                        style={{
                          borderBottom: '1px solid rgba(150, 21, 0, 0.08)',
                          background: isApproved ? 'rgba(106, 168, 79, 0.03)' : (item.inactivity_days > 30 ? 'rgba(224, 102, 102, 0.03)' : 'transparent'),
                          transition: 'background 0.15s'
                        }}
                      >
                        {/* 1. Urgencia */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 14,
                            fontSize: 11,
                            fontWeight: 700,
                            background: urgBadge.bg,
                            color: urgBadge.color,
                            border: `1px solid ${urgBadge.border}`,
                            whiteSpace: 'nowrap'
                          }}>
                            {urgBadge.label}
                          </span>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                            {item.created_at || 'Sin fecha'}
                          </div>
                        </td>

                        {/* 2. Persona A */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <a
                              href={item.crm_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Abrir perfil en SmartMatchApp: ${item.client_name}`}
                              style={{
                                color: 'var(--text-primary)',
                                textDecoration: 'none',
                                fontWeight: 700,
                                fontSize: 14,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              className="hover-underline"
                            >
                              {item.client_name}
                              <ExternalLink size={12} style={{ color: 'var(--color-primary-light)', opacity: 0.8 }} />
                            </a>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                            {item.city} • <span style={{ color: 'var(--text-secondary)' }}>{item.plan_tier}</span>
                          </div>
                        </td>

                        {/* 3. Comentario CS */}
                        <td style={{ padding: '14px 16px', position: 'relative' }}>
                          <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4, maxWidth: 280 }}>
                            {item.cs_comment ? (
                              item.cs_comment
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin nota registrada</span>
                            )}
                          </div>
                          <button
                            onClick={() => setCommentModalCase(item)}
                            className="btn btn-ghost btn-sm"
                            style={{
                              padding: '2px 6px', fontSize: 11, marginTop: 4, display: 'inline-flex',
                              alignItems: 'center', gap: 4, border: '1px solid rgba(150, 21, 0, 0.2)'
                            }}
                            title="Editar comentario de CS"
                          >
                            <Edit3 size={11} /> Editar nota
                          </button>
                        </td>

                        {/* 4. Match Propuesto (Persona B) */}
                        <td style={{ padding: '14px 16px' }}>
                          {item.candidate_name ? (
                            <div>
                              <a
                                href={item.candidate_crm_url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Abrir perfil en SmartMatchApp: ${item.candidate_name}`}
                                style={{
                                  color: '#A2C4C9',
                                  textDecoration: 'none',
                                  fontWeight: 600,
                                  fontSize: 13,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                {item.candidate_name}
                                {item.candidate_crm_url && <ExternalLink size={11} />}
                              </a>
                            </div>
                          ) : (
                            <button
                              onClick={() => setMatchModalCase(item)}
                              className="btn btn-primary btn-sm"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                fontSize: 11, padding: '5px 10px', background: 'rgba(150, 21, 0, 0.85)'
                              }}
                            >
                              <Sparkles size={12} /> Buscar Match
                            </button>
                          )}
                        </td>

                        {/* 5. Hecho por */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            fontSize: 12, fontWeight: 600,
                            color: item.assigned_psychologist && item.assigned_psychologist !== 'Sin asignar' ? 'var(--text-primary)' : 'var(--text-muted)'
                          }}>
                            {item.assigned_psychologist || '—'}
                          </span>
                        </td>

                        {/* 6. Comentario Matchmaker */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, maxWidth: 260 }}>
                            {item.matchmaker_comment || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </div>
                        </td>

                        {/* 7. Estado */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 14,
                            fontSize: 11,
                            fontWeight: 700,
                            background: stStyle.bg,
                            color: stStyle.color,
                            border: `1px solid ${stStyle.border}`,
                            whiteSpace: 'nowrap'
                          }}>
                            {item.status}
                          </span>
                        </td>

                        {/* 8. Acciones */}
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <button
                              onClick={() => setMatchModalCase(item)}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '5px 8px', fontSize: 11 }}
                              title="Asignar o cambiar propuesta"
                            >
                              <Sparkles size={13} />
                            </button>

                            {item.candidate_name && !isApproved && (
                              <button
                                onClick={() => handleApprove(item)}
                                disabled={approvingId === item.id}
                                className="btn btn-primary btn-sm"
                                style={{
                                  padding: '5px 10px', fontSize: 11,
                                  background: '#2E7D32', display: 'inline-flex', alignItems: 'center', gap: 4
                                }}
                                title="Aprobar match y pasar a MATCHES oficial"
                              >
                                {approvingId === item.id ? (
                                  <RefreshCw size={11} className="spinner" />
                                ) : (
                                  <Check size={12} />
                                )}
                                Aprobar
                              </button>
                            )}

                            {isApproved && (
                              <span style={{ fontSize: 11, color: '#4CAF50', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <CheckCircle size={13} /> En Matches
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      {matchModalCase && (
        <BuscarMatchPrioritarioModal 
          caseItem={matchModalCase}
          onClose={() => setMatchModalCase(null)}
          onAssigned={() => fetchCases()}
        />
      )}

      {commentModalCase && (
        <EditarComentarioModal
          caseItem={commentModalCase}
          onClose={() => setCommentModalCase(null)}
          onSaved={() => fetchCases()}
        />
      )}

      {showNuevoModal && (
        <NuevoCasoModal
          onClose={() => setShowNuevoModal(false)}
          onCreated={() => fetchCases()}
        />
      )}
    </div>
  )
}
