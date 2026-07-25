import React from 'react';

export default function BrandSelector({ brands, selectedBrand, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Filtrar Marca:
      </label>
      <div style={{ position: 'relative' }}>
        <select
          className="np-select"
          value={selectedBrand || ''}
          onChange={(e) => {
            const val = e.target.value;
            onChange(val ? parseInt(val) : null);
          }}
          style={{
            minWidth: '200px'
          }}
        >
          <option value="">Todas las marcas</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.genre})
            </option>
          ))}
        </select>
        
        {/* Color indicator dot for selected brand */}
        {selectedBrand && (
          <div 
            style={{
              position: 'absolute',
              left: '-12px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: brands.find(b => b.id === selectedBrand)?.accent_color || 'var(--primary)',
              boxShadow: `0 0 8px ${brands.find(b => b.id === selectedBrand)?.accent_color || 'var(--primary)'}`
            }}
          />
        )}
      </div>
    </div>
  );
}
