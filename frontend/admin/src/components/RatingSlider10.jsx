import React from 'react'

export default function RatingSlider10({
  label,
  value,
  onChange,
  min = 1,
  max = 10,
  step = 1,
  leftAnchor = '',
  middleAnchor = '',
  rightAnchor = '',
  hint = '',
  disabled = false
}) {
  const numValue = value !== undefined && value !== null && value !== '' ? Number(value) : min
  const isDecimal = step < 1
  const displayVal = isDecimal ? numValue.toFixed(1) : numValue

  // Determine badge color based on score value
  const getBadgeStyle = (val) => {
    if (disabled) return { background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }
    if (val >= 8) return { background: 'rgba(76, 175, 80, 0.15)', color: '#4CAF50', border: '1px solid rgba(76,175,80,0.3)' }
    if (val >= 5) return { background: 'rgba(255, 193, 7, 0.15)', color: '#FFC107', border: '1px solid rgba(255,193,7,0.3)' }
    return { background: 'rgba(150, 21, 0, 0.15)', color: '#ff6b6b', border: '1px solid rgba(150,21,0,0.3)' }
  }

  // Generate tick marks for 1-10
  const ticks = []
  if (!isDecimal) {
    for (let i = min; i <= max; i += step) {
      ticks.push(i)
    }
  }

  return (
    <div style={{
      marginBottom: 20,
      padding: '16px 18px',
      background: 'rgba(255, 255, 255, 0.02)',
      borderRadius: 10,
      border: '1px solid rgba(150, 21, 0, 0.12)',
      opacity: disabled ? 0.5 : 1,
      transition: 'all 0.2s'
    }}>
      {/* Header with Label and Value Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
          {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
        </div>
        <div style={{
          padding: '4px 10px',
          borderRadius: 14,
          fontSize: 13,
          fontWeight: 700,
          ...getBadgeStyle(numValue)
        }}>
          {disabled ? 'Desactivado' : `${displayVal} / ${max}`}
        </div>
      </div>

      {/* Slider input */}
      <div style={{ position: 'relative', margin: '12px 0 8px' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={numValue}
          disabled={disabled}
          onChange={(e) => onChange(isDecimal ? parseFloat(e.target.value) : parseInt(e.target.value, 10))}
          style={{
            width: '100%',
            accentColor: 'var(--color-primary)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            height: 6,
            borderRadius: 3
          }}
        />
      </div>

      {/* Discrete clickable ticks (if integer 1-10) */}
      {!isDecimal && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0 4px',
          marginBottom: 8
        }}>
          {ticks.map((t) => {
            const isSelected = t === numValue
            return (
              <button
                key={t}
                type="button"
                disabled={disabled}
                onClick={() => onChange(t)}
                style={{
                  background: isSelected ? 'var(--color-primary)' : 'transparent',
                  color: isSelected ? 'white' : 'var(--text-muted)',
                  border: isSelected ? '1px solid var(--color-primary)' : 'none',
                  borderRadius: 4,
                  width: 24,
                  height: 22,
                  fontSize: 11,
                  fontWeight: isSelected ? 700 : 500,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s'
                }}
              >
                {t}
              </button>
            )
          })}
        </div>
      )}

      {/* Anchor texts */}
      {(leftAnchor || middleAnchor || rightAnchor) && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--text-secondary)',
          marginTop: 6,
          lineHeight: 1.3
        }}>
          <span style={{ maxWidth: '30%', textAlign: 'left', color: '#ff6b6b' }}>
            {leftAnchor}
          </span>
          {middleAnchor && (
            <span style={{ maxWidth: '35%', textAlign: 'center', color: '#FFC107' }}>
              {middleAnchor}
            </span>
          )}
          <span style={{ maxWidth: '30%', textAlign: 'right', color: '#4CAF50' }}>
            {rightAnchor}
          </span>
        </div>
      )}
    </div>
  )
}
