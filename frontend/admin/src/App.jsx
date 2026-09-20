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
import ConfiguracionAlertas from './pages/ConfiguracionAlertas'
import ManualesCapacitacion from './pages/ManualesCapacitacion'
import ControlHorasPsicologas from './pages/ControlHorasPsicologas'
import Login from './pages/Login'
import Proveedores from './pages/Proveedores'

import MatchmakerDashboard from './pages/MatchmakerDashboard'
import CustomerServiceDashboard from './pages/CustomerServiceDashboard'
import ClientePortalDashboard from './pages/ClientePortalDashboard'
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
import TroubleMatches from './pages/matchmaking/TroubleMatches'
import { Award, UserPlus, Globe, ShieldCheck, Headphones, Eye, Brain, ClipboardList, Lock, Flame, FileSpreadsheet, AlertTriangle, BellRing, BookOpen, Clock } from 'lucide-react'
import ForcePasswordChangeModal from './components/ForcePasswordChangeModal'
import CsNovedadesNotificationBell from './components/CsNovedadesNotificationBell'
import WorkTimerWidget from './components/WorkTimerWidget'
import AreaErrorBoundary from './components/AreaErrorBoundary'
import { NotificationProvider } from './context/NotificationContext'
import NotificationToastContainer from './components/NotificationToastContainer'

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
      fetch(`/api/v1/admin/global-search?query=${encodeURIComponent(query)}`, {
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
    <div className="global-search-wrapper" style={{ position: 'relative', flex: 1, minWidth: 60, maxWidth: 300 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Buscar clientes, eventos o personal..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 12px 8px 32px',
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
  const { logout, user, config, hasPermission, previewRole, setPreviewRole, isOriginalAdmin } = useAuth()
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
  const isCliente = effectiveRole === 'Cliente'
  const isCs = !isAtrasadosOnly && !isCliente && (
    effectiveRole === 'Servicio al Cliente' ||
    effectiveRole === 'Customer Service' ||
    effectiveRole.toLowerCase().includes('customer') ||
    effectiveRole.toLowerCase().includes('servicio')
  )
  const isPsyc = !isAtrasadosOnly && !isCliente && !isCs && (
    effectiveRole === 'Psicóloga' ||
    effectiveRole.toLowerCase().includes('psicolog') ||
    effectiveRole.toLowerCase().includes('matchmaker')
  )
  const isLina = !isAtrasadosOnly && !isCliente && effectiveRole === 'Lina (Refunds)'
  const isMaria = !isAtrasadosOnly && !isCliente && !isCs && (
    effectiveRole === 'María' ||
    effectiveRole === 'Admin' ||
    effectiveRole === 'Super Admin' ||
    (!previewRole && (
      (user?.email && ADMIN_EMAILS.includes(user.email.trim().toLowerCase())) ||
      (user?.role && ADMIN_ROLES.includes(user.role))
    ))
  )

  const homePath = isAtrasadosOnly ? '/matchmaking/cola-atrasados' : isCliente ? '/portal-cliente' : isCs ? '/cs-dashboard' : isPsyc ? '/psicologa' : '/'

  // Navegación exclusiva para usuario de Atrasados
  const atrasadosNavItems = [
    { to: '/matchmaking/cola-atrasados', icon: Sparkles, label: '🎙️ Cola de Atrasados' },
    { to: '/matchmaking/matches-atrasados', icon: Calendar, label: '📅 Matches Atrasados' }
  ]

  // Navegación exclusiva para Cliente
  const clienteNavItems = [
    { to: '/portal-cliente', icon: Heart, label: '💖 Mi Próxima Cita' },
    { to: '/evaluacion-cita', icon: Sparkles, label: '⭐ Evaluación de Cita' }
  ]

  // Navegación exclusiva para Servicio al Cliente (CS)
  const csNavItems = [
    { to: '/cs-dashboard', icon: Headphones, label: '🎧 Mesa de Control CS' },
    { to: '/matchmaking/citas-agendadas', icon: Calendar, label: '📅 Citas Agendadas' },
    { to: '/matchmaking/aprobados-maria', icon: ShieldCheck, label: '🛡️ Citas Aprobadas por María' },
    { to: '/proveedores', icon: Truck, label: '🍽️ Restaurantes Aliados' },
    { to: '/clientes', icon: Users, label: '👥 Directorio Clientes' },
    { to: '/capacitacion', icon: BookOpen, label: '📚 Manuales & Capacitación' }
  ]

  // Groups and items configuration — Zero noise per role
  const coreItems = [
    ...(isPsyc ? [{ to: '/psicologa', icon: Heart, label: 'Mi Panel Clínico', module: 'dashboard', action: 'view', end: true }] : []),
    ...(isMaria ? [{ to: '/', icon: LayoutDashboard, label: 'Dashboard Dirección', module: 'dashboard', action: 'view', end: true }] : []),
    ...(isMaria ? [{ to: '/general', icon: LayoutDashboard, label: 'Dashboard Financiero', module: 'dashboard', action: 'view' }] : []),
    ...(isMaria ? [{ to: '/auditoria-psicologas', icon: Award, label: 'Auditoría & Rendimiento', module: 'roles', action: 'view' }] : []),
    ...(!isLina && !isCliente ? [{ to: '/clientes', icon: Users, label: 'Clientes', module: 'clientes', action: 'view' }] : []),
    ...(isMaria ? [{ to: '/proveedores', icon: Truck, label: 'Proveedores', module: 'proveedores', action: 'view' }] : []),
    ...(isMaria ? [{ to: '/importar', icon: Upload, label: 'Importar Excel', module: 'importar', action: 'view' }] : []),
  ]

  const matchmakingItems = [
    ...(isMaria ? [{ to: '/matchmaking/supervision-maria', icon: Lock, label: '🔒 Supervisión María', module: 'matching', action: 'view' }] : []),
    ...(isPsyc || isMaria ? [{ to: '/matchmaking/calendario', icon: Calendar, label: isMaria ? '📅 Calendario & Turnos' : '📅 Mi Calendario de Turnos', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isPsyc ? [{ to: '/matchmaking/entrevista', icon: Sparkles, label: '🎙️ Entrevista Clínica & Evaluación', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isPsyc ? [{ to: '/matchmaking/profiles', icon: FileSpreadsheet, label: '📋 PROFILES', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isPsyc ? [{ to: '/matchmaking/mis-matches', icon: Heart, label: isMaria ? '💖 Matches Psicólogas' : '💖 Mis Matches (Psicóloga)', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isCs || isPsyc ? [{ to: '/matchmaking/aprobados-maria', icon: ShieldCheck, label: isCs ? 'Citas por Agendar' : '🛡️ Aprobados por María', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isCs || isPsyc ? [{ to: '/matchmaking/matches-aprobados', icon: FileSpreadsheet, label: '📑 MATCHES', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isCs ? [{ to: '/matchmaking/citas-agendadas', icon: Calendar, label: '📅 Citas Aceptadas', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isCs || isPsyc ? [{ to: '/matchmaking/prioritarios', icon: Flame, label: '🔥 Prioritarios (15+ días)', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isPsyc || isCs ? [{ to: '/matchmaking/trouble', icon: AlertTriangle, label: '⚠️ Trouble & Casos Especiales', module: 'matching', action: 'view' }] : []),
    ...(isMaria || isLina ? [{ to: '/matchmaking/refunds', icon: Wallet, label: '💰 Cola de Refunds (Lina)', module: 'matching', action: 'view' }] : [])
  ]

  const cmsItems = isMaria ? [
    { to: '/cms/eventos', icon: Calendar, label: 'CMS Eventos', module: 'eventos', action: 'view' },
    { to: '/cms/ciudades', icon: Globe, label: 'CMS Ciudades', module: 'eventos', action: 'view' },
  ] : []

  const personalItems = isMaria ? [
    { to: '/empleados', icon: Users, label: 'Empleados', module: 'empleados', action: 'view' },
    { to: '/horas-psicologas', icon: Clock, label: '⏱️ Horas & Rendimiento', module: 'empleados', action: 'view' },
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
    { to: '/configuracion/alertas', icon: BellRing, label: '🔔 Configurar Alertas', module: 'roles', action: 'view' },
    { to: '/capacitacion', icon: BookOpen, label: '📚 Manuales & Capacitación', module: 'roles', action: 'view' },
  ] : [
    { to: '/capacitacion', icon: BookOpen, label: '📚 Manuales & Capacitación', module: 'dashboard', action: 'view' },
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
        ) : isCliente ? (
          <div style={{ marginTop: 16 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-primary)',
              padding: '0 12px 6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Portal del Cliente
            </div>
            {clienteNavItems.map(({ to, icon: Icon, label }) => (
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
        ) : isCs ? (
          <div style={{ marginTop: 16 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-primary)',
              padding: '0 12px 6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Mesa de Control CS
            </div>
            {csNavItems.map(({ to, icon: Icon, label }) => (
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
        {isOriginalAdmin && (
          <div style={{
            marginBottom: 12,
            padding: '8px 10px',
            background: 'rgba(150, 21, 0, 0.12)',
            borderRadius: 8,
            border: '1px solid var(--border-color)'
          }}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              <Eye size={12} /> Ver como (Simulador):
            </div>
            <select
              value={previewRole || 'Admin'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'Admin') {
                  setPreviewRole(null);
                  navigate('/');
                } else {
                  setPreviewRole(val);
                  if (val === 'Cliente') navigate('/portal-cliente');
                  else if (val === 'Servicio al Cliente') navigate('/cs-dashboard');
                  else if (val === 'Psicóloga') navigate('/psicologa');
                }
                if (onClose) onClose();
              }}
              style={{
                width: '100%',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                padding: '5px 8px',
                fontSize: 12,
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="Admin">👑 Admin (Dirección)</option>
              <option value="Psicóloga">🩺 Psicóloga / Matchmaker</option>
              <option value="Servicio al Cliente">🎧 Servicio al Cliente (CS)</option>
              <option value="Cliente">💖 Cliente (Portal de Citas)</option>
            </select>
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
  const { user, previewRole } = useAuth()
  const effectiveRole = previewRole || user?.role || ''
  if (effectiveRole === 'atrasados_only') {
    return <Navigate to="/matchmaking/cola-atrasados" replace />
  }
  if (effectiveRole === 'Cliente') {
    return <ClientePortalDashboard />
  }
  if (effectiveRole === 'Servicio al Cliente' || (typeof effectiveRole === 'string' && (effectiveRole.toLowerCase().includes('servicio') || effectiveRole.toLowerCase().includes('customer')))) {
    return <CustomerServiceDashboard />
  }
  if (effectiveRole === 'Psicóloga' || (typeof effectiveRole === 'string' && (effectiveRole.toLowerCase().includes('psicolog') || effectiveRole.toLowerCase().includes('matchmaker')))) {
    return <MatchmakerDashboard />
  }
  if (effectiveRole === 'Lina (Refunds)') {
    return <Navigate to="/matchmaking/refunds" replace />
  }
  return <Dashboard />
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

  // El trabajo por horas es exclusivo para Psicólogas / Matchmakers.
  // Se excluye terminantemente a María Paula, administradores y dirección (no facturan horas).
  const userEmail = (user?.email || '').toLowerCase().trim()
  const rawRole = (user?.role || '').toLowerCase()
  const rawName = (user?.name || user?.full_name || '').toLowerCase()
  const isMariaOrAdmin = 
    userEmail.includes('maria') ||
    userEmail.includes('admin') ||
    ADMIN_EMAILS.includes(userEmail) ||
    rawName.includes('maria paula') ||
    rawName.includes('maría paula') ||
    ADMIN_ROLES.map(r => r.toLowerCase()).includes(rawRole) ||
    isOriginalAdmin

  const isPsychologistUser = !isMariaOrAdmin && (
    rawRole.includes('psicolog') ||
    rawRole.includes('matchmaker')
  )

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
                <header className="app-main-header">
                  <div className="header-left">
                    <button
                      onClick={() => setSidebarOpen(prev => !prev)}
                      className="sidebar-toggle-btn"
                      style={{ flexShrink: 0 }}
                      aria-label={sidebarOpen ? "Ocultar menú lateral" : "Mostrar menú lateral"}
                      title={sidebarOpen ? "Ocultar menú lateral" : "Mostrar menú lateral"}
                    >
                      <Menu size={18} />
                    </button>
                    <GlobalSearch />

                    {/* Selector 'Ver como' — visible EXCLUSIVAMENTE en escritorio (en móvil está en el menú lateral) */}
                    {isOriginalAdmin && (
                      <div className="desktop-only-role-picker" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: previewRole ? 'rgba(150, 21, 0, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${previewRole ? 'var(--color-primary)' : 'var(--border-color)'}`,
                        borderRadius: 8,
                        padding: '4px 10px',
                        marginLeft: 8,
                        flexShrink: 0
                      }}>
                        <Eye size={14} style={{ color: previewRole ? 'var(--color-primary)' : 'var(--text-secondary)' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: previewRole ? 'var(--color-primary)' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Ver como:
                        </span>
                        <select
                          value={previewRole || 'Admin'}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'Admin') {
                              setPreviewRole(null);
                              navigate('/');
                            } else {
                              setPreviewRole(val);
                              if (val === 'Cliente') navigate('/portal-cliente');
                              else if (val === 'Servicio al Cliente') navigate('/cs-dashboard');
                              else if (val === 'Psicóloga') navigate('/psicologa');
                            }
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
                          <option value="Admin">👑 Admin (Dirección / Vista Completa)</option>
                          <option value="Psicóloga">🩺 Psicóloga / Matchmaker</option>
                          <option value="Servicio al Cliente">🎧 Servicio al Cliente (CS)</option>
                          <option value="Cliente">💖 Cliente (Portal de Citas)</option>
                        </select>
                        {previewRole && (
                          <button
                            onClick={() => {
                              setPreviewRole(null);
                              navigate('/');
                            }}
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
                  <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {isPsychologistUser && <WorkTimerWidget />}
                    <CsNovedadesNotificationBell />
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
                        flexShrink: 0,
                        transition: 'all 0.2s'
                      }}
                      title={theme === 'light' ? "Modo Oscuro" : "Modo Claro"}
                    >
                      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                    </button>
                  </div>
                </header>
                <main className="main-content" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minWidth: 0 }}>
                  <Routes>
                    <Route path="/" element={<HomeRoute />} />

                    {/* MÓDULO: SUPERVISIÓN MARÍA PAULA & DIRECCIÓN */}
                    <Route path="/general" element={<AreaErrorBoundary areaName="Supervisión & Dirección General"><ProtectedRoute module="dashboard" action="view"><Dashboard /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/auditoria-psicologas" element={<AreaErrorBoundary areaName="Supervisión & Dirección General"><ProtectedRoute module="roles" action="view"><AuditoriaPsicologas /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/matchmaking/supervision-maria" element={<AreaErrorBoundary areaName="Supervisión de María Paula"><ProtectedRoute module="matching" action="view"><SupervisionMaria /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/matchmaking/aprobados-maria" element={<AreaErrorBoundary areaName="Supervisión de María Paula"><ProtectedRoute module="matching" action="view"><AprobadosMaria /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/matchmaking/trouble" element={<AreaErrorBoundary areaName="Supervisión & Trouble Matches"><ProtectedRoute module="matching" action="view"><TroubleMatches /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/matchmaking/refunds" element={<AreaErrorBoundary areaName="Supervisión & Reembolsos"><ProtectedRoute module="matching" action="view"><RefundsQueue /></ProtectedRoute></AreaErrorBoundary>} />

                    {/* MÓDULO: SERVICIO AL CLIENTE (CS) & CITAS */}
                    <Route path="/cs-dashboard" element={<AreaErrorBoundary areaName="Servicio al Cliente (CS)"><ProtectedRoute module="dashboard" action="view"><CustomerServiceDashboard /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/matchmaking/citas-agendadas" element={<AreaErrorBoundary areaName="Servicio al Cliente (Citas Agendadas)"><ProtectedRoute module="matching" action="view"><CitasAgendadas /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/matchmaking/matches-aprobados" element={<AreaErrorBoundary areaName="Servicio al Cliente (Mesa MATCHES)"><ProtectedRoute module="matching" action="view"><MisMatches isOfficialMatches={true} /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/matchmaking/matches" element={<AreaErrorBoundary areaName="Servicio al Cliente (Mesa MATCHES)"><ProtectedRoute module="matching" action="view"><MisMatches isOfficialMatches={true} /></ProtectedRoute></AreaErrorBoundary>} />

                    {/* MÓDULO: PSICÓLOGAS & MATCHMAKING CLÍNICO */}
                    <Route path="/psicologa" element={<AreaErrorBoundary areaName="Mesa de Trabajo Psicólogas"><ProtectedRoute module="dashboard" action="view"><MatchmakerDashboard /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/clinico" element={<AreaErrorBoundary areaName="Mesa de Trabajo Psicólogas"><ProtectedRoute module="dashboard" action="view"><MatchmakerDashboard /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/matchmaking/mis-matches" element={<AreaErrorBoundary areaName="Mesa de Trabajo Psicólogas (Mis Matches)"><ProtectedRoute module="matching" action="view"><MisMatches /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/matchmaking/entrevista" element={<AreaErrorBoundary areaName="Entrevista Clínica & Hub"><ProtectedRoute module="matching" action="view"><EntrevistaHub /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/matchmaking/cola-atrasados" element={<AreaErrorBoundary areaName="Cola de Atrasados Clínicos"><ProtectedRoute module="matching" action="view"><EntrevistaHub initialTab="cola_atrasados" /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/matchmaking/matches-atrasados" element={<AreaErrorBoundary areaName="Matches Atrasados"><ProtectedRoute module="matching" action="view"><MatchesAtrasados /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/matchmaking/profiles" element={<AreaErrorBoundary areaName="PROFILES (Ingreso de Perfiles)"><ProtectedRoute module="matching" action="view"><IntakeClientes /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/matchmaking/intake" element={<AreaErrorBoundary areaName="PROFILES (Ingreso de Perfiles)"><ProtectedRoute module="matching" action="view"><IntakeClientes /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/matchmaking/prioritarios" element={<AreaErrorBoundary areaName="Casos Prioritarios"><ProtectedRoute module="matching" action="view"><Prioritarios /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/matchmaking/todos-los-matches" element={<AreaErrorBoundary areaName="Matriz Global de Matches"><ProtectedRoute module="matching" action="view"><TodosLosMatches /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/agenda" element={<AreaErrorBoundary areaName="Agenda & Turnos"><ProtectedRoute module="matching" action="view"><CalendarioTurnos7shifts /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/matchmaking/calendario" element={<AreaErrorBoundary areaName="Agenda & Turnos"><ProtectedRoute module="matching" action="view"><CalendarioTurnos7shifts /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/matchmaking/sala/:sessionId" element={<AreaErrorBoundary areaName="Sala de Videollamada"><ProtectedRoute module="matching" action="view"><SalaVideollamada /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/horas-psicologas" element={<AreaErrorBoundary areaName="Control de Horas Clínicas"><ProtectedRoute module="empleados" action="view"><ControlHorasPsicologas /></ProtectedRoute></AreaErrorBoundary>} />

                    {/* MÓDULO: PORTAL DEL CLIENTE */}
                    <Route path="/portal-cliente" element={<AreaErrorBoundary areaName="Portal del Cliente"><ProtectedRoute module="dashboard" action="view"><ClientePortalDashboard /></ProtectedRoute></AreaErrorBoundary>} />

                    {/* MÓDULO: ADMINISTRACIÓN, CLIENTES Y FINANZAS */}
                    <Route path="/clientes" element={<AreaErrorBoundary areaName="Directorio de Clientes"><ProtectedRoute module="clientes" action="view"><Clientes /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/eventos" element={<AreaErrorBoundary areaName="Gestión de Eventos"><ProtectedRoute module="eventos" action="view"><Eventos /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/cms/eventos" element={<AreaErrorBoundary areaName="CMS Eventos"><ProtectedRoute module="eventos" action="view"><CmsEventos /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/cms/ciudades" element={<AreaErrorBoundary areaName="CMS Ciudades"><ProtectedRoute module="eventos" action="view"><CmsCiudades /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/importar" element={<AreaErrorBoundary areaName="Importación de Datos"><ProtectedRoute module="importar" action="view"><Importar /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/empleados" element={<AreaErrorBoundary areaName="Gestión de Personal"><ProtectedRoute module="empleados" action="view"><Employees /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/nomina" element={<AreaErrorBoundary areaName="Nómina"><ProtectedRoute module="nomina" action="view"><Payroll /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/comisiones" element={<AreaErrorBoundary areaName="Comisiones"><ProtectedRoute module="comisiones" action="view"><Commissions /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/ingresos" element={<AreaErrorBoundary areaName="Ingresos"><ProtectedRoute module="ingresos" action="view"><Income /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/gastos" element={<AreaErrorBoundary areaName="Gastos"><ProtectedRoute module="gastos" action="view"><Expenses /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/flujo-de-caja" element={<AreaErrorBoundary areaName="Flujo de Caja"><ProtectedRoute module="flujo_caja" action="view"><CashFlow /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/proveedores" element={<AreaErrorBoundary areaName="Proveedores"><ProtectedRoute module="proveedores" action="view"><Proveedores /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/roles" element={<AreaErrorBoundary areaName="Roles y Permisos"><ProtectedRoute module="roles" action="view"><Roles /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/usuarios" element={<AreaErrorBoundary areaName="Cuentas de Usuarios"><ProtectedRoute module="usuarios" action="view"><UserAccounts /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/configuracion/formularios" element={<AreaErrorBoundary areaName="Configuración de Formularios"><ProtectedRoute module="roles" action="view"><ConfiguracionFormularios /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/configuracion/alertas" element={<AreaErrorBoundary areaName="Configuración de Alertas"><ProtectedRoute module="roles" action="view"><ConfiguracionAlertas /></ProtectedRoute></AreaErrorBoundary>} />
                    <Route path="/capacitacion" element={<AreaErrorBoundary areaName="Manuales y Capacitación"><ProtectedRoute module="dashboard" action="view"><ManualesCapacitacion /></ProtectedRoute></AreaErrorBoundary>} />

                    {/* Redirecciones de compatibilidad */}
                    <Route path="/matchmaking/datos-objetivos" element={<Navigate to="/matchmaking/entrevista?tab=objetivos" replace />} />
                    <Route path="/matchmaking/percepcion-psicologa" element={<Navigate to="/matchmaking/entrevista?tab=percepcion" replace />} />
                    <Route path="/cola-atrasados" element={<Navigate to="/matchmaking/cola-atrasados" replace />} />
                    <Route path="/matches-atrasados" element={<Navigate to="/matchmaking/matches-atrasados" replace />} />
                    <Route path="/entrevista" element={<Navigate to="/matchmaking/entrevista" replace />} />
                    <Route path="/datos-objetivos" element={<Navigate to="/matchmaking/entrevista?tab=objetivos" replace />} />
                    <Route path="/percepcion-psicologa" element={<Navigate to="/matchmaking/entrevista?tab=percepcion" replace />} />
                    <Route path="/trouble" element={<Navigate to="/matchmaking/trouble" replace />} />
                    <Route path="/prioritarios" element={<Navigate to="/matchmaking/prioritarios" replace />} />
                    <Route path="/corazoncito" element={<Navigate to="/matchmaking/prioritarios" replace />} />
                    <Route path="/supervision-maria" element={<Navigate to="/matchmaking/supervision-maria" replace />} />
                    <Route path="/supervision" element={<Navigate to="/matchmaking/supervision-maria" replace />} />
                    <Route path="/matching-manual" element={<Navigate to="/matchmaking/mis-matches" replace />} />
                    <Route path="/matching" element={<Navigate to="/matchmaking/todos-los-matches" replace />} />
                    <Route path="/matchmaking/aprobacion" element={<Navigate to="/matchmaking/aprobados-maria" replace />} />
                    <Route path="/matchmaking/pendientes" element={<Navigate to="/matchmaking/aprobados-maria" replace />} />
                    <Route path="/admin/horas-psicologas" element={<Navigate to="/horas-psicologas" replace />} />
                    <Route path="/control-horas" element={<Navigate to="/horas-psicologas" replace />} />
                    <Route path="/admin/configuracion/formularios" element={<Navigate to="/configuracion/formularios" replace />} />
                    <Route path="/admin/configuracion/alertas" element={<Navigate to="/configuracion/alertas" replace />} />
                    <Route path="/manuales" element={<Navigate to="/capacitacion" replace />} />
                    <Route path="/admin/capacitacion" element={<Navigate to="/capacitacion" replace />} />

                    <Route path="*" element={<Dashboard />} />
                  </Routes>
                </main>
              </div>
              <CopilotWidget />
              <ForcePasswordChangeModal />
              <NotificationToastContainer />
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
      <NotificationProvider>
        <BrowserRouter basename="/admin">
          <AppContent />
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  )
}

export default App
