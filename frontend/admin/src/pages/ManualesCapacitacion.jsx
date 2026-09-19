import React, { useState, useEffect, useMemo } from 'react'
import {
  BookOpen, Search, ArrowRight, ExternalLink, CheckCircle2,
  AlertCircle, HelpCircle, Copy, Check, Printer, ChevronDown,
  ChevronRight, Sparkles, Heart, Headphones, Shield, Wallet,
  Clock, MapPin, MessageCircle, FileText
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia')))
  ? window.location.origin
  : 'https://daily-lover.agentesia.cloud'

const ROLE_TABS = [
  { id: 'psicologas', label: '🩺 Psicólogas & Matchmakers', color: '#A855F7' },
  { id: 'servicio_cliente', label: '🎧 Servicio al Cliente (CS)', color: '#3B82F6' },
  { id: 'direccion', label: '👑 Dirección (María Paula)', color: '#10B981' },
  { id: 'finanzas', label: '💰 Finanzas & Lina (Refunds)', color: '#F59E0B' },
  { id: 'cliente_portal', label: '💖 Flujo del Cliente (Pase Digital)', color: '#EC4899' }
]

export default function ManualesCapacitacion() {
  const { user, token } = useAuth()
  const navigate = useNavigate()

  // Determinar pestaña inicial según rol del usuario logueado
  const getInitialRoleTab = () => {
    const role = (user?.role || '').toLowerCase()
    if (role.includes('psicolog') || role.includes('matchmaker')) return 'psicologas'
    if (role.includes('servicio') || role.includes('customer')) return 'servicio_cliente'
    if (role.includes('lina') || role.includes('finanz') || role.includes('refund')) return 'finanzas'
    return 'psicologas'
  }

  const [activeTab, setActiveTab] = useState(getInitialRoleTab)
  const [manuals, setManuals] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedText, setCopiedText] = useState('')
  const [expandedFaqs, setExpandedFaqs] = useState({})

  useEffect(() => {
    fetch(`${API}/api/v1/admin/manuals`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
      .then(r => r.json())
      .then(d => {
        if (d.manuals) setManuals(d.manuals)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [token])

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    setCopiedText(text)
    setTimeout(() => setCopiedText(''), 2500)
  }

  const toggleFaq = (idx) => {
    setExpandedFaqs(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  const activeManual = useMemo(() => {
    if (activeTab === 'cliente_portal') {
      return {
        id: 'cliente_portal',
        title: '💖 Manual del Cliente: Experiencia de Citas & Pase Digital',
        subtitle: 'Cómo vive el usuario final el proceso desde que recibe su confirmación hasta que llega al restaurante.',
        target_role: 'Clientes',
        badge_color: '#EC4899',
        steps: [
          {
            step: 1,
            title: 'Recepción del Mensaje con Pase Digital',
            route: '/portal-cliente',
            description: 'El cliente recibe por WhatsApp el mensaje formal de confirmación de su cita con el enlace seguro a su Pase Digital (ej: dailylover.org/mi-cita?t=k9f201).',
            tips: ['No requiere usuario ni contraseña; el enlace es seguro y privado para cada cita.'],
            shortcut_label: 'Ver Portal Cliente Demo'
          },
          {
            step: 2,
            title: 'Activación de Alertas en 1 Toque',
            route: '/portal-cliente',
            description: 'Al abrir el pase en su celular, el cliente ve la foto del restaurante, la hora y un botón grande: [ 🔔 Activar Recordatorios de mi Cita ]. Al tocar Permitir, su navegador (Chrome o Safari) queda suscrito a las alertas Web Push.',
            tips: ['En iPhone (iOS 16.4+) o Android funciona directamente en el navegador sin descargar apps de tiendas.'],
            shortcut_label: 'Simular Pase Móvil'
          },
          {
            step: 3,
            title: 'Recordatorio 24h Antes (Re-confirmación)',
            route: '/portal-cliente',
            description: 'El día anterior a la cita, el cliente recibe una notificación en su celular recordándole el date de mañana y permitiéndole tocar un botón verde [Confirmar Asistencia] que actualiza la mesa de CS en tiempo real.',
            tips: ['Evita cancelaciones imprevistas y garantiza que ambas partes estén sincronizadas.'],
            shortcut_label: 'Ver Estado de Asistencia'
          },
          {
            step: 4,
            title: 'El Día del Date (Puntualidad x2)',
            route: '/portal-cliente',
            description: 'Unas horas antes de la cita, el cliente recibe la alerta final recordándole que la mesa está a nombre de María Paula Salinas, con el mapa para abrir en Waze/Google Maps y recordatorio de puntualidad.',
            tips: ['El cliente puede tocar [Voy en camino] para avisarle a CS que ya salió de su casa.'],
            shortcut_label: 'Ver Mapa de Restaurante'
          }
        ],
        faqs: [
          {"q": "¿El cliente ve el nombre completo de la otra persona antes de la cita?", "a": "No por privacidad, solo ve el primer nombre (ej: Daniel) y el restaurante asignado."},
          {"q": "¿Qué pasa si el cliente no activa las alertas?", "a": "CS sigue teniendo el botón de respaldo de WhatsApp en su panel para escribirle manualmente si no activa las alertas."}
        ]
      }
    }
    return manuals.find(m => m.id === activeTab) || manuals[0]
  }, [activeTab, manuals])

  // Filtrar pasos por buscador
  const filteredSteps = useMemo(() => {
    if (!activeManual?.steps) return []
    if (!searchQuery.trim()) return activeManual.steps
    const q = searchQuery.toLowerCase()
    return activeManual.steps.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      (s.tips && s.tips.some(t => t.toLowerCase().includes(q)))
    )
  }, [activeManual, searchQuery])

  return (
    <div className="content-area" style={{ padding: '24px 32px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              background: 'rgba(150, 21, 0, 0.15)',
              padding: 8,
              borderRadius: 10,
              color: 'var(--color-primary)'
            }}>
              <BookOpen size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Centro de Capacitación & Manuales por Área
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                Guías operativas paso a paso, protocolos clínicos y logísticos para cada rol del equipo Daily Lover.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => window.print()}
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '8px 14px' }}
          >
            <Printer size={14} /> Imprimir / Exportar PDF
          </button>
        </div>
      </div>

      {/* Selector de Pestañas de Rol */}
      <div style={{
        display: 'flex',
        gap: 8,
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: 12,
        marginBottom: 20,
        overflowX: 'auto'
      }}>
        {ROLE_TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setSearchQuery('')
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 10,
                border: isActive ? `1.5px solid ${tab.color}` : '1px solid var(--border-color)',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                background: isActive ? tab.color : 'var(--bg-card)',
                color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                boxShadow: isActive ? '0 4px 14px rgba(0,0,0,0.2)' : 'none',
                transition: 'all 0.18s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Buscador de Procedimientos */}
      <div style={{ marginBottom: 24, maxWidth: 500 }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder={`Buscar en el manual de ${activeManual?.target_role || ''} (ej: HECHO, No-Show, WhatsApp)...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: 10,
              background: 'var(--bg-base)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: 13
            }}
          />
        </div>
      </div>

      {/* Contenido del Manual */}
      {activeManual && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Tarjeta de Encabezado del Rol */}
          <div className="card" style={{
            padding: 24,
            borderLeft: `5px solid ${activeManual.badge_color || 'var(--color-primary)'}`,
            background: 'var(--bg-card)'
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              {activeManual.title}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
              {activeManual.subtitle}
            </p>
          </div>

          {/* Pasos Numerados */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🚀</span> Flujo Paso a Paso Oficial ({filteredSteps.length} pasos)
            </div>

            {filteredSteps.map((stepItem, idx) => (
              <div
                key={stepItem.step}
                className="card"
                style={{
                  padding: 20,
                  display: 'flex',
                  gap: 16,
                  alignItems: 'flex-start',
                  position: 'relative'
                }}
              >
                {/* Número de Paso */}
                <div style={{
                  minWidth: 36,
                  height: 36,
                  borderRadius: 18,
                  background: activeManual.badge_color || 'var(--color-primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: 15,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                }}>
                  {stepItem.step}
                </div>

                {/* Contenido del Paso */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      {stepItem.title}
                    </h3>

                    {stepItem.route && (
                      <button
                        onClick={() => navigate(stepItem.route)}
                        className="btn btn-ghost btn-sm"
                        style={{
                          fontSize: 11,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          color: activeManual.badge_color || 'var(--color-primary)',
                          borderColor: 'var(--border-color)'
                        }}
                      >
                        {stepItem.shortcut_label || 'Ir a la pantalla'} <ArrowRight size={12} />
                      </button>
                    )}
                  </div>

                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                    {stepItem.description}
                  </p>

                  {/* Tips y Recomendaciones */}
                  {stepItem.tips && stepItem.tips.length > 0 && (
                    <div style={{
                      marginTop: 12,
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px dashed var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        💡 Recomendaciones Clave:
                      </div>
                      {stepItem.tips.map((tip, tIdx) => (
                        <div key={tIdx} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <span style={{ color: '#10B981' }}>✓</span>
                          <span>{tip}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Preguntas Frecuentes (FAQ) */}
          {activeManual.faqs && activeManual.faqs.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>❓</span> Preguntas Frecuentes & Protocolos de Excepción
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeManual.faqs.map((faq, fIdx) => {
                  const isExp = expandedFaqs[fIdx]
                  return (
                    <div
                      key={fIdx}
                      className="card"
                      style={{ padding: 16, cursor: 'pointer' }}
                      onClick={() => toggleFaq(fIdx)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {faq.q}
                        </span>
                        {isExp ? <ChevronDown size={16} color="var(--text-muted)" /> : <ChevronRight size={16} color="var(--text-muted)" />}
                      </div>

                      {isExp && (
                        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                          {faq.a}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
