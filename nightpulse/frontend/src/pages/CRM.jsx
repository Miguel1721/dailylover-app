import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BrandSelector from '../components/BrandSelector';
import { Award, Calendar, Search, ShieldAlert, Award as VipIcon, Sparkles } from 'lucide-react';

export default function CRM() {
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [search, setSearch] = useState('');
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
    async function fetchCRMData() {
      setLoading(true);
      try {
        const brandQuery = selectedBrand ? `&brand_id=${selectedBrand}` : '';
        const searchParam = search ? `?search=${search}` : '';
        const custRes = await axios.get(`/api/crm/customers${searchParam}`);
        setCustomers(custRes.data);

        // Fetch reservations for Saturday 19 Jul (the next Saturday in the seed)
        const resRes = await axios.get(`/api/crm/reservations?date=2025-07-19${brandQuery}`);
        setReservations(resRes.data);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching CRM data:', err);
        // Fallbacks
        setCustomers([
          {id: 1, full_name: "Alejandra Martínez", phone: "3101234567", email: "ale.mtz@gmail.com", instagram: "@alemtz_", vip_tier: "platinum", total_visits: 48, total_spend: 28500000, preferred_drink: "Moët & Chandon", no_show_score: 5, notes: "Cliente recurrente en Gyal y África. Prefiere mesas VIP cerca de cabina."},
          {id: 2, full_name: "Sebastián Torres", phone: "3101234568", email: "seb.torres@gmail.com", instagram: "@sebtorres", vip_tier: "gold", total_visits: 35, total_spend: 18200000, preferred_drink: "Buchanan's 12", no_show_score: 12, notes: "Frecuenta Matildelina y Casa D. Reserva mesa de 6-8 personas."},
          {id: 3, full_name: "Valentina Duque", phone: "3101234569", email: "val.duque@outlook.com", instagram: "@valduque", vip_tier: "gold", total_visits: 28, total_spend: 14800000, preferred_drink: "Grey Goose", no_show_score: 8, notes: "Le encanta Furia Bogotá. Viene los viernes."},
          {id: 4, full_name: "Daniel Mejía", phone: "3101234570", email: "dan.mejia@gmail.com", instagram: "@danmejia", vip_tier: "silver", total_visits: 22, total_spend: 9500000, preferred_drink: "Don Julio", no_show_score: 25, notes: "Visita Gyal Bogotá. Alto riesgo de no-show en cumpleaños."}
        ]);
        setReservations([
          {id: 1, customer_name: "Alejandra Martínez", customer_vip_tier: "platinum", no_show_score: 5, venue_name: "Gyal Bogotá", brand_name: "Gyal", accent_color: "#EC4899", reservation_date: "2025-07-19", party_size: 8, type: "vip", status: "confirmed", bottle_package: "2x Moët + 1x Grey Goose", estimated_spend: 2800000, deposit_paid: 500000, special_notes: "Mesa cerca de la tarima. Cumpleaños de amiga."},
          {id: 2, customer_name: "Carolina Ospina", customer_vip_tier: "platinum", no_show_score: 3, venue_name: "Matildelina Bogotá", brand_name: "Matildelina", accent_color: "#D4A574", reservation_date: "2025-07-19", party_size: 6, type: "bottle_service", status: "confirmed", bottle_package: "1x Johnnie Walker Blue + 1x Veuve Clicquot", estimated_spend: 3200000, deposit_paid: 800000, special_notes: "Cliente platinum. Atención prioritaria."}
        ]);
        setLoading(false);
      }
    }
    fetchCRMData();
  }, [selectedBrand, search]);

  const formatCOP = (val) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(val);
  };

  const getVipBadge = (tier) => {
    const badges = {
      platinum: { class: 'badge-critical', label: 'Platinum VIP' },
      gold: { class: 'badge-warning', label: 'Gold' },
      silver: { class: 'badge-info', label: 'Silver' },
      regular: { class: 'badge-success', label: 'Regular' }
    };
    const b = badges[tier] || badges.regular;
    return <span className={`badge ${b.class}`}>{b.label}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-neon" style={{ fontSize: '2rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={28} /> CRM y Gestión de Clientes
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Base de datos unificada multi-marca, scoring de reservas VIP y prevención de no-shows
          </p>
        </div>
        
        <BrandSelector 
          brands={brands} 
          selectedBrand={selectedBrand} 
          onChange={setSelectedBrand} 
        />
      </div>

      {/* Split layout: Left customers directory, Right upcoming reservations */}
      <div className="np-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.3fr', gap: '1.5rem' }}>
        
        {/* Left: Customers directory with search bar */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.2rem' }}>Clientes Premium Consolidados</h3>
            
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <input 
                type="text"
                placeholder="Buscar cliente..."
                className="np-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '2rem', width: '200px' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '520px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando clientes...</div>
            ) : customers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No se encontraron clientes.</div>
            ) : (
              customers.map((c) => (
                <div key={c.id} style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: '700' }}>{c.full_name}</h4>
                    {getVipBadge(c.vip_tier)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    <span>Cel: {c.phone} · Insta: {c.instagram}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.3', marginBottom: '0.5rem', fontStyle: 'italic' }}>
                    "{c.notes || 'Sin anotaciones particulares.'}"
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.4rem', color: 'var(--text-secondary)' }}>
                    <span>Visitas Totales: <b>{c.total_visits}</b></span>
                    <span>Consumo Consolidado: <b style={{ color: 'var(--primary)' }}>{formatCOP(c.total_spend)}</b></span>
                    <span style={{ color: c.no_show_score > 20 ? 'var(--error)' : 'var(--success)' }}>
                      No-Show IA: <b>{c.no_show_score}%</b>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Reservations and VIP table booking list */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={20} /> Próximas Reservas VIP (Sábado 19 Julio)
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.4' }}>
            Auditoría de reservas de botellas y depósitos de garantía para asegurar asistencia.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '520px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando reservas...</div>
            ) : reservations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No hay reservas activas en esta fecha.</div>
            ) : (
              reservations.map((r) => (
                <div 
                  key={r.id}
                  style={{
                    padding: '1rem',
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid var(--border-glass)',
                    borderLeft: `4px solid ${r.accent_color}`,
                    borderRadius: '10px',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: '700' }}>{r.customer_name}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sede: <b>{r.venue_name}</b> · {r.party_size} personas</span>
                    </div>
                    {getVipBadge(r.customer_vip_tier)}
                  </div>
                  
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.8rem', margin: '0.5rem 0' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: '600', display: 'block' }}>Paquete Reservado:</span>
                    <span style={{ color: 'var(--text-primary)' }}>{r.bottle_package || 'Sin preventa de botella configurada'}</span>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.3', marginBottom: '0.5rem' }}>
                    <b>Nota:</b> {r.special_notes || 'Sin requerimientos especiales.'}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.5rem', color: 'var(--text-secondary)' }}>
                    <span>Consumo Estimado: <b style={{ color: 'var(--primary)' }}>{formatCOP(r.estimated_spend)}</b></span>
                    <span>Garantía Cobrada: <b style={{ color: 'var(--success)' }}>{formatCOP(r.deposit_paid)}</b></span>
                    <span style={{ 
                      color: r.no_show_score > 20 ? 'var(--error)' : 'var(--success)', 
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem'
                    }}>
                      {r.no_show_score > 20 && <ShieldAlert size={12} />}
                      No-Show: {r.no_show_score}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
