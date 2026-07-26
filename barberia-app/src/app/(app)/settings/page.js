'use client'
import { useState, useEffect } from 'react'
import {
  Settings, Save, Building2, DollarSign, Clock, Scissors,
  Package, Phone, MapPin, Mail, Image, AlertCircle, CheckCircle2, ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

const DAYS = [
  { key: 'Mon', label: 'Lunes' },
  { key: 'Tue', label: 'Martes' },
  { key: 'Wed', label: 'Miércoles' },
  { key: 'Thu', label: 'Jueves' },
  { key: 'Fri', label: 'Viernes' },
  { key: 'Sat', label: 'Sábado' },
  { key: 'Sun', label: 'Domingo' },
]

export default function SettingsPage() {
  const [settings, setSettings] = useState(null)
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('business')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      setSettings(data)
      setForm({
        ...data,
        commissionRateServicePct: Math.round((data.commissionRateService || 0.60) * 100),
        commissionRateProductPct: Math.round((data.commissionRateProduct || 0.20) * 100),
      })
      setLoading(false)
    })
  }, [])

  const update = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      ...form,
      commissionRateService: form.commissionRateServicePct / 100,
      commissionRateProduct: form.commissionRateProductPct / 100,
    }
    delete payload.commissionRateServicePct
    delete payload.commissionRateProductPct
    delete payload.id
    delete payload.updatedAt

    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      setSettings(updated)
      setDirty(false)
      toast.success('Configuración guardada exitosamente')
      setTimeout(() => window.location.reload(), 800)
    } else {
      const d = await res.json()
      toast.error(d.error || 'Error al guardar')
    }
  }

  if (loading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-dark-700 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Settings className="text-gold-400" size={28} />
            Configuración
          </h1>
          <p className="page-subtitle">Personaliza todo el sistema a tu medida</p>
        </div>
        <button
          id="btn-save-settings"
          onClick={handleSave}
          disabled={saving || !dirty}
          className={`btn-primary ${!dirty ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {saving ? <><span className="animate-spin">⟳</span> Guardando...</> : <><Save size={16} /> Guardar cambios</>}
        </button>
      </div>

      {dirty && (
        <div className="card gold-box flex items-center gap-3 py-3 !p-4">
          <AlertCircle size={18} className="flex-shrink-0 text-inherit" />
          <span className="text-sm text-inherit">Tienes cambios sin guardar. Haz clic en "Guardar cambios" para aplicarlos.</span>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-dark-700 pb-0">
        {[
          { key: 'business', label: 'Negocio', icon: Building2 },
          { key: 'commissions', label: 'Comisiones', icon: DollarSign },
          { key: 'schedule', label: 'Horarios', icon: Clock },
          { key: 'services', label: 'Servicios', icon: Scissors },
          { key: 'expenses', label: 'Categorías gastos', icon: Package },
        ].map(t => (
          <button
            key={t.key}
            id={`tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
              tab === t.key
                ? 'border-gold-500 text-gold-400'
                : 'border-transparent text-dark-500 hover:text-dark-400'
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Información del negocio ── */}
      {tab === 'business' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card space-y-4">
            <h2 className="section-title">Información general</h2>
            <div>
              <label className="input-label">Nombre del negocio *</label>
              <input
                id="input-business-name"
                className="input"
                value={form.businessName || ''}
                onChange={e => update('businessName', e.target.value)}
                placeholder="El Campincito Barber Club"
              />
              <p className="text-xs text-dark-500 mt-1">Aparece en el encabezado del sistema y en los recibos</p>
            </div>
            <div>
              <label className="input-label">Subtítulo</label>
              <input
                id="input-business-subtitle"
                className="input"
                value={form.businessSubtitle || ''}
                onChange={e => update('businessSubtitle', e.target.value)}
                placeholder="Tradición & Estilo"
              />
            </div>
            <div>
              <label className="input-label">
                <Phone size={13} className="inline mr-1" />
                Teléfono / WhatsApp
              </label>
              <input
                className="input"
                value={form.businessPhone || ''}
                onChange={e => update('businessPhone', e.target.value)}
                placeholder="3001234567"
              />
            </div>
            <div>
              <label className="input-label">
                <Mail size={13} className="inline mr-1" />
                Email de contacto
              </label>
              <input
                type="email"
                className="input"
                value={form.businessEmail || ''}
                onChange={e => update('businessEmail', e.target.value)}
                placeholder="contacto@barberclub.com.co"
              />
            </div>
            <div>
              <label className="input-label">
                <MapPin size={13} className="inline mr-1" />
                Dirección
              </label>
              <input
                className="input"
                value={form.businessAddress || ''}
                onChange={e => update('businessAddress', e.target.value)}
                placeholder="Carrera 13 # 10-16"
              />
            </div>
          </div>

          {/* Logo preview */}
          <div className="card space-y-4">
            <h2 className="section-title">Logo del negocio</h2>
            <div className="flex flex-col items-center gap-4">
              {form.logoUrl ? (
                <div className="w-40 h-40 rounded-2xl border-2 border-dark-600 overflow-hidden flex items-center justify-center bg-white">
                  <img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                </div>
              ) : (
                <div className="w-40 h-40 rounded-2xl border-2 border-dashed border-dark-600 flex flex-col items-center justify-center text-dark-600">
                  <Image size={40} className="mb-2" />
                  <span className="text-xs">Sin logo</span>
                </div>
              )}
              <div className="w-full">
                <label className="input-label">URL del logo</label>
                <input
                  className="input"
                  value={form.logoUrl || ''}
                  onChange={e => update('logoUrl', e.target.value)}
                  placeholder="/logo.jpeg"
                />
                <p className="text-xs text-dark-500 mt-1">
                  El logo está incluido en <code className="text-gold-500">/public/logo.jpeg</code>. Puedes subir un nuevo archivo al servidor y poner su ruta aquí.
                </p>
              </div>
            </div>

            {/* Preview sidebar */}
            <div className="mt-4 p-4 rounded-xl bg-dark-700/50 border border-dark-600">
              <p className="text-xs text-dark-500 mb-3 uppercase tracking-wide">Vista previa del encabezado</p>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-900">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Logo" className="w-9 h-9 rounded-lg object-contain bg-white p-0.5" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-gold-600 flex items-center justify-center">
                    <Scissors size={18} className="text-black" />
                  </div>
                )}
                <div>
                  <div className="font-bold text-white text-sm leading-tight">{form.businessName || 'Barber Club'}</div>
                  <div className="text-xs text-dark-500">{form.businessSubtitle || 'Gestión Barbería'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Comisiones ── */}
      {tab === 'commissions' && (
        <div className="max-w-2xl space-y-6">
          <div className="card space-y-6">
            <h2 className="section-title">Tasas de comisión globales</h2>
            <p className="text-dark-400 text-sm">
              Estas tasas aplican a <strong className="text-white">todos los barberos</strong> por defecto.
              Desde la página de <strong className="text-white">Barberos</strong> puedes configurar una tasa individual por barbero si alguien tiene un porcentaje diferente.
            </p>

            {/* Service commission */}
            <div>
              <label className="input-label flex items-center gap-2">
                <Scissors size={14} />
                Comisión sobre servicios
              </label>
              <div className="flex items-center gap-4">
                <input
                  id="input-commission-service"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={form.commissionRateServicePct}
                  onChange={e => update('commissionRateServicePct', Number(e.target.value))}
                  className="flex-1 accent-yellow-500"
                />
                <div className="w-20 text-center">
                  <span className="text-2xl font-bold text-gold-400">{form.commissionRateServicePct}%</span>
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.commissionRateServicePct}
                  onChange={e => update('commissionRateServicePct', Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="input w-20 text-center"
                />
              </div>
              <div className="mt-3 p-3 rounded-lg bg-dark-700/50 text-sm">
                <span className="text-dark-400">Ejemplo: si el barbero hace </span>
                <span className="text-white font-semibold">$100.000 en servicios</span>
                <span className="text-dark-400">, su comisión es </span>
                <span className="text-gold-400 font-bold">${(100000 * form.commissionRateServicePct / 100).toLocaleString('es-CO')}</span>
              </div>
            </div>

            <div className="divider" />

            {/* Product commission */}
            <div>
              <label className="input-label flex items-center gap-2">
                <Package size={14} />
                Comisión sobre productos
              </label>
              <div className="flex items-center gap-4">
                <input
                  id="input-commission-product"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={form.commissionRateProductPct}
                  onChange={e => update('commissionRateProductPct', Number(e.target.value))}
                  className="flex-1 accent-yellow-500"
                />
                <div className="w-20 text-center">
                  <span className="text-2xl font-bold text-blue-400">{form.commissionRateProductPct}%</span>
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.commissionRateProductPct}
                  onChange={e => update('commissionRateProductPct', Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="input w-20 text-center"
                />
              </div>
              <div className="mt-3 p-3 rounded-lg bg-dark-700/50 text-sm">
                <span className="text-dark-400">Ejemplo: si el barbero vende </span>
                <span className="text-white font-semibold">$50.000 en productos</span>
                <span className="text-dark-400">, su comisión es </span>
                <span className="text-blue-400 font-bold">${(50000 * form.commissionRateProductPct / 100).toLocaleString('es-CO')}</span>
              </div>
              {form.commissionRateProductPct === 0 && (
                <div className="mt-2 flex items-center gap-2 text-dark-500 text-xs">
                  <AlertCircle size={12} /> 0% significa que los productos no generan comisión para los barberos
                </div>
              )}
            </div>
          </div>

          <div className="card border-dark-700/50 bg-dark-800/50">
            <h3 className="section-title mb-3 text-sm">¿Cómo funciona?</h3>
            <ul className="space-y-2 text-sm text-dark-400">
              <li className="flex gap-2"><CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" /> Al registrar una venta, el sistema calcula automáticamente la comisión</li>
              <li className="flex gap-2"><CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" /> Se guarda el porcentaje usado en cada transacción, así cambia el % futuro sin afectar el historial</li>
              <li className="flex gap-2"><CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" /> Desde el módulo de Comisiones puedes ver y liquidar los saldos pendientes de cada barbero</li>
              <li className="flex gap-2"><CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" /> Si un barbero tiene % individual configurado en su perfil, ese tiene prioridad sobre el global</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── TAB: Horarios ── */}
      {tab === 'schedule' && (
        <div className="max-w-2xl space-y-6">
          <div className="card space-y-5">
            <h2 className="section-title">Configuración Global de Citas & Horarios</h2>
            <p className="text-dark-400 text-sm">
              Como administrador, puedes definir el intervalo de cada turno (ej. 30 minutos) y configurar horarios personalizados de atención <strong className="text-white">desde las 06:00 AM hasta las 11:00 PM</strong> para cada barbero o estilista.
            </p>

            <div>
              <label className="input-label flex items-center gap-2">
                <Clock size={14} />
                Duración base de cada slot de cita (intervalo)
              </label>
              <select
                id="select-slot-duration"
                className="select w-44"
                value={form.appointmentSlotMin}
                onChange={e => update('appointmentSlotMin', Number(e.target.value))}
              >
                <option value={15}>15 minutos</option>
                <option value={20}>20 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={45}>45 minutos</option>
                <option value={60}>60 minutos</option>
              </select>
              <p className="text-xs text-dark-500 mt-1.5">
                Configurado actualmente a: <strong className="text-gold-400">{form.appointmentSlotMin} min</strong> por turno.
              </p>
            </div>

            <div className="divider" />

            <div className="p-4 rounded-xl bg-dark-700/40 border border-dark-600 space-y-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Clock className="text-gold-400" size={16} />
                ¿Cómo ampliar o cambiar los horarios de cada barbero?
              </h3>
              <p className="text-xs text-dark-400 leading-relaxed">
                Cada barbero o estilista posee su propio horario flexible. Puedes activar turnos desde las <strong className="text-white">06:00 AM</strong> en la mañana hasta las <strong className="text-white">11:00 PM</strong> en la noche, seleccionar turnos rápidos (Mañana, Tarde, Noche, Día Completo, Ampliado) y copiar el horario a toda la semana con un solo clic.
              </p>
              <Link href="/barbers" className="btn-primary btn-sm inline-flex items-center gap-2 mt-1">
                Ir a Módulo de Barberos & Horarios <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Servicios ── */}
      {tab === 'services' && <ServicesManager />}

      {/* ── TAB: Categorías de gastos ── */}
      {tab === 'expenses' && <ExpenseCategoriesManager />}
    </div>
  )
}

// ─── Componente: gestión completa de servicios ───────────────────────────────
function ServicesManager() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [editSvc, setEditSvc] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

  const load = async () => {
    setLoading(true)
    const data = await fetch('/api/services?includeInactive=true').then(r => r.json())
    setServices(Array.isArray(data) ? data : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const toggleActive = async (svc) => {
    await fetch(`/api/services/${svc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !svc.isActive }),
    })
    toast.success(svc.isActive ? 'Servicio desactivado' : 'Servicio activado')
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-dark-400 text-sm">Todos los servicios son editables. Cambia nombre, precio y duración en cualquier momento.</p>
        <button id="btn-new-service" onClick={() => { setEditSvc(null); setShowModal(true) }} className="btn-primary">
          <Scissors size={14} /> Nuevo servicio
        </button>
      </div>
      <div className="table-container">
        <table className="table">
          <thead><tr><th>Servicio</th><th>Precio</th><th>Duración</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="text-center py-8 text-dark-500">Cargando...</td></tr> :
              services.map(s => (
                <tr key={s.id} className={!s.isActive ? 'opacity-50' : ''}>
                  <td>
                    <div className="font-medium text-white">{s.name}</div>
                    {s.description && <div className="text-xs text-dark-500 mt-0.5 max-w-xs line-clamp-1">{s.description}</div>}
                  </td>
                  <td className="text-gold-400 font-semibold">{fmt(s.price)}</td>
                  <td className="text-dark-400">{s.durationMinutes} min</td>
                  <td><span className={s.isActive ? 'badge badge-green' : 'badge badge-gray'}>{s.isActive ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    <div className="flex gap-2">
                      <button id={`btn-edit-svc-${s.id}`} onClick={() => { setEditSvc(s); setShowModal(true) }} className="btn-secondary btn-sm">Editar</button>
                      <button onClick={() => toggleActive(s)} className={`btn-sm ${s.isActive ? 'btn-danger' : 'btn-success'}`}>
                        {s.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
      {showModal && <ServiceModal service={editSvc} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />}
    </div>
  )
}

function ServiceModal({ service, onClose, onSave }) {
  const [form, setForm] = useState(service || { name: '', description: '', price: '', durationMinutes: 30 })
  const [loading, setLoading] = useState(false)
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const url = service ? `/api/services/${service.id}` : '/api/services'
    const res = await fetch(url, { method: service ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, price: Number(form.price), durationMinutes: Number(form.durationMinutes) }) })
    setLoading(false)
    if (res.ok) { toast.success(service ? 'Servicio actualizado' : 'Servicio creado'); onSave() }
    else { const d = await res.json(); toast.error(d.error || 'Error') }
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><h3 className="section-title">{service ? 'Editar Servicio' : 'Nuevo Servicio'}</h3><button onClick={onClose} className="btn-ghost p-2">✕</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div><label className="input-label">Nombre *</label><input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required /></div>
            <div><label className="input-label">Descripción</label><textarea className="input resize-none" rows={2} value={form.description || ''} onChange={e => setForm(f => ({...f, description: e.target.value}))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="input-label">Precio (COP) *</label><input type="number" min="0" className="input" value={form.price} onChange={e => setForm(f => ({...f, price: e.target.value}))} required /></div>
              <div><label className="input-label">Duración (min) *</label><input type="number" min="5" className="input" value={form.durationMinutes} onChange={e => setForm(f => ({...f, durationMinutes: e.target.value}))} required /></div>
            </div>
          </div>
          <div className="modal-footer"><button type="button" onClick={onClose} className="btn-secondary">Cancelar</button><button type="submit" disabled={loading} className="btn-primary">{loading ? 'Guardando...' : 'Guardar'}</button></div>
        </form>
      </div>
    </div>
  )
}

// ─── Componente: gestión de categorías de gastos ─────────────────────────────
function ExpenseCategoriesManager() {
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  const load = async () => {
    setLoading(true)
    const data = await fetch('/api/expenses/categories').then(r => r.json())
    setCats(data.categories || data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    const res = await fetch('/api/expenses/categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim() }),
    })
    setAdding(false)
    if (res.ok) { toast.success('Categoría creada'); setNewName(''); load() }
    else { const d = await res.json(); toast.error(d.error || 'Error') }
  }

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-dark-400 text-sm">Agrega, elimina o renombra las categorías de gastos. Estas aparecen al registrar un gasto en el módulo de Finanzas.</p>
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          id="input-new-category"
          className="input flex-1"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Nueva categoría (ej: Papelería)"
        />
        <button type="submit" disabled={adding || !newName.trim()} className="btn-primary">
          {adding ? '...' : 'Agregar'}
        </button>
      </form>
      <div className="card divide-y divide-dark-700">
        {loading ? <p className="text-dark-500 text-sm py-4 text-center">Cargando...</p> :
          cats.length === 0 ? <p className="text-dark-500 text-sm py-4 text-center">Sin categorías</p> :
          cats.map(c => (
            <div key={c.id} className="flex items-center justify-between py-3 px-1">
              <span className="text-white text-sm">{c.name}</span>
              <span className="text-xs text-dark-500">{c._count?.expenses ?? 0} gastos</span>
            </div>
          ))
        }
      </div>
    </div>
  )
}
