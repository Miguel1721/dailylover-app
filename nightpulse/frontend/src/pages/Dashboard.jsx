import React, { useState, useEffect } from 'react';
import axios from 'axios';
import KPICard from '../components/KPICard';
import AlertBanner from '../components/AlertBanner';
import BrandSelector from '../components/BrandSelector';
import AIInsightCard from '../components/AIInsightCard';
import { 
  TrendingUp, 
  Users, 
  AlertTriangle, 
  Sparkles, 
  ChevronRight, 
  DollarSign 
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [comparison, setComparison] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function fetchInitialData() {
      try {
        setLoading(true);
        // Fetch brands
        const brandsRes = await axios.get('/api/brands');
        setBrands(brandsRes.data);

        // Fetch dashboard summary
        const summaryRes = await axios.get('/api/dashboard/summary');
        setSummary(summaryRes.data);

        // Fetch active alerts
        const alertsRes = await axios.get('/api/alerts');
        setAlerts(alertsRes.data);

        // Fetch brand comparison
        const comparisonRes = await axios.get('/api/dashboard/brand-comparison');
        setComparison(comparisonRes.data);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        // Standard mockup fallbacks if server not responding yet (demo mode fallback)
        const mockBrands = [
          {id: 1, name: 'Matildelina', genre: 'Vallenato Premium', accent_color: '#D4A574'},
          {id: 2, name: 'Furia', genre: 'Electrónica', accent_color: '#DC2626'},
          {id: 3, name: 'Casa D', genre: 'Crossover', accent_color: '#2563EB'},
          {id: 4, name: 'África', genre: 'Afrobeat / Tropical', accent_color: '#16A34A'},
          {id: 5, name: 'Gyal', genre: 'Reggaetón', accent_color: '#EC4899'}
        ];
        setBrands(mockBrands);
        setSummary({
          revenue: 142170000,
          avg_ticket: 78000,
          occupancy_rate: 82.5,
          active_alerts: 4,
          ai_summary: '🎵 Operación del sábado 12 de julio muy positiva. Ingresos totales del grupo: $142M (+12% vs sábado anterior). Matildelina fue la marca líder con $45.7M gracias al concierto de Silvestre Dangond. Furia Bogotá y Gyal registraron alertas de descuadres de caja altos que requieren auditoría. El inventario de ginebra premium en Furia estuvo en stock crítico a las 11:30 PM.',
          chart_data: [
            {brand_id: 1, name: 'Matildelina', color: '#D4A574', revenue: 45700000},
            {brand_id: 7, name: 'Gyal', color: '#EC4899', revenue: 42240000},
            {brand_id: 2, name: 'Furia', color: '#DC2626', revenue: 26100000},
            {brand_id: 4, name: 'Casa D', color: '#2563EB', revenue: 12530000},
            {brand_id: 6, name: 'África', color: '#16A34A', revenue: 7050000}
          ]
        });
        setAlerts([
          {id: 1, venue_name: 'Gyal Bogotá', severity: 'critical', title: 'Posible fraude interno: Mesero #142', message: 'Descuadre de $2.1M. 12 anulaciones en 2 horas.', created_at: '2025-07-13T03:00:00'},
          {id: 2, venue_name: 'Furia Bogotá', severity: 'error', title: 'Descuadre de caja alto: $1.2M', message: 'Bartender Diego R. registra 8 anulaciones consecutivas.', created_at: '2025-07-12T09:30:00'},
          {id: 3, venue_name: 'Furia Bogotá', severity: 'warning', title: 'Stock crítico: Absolut', message: 'Quedan menos de 2 botellas en la Barra 3.', created_at: '2025-07-12T23:00:00'}
        ]);
        setComparison([
          {id: 1, name: 'Matildelina', genre: 'Vallenato', color: '#D4A574', revenue: 45700000, discrepancy: -250000, anomaly_score: 12, occupancy: 96.6},
          {id: 5, name: 'Gyal', genre: 'Reggaetón', color: '#EC4899', revenue: 42240000, discrepancy: -2100000, anomaly_score: 85, occupancy: 97.1},
          {id: 2, name: 'Furia', genre: 'Electrónica', color: '#DC2626', revenue: 26100000, discrepancy: -800000, anomaly_score: 45, occupancy: 90.0},
          {id: 3, name: 'Casa D', genre: 'Crossover', color: '#2563EB', revenue: 12530000, discrepancy: -130000, anomaly_score: 5, occupancy: 69.1},
          {id: 4, name: 'África', genre: 'Tropical', color: '#16A34A', revenue: 7050000, discrepancy: -150000, anomaly_score: 10, occupancy: 71.1}
        ]);
        setLoading(false);
      }
    }
    fetchInitialData();
  }, []);

  // Fetch summary when brand changes
  useEffect(() => {
    if (loading) return;
    async function fetchSummary() {
      try {
        const url = selectedBrand ? `/api/dashboard/summary?brand_id=${selectedBrand}` : '/api/dashboard/summary';
        const summaryRes = await axios.get(url);
        setSummary(summaryRes.data);
      } catch (err) {
        console.error('Error fetching brand summary:', err);
      }
    }
    fetchSummary();
  }, [selectedBrand]);

  const formatCOP = (val) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(val);
  };

  const handleGenerateLiveSummary = async () => {
    let apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      apiKey = prompt("Para pruebas en vivo, ingresa tu API Key de Google Gemini (obtenla gratis en Google AI Studio):");
      if (apiKey) {
        localStorage.setItem('gemini_api_key', apiKey);
      } else {
        return;
      }
    }
    
    try {
      setGenerating(true);
      const url = selectedBrand ? `/api/analytics/generate-live-summary?brand_id=${selectedBrand}` : '/api/analytics/generate-live-summary';
      const res = await axios.post(url, { api_key: apiKey });
      
      if (res.data.status === 'error') {
        alert(res.data.message);
        localStorage.removeItem('gemini_api_key');
      } else if (res.data.generated_insight) {
        setSummary(prev => ({
          ...prev,
          ai_summary: res.data.generated_insight
        }));
      }
    } catch (err) {
      console.error(err);
      alert("Error al conectar con la API de IA. Por favor verifica que tu API Key sea correcta.");
      localStorage.removeItem('gemini_api_key');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-neon" style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
            Consola Ejecutiva
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Visibilidad total e inteligencia operativa del Grupo Evedesa
          </p>
        </div>
        
        <BrandSelector 
          brands={brands} 
          selectedBrand={selectedBrand} 
          onChange={setSelectedBrand} 
        />
      </div>

      {/* KPI Cards Grid */}
      <div className="np-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        <KPICard 
          title="Facturación Anoche"
          value={loading ? '' : formatCOP(summary?.revenue || 0)}
          icon={DollarSign}
          trend="+12.4%"
          trendType="up"
          loading={loading}
          accentColor="var(--primary)"
        />
        <KPICard 
          title="Ticket Promedio"
          value={loading ? '' : formatCOP(summary?.avg_ticket || 0)}
          icon={TrendingUp}
          trend="+4.2%"
          trendType="up"
          loading={loading}
          accentColor="var(--secondary)"
        />
        <KPICard 
          title="Ocupación Promedio"
          value={loading ? '' : `${summary?.occupancy_rate || 0}%`}
          icon={Users}
          trend="+8.5%"
          trendType="up"
          loading={loading}
          accentColor="var(--success)"
        />
        <KPICard 
          title="Alertas Activas"
          value={loading ? '' : (summary?.active_alerts || 0)}
          icon={AlertTriangle}
          trend={summary?.active_alerts > 0 ? "Revisión req." : "Limpio"}
          trendType={summary?.active_alerts > 0 ? "down" : "up"}
          loading={loading}
          accentColor="var(--error)"
        />
      </div>

      {/* Main Content Layout */}
      <div className="np-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem' }}>
        {/* Left column: AI Insights & Brand Comparison */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* AI natural language insights */}
          <div style={{ position: 'relative' }}>
            <AIInsightCard 
              title={selectedBrand ? `Análisis Operativo IA — ${brands.find(b => b.id === selectedBrand)?.name}` : "Consolidado de Operación Nocturna (IA)"}
              content={summary?.ai_summary || ''}
              type="daily_summary"
              severity="info"
              date="2025-07-12"
            />
            <button
              onClick={handleGenerateLiveSummary}
              disabled={generating}
              className="np-btn"
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.5rem',
                fontSize: '0.8rem',
                padding: '0.35rem 0.75rem',
                background: 'rgba(139, 92, 246, 0.15)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                color: 'var(--text-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              {generating ? 'Generando...' : 'Regenerar en Vivo ✨'}
            </button>
          </div>

          {/* Brand Performance and Comparison Table */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Desempeño Comparativo de Marcas</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sábado 12 de Julio</span>
            </h3>
            
            <div className="np-table-container">
              <table className="np-table">
                <thead>
                  <tr>
                    <th>Marca</th>
                    <th>Facturación</th>
                    <th>Descuadre</th>
                    <th>Aforo</th>
                    <th>Riesgo IA</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: c.color,
                            boxShadow: `0 0 8px ${c.color}`
                          }} />
                          <span style={{ fontWeight: '600' }}>{c.name}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: '700' }}>{formatCOP(c.revenue)}</td>
                      <td style={{ color: c.discrepancy < -500000 ? 'var(--error)' : 'var(--text-primary)' }}>
                        {formatCOP(c.discrepancy)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '70px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: '500' }}>{c.occupancy}%</span>
                          <div className="progress-bar-container">
                            <div 
                              className="progress-bar-fill" 
                              style={{ width: `${c.occupancy}%`, backgroundColor: c.occupancy > 90 ? 'var(--success)' : 'var(--primary)' }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${c.anomaly_score > 70 ? 'badge-critical' : (c.anomaly_score > 40 ? 'badge-warning' : 'badge-success')}`}>
                          {c.anomaly_score > 70 ? 'Alto' : (c.anomaly_score > 40 ? 'Medio' : 'Bajo')}
                        </span>
                      </td>
                      <td>
                        <Link 
                          to="/cash-register" 
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            color: 'var(--primary)',
                            textDecoration: 'none',
                            fontWeight: '600',
                            fontSize: '0.8rem',
                            gap: '0.25rem'
                          }}
                        >
                          Auditar <ChevronRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column: Real-time alert feed & Quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Real-time Alert Feed */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--error)', animation: 'pulse-border 1.5s infinite' }} />
              Monitoreo y Alertas Críticas
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto' }}>
              {alerts.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Sin alertas críticas pendientes de revisión.
                </div>
              ) : (
                alerts.map((a) => (
                  <AlertBanner 
                    key={a.id}
                    title={`${a.venue_name || a.brand_name}: ${a.title}`}
                    message={a.message}
                    severity={a.severity}
                    date={a.created_at}
                  />
                ))
              )}
            </div>
          </div>

          {/* Quick Metrics / Summary */}
          <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%)', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Negocio en Crecimiento
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.4', marginBottom: '1rem' }}>
              Grupo Evedesa se encuentra expandiendo Casa D a Cartagena, Cali y Medellín, además de consolidar su operación en Miami Beach.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge badge-info">Miami Open (3 Locales)</span>
              <span className="badge badge-success">Cartagena Ready</span>
              <span className="badge badge-warning">Cali Q3 2026</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
