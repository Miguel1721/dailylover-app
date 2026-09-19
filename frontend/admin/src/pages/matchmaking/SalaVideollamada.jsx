import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Video, Mic, MicOff, VideoOff, PhoneOff, Sparkles, 
  Clock, ShieldCheck, UserCheck, CheckCircle, FileText, 
  MessageSquare, User, AlertCircle, ArrowLeft, Send, Check,
  Brain, ClipboardList, Save, Star, Heart, Compass, ShieldAlert, Award, ExternalLink
} from 'lucide-react'
import CopilotoClinicoModal from '../../components/CopilotoClinicoModal'
import { useAuth } from '../../context/AuthContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

export default function SalaVideollamada() {
  const { sessionId } = useParams()
  const { token, user } = useAuth()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [activeLeftTab, setActiveLeftTab] = useState('percepcion') // 'percepcion' | 'objetivos' | 'expediente' | 'transcripcion'
  
  // Estado para Percepción Clínica (en vivo durante videollamada)
  const [perceptionData, setPerceptionData] = useState({
    speaking_confidence: 7,
    conversation_lead: 6,
    presentation_style: 'Arreglado',
    emotional_processing: 8,
    months_single: 12,
    self_awareness: 8,
    attachment_style: 'Seguro',
    love_language_received: 'Tiempo de calidad',
    love_language_given: 'Tiempo de calidad',
    love_language_flexibility: 7,
    non_negotiables: 'No tolerar cigarrillo. Gusto obligatorio por perros. Desea formar familia.',
    behavioral_risk_level: 1,
    flags_notes: '',
    synthesis_who_really_is: '',
    synthesis_first_date_behavior: '',
    synthesis_best_match_type: ''
  })

  // Estado para Datos Objetivos (en vivo)
  const [objectiveData, setObjectiveData] = useState({
    social_group_score: 7.0,
    education_level: 8,
    mobility_travel: 7,
    physical_activity_level: 6,
    social_energy_level: 7,
    life_structure_level: 8,
    weekend_style: 'Activo urbano'
  })

  const [savingForm, setSavingForm] = useState(false)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('')

  // Cargar expediente extendido previo del cliente si existe
  useEffect(() => {
    const uid = session?.client?.user_id
    if (uid) {
      fetch(`${API}/api/v1/matchmaking/extended-profile/${uid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(d => {
          if (d && d.profile) {
            const p = d.profile
            setPerceptionData(prev => ({
              ...prev,
              speaking_confidence: p.speaking_confidence ?? prev.speaking_confidence,
              conversation_lead: p.conversation_lead ?? prev.conversation_lead,
              presentation_style: p.presentation_style ?? prev.presentation_style,
              emotional_processing: p.emotional_processing ?? prev.emotional_processing,
              months_single: p.months_single ?? prev.months_single,
              self_awareness: p.self_awareness ?? prev.self_awareness,
              love_language_received: p.love_language_received ?? prev.love_language_received,
              love_language_given: p.love_language_given ?? prev.love_language_given,
              love_language_flexibility: p.love_language_flexibility ?? prev.love_language_flexibility,
              non_negotiables: typeof p.non_negotiables === 'string' ? p.non_negotiables : (Array.isArray(p.non_negotiables) ? p.non_negotiables.map(x => x.texto || x).join(', ') : prev.non_negotiables),
              behavioral_risk_level: p.behavioral_risk_level ?? prev.behavioral_risk_level,
              flags_notes: p.flags_notes ?? prev.flags_notes,
              synthesis_who_really_is: p.synthesis_who_really_is ?? prev.synthesis_who_really_is,
              synthesis_first_date_behavior: p.synthesis_first_date_behavior ?? prev.synthesis_first_date_behavior,
              synthesis_best_match_type: p.synthesis_best_match_type ?? prev.synthesis_best_match_type
            }))

            setObjectiveData(prev => ({
              ...prev,
              social_group_score: p.social_group_score ?? prev.social_group_score,
              education_level: p.education_level ?? prev.education_level,
              mobility_travel: p.mobility_travel ?? prev.mobility_travel,
              physical_activity_level: p.physical_activity_level ?? prev.physical_activity_level,
              social_energy_level: p.social_energy_level ?? prev.social_energy_level,
              life_structure_level: p.life_structure_level ?? prev.life_structure_level,
              weekend_style: Array.isArray(p.weekend_style) ? p.weekend_style[0] : (p.weekend_style || prev.weekend_style)
            }))
          }
        })
        .catch(() => {})
    }
  }, [session, token])

  // Guardar datos clínicos en vivo
  const handleSaveClinicalData = async (type) => {
    const uid = session?.client?.user_id
    if (!uid) {
      setSaveSuccessMsg('✓ Datos simulados guardados')
      setTimeout(() => setSaveSuccessMsg(''), 3000)
      return
    }

    setSavingForm(true)
    try {
      const payload = type === 'percepcion' ? {
        ...perceptionData,
        non_negotiables: [{ texto: perceptionData.non_negotiables, tipo: 'DB' }]
      } : {
        ...objectiveData,
        weekend_style: [objectiveData.weekend_style]
      }

      const res = await fetch(`${API}/api/v1/matchmaking/extended-profile/${uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        setSaveSuccessMsg(`✓ ${type === 'percepcion' ? 'Percepción Clínica' : 'Datos Objetivos'} guardados`)
        setTimeout(() => setSaveSuccessMsg(''), 3500)
      } else {
        alert('Error al guardar expediente')
      }
    } catch (e) {
      alert('Error de conexión al guardar')
    } finally {
      setSavingForm(false)
    }
  }
  
  // Transcripción en vivo
  const [liveTranscript, setLiveTranscript] = useState([
    { speaker: 'Psicóloga', text: 'Hola, un gusto saludarte. Cuéntame sobre tus expectativas para esta sesión.', time: '00:05' },
    { speaker: 'Candidato', text: 'Hola, gracias. Busco encontrar una persona madura con proyecto de vida claro y valores afines.', time: '00:18' },
    { speaker: 'Psicóloga', text: 'Perfecto. Hablemos de tus innegociables: ¿qué aspectos son indispensables para ti en una relación?', time: '00:35' },
    { speaker: 'Candidato', text: 'Para mí el respeto mutuo, no fumar bajo ningún motivo, y la intención genuina de formar familia en los próximos 3 años.', time: '01:05' }
  ])

  // Copiloto IA Modal
  const [showAiModal, setShowAiModal] = useState(false)
  const [aiAnalysisResult, setAiAnalysisResult] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)

  // Timer de duración
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Cargar datos de la sesión
  useEffect(() => {
    setLoading(true)
    const targetId = sessionId || '1'
    fetch(`${API}/api/v1/videocall/session/${targetId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        setSession(d)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching session:', err)
        setLoading(false)
      })
  }, [sessionId, token])

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  // Finalizar y procesar con Copiloto IA
  const handleCompleteAndAnalyze = async () => {
    setAnalyzing(true)
    const fullTranscript = liveTranscript.map(t => `${t.speaker}: ${t.text}`).join('\n')
    
    try {
      const apptId = session?.session_id || 1
      const res = await fetch(`${API}/api/v1/videocall/${apptId}/complete-and-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          transcript_text: fullTranscript,
          duration_seconds: callDuration,
          psychologist_observations: 'Excelente candidato formal, responde con soltura, buena introspección.'
        })
      })

      const data = await res.json()
      if (res.ok) {
        setAiAnalysisResult(data)
        setShowAiModal(true)
      } else {
        alert(data.detail || 'Error en el análisis de IA')
      }
    } catch (e) {
      alert('Error de red al procesar la sesión')
    } finally {
      setAnalyzing(false)
    }
  }

  const client = session?.client

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#0D0A0B',
      color: '#F5F0F1',
      overflow: 'hidden'
    }}>
      
      {/* 1. TOP HEADER DE LA SALA */}
      <header style={{
        background: '#110D0E',
        borderBottom: '1px solid rgba(150, 21, 0, 0.3)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate('/matchmaking/calendario')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#1A1214',
              border: '1px solid rgba(150, 21, 0, 0.3)',
              borderRadius: 8,
              padding: '6px 12px',
              color: '#9A8A8D',
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={14} />
            <span>Volver a Calendario</span>
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#F5F0F1' }}>
                Entrevista Clínica: {session?.client_name || 'Carlos Mendoza'}
              </h2>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 10
              }}>
                EN VIVO
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#9A8A8D', marginTop: 2 }}>
              Psicóloga asignada: <strong style={{ color: '#c41a00' }}>{session?.psychologist_name || 'ANA'}</strong> • Plan: Estándar (2 citas)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Indicador de Grabación */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 12px',
            borderRadius: 20,
            background: 'rgba(150, 21, 0, 0.2)',
            border: '1px solid rgba(150, 21, 0, 0.4)',
            fontSize: 11,
            color: '#c41a00',
            fontWeight: 600
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c41a00' }} />
            <span>Grabación consentida (IA activa)</span>
          </div>

          {/* Timer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'monospace',
            fontSize: 14,
            fontWeight: 700,
            color: '#F5F0F1',
            background: '#000',
            padding: '5px 12px',
            borderRadius: 8,
            border: '1px solid #333'
          }}>
            <Clock size={14} style={{ color: '#c41a00' }} />
            <span>{formatTimer(callDuration)}</span>
          </div>

          {/* Botón Finalizar y Analizar con IA */}
          <button
            onClick={handleCompleteAndAnalyze}
            disabled={analyzing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              background: '#961500',
              border: 'none',
              borderRadius: 8,
              color: '#FFF',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(150,21,0,0.5)',
              transition: 'all 0.2s'
            }}
          >
            <Sparkles size={14} />
            <span>{analyzing ? 'Analizando con IA...' : 'Finalizar y Analizar con IA'}</span>
          </button>
        </div>
      </header>

      {/* 2. BODY SPLIT (Evaluación Clínica & Percepción a la izquierda, Video a la derecha) */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(420px, 480px) 1fr', overflow: 'hidden' }}>
        
        {/* PANEL IZQUIERDO: PERCEPCIÓN PSICÓLOGA, DATOS OBJETIVOS, FICHA & TRANSCRIPCIÓN */}
        <div style={{
          background: '#110D0E',
          borderRight: '1px solid rgba(150, 21, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Tabs de Navegación Clínica */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(150, 21, 0, 0.2)', background: '#0D0A0B', overflowX: 'auto' }}>
            <button
              onClick={() => setActiveLeftTab('percepcion')}
              style={{
                flex: 1,
                padding: '11px 8px',
                fontSize: 11,
                fontWeight: 700,
                textAlign: 'center',
                background: activeLeftTab === 'percepcion' ? 'rgba(150, 21, 0, 0.2)' : 'transparent',
                border: 'none',
                borderBottom: activeLeftTab === 'percepcion' ? '2px solid #961500' : '2px solid transparent',
                color: activeLeftTab === 'percepcion' ? '#F5F0F1' : '#9A8A8D',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                whiteSpace: 'nowrap'
              }}
            >
              <Brain size={13} style={{ color: '#c41a00' }} />
              <span>🧠 Percepción</span>
            </button>

            <button
              onClick={() => setActiveLeftTab('objetivos')}
              style={{
                flex: 1,
                padding: '11px 8px',
                fontSize: 11,
                fontWeight: 700,
                textAlign: 'center',
                background: activeLeftTab === 'objetivos' ? 'rgba(150, 21, 0, 0.2)' : 'transparent',
                border: 'none',
                borderBottom: activeLeftTab === 'objetivos' ? '2px solid #961500' : '2px solid transparent',
                color: activeLeftTab === 'objetivos' ? '#F5F0F1' : '#9A8A8D',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                whiteSpace: 'nowrap'
              }}
            >
              <ClipboardList size={13} />
              <span>📋 Objetivos</span>
            </button>

            <button
              onClick={() => setActiveLeftTab('expediente')}
              style={{
                flex: 1,
                padding: '11px 8px',
                fontSize: 11,
                fontWeight: 700,
                textAlign: 'center',
                background: activeLeftTab === 'expediente' ? 'rgba(150, 21, 0, 0.2)' : 'transparent',
                border: 'none',
                borderBottom: activeLeftTab === 'expediente' ? '2px solid #961500' : '2px solid transparent',
                color: activeLeftTab === 'expediente' ? '#F5F0F1' : '#9A8A8D',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                whiteSpace: 'nowrap'
              }}
            >
              <FileText size={13} />
              <span>📄 Ficha</span>
            </button>

            <button
              onClick={() => setActiveLeftTab('transcripcion')}
              style={{
                flex: 1,
                padding: '11px 8px',
                fontSize: 11,
                fontWeight: 700,
                textAlign: 'center',
                background: activeLeftTab === 'transcripcion' ? 'rgba(150, 21, 0, 0.2)' : 'transparent',
                border: 'none',
                borderBottom: activeLeftTab === 'transcripcion' ? '2px solid #961500' : '2px solid transparent',
                color: activeLeftTab === 'transcripcion' ? '#F5F0F1' : '#9A8A8D',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                whiteSpace: 'nowrap'
              }}
            >
              <MessageSquare size={13} />
              <span>💬 Transcripción</span>
            </button>
          </div>

          <div style={{ flex: 1, padding: '16px 18px', overflowY: 'auto' }}>
            
            {/* Mensaje de Toast de Guardado Exitoso */}
            {saveSuccessMsg && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid #10B981',
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 14,
                color: '#A7F3D0',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <Check size={14} />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* TAB 1: PERCEPCIÓN PSICÓLOGA (FORMULARIO EN VIVO) */}
            {activeLeftTab === 'percepcion' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(150, 21, 0, 0.2)', paddingBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#F5F0F1' }}>
                    Evaluación Clínica en Llamada
                  </span>
                  <button
                    onClick={() => handleSaveClinicalData('percepcion')}
                    disabled={savingForm}
                    style={{
                      background: '#961500',
                      border: 'none',
                      borderRadius: 6,
                      padding: '5px 12px',
                      color: '#FFF',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Save size={12} />
                    <span>{savingForm ? 'Guardando...' : 'Guardar'}</span>
                  </button>
                </div>

                {/* 1. Primera Impresión */}
                <div style={{ background: '#1A1214', border: '1px solid rgba(150, 21, 0, 0.25)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#c41a00', textTransform: 'uppercase', marginBottom: 8 }}>
                    1. Primera Impresión en Cámara
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9A8A8D', marginBottom: 4 }}>
                        <span>Soltura y Seguridad al Hablar:</span>
                        <strong style={{ color: '#F5F0F1' }}>{perceptionData.speaking_confidence}/10</strong>
                      </div>
                      <input 
                        type="range" min="1" max="10" 
                        value={perceptionData.speaking_confidence} 
                        onChange={e => setPerceptionData({...perceptionData, speaking_confidence: Number(e.target.value)})}
                        style={{ width: '100%', accentColor: '#961500' }}
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9A8A8D', marginBottom: 4 }}>
                        <span>Liderazgo en la Conversación:</span>
                        <strong style={{ color: '#F5F0F1' }}>{perceptionData.conversation_lead}/10</strong>
                      </div>
                      <input 
                        type="range" min="1" max="10" 
                        value={perceptionData.conversation_lead} 
                        onChange={e => setPerceptionData({...perceptionData, conversation_lead: Number(e.target.value)})}
                        style={{ width: '100%', accentColor: '#961500' }}
                      />
                    </div>

                    <div>
                      <span style={{ fontSize: 11, color: '#9A8A8D', display: 'block', marginBottom: 4 }}>Presentación en Video:</span>
                      <select
                        value={perceptionData.presentation_style}
                        onChange={e => setPerceptionData({...perceptionData, presentation_style: e.target.value})}
                        style={{ width: '100%', background: '#0D0A0B', border: '1px solid rgba(150,21,0,0.3)', color: '#F5F0F1', padding: '6px 8px', borderRadius: 6, fontSize: 12 }}
                      >
                        <option value="Arreglado">Impecable / Muy Arreglado</option>
                        <option value="Casual">Casual / Natural</option>
                        <option value="Descuidado">Descuidado / Poca Preparación</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Dinámica Relacional & Apego */}
                <div style={{ background: '#1A1214', border: '1px solid rgba(150, 21, 0, 0.25)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#c41a00', textTransform: 'uppercase', marginBottom: 8 }}>
                    2. Apego & Madurez Afectiva
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <span style={{ fontSize: 11, color: '#9A8A8D', display: 'block', marginBottom: 4 }}>Estilo de Apego Percibido:</span>
                      <select
                        value={perceptionData.attachment_style}
                        onChange={e => setPerceptionData({...perceptionData, attachment_style: e.target.value})}
                        style={{ width: '100%', background: '#0D0A0B', border: '1px solid rgba(150,21,0,0.3)', color: '#F5F0F1', padding: '6px 8px', borderRadius: 6, fontSize: 12 }}
                      >
                        <option value="Seguro">Apego Seguro (Equilibrado y Comunicativo)</option>
                        <option value="Ansioso">Apego Ansioso / Necesidad de Validación</option>
                        <option value="Evitativo">Apego Evitativo / Sobre-independiente</option>
                        <option value="Desorganizado">Apego Desorganizado / Ambivalente</option>
                      </select>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9A8A8D', marginBottom: 4 }}>
                        <span>Procesamiento de Ex-parejas:</span>
                        <strong style={{ color: '#F5F0F1' }}>{perceptionData.emotional_processing}/10</strong>
                      </div>
                      <input 
                        type="range" min="1" max="10" 
                        value={perceptionData.emotional_processing} 
                        onChange={e => setPerceptionData({...perceptionData, emotional_processing: Number(e.target.value)})}
                        style={{ width: '100%', accentColor: '#961500' }}
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9A8A8D', marginBottom: 4 }}>
                        <span>Autoconciencia Vincular:</span>
                        <strong style={{ color: '#F5F0F1' }}>{perceptionData.self_awareness}/10</strong>
                      </div>
                      <input 
                        type="range" min="1" max="10" 
                        value={perceptionData.self_awareness} 
                        onChange={e => setPerceptionData({...perceptionData, self_awareness: Number(e.target.value)})}
                        style={{ width: '100%', accentColor: '#961500' }}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Innegociables Mencionados en Vivo */}
                <div style={{ background: '#1A1214', border: '1px solid rgba(150, 21, 0, 0.25)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#c41a00', textTransform: 'uppercase', marginBottom: 6 }}>
                    3. No Negociables / Dealbreakers
                  </div>
                  <textarea
                    rows={2}
                    value={perceptionData.non_negotiables}
                    onChange={e => setPerceptionData({...perceptionData, non_negotiables: e.target.value})}
                    placeholder="Escribe los dealbreakers que el candidato mencione durante la llamada..."
                    style={{
                      width: '100%',
                      background: '#0D0A0B',
                      border: '1px solid rgba(150,21,0,0.3)',
                      color: '#F5F0F1',
                      borderRadius: 6,
                      padding: 8,
                      fontSize: 12,
                      resize: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* 4. Síntesis Clínica Rápida */}
                <div style={{ background: '#1A1214', border: '1px solid rgba(150, 21, 0, 0.25)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#c41a00', textTransform: 'uppercase', marginBottom: 6 }}>
                    4. Síntesis Clínica (Quién es y Pareja Ideal)
                  </div>
                  <textarea
                    rows={2}
                    value={perceptionData.synthesis_who_really_is}
                    onChange={e => setPerceptionData({...perceptionData, synthesis_who_really_is: e.target.value})}
                    placeholder="Quién es realmente tras la llamada..."
                    style={{
                      width: '100%',
                      background: '#0D0A0B',
                      border: '1px solid rgba(150,21,0,0.3)',
                      color: '#F5F0F1',
                      borderRadius: 6,
                      padding: 8,
                      fontSize: 12,
                      resize: 'none',
                      boxSizing: 'border-box',
                      marginBottom: 8
                    }}
                  />
                  <textarea
                    rows={2}
                    value={perceptionData.synthesis_best_match_type}
                    onChange={e => setPerceptionData({...perceptionData, synthesis_best_match_type: e.target.value})}
                    placeholder="Perfil exacto de pareja recomendado..."
                    style={{
                      width: '100%',
                      background: '#0D0A0B',
                      border: '1px solid rgba(150,21,0,0.3)',
                      color: '#F5F0F1',
                      borderRadius: 6,
                      padding: 8,
                      fontSize: 12,
                      resize: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            )}

            {/* TAB 2: DATOS OBJETIVOS (1-10) */}
            {activeLeftTab === 'objetivos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(150, 21, 0, 0.2)', paddingBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#F5F0F1' }}>
                    Datos Objetivos y Estilo de Vida
                  </span>
                  <button
                    onClick={() => handleSaveClinicalData('objetivos')}
                    disabled={savingForm}
                    style={{
                      background: '#961500',
                      border: 'none',
                      borderRadius: 6,
                      padding: '5px 12px',
                      color: '#FFF',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Save size={12} />
                    <span>{savingForm ? 'Guardando...' : 'Guardar'}</span>
                  </button>
                </div>

                <div style={{ background: '#1A1214', border: '1px solid rgba(150, 21, 0, 0.25)', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#F5F0F1', fontWeight: 600, marginBottom: 4 }}>
                    <span>Puntaje Social Group (1.0 - 10.0):</span>
                    <strong style={{ color: '#c41a00', fontSize: 14 }}>{objectiveData.social_group_score}</strong>
                  </div>
                  <input 
                    type="range" min="1" max="10" step="0.5"
                    value={objectiveData.social_group_score} 
                    onChange={e => setObjectiveData({...objectiveData, social_group_score: parseFloat(e.target.value)})}
                    style={{ width: '100%', accentColor: '#961500' }}
                  />
                </div>

                <div style={{ background: '#1A1214', border: '1px solid rgba(150, 21, 0, 0.25)', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#F5F0F1', fontWeight: 600, marginBottom: 4 }}>
                    <span>Nivel Educativo / Intelectual:</span>
                    <strong style={{ color: '#c41a00' }}>{objectiveData.education_level}/10</strong>
                  </div>
                  <input 
                    type="range" min="1" max="10" 
                    value={objectiveData.education_level} 
                    onChange={e => setObjectiveData({...objectiveData, education_level: Number(e.target.value)})}
                    style={{ width: '100%', accentColor: '#961500' }}
                  />
                </div>

                <div style={{ background: '#1A1214', border: '1px solid rgba(150, 21, 0, 0.25)', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#F5F0F1', fontWeight: 600, marginBottom: 4 }}>
                    <span>Movilidad & Viajes:</span>
                    <strong style={{ color: '#c41a00' }}>{objectiveData.mobility_travel}/10</strong>
                  </div>
                  <input 
                    type="range" min="1" max="10" 
                    value={objectiveData.mobility_travel} 
                    onChange={e => setObjectiveData({...objectiveData, mobility_travel: Number(e.target.value)})}
                    style={{ width: '100%', accentColor: '#961500' }}
                  />
                </div>

                <div style={{ background: '#1A1214', border: '1px solid rgba(150, 21, 0, 0.25)', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#F5F0F1', fontWeight: 600, marginBottom: 4 }}>
                    <span>Actividad Física / Fitness:</span>
                    <strong style={{ color: '#c41a00' }}>{objectiveData.physical_activity_level}/10</strong>
                  </div>
                  <input 
                    type="range" min="1" max="10" 
                    value={objectiveData.physical_activity_level} 
                    onChange={e => setObjectiveData({...objectiveData, physical_activity_level: Number(e.target.value)})}
                    style={{ width: '100%', accentColor: '#961500' }}
                  />
                </div>

                <div style={{ background: '#1A1214', border: '1px solid rgba(150, 21, 0, 0.25)', borderRadius: 10, padding: 12 }}>
                  <span style={{ fontSize: 11, color: '#9A8A8D', display: 'block', marginBottom: 4 }}>Estilo de Fin de Semana Principal:</span>
                  <select
                    value={objectiveData.weekend_style}
                    onChange={e => setObjectiveData({...objectiveData, weekend_style: e.target.value})}
                    style={{ width: '100%', background: '#0D0A0B', border: '1px solid rgba(150,21,0,0.3)', color: '#F5F0F1', padding: '6px 8px', borderRadius: 6, fontSize: 12 }}
                  >
                    <option value="Casero">🛋️ Casero / Tranquilo</option>
                    <option value="Activo urbano">🏙️ Activo Urbano (Cultura/Gastronomía)</option>
                    <option value="Naturaleza-aventura">🌲 Naturaleza / Aventura / Deporte</option>
                    <option value="Social">🎉 Social / Eventos / Vida Nocturna</option>
                    <option value="Mixto">⚖️ Mixto y Flexible</option>
                  </select>
                </div>
              </div>
            )}

            {/* TAB 3: FICHA DE ADMISIÓN & INTAKE */}
            {activeLeftTab === 'expediente' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: '#1A1214', border: '1px solid rgba(150, 21, 0, 0.25)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#F5F0F1' }}>Ficha de Admisión</span>
                    <span style={{ fontSize: 11, color: '#c41a00', fontFamily: 'monospace' }}>ID: #{client?.user_id || '7810'}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                    <div>
                      <span style={{ color: '#9A8A8D', fontSize: 10, textTransform: 'uppercase', display: 'block' }}>Edad</span>
                      <strong style={{ color: '#F5F0F1' }}>{client?.age || 31} años</strong>
                    </div>
                    <div>
                      <span style={{ color: '#9A8A8D', fontSize: 10, textTransform: 'uppercase', display: 'block' }}>Ciudad</span>
                      <strong style={{ color: '#F5F0F1' }}>{client?.city || 'Bogotá'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#9A8A8D', fontSize: 10, textTransform: 'uppercase', display: 'block' }}>Profesión</span>
                      <strong style={{ color: '#F5F0F1' }}>{client?.occupation || 'Arquitecto & Diseñador'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#9A8A8D', fontSize: 10, textTransform: 'uppercase', display: 'block' }}>Teléfono</span>
                      <strong style={{ color: '#F5F0F1', fontFamily: 'monospace' }}>{client?.phone || '+57 300 456 7890'}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#1A1214', border: '1px solid rgba(150, 21, 0, 0.25)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, color: '#F5F0F1', marginBottom: 10 }}>
                    <ShieldCheck size={14} style={{ color: '#c41a00' }} />
                    <span>Innegociables Preliminares (Intake)</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: '#9A8A8D', fontSize: 12, lineHeight: 1.6 }}>
                    <li>No tolerar consumo habitual de tabaco o cigarrillo.</li>
                    <li>Deseo compartido de formar familia en los próximos 2 a 4 años.</li>
                    <li>Residencia estable en Bogotá o disposición a viajar.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 4: TRANSCRIPCIÓN EN VIVO */}
            {activeLeftTab === 'transcripcion' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {liveTranscript.map((t, idx) => {
                  const isPsych = t.speaker === 'Psicóloga'
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: isPsych ? 'rgba(150, 21, 0, 0.15)' : '#1A1214',
                        border: isPsych ? '1px solid rgba(150, 21, 0, 0.3)' : '1px solid #222',
                        fontSize: 12,
                        lineHeight: 1.5
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <strong style={{ color: isPsych ? '#c41a00' : '#10B981', fontSize: 11 }}>
                          {t.speaker}
                        </strong>
                        <span style={{ color: '#666', fontSize: 10 }}>{t.time}</span>
                      </div>
                      <div style={{ color: '#F5F0F1' }}>{t.text}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* FOOTER DEL PANEL IZQUIERDO: ACCESO DIRECTO A RESULTADOS DE MATCH */}
          <div style={{
            padding: '12px 18px',
            borderTop: '1px solid rgba(150, 21, 0, 0.25)',
            background: '#0D0A0B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <button
              onClick={() => {
                const uid = session?.client?.user_id || 1
                navigate(`/admin/matchmaking/entrevista?user_id=${uid}&tab=resultados`)
              }}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #10B981, #059669)',
                border: 'none',
                borderRadius: 8,
                padding: '9px 14px',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)'
              }}
            >
              <Sparkles size={14} />
              <span>Ver Sugerencias de Match de este Candidato</span>
              <ExternalLink size={12} />
            </button>
          </div>
        </div>

        {/* PANEL DERECHO: SALA DE VIDEOLLAMADA WEBRTC */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#080506', position: 'relative' }}>
          
          {/* Video Grid */}
          <div style={{
            flex: 1,
            padding: 24,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 20,
            alignItems: 'center'
          }}>
            
            {/* Tile 1: Psicóloga */}
            <div style={{
              height: '100%',
              maxHeight: 520,
              background: '#1A1214',
              borderRadius: 16,
              border: '1px solid rgba(150, 21, 0, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800"
                alt="Psicóloga"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(4px)',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: '#FFF'
              }}>
                Tú (Psicóloga Daily Lover)
              </div>
            </div>

            {/* Tile 2: Candidato */}
            <div style={{
              height: '100%',
              maxHeight: 520,
              background: '#1A1214',
              borderRadius: 16,
              border: '1px solid rgba(150, 21, 0, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800"
                alt="Candidato"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(4px)',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: '#FFF'
              }}>
                {session?.client_name || 'Carlos Mendoza'}
              </div>
            </div>

          </div>

          {/* DOCK DE CONTROLES INFERIOR */}
          <div style={{
            background: '#110D0E',
            borderTop: '1px solid rgba(150, 21, 0, 0.25)',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16
          }}>
            <button
              onClick={() => setIsMuted(!isMuted)}
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: isMuted ? '#EF4444' : '#1A1214',
                border: '1px solid rgba(150, 21, 0, 0.3)',
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title={isMuted ? 'Activar micrófono' : 'Silenciar'}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <button
              onClick={() => setIsVideoOff(!isVideoOff)}
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: isVideoOff ? '#EF4444' : '#1A1214',
                border: '1px solid rgba(150, 21, 0, 0.3)',
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title={isVideoOff ? 'Activar cámara' : 'Apagar cámara'}
            >
              {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
            </button>

            <button
              onClick={() => navigate('/matchmaking/calendario')}
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#EF4444',
                border: 'none',
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)'
              }}
              title="Colgar llamada"
            >
              <PhoneOff size={20} />
            </button>
          </div>

        </div>

      </div>

      {/* MODAL COPILOTO CLÍNICO IA */}
      {showAiModal && aiAnalysisResult && (
        <CopilotoClinicoModal
          analysisData={aiAnalysisResult}
          onClose={() => setShowAiModal(false)}
          onSaveAndProceed={() => {
            setShowAiModal(false)
            navigate('/matchmaking/calendario')
          }}
        />
      )}

    </div>
  )
}
