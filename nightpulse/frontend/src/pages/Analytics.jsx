import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BrandSelector from '../components/BrandSelector';
import AIInsightCard from '../components/AIInsightCard';
import { BarChart3, TrendingUp, DollarSign, Users, Sparkles, RefreshCw } from 'lucide-react';

export default function Analytics() {
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [events, setEvents] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

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
    async function fetchAnalytics() {
      setLoading(true);
      try {
        const brandQuery = selectedBrand ? `?brand_id=${selectedBrand}` : '';
        
        // Fetch event ROI
        const eventsRes = await axios.get(`/api/analytics/events${brandQuery}`);
        setEvents(eventsRes.data);

        // Fetch AI recommendations & insights
        const insightsRes = await axios.get(`/api/analytics/insights${brandQuery}`);
        setInsights(insightsRes.data);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching analytics:', err);
        // Fallbacks
        setEvents([
          {id: 1, venue_name: "Matildelina Bogotá", brand_name: "Matildelina", accent_color: "#D4A574", event_name: "Noche de Vallenato Premium", event_date: "2025-07-12", artist_name: "Silvestre Dangond", artist_cost: 35000000, cover_price: 80000, expected_attendance: 550, actual_attendance: 580, total_revenue: 45700000, total_cost: 42000000, roi_percentage: 8.8, status: "completed"},
          {id: 2, venue_name: "Furia Bogotá", brand_name: "Furia", accent_color: "#DC2626", event_name: "Furia Electronic Night", event_date: "2025-07-12", artist_name: "DJ Koze", artist_cost: 25000000, cover_price: 60000, expected_attendance: 700, actual_attendance: 720, total_revenue: 26100000, total_cost: 30000000, roi_percentage: -13.0, status: "completed"},
          {id: 3, venue_name: "Gyal Bogotá", brand_name: "Gyal", accent_color: "#EC4899", event_name: "Gyal Reggaetón Fest", event_date: "2025-07-12", artist_name: "Ryan Castro", artist_cost: 40000000, cover_price: 70000, expected_attendance: 650, actual_attendance: 680, total_revenue: 42240000, total_cost: 48000000, roi_percentage: -12.0, status: "completed"},
          {id: 4, venue_name: "Casa D Bogotá", brand_name: "Casa D", accent_color: "#2563EB", event_name: "Casa D Saturday", event_date: "2025-07-12", artist_name: null, artist_cost: 0, cover_price: 40000, expected_attendance: 400, actual_attendance: 380, total_revenue: 12530000, total_cost: 8000000, roi_percentage: 56.6, status: "completed"}
        ]);
        setInsights([
          {id: 1, brand_name: "Matildelina", accent_color: "#D4A574", type: "daily_summary", severity: "info", title: "Resumen Matildelina — Sábado 12 Jul", content: "🎵 Noche espectacular con Silvestre Dangond. Ventas totales: $45.7M (+87% vs promedio sábados). Ticket promedio: $78K. Ocupación: 97% (580/600). El whisky Buchanan's fue el producto estrella con 27 botellas vendidas. Cierre de caja limpio con descuadre mínimo de $250K (0.5%). Recomendación: considerar repetir artista de vallenato premium cada 3 semanas.", created_at: "2025-07-13T08:00:00"},
          {id: 2, brand_name: "Gyal", accent_color: "#EC4899", type: "anomaly", severity: "critical", title: "🚨 Alerta Crítica Gyal — Sábado 12 Jul", content: "Descuadre de $2.1M detectado. 12 anulaciones del mesero #142 concentradas entre 11pm y 1am. 18 descuentos sin autorización. 8 cortesías que exceden el límite de 3 por noche. Score de anomalía: 85/100. Acción requerida: investigación de fraude interno.", created_at: "2025-07-13T07:00:00"},
          {id: 3, brand_name: "Furia", accent_color: "#DC2626", type: "anomaly", severity: "warning", title: "⚠️ Anomalía Furia — Viernes 11 Jul", content: "Se detectó un patrón anómalo en el cierre de caja del viernes. 8 anulaciones concentradas entre 1am y 3am, 5 del bartender Diego R. El descuadre total fue de $1.2M (7.5% de las ventas). Este patrón es consistente con las últimas 3 semanas. Recomendación urgente: auditoría de cámara de la barra 1 entre 1am-3am.", created_at: "2025-07-12T09:30:00"}
        ]);
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [selectedBrand]);

  const formatCOP = (val) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-neon" style={{ fontSize: '2rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={28} /> Analytics & Decisiones de IA
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Evaluación de rentabilidad de eventos, análisis de artistas y sugerencias de crecimiento
          </p>
        </div>
        
        <BrandSelector 
          brands={brands} 
          selectedBrand={selectedBrand} 
          onChange={setSelectedBrand} 
        />
      </div>

      {/* Grid of Split Analysis: Left event ROI list, Right AI insights feed */}
      <div className="np-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
        
        {/* Left: Event ROI analysis */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={20} /> Rentabilidad por Artista y Evento
          </h3>
          
          <div className="np-table-container">
            <table className="np-table">
              <thead>
                <tr>
                  <th>Evento / Artista</th>
                  <th>Costo Artista</th>
                  <th>Cover ($)</th>
                  <th>Ingreso Total</th>
                  <th>Margen ROI</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                      <RefreshCw className="animate-spin" style={{ margin: '0 auto' }} />
                    </td>
                  </tr>
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No hay registros de eventos.
                    </td>
                  </tr>
                ) : (
                  events.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '700' }}>{e.event_name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {e.artist_name ? `Show: ${e.artist_name}` : 'Música de la casa (DJs)'}
                          </span>
                        </div>
                      </td>
                      <td>{formatCOP(e.artist_cost)}</td>
                      <td>{formatCOP(e.cover_price)}</td>
                      <td style={{ fontWeight: '700' }}>{formatCOP(e.total_revenue)}</td>
                      <td>
                        <span className={e.roi_percentage >= 0 ? 'roi-positive' : 'roi-negative'}>
                          {e.roi_percentage >= 0 ? '+' : ''}{e.roi_percentage}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: AI insights feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} style={{ color: 'var(--primary)' }} /> Recomendaciones IA Activas
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '520px', overflowY: 'auto' }}>
            {loading ? (
              <div>Cargando recomendaciones...</div>
            ) : insights.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay recomendaciones activas.</div>
            ) : (
              insights.map((ins) => (
                <AIInsightCard 
                  key={ins.id}
                  title={ins.title}
                  content={ins.content}
                  type={ins.type}
                  severity={ins.severity}
                  date={ins.created_at}
                  brandName={ins.brand_name}
                  accentColor={ins.accent_color}
                />
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
