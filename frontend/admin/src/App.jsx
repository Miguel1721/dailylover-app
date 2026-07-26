import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import {
  LayoutDashboard, Users, Calendar, Upload, Heart,
  Wallet, Percent, TrendingUp, TrendingDown, Landmark,
  Shield, UserCheck, LogOut, Sun, Moon, Menu, X, Truck
} from 'lucide-react'
import CopilotWidget from './components/CopilotWidget'

import { AuthProvider, useAuth } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'

import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Eventos from './pages/Eventos'
import Importar from './pages/Importar'
import Matching from './pages/Matching'
import Employees from './pages/Employees'
import Commissions from './pages/Commissions'
import Payroll from './pages/Payroll'
import Income from './pages/Income'
import Expenses from './pages/Expenses'
import CashFlow from './pages/CashFlow'
import Roles from './pages/Roles'
import UserAccounts from './pages/UserAccounts'
import Login from './pages/Login'
import Proveedores from './pages/Proveedores'

import MatchmakerDashboard from './pages/MatchmakerDashboard'
import AgendaPsicologa from './pages/AgendaPsicologa'
import EvaluacionCita from './pages/EvaluacionCita'




import './index.css'

function GlobalSearch() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query.trim()) {
      setResults(null)
      return
    }
    const delayDebounce = setTimeout(() => {
      setLoading(true)
      fetch(`https://prueba-daily.agentesia.cloud/api/v1/admin/global-search?query=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          setResults(data)
          setLoading(false)
        })
        .catch(() => {
          setResults(null)
          setLoading(false)
        })
    }, 300)

    return () => clearTimeout(delayDebounce)
  }, [query, token])

  const handleSelect = (type, item) => {
    setQuery('')
    setResults(null)
    if (type === 'client') {
      navigate(`/clientes?q=${encodeURIComponent(item.name)}`)
      window.dispatchEvent(new Event('popstate'))
    } else if (type === 'event') {
      navigate(`/eventos`)
    } else if (type === 'employee') {
      navigate(`/empleados`)
    }
  }

  return (
    <div style={{ position: 'relative', width: 320 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={15} style={{ position: 'absolute', left: 12, color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Buscar clientes, eventos o personal..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          style={{
            width: '100%',
            padding: '8px 12px 8px 36px',
            background: 'var(--bg-base)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          className="global-search-input"
        />
      </div>

      {focused && (query || results) && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 8,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          zIndex: 100,
          maxHeight: 400,
          overflowY: 'auto',
          padding: 8
        }}>
          {loading && <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>Buscando...</div>}
          
          {!loading && results && (
            <div>
              {results.clients?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', padding: '4px 8px', letterSpacing: '0.05em' }}>Clientes</div>
                  {results.clients.map(c => (
                    <div
                      key={c.id}
                      onClick={() => handleSelect('client', c)}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 6, fontSize: 13 }}
                      className="search-result-item"
                    >
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.phone} | {c.motivacion}</div>
                    </div>
                  ))}
                </div>
              )}

              {results.events?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', padding: '4px 8px', letterSpacing: '0.05em' }}>Eventos</div>
                  {results.events.map(ev => (
                    <div
                      key={ev.id}
                      onClick={() => handleSelect('event', ev)}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 6, fontSize: 13 }}
                      className="search-result-item"
                    >
                      <div style={{ fontWeight: 600 }}>{ev.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ev.location} | {ev.format}</div>
                    </div>
                  ))}
                </div>
              )}

              {results.employees?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', padding: '4px 8px', letterSpacing: '0.05em' }}>Personal</div>
                  {results.employees.map(emp => (
                    <div
                      key={emp.id}
                      onClick={() => handleSelect('employee', emp)}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 6, fontSize: 13 }}
                      className="search-result-item"
                    >
                      <div style={{ fontWeight: 600 }}>{emp.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.role}</div>
                    </div>
                  ))}
                </div>
              )}

              {results.clients?.length === 0 && results.events?.length === 0 && results.employees?.length === 0 && (
                <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>No se encontraron resultados</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Sidebar({ isOpen, onClose }) {
  const { logout, user, config, hasPermission } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleLinkClick = () => {
    if (onClose) onClose()
  }

  const isAdmin = user?.role && (
    user.role === 'Admin' || 
    user.role === 'Super Admin' || 
    user.role.toLowerCase().includes('admin') || 
    user.role.toLowerCase().includes('director')
  )

  // Groups and items configuration
  const coreItems = [
    { to: '/', icon: Heart, label: 'Panel Clínico (Psicólogas)', module: 'dashboard', action: 'view', end: true },
    ...(isAdmin ? [{ to: '/general', icon: LayoutDashboard, label: 'Dashboard Financiero', module: 'dashboard', action: 'view' }] : []),
    { to: '/agenda', icon: Calendar, label: 'Mi Agenda de Entrevistas', module: 'clientes', action: 'view' },
    { to: '/clientes', icon: Users, label: 'Clientes', module: 'clientes', action: 'view' },
    { to: '/eventos', icon: Calendar, label: 'Eventos', module: 'eventos', action: 'view' },
    ...(isAdmin ? [{ to: '/proveedores', icon: Truck, label: 'Proveedores', module: 'proveedores', action: 'view' }] : []),
    { to: '/importar', icon: Upload, label: 'Importar Excel', module: 'importar', action: 'view' },
    { to: '/matching', icon: Heart, label: 'Matching', module: 'matching', action: 'view' },
  ]


  const personalItems = [
    { to: '/empleados', icon: Users, label: 'Empleados', module: 'empleados', action: 'view' },
    { to: '/nomina', icon: Wallet, label: 'Nómina', module: 'nomina', action: 'view' },
    { to: '/comisiones', icon: Percent, label: 'Comisiones', module: 'comisiones', action: 'view' },
  ]

  const financeItems = [
    { to: '/ingresos', icon: TrendingUp, label: 'Ingresos', module: 'ingresos', action: 'view' },
    { to: '/gastos', icon: TrendingDown, label: 'Gastos', module: 'gastos', action: 'view' },
    { to: '/flujo-de-caja', icon: Landmark, label: 'Flujo de caja', module: 'flujo_caja', action: 'view' },
  ]

  const systemItems = [
    { to: '/roles', icon: Shield, label: 'Roles de Sistema', module: 'roles', action: 'view' },
    { to: '/usuarios', icon: UserCheck, label: 'Cuentas de Acceso', module: 'usuarios', action: 'view' },
  ]

  const showPersonal = personalItems.some(i => hasPermission(i.module, i.action))
  const showFinance = financeItems.some(i => hasPermission(i.module, i.action))
  const showSystem = systemItems.some(i => hasPermission(i.module, i.action))

  const renderNavGroup = (title, items) => {
    const visibleItems = items.filter(i => hasPermission(i.module, i.action))
    if (visibleItems.length === 0) return null

    return (
      <div style={{ marginTop: 16 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-muted)',
          padding: '0 12px 6px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          {title}
        </div>
        {visibleItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={handleLinkClick}
          >
            <Icon className="nav-icon" size={16} />
            {label}
          </NavLink>
        ))}
      </div>
    )
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: 18 }}>Daily Lover</span>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Panel Admin</div>
        </div>
        <button 
          onClick={onClose} 
          className="mobile-menu-btn" 
          style={{ border: 'none', marginRight: 0, width: 28, height: 28 }}
          title="Cerrar Menú"
        >
          <X size={18} />
        </button>
      </div>
      
      <nav className="sidebar-nav" style={{ flex: 1, overflowY: 'auto' }}>
        {coreItems.filter(i => hasPermission(i.module, i.action)).map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={handleLinkClick}
          >
            <Icon className="nav-icon" size={16} />
            {label}
          </NavLink>
        ))}

        {showPersonal && renderNavGroup('Personal', personalItems)}
        {showFinance && renderNavGroup('Finanzas', financeItems)}
        {showSystem && renderNavGroup('Sistema', systemItems)}
      </nav>

      {/* Footer & Demo Mode Indicator */}
      <div style={{
        marginTop: 'auto',
        padding: '16px 20px',
        borderTop: '1px solid var(--border-color)',
        fontSize: 12,
        color: 'var(--text-muted)'
      }}>
        {config.demo_mode && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 10,
            fontSize: 11,
            color: 'var(--text-secondary)'
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ff6b6b', display: 'inline-block' }} />
            <span>Modo Demo Activo</span>
          </div>
        )}
        
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{user.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{user.role}</div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Cerrar Sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

function AppContent() {
  const { token, user } = useAuth()
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode')
    } else {
      document.body.classList.remove('light-mode')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/evaluacion-cita" element={<EvaluacionCita />} />
      <Route
        path="/*"
        element={
          token ? (
            <div className="app">
              <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
              <div 
                className={`sidebar-overlay-backdrop ${sidebarOpen ? 'show' : ''}`} 
                onClick={() => setSidebarOpen(false)} 
              />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100vh', overflow: 'hidden' }}>
                <header style={{
                  height: 56,
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 32px',
                  background: 'var(--bg-sidebar)',
                  flexShrink: 0
                }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="mobile-menu-btn"
                      aria-label="Abrir Menú"
                      title="Abrir Menú"
                    >
                      <Menu size={18} />
                    </button>
                    <GlobalSearch />
                  </div>
                  <button
                    onClick={toggleTheme}
                    aria-label={theme === 'light' ? "Modo Oscuro" : "Modo Claro"}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      width: 36,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    title={theme === 'light' ? "Modo Oscuro" : "Modo Claro"}
                  >
                    {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                  </button>
                </header>
                <main className="main-content" style={{ flex: 1, overflowY: 'auto' }}>
                  <Routes>
                    <Route 
                      path="/" 
                      element={
                        <ProtectedRoute module="dashboard" action="view">
                          {user?.role && (user.role.toLowerCase().includes('matchmaker') || user.role.toLowerCase().includes('psicolog')) 
                            ? <MatchmakerDashboard /> 
                            : <MatchmakerDashboard />}
                        </ProtectedRoute>
                      } 
                    />
                    <Route path="/general" element={<ProtectedRoute module="dashboard" action="view"><Dashboard /></ProtectedRoute>} />
                    <Route path="/clinico" element={<ProtectedRoute module="dashboard" action="view"><MatchmakerDashboard /></ProtectedRoute>} />
                    <Route path="/clientes" element={<ProtectedRoute module="clientes" action="view"><Clientes /></ProtectedRoute>} />
                    <Route path="/agenda" element={<ProtectedRoute module="clientes" action="view"><AgendaPsicologa /></ProtectedRoute>} />
                    <Route path="/eventos" element={<ProtectedRoute module="eventos" action="view"><Eventos /></ProtectedRoute>} />
                    <Route path="/importar" element={<ProtectedRoute module="importar" action="view"><Importar /></ProtectedRoute>} />
                    <Route path="/matching" element={<ProtectedRoute module="matching" action="view"><Matching /></ProtectedRoute>} />
                    
                    {/* Personal */}
                    <Route path="/empleados" element={<ProtectedRoute module="empleados" action="view"><Employees /></ProtectedRoute>} />
                    <Route path="/nomina" element={<ProtectedRoute module="nomina" action="view"><Payroll /></ProtectedRoute>} />
                    <Route path="/comisiones" element={<ProtectedRoute module="comisiones" action="view"><Commissions /></ProtectedRoute>} />

                    {/* Finanzas */}
                    <Route path="/ingresos" element={<ProtectedRoute module="ingresos" action="view"><Income /></ProtectedRoute>} />
                    <Route path="/gastos" element={<ProtectedRoute module="gastos" action="view"><Expenses /></ProtectedRoute>} />
                    <Route path="/flujo-de-caja" element={<ProtectedRoute module="flujo_caja" action="view"><CashFlow /></ProtectedRoute>} />

                    {/* Proveedores */}
                    <Route path="/proveedores" element={<ProtectedRoute module="proveedores" action="view"><Proveedores /></ProtectedRoute>} />

                    {/* Sistema */}
                    <Route path="/roles" element={<ProtectedRoute module="roles" action="view"><Roles /></ProtectedRoute>} />
                    <Route path="/usuarios" element={<ProtectedRoute module="usuarios" action="view"><UserAccounts /></ProtectedRoute>} />

                    <Route path="*" element={<Dashboard />} />
                  </Routes>
                </main>
              </div>
              <CopilotWidget />
            </div>
          ) : (
            <Login />
          )
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/admin">
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
