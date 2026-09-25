import React from 'react'
import { ExternalLink } from 'lucide-react'

export function getSmartMatchAppUrl(name, crmId) {
  const cleanName = String(name || '').trim()
  const rawCid = crmId ? String(crmId).trim() : ''
  const isInvalidCid = !rawCid || ['none', 'null', 'undefined'].includes(rawCid.toLowerCase())

  // Helper para normalizar URLs de SmartMatchApp (agregar #!/ si falta)
  const normalizeSmaUrl = (url) => {
    if (url.includes('smartmatchapp.com/client/') && !url.includes('#!/')) {
      return url.replace('smartmatchapp.com/client/', 'smartmatchapp.com/#!/client/')
    }
    return url
  }

  // 1. Si crmId es una URL directa
  if (!isInvalidCid && rawCid.startsWith('http')) {
    return normalizeSmaUrl(rawCid)
  }

  // 2. Si crmId contiene dígitos (ej: "4916", "#4916", "CRM 4916", "DL-4916")
  if (!isInvalidCid) {
    const digitMatch = rawCid.match(/\d+/)
    if (digitMatch && digitMatch[0]) {
      return `https://dailylover.smartmatchapp.com/#!/client/${digitMatch[0]}/`
    }
  }

  // 3. Si name es una URL directa
  if (cleanName.startsWith('http')) {
    return normalizeSmaUrl(cleanName)
  }

  // 4. Si name contiene indicación explícita de CRM ID (ej: "Cliente CRM #4916" o "Juan (4916)")
  const nameCrmMatch = cleanName.match(/(?:CRM\s*#?|#)\s*(\d+)/i) || (cleanName.toLowerCase().includes('crm') ? cleanName.match(/\d+/) : null)
  if (nameCrmMatch && nameCrmMatch[1]) {
    return `https://dailylover.smartmatchapp.com/#!/client/${nameCrmMatch[1]}/`
  }

  // 5. Fallback a búsqueda por nombre
  return `https://dailylover.smartmatchapp.com/#!/clients?search=${encodeURIComponent(cleanName)}`
}

export default function CrmPersonLink({ name, crmId, style = {}, showIcon = true, children }) {
  if (!name || name.trim() === '') {
    return <span style={{ color: 'var(--text-muted)' }}>—</span>
  }

  const cleanName = String(name).trim()
  const crmUrl = getSmartMatchAppUrl(cleanName, crmId)

  return (
    <a
      href={crmUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`Abrir perfil de ${cleanName} en SmartMatchApp (CRM)`}
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        color: 'var(--text-primary)',
        textDecoration: 'none',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'color 0.15s ease',
        ...style
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = '#B8324F'
        e.currentTarget.style.textDecoration = 'underline'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = style.color || 'var(--text-primary)'
        e.currentTarget.style.textDecoration = 'none'
      }}
    >
      <span>{children || cleanName}</span>
      {showIcon && (
        <ExternalLink
          size={12}
          style={{ opacity: 0.7, flexShrink: 0 }}
        />
      )}
    </a>
  )
}
