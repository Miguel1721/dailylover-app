import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import {
  LayoutDashboard, Users, Calendar, Upload, Heart,
  Wallet, Percent, TrendingUp, TrendingDown, Landmark,
  Shield, UserCheck, LogOut, Sun, Moon, Menu, X, Truck, Sparkles
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
import AuditoriaPsicologas from './pages/AuditoriaPsicologas'
import MatchingManual from './pages/MatchingManual'
import CmsEventos from './pages/CmsEventos'
import CmsCiudades from './pages/CmsCiudades'
import MisMatches from './pages/matchmaking/MisMatches'
import IntakeClientes from './pages/matchmaking/IntakeClientes'
import RefundsQueue from './pages/matchmaking/RefundsQueue'
import AprobadosMaria from './pages/matchmaking/AprobadosMaria'
import CitasAgendadas from './pages/matchmaking/CitasAgendadas'
import AprobacionesCruzadas from './pages/matchmaking/AprobacionesCruzadas'
import TodosLosMatches from './pages/matchmaking/TodosLosMatches'
import { Award, UserPlus, Globe, ShieldCheck, Headphones, Eye } from 'lucide-react'






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
  const { logout, user, config, hasPermission, previewRole, isOriginalAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleLinkClick = () => {
    if (onClose) onClose()
  }

  const effectiveRole = user?.role || ''
  const isMaria = effectiveRole === 'María' || (!previewRole && ((user?.email && (user.email.toLowerCase().includes('maria') || user.email.toLowerCase().includes('admin'))) || (user?.role && (user.role === 'Admin' || user.role === 'Super Admin' || user.role === 'SUPERADMIN' || user.role.toLowerCase().includes('admin')))))
  const isCs = effectiveRole === 'Servicio al Cliente'
  const isPsyc = effectiveRole === 'Psicóloga' || effectiveRole.toLowerCase().includes('psicolog') || effectiveRole.toLowerCase().includes('matchmaker')
  const isLina = effectiveRole === 'Lina (Refunds)'

  // Groups and items configuration
  const coreItems = [
    ...(!isLina ? [{ to: '/', icon: Heart, label: 'Panel Clínico (Psicólogas)', module: 'dashboard', action: 'view', end: true }] : []),
    ...(isMaria ? [{ to: '/general', icon: LayoutDashboard, label: 'Dashboard Financiero', module: 'dashboard', action: 'view' }] : []),
    ...(isMaria ? [{ to: '/auditoria-psicologas', icon: Award, label: 'Auditoría & Rendimiento', module: 'roles', action: 'view' }] : []),
    ...(!isLina ? [{ to: '/agenda', icon: Calendar, label: 'Mi Agenda de Entrevistas', module: 'clientes', action: 'view' }] : []),
    { to: '/clientes', icon: Users, label: 'Clientes', module: 'clientes', action: 'view' },
    ...(isMaria ? [{ to: '/proveedores', icon: Truck, label: 'Proveedores', module: 'proveedores', action: 'view' }] : []),
    ...(isMaria || isPsyc ? [{ to: '/importar', icon: Upload, label: 'Importar Excel', module: 'importar', action: 'view' }] : []),
  ]

  const matchmakingItems = [
    ...(isMaria ? [{ to: '/matchmaking/intake', icon: UserPlus, label: 'Intake Clientes (PROFILES)', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isPsyc ? [{ to: '/matchmaking/mis-matches', icon: Heart, label: isMaria ? 'Matches (Todas las Psicólogas)' : 'Mis Matches (Psicóloga)', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isCs ? [{ to: '/matchmaking/aprobados-maria', icon: Headphones, label: 'Aprobados por María (CS)', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isCs ? [{ to: '/matchmaking/citas-agendadas', icon: Calendar, label: 'Citas Agendadas (Calendario)', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isPsyc ? [{ to: '/matchmaking/aprobaciones-cruzadas', icon: ShieldCheck, label: 'Aprobaciones Cruzadas (A ↔ B)', module: 'matching', action: 'view' }] : []),
    { to: '/matchmaking/todos-los-matches', icon: Sparkles, label: 'Todos los Matches (Lookbook)', module: 'matching', action: 'view' },
    ...(isMaria || isLina ? [{ to: '/matchmaking/refunds', icon: Wallet, label: 'Cola de Refunds (Lina)', module: 'matching', action: 'view' }] : [])
  ]

  const cmsItems = [
    { to: '/cms/eventos', icon: Calendar, label: 'CMS Eventos', module: 'eventos', action: 'view' },
    { to: '/cms/ciudades', icon: Globe, label: 'CMS Ciudades', module: 'eventos', action: 'view' },
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

  const showMatchmaking = matchmakingItems.some(i => hasPermission(i.module, i.action))
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

        {showMatchmaking && renderNavGroup('Matchmaking Operativo', matchmakingItems)}
        {isMaria && renderNavGroup('CMS Visual (María Paula)', cmsItems)}
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
  const { token, user, isOriginalAdmin, previewRole, setPreviewRole } = useAuth()
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="mobile-menu-btn"
                      aria-label="Abrir Menú"
                      title="Abrir Menú"
                    >
                      <Menu size={18} />
                    </button>
                    <GlobalSearch />

                    {/* Selector 'Ver como' — visible EXCLUSIVAMENTE para la cuenta admin / de prueba */}
                    {isOriginalAdmin && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: previewRole ? 'rgba(150, 21, 0, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${previewRole ? 'var(--color-primary)' : 'var(--border-color)'}`,
                        borderRadius: 8,
                        padding: '4px 10px',
                        marginLeft: 12
                      }}>
                        <Eye size={14} style={{ color: previewRole ? 'var(--color-primary)' : 'var(--text-secondary)' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: previewRole ? 'var(--color-primary)' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Ver como:
                        </span>
                        <select
                          value={previewRole || 'Admin'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPreviewRole(val === 'Admin' ? null : val);
                          }}
                          style={{
                            background: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 6,
                            padding: '3px 8px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          <option value="Admin">Admin (Vista Completa)</option>
                          <option value="Psicóloga">Psicóloga</option>
                          <option value="María">María</option>
                          <option value="Servicio al Cliente">Servicio al Cliente</option>
                          <option value="Lina (Refunds)">Lina (Refunds)</option>
                        </select>
                        {previewRole && (
                          <button
                            onClick={() => setPreviewRole(null)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ff6b6b',
                              fontSize: 11,
                              cursor: 'pointer',
                              fontWeight: 700,
                              padding: '2px 4px'
                            }}
                            title="Restablecer vista a Admin"
                          >
                            ✕ Salir
                          </button>
                        )}
                      </div>
                    )}
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
                <main className="main-content" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minWidth: 0 }}>
                  <Routes>
                    <Route 
                      path="/" 
                      element={
                        <ProtectedRoute module="dashboard" action="view">
                          <MatchmakerDashboard />
                        </ProtectedRoute>
                      } 
                    />
                    <Route path="/general" element={<ProtectedRoute module="dashboard" action="view"><Dashboard /></ProtectedRoute>} />
                    <Route path="/clinico" element={<ProtectedRoute module="dashboard" action="view"><MatchmakerDashboard /></ProtectedRoute>} />
                    <Route path="/auditoria-psicologas" element={<ProtectedRoute module="roles" action="view"><AuditoriaPsicologas /></ProtectedRoute>} />
                    <Route path="/clientes" element={<ProtectedRoute module="clientes" action="view"><Clientes /></ProtectedRoute>} />

                    <Route path="/agenda" element={<ProtectedRoute module="clientes" action="view"><AgendaPsicologa /></ProtectedRoute>} />
                    <Route path="/eventos" element={<ProtectedRoute module="eventos" action="view"><Eventos /></ProtectedRoute>} />
                    <Route path="/cms/eventos" element={<ProtectedRoute module="eventos" action="view"><CmsEventos /></ProtectedRoute>} />
                    <Route path="/cms/ciudades" element={<ProtectedRoute module="eventos" action="view"><CmsCiudades /></ProtectedRoute>} />
                    <Route path="/importar" element={<ProtectedRoute module="importar" action="view"><Importar /></ProtectedRoute>} />
                    
                    {/* 4 Páginas Independientes de Matchmaking Operativo */}
                    <Route path="/matchmaking/mis-matches" element={<ProtectedRoute module="matching" action="view"><MisMatches /></ProtectedRoute>} />
                    <Route path="/matchmaking/aprobados-maria" element={<ProtectedRoute module="matching" action="view"><AprobadosMaria /></ProtectedRoute>} />
                    <Route path="/matchmaking/citas-agendadas" element={<ProtectedRoute module="matching" action="view"><CitasAgendadas /></ProtectedRoute>} />
                    <Route path="/matchmaking/aprobaciones-cruzadas" element={<ProtectedRoute module="matching" action="view"><AprobacionesCruzadas /></ProtectedRoute>} />
                    <Route path="/matchmaking/todos-los-matches" element={<ProtectedRoute module="matching" action="view"><TodosLosMatches /></ProtectedRoute>} />
                    
                    <Route path="/matchmaking/intake" element={<ProtectedRoute module="matching" action="view"><IntakeClientes /></ProtectedRoute>} />
                    <Route path="/matchmaking/refunds" element={<ProtectedRoute module="matching" action="view"><RefundsQueue /></ProtectedRoute>} />
                    <Route path="/matching-manual" element={<ProtectedRoute module="matching" action="view"><MatchingManual /></ProtectedRoute>} />

                    {/* Redirecciones de compatibilidad */}
                    <Route path="/matching" element={<Navigate to="/matchmaking/todos-los-matches" replace />} />
                    <Route path="/matchmaking/aprobacion" element={<Navigate to="/matchmaking/aprobados-maria" replace />} />
                    <Route path="/matchmaking/pendientes" element={<Navigate to="/matchmaking/aprobados-maria" replace />} />
                    <Route path="/matchmaking/calendario" element={<Navigate to="/matchmaking/citas-agendadas" replace />} />
                    
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
