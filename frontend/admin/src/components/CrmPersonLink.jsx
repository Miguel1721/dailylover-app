import React from 'react'
import { ExternalLink } from 'lucide-react'

export default function CrmPersonLink({ name, crmId, style = {}, showIcon = true }) {
  if (!name || name.trim() === '') {
    return <span style={{ color: 'var(--text-muted)' }}>—</span>
  }

  const cleanName = String(name).trim()

  let crmUrl = `https://dailylover.smartmatchapp.com/#!/clients?search=${encodeURIComponent(cleanName)}`

  const rawCid = crmId ? String(crmId).trim() : ''
  const isInvalidCid = !rawCid || ['none', 'null', 'undefined'].includes(rawCid.toLowerCase())

  if (!isInvalidCid) {
    if (rawCid.startsWith('http')) {
      crmUrl = rawCid
    } else if (/^\d+$/.test(rawCid)) {
      crmUrl = `https://dailylover.smartmatchapp.com/#!/client/${rawCid}/`
    }
  } else if (cleanName.startsWith('http')) {
    crmUrl = cleanName
  } else if (/^\d+$/.test(cleanName)) {
    crmUrl = `https://dailylover.smartmatchapp.com/#!/client/${cleanName}/`
  }

  return (
    <a
      href={crmUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`Abrir en SmartMatchApp en nueva pestaña: ${cleanName}`}
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
      <span>{cleanName}</span>
      {showIcon && (
        <ExternalLink
          size={12}
          style={{ opacity: 0.6, flexShrink: 0 }}
        />
      )}
    </a>
  )
}
