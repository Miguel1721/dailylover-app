import React, { useState, useMemo } from 'react'
import { Copy, Check, Sparkles, FileText } from 'lucide-react'

// Configuration of recognized clinical sections with optimized color badges for Light & Dark
const SECTION_DEFINITIONS = [
  {
    id: 'vivienda',
    title: 'Vivienda & Ubicación',
    icon: '🏠',
    badgeBgLight: '#E0F2FE',
    badgeTextLight: '#0369A1',
    badgeBgDark: 'rgba(3, 105, 161, 0.25)',
    badgeTextDark: '#38BDF8',
    regex: /(?:^|[\.\n])\s*(?:Vive con quien y donde exacto|Vivienda|Donde vive|Vive con|Ubicaci[oó]n)\s*:\s*/i,
  },
  {
    id: 'intro',
    title: 'Perfil & Ocupación',
    icon: '💼',
    badgeBgLight: '#F1F5F9',
    badgeTextLight: '#334155',
    badgeBgDark: 'rgba(148, 163, 184, 0.18)',
    badgeTextDark: '#CBD5E1',
    regex: /(?:^|[\.\n])\s*(?:INTRO\s*:?\s*Cu[eé]ntame quien eres[^\.]*\.?|INTRO\s*:|Perfil\s*:|Qui[eé]n es\s*:|Trabajo\s*:|Ocupaci[oó]n\s*:)\s*/i,
  },
  {
    id: 'rutina',
    title: 'Rutina (Lunes a Viernes)',
    icon: '⏰',
    badgeBgLight: '#FEF3C7',
    badgeTextLight: '#92400E',
    badgeBgDark: 'rgba(217, 119, 6, 0.22)',
    badgeTextDark: '#FBBF24',
    regex: /(?:^|[\.\n])\s*(?:L a V|Lunes a Viernes|Rutina entre semana|D[ií]a a d[ií]a|Semana)\s*:\s*/i,
  },
  {
    id: 'fds',
    title: 'Fines de Semana (FDS)',
    icon: '🎉',
    badgeBgLight: '#DCFCE7',
    badgeTextLight: '#166534',
    badgeBgDark: 'rgba(22, 101, 52, 0.25)',
    badgeTextDark: '#4ADE80',
    regex: /(?:^|[\.\n])\s*(?:FDS|Fin(?:es)? de semana)\s*:\s*/i,
  },
  {
    id: 'hobbies',
    title: 'Hobbies & Tiempo Libre',
    icon: '🎨',
    badgeBgLight: '#F3E8FF',
    badgeTextLight: '#6B21A8',
    badgeBgDark: 'rgba(107, 33, 168, 0.25)',
    badgeTextDark: '#C084FC',
    regex: /(?:^|[\.\n])\s*(?:HOBBIES|Pasatiempos|Intereses|Tiempo libre)\s*:\s*/i,
  },
  {
    id: 'busca',
    title: 'Lo que Busca en Pareja',
    icon: '🔍',
    badgeBgLight: '#FFE4E6',
    badgeTextLight: '#9F1239',
    badgeBgDark: 'rgba(159, 18, 57, 0.25)',
    badgeTextDark: '#FDA4AF',
    regex: /(?:^|[\.\n])\s*(?:BUSCA|Qu[eé] busca|Pareja ideal|Perfil deseado)\s*:\s*/i,
  },
  {
    id: 'fisico',
    title: 'Expectativas Físicas',
    icon: '👀',
    badgeBgLight: '#FCE7F3',
    badgeTextLight: '#9D174D',
    badgeBgDark: 'rgba(157, 23, 77, 0.25)',
    badgeTextDark: '#F472B6',
    regex: /(?:^|[\.\n,])\s*(?:F[ií]sicamente|Aspecto f[ií]sico|F[ií]sico)\s*(?:,|\s*:)\s*/i,
  },
  {
    id: 'personalidad',
    title: 'Personalidad & Dinámica de Pareja',
    icon: '🧠',
    badgeBgLight: '#E0E7FF',
    badgeTextLight: '#3730A3',
    badgeBgDark: 'rgba(55, 48, 163, 0.25)',
    badgeTextDark: '#818CF8',
    regex: /(?:^|[\.\n,])\s*(?:Personalidad|Car[aá]cter|Din[aá]mica de pareja|Forma de ser)\s*(?:,|\s*:)\s*/i,
  },
  {
    id: 'rango_edad',
    title: 'Rango de Edad Deseado',
    icon: '🎯',
    badgeBgLight: '#FEF9C3',
    badgeTextLight: '#854D0E',
    badgeBgDark: 'rgba(234, 179, 8, 0.22)',
    badgeTextDark: '#FDE047',
    regex: /(?:^|[\.\n,\s])\s*RANGO DE EDAD\s*:\s*/i,
  },
  {
    id: 'hijos',
    title: 'Preferencia sobre Hijos',
    icon: '👶',
    badgeBgLight: '#E0F2FE',
    badgeTextLight: '#075985',
    badgeBgDark: 'rgba(14, 165, 233, 0.22)',
    badgeTextDark: '#38BDF8',
    regex: /(?:^|[\.\n,\s])\s*HIJOS\s*:\s*/i,
  },
  {
    id: 'distancia',
    title: 'Distancia / Desplazamiento',
    icon: '📍',
    badgeBgLight: '#F3F4F6',
    badgeTextLight: '#374151',
    badgeBgDark: 'rgba(156, 163, 175, 0.2)',
    badgeTextDark: '#D1D5DB',
    regex: /(?:^|[\.\n,\s])\s*DISTANCIA\s*:\s*/i,
  },
  {
    id: 'religion',
    title: 'Religión & Espiritualidad',
    icon: '⛪',
    badgeBgLight: '#ECFCCB',
    badgeTextLight: '#3F6212',
    badgeBgDark: 'rgba(132, 204, 22, 0.22)',
    badgeTextDark: '#A3E635',
    regex: /(?:^|[\.\n,\s])\s*RELIGI[OÓ]N\s*:\s*/i,
  },
  {
    id: 'politica',
    title: 'Postura Política',
    icon: '🏛️',
    badgeBgLight: '#EDE9FE',
    badgeTextLight: '#5B21B6',
    badgeBgDark: 'rgba(139, 92, 246, 0.22)',
    badgeTextDark: '#C4B5FD',
    regex: /(?:^|[\.\n,\s])\s*POL[ÍI]TICA\s*:\s*/i,
  },
  {
    id: 'salario',
    title: 'Nivel Salarial / Ingresos',
    icon: '💰',
    badgeBgLight: '#D1FAE5',
    badgeTextLight: '#065F46',
    badgeBgDark: 'rgba(16, 185, 129, 0.22)',
    badgeTextDark: '#6EE7B7',
    regex: /(?:^|[\.\n,\s])\s*SALARIO\s*:\s*/i,
  },
  {
    id: 'historial',
    title: 'Estado Civil & Historial Amoroso',
    icon: '💔',
    badgeBgLight: '#F1F5F9',
    badgeTextLight: '#475569',
    badgeBgDark: 'rgba(100, 116, 139, 0.22)',
    badgeTextDark: '#94A3B8',
    regex: /(?:^|[\.\n,\s])\s*(?:SOLTER[AO]|HISTORIAL(?: AMOROSO)?|Ex parejas?|Pasado amoroso|Relaciones anteriores)\s*:\s*/i,
  },
  {
    id: 'redflags',
    title: 'Red Flags Declaradas',
    icon: '🚩',
    badgeBgLight: '#FEE2E2',
    badgeTextLight: '#991B1B',
    badgeBgDark: 'rgba(239, 68, 68, 0.25)',
    badgeTextDark: '#FCA5A5',
    regex: /(?:^|[\.\n,\s])\s*RED FLAGS?\s*:\s*/i,
  },
  {
    id: 'greenflags',
    title: 'Green Flags & Lenguaje Afectivo',
    icon: '🟢',
    badgeBgLight: '#DCFCE7',
    badgeTextLight: '#166534',
    badgeBgDark: 'rgba(34, 197, 94, 0.25)',
    badgeTextDark: '#86EFAC',
    regex: /(?:^|[\.\n,\s])\s*GREEN FLAGS?\s*:\s*/i,
  },
  {
    id: 'disponibilidad',
    title: 'Disponibilidad para Citas',
    icon: '📅',
    badgeBgLight: '#EFF6FF',
    badgeTextLight: '#1E40AF',
    badgeBgDark: 'rgba(59, 130, 246, 0.22)',
    badgeTextDark: '#93C5FD',
    regex: /(?:^|[\.\n,\s])\s*DISPONIBILIDAD\s*:\s*/i,
  },
  {
    id: 'plan_pago',
    title: 'Plan Contratado',
    icon: '🎟️',
    badgeBgLight: '#FEF3C7',
    badgeTextLight: '#B45309',
    badgeBgDark: 'rgba(245, 158, 11, 0.22)',
    badgeTextDark: '#FCD34D',
    regex: /(?:^|[\.\n,\s])\s*PLAN QUE PAG[OÓ]\s*:\s*/i,
  },
  {
    id: 'whatsapp_profile',
    title: 'Perfil Resumen de WhatsApp',
    icon: '📱',
    badgeBgLight: '#DCFCE7',
    badgeTextLight: '#15803D',
    badgeBgDark: 'rgba(22, 163, 74, 0.25)',
    badgeTextDark: '#4ADE80',
    regex: /(?:^|[\.\n,\s])\s*PERFIL (?:IDEAL )?DE WHATSAPP\s*:\s*/i,
  },
  {
    id: 'noneg',
    title: 'No Negociables (Dealbreakers)',
    icon: '🚫',
    badgeBgLight: '#FEE2E2',
    badgeTextLight: '#991B1B',
    badgeBgDark: 'rgba(220, 38, 38, 0.25)',
    badgeTextDark: '#F87171',
    regex: /(?:^|[\.\n])\s*(?:NO NEGOCIABLES|Dealbreakers?|Innegociables?|No tolero)\s*:\s*/i,
  },
  {
    id: 'sintesis',
    title: 'Síntesis & Observaciones Clínicas',
    icon: '📋',
    badgeBgLight: '#FDF2F8',
    badgeTextLight: '#831843',
    badgeBgDark: 'rgba(219, 39, 119, 0.25)',
    badgeTextDark: '#F472B6',
    regex: /(?:^|[\.\n])\s*(?:CONCLUSI[OÓ]N|AN[AÁ]LISIS PSIC[OÓ]LOGA|OBSERVACIONES|S[IÍ]NTESIS)\s*:\s*/i,
  },
]

function parseNotes(rawText) {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return []
  }

  // Pre-normalize concatenated tokens where psicologas write without spaces or punctuation
  let text = rawText.trim()
  text = text.replace(/([a-záéíóúA-ZÁÉÍÓÚ0-9\.\)])(?=(?:DISTANCIA|RELIGI[OÓ]N|HIJOS|POL[ÍI]TICA|SALARIO|RED FLAGS?|GREEN FLAGS?|DISPONIBILIDAD|PLAN QUE PAG[OÓ]|PERFIL (?:IDEAL )?DE WHATSAPP|RANGO DE EDAD|HOBBIES|BUSCA|F[ií]sicamente|Personalidad|L a V|FDS)\s*:)/gi, '$1. ')

  const matches = []

  SECTION_DEFINITIONS.forEach(def => {
    const globalRegex = new RegExp(def.regex.source, 'gi')
    let match
    while ((match = globalRegex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        def,
        matchedStr: match[0]
      })
    }
  })

  // Sort by starting position
  matches.sort((a, b) => a.start - b.start)

  // Discard overlapping matches
  const cleanMatches = []
  let lastEnd = -1
  for (const m of matches) {
    if (m.start >= lastEnd) {
      cleanMatches.push(m)
      lastEnd = m.end
    }
  }

  if (cleanMatches.length === 0) {
    const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    if (paragraphs.length > 1) {
      return paragraphs.map((p, idx) => ({
        id: `p_${idx}`,
        title: `Párrafo ${idx + 1}`,
        icon: '📝',
        badgeBgLight: '#F1F5F9',
        badgeTextLight: '#475569',
        badgeBgDark: 'rgba(255,255,255,0.08)',
        badgeTextDark: '#CBD5E1',
        content: p
      }))
    }
    return [{
      id: 'general',
      title: 'Nota Clínica General',
      icon: '📝',
      badgeBgLight: '#F1F5F9',
      badgeTextLight: '#475569',
      badgeBgDark: 'rgba(255,255,255,0.08)',
      badgeTextDark: '#CBD5E1',
      content: text
    }]
  }

  const sections = []

  // Pre-text before the first section marker
  if (cleanMatches[0].start > 0) {
    const preText = text.slice(0, cleanMatches[0].start).trim()
    if (preText) {
      sections.push({
        id: 'preamble',
        title: 'Contexto Inicial',
        icon: '📌',
        badgeBgLight: '#F1F5F9',
        badgeTextLight: '#475569',
        badgeBgDark: 'rgba(255,255,255,0.08)',
        badgeTextDark: '#CBD5E1',
        content: preText
      })
    }
  }

  for (let i = 0; i < cleanMatches.length; i++) {
    const curr = cleanMatches[i]
    const contentStart = curr.end
    const contentEnd = (i + 1 < cleanMatches.length) ? cleanMatches[i + 1].start : text.length
    let content = text.slice(contentStart, contentEnd).trim()

    content = content.replace(/^[,,\.\-–—\s]+/, '').replace(/[\s]+$/, '')

    if (content) {
      sections.push({
        id: curr.def.id,
        title: curr.def.title,
        icon: curr.def.icon,
        badgeBgLight: curr.def.badgeBgLight,
        badgeTextLight: curr.def.badgeTextLight,
        badgeBgDark: curr.def.badgeBgDark,
        badgeTextDark: curr.def.badgeTextDark,
        content
      })
    }
  }

  return sections
}

export default function ClinicalNotesViewer({ notes, isLight: isLightProp, title = "Notas Clínicas de Entrevista & Bio" }) {
  const [viewMode, setViewMode] = useState('structured') // 'structured' | 'raw'
  const [copied, setCopied] = useState(false)
  const [isLight, setIsLight] = useState(() => {
    if (typeof isLightProp === 'boolean') return isLightProp
    if (typeof document !== 'undefined') {
      return document.body.classList.contains('light-mode') || localStorage.getItem('theme') === 'light'
    }
    return false
  })

  React.useEffect(() => {
    if (typeof isLightProp === 'boolean') {
      setIsLight(isLightProp)
      return
    }
    const checkTheme = () => {
      setIsLight(document.body.classList.contains('light-mode') || localStorage.getItem('theme') === 'light')
    }
    checkTheme()
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    window.addEventListener('storage', checkTheme)
    return () => {
      observer.disconnect()
      window.removeEventListener('storage', checkTheme)
    }
  }, [isLightProp])

  const parsedSections = useMemo(() => parseNotes(notes), [notes])

  const handleCopy = () => {
    if (!notes) return
    navigator.clipboard.writeText(notes).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!notes || typeof notes !== 'string' || !notes.trim()) {
    return (
      <div style={{
        fontSize: 12,
        color: isLight ? '#94A3B8' : 'var(--text-muted)',
        fontStyle: 'italic',
        padding: '10px 0'
      }}>
        Sin notas clínicas registradas
      </div>
    )
  }

  const containerBg = isLight ? '#F8FAFC' : 'rgba(0, 0, 0, 0.25)'
  const containerBorder = isLight ? '1px solid #E2E8F0' : '1px solid rgba(255, 255, 255, 0.08)'
  const cardBg = isLight ? '#FFFFFF' : 'rgba(255, 255, 255, 0.03)'
  const cardBorder = isLight ? '1px solid #E2E8F0' : '1px solid rgba(255, 255, 255, 0.06)'
  const textColor = isLight ? '#1E293B' : 'var(--text-primary)'
  const subtextColor = isLight ? '#64748B' : 'var(--text-muted)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Barra superior de control */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        paddingBottom: 4
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            color: isLight ? '#961500' : 'var(--color-primary-light)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            📝 {title}:
          </span>
          {parsedSections.length > 1 && (
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: isLight ? '#0369A1' : '#38BDF8',
              background: isLight ? '#E0F2FE' : 'rgba(3, 105, 161, 0.2)',
              padding: '1px 6px',
              borderRadius: 10
            }}>
              {parsedSections.length} secciones
            </span>
          )}
        </div>

        {/* Botones de Modo de Vista y Copiado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={handleCopy}
            title="Copiar texto de notas al portapapeles"
            style={{
              background: 'transparent',
              border: isLight ? '1px solid #CBD5E1' : '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 6,
              padding: '3px 7px',
              cursor: 'pointer',
              fontSize: 11,
              color: copied ? '#10B981' : subtextColor,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.15s'
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>

          <div style={{
            display: 'flex',
            background: isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.08)',
            padding: 2,
            borderRadius: 6,
            gap: 2
          }}>
            <button
              type="button"
              onClick={() => setViewMode('structured')}
              style={{
                border: 'none',
                background: viewMode === 'structured' ? (isLight ? '#FFFFFF' : 'var(--color-primary)') : 'transparent',
                color: viewMode === 'structured' ? (isLight ? '#961500' : '#FFFFFF') : subtextColor,
                fontWeight: viewMode === 'structured' ? 700 : 500,
                fontSize: 10.5,
                padding: '3px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: viewMode === 'structured' && isLight ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              <Sparkles size={11} /> Organizado
            </button>
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              style={{
                border: 'none',
                background: viewMode === 'raw' ? (isLight ? '#FFFFFF' : 'var(--color-primary)') : 'transparent',
                color: viewMode === 'raw' ? (isLight ? '#961500' : '#FFFFFF') : subtextColor,
                fontWeight: viewMode === 'raw' ? 700 : 500,
                fontSize: 10.5,
                padding: '3px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: viewMode === 'raw' && isLight ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              <FileText size={11} /> Texto Completo
            </button>
          </div>
        </div>
      </div>

      {/* Contenedor de Contenido */}
      {viewMode === 'structured' ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: containerBg,
          border: containerBorder,
          borderRadius: 8,
          padding: '10px 12px'
        }}>
          {parsedSections.map((sec, idx) => (
            <div
              key={sec.id || idx}
              style={{
                background: cardBg,
                border: cardBorder,
                borderRadius: 6,
                padding: '9px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 5
              }}
            >
              {/* Header de la Sección */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  background: isLight ? sec.badgeBgLight : sec.badgeBgDark,
                  color: isLight ? sec.badgeTextLight : sec.badgeTextDark,
                  padding: '2px 8px',
                  borderRadius: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em'
                }}>
                  <span>{sec.icon}</span>
                  <span>{sec.title}</span>
                </span>
              </div>

              {/* Cuerpo del Texto de la Sección */}
              <div style={{
                fontSize: 12.5,
                color: textColor,
                lineHeight: 1.55,
                wordBreak: 'break-word',
                paddingLeft: 2
              }}>
                {sec.content}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Vista de Texto Original Completo */
        <div style={{
          fontSize: 13,
          color: textColor,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          background: containerBg,
          padding: '12px 14px',
          borderRadius: 8,
          border: containerBorder,
          wordBreak: 'break-word',
          fontFamily: 'inherit'
        }}>
          {notes}
        </div>
      )}
    </div>
  )
}
