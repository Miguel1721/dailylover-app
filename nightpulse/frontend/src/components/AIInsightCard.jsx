import React from 'react';
import { Sparkles, Calendar, TrendingUp, AlertTriangle } from 'lucide-react';

export default function AIInsightCard({ title, content, type, severity, date, brandName, accentColor }) {
  const icons = {
    daily_summary: Sparkles,
    recommendation: TrendingUp,
    anomaly: AlertTriangle,
    alert: AlertTriangle
  };

  const Icon = icons[type] || Sparkles;
  
  // Custom colors matching severity
  const severityColors = {
    info: 'var(--secondary)',
    warning: 'var(--warning)',
    error: 'var(--error)',
    critical: 'var(--critical)'
  };
  
  const indicatorColor = severityColors[severity] || 'var(--primary)';

  return (
    <div 
      className="glass-card" 
      style={{
        border: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: `inset 0 0 15px rgba(139, 92, 246, 0.02)`,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1.5rem',
        background: 'linear-gradient(135deg, rgba(13, 13, 23, 0.9) 0%, rgba(20, 20, 35, 0.7) 100%)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            background: `rgba(139, 92, 246, 0.1)`,
            color: indicatorColor,
            padding: '0.4rem',
            borderRadius: '6px'
          }}>
            <Icon size={18} />
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: indicatorColor }}>
            {type === 'daily_summary' ? 'Resumen Diario IA' : (type === 'anomaly' ? 'Alerta de Fraude' : 'Recomendación IA')}
          </span>
        </div>
        
        {brandName && (
          <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.04)', color: accentColor || 'var(--text-primary)', borderColor: accentColor || 'var(--border-glass)' }}>
            {brandName}
          </span>
        )}
      </div>

      <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
        {title}
      </h3>
      
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
        {content}
      </p>

      {date && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
          <Calendar size={12} />
          <span>{new Date(date).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      )}
    </div>
  );
}
