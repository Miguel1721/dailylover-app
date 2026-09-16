import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import {
  LayoutDashboard, Users, Calendar, Upload, Heart,
  Wallet, Percent, TrendingUp, TrendingDown, Landmark,
  Shield, UserCheck, LogOut, Sun, Moon, Menu, X, Truck, Sparkles, Settings
} from 'lucide-react'

import CopilotWidget from './components/CopilotWidget'

import { AuthProvider, useAuth, ADMIN_EMAILS, ADMIN_ROLES } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'

import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Eventos from './pages/Eventos'
import Importar from './pages/Importar'
import Employees from './pages/Employees'
import Commissions from './pages/Commissions'
import Payroll from './pages/Payroll'
import Income from './pages/Income'
import Expenses from './pages/Expenses'
import CashFlow from './pages/CashFlow'
import Roles from './pages/Roles'
import UserAccounts from './pages/UserAccounts'
import ConfiguracionFormularios from './pages/ConfiguracionFormularios'
import Login from './pages/Login'
import Proveedores from './pages/Proveedores'

import MatchmakerDashboard from './pages/MatchmakerDashboard'
import AgendaPsicologa from './pages/AgendaPsicologa'
import EvaluacionCita from './pages/EvaluacionCita'
import AuditoriaPsicologas from './pages/AuditoriaPsicologas'
import CmsEventos from './pages/CmsEventos'
import CmsCiudades from './pages/CmsCiudades'
import MisMatches from './pages/matchmaking/MisMatches'
import IntakeClientes from './pages/matchmaking/IntakeClientes'
import RefundsQueue from './pages/matchmaking/RefundsQueue'
import AprobadosMaria from './pages/matchmaking/AprobadosMaria'
import CitasAgendadas from './pages/matchmaking/CitasAgendadas'
import AprobacionesCruzadas from './pages/matchmaking/AprobacionesCruzadas'
import TodosLosMatches from './pages/matchmaking/TodosLosMatches'
import DatosObjetivos from './pages/matchmaking/DatosObjetivos'
import PercepcionPsicologa from './pages/matchmaking/PercepcionPsicologa'
import EntrevistaHub from './pages/matchmaking/EntrevistaHub'
import SupervisionMaria from './pages/matchmaking/SupervisionMaria'
import Prioritarios from './pages/matchmaking/Prioritarios'
import CalendarioTurnos7shifts from './pages/matchmaking/CalendarioTurnos7shifts'
import AgendadorCalendly from './pages/public/AgendadorCalendly'
import SalaVideollamada from './pages/matchmaking/SalaVideollamada'
import MatchesAtrasados from './pages/matchmaking/MatchesAtrasados'
import { Award, UserPlus, Globe, ShieldCheck, Headphones, Eye, Brain, ClipboardList, Lock, Flame } from 'lucide-react'






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
  const isAtrasadosOnly = effectiveRole === 'atrasados_only' || user?.role === 'atrasados_only'
  const isMaria = !isAtrasadosOnly && (
    effectiveRole === 'María' ||
    (!previewRole && (
      (user?.email && ADMIN_EMAILS.includes(user.email.trim().toLowerCase())) ||
      (user?.role && ADMIN_ROLES.includes(user.role))
    ))
  )
  const isCs = !isAtrasadosOnly && effectiveRole === 'Servicio al Cliente'
  const isPsyc = !isAtrasadosOnly && (effectiveRole === 'Psicóloga' || effectiveRole.toLowerCase().includes('psicolog') || effectiveRole.toLowerCase().includes('matchmaker'))
  const isLina = !isAtrasadosOnly && effectiveRole === 'Lina (Refunds)'

  const homePath = isAtrasadosOnly ? '/matchmaking/cola-atrasados' : isCs ? '/matchmaking/aprobados-maria' : isLina ? '/matchmaking/refunds' : '/'

  // Navegación exclusiva para usuario de Atrasados (Zero ruido)
  const atrasadosNavItems = [
    { to: '/matchmaking/cola-atrasados', icon: Sparkles, label: '🎙️ Cola de Atrasados' },
    { to: '/matchmaking/matches-atrasados', icon: Calendar, label: '📅 Matches Atrasados' }
  ]

  // Groups and items configuration — Zero noise per role
  const coreItems = [
    ...(isPsyc || isMaria ? [{ to: '/', icon: Heart, label: isMaria ? 'Panel Clínico (Psicólogas)' : 'Mi Panel Clínico', module: 'dashboard', action: 'view', end: true }] : []),
    ...(isMaria ? [{ to: '/general', icon: LayoutDashboard, label: 'Dashboard Financiero', module: 'dashboard', action: 'view' }] : []),
    ...(isMaria ? [{ to: '/auditoria-psicologas', icon: Award, label: 'Auditoría & Rendimiento', module: 'roles', action: 'view' }] : []),
    ...(!isLina ? [{ to: '/clientes', icon: Users, label: 'Clientes', module: 'clientes', action: 'view' }] : []),
    ...(isMaria ? [{ to: '/proveedores', icon: Truck, label: 'Proveedores', module: 'proveedores', action: 'view' }] : []),
    ...(isMaria ? [{ to: '/importar', icon: Upload, label: 'Importar Excel', module: 'importar', action: 'view' }] : []),
  ]

  const matchmakingItems = [
    ...(isMaria ? [{ to: '/matchmaking/supervision-maria', icon: Lock, label: '🔒 Supervisión María', module: 'matching', action: 'view' }] : []),
    ...(isMaria ? [{ to: '/matchmaking/intake', icon: UserPlus, label: 'Intake Clientes (PROFILES)', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isCs || isPsyc ? [{ to: '/matchmaking/prioritarios', icon: Flame, label: '🔥 Prioritarios (15+ días)', module: 'matching', action: 'view' }] : []),
    ...(isPsyc || isMaria ? [{ to: '/matchmaking/calendario', icon: Calendar, label: isMaria ? '📅 Calendario & Turnos' : '📅 Mi Calendario de Turnos', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isPsyc ? [{ to: '/matchmaking/datos-objetivos', icon: ClipboardList, label: '📋 Datos Objetivos', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isPsyc ? [{ to: '/matchmaking/percepcion-psicologa', icon: Brain, label: '🧠 Percepción Psicóloga', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isPsyc ? [{ to: '/matchmaking/entrevista', icon: Sparkles, label: '🎙️ Entrevista Clínica', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isCs || isPsyc ? [{ to: '/matchmaking/aprobados-maria', icon: ShieldCheck, label: isCs ? 'Citas por Agendar' : 'Aprobados por María', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isPsyc ? [{ to: '/matchmaking/mis-matches', icon: Heart, label: isMaria ? 'MATCHES (Todas las Psicólogas)' : 'MATCHES', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isCs ? [{ to: '/matchmaking/citas-agendadas', icon: Calendar, label: 'Citas Aceptadas', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isLina ? [{ to: '/matchmaking/refunds', icon: Wallet, label: 'Cola de Refunds (Lina)', module: 'matching', action: 'view' }] : [])
  ]

  const cmsItems = isMaria ? [
    { to: '/cms/eventos', icon: Calendar, label: 'CMS Eventos', module: 'eventos', action: 'view' },
    { to: '/cms/ciudades', icon: Globe, label: 'CMS Ciudades', module: 'eventos', action: 'view' },
  ] : []

  const personalItems = isMaria ? [
    { to: '/empleados', icon: Users, label: 'Empleados', module: 'empleados', action: 'view' },
    { to: '/nomina', icon: Wallet, label: 'Nómina', module: 'nomina', action: 'view' },
    { to: '/comisiones', icon: Percent, label: 'Comisiones', module: 'comisiones', action: 'view' },
  ] : []

  const financeItems = [
    ...(isMaria ? [{ to: '/ingresos', icon: TrendingUp, label: 'Ingresos', module: 'ingresos', action: 'view' }] : []),
    ...(isMaria ? [{ to: '/gastos', icon: TrendingDown, label: 'Gastos', module: 'gastos', action: 'view' }] : []),
    ...(isMaria || isLina ? [{ to: '/flujo-de-caja', icon: Landmark, label: 'Flujo de caja', module: 'flujo_caja', action: 'view' }] : []),
  ]

  const systemItems = isMaria ? [
    { to: '/roles', icon: Shield, label: 'Roles de Sistema', module: 'roles', action: 'view' },
    { to: '/usuarios', icon: UserCheck, label: 'Cuentas de Acceso', module: 'usuarios', action: 'view' },
    { to: '/configuracion/formularios', icon: Settings, label: '⚙️ Configurar Formularios', module: 'roles', action: 'view' },
  ] : []

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
    <aside className={`sidebar ${isOpen ? 'open' : 'collapsed'}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <NavLink to={homePath} onClick={handleLinkClick} style={{ textDecoration: 'none' }}>
          <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: 18 }}>Daily Lover</span>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Panel Admin</div>
        </NavLink>
        <button 
          onClick={onClose} 
          className="sidebar-close-btn" 
          style={{ border: 'none', marginRight: 0 }}
          title="Cerrar barra lateral"
        >
          <X size={18} />
        </button>
      </div>
      
      <nav className="sidebar-nav" style={{ flex: 1, overflowY: 'auto' }}>
        {isAtrasadosOnly ? (
          <div style={{ marginTop: 16 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-muted)',
              padding: '0 12px 6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Gestión de Atrasados
            </div>
            {atrasadosNavItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                onClick={handleLinkClick}
              >
                <Icon className="nav-icon" size={16} />
                {label}
              </NavLink>
            ))}
          </div>
        ) : (
          <>
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
          </>
        )}
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

function HomeRoute() {
  const { user } = useAuth()
  const effectiveRole = user?.role || ''
  if (effectiveRole === 'atrasados_only') {
    return <Navigate to="/matchmaking/cola-atrasados" replace />
  }
  if (effectiveRole === 'Servicio al Cliente') {
    return <Navigate to="/matchmaking/aprobados-maria" replace />
  }
  if (effectiveRole === 'Lina (Refunds)') {
    return <Navigate to="/matchmaking/refunds" replace />
  }
  return (
    <ProtectedRoute module="dashboard" action="view">
      <MatchmakerDashboard />
    </ProtectedRoute>
  )
}

function AppContent() {
  const { token, user, isOriginalAdmin, previewRole, setPreviewRole, loading } = useAuth()
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark')
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar_open')
      if (saved !== null) return saved === 'true'
      return window.innerWidth > 1024
    }
    return true
  })

  useEffect(() => {
    localStorage.setItem('sidebar_open', String(sidebarOpen))
  }, [sidebarOpen])

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

  if (loading && token) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-base)',
        color: 'var(--text-secondary)',
        gap: 16
      }}>
        <div className="spinner" />
        <span style={{ fontSize: 13, letterSpacing: '0.02em' }}>Verificando sesión...</span>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/evaluacion-cita" element={<EvaluacionCita />} />
      <Route path="/agendar/:psicologaSlug" element={<AgendadorCalendly />} />
      <Route path="/agendar" element={<AgendadorCalendly />} />
      <Route path="/reservar" element={<AgendadorCalendly />} />
      <Route path="/sala/:sessionId" element={<SalaVideollamada />} />
      <Route
        path="/*"
        element={
          token ? (
            <div className="app">
              <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
              {sidebarOpen && (
                <div 
                  className="sidebar-overlay-backdrop show" 
                  onClick={() => setSidebarOpen(false)} 
                />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100vh', overflow: 'hidden' }}>
                <header style={{
                  height: 56,
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 24px',
                  background: 'var(--bg-sidebar)',
                  flexShrink: 0
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      onClick={() => setSidebarOpen(prev => !prev)}
                      className="sidebar-toggle-btn"
                      aria-label={sidebarOpen ? "Ocultar menú lateral" : "Mostrar menú lateral"}
                      title={sidebarOpen ? "Ocultar menú lateral" : "Mostrar menú lateral"}
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
                    <Route path="/" element={<HomeRoute />} />
                    <Route path="/general" element={<ProtectedRoute module="dashboard" action="view"><Dashboard /></ProtectedRoute>} />
                    <Route path="/clinico" element={<ProtectedRoute module="dashboard" action="view"><MatchmakerDashboard /></ProtectedRoute>} />
                    <Route path="/auditoria-psicologas" element={<ProtectedRoute module="roles" action="view"><AuditoriaPsicologas /></ProtectedRoute>} />
                    <Route path="/clientes" element={<ProtectedRoute module="clientes" action="view"><Clientes /></ProtectedRoute>} />

                    <Route path="/agenda" element={<ProtectedRoute module="matching" action="view"><CalendarioTurnos7shifts /></ProtectedRoute>} />
                    <Route path="/matchmaking/calendario" element={<ProtectedRoute module="matching" action="view"><CalendarioTurnos7shifts /></ProtectedRoute>} />
                    <Route path="/matchmaking/sala/:sessionId" element={<ProtectedRoute module="matching" action="view"><SalaVideollamada /></ProtectedRoute>} />
                    <Route path="/eventos" element={<ProtectedRoute module="eventos" action="view"><Eventos /></ProtectedRoute>} />
                    <Route path="/cms/eventos" element={<ProtectedRoute module="eventos" action="view"><CmsEventos /></ProtectedRoute>} />
                    <Route path="/cms/ciudades" element={<ProtectedRoute module="eventos" action="view"><CmsCiudades /></ProtectedRoute>} />
                    <Route path="/importar" element={<ProtectedRoute module="importar" action="view"><Importar /></ProtectedRoute>} />
                    
                    {/* Formularios Nuevos & Entrevista Clínica */}
                    <Route path="/matchmaking/datos-objetivos" element={<ProtectedRoute module="matching" action="view"><DatosObjetivos /></ProtectedRoute>} />
                    <Route path="/matchmaking/percepcion-psicologa" element={<ProtectedRoute module="matching" action="view"><PercepcionPsicologa /></ProtectedRoute>} />
                    <Route path="/matchmaking/entrevista" element={<ProtectedRoute module="matching" action="view"><EntrevistaHub /></ProtectedRoute>} />
                    <Route path="/matchmaking/cola-atrasados" element={<ProtectedRoute module="matching" action="view"><EntrevistaHub initialTab="cola_atrasados" /></ProtectedRoute>} />
                    <Route path="/matchmaking/matches-atrasados" element={<ProtectedRoute module="matching" action="view"><MatchesAtrasados /></ProtectedRoute>} />
                    <Route path="/cola-atrasados" element={<Navigate to="/matchmaking/cola-atrasados" replace />} />
                    <Route path="/matches-atrasados" element={<Navigate to="/matchmaking/matches-atrasados" replace />} />
                    <Route path="/entrevista" element={<Navigate to="/matchmaking/entrevista" replace />} />
                    <Route path="/datos-objetivos" element={<Navigate to="/matchmaking/datos-objetivos" replace />} />
                    <Route path="/percepcion-psicologa" element={<Navigate to="/matchmaking/percepcion-psicologa" replace />} />

                    {/* 4 Páginas Independientes de Matchmaking Operativo */}
                    <Route path="/matchmaking/mis-matches" element={<ProtectedRoute module="matching" action="view"><MisMatches /></ProtectedRoute>} />
                    <Route path="/matchmaking/aprobados-maria" element={<ProtectedRoute module="matching" action="view"><AprobadosMaria /></ProtectedRoute>} />
                    <Route path="/matchmaking/citas-agendadas" element={<ProtectedRoute module="matching" action="view"><CitasAgendadas /></ProtectedRoute>} />
                    <Route path="/matchmaking/aprobaciones-cruzadas" element={<ProtectedRoute module="matching" action="view"><AprobacionesCruzadas /></ProtectedRoute>} />
                    <Route path="/matchmaking/todos-los-matches" element={<ProtectedRoute module="matching" action="view"><TodosLosMatches /></ProtectedRoute>} />
                    
                    <Route path="/matchmaking/intake" element={<ProtectedRoute module="matching" action="view"><IntakeClientes /></ProtectedRoute>} />
                    <Route path="/matchmaking/prioritarios" element={<ProtectedRoute module="matching" action="view"><Prioritarios /></ProtectedRoute>} />
                    <Route path="/matchmaking/refunds" element={<ProtectedRoute module="matching" action="view"><RefundsQueue /></ProtectedRoute>} />
                    <Route path="/matchmaking/supervision-maria" element={<ProtectedRoute module="matching" action="view"><SupervisionMaria /></ProtectedRoute>} />

                    {/* Redirecciones de compatibilidad */}
                    <Route path="/prioritarios" element={<Navigate to="/matchmaking/prioritarios" replace />} />
                    <Route path="/corazoncito" element={<Navigate to="/matchmaking/prioritarios" replace />} />
                    <Route path="/supervision-maria" element={<Navigate to="/matchmaking/supervision-maria" replace />} />
                    <Route path="/supervision" element={<Navigate to="/matchmaking/supervision-maria" replace />} />
                    <Route path="/matching-manual" element={<Navigate to="/matchmaking/mis-matches" replace />} />
                    <Route path="/matching" element={<Navigate to="/matchmaking/todos-los-matches" replace />} />
                    <Route path="/matchmaking/aprobacion" element={<Navigate to="/matchmaking/aprobados-maria" replace />} />
                    <Route path="/matchmaking/pendientes" element={<Navigate to="/matchmaking/aprobados-maria" replace />} />
                    
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
                    <Route path="/configuracion/formularios" element={<ProtectedRoute module="roles" action="view"><ConfiguracionFormularios /></ProtectedRoute>} />
                    <Route path="/admin/configuracion/formularios" element={<Navigate to="/configuracion/formularios" replace />} />

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
