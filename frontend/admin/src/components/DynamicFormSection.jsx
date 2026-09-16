import React from 'react'
import RatingSlider10 from './RatingSlider10'

export default function DynamicFormSection({
  section,
  values = {},
  onChange,
  disabled = false
}) {
  if (!section || !section.fields) return null

  const getFieldValue = (fieldId, fallback = '') => {
    if (values[fieldId] !== undefined && values[fieldId] !== null) {
      return values[fieldId]
    }
    if (values.dynamic_answers && values.dynamic_answers[fieldId] !== undefined && values.dynamic_answers[fieldId] !== null) {
      return values.dynamic_answers[fieldId]
    }
    return fallback
  }

  const renderField = (field) => {
    const fieldId = field.id
    const val = getFieldValue(fieldId)
    const isRequired = field.required

    switch (field.type) {
      case 'scale_1_10': {
        const numVal = (val !== '' && val !== null && val !== undefined) ? Number(val) : 5
        return (
          <div key={fieldId} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {field.label} {isRequired && <span style={{ color: '#ff6b6b' }}>*</span>}
              </label>
              {field.help_text && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{field.help_text}</span>
              )}
            </div>
            <RatingSlider10
              value={numVal}
              onChange={(newVal) => onChange(fieldId, newVal)}
              disabled={disabled}
            />
          </div>
        )
      }

      case 'dropdown': {
        const strVal = val || ''
        const options = field.options || []
        return (
          <div key={fieldId} style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
              {field.label} {isRequired && <span style={{ color: '#ff6b6b' }}>*</span>}
            </label>
            {field.help_text && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{field.help_text}</div>
            )}
            <select
              value={strVal}
              onChange={(e) => onChange(fieldId, e.target.value)}
              disabled={disabled}
              style={{
                width: '100%',
                padding: '9px 12px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none'
              }}
            >
              <option value="">-- Seleccionar --</option>
              {options.map((opt, idx) => {
                const optVal = typeof opt === 'string' ? opt : opt.id || opt.value || String(opt)
                const optLabel = typeof opt === 'string' ? opt : opt.label || opt.name || optVal
                return (
                  <option key={idx} value={optVal}>
                    {optLabel}
                  </option>
                )
              })}
            </select>
          </div>
        )
      }

      case 'boolean': {
        const boolVal = val === true || val === 'true' || val === 1 || val === '1'
        return (
          <div key={fieldId} style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {field.label} {isRequired && <span style={{ color: '#ff6b6b' }}>*</span>}
              </div>
              {field.help_text && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{field.help_text}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(fieldId, true)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  border: boolVal ? '1px solid #4CAF50' : '1px solid var(--border-color)',
                  background: boolVal ? 'rgba(76, 175, 80, 0.2)' : 'transparent',
                  color: boolVal ? '#4CAF50' : 'var(--text-muted)'
                }}
              >
                Sí
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(fieldId, false)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  border: (!boolVal && val !== '' && val !== null && val !== undefined) ? '1px solid #ff6b6b' : '1px solid var(--border-color)',
                  background: (!boolVal && val !== '' && val !== null && val !== undefined) ? 'rgba(255, 107, 107, 0.2)' : 'transparent',
                  color: (!boolVal && val !== '' && val !== null && val !== undefined) ? '#ff6b6b' : 'var(--text-muted)'
                }}
              >
                No
              </button>
            </div>
          </div>
        )
      }

      case 'text':
      default: {
        const isLongText = fieldId.includes('notes') || fieldId.includes('synthesis') || fieldId.includes('traits') || fieldId.includes('flags') || (field.help_text && field.help_text.length > 50)
        return (
          <div key={fieldId} style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
              {field.label} {isRequired && <span style={{ color: '#ff6b6b' }}>*</span>}
            </label>
            {field.help_text && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{field.help_text}</div>
            )}
            {isLongText ? (
              <textarea
                rows={3}
                value={val || ''}
                onChange={(e) => onChange(fieldId, e.target.value)}
                disabled={disabled}
                placeholder="Escribe aquí..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            ) : (
              <input
                type="text"
                value={val || ''}
                onChange={(e) => onChange(fieldId, e.target.value)}
                disabled={disabled}
                placeholder="Escribe aquí..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
            )}
          </div>
        )
      }
    }
  }

  return (
    <div style={{ marginBottom: 28, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 24 }}>
      <div style={{ marginBottom: 18, borderBottom: '1px solid rgba(150, 21, 0, 0.15)', paddingBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {section.title}
        </h3>
        {section.description && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
            {section.description}
          </p>
        )}
      </div>

      <div>
        {section.fields.map(field => renderField(field))}
      </div>
    </div>
  )
}
