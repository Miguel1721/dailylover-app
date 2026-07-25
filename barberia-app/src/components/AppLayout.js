'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import {
  Scissors, LayoutDashboard, CalendarDays, ShoppingCart,
  Package, TrendingUp, DollarSign, Users, LogOut,
  ChevronLeft, Menu, Settings, Bell, X, Sun, Moon, ShieldCheck
} from 'lucide-react'
import toast from 'react-hot-toast'

const BASE_NAV_ITEMS = [
  { href: '/pos',          icon: ShoppingCart,    label: 'Punto de Venta', id: 'nav-pos' },
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard',      id: 'nav-dashboard' },
  { href: '/appointments', icon: CalendarDays,    label: 'Agendamiento',   id: 'nav-appointments' },
  { href: '/inventory',    icon: Package,         label: 'Inventario',     id: 'nav-inventory' },
  { href: '/commissions',  icon: DollarSign,      label: 'Comisiones',     id: 'nav-commissions' },
  { href: '/finance',      icon: TrendingUp,      label: 'Finanzas',       id: 'nav-finance' },
  { href: '/barbers',      icon: Users,           label: 'Barberos',       id: 'nav-barbers' },
  { href: '/settings',     icon: Settings,        label: 'Configuración',  id: 'nav-settings' },
]

export default function AppLayout({ children }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [bizSettings, setBizSettings] = useState({
    businessName: 'Barber Club',
    businessSubtitle: 'Gestión Barbería',
    logoUrl: null,
  })

  // --- Estados de Notificaciones ---
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)

  // --- Estados del Tema (Claro / Oscuro) ---
  const [theme, setTheme] = useState('dark')

  // --- Estados de la Cola de Barberos ---
  const [barberQueue, setBarberQueue] = useState([])
  const [selectedQueueBarber, setSelectedQueueBarber] = useState(null)
  const [selectedQueueIndex, setSelectedQueueIndex] = useState(-1)
  const [showQueueModal, setShowQueueModal] = useState(false)

  // --- Inicializar y persistir el Tema ---
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark'
    setTheme(savedTheme)
    const root = window.document.documentElement
    if (savedTheme === 'light') {
      root.classList.remove('dark')
    } else {
      root.classList.add('dark')
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    const root = window.document.documentElement
    if (newTheme === 'light') {
      root.classList.remove('dark')
    } else {
      root.classList.add('dark')
    }
  }

  // --- Cargar Ajustes ---
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => { if (data?.businessName) setBizSettings(data) })
      .catch(() => {})
  }, [pathname])

  // --- Cargar y sincronizar la Cola de Barberos ---
  useEffect(() => {
    const loadBarbersAndSyncQueue = async () => {
      try {
        const res = await fetch('/api/barbers')
        const barbers = await res.json()
        const activeBarbers = (Array.isArray(barbers) ? barbers : barbers.data || [])
          .filter(b => b.isActive)
          .map(b => ({ id: b.id, name: b.name }))
        
        const savedStr = localStorage.getItem('barberQueue')
        let currentQueue = []
        if (savedStr) {
          try {
            const savedQueue = JSON.parse(savedStr)
            currentQueue = savedQueue
              .filter(savedB => activeBarbers.some(activeB => activeB.id === savedB.id))
              .map(savedB => {
                const fresh = activeBarbers.find(activeB => activeB.id === savedB.id)
                return fresh ? { id: fresh.id, name: fresh.name } : savedB
              })
            activeBarbers.forEach(activeB => {
              if (!currentQueue.some(qB => qB.id === activeB.id)) {
                currentQueue.push(activeB)
              }
            })
          } catch {
            currentQueue = activeBarbers
          }
        } else {
          currentQueue = activeBarbers
        }
        
        setBarberQueue(currentQueue)
        localStorage.setItem('barberQueue', JSON.stringify(currentQueue))
      } catch (e) {
        console.error(e)
      }
    }
    loadBarbersAndSyncQueue()
  }, [pathname])

  // --- Cargar Notificaciones Reales (Bajo Inventario y Citas Hoy) ---
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0]
        const [invRes, appRes] = await Promise.all([
          fetch('/api/inventory').then(r => r.json()),
          fetch(`/api/appointments?date=${todayStr}`).then(r => r.json())
        ])
        
        const list = []
        
        // 1. Alertas de inventario bajo
        if (invRes?.products) {
          invRes.products.forEach(p => {
            if (p.stock <= p.minStock) {
              list.push({
                id: `inv-${p.id}`,
                title: 'Inventario Bajo',
                message: `${p.name} tiene ${p.stock} unidades (mín. ${p.minStock})`,
                type: 'alert',
                read: false
              })
            }
          })
        }
        
        // 2. Citas pendientes hoy
        const appointmentsList = Array.isArray(appRes) ? appRes : appRes?.data || []
        appointmentsList.forEach(a => {
          if (a.status === 'PENDING') {
            list.push({
              id: `apt-${a.id}`,
              title: 'Cita Pendiente',
              message: `${a.clientName} a las ${a.timeSlot} con ${a.barber?.name || 'barbero'}`,
              type: 'info',
              read: false
            })
          }
        })
        
        setNotifications(list)
      } catch (e) {
        console.error(e)
      }
    }
    
    if (session) {
      loadNotifications()
    }
  }, [pathname, session])

  // --- Handlers de Cola de Barberos ---
  const handleQueueBarberClick = (barber, index) => {
    setSelectedQueueBarber(barber)
    setSelectedQueueIndex(index)
    setShowQueueModal(true)
  }

  const handleAtender = () => {
    if (selectedQueueIndex === -1) return
    const updated = [...barberQueue]
    const [barber] = updated.splice(selectedQueueIndex, 1)
    updated.push(barber) // Mandar al final de la cola
    setBarberQueue(updated)
    localStorage.setItem('barberQueue', JSON.stringify(updated))
    setShowQueueModal(false)
    toast.success(`${barber.name} pasó al final de la cola`)
  }

  const handleMoverInicio = () => {
    if (selectedQueueIndex === -1) return
    const updated = [...barberQueue]
    const [barber] = updated.splice(selectedQueueIndex, 1)
    updated.unshift(barber) // Mandar al inicio de la cola
    setBarberQueue(updated)
    localStorage.setItem('barberQueue', JSON.stringify(updated))
    setShowQueueModal(false)
    toast.success(`${barber.name} puesto al inicio de la cola`)
  }

  const handleMoverAtras = () => {
    if (selectedQueueIndex === -1 || selectedQueueIndex === barberQueue.length - 1) return
    const updated = [...barberQueue]
    const temp = updated[selectedQueueIndex]
    updated[selectedQueueIndex] = updated[selectedQueueIndex + 1]
    updated[selectedQueueIndex + 1] = temp
    setBarberQueue(updated)
    localStorage.setItem('barberQueue', JSON.stringify(updated))
    setSelectedQueueIndex(selectedQueueIndex + 1)
  }

  const handleMoverAdelante = () => {
    if (selectedQueueIndex === -1 || selectedQueueIndex === 0) return
    const updated = [...barberQueue]
    const temp = updated[selectedQueueIndex]
    updated[selectedQueueIndex] = updated[selectedQueueIndex - 1]
    updated[selectedQueueIndex - 1] = temp
    setBarberQueue(updated)
    localStorage.setItem('barberQueue', JSON.stringify(updated))
    setSelectedQueueIndex(selectedQueueIndex - 1)
  }

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo / Branding */}
      <div className={`flex items-center gap-3 p-4 border-b border-dark-700 ${collapsed ? 'justify-center' : ''}`}>
        {bizSettings.logoUrl ? (
          <img
            src={bizSettings.logoUrl}
            alt="Logo"
            className="w-10 h-10 rounded-lg object-contain bg-white p-0.5 flex-shrink-0"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
          >
            <Scissors size={18} className="text-black" />
          </div>
        )}
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="font-bold text-white text-sm leading-tight truncate">{bizSettings.businessName}</div>
            <div className="text-xs text-dark-500 truncate">{bizSettings.businessSubtitle}</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto no-scrollbar">
        {(session?.user?.role === 'SUPERADMIN'
          ? [{ href: '/superadmin', icon: ShieldCheck, label: 'Super Admin', id: 'nav-superadmin' }, ...BASE_NAV_ITEMS]
          : BASE_NAV_ITEMS
        ).map(({ href, icon: Icon, label, id }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              id={id}
              onClick={() => setMobileOpen(false)}
              className={`sidebar-link ${active ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User & Logout */}
      <div className="p-3 border-t border-dark-700">
        {!collapsed && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-700/50 mb-2">
            <div className="w-8 h-8 rounded-full bg-gold-600 flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
              {session?.user?.name?.[0] || 'A'}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-white truncate">{session?.user?.name || 'Admin'}</div>
              <div className="text-xs text-dark-500 truncate">{session?.user?.role || 'ADMIN'}</div>
            </div>
          </div>
        )}
        <button
          id="btn-logout"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className={`sidebar-link w-full text-red-500 hover:text-red-400 hover:bg-red-900/20 ${collapsed ? 'justify-center px-2' : ''}`}
          title={collapsed ? 'Cerrar sesión' : undefined}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </div>
  )

  const currentLabel = BASE_NAV_ITEMS.find(n => pathname.startsWith(n.href))?.label || bizSettings.businessName

  return (
    <div className="flex h-screen bg-dark-950 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col bg-dark-900 border-r border-dark-700 transition-all duration-300 relative ${collapsed ? 'w-16' : 'w-60'}`}>
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-1/2 -translate-y-1/2 translate-x-full w-5 h-10 bg-dark-700 border border-dark-600 rounded-r-md flex items-center justify-center text-dark-500 hover:text-white hover:bg-dark-600 transition-all z-10"
          style={{ left: collapsed ? '3.5rem' : '14.5rem' }}
        >
          <ChevronLeft size={14} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 w-64 bg-dark-900 border-r border-dark-700 h-full">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 bg-dark-900 border-b border-dark-700 flex items-center justify-between px-4 flex-shrink-0 relative">
          {/* Left: Menu & Label */}
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden btn-ghost p-2" onClick={() => setMobileOpen(true)}>
              <Menu size={20} />
            </button>
            <div className="text-sm text-dark-500 truncate hidden sm:block">{currentLabel}</div>
          </div>

          {/* Middle: Barbers Queue (Cola de barberos) */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-[55%] sm:max-w-[60%] md:max-w-[55%] px-1 no-scrollbar min-w-0">
            <span className="text-[10px] md:text-xs font-semibold text-dark-500 uppercase tracking-wider mr-0.5 shrink-0 hidden sm:inline">Cola:</span>
            {barberQueue.length === 0 ? (
              <span className="text-xs text-dark-500 truncate">Sin barberos</span>
            ) : (
              <>
                {/* Desktop: list all queue */}
                <div className="hidden md:flex items-center gap-1.5">
                  {barberQueue.map((barber, index) => (
                    <button
                      key={barber.id}
                      onClick={() => handleQueueBarberClick(barber, index)}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                        index === 0
                          ? 'bg-gold-500/10 border-gold-500/50 text-gold-400 font-bold shadow-md shadow-gold-500/5'
                          : 'bg-dark-800 border-dark-700 text-dark-400 hover:border-dark-600 hover:text-white'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-gold-400 animate-pulse' : 'bg-dark-500'}`} />
                      {barber.name}
                      {index === 0 && <span className="text-[10px] bg-gold-500 text-dark-950 px-1 rounded font-black ml-1">SIG</span>}
                    </button>
                  ))}
                </div>

                {/* Mobile: list only next and count */}
                <div className="flex md:hidden items-center gap-1 min-w-0">
                  <button
                    onClick={() => handleQueueBarberClick(barberQueue[0], 0)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border bg-gold-500/10 border-gold-500/50 text-gold-400 min-w-0 max-w-[140px] sm:max-w-none"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse flex-shrink-0" />
                    <span className="truncate">Sig: {barberQueue[0].name}</span>
                  </button>
                  {barberQueue.length > 1 && (
                    <span className="text-[10px] text-dark-500 font-medium shrink-0">+{barberQueue.length - 1}</span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right: Actions (Theme Toggle & Notifications) */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="btn-ghost p-2 text-dark-500 hover:text-white"
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Notifications Toggle */}
            <button
              className="btn-ghost p-2 relative text-dark-500 hover:text-white"
              id="btn-notifications"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-gold-500 text-dark-950 text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-4 top-14 w-80 bg-dark-900 border border-dark-700 rounded-xl shadow-2xl z-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-sm">Notificaciones</h3>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-gold-400 hover:text-gold-300 font-medium">
                      Marcar leídas
                    </button>
                  )}
                </div>
                <div className="divider my-0 border-dark-700" />
                <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="text-center py-6 text-dark-500 text-xs">
                      No tienes notificaciones pendientes
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className={`p-2.5 rounded-lg border text-left ${n.read ? 'bg-dark-900/50 border-dark-800 text-dark-500' : 'bg-dark-800 border-dark-700 text-white'}`}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-black uppercase ${
                            n.type === 'alert' ? 'bg-red-950/40 text-red-400' : 'bg-gold-950/40 text-gold-400'
                          }`}>
                            {n.title}
                          </span>
                        </div>
                        <p className="text-xs">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto animate-slide-up">
            {children}
          </div>
        </main>
      </div>

      {/* Modal de Gestión de Turno */}
      {showQueueModal && selectedQueueBarber && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm space-y-4 border border-gold-600/30 bg-dark-900 animate-fade-in text-white">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg">Turno de Barberos</h3>
                <p className="text-xs text-dark-500">{selectedQueueBarber.name}</p>
              </div>
              <button onClick={() => setShowQueueModal(false)} className="text-dark-500 hover:text-white">
                <X size={16} />
              </button>
            </div>
            
            <div className="flex flex-col gap-2">
              <button onClick={handleAtender} className="btn-success py-2.5 w-full font-semibold flex items-center justify-center gap-2">
                <Scissors size={14} /> Atender cliente (Pasar al final)
              </button>
              
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={handleMoverAdelante}
                  disabled={selectedQueueIndex === 0}
                  className="btn-secondary py-2 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ⬅️ Adelantar
                </button>
                <button
                  onClick={handleMoverAtras}
                  disabled={selectedQueueIndex === barberQueue.length - 1}
                  className="btn-secondary py-2 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Atrasar ➡️
                </button>
              </div>
              
              <button onClick={handleMoverInicio} className="btn-secondary py-2.5 w-full text-xs mt-1">
                ⭐ Poner al inicio de la cola
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
