import React from 'react'
import { ExternalLink } from 'lucide-react'

export default function CrmPersonLink({ name, crmId, style = {}, showIcon = true }) {
  if (!name) return <span style={{ color: 'var(--text-muted)' }}>—</span>

  const crmUrl = crmId
    ? `https://dailylover.smartmatchapp.com/client/${crmId}`
    : `https://dailylover.smartmatchapp.com/`

  return (
    <a
      href={crmUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={crmId ? `Ver perfil en SmartMatchApp (ID: ${crmId})` : `Abrir SmartMatchApp para ${name}`}
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
      <span>{name}</span>
      {showIcon && (
        <ExternalLink
          size={12}
          style={{ opacity: 0.6, flexShrink: 0 }}
        />
      )}
    </a>
  )
}
