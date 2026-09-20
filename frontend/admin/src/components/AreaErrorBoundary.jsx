import React from 'react'
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * AreaErrorBoundary
 * Aísla fallos en tiempo de ejecución por dominio funcional (Psicólogas, CS, María, Finanzas).
 * Si ocurre un error no capturado dentro de un área, evita que toda la aplicación se caiga en blanco
 * y permite reintentar el módulo de forma independiente.
 */
export class AreaErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[AreaErrorBoundary - ${this.props.areaName || 'Módulo'}]:`, error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }))
  }

  render() {
    if (this.state.hasError) {
      const area = this.props.areaName || 'esta sección'

      return (
        <div style={{
          padding: '40px 24px',
          maxWidth: 680,
          margin: '40px auto',
          background: 'var(--bg-card, #1A1214)',
          border: '1.5px solid rgba(239, 68, 68, 0.35)',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          textAlign: 'center'
        }}>
          <div style={{
            width: 54,
            height: 54,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: '#EF4444'
          }}>
            <AlertTriangle size={28} />
          </div>

          <h3 style={{
            fontSize: 20,
            fontWeight: 800,
            margin: '0 0 8px',
            color: 'var(--text-primary, #F5F0F1)'
          }}>
            Aislamiento de Módulo: {area}
          </h3>

          <p style={{
            fontSize: 14,
            color: 'var(--text-secondary, #9A8A8D)',
            margin: '0 auto 20px',
            maxWidth: 520,
            lineHeight: 1.55
          }}>
            Se presentó un detalle inesperado exclusivamente en <b>{area}</b>. Las demás áreas del sistema (Psicólogas, Clientes, Citas) continúan operando con normalidad.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            <button
              onClick={this.handleReset}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 700
              }}
            >
              <RefreshCw size={15} /> Reintentar Módulo
            </button>

            <button
              onClick={() => { window.location.href = '/admin' }}
              className="btn btn-ghost"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 700
              }}
            >
              <Home size={15} /> Ir al Inicio
            </button>
          </div>

          {/* Acordeón de Detalles Técnicos */}
          <div style={{
            borderTop: '1px solid var(--border-color, rgba(150, 21, 0, 0.2))',
            paddingTop: 14,
            textAlign: 'left'
          }}>
            <button
              onClick={this.toggleDetails}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted, #78716c)',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: 0
              }}
            >
              <span>{this.state.showDetails ? 'Ocultar diagnóstico técnico' : 'Ver diagnóstico técnico'}</span>
              {this.state.showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {this.state.showDetails && (
              <div style={{
                marginTop: 10,
                background: 'var(--bg-base, #0D0A0B)',
                border: '1px solid var(--border-color, rgba(150, 21, 0, 0.2))',
                borderRadius: 8,
                padding: 12,
                fontSize: 11,
                fontFamily: 'monospace',
                color: '#EF4444',
                maxHeight: 180,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap'
              }}>
                {this.state.error?.toString()}
                {this.state.errorInfo?.componentStack}
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default AreaErrorBoundary
