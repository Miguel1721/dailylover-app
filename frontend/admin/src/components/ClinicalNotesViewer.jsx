import React, { useState, useMemo } from 'react'
import { Copy, Check, Sparkles, FileText } from 'lucide-react'

// Definiciones de categorías para filtrado rápido
export const SECTION_CATEGORIES = {
  ALL: { id: 'all', label: 'Todas las notas' },
  PROFILE: { id: 'profile', label: '👤 Perfil & Trabajo' },
  LIFESTYLE: { id: 'lifestyle', label: '🏃 Rutina & Ocio' },
  VALUES: { id: 'values', label: '⛪ Creencias & Familia' },
  MATCHING: { id: 'matching', label: '❤️ Qué Busca & Límites' }
}

// Lista de encabezados compuestos para separar palabras pegadas del CRM sin romper texto normal
const COMPOUND_HEADERS = [
  'DATOS DUROS',
  'PERFIL IDEAL DE WHATSAPP',
  'PERFIL IDEAL WHATSAPP',
  'Quién es y qué hace',
  'De dónde es y dónde vive',
  'De donde es y donde vive',
  'A qué se dedica',
  'A que se dedica',
  'Sua postura sobre el trabajo',
  'Su postura sobre el trabajo',
  'Estilo de vida y parche',
  'Rutina y deporte',
  'Planes y personalidad',
  'El host del grupo',
  'Súper foodie',
  'Super foodie',
  'Pensamiento:',
  'Familia y pasado',
  'Cercanos:',
  'Qué busca en el amor',
  'Que busca en el amor',
  'Su tipo ideal',
  'No negociables:',
  'Dealbreakers:',
  'NO NEGOCIABLES:',
  'Vive con quien y donde exacto',
  'Donde vive:',
  'Vive con:',
  'Ubicación:',
  'L a V:',
  'Lunes a Viernes:',
  'FDS:',
  'Fin de semana:',
  'Fines de semana:',
  'HOBBIES:',
  'Pasatiempos:',
  'RANGO DE EDAD:',
  'HIJOS:',
  'DISTANCIA:',
  'RELIGI[OÓ]N & ESPIRITUALIDAD:',
  'RELIGI[OÓ]N:',
  'POLÍTICA:',
  'SALARIO:',
  'HISTORIAL AMOROSO:',
  'RED FLAGS:',
  'GREEN FLAGS:',
  'DISPONIBILIDAD:',
  'PLAN QUE PAGÓ:',
  'CONCLUSIÓN:',
  'ANÁLISIS PSICÓLOGA:',
  'OBSERVACIONES:',
  'SÍNTESIS:'
]

// Catálogo de secciones clínicas estructuradas
const SECTION_DEFINITIONS = [
  // DATOS DUROS & RESUMEN WHATSAPP
  {
    id: 'datos_duros',
    category: 'profile',
    title: 'Ficha de Datos Duros',
    icon: '📋',
    badgeBgLight: '#EFF6FF',
    badgeTextLight: '#1D4ED8',
    badgeBgDark: 'rgba(59, 130, 246, 0.22)',
    badgeTextDark: '#93C5FD',
    regex: /(?:^|[\.\n\r])\s*(?:DATOS DUROS|Datos b[aá]sicos)\s*(?:•|:|\s)/i
  },
  {
    id: 'whatsapp_profile',
    category: 'profile',
    title: 'Perfil Resumen WhatsApp',
    icon: '📱',
    badgeBgLight: '#DCFCE7',
    badgeTextLight: '#15803D',
    badgeBgDark: 'rgba(22, 163, 74, 0.25)',
    badgeTextDark: '#4ADE80',
    regex: /(?:^|[\.\n\r])\s*PERFIL (?:IDEAL )?(?:DE )?WHATSAPP\s*:?\s*/i
  },
  {
    id: 'vivienda',
    category: 'profile',
    title: 'Vivienda & Ubicación',
    icon: '🏠',
    badgeBgLight: '#E0F2FE',
    badgeTextLight: '#0369A1',
    badgeBgDark: 'rgba(3, 105, 161, 0.25)',
    badgeTextDark: '#38BDF8',
    regex: /(?:^|[\.\n\r])\s*(?:Qui[eé]n es y qu[eé] hace\s*[\n\r]+)?(?:De d[oó]nde es y d[oó]nde vive|Vive con quien y donde exacto|Vivienda|Donde vive|Vive con|Ubicaci[oó]n)\s*:?\s*/i
  },
  {
    id: 'quien_es',
    category: 'profile',
    title: 'Quién es (Introducción)',
    icon: '👤',
    badgeBgLight: '#F1F5F9',
    badgeTextLight: '#334155',
    badgeBgDark: 'rgba(148, 163, 184, 0.18)',
    badgeTextDark: '#CBD5E1',
    regex: /(?:^|[\.\n\r])\s*(?:INTRO\s*:?\s*Cu[eé]ntame quien eres[^\.]*\.?|INTRO\s*:|Perfil\s*:|Qui[eé]n es y qu[eé] hace|Qui[eé]n es\s*:)\s*/i
  },
  {
    id: 'dedica',
    category: 'profile',
    title: 'Profesión & Ocupación',
    icon: '💼',
    badgeBgLight: '#F1F5F9',
    badgeTextLight: '#1E293B',
    badgeBgDark: 'rgba(255, 255, 255, 0.1)',
    badgeTextDark: '#E2E8F0',
    regex: /(?:^|[\.\n\r])\s*(?:A qu[eé] se dedica\s*:?|(?:Trabajo|Ocupaci[oó]n)\s*:)\s*/i
  },
  {
    id: 'postura_trabajo',
    category: 'profile',
    title: 'Postura ante el Trabajo',
    icon: '⚖️',
    badgeBgLight: '#EDE9FE',
    badgeTextLight: '#6D28D9',
    badgeBgDark: 'rgba(139, 92, 246, 0.2)',
    badgeTextDark: '#C4B5FD',
    regex: /(?:^|[\.\n\r])\s*Su[a]? postura sobre el trabajo\s*:?\s*/i
  },
  {
    id: 'rutina',
    category: 'lifestyle',
    title: 'Rutina & Deporte',
    icon: '🏃',
    badgeBgLight: '#DCFCE7',
    badgeTextLight: '#166534',
    badgeBgDark: 'rgba(34, 197, 94, 0.22)',
    badgeTextDark: '#86EFAC',
    regex: /(?:^|[\.\n\r])\s*(?:Estilo de vida y parche\s*[\n\r]+)?(?:Rutina y deporte|L a V|Lunes a Viernes|Rutina entre semana|D[ií]a a d[ií]a|Semana|Actividad f[ií]sica)\s*:?\s*/i
  },


  // RUTINA, ESTILO DE VIDA & OCIO
  {
    id: 'estilo_vida',
    category: 'lifestyle',
    title: 'Estilo de Vida & Parche',
    icon: '✨',
    badgeBgLight: '#FEF3C7',
    badgeTextLight: '#B45309',
    badgeBgDark: 'rgba(245, 158, 11, 0.22)',
    badgeTextDark: '#FCD34D',
    regex: /(?:^|[\.\n\r])\s*(?:Estilo de vida y parche|Estilo de vida)\s*:?\s*/i
  },
  {
    id: 'rutina',
    category: 'lifestyle',
    title: 'Rutina & Deporte',
    icon: '🏃',
    badgeBgLight: '#DCFCE7',
    badgeTextLight: '#166534',
    badgeBgDark: 'rgba(34, 197, 94, 0.22)',
    badgeTextDark: '#86EFAC',
    regex: /(?:^|[\.\n\r])\s*(?:Rutina y deporte|L a V|Lunes a Viernes|Rutina entre semana|D[ií]a a d[ií]a|Semana|Actividad f[ií]sica)\s*:?\s*/i
  },
  {
    id: 'planes_pers',
    category: 'lifestyle',
    title: 'Planes & Personalidad',
    icon: '🧠',
    badgeBgLight: '#E0E7FF',
    badgeTextLight: '#3730A3',
    badgeBgDark: 'rgba(55, 48, 163, 0.25)',
    badgeTextDark: '#818CF8',
    regex: /(?:^|[\.\n\r])\s*(?:Planes y personalidad|Personalidad|Car[aá]cter|Din[aá]mica de pareja|Forma de ser)\s*:?\s*/i
  },
  {
    id: 'host',
    category: 'lifestyle',
    title: 'Dinámica Social (Host)',
    icon: '🎉',
    badgeBgLight: '#FCE7F3',
    badgeTextLight: '#9D174D',
    badgeBgDark: 'rgba(236, 72, 153, 0.22)',
    badgeTextDark: '#F472B6',
    regex: /(?:^|[\.\n\r])\s*(?:El host del grupo|Anfitri[oó]n|Vida social|Amigos y parche)\s*:?\s*/i
  },
  {
    id: 'foodie',
    category: 'lifestyle',
    title: 'Gastronomía & Foodie',
    icon: '🍕',
    badgeBgLight: '#FFEDD5',
    badgeTextLight: '#C2410C',
    badgeBgDark: 'rgba(249, 115, 22, 0.22)',
    badgeTextDark: '#FB923C',
    regex: /(?:^|[\.\n\r])\s*(?:S[uú]per foodie|Foodie|Gastronom[ií]a|Comida y planes)\s*:?\s*/i
  },
  {
    id: 'fds',
    category: 'lifestyle',
    title: 'Fines de Semana (FDS)',
    icon: '🥂',
    badgeBgLight: '#DCFCE7',
    badgeTextLight: '#166534',
    badgeBgDark: 'rgba(22, 101, 52, 0.25)',
    badgeTextDark: '#4ADE80',
    regex: /(?:^|[\.\n\r])\s*(?:FDS|Fin(?:es)? de semana|Rumba)\s*:?\s*/i
  },
  {
    id: 'hobbies',
    category: 'lifestyle',
    title: 'Hobbies & Tiempo Libre',
    icon: '🎨',
    badgeBgLight: '#F3E8FF',
    badgeTextLight: '#6B21A8',
    badgeBgDark: 'rgba(107, 33, 168, 0.25)',
    badgeTextDark: '#C084FC',
    regex: /(?:^|[\.\n\r])\s*(?:HOBBIES|Pasatiempos|Intereses|Tiempo libre)\s*:?\s*/i
  },

  // CREENCIAS, POLÍTICA & FAMILIA
  {
    id: 'pensamiento',
    category: 'values',
    title: 'Pensamiento, Religión & Política',
    icon: '🏛️',
    badgeBgLight: '#ECFCCB',
    badgeTextLight: '#3F6212',
    badgeBgDark: 'rgba(132, 204, 22, 0.22)',
    badgeTextDark: '#A3E635',
    regex: /(?:^|[\.\n\r])\s*(?:Pensamiento\s*:|RELIGI[OÓ]N(?:\s*&\s*ESPIRITUALIDAD)?\s*:|POL[ÍI]TICA\s*:|Espiritualidad\s*:|Creencias\s*:)/i
  },
  {
    id: 'familia',
    category: 'values',
    title: 'Familia & Entorno Pasado',
    icon: '👨‍👩‍👧',
    badgeBgLight: '#FEF3C7',
    badgeTextLight: '#92400E',
    badgeBgDark: 'rgba(217, 119, 6, 0.22)',
    badgeTextDark: '#FBBF24',
    regex: /(?:^|[\.\n\r])\s*(?:Familia y pasado\s*:?|Cercanos\s*:|Familia\s*:|Entorno familiar\s*:)/i
  },
  {
    id: 'historial',
    category: 'values',
    title: 'Historial Amoroso & Duelo',
    icon: '💔',
    badgeBgLight: '#F1F5F9',
    badgeTextLight: '#475569',
    badgeBgDark: 'rgba(100, 116, 139, 0.22)',
    badgeTextDark: '#94A3B8',
    regex: /(?:^|[\.\n\r])\s*(?:SOLTER[AO]\s*:|HISTORIAL(?: AMOROSO)?\s*:|Ex parejas?\s*:|Pasado amoroso\s*:|Relaciones anteriores\s*:)/i
  },

  // QUÉ BUSCA EN PAREJA & LÍMITES
  {
    id: 'busca',
    category: 'matching',
    title: 'Qué Busca en el Amor',
    icon: '🔍',
    badgeBgLight: '#FFE4E6',
    badgeTextLight: '#9F1239',
    badgeBgDark: 'rgba(159, 18, 57, 0.25)',
    badgeTextDark: '#FDA4AF',
    regex: /(?:^|[\.\n\r])\s*(?:Qu[eé] busca en el amor|BUSCA\s*:|Qu[eé] busca\s*:|Pareja ideal\s*:|Perfil deseado\s*:)/i
  },
  {
    id: 'tipo_ideal',
    category: 'matching',
    title: 'Su Tipo Ideal & Físico',
    icon: '👀',
    badgeBgLight: '#FCE7F3',
    badgeTextLight: '#9D174D',
    badgeBgDark: 'rgba(157, 23, 77, 0.25)',
    badgeTextDark: '#F472B6',
    regex: /(?:^|[\.\n\r])\s*(?:Su tipo ideal\s*:?|F[ií]sicamente\s*:|Aspecto f[ií]sico\s*:|F[ií]sico\s*:)/i
  },
  {
    id: 'hijos',
    category: 'matching',
    title: 'Preferencia sobre Hijos',
    icon: '👶',
    badgeBgLight: '#E0F2FE',
    badgeTextLight: '#075985',
    badgeBgDark: 'rgba(14, 165, 233, 0.22)',
    badgeTextDark: '#38BDF8',
    regex: /(?:^|[\.\n\r])\s*HIJOS\s*:?\s*/i
  },
  {
    id: 'noneg',
    category: 'matching',
    title: 'No Negociables (Dealbreakers)',
    icon: '🚫',
    badgeBgLight: '#FEE2E2',
    badgeTextLight: '#991B1B',
    badgeBgDark: 'rgba(220, 38, 38, 0.25)',
    badgeTextDark: '#F87171',
    regex: /(?:^|[\.\n\r])\s*(?:NO NEGOCIABLES|Dealbreakers?|Innegociables?|No tolero)\s*:?\s*/i
  },
  {
    id: 'redflags',
    category: 'matching',
    title: 'Red Flags Declaradas',
    icon: '🚩',
    badgeBgLight: '#FEE2E2',
    badgeTextLight: '#991B1B',
    badgeBgDark: 'rgba(239, 68, 68, 0.25)',
    badgeTextDark: '#FCA5A5',
    regex: /(?:^|[\.\n\r])\s*RED FLAGS?\s*:?\s*/i
  },
  {
    id: 'greenflags',
    category: 'matching',
    title: 'Green Flags & Lenguaje Afectivo',
    icon: '🟢',
    badgeBgLight: '#DCFCE7',
    badgeTextLight: '#166534',
    badgeBgDark: 'rgba(34, 197, 94, 0.25)',
    badgeTextDark: '#86EFAC',
    regex: /(?:^|[\.\n\r])\s*GREEN FLAGS?\s*:?\s*/i
  },
  {
    id: 'disponibilidad',
    category: 'matching',
    title: 'Disponibilidad & Citas',
    icon: '📅',
    badgeBgLight: '#EFF6FF',
    badgeTextLight: '#1E40AF',
    badgeBgDark: 'rgba(59, 130, 246, 0.22)',
    badgeTextDark: '#93C5FD',
    regex: /(?:^|[\.\n\r])\s*DISPONIBILIDAD\s*:?\s*/i
  },
  {
    id: 'plan_pago',
    category: 'profile',
    title: 'Plan Contratado / Facturación',
    icon: '🎟️',
    badgeBgLight: '#FEF3C7',
    badgeTextLight: '#B45309',
    badgeBgDark: 'rgba(245, 158, 11, 0.22)',
    badgeTextDark: '#FCD34D',
    regex: /(?:^|[\.\n\r])\s*(?:PLAN QUE PAG[OÓ]|SALDO CITAS)\s*:?\s*/i
  },
  {
    id: 'sintesis',
    category: 'profile',
    title: 'Síntesis & Observaciones Clínicas',
    icon: '📋',
    badgeBgLight: '#FDF2F8',
    badgeTextLight: '#831843',
    badgeBgDark: 'rgba(219, 39, 119, 0.25)',
    badgeTextDark: '#F472B6',
    regex: /(?:^|[\.\n\r])\s*(?:CONCLUSI[OÓ]N|AN[AÁ]LISIS PSIC[OÓ]LOGA|OBSERVACIONES|S[IÍ]NTESIS)\s*:?\s*/i
  }
]

// Helper para parsear items de viñeta tipo "• Nombre: Valor • Ciudad: Valor"
function parseBulletDataGrid(text) {
  if (!text || !text.includes('•')) return null
  const items = []
  const rawBullets = text.split('•').map(b => b.trim()).filter(Boolean)
  for (const b of rawBullets) {
    const colonIdx = b.indexOf(':')
    if (colonIdx > 0 && colonIdx < 45) {
      const key = b.slice(0, colonIdx).trim()
      const val = b.slice(colonIdx + 1).trim()
      let icon = '📌'
      const kLower = key.toLowerCase()
      if (kLower.includes('nombre')) icon = '👤'
      else if (kLower.includes('ciudad') || kLower.includes('zona')) icon = '📍'
      else if (kLower.includes('vive') || kLower.includes('reside')) icon = '🏠'
      else if (kLower.includes('edad')) icon = '🎂'
      else if (kLower.includes('celular') || kLower.includes('tel')) icon = '📱'
      else if (kLower.includes('ingreso') || kLower.includes('salario')) icon = '💰'
      else if (kLower.includes('cc') || kLower.includes('cédula')) icon = '🪪'
      else if (kLower.includes('profesión') || kLower.includes('cargo') || kLower.includes('trabajo')) icon = '💼'
      items.push({ key, val, icon })
    }
  }
  return items.length >= 2 ? items : null
}

function parseNotes(rawText) {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return []
  }

  let text = rawText.trim()

  // 1. Separar encabezados compuestos pegados
  text = text.replace(/PERFIL IDEAL (?:DE )?WHATSAPP([A-ZÁÉÍÓÚa-záéíóú])/gi, 'PERFIL IDEAL WHATSAPP\n\n$1')

  COMPOUND_HEADERS.forEach(hdr => {
    const esc = hdr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`([^\\n\\r])(${esc})`, 'gi')
    text = text.replace(re, '$1\n\n$2')
  })

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

  // Ordenar por posición de inicio
  matches.sort((a, b) => a.start - b.start)

  // Descartar superposiciones
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
        category: 'profile',
        title: `Párrafo ${idx + 1}`,
        icon: '📝',
        badgeBgLight: '#F1F5F9',
        badgeTextLight: '#475569',
        badgeBgDark: 'rgba(255,255,255,0.08)',
        badgeTextDark: '#CBD5E1',
        content: p,
        dataGrid: parseBulletDataGrid(p)
      }))
    }
    return [{
      id: 'general',
      category: 'profile',
      title: 'Nota Clínica General',
      icon: '📝',
      badgeBgLight: '#F1F5F9',
      badgeTextLight: '#475569',
      badgeBgDark: 'rgba(255,255,255,0.08)',
      badgeTextDark: '#CBD5E1',
      content: text,
      dataGrid: parseBulletDataGrid(text)
    }]
  }

  const sections = []

  // Texto previo al primer encabezado reconocido
  if (cleanMatches[0].start > 0) {
    const preText = text.slice(0, cleanMatches[0].start).trim()
    if (preText) {
      sections.push({
        id: 'preamble',
        category: 'profile',
        title: 'Contexto Inicial',
        icon: '📌',
        badgeBgLight: '#F1F5F9',
        badgeTextLight: '#475569',
        badgeBgDark: 'rgba(255,255,255,0.08)',
        badgeTextDark: '#CBD5E1',
        content: preText,
        dataGrid: parseBulletDataGrid(preText)
      })
    }
  }

  for (let i = 0; i < cleanMatches.length; i++) {
    const curr = cleanMatches[i]
    const contentStart = curr.end
    const contentEnd = (i + 1 < cleanMatches.length) ? cleanMatches[i + 1].start : text.length
    let content = text.slice(contentStart, contentEnd).trim()

    // Limpiar puntuación inicial sobrante
    content = content.replace(/^[:,\.\-–—\s]+/, '').replace(/[\s]+$/, '')

    if (content) {
      const dataGrid = parseBulletDataGrid(content)
      sections.push({
        id: curr.def.id,
        category: curr.def.category || 'profile',
        title: curr.def.title,
        icon: curr.def.icon,
        badgeBgLight: curr.def.badgeBgLight,
        badgeTextLight: curr.def.badgeTextLight,
        badgeBgDark: curr.def.badgeBgDark,
        badgeTextDark: curr.def.badgeTextDark,
        content,
        dataGrid
      })
    }
  }

  return sections
}

export default function ClinicalNotesViewer({ notes, isLight: isLightProp, title = "Notas Clínicas de Entrevista & Bio" }) {
  const [viewMode, setViewMode] = useState('structured') // 'structured' | 'raw'
  const [activeCategory, setActiveCategory] = useState('all')
  const [copiedSectionId, setCopiedSectionId] = useState(null)
  const [copiedAll, setCopiedAll] = useState(false)

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

  // Filtrado por categoría activa
  const visibleSections = useMemo(() => {
    if (activeCategory === 'all') return parsedSections
    return parsedSections.filter(s => s.category === activeCategory)
  }, [parsedSections, activeCategory])

  const handleCopyAll = () => {
    if (!notes) return
    navigator.clipboard.writeText(notes).then(() => {
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2000)
    })
  }

  const handleCopySection = (sec) => {
    const textToCopy = `${sec.icon} ${sec.title}:\n${sec.content}`
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedSectionId(sec.id)
      setTimeout(() => setCopiedSectionId(null), 1800)
    })
  }

  if (!notes || typeof notes !== 'string' || !notes.trim()) {
    return (
      <div style={{
        fontSize: 12.5,
        color: isLight ? '#94A3B8' : 'var(--text-muted)',
        fontStyle: 'italic',
        padding: '12px 14px',
        background: isLight ? '#F8FAFC' : 'rgba(255, 255, 255, 0.02)',
        borderRadius: 8,
        border: isLight ? '1px dashed #CBD5E1' : '1px dashed rgba(255, 255, 255, 0.1)'
      }}>
        Sin notas clínicas registradas en el perfil
      </div>
    )
  }

  const containerBg = isLight ? '#F8FAFC' : 'rgba(10, 6, 8, 0.45)'
  const containerBorder = isLight ? '1px solid #E2E8F0' : '1px solid rgba(255, 255, 255, 0.08)'
  const cardBg = isLight ? '#FFFFFF' : 'rgba(26, 18, 20, 0.75)'
  const cardBorder = isLight ? '1px solid #E2E8F0' : '1px solid rgba(150, 21, 0, 0.2)'
  const textColor = isLight ? '#1E293B' : '#F1F5F9'
  const subtextColor = isLight ? '#64748B' : '#94A3B8'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Barra superior de control */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        paddingBottom: 2
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            color: isLight ? '#961500' : 'var(--color-primary-light, #ff6b6b)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            📝 {title}:
          </span>
          {parsedSections.length > 1 && (
            <span style={{
              fontSize: 10.5,
              fontWeight: 800,
              color: isLight ? '#0369A1' : '#38BDF8',
              background: isLight ? '#E0F2FE' : 'rgba(3, 105, 161, 0.25)',
              border: isLight ? '1px solid #BAE6FD' : '1px solid rgba(56, 189, 248, 0.3)',
              padding: '1px 7px',
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
            onClick={handleCopyAll}
            title="Copiar texto completo al portapapeles"
            style={{
              background: isLight ? '#FFFFFF' : 'rgba(255, 255, 255, 0.05)',
              border: isLight ? '1px solid #CBD5E1' : '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 6,
              padding: '4px 9px',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              color: copiedAll ? '#10B981' : subtextColor,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.15s'
            }}
          >
            {copiedAll ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            {copiedAll ? 'Copiado' : 'Copiar todo'}
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
                background: viewMode === 'structured' ? (isLight ? '#FFFFFF' : 'var(--color-primary, #961500)') : 'transparent',
                color: viewMode === 'structured' ? (isLight ? '#961500' : '#FFFFFF') : subtextColor,
                fontWeight: viewMode === 'structured' ? 700 : 500,
                fontSize: 11,
                padding: '4px 9px',
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
                background: viewMode === 'raw' ? (isLight ? '#FFFFFF' : 'var(--color-primary, #961500)') : 'transparent',
                color: viewMode === 'raw' ? (isLight ? '#961500' : '#FFFFFF') : subtextColor,
                fontWeight: viewMode === 'raw' ? 700 : 500,
                fontSize: 11,
                padding: '4px 9px',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: viewMode === 'raw' && isLight ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              <FileText size={11} /> Texto Plano
            </button>
          </div>
        </div>
      </div>

      {/* Píldoras de Filtro Rápido por Categoría */}
      {viewMode === 'structured' && parsedSections.length > 3 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 2,
          whiteSpace: 'nowrap',
          WebkitOverflowScrolling: 'touch'
        }}>
          {Object.values(SECTION_CATEGORIES).map(cat => {
            const count = cat.id === 'all'
              ? parsedSections.length
              : parsedSections.filter(s => s.category === cat.id).length
            if (count === 0 && cat.id !== 'all') return null

            const isSelected = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: '3px 8px',
                  borderRadius: 14,
                  fontSize: 11,
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  border: isSelected
                    ? (isLight ? '1.5px solid #961500' : '1.5px solid var(--color-primary-light, #ff6b6b)')
                    : (isLight ? '1px solid #E2E8F0' : '1px solid rgba(255, 255, 255, 0.1)'),
                  background: isSelected
                    ? (isLight ? '#FEE2E2' : 'rgba(150, 21, 0, 0.25)')
                    : (isLight ? '#FFFFFF' : 'rgba(255, 255, 255, 0.03)'),
                  color: isSelected
                    ? (isLight ? '#961500' : '#ff8a80')
                    : subtextColor,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{cat.label}</span>
                <span style={{
                  fontSize: 10,
                  opacity: 0.75,
                  padding: '0 4px',
                  background: isSelected ? 'rgba(0,0,0,0.08)' : 'transparent',
                  borderRadius: 8
                }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Contenedor de Contenido */}
      {viewMode === 'structured' ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          background: containerBg,
          border: containerBorder,
          borderRadius: 10,
          padding: '10px 12px'
        }}>
          {visibleSections.length === 0 ? (
            <div style={{ fontSize: 12, color: subtextColor, fontStyle: 'italic', padding: 8, textAlign: 'center' }}>
              No hay notas en esta categoría seleccionada.
            </div>
          ) : (
            visibleSections.map((sec, idx) => (
              <div
                key={sec.id || idx}
                style={{
                  background: cardBg,
                  border: cardBorder,
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 7,
                  boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.03)' : '0 1px 4px rgba(0,0,0,0.2)',
                  transition: 'border-color 0.15s ease'
                }}
              >
                {/* Header de la Tarjeta */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      background: isLight ? sec.badgeBgLight : sec.badgeBgDark,
                      color: isLight ? sec.badgeTextLight : sec.badgeTextDark,
                      padding: '3px 9px',
                      borderRadius: 6,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em'
                    }}>
                      <span>{sec.icon}</span>
                      <span>{sec.title}</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopySection(sec)}
                    title="Copiar esta sección"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      fontSize: 10.5,
                      color: copiedSectionId === sec.id ? '#10B981' : subtextColor,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      opacity: 0.8
                    }}
                  >
                    {copiedSectionId === sec.id ? <Check size={11} color="#10B981" /> : <Copy size={11} />}
                    <span>{copiedSectionId === sec.id ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>

                {/* Si la sección contiene DATOS DUROS con viñetas, renderizamos una Cuadrícula de Chips */}
                {sec.dataGrid ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
                    gap: 6,
                    marginTop: 2
                  }}>
                    {sec.dataGrid.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: isLight ? '#F8FAFC' : 'rgba(255, 255, 255, 0.03)',
                          border: isLight ? '1px solid #E2E8F0' : '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: 6,
                          padding: '6px 9px',
                          fontSize: 12
                        }}
                      >
                        <span style={{ fontSize: 13 }}>{item.icon}</span>
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: subtextColor, textTransform: 'uppercase' }}>
                            {item.key}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.val}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Cuerpo del Texto de la Sección con Interlineado y Tipografía Espaciada */
                  <div style={{
                    fontSize: 13,
                    color: textColor,
                    lineHeight: 1.6,
                    wordBreak: 'break-word',
                    paddingLeft: 2,
                    whiteSpace: 'pre-line'
                  }}>
                    {sec.content}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        /* Vista de Texto Original Completo */
        <div style={{
          fontSize: 13,
          color: textColor,
          lineHeight: 1.65,
          whiteSpace: 'pre-wrap',
          background: containerBg,
          padding: '14px 16px',
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
