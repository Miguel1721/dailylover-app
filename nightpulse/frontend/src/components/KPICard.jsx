import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function KPICard({ title, value, icon: Icon, trend, trendType, subtitle, loading, accentColor }) {
  if (loading) {
    return (
      <div className="glass-card skeleton" style={{ height: '140px' }}></div>
    );
  }

  const isPositive = trendType === 'up';
  const trendColor = isPositive ? 'var(--success)' : 'var(--error)';
  const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {accentColor && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: accentColor
        }}></div>
      )}
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500' }}>
          {title}
        </span>
        {Icon && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '0.5rem',
            borderRadius: '8px',
            color: accentColor || 'var(--primary)'
          }}>
            <Icon size={20} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)' }}>
          {value}
        </span>
      </div>

      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
          <span style={{ 
            color: trendColor, 
            display: 'inline-flex', 
            alignItems: 'center', 
            fontWeight: '600'
          }}>
            <TrendIcon size={14} />
            {trend}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            {subtitle || 'vs. semana anterior'}
          </span>
        </div>
      )}
    </div>
  );
}
