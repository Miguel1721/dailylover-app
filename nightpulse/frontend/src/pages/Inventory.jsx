import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BrandSelector from '../components/BrandSelector';
import AlertBanner from '../components/AlertBanner';
import { Wine, AlertTriangle, RefreshCw, BarChart2, PackageOpen } from 'lucide-react';

export default function Inventory() {
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [variance, setVariance] = useState([]);
  const [forecast, setForecast] = useState([]);
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
    async function fetchData() {
      setLoading(true);
      try {
        const brandQuery = selectedBrand ? `?brand_id=${selectedBrand}` : '';
        
        // Fetch inventory
        const invRes = await axios.get(`/api/inventory${brandQuery}`);
        setInventory(invRes.data);

        // Fetch inventory alerts
        const alertsRes = await axios.get(`/api/inventory/alerts${brandQuery}`);
        setAlerts(alertsRes.data);

        // Fetch variance (mermas)
        const varRes = await axios.get(`/api/inventory/variance${brandQuery}`);
        setVariance(varRes.data);

        // Fetch demand forecast
        const forecastRes = await axios.get(`/api/inventory/forecast${brandQuery}`);
        setForecast(forecastRes.data);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching inventory data:', err);
        // Fallback mock data
        setInventory([
          {id: 1, venue_name: 'Matildelina Bogotá', brand_name: 'Matildelina', accent_color: '#D4A574', product_name: "Buchanan's 12 Años", category_name: 'Whisky', bar_number: 1, stock_bottles: 12.0, min_stock: 5.0, cost_price: 180000, sell_price: 450000, status: 'normal'},
          {id: 2, venue_name: 'Matildelina Bogotá', brand_name: 'Matildelina', accent_color: '#D4A574', product_name: "Aguardiente Antioqueño", category_name: 'Aguardiente', bar_number: 1, stock_bottles: 20.0, min_stock: 8.0, cost_price: 35000, sell_price: 120000, status: 'normal'},
          {id: 3, venue_name: 'Furia Bogotá', brand_name: 'Furia', accent_color: '#DC2626', product_name: 'Absolut Original', category_name: 'Vodka', bar_number: 3, stock_bottles: 1.5, min_stock: 5.0, cost_price: 65000, sell_price: 180000, status: 'low_stock'},
          {id: 4, venue_name: 'Furia Bogotá', brand_name: 'Furia', accent_color: '#DC2626', product_name: "Hendrick's", category_name: 'Ginebra', bar_number: 1, stock_bottles: 10.0, min_stock: 4.0, cost_price: 160000, sell_price: 380000, status: 'normal'},
          {id: 5, venue_name: 'Gyal Bogotá', brand_name: 'Gyal', accent_color: '#EC4899', product_name: 'Agua Sin Gas', category_name: 'Agua/Gaseosas', bar_number: 1, stock_bottles: 0.0, min_stock: 15.0, cost_price: 1000, sell_price: 8000, status: 'out_of_stock'}
        ]);
        setAlerts([
          {id: 1, venue_name: 'Furia Bogotá', title: 'Stock crítico: Absolut Original', message: 'Quedan 1.5 botellas en la Barra 3. Min requerido: 5.0', severity: 'warning'},
          {id: 2, venue_name: 'Gyal Bogotá', title: 'Agotado: Agua Sin Gas', message: '0 unidades en Barra 1. Min requerido: 15.0', severity: 'error'}
        ]);
        setVariance([
          {brand: "Furia Bogotá", bar: "Barra 1", bartender: "Diego R.", product: "Absolut Original", pos_qty: 35, phys_qty: 37.5, variance: -2.5, cost_lost: 162500, status: "flagged"},
          {brand: "Matildelina Bogotá", bar: "Barra 2", bartender: "María P.", product: "Buchanan's 12 Años", pos_qty: 18, phys_qty: 19.0, variance: -1.0, cost_lost: 180000, status: "reviewed"},
          {brand: "Gyal Bogotá", bar: "Barra 1", bartender: "Andrés G.", product: "Aguardiente Antioqueño", pos_qty: 40, phys_qty: 43.0, variance: -3.0, cost_lost: 105000, status: "flagged"}
        ]);
        setForecast([
          {brand: "Matildelina Bogotá", product: "Buchanan's 12 Años", current_stock: 26, avg_saturday: 20, forecast_next: 28, recommended_order: 12, reason: "Artista Carlos Vives Jr programado el sábado"},
          {brand: "Furia Bogotá", product: "Grey Goose", current_stock: 14, avg_saturday: 15, forecast_next: 22, recommended_order: 15, reason: "Evento Afterlife con preventas agotadas"}
        ]);
        setLoading(false);
      }
    }
    fetchData();
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
            <Wine size={28} /> Control de Inventarios
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Supervisión de stock, mermas de licores y compras inteligentes con IA
          </p>
        </div>
        
        <BrandSelector 
          brands={brands} 
          selectedBrand={selectedBrand} 
          onChange={setSelectedBrand} 
        />
      </div>

      {/* Grid of Alert Warnings */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {alerts.map((a) => (
            <AlertBanner 
              key={a.id}
              title={`${a.venue_name}: ${a.title}`}
              message={a.message}
              severity={a.severity}
            />
          ))}
        </div>
      )}

      {/* Main content grid: Left Stock Table, Right AI Variance & Forecast */}
      <div className="np-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
        
        {/* Left: Inventory list */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PackageOpen size={20} /> Stock Actual por Barras
          </h3>
          
          <div className="np-table-container">
            <table className="np-table">
              <thead>
                <tr>
                  <th>Sede/Barra</th>
                  <th>Producto</th>
                  <th>Stock Físico</th>
                  <th>Min. Req</th>
                  <th>Costo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto' }} />
                    </td>
                  </tr>
                ) : inventory.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No se encontraron registros de inventario.
                    </td>
                  </tr>
                ) : (
                  inventory.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>{i.venue_name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Barra #{i.bar_number}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '600' }}>{i.product_name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{i.category_name}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: '700' }}>{i.stock_bottles} bot</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{i.min_stock} bot</td>
                      <td>{formatCOP(i.cost_price)}</td>
                      <td>
                        <span className={`badge ${
                          i.status === 'out_of_stock' ? 'badge-error' : (i.status === 'low_stock' ? 'badge-warning' : 'badge-success')
                        }`}>
                          {i.status === 'out_of_stock' ? 'Agotado' : (i.status === 'low_stock' ? 'Crítico' : 'Ok')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: AI Variance (Mermas) & Forecast */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* AI Variance / Mermas Section */}
          <div className="glass-card" style={{ borderLeft: '4px solid var(--critical)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <AlertTriangle size={18} style={{ color: 'var(--critical)' }} />
              Detección de Mermas (POS vs Físico)
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: '1.4' }}>
              La IA cruza ventas del POS vs. auditoría de inventario por barra y bartender.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {variance.map((v, index) => (
                <div key={index} style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{v.brand} · {v.bar}</span>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: '700', margin: '0.1rem 0' }}>{v.product}</h4>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Bartender: {v.bartender}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: 'var(--error)', fontWeight: '700', fontSize: '0.95rem', display: 'block' }}>{v.variance} bot</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pérdida: {formatCOP(v.cost_lost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Forecast & Intelligent Purchasing */}
          <div className="glass-card" style={{ borderLeft: '4px solid var(--secondary)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={18} style={{ color: 'var(--secondary)' }} />
              Predicción de Demanda y Compras
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: '1.4' }}>
              Pedidos optimizados calculados según eventos locales, reservas y patrones históricos.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {forecast.map((f, index) => (
                <div key={index} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--secondary)' }}>{f.brand}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Stock: {f.current_stock} bot</span>
                  </div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.25rem' }}>{f.product}</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.3', marginBottom: '0.5rem' }}>
                    {f.reason}
                  </p>
                  <div style={{ background: 'rgba(6, 182, 212, 0.05)', padding: '0.4rem', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '600' }}>
                    <span>Orden sugerida:</span>
                    <span style={{ color: 'var(--secondary)' }}>+{f.recommended_order} botellas</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
