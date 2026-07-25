'use client'
import { useState, useEffect } from 'react'
import {
  Building2, Plus, Users, Scissors, ShoppingBag, Calendar,
  ExternalLink, ShieldCheck, CheckCircle2, XCircle, Search, Power
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function SuperAdminPage() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal nueva barbería
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    slug: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  })

  const fetchTenants = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/superadmin/tenants')
      if (res.ok) {
        const data = await res.json()
        setTenants(Array.isArray(data) ? data : [])
      } else {
        toast.error('No se pudieron cargar las barberías')
      }
    } catch (e) {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTenants()
  }, [])

  const handleNameChange = (val) => {
    const autoSlug = val.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    setForm((prev) => ({
      ...prev,
      name: val,
      slug: autoSlug,
    }))
  }

  const handleCreateTenant = async (e) => {
    e.preventDefault()
    if (!form.name || !form.slug || !form.adminName || !form.adminEmail || !form.adminPassword) {
      toast.error('Completa todos los campos requeridos')
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch('/api/superadmin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Barbería "${data.tenant.name}" creada exitosamente`)
        setShowModal(false)
        setForm({ name: '', slug: '', adminName: '', adminEmail: '', adminPassword: '' })
        fetchTenants()
      } else {
        toast.error(data.error || 'Error al crear la barbería')
      }
    } catch {
      toast.error('Error al enviar solicitud')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (tenant) => {
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !tenant.isActive }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Barbería ${tenant.name} ${!tenant.isActive ? 'activada' : 'desactivada'}`)
        fetchTenants()
      } else {
        toast.error(data.error || 'Error al cambiar estado')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      (t.users[0]?.email || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalTenants = tenants.length
  const activeTenants = tenants.filter((t) => t.isActive).length
  const totalBarbers = tenants.reduce((acc, t) => acc + (t._count?.barbers || 0), 0)
  const totalSales = tenants.reduce((acc, t) => acc + (t._count?.sales || 0), 0)

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ShieldCheck className="text-gold-400" size={28} />
            Super Administrador - Sistema Multi-Tenant
          </h1>
          <p className="page-subtitle">
            Gestiona e independiza usuarios, cuentas y accesos para cada barbería registrada.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary gap-2 self-start sm:self-auto"
        >
          <Plus size={18} />
          Crear Nueva Barbería
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="kpi-icon bg-gold-500/10 text-gold-400">
            <Building2 size={22} />
          </div>
          <div>
            <div className="kpi-label">Total Barberías</div>
            <div className="kpi-value">{totalTenants}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="kpi-label">Barberías Activas</div>
            <div className="kpi-value">{activeTenants}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon bg-blue-500/10 text-blue-400">
            <Scissors size={22} />
          </div>
          <div>
            <div className="kpi-label">Total Barberos Registrados</div>
            <div className="kpi-value">{totalBarbers}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon bg-amber-500/10 text-amber-400">
            <ShoppingBag size={22} />
          </div>
          <div>
            <div className="kpi-label">Ventas Registradas</div>
            <div className="kpi-value">{totalSales}</div>
          </div>
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA */}
      <div className="card p-4">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-3.5 text-dark-400" />
          <input
            type="text"
            placeholder="Buscar por nombre de barbería, enlace/slug o correo admin..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* TABLA DE BARBERÍAS */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Barbería / Tenant</th>
                <th>Administrador</th>
                <th>Estadísticas</th>
                <th>Estado</th>
                <th>Catálogo Público</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-dark-400">
                    <div className="inline-block w-8 h-8 rounded-full border-2 border-gold-500 border-t-transparent animate-spin mb-2" />
                    <p className="text-sm">Cargando cuentas...</p>
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-dark-400">
                    No se encontraron barberías registradas.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="font-bold text-white text-base">{t.name}</div>
                      <div className="text-xs text-gold-400 font-mono">/b/{t.slug}</div>
                    </td>
                    <td>
                      <div className="text-sm font-medium text-white">{t.users[0]?.name || 'Admin'}</div>
                      <div className="text-xs text-dark-400">{t.users[0]?.email || 'N/A'}</div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="badge badge-gray gap-1">
                          <Users size={12} /> {t._count?.users || 0} usuarios
                        </span>
                        <span className="badge badge-gold gap-1">
                          <Scissors size={12} /> {t._count?.barbers || 0} barberos
                        </span>
                        <span className="badge badge-green gap-1">
                          <ShoppingBag size={12} /> {t._count?.sales || 0} ventas
                        </span>
                      </div>
                    </td>
                    <td>
                      {t.isActive ? (
                        <span className="badge badge-green gap-1">
                          <CheckCircle2 size={12} /> Activo
                        </span>
                      ) : (
                        <span className="badge badge-red gap-1">
                          <XCircle size={12} /> Inactivo
                        </span>
                      )}
                    </td>
                    <td>
                      <a
                        href={`/b/${t.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost btn-sm gap-1 text-gold-400 hover:text-gold-300"
                      >
                        <ExternalLink size={14} /> Ver Tienda
                      </a>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleToggleStatus(t)}
                        className={`btn btn-sm ${t.isActive ? 'btn-danger' : 'btn-success'} gap-1`}
                        title={t.isActive ? 'Suspender barbería' : 'Activar barbería'}
                      >
                        <Power size={14} />
                        {t.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CREAR BARBERÍA */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal max-w-lg">
            <div className="modal-header">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 size={20} className="text-gold-400" />
                Registrar Nueva Barbería (Inquilino)
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-dark-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTenant}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="input-label">Nombre de la Barbería *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Barbería El Rey"
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="input-label">Enlace Personalizado (Slug) *</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-dark-400 font-mono">domain.com/b/</span>
                    <input
                      type="text"
                      required
                      placeholder="barberia-el-rey"
                      value={form.slug}
                      onChange={(e) => setForm({ ...form, slug: e.target.value })}
                      className="input font-mono"
                    />
                  </div>
                </div>

                <div className="border-t border-dark-800 pt-4 space-y-4">
                  <h4 className="text-xs font-bold text-gold-400 uppercase tracking-wider">
                    Datos del Administrador de la Barbería
                  </h4>

                  <div>
                    <label className="input-label">Nombre del Administrador *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Carlos Mendoza"
                      value={form.adminName}
                      onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="input-label">Correo Electrónico (Login) *</label>
                    <input
                      type="email"
                      required
                      placeholder="admin@barberiaelrey.com"
                      value={form.adminEmail}
                      onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="input-label">Contraseña Inicial *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={form.adminPassword}
                      onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-ghost"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary gap-2"
                >
                  {submitting ? (
                    <div className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  ) : (
                    <>
                      <Plus size={16} /> Crear Barbería
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
