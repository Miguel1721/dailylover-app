import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BrandSelector from '../components/BrandSelector';
import { ShieldCheck, AlertOctagon, Clock, Calendar, CheckSquare, RefreshCw } from 'lucide-react';

export default function Compliance() {
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
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
    async function fetchComplianceData() {
      setLoading(true);
      try {
        const brandQuery = selectedBrand ? `?brand_id=${selectedBrand}` : '';
        const itemsRes = await axios.get(`/api/compliance${brandQuery}`);
        setItems(itemsRes.data);

        const sumRes = await axios.get(`/api/compliance/summary${brandQuery}`);
        setSummary(sumRes.data);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching compliance data:', err);
        // Fallbacks
        setItems([
          {id: 1, venue_name: "Matildelina Bogotá", brand_name: "Matildelina", accent_color: "#D4A574", category: "DIAN", item_name: "Facturación electrónica - Resolución vigente", due_date: "2025-12-31", status: "completed", responsible: "Contabilidad"},
          {id: 2, venue_name: "Matildelina Bogotá", brand_name: "Matildelina", accent_color: "#D4A574", category: "DIAN", item_name: "Declaración IVA bimestral", due_date: "2025-07-15", status: "pending", responsible: "Contabilidad"},
          {id: 3, venue_name: "Furia Bogotá", brand_name: "Furia", accent_color: "#DC2626", category: "DIAN", item_name: "Declaración IVA bimestral", due_date: "2025-07-15", status: "overdue", responsible: "Contabilidad"},
          {id: 4, venue_name: "Gyal Bogotá", brand_name: "Gyal", accent_color: "#EC4899", category: "Bomberos", item_name: "Certificado técnico de seguridad", due_date: "2025-07-20", status: "overdue", responsible: "Operaciones"},
          {id: 5, venue_name: "Matildelina Bogotá", brand_name: "Matildelina", accent_color: "#D4A574", category: "Sayco-Acinpro", item_name: "Licencia de derechos de autor musical", due_date: "2025-09-30", status: "completed", responsible: "Jurídico"}
        ]);
        setSummary({
          completed: 18,
          pending: 5,
          overdue: 3,
          not_applicable: 0
        });
        setLoading(false);
      }
    }
    fetchComplianceData();
  }, [selectedBrand]);

  const getStatusBadge = (status) => {
    const badges = {
      completed: { class: 'badge-success', label: 'Vigente' },
      pending: { class: 'badge-warning', label: 'Pendiente' },
      overdue: { class: 'badge-error', label: 'Vencido' }
    };
    const b = badges[status] || badges.pending;
    return <span className={`badge ${b.class}`}>{b.label}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-neon" style={{ fontSize: '2rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={28} /> Control de Compliance Legal
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Supervisión regulatoria de obligaciones DIAN, Sayco-Acinpro, aforos de seguridad y ley seca
          </p>
        </div>
        
        <BrandSelector 
          brands={brands} 
          selectedBrand={selectedBrand} 
          onChange={setSelectedBrand} 
        />
      </div>

      {/* Summary KPI count */}
      {!loading && summary && (
        <div className="np-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div className="glass-card" style={{ borderLeft: '4px solid var(--success)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '0.75rem', borderRadius: '10px' }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Obligaciones Al Día</span>
              <h3 style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '0.1rem' }}>{summary.completed}</h3>
            </div>
          </div>

          <div className="glass-card" style={{ borderLeft: '4px solid var(--warning)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', padding: '0.75rem', borderRadius: '10px' }}>
              <Clock size={24} />
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Vencimientos Próximos</span>
              <h3 style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '0.1rem' }}>{summary.pending}</h3>
            </div>
          </div>

          <div className="glass-card" style={{ borderLeft: '4px solid var(--error)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', padding: '0.75rem', borderRadius: '10px' }}>
              <AlertOctagon size={24} />
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Vencidos / Críticos</span>
              <h3 style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '0.1rem', color: 'var(--error)' }}>{summary.overdue}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Main checklists layout */}
      <div className="glass-card">
        <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckSquare size={20} /> Matriz de Obligaciones por Sede
        </h3>
        
        <div className="np-table-container">
          <table className="np-table">
            <thead>
              <tr>
                <th>Local</th>
                <th>Categoría</th>
                <th>Requerimiento / Trámite</th>
                <th>Responsable</th>
                <th>Fecha Límite</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                    <RefreshCw className="animate-spin" style={{ margin: '0 auto' }} />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No hay obligaciones vigentes registradas.
                  </td>
                </tr>
              ) : (
                items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: i.accent_color }} />
                        <span style={{ fontWeight: '700' }}>{i.venue_name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{i.category}</span>
                    </td>
                    <td style={{ fontWeight: '600' }}>{i.item_name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{i.responsible}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                        <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                        <span>{i.due_date ? new Date(i.due_date).toLocaleDateString('es-CO') : 'Sin fecha'}</span>
                      </div>
                    </td>
                    <td>{getStatusBadge(i.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
