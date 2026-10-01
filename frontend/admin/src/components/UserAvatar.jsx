import React, { useState } from 'react'

export default function UserAvatar({
  url,
  name,
  size = 36,
  bg = 'linear-gradient(135deg, #1976d2, #0288d1)',
  color = '#fff',
  fontSize = 14,
  style = {}
}) {
  const [imgError, setImgError] = useState(false)
  const initial = (name || '').trim().charAt(0).toUpperCase() || '?'

  if (url && !imgError) {
    return (
      <img
        src={url}
        alt={name || ''}
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1.5px solid var(--border-color, rgba(0,0,0,0.1))',
          flexShrink: 0,
          ...style
        }}
      />
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: fontSize,
        flexShrink: 0,
        userSelect: 'none',
        ...style
      }}
    >
      {initial}
    </div>
  )
}
