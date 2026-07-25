import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import CashRegister from './pages/CashRegister';
import Staff from './pages/Staff';
import CRM from './pages/CRM';
import Analytics from './pages/Analytics';
import Compliance from './pages/Compliance';
import { Sparkles, Key, Mail, ShieldCheck } from 'lucide-react';
import axios from 'axios';

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@nightpulse.ai');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      onLogin(res.data.user);
    } catch (err) {
      console.error(err);
      // Demo fallback bypass
      if (email === 'admin@nightpulse.ai' && password === 'admin123') {
        const dummyUser = { email, full_name: 'Admin Demo', role: 'superadmin', brand_access: [1,2,3,4,5] };
        localStorage.setItem('token', 'dummy_token');
        localStorage.setItem('user', JSON.stringify(dummyUser));
        onLogin(dummyUser);
      } else {
        setError('Credenciales incorrectas. Prueba con admin@nightpulse.ai / admin123');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, #0d0d17 0%, #060609 100%)',
      padding: '1rem'
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem', border: '1px solid rgba(139, 92, 246, 0.2)', boxShadow: '0 0 40px rgba(139, 92, 246, 0.1)' }}>
        
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px var(--primary-glow)',
            marginBottom: '0.5rem'
          }}>
            <span style={{ fontWeight: '900', color: '#fff', fontSize: '1.8rem' }}>N</span>
          </div>
          <h2 className="text-neon" style={{ fontSize: '1.6rem', fontWeight: '800' }}>NightPulse <span style={{ color: 'var(--primary)' }}>AI</span></h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Inteligencia Operativa para Grupo Evedesa</span>
        </div>

        {error && (
          <div className="badge badge-error" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', textTransform: 'none', display: 'block', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Correo Electrónico</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="email" 
                className="np-input" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%', paddingLeft: '2.2rem' }}
              />
              <Mail size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="password" 
                className="np-input" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%', paddingLeft: '2.2rem' }}
              />
              <Key size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <button type="submit" className="np-btn" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Iniciando sesión...' : 'Ingresar a la Consola'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>Consola segura · Auditoría de Inteligencia Comercial</span>
        </div>

      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  if (!user && localStorage.getItem('token') === null) {
    return <Login onLogin={setUser} />;
  }

  return (
    <Router basename="/dashboard">
      <div className="app-container">
        <Sidebar />
        
        {/* Top Header Bar */}
        <header className="header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>En Línea</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Servidor Principal: 149.130.162.11</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>{user?.full_name || 'Admin Demo'}</span>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.role === 'superadmin' ? 'Socio Fundador' : 'Gerente General'}</span>
            </div>
            
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              color: '#fff',
              fontSize: '0.95rem'
            }}>
              {user?.full_name ? user.full_name.charAt(0) : 'A'}
            </div>
          </div>
        </header>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/cash-register" element={<CashRegister />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/crm" element={<CRM />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
