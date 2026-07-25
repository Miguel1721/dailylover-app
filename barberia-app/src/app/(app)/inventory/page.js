'use client'
import { useState, useEffect } from 'react'
import { Package, Plus, AlertTriangle, TrendingUp, TrendingDown, RefreshCw, Edit2, Search } from 'lucide-react'
import toast from 'react-hot-toast'

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

export default function InventoryPage() {
  const [products, setProducts] = useState([])
  const [summary, setSummary] = useState({ total: 0, lowStockCount: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [showMovementModal, setShowMovementModal] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [movementProduct, setMovementProduct] = useState(null)

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (lowStockOnly) params.append('lowStockOnly', 'true')
    const data = await fetch(`/api/inventory?${params}`).then(r => r.json())
    setProducts(data.products || [])
    setSummary(data.summary || {})
    setLoading(false)
  }

  useEffect(() => { load() }, [lowStockOnly])

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalValue = products.reduce((s, p) => s + p.salePrice * p.stock, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Package className="text-gold-400" size={28} />
            Inventario
          </h1>
          <p className="page-subtitle">Control de productos y stock</p>
        </div>
        <button id="btn-new-product" onClick={() => { setEditProduct(null); setShowProductModal(true) }} className="btn-primary">
          <Plus size={16} /> Nuevo Producto
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>
            <Package size={22} className="text-blue-400" />
          </div>
          <div>
            <div className="kpi-value">{summary.total || 0}</div>
            <div className="kpi-label">Productos</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>
            <AlertTriangle size={22} className="text-red-400" />
          </div>
          <div>
            <div className="kpi-value text-red-400">{summary.lowStockCount || 0}</div>
            <div className="kpi-label">Stock bajo</div>
          </div>
        </div>
        <div className="kpi-card col-span-2">
          <div className="kpi-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <TrendingUp size={22} className="text-gold-400" />
          </div>
          <div>
            <div className="kpi-value">{fmt(totalValue)}</div>
            <div className="kpi-label">Valor total en stock (precio venta)</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="input pl-9"
            id="search-product"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${lowStockOnly ? 'bg-gold-500' : 'bg-dark-600'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${lowStockOnly ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm text-dark-400">Solo stock bajo</span>
        </label>
        <button onClick={load} className="btn-ghost p-2"><RefreshCw size={16} /></button>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Precio Costo</th>
              <th>Precio Venta</th>
              <th>Stock</th>
              <th>Stock Mín</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-dark-500">Cargando inventario...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-dark-500">
                <Package size={32} className="mx-auto mb-2 opacity-30" />
                Sin productos registrados
              </td></tr>
            ) : (
              filtered.map(p => (
                <tr key={p.id} className={p.lowStock ? 'bg-red-950/10' : ''}>
                  <td>
                    <div className="font-medium text-white">{p.name}</div>
                    {p.description && <div className="text-xs text-dark-500 mt-0.5 max-w-xs truncate">{p.description}</div>}
                  </td>
                  <td className="text-dark-400">{fmt(p.costPrice)}</td>
                  <td className="font-semibold text-gold-400">{fmt(p.salePrice)}</td>
                  <td>
                    <span className={`font-bold ${p.stock <= 0 ? 'text-red-400' : p.lowStock ? 'text-yellow-400' : 'text-white'}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="text-dark-500">{p.minStock}</td>
                  <td>
                    {p.stock <= 0 ? (
                      <span className="badge badge-red">Sin stock</span>
                    ) : p.lowStock ? (
                      <span className="badge" style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)' }}>
                        <AlertTriangle size={10} /> Stock bajo
                      </span>
                    ) : (
                      <span className="badge badge-green">OK</span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        id={`btn-movement-${p.id}`}
                        onClick={() => { setMovementProduct(p); setShowMovementModal(true) }}
                        className="btn-secondary btn-sm"
                        title="Ajustar stock"
                      >
                        <RefreshCw size={12} /> Stock
                      </button>
                      <button
                        id={`btn-edit-${p.id}`}
                        onClick={() => { setEditProduct(p); setShowProductModal(true) }}
                        className="btn-ghost btn-sm"
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showProductModal && (
        <ProductModal
          product={editProduct}
          onClose={() => setShowProductModal(false)}
          onSave={() => { setShowProductModal(false); load() }}
        />
      )}
      {showMovementModal && movementProduct && (
        <MovementModal
          product={movementProduct}
          onClose={() => setShowMovementModal(false)}
          onSave={() => { setShowMovementModal(false); load() }}
        />
      )}
    </div>
  )
}

function ProductModal({ product, onClose, onSave }) {
  const [form, setForm] = useState(product ? {
    name: product.name, description: product.description || '', costPrice: product.costPrice,
    salePrice: product.salePrice, minStock: product.minStock, photoUrl: product.photoUrl || '',
  } : { name: '', description: '', costPrice: '', salePrice: '', stock: '', minStock: 5, photoUrl: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const url = product ? `/api/inventory/${product.id}` : '/api/inventory'
    const method = product ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) { toast.success(product ? 'Producto actualizado' : 'Producto creado'); onSave() }
    else { const d = await res.json(); toast.error(d.error || 'Error al guardar') }
  }

  const margin = form.salePrice && form.costPrice
    ? (((form.salePrice - form.costPrice) / form.salePrice) * 100).toFixed(1)
    : null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="section-title">{product ? 'Editar Producto' : 'Nuevo Producto'}</h3>
          <button onClick={onClose} className="btn-ghost p-2">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div>
              <label className="input-label">Nombre *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required placeholder="Ej: Pomada fijadora" />
            </div>
            <div>
              <label className="input-label">Descripción</label>
              <input className="input" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Descripción breve" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Precio Costo *</label>
                <input type="number" min="0" className="input" value={form.costPrice} onChange={e => setForm(f => ({...f, costPrice: Number(e.target.value)}))} required placeholder="0" />
              </div>
              <div>
                <label className="input-label">Precio Venta *</label>
                <input type="number" min="0" className="input" value={form.salePrice} onChange={e => setForm(f => ({...f, salePrice: Number(e.target.value)}))} required placeholder="0" />
                {margin && <p className="text-xs text-emerald-400 mt-1">Margen: {margin}%</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {!product && (
                <div>
                  <label className="input-label">Stock inicial</label>
                  <input type="number" min="0" className="input" value={form.stock} onChange={e => setForm(f => ({...f, stock: Number(e.target.value)}))} placeholder="0" />
                </div>
              )}
              <div>
                <label className="input-label">Stock mínimo</label>
                <input type="number" min="0" className="input" value={form.minStock} onChange={e => setForm(f => ({...f, minStock: Number(e.target.value)}))} placeholder="5" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MovementModal({ product, onClose, onSave }) {
  const [form, setForm] = useState({ type: 'IN', quantity: '', reason: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.quantity || form.quantity <= 0) { toast.error('Ingresa una cantidad válida'); return }
    setLoading(true)
    const res = await fetch(`/api/inventory/${product.id}/movement`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, quantity: Number(form.quantity) }),
    })
    setLoading(false)
    if (res.ok) { toast.success('Movimiento registrado'); onSave() }
    else { const d = await res.json(); toast.error(d.error || 'Error') }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h3 className="section-title">Ajuste de Stock</h3>
            <p className="text-dark-500 text-sm mt-0.5">{product.name} — Stock actual: <strong className="text-white">{product.stock}</strong></p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div>
              <label className="input-label">Tipo de movimiento</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 'IN', label: 'Entrada', icon: TrendingUp, cls: 'text-emerald-400 border-emerald-800 bg-emerald-900/20' },
                  { val: 'OUT', label: 'Salida', icon: TrendingDown, cls: 'text-red-400 border-red-800 bg-red-900/20' },
                  { val: 'ADJUSTMENT', label: 'Ajuste', icon: RefreshCw, cls: 'text-blue-400 border-blue-800 bg-blue-900/20' },
                ].map(({ val, label, icon: Icon, cls }) => (
                  <button key={val} type="button" onClick={() => setForm(f => ({...f, type: val}))}
                          className={`p-3 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 transition-all ${form.type === val ? cls : 'border-dark-600 text-dark-500 hover:border-dark-500'}`}>
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
              {form.type === 'ADJUSTMENT' && <p className="text-xs text-blue-400 mt-2">El ajuste establece el stock al valor exacto ingresado.</p>}
            </div>
            <div>
              <label className="input-label">Cantidad *</label>
              <input type="number" min="1" className="input" value={form.quantity} onChange={e => setForm(f => ({...f, quantity: e.target.value}))} required placeholder="0" autoFocus />
            </div>
            <div>
              <label className="input-label">Motivo</label>
              <input className="input" value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))} placeholder="Ej: Compra proveedor, daño, etc." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
