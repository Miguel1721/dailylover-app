import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Sparkles, CheckCircle, ShieldCheck, Heart, ArrowRight, 
  X, Check, RefreshCw, AlertCircle, FileText, UserCheck
} from 'lucide-react'

export default function CopilotoClinicoModal({ analysisData, onClose, onSaveAndProceed }) {
  const navigate = useNavigate()
  const [quickNotes, setQuickNotes] = useState(analysisData?.quick_notes_ai || '')
  const [saving, setSaving] = useState(false)

  const dealbreakers = analysisData?.dealbreakers_ai || {}

  const handleConfirm = () => {
    setSaving(true)
    if (onSaveAndProceed) {
      onSaveAndProceed(quickNotes)
    } else {
      onClose()
      navigate('/admin/matchmaking/calendario')
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 2000,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }}>
      <div style={{
        width: '100%',
        maxWidth: 680,
        background: '#1A1214',
        border: '1px solid rgba(150, 21, 0, 0.5)',
        borderRadius: 20,
        padding: 32,
        boxShadow: '0 24px 70px rgba(0,0,0,0.9)',
        maxHeight: '90vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        color: '#F5F0F1'
      }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(150, 21, 0, 0.2)', pb: 16, paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#961500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFF',
              boxShadow: '0 4px 15px rgba(150,21,0,0.4)'
            }}>
              <Sparkles size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#F5F0F1' }}>
                Copiloto Clínico IA: Quick Notes & Dealbreakers
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={13} />
                <span>Transcripción analizada y extraída en tiempo real</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#9A8A8D', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 1. Dealbreakers e Innegociables detectados */}
        <div>
          <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#9A8A8D', letterSpacing: '0.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} style={{ color: '#c41a00' }} />
            <span>1. Innegociables & Dealbreakers Extraídos</span>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {Object.entries(dealbreakers).map(([key, val]) => (
              <div key={key} style={{
                background: '#0D0A0B',
                border: '1px solid rgba(150, 21, 0, 0.2)',
                borderRadius: 8,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                fontSize: 12
              }}>
                <span style={{ color: '#10B981', fontWeight: 700 }}>✓</span>
                <div>
                  <span style={{ color: '#9A8A8D', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>{key}:</span>
                  <span style={{ color: '#F5F0F1', fontWeight: 500 }}>{String(val)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Dinámica de Pareja y Apego */}
        <div style={{
          background: '#140D0F',
          border: '1px solid rgba(150, 21, 0, 0.3)',
          borderRadius: 12,
          padding: 16,
          fontSize: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}>
          <div>
            <span style={{ color: '#c41a00', fontWeight: 700, textTransform: 'uppercase', fontSize: 11, display: 'block', marginBottom: 4 }}>
              Dinámica de Pareja Detectada:
            </span>
            <p style={{ margin: 0, color: '#F5F0F1', lineHeight: 1.5 }}>
              {analysisData?.dinamica || 'Busca reciprocidad emocional y un proyecto de vida compartido.'}
            </p>
          </div>

          <div style={{ borderTop: '1px solid rgba(150, 21, 0, 0.15)', paddingTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#9A8A8D', fontWeight: 600 }}>Estilo de Apego Inferido:</span>
            <span style={{
              background: 'rgba(150, 21, 0, 0.2)',
              border: '1px solid rgba(150, 21, 0, 0.4)',
              color: '#F5F0F1',
              padding: '2px 8px',
              borderRadius: 6,
              fontWeight: 700
            }}>
              {analysisData?.apego || 'Apego Seguro con tendencia a la introspección'}
            </span>
          </div>
        </div>

        {/* 3. Redacción de Quick Notes */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#9A8A8D', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              3. Quick Notes Clínicas (Guardadas en BD):
            </label>
            <span style={{ fontSize: 11, color: '#10B981' }}>Inyectado en profiles.bio_notes</span>
          </div>
          <textarea
            rows={6}
            value={quickNotes}
            onChange={e => setQuickNotes(e.target.value)}
            style={{
              width: '100%',
              background: '#0D0A0B',
              border: '1px solid rgba(150, 21, 0, 0.3)',
              borderRadius: 10,
              padding: 14,
              color: '#F5F0F1',
              fontSize: 12,
              lineHeight: 1.6,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px 18px',
              background: 'transparent',
              border: '1px solid rgba(150, 21, 0, 0.3)',
              borderRadius: 10,
              color: '#9A8A8D',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cerrar sin redirigir
          </button>
          
          <button
            type="button"
            disabled={saving}
            onClick={handleConfirm}
            style={{
              flex: 2,
              padding: '12px 20px',
              background: '#961500',
              border: 'none',
              borderRadius: 10,
              color: '#FFF',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 15px rgba(150,21,0,0.4)'
            }}
          >
            <Check size={16} />
            <span>Confirmar y Volver a Matchmaking</span>
          </button>
        </div>

      </div>
    </div>
  )
}
