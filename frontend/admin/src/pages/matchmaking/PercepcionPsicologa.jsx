import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Save, CheckCircle, AlertCircle, Sparkles, Brain, Clock,
  Video, Eye, Heart, ShieldAlert, FileText, UserCheck, AlertTriangle
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import RatingSlider10 from '../../components/RatingSlider10'
import ClientSelectorBar from '../../components/ClientSelectorBar'
import DynamicFormSection from '../../components/DynamicFormSection'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

const LOVE_LANGUAGES = [
  'Palabras de afirmación',
  'Actos de servicio',
  'Regalos',
  'Tiempo de calidad',
  'Contacto físico'
]

const PHYSICAL_COMPLEXIONS = [
  'Delgado', 'Atlético', 'Promedio', 'Rellenito', 'Corpulento'
]

export default function PercepcionPsicologa({ standalone = true, onContinue, client = null }) {
  const { user, token } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlUserId = searchParams.get('user_id') || searchParams.get('id')

  const [selectedClient, setSelectedClient] = useState(client)
  const [schema, setSchema] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [exists, setExists] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [updatedBy, setUpdatedBy] = useState(null)

  // Form State
  const [formData, setFormData] = useState({
    // Bloque 0: Primera Impresión
    punctuality: 'A tiempo',
    presentation_camera: true,
    presentation_style: 'Arreglado',
    presentation_background: 'Ordenado',
    speaking_confidence: 5,
    conversation_lead: 5,

    // Bloque 3A: Historia de Relaciones
    attachment_style: 'Seguro',
    emotional_processing: 5,
    months_single: 12,
    self_awareness: 5,

    // Bloque 3B: Cariño
    love_language_given: 'Tiempo de calidad',
    love_language_received: 'Tiempo de calidad',
    love_language_flexibility: 5,

    // Bloque 4A: No Negociables
    non_negotiables: [
      { texto: '', tipo: 'DB' },
      { texto: '', tipo: 'DB' },
      { texto: '', tipo: 'PF' },
      { texto: '', tipo: 'PF' },
      { texto: '', tipo: 'PF' }
    ],

    // Bloque 4B: Tipo Físico
    physical_complexion: [],
    physical_importance: 5,
    physical_traits_notes: '',

    // Bloque 5: Red / Green Flags
    behavioral_risk_level: 1,
    flags_notes: '',

    // Bloque 6: Síntesis
    synthesis_who_really_is: '',
    synthesis_first_date_behavior: '',
    synthesis_best_match_type: '',
    dynamic_answers: {}
  })

  // Load dynamic form schema
  useEffect(() => {
    fetch(`${API}/api/v1/admin/forms/schemas/percepcion_psicologa`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
      .then(r => r.json())
      .then(d => {
        if (d && d.sections) setSchema(d)
      })
      .catch(err => console.warn('Usando estructura local para Percepción Psicóloga:', err))
  }, [token])

  // Load client from prop or URL
  useEffect(() => {
    if (client && (!selectedClient || selectedClient.id !== client.id)) {
      setSelectedClient(client)
      loadExtendedProfile(client.id)
    } else if (urlUserId && !selectedClient) {
      loadExtendedProfile(urlUserId)
    }
  }, [client, urlUserId])

  const handleSelectClient = (client) => {
    setSelectedClient(client)
    setSearchParams({ user_id: client.id })
    loadExtendedProfile(client.id)
  }

  const handleClearClient = () => {
    setSelectedClient(null)
    setSearchParams({})
    setExists(false)
    setLastUpdated(null)
    setUpdatedBy(null)
  }

  const loadExtendedProfile = (userId) => {
    setLoading(true)
    fetch(`${API}/api/v1/matchmaking/extended-profile/${userId}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
      .then(r => r.json())
      .then(res => {
        if (res.client) {
          setSelectedClient(res.client)
        }
        if (res.exists && res.profile) {
          const p = res.profile
          // Ensure non_negotiables array has 5 rows
          let nn = p.non_negotiables || []
          if (!Array.isArray(nn) || nn.length === 0) {
            nn = [
              { texto: '', tipo: 'DB' },
              { texto: '', tipo: 'DB' },
              { texto: '', tipo: 'PF' },
              { texto: '', tipo: 'PF' },
              { texto: '', tipo: 'PF' }
            ]
          } else {
            while (nn.length < 5) {
              nn.push({ texto: '', tipo: 'PF' })
            }
          }

          setFormData({
            punctuality: p.punctuality || 'A tiempo',
            presentation_camera: p.presentation_camera !== undefined && p.presentation_camera !== null ? p.presentation_camera : true,
            presentation_style: p.presentation_style || 'Arreglado',
            presentation_background: p.presentation_background || 'Ordenado',
            speaking_confidence: p.speaking_confidence || 5,
            conversation_lead: p.conversation_lead || 5,
            emotional_processing: p.emotional_processing || 5,
            months_single: p.months_single !== undefined && p.months_single !== null ? p.months_single : 12,
            self_awareness: p.self_awareness || 5,
            love_language_given: p.love_language_given || 'Tiempo de calidad',
            love_language_received: p.love_language_received || 'Tiempo de calidad',
            love_language_flexibility: p.love_language_flexibility || 5,
            non_negotiables: nn,
            physical_complexion: p.physical_complexion || [],
            physical_importance: p.physical_importance || 5,
            physical_traits_notes: p.physical_traits_notes || '',
            behavioral_risk_level: p.behavioral_risk_level || 1,
            flags_notes: p.flags_notes || '',
            synthesis_who_really_is: p.synthesis_who_really_is || '',
            synthesis_first_date_behavior: p.synthesis_first_date_behavior || '',
            synthesis_best_match_type: p.synthesis_best_match_type || '',
            attachment_style: p.attachment_style || 'Seguro',
            dynamic_answers: p.dynamic_answers || {}
          })
          setExists(true)
          setLastUpdated(p.updated_at)
          setUpdatedBy(p.updated_by)
        } else {
          setExists(false)
          setLastUpdated(null)
          setUpdatedBy(null)
          setFormData({
            punctuality: 'A tiempo',
            presentation_camera: true,
            presentation_style: 'Arreglado',
            presentation_background: 'Ordenado',
            speaking_confidence: 5,
            conversation_lead: 5,
            emotional_processing: 5,
            months_single: 12,
            self_awareness: 5,
            love_language_given: 'Tiempo de calidad',
            love_language_received: 'Tiempo de calidad',
            love_language_flexibility: 5,
            non_negotiables: [
              { texto: '', tipo: 'DB' },
              { texto: '', tipo: 'DB' },
              { texto: '', tipo: 'PF' },
              { texto: '', tipo: 'PF' },
              { texto: '', tipo: 'PF' }
            ],
            physical_complexion: [],
            physical_importance: 5,
            physical_traits_notes: '',
            behavioral_risk_level: 1,
            flags_notes: '',
            synthesis_who_really_is: '',
            synthesis_first_date_behavior: '',
            synthesis_best_match_type: '',
            attachment_style: 'Seguro',
            dynamic_answers: {}
          })
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Error loading extended profile:', err)
        setLoading(false)
      })
  }

  const defaultSectionIds = [
    'sec_primera_impresion', 'sec_historia_emocional', 'sec_tipo_fisico',
    'sec_semaforo_clinico', 'sec_sintesis_matchmaker'
  ]
  const defaultFieldIds = [
    'punctuality', 'presentation_camera', 'presentation_style', 'presentation_background',
    'speaking_confidence', 'conversation_lead', 'attachment_style', 'emotional_processing',
    'months_single', 'self_awareness', 'love_language_given', 'love_language_received',
    'love_language_flexibility', 'physical_importance', 'physical_traits_notes',
    'behavioral_risk_level', 'flags_notes', 'synthesis_who_really_is',
    'synthesis_first_date_behavior', 'synthesis_best_match_type'
  ]

  const customSections = schema?.sections ? schema.sections.map(sec => {
    if (!defaultSectionIds.includes(sec.id)) return sec
    const extraFields = (sec.fields || []).filter(f => !defaultFieldIds.includes(f.id))
    if (extraFields.length > 0) {
      return { ...sec, id: sec.id + '_custom', title: `${sec.title} (Campos Adicionales)`, fields: extraFields }
    }
    return null
  }).filter(Boolean) : []

  const handleFieldChange = (fieldId, value) => {
    if (defaultFieldIds.includes(fieldId)) {
      setFormData(prev => ({ ...prev, [fieldId]: value }))
    } else {
      setFormData(prev => ({
        ...prev,
        dynamic_answers: {
          ...(prev.dynamic_answers || {}),
          [fieldId]: value
        }
      }))
    }
  }

  const handleToggleComplexion = (item) => {
    setFormData(prev => {
      const cur = prev.physical_complexion || []
      if (cur.includes(item)) {
        return { ...prev, physical_complexion: cur.filter(x => x !== item) }
      } else {
        return { ...prev, physical_complexion: [...cur, item] }
      }
    })
  }

  const handleNonNegChange = (index, field, val) => {
    setFormData(prev => {
      const updated = [...prev.non_negotiables]
      updated[index] = { ...updated[index], [field]: val }
      return { ...prev, non_negotiables: updated }
    })
  }

  const handleSave = async (e) => {
    if (e) e.preventDefault()
    if (!selectedClient) {
      alert('Debes seleccionar un cliente primero.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        punctuality: formData.punctuality,
        presentation_camera: formData.presentation_camera,
        presentation_style: formData.presentation_style,
        presentation_background: formData.presentation_background,
        speaking_confidence: formData.speaking_confidence,
        conversation_lead: formData.conversation_lead,
        emotional_processing: formData.emotional_processing,
        months_single: formData.months_single,
        self_awareness: formData.self_awareness,
        love_language_given: formData.love_language_given,
        love_language_received: formData.love_language_received,
        love_language_flexibility: formData.love_language_flexibility,
        non_negotiables: formData.non_negotiables.filter(n => n.texto.trim().length > 0),
        physical_complexion: formData.physical_complexion,
        physical_importance: formData.physical_importance,
        physical_traits_notes: formData.physical_traits_notes,
        behavioral_risk_level: formData.behavioral_risk_level,
        flags_notes: formData.flags_notes,
        synthesis_who_really_is: formData.synthesis_who_really_is.slice(0, 200),
        synthesis_first_date_behavior: formData.synthesis_first_date_behavior.slice(0, 200),
        synthesis_best_match_type: formData.synthesis_best_match_type.slice(0, 200),
        attachment_style: formData.attachment_style || 'Seguro',
        dynamic_answers: formData.dynamic_answers || {},
        updated_by: user?.name || 'Psicóloga'
      }

      const res = await fetch(`${API}/api/v1/matchmaking/extended-profile/${selectedClient.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al guardar los datos')

      setExists(true)
      setLastUpdated(data.profile?.updated_at || new Date().toISOString())
      setUpdatedBy(data.profile?.updated_by || user?.name || 'Psicóloga')
      setToast({ type: 'success', text: '¡Percepción de la Psicóloga guardada con éxito en la base de datos!' })
      setTimeout(() => setToast(null), 4500)
    } catch (err) {
      console.error('Error saving extended profile:', err)
      setToast({ type: 'error', text: err.message || 'Error al guardar' })
      setTimeout(() => setToast(null), 5000)
    } finally {
      setSaving(false)
    }
  }

  const isRecentBreakup = Number(formData.months_single) < 6

  return (
    <div style={{ paddingBottom: 60 }}>
      {standalone && (
        <div className="page-header" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'rgba(150, 21, 0, 0.15)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Brain size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
                🧠 Formulario 2: Percepción Clínica de la Psicóloga
              </h1>
              <p className="page-subtitle" style={{ margin: '3px 0 0' }}>
                Digitalización estructurada de la entrevista: impresión, apego, no negociables, tipo físico y síntesis.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={standalone ? "content-area" : ""}>
        {standalone && (
          <ClientSelectorBar
            selectedClient={selectedClient}
            onSelectClient={handleSelectClient}
            onClearClient={handleClearClient}
            lastUpdated={lastUpdated}
            updatedBy={updatedBy}
            exists={exists}
          />
        )}

        {/* Toast Notification */}
        {toast && (
          <div style={{
            marginBottom: 20,
            padding: '12px 18px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: toast.type === 'success' ? 'rgba(76, 175, 80, 0.18)' : 'rgba(150, 21, 0, 0.18)',
            border: `1px solid ${toast.type === 'success' ? '#4CAF50' : '#ff6b6b'}`,
            color: toast.type === 'success' ? '#4CAF50' : '#ff6b6b',
            fontSize: 14,
            fontWeight: 600,
            boxShadow: '0 4px 14px rgba(0,0,0,0.3)'
          }}>
            {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            {toast.text}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Cargando evaluación clínica del cliente...</div>
          </div>
        )}

        {/* Empty State when no client selected */}
        {!selectedClient && !loading && (
          <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(150, 21, 0, 0.1)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Brain size={32} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
              Selecciona un cliente para evaluar
            </h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: 460, margin: '0 auto 20px', fontSize: 13, lineHeight: 1.5 }}>
              Busca al cliente por nombre o teléfono para ingresar o actualizar las notas y puntajes de la entrevista diagnóstica.
            </p>
          </div>
        )}

        {/* Active Form */}
        {selectedClient && !loading && (
          <form onSubmit={handleSave}>
            {/* BLOQUE 0: Primera Impresión */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
                <Eye size={18} style={{ color: 'var(--color-primary)' }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Bloque 0 — Primera Impresión & Desenvoltura
                </h2>
              </div>

              {/* Puntualidad */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
                  Puntualidad al conectar a la llamada
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                  {['Temprano', 'A tiempo', 'Tarde con disculpa', 'Tarde sin disculpa'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFormData({ ...formData, punctuality: opt })}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: formData.punctuality === opt ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                        background: formData.punctuality === opt ? 'rgba(150, 21, 0, 0.22)' : 'var(--bg-base)',
                        color: formData.punctuality === opt ? '#fff' : 'var(--text-secondary)'
                      }}
                    >
                      {formData.punctuality === opt ? '✓ ' : ''}{opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Presentación (Cámara, Estilo, Fondo) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
                {/* Cámara */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    Cámara
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, presentation_camera: true })}
                      style={{
                        flex: 1, padding: '7px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: formData.presentation_camera ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                        background: formData.presentation_camera ? 'rgba(150,21,0,0.2)' : 'var(--bg-base)',
                        color: formData.presentation_camera ? '#fff' : 'var(--text-muted)'
                      }}
                    >
                      Encendida
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, presentation_camera: false })}
                      style={{
                        flex: 1, padding: '7px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: !formData.presentation_camera ? '1px solid #ff6b6b' : '1px solid var(--border-color)',
                        background: !formData.presentation_camera ? 'rgba(150,21,0,0.2)' : 'var(--bg-base)',
                        color: !formData.presentation_camera ? '#ff6b6b' : 'var(--text-muted)'
                      }}
                    >
                      Apagada
                    </button>
                  </div>
                </div>

                {/* Estilo Personal */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    Estilo / Apariencia
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['Arreglado', 'Casual'].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFormData({ ...formData, presentation_style: s })}
                        style={{
                          flex: 1, padding: '7px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          border: formData.presentation_style === s ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                          background: formData.presentation_style === s ? 'rgba(150,21,0,0.2)' : 'var(--bg-base)',
                          color: formData.presentation_style === s ? '#fff' : 'var(--text-muted)'
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fondo de Cámara */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    Entorno / Fondo
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['Ordenado', 'Caótico'].map(b => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setFormData({ ...formData, presentation_background: b })}
                        style={{
                          flex: 1, padding: '7px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          border: formData.presentation_background === b ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                          background: formData.presentation_background === b ? 'rgba(150,21,0,0.2)' : 'var(--bg-base)',
                          color: formData.presentation_background === b ? '#fff' : 'var(--text-muted)'
                        }}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Seguridad al hablar */}
              <RatingSlider10
                label="Seguridad y Fluidez al Hablar"
                hint="Nivel de elocuencia, aplomo y confianza al expresarse."
                value={formData.speaking_confidence}
                onChange={(v) => setFormData({ ...formData, speaking_confidence: v })}
                min={1}
                max={10}
                leftAnchor="1 - Muy tímido / nervioso / dubitativo"
                middleAnchor="5 - Fluido y natural"
                rightAnchor="10 - Muy seguro / alta oratoria y carisma"
              />

              {/* Quién lleva la conversación */}
              <RatingSlider10
                label="Dirección de la Conversación (Dinamismo)"
                hint="Balance entre iniciativa conversacional y capacidad de escucha."
                value={formData.conversation_lead}
                onChange={(v) => setFormData({ ...formData, conversation_lead: v })}
                min={1}
                max={10}
                leftAnchor="1 - Hay que sacarle las respuestas con cuchara"
                middleAnchor="5 - Diálogo bidireccional fluido"
                rightAnchor="10 - Monopoliza la palabra / cuesta intervenir"
              />
            </div>

            {/* BLOQUE 3A: Historia de Relaciones */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
                <Clock size={18} style={{ color: 'var(--color-primary)' }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Bloque 3A — Dinámica Vincular, Apego & Cierre Emocional
                </h2>
              </div>

              {/* Estilo de Apego Percibido */}
              <div style={{
                marginBottom: 22,
                padding: '16px 18px',
                background: 'rgba(150, 21, 0, 0.05)',
                borderRadius: 10,
                border: '1.5px solid rgba(150, 21, 0, 0.3)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <label style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)', display: 'block' }}>
                      🧠 Estilo de Apego Percibido (Juicio Clínico de la Psicóloga)
                    </label>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Prioridad clínica absoluta sobre lo auto-declarado por el cliente en el CRM.
                    </span>
                  </div>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 8,
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10B981',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    ✓ Pesa más que el CRM
                  </span>
                </div>
                <select
                  value={formData.attachment_style || 'Seguro'}
                  onChange={(e) => setFormData({ ...formData, attachment_style: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontWeight: 700
                  }}
                >
                  <option value="Seguro">Apego Seguro (Equilibrado, autónomo, asertivo y constructivo)</option>
                  <option value="Ansioso">Apego Ansioso (Preocupado / Necesidad de validación constante / Hiperactivación)</option>
                  <option value="Evitativo">Apego Evitativo (Distante / Sobre-independencia defensiva / Desactivación afectiva)</option>
                  <option value="Desorganizado">Apego Desorganizado (Temeroso / Ambivalente / Oscilación entre cercanía y huida)</option>
                </select>
              </div>

              {/* Procesamiento Emocional */}
              <RatingSlider10
                label="Nivel de Procesamiento Emocional (Cierre de Ex-Parejas)"
                hint="Semáforo de duelo: rencor vs paz y madurez reflexiva."
                value={formData.emotional_processing}
                onChange={(v) => setFormData({ ...formData, emotional_processing: v })}
                min={1}
                max={10}
                leftAnchor="1 - Resentimiento activo / culpa total al ex"
                middleAnchor="5 - En proceso de superación"
                rightAnchor="10 - Totalmente sanado y en paz / aprendizaje claro"
              />

              {/* Meses de Soltería */}
              <div style={{
                marginBottom: 20,
                padding: '16px 18px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 10,
                border: isRecentBreakup ? '1px solid rgba(255, 107, 107, 0.4)' : '1px solid rgba(150, 21, 0, 0.12)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', display: 'block' }}>
                      Tiempo de Soltería (Meses Transcurridos)
                    </label>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Meses desde la ruptura de su última relación formal.
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={formData.months_single}
                      onChange={(e) => setFormData({ ...formData, months_single: parseInt(e.target.value, 10) || 0 })}
                      style={{
                        width: 80,
                        padding: '6px 10px',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 6,
                        color: 'var(--text-primary)',
                        fontSize: 14,
                        fontWeight: 700,
                        textAlign: 'center'
                      }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>meses</span>
                  </div>
                </div>

                {isRecentBreakup && (
                  <div style={{
                    marginTop: 10,
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'rgba(255, 107, 107, 0.15)',
                    color: '#ff6b6b',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <AlertTriangle size={14} /> Alerta clínica: Menos de 6 meses de soltería. Posible relación rebote o duelo inconcluso.
                  </div>
                )}
              </div>

              {/* Autoconocimiento */}
              <RatingSlider10
                label="Nivel de Autoconocimiento y Responsabilidad Afectiva"
                hint="Capacidad para identificar sus propios errores y patrones repetitivos."
                value={formData.self_awareness}
                onChange={(v) => setFormData({ ...formData, self_awareness: v })}
                min={1}
                max={10}
                leftAnchor="1 - Cero autocrítica / victimización recurrente"
                middleAnchor="5 - Conciencia moderada"
                rightAnchor="10 - Alta lucidez / reconoce su responsabilidad con madurez"
              />
            </div>

            {/* BLOQUE 3B: Cómo Da y Recibe Cariño */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
                <Heart size={18} style={{ color: 'var(--color-primary)' }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Bloque 3B — Lenguajes del Amor (Cómo Da y Cómo Recibe)
                </h2>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                La guía resalta que el lenguaje para dar frecuentemente difiere del lenguaje esperado para recibir.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                {/* Da */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
                    Lenguaje Principal con el que DA Cariño
                  </label>
                  <select
                    value={formData.love_language_given}
                    onChange={(e) => setFormData({ ...formData, love_language_given: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      color: 'var(--text-primary)',
                      fontSize: 13
                    }}
                  >
                    {LOVE_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>

                {/* Recibe */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
                    Lenguaje Principal con el que RECIBE Cariño
                  </label>
                  <select
                    value={formData.love_language_received}
                    onChange={(e) => setFormData({ ...formData, love_language_received: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      color: 'var(--text-primary)',
                      fontSize: 13
                    }}
                  >
                    {LOVE_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              {/* Flexibilidad en Lenguaje del Amor */}
              <RatingSlider10
                label="Flexibilidad en el Lenguaje de Afecto"
                hint="Apertura a recibir afecto de maneras distintas a su preferencia primaria."
                value={formData.love_language_flexibility}
                onChange={(v) => setFormData({ ...formData, love_language_flexibility: v })}
                min={1}
                max={10}
                leftAnchor="1 - Rígido: o recibe su lenguaje o no se siente amado"
                middleAnchor="5 - Adaptable con comunicación"
                rightAnchor="10 - Totalmente flexible / valora cualquier gesto genuino"
              />
            </div>

            {/* BLOQUE 4A: No Negociables (Deal-Breakers & Preferencias Fuertes) */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
                <ShieldAlert size={18} style={{ color: 'var(--color-primary)' }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Bloque 4A — Criterios No Negociables (Deal-Breakers vs Preferencias Fuertes)
                </h2>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Hasta 5 criterios esenciales. Clasifica cada uno como <strong style={{ color: '#ff6b6b' }}>DB (Deal-Breaker Absoluto)</strong> o <strong style={{ color: '#2196F3' }}>PF (Preferencia Fuerte)</strong>.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {formData.non_negotiables.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      width: 24,
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textAlign: 'center'
                    }}>
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      placeholder={`Ej: ${idx === 0 ? 'No fumador bajo ninguna circunstancia' : idx === 1 ? 'Sin hijos o que no quiera más' : 'Profesional con estabilidad...'}`}
                      value={item.texto}
                      onChange={(e) => handleNonNegChange(idx, 'texto', e.target.value)}
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        color: 'var(--text-primary)',
                        fontSize: 13
                      }}
                    />
                    {/* DB vs PF Toggle */}
                    <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                      <button
                        type="button"
                        onClick={() => handleNonNegChange(idx, 'tipo', 'DB')}
                        style={{
                          padding: '7px 12px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: 'none',
                          background: item.tipo === 'DB' ? '#961500' : 'var(--bg-base)',
                          color: item.tipo === 'DB' ? '#fff' : 'var(--text-muted)'
                        }}
                        title="Deal-Breaker Absoluto (Filtro Duro)"
                      >
                        DB (Filtro Duro)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNonNegChange(idx, 'tipo', 'PF')}
                        style={{
                          padding: '7px 12px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: 'none',
                          background: item.tipo === 'PF' ? '#1E3A8A' : 'var(--bg-base)',
                          color: item.tipo === 'PF' ? '#fff' : 'var(--text-muted)'
                        }}
                        title="Preferencia Fuerte (Negociable si hay buen match)"
                      >
                        PF (Fuerte)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* BLOQUE 4B: Tipo Físico */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
                <UserCheck size={18} style={{ color: 'var(--color-primary)' }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Bloque 4B — Filtro Visual & Tipo Físico
                </h2>
              </div>

              {/* Complexión deseada */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Complexión Deseada en la Pareja (Multi-select)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {PHYSICAL_COMPLEXIONS.map((comp) => {
                    const active = (formData.physical_complexion || []).includes(comp)
                    return (
                      <button
                        key={comp}
                        type="button"
                        onClick={() => handleToggleComplexion(comp)}
                        style={{
                          padding: '7px 14px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: active ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                          background: active ? 'rgba(150, 21, 0, 0.2)' : 'var(--bg-base)',
                          color: active ? '#fff' : 'var(--text-secondary)'
                        }}
                      >
                        {active ? '✓ ' : ''}{comp}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Importancia del Físico */}
              <RatingSlider10
                label="Peso del Factor Físico en la Decisión"
                hint="Cuánto influye la atracción visual antes de profundizar en la personalidad."
                value={formData.physical_importance}
                onChange={(v) => setFormData({ ...formData, physical_importance: v })}
                min={1}
                max={10}
                leftAnchor="1 - El físico es secundario / no es determinante"
                middleAnchor="5 - Importancia equilibrada"
                rightAnchor="10 - Filtro físico indispensable / sin excepciones"
              />

              {/* Rasgos específicos libres */}
              <div>
                <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                  Rasgos Físicos Específicos (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Estatura mínima 1.75m, barba, cabello oscuro, sonrisa atractiva..."
                  value={formData.physical_traits_notes}
                  onChange={(e) => setFormData({ ...formData, physical_traits_notes: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13
                  }}
                />
              </div>
            </div>

            {/* BLOQUE 5: Red / Green Flags */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
                <ShieldAlert size={18} style={{ color: 'var(--color-primary)' }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Bloque 5 — Red & Green Flags (Nivel de Riesgo Conductual)
                </h2>
              </div>

              {/* Riesgo conductual */}
              <RatingSlider10
                label="Nivel de Riesgo Conductual Percibido"
                hint="Presencia de banderas rojas en comunicación, manipulación, impaciencia o falta de respeto."
                value={formData.behavioral_risk_level}
                onChange={(v) => setFormData({ ...formData, behavioral_risk_level: v })}
                min={1}
                max={10}
                leftAnchor="1 - Perfil limpio / Green flags evidentes"
                middleAnchor="5 - Precaución moderada / detalles a observar"
                rightAnchor="10 - Alerta roja crítica / Riesgo de mala experiencia"
              />

              {/* Notas de banderas */}
              <div>
                <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                  Detalle Clínico de Banderas Rojas / Verdes
                </label>
                <textarea
                  rows={3}
                  placeholder="Ej: Trato muy educado con el equipo (Green Flag). Sin embargo, habla con frustración de sus últimas 3 citas (Red Flag leve)..."
                  value={formData.flags_notes}
                  onChange={(e) => setFormData({ ...formData, flags_notes: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    lineHeight: 1.4
                  }}
                />
              </div>
            </div>

            {/* BLOQUE 6: Síntesis Clínica (3 Preguntas Clave) */}
            <div className="card" style={{ marginBottom: 24, border: '1px solid rgba(150, 21, 0, 0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
                <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Bloque 6 — Síntesis Clínica de la Psicóloga (El Corazón del Match)
                </h2>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                Las 3 respuestas diagnósticas más valiosas de la entrevista. Concisas, directas y con límite estricto de caracteres.
              </p>

              {/* Pregunta 1: Quién es realmente */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                    1. ¿Cómo es realmente en el fondo?
                  </label>
                  <span style={{ fontSize: 11, color: formData.synthesis_who_really_is.length >= 180 ? '#ff6b6b' : 'var(--text-muted)' }}>
                    {formData.synthesis_who_really_is.length} / 200 caracteres
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="Ej: Hombre leal, reservado de entrada pero cálido una vez entra en confianza."
                  value={formData.synthesis_who_really_is}
                  onChange={(e) => setFormData({ ...formData, synthesis_who_really_is: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13
                  }}
                />
              </div>

              {/* Pregunta 2: Primera Cita */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                    2. ¿Cómo se comporta en la primera cita?
                  </label>
                  <span style={{ fontSize: 11, color: formData.synthesis_first_date_behavior.length >= 180 ? '#ff6b6b' : 'var(--text-muted)' }}>
                    {formData.synthesis_first_date_behavior.length} / 200 caracteres
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="Ej: Caballero atento, hace preguntas de calidad pero necesita un ambiente tranquilo."
                  value={formData.synthesis_first_date_behavior}
                  onChange={(e) => setFormData({ ...formData, synthesis_first_date_behavior: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13
                  }}
                />
              </div>

              {/* Pregunta 3: Mejor match */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                    3. ¿Con qué perfil de persona hace el mejor match?
                  </label>
                  <span style={{ fontSize: 11, color: formData.synthesis_best_match_type.length >= 180 ? '#ff6b6b' : 'var(--text-muted)' }}>
                    {formData.synthesis_best_match_type.length} / 200 caracteres
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="Ej: Mujer profesional independiente con buen humor, que tome iniciativa en la conversación."
                  value={formData.synthesis_best_match_type}
                  onChange={(e) => setFormData({ ...formData, synthesis_best_match_type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13
                  }}
                />
              </div>
            </div>

            {/* Secciones Dinámicas Adicionales Configuradas por María / Admin */}
            {customSections && customSections.length > 0 && (
              <div style={{ marginTop: 24, marginBottom: 24 }}>
                <div style={{ padding: '10px 16px', background: 'rgba(150, 21, 0, 0.1)', border: '1px solid var(--border-color)', borderRadius: 8, marginBottom: 16, fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>
                  ⚙️ Preguntas Adicionales Configuradas Dinámicamente
                </div>
                {customSections.map(sec => (
                  <DynamicFormSection
                    key={sec.id}
                    section={sec}
                    values={formData}
                    onChange={handleFieldChange}
                  />
                ))}
              </div>
            )}

            {/* Bottom Sticky Action Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 24px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              boxShadow: '0 -4px 20px rgba(0,0,0,0.3)'
            }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Cliente evaluado: <strong style={{ color: 'var(--text-primary)' }}>{selectedClient.name}</strong>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 24px',
                  fontSize: 14,
                  fontWeight: 700
                }}
              >
                {saving ? (
                  <>
                    <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    Guardando evaluación...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Guardar Percepción de la Psicóloga
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
