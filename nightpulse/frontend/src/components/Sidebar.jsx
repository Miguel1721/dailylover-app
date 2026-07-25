import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Wine, 
  Wallet, 
  Users, 
  BarChart3, 
  ShieldAlert, 
  Award,
  LogOut
} from 'lucide-react';

export default function Sidebar() {
  const menuItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/inventory', label: 'Inventario', icon: Wine },
    { path: '/cash-register', label: 'Cierre de Caja', icon: Wallet },
    { path: '/staff', label: 'Personal', icon: Users },
    { path: '/crm', label: 'CRM / Reservas', icon: Award },
    { path: '/analytics', label: 'Analytics & IA', icon: BarChart3 },
    { path: '/compliance', label: 'Compliance', icon: ShieldAlert },
  ];

  return (
    <aside className="sidebar">
      <div className="logo-container">
        <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px var(--primary-glow)'
          }}>
            <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '1.2rem' }}>N</span>
          </div>
          <span className="logo-text" style={{ fontSize: '1.25rem', fontWeight: '800', background: 'linear-gradient(90deg, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            NightPulse<span style={{ color: 'var(--primary)' }}>AI</span>
          </span>
        </div>
      </div>

      <nav style={{ flex: 1 }}>
        <ul className="nav-links">
          {menuItems.map((item) => (
            <li key={item.path} className="nav-item">
              <NavLink 
                to={item.path} 
                className={({ isActive }) => isActive ? 'active-link' : ''}
                style={({ isActive }) => isActive ? {
                  background: 'rgba(139, 92, 246, 0.1)',
                  borderLeft: '3px solid var(--primary)',
                  boxShadow: 'inset 5px 0 10px rgba(139, 92, 246, 0.05)',
                  color: 'var(--text-primary)'
                } : {}}
              >
                <item.icon size={20} />
                <span className="sidebar-text">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div style={{ padding: '1rem', borderTop: '1px solid var(--border-glass)' }}>
        <a 
          href="#"
          onClick={() => {
            localStorage.removeItem('token');
            window.location.reload();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.8rem 1rem',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
        >
          <LogOut size={18} />
          <span className="sidebar-text">Cerrar Sesión</span>
        </a>
      </div>
    </aside>
  );
}
