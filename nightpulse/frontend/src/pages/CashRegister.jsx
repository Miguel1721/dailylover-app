import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BrandSelector from '../components/BrandSelector';
import { Wallet, AlertTriangle, AlertCircle, CheckCircle, Search, HelpCircle } from 'lucide-react';

export default function CashRegister() {
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [registers, setRegisters] = useState([]);
  const [selectedRegister, setSelectedRegister] = useState(null);
  const [registerDetail, setRegisterDetail] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    async function fetchBrands() {
      try {
        const res = await axios.get('/api/brands');
        setBrands(res.data);
      } catch (err) {
        setBrands([
          {id: 1, name: 'Matildelina', genre: 'Vallenato Premium', accent_color: '#D4A574'},
          {id: 2, name: 'Furia', genre: 'Electrónica', accent_color: '#DC2626'},
          {id: 3, name: 'Casa D', genre: 'Crossover', accent_color: '#2563EB'},
          {id: 4, name: 'África', genre: 'Afrobeat / Tropical', accent_color: '#16A34A'},
          {id: 5, name: 'Gyal', genre: 'Reggaetón', accent_color: '#EC4899'}
        ]);
      }
    }
    fetchBrands();
  }, []);

  useEffect(() => {
    async function fetchRegisters() {
      setLoading(true);
      try {
        const brandQuery = selectedBrand ? `&brand_id=${selectedBrand}` : '';
        const res = await axios.get(`/api/cash-registers?date=2025-07-12${brandQuery}`);
        setRegisters(res.data);
        
        // Fetch overall summary KPI
        const sumRes = await axios.get(`/api/cash-registers/summary/kpis?date=2025-07-12${brandQuery}`);
        setSummary(sumRes.data);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching cash registers:', err);
        // Fallbacks
        const mockRegs = [
          {id: 8, venue_name: "Gyal Bogotá", brand_name: "Gyal", accent_color: "#EC4899", pos_total: 42240000, discrepancy: -2100000, void_count: 12, discount_count: 18, courtesy_count: 8, status: "flagged", anomaly_score: 85, ai_notes: "🚨 ALERTA CRÍTICA: Descuadre de $2.1M. 12 anulaciones — concentradas en mesero ID 142 entre 11pm-1am. 18 descuentos sin autorización."},
          {id: 2, venue_name: "Furia Bogotá", brand_name: "Furia", accent_color: "#DC2626", pos_total: 16000000, discrepancy: -1200000, void_count: 8, discount_count: 12, courtesy_count: 5, status: "flagged", anomaly_score: 72, ai_notes: "⚠️ Descuadre significativo de $1.2M. 8 anulaciones — 5 del bartender Diego R. entre 1am-3am. 12 descuentos sin autorización detectados."},
          {id: 4, venue_name: "Matildelina Bogotá", brand_name: "Matildelina", accent_color: "#D4A574", pos_total: 45700000, discrepancy: -250000, void_count: 2, discount_count: 4, courtesy_count: 3, status: "approved", anomaly_score: 12, ai_notes: "Cierre limpio de concierto de Silvestre Dangond. Descuadre mínimo de $250K dentro del rango aceptable."},
          {id: 6, venue_name: "Casa D Bogotá", brand_name: "Casa D", accent_color: "#2563EB", pos_total: 12530000, discrepancy: -130000, void_count: 1, discount_count: 2, courtesy_count: 1, status: "approved", anomaly_score: 5, ai_notes: "Cierre perfecto. Operación muy estable."}
        ];
        setRegisters(mockRegs);
        setSummary({
          cash_total: 62000000,
          card_total: 71900000,
          nequi_total: 24700000,
          rappi_total: 7600000,
          cover_total: 30300000,
          pos_total: 166200000,
          discrepancy_total: -4480000,
          avg_anomaly_score: 43.5,
          anomalies_count: 6
        });
        setLoading(false);
      }
    }
    fetchRegisters();
  }, [selectedBrand]);

  useEffect(() => {
    if (!selectedRegister) {
      setRegisterDetail(null);
      return;
    }
    async function fetchDetail() {
      setLoadingDetail(true);
      try {
        const res = await axios.get(`/api/cash-registers/${selectedRegister}`);
        setRegisterDetail(res.data);
        setLoadingDetail(false);
      } catch (err) {
        console.error('Error fetching register details:', err);
        // Mock detailed fallback
        const mockDetails = {
          register: registers.find(r => r.id === selectedRegister) || {},
          anomalies: [
            {id: 1, type: "void_excess", severity: "critical", amount: 1200000, description: "8 anulaciones de tragos premium consecutivas en menos de 2 horas. Patrón consistente con robo hormiga.", employee_name: "Mesero #142", detected_at: "2025-07-13T02:30:00"},
            {id: 2, type: "discount_unauthorized", severity: "high", amount: 650000, description: "18 descuentos aplicados sin código de autorización de gerente. Se concentraron al final de la jornada.", employee_name: "Varios", detected_at: "2025-07-13T03:00:00"},
            {id: 3, type: "courtesy_over_limit", severity: "high", amount: 480000, description: "8 cortesías de botella servidas. La política del local permite un máximo de 3 cortesías por noche.", employee_name: "Mesero #142", detected_at: "2025-07-13T01:45:00"}
          ]
        };
        setRegisterDetail(mockDetails);
        setLoadingDetail(false);
      }
    }
    fetchDetail();
  }, [selectedRegister, registers]);

  const formatCOP = (val) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(val);
  };

  const getStatusBadge = (status) => {
    const configs = {
      approved: { class: 'badge-success', label: 'Aprobado' },
      reviewed: { class: 'badge-info', label: 'Revisado' },
      flagged: { class: 'badge-critical', label: 'Sospechoso' },
      pending: { class: 'badge-warning', label: 'Pendiente' }
    };
    const c = configs[status] || configs.pending;
    return <span className={`badge ${c.class}`}>{c.label}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-neon" style={{ fontSize: '2rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wallet size={28} /> Conciliación y Cierre de Caja
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Auditoría automatizada de ingresos, cuadres nocturnos y detección de pérdidas
          </p>
        </div>
        
        <BrandSelector 
          brands={brands} 
          selectedBrand={selectedBrand} 
          onChange={setSelectedBrand} 
        />
      </div>

      {/* Cash summary metrics */}
      {!loading && summary && (
        <div className="np-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div className="glass-card" style={{ borderLeft: '4px solid var(--primary)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Facturación Total POS</span>
            <h3 style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '0.25rem' }}>{formatCOP(summary.pos_total)}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cierre consolidado del grupo</span>
          </div>
          
          <div className="glass-card" style={{ borderLeft: `4px solid ${summary.discrepancy_total < -500000 ? 'var(--error)' : 'var(--success)'}` }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Descuadre Consolidado</span>
            <h3 style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '0.25rem', color: summary.discrepancy_total < -500000 ? 'var(--error)' : 'var(--text-primary)' }}>
              {formatCOP(summary.discrepancy_total)}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Discrepancia caja vs. ventas registradas</span>
          </div>

          <div className="glass-card" style={{ borderLeft: '4px solid var(--critical)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Índice de Anomalías Promedio</span>
            <h3 style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '0.25rem', color: 'var(--critical)' }}>
              {Math.round(summary.avg_anomaly_score)}/100
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Basado en anulaciones y descuentos</span>
          </div>
        </div>
      )}

      {/* Main split layout: Left closures list, Right closure detailed audit */}
      <div className="np-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr', gap: '1.5rem' }}>
        
        {/* Left: Closure list */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Cierres de Caja de la Noche</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando cierres...</div>
            ) : registers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin registros para esta fecha.</div>
            ) : (
              registers.map((r) => (
                <div 
                  key={r.id}
                  onClick={() => setSelectedRegister(r.id)}
                  style={{
                    padding: '1rem',
                    background: selectedRegister === r.id ? 'rgba(139, 92, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid',
                    borderColor: selectedRegister === r.id ? 'var(--primary)' : 'var(--border-glass)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: r.accent_color }} />
                      <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{r.venue_name}</span>
                    </div>
                    {getStatusBadge(r.status)}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span>POS Ventas: {formatCOP(r.pos_total)}</span>
                    <span style={{ 
                      color: r.discrepancy < -500000 ? 'var(--error)' : 'var(--text-primary)',
                      fontWeight: '700'
                    }}>
                      Descuadre: {formatCOP(r.discrepancy)}
                    </span>
                  </div>

                  {/* Anomaly score indicator */}
                  <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nivel de Riesgo IA:</span>
                    <div className="progress-bar-container" style={{ flex: 1 }}>
                      <div 
                        className="progress-bar-fill"
                        style={{ 
                          width: `${r.anomaly_score}%`, 
                          backgroundColor: r.anomaly_score > 70 ? 'var(--critical)' : (r.anomaly_score > 40 ? 'var(--warning)' : 'var(--success)') 
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: r.anomaly_score > 70 ? 'var(--critical)' : 'var(--text-secondary)' }}>
                      {Math.round(r.anomaly_score)}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Selected Closure detailed audit */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '400px' }}>
          {!selectedRegister ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>
              <HelpCircle size={48} style={{ marginBottom: '1rem' }} />
              <h3>Auditoría de Cierre de Caja</h3>
              <p style={{ fontSize: '0.9rem', maxWidth: '300px', marginTop: '0.5rem' }}>
                Selecciona un cierre de caja de la lista de la izquierda para ver el desglose financiero, análisis de fraudes y conciliación.
              </p>
            </div>
          ) : loadingDetail ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <RefreshCw size={24} className="animate-spin" />
            </div>
          ) : registerDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Card header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem' }}>Auditoría: {registerDetail.register.venue_name}</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cierre del sábado 12 de Julio, 2025</span>
                </div>
                {getStatusBadge(registerDetail.register.status)}
              </div>

              {/* Cash vs digital breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Efectivo en Caja</span>
                  <p style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                    {formatCOP(registerDetail.register.cash_total || 0)}
                  </p>
                </div>
                <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tarjetas (Datáfono)</span>
                  <p style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                    {formatCOP(registerDetail.register.card_total || 0)}
                  </p>
                </div>
                <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nequi/Daviplata</span>
                  <p style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                    {formatCOP(registerDetail.register.nequi_total || 0)}
                  </p>
                </div>
                <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Domicilios / Rappi</span>
                  <p style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                    {formatCOP(registerDetail.register.rappi_total || 0)}
                  </p>
                </div>
              </div>

              {/* Anomaly log list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <AlertTriangle size={16} style={{ color: 'var(--critical)' }} />
                  Anomalías Detectadas ({registerDetail.anomalies.length})
                </h4>

                {registerDetail.anomalies.length === 0 ? (
                  <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '8px', color: 'var(--success)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle size={16} />
                    Cierre operativo sin anomalías detectadas. Todo coincide.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {registerDetail.anomalies.map((anom) => (
                      <div 
                        key={anom.id}
                        style={{
                          padding: '0.75rem',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid var(--border-glass)',
                          borderLeft: `3px solid var(--${anom.severity === 'critical' ? 'error' : (anom.severity === 'high' ? 'critical' : 'warning')})`,
                          borderRadius: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem' }}>
                          <span className={`badge ${
                            anom.severity === 'critical' ? 'badge-error' : (anom.severity === 'high' ? 'badge-critical' : 'badge-warning')
                          }`}>
                            {anom.type === 'void_excess' ? 'Anulación de tragos' : (anom.type === 'discount_unauthorized' ? 'Descuento sin clave' : 'Cortesía excede límite')}
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                            {formatCOP(anom.amount)}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '0.25rem' }}>
                          {anom.description}
                        </p>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Responsable: {anom.employee_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Natural language analysis summary */}
              <div style={{ padding: '1rem', background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '10px' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: '700', marginBottom: '0.25rem' }}>
                  Auditoría General (CFO Virtual IA)
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {registerDetail.register.ai_notes}
                </p>
              </div>

              {/* Audit Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button className="np-btn" style={{ flex: 1, justifyContent: 'center' }}>
                  Aprobar Conciliación
                </button>
                <button className="np-btn np-btn-secondary" style={{ flex: 1, justifyContent: 'center', borderColor: 'var(--error)', color: 'var(--error)' }}>
                  Reportar a Auditoría
                </button>
              </div>

            </div>
          ) : null}
        </div>

      </div>
    </div>
  );
}
