import React from 'react';
import { AlertCircle, AlertTriangle, Info, ShieldAlert, X } from 'lucide-react';

export default function AlertBanner({ title, message, severity, date, onDismiss }) {
  const severities = {
    info: {
      class: 'badge-info',
      icon: Info,
      border: 'rgba(6, 182, 212, 0.15)',
      bg: 'rgba(6, 182, 212, 0.05)'
    },
    warning: {
      class: 'badge-warning',
      icon: AlertTriangle,
      border: 'rgba(245, 158, 11, 0.15)',
      bg: 'rgba(245, 158, 11, 0.05)'
    },
    error: {
      class: 'badge-error',
      icon: AlertCircle,
      border: 'rgba(239, 68, 68, 0.15)',
      bg: 'rgba(239, 68, 68, 0.05)'
    },
    critical: {
      class: 'badge-critical',
      icon: ShieldAlert,
      border: 'rgba(236, 72, 153, 0.3)',
      bg: 'rgba(236, 72, 153, 0.08)'
    }
  };

  const config = severities[severity] || severities.info;
  const Icon = config.icon;

  return (
    <div 
      className="glass-card" 
      style={{
        borderLeft: `4px solid var(--${severity})`,
        borderColor: config.border,
        background: config.bg,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem',
        padding: '1.25rem'
      }}
    >
      <div style={{ color: `var(--${severity})` }}>
        <Icon size={24} />
      </div>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            {title}
          </h4>
          {onDismiss && (
            <button 
              onClick={onDismiss}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.4' }}>
          {message}
        </p>
        {date && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {new Date(date).toLocaleString('es-CO')}
          </span>
        )}
      </div>
    </div>
  );
}
