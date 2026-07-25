'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ShoppingCart, Plus, Minus, Trash2, Receipt, User, Scissors, Package, CreditCard, Banknote, Smartphone, X, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const PAYMENT_ICONS = { CASH: Banknote, NEQUI: Smartphone, TRANSFER: CreditCard, CARD: CreditCard }
const PAYMENT_LABELS = { CASH: 'Efectivo', NEQUI: 'Nequi', TRANSFER: 'Transferencia', CARD: 'Tarjeta' }

function POSContent() {
  const searchParams = useSearchParams()
  const appointmentId = searchParams.get('appointmentId')

  const [barbers, setBarbers] = useState([])
  const [services, setServices] = useState([])
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [selectedBarber, setSelectedBarber] = useState('')
  const [clientName, setClientName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [paidAmount, setPaidAmount] = useState('')
  const [discount, setDiscount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [tab, setTab] = useState('services')
  const [serviceCategory, setServiceCategory] = useState('ALL') // 'ALL' | 'BARBERIA' | 'PELUQUERIA'
  const [activeMobileView, setActiveMobileView] = useState('catalog')

  useEffect(() => {
    Promise.all([
      fetch('/api/barbers').then(r => r.json()),
      fetch('/api/services').then(r => r.json()),
      fetch('/api/inventory').then(r => r.json()),
    ]).then(([b, s, inv]) => {
      setBarbers(Array.isArray(b) ? b : [])
      setServices(Array.isArray(s) ? s : [])
      setProducts(inv.products || [])
    })

    // If coming from appointment, load its data
    if (appointmentId) {
      fetch(`/api/appointments/${appointmentId}`).then(r => r.json()).then(apt => {
        if (apt) {
          setClientName(apt.clientName || '')
          setSelectedBarber(apt.barberId || '')
          const serviceItems = (apt.services || []).map(s => ({
            id: `svc-${s.service.id}`,
            type: 'service',
            itemId: s.service.id,
            name: s.service.name,
            price: s.service.price,
            qty: 1,
          }))
          setCart(serviceItems)
        }
      })
    }
  }, [appointmentId])

  const addService = (svc) => {
    const existing = cart.find(i => i.id === `svc-${svc.id}`)
    if (existing) {
      setCart(cart.map(i => i.id === existing.id ? {...i, qty: i.qty + 1} : i))
    } else {
      setCart([...cart, { id: `svc-${svc.id}`, type: 'service', itemId: svc.id, name: svc.name, price: svc.price, qty: 1 }])
    }
  }

  const addProduct = (prod) => {
    if (prod.stock <= 0) { toast.error('Sin stock disponible'); return }
    const existing = cart.find(i => i.id === `prd-${prod.id}`)
    if (existing) {
      if (existing.qty >= prod.stock) { toast.error('Sin más stock'); return }
      setCart(cart.map(i => i.id === existing.id ? {...i, qty: i.qty + 1} : i))
    } else {
      setCart([...cart, { id: `prd-${prod.id}`, type: 'product', itemId: prod.id, name: prod.name, price: prod.salePrice, qty: 1 }])
    }
  }

  const updateQty = (id, delta) => {
    setCart(cart.map(i => i.id === id ? {...i, qty: Math.max(1, i.qty + delta)} : i))
  }
  const removeItem = (id) => setCart(cart.filter(i => i.id !== id))

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0)
  const discountAmount = Math.min(discount, subtotal)
  const total = subtotal - discountAmount
  const serviceTotal = cart.filter(i => i.type === 'service').reduce((s, i) => s + i.price * i.qty, 0)
  const commission = serviceTotal * 0.60

  const handleCheckout = async () => {
    if (!selectedBarber) { toast.error('Selecciona un barbero / estilista'); return }
    if (cart.length === 0) { toast.error('Agrega al menos un servicio o producto'); return }

    setLoading(true)
    const body = {
      barberId: selectedBarber,
      clientName: clientName || 'Cliente',
      paymentMethod,
      discount: discountAmount,
      appointmentId: appointmentId || undefined,
      items: cart.map(i => ({
        itemType: i.type === 'service' ? 'SERVICE' : 'PRODUCT',
        serviceId: i.type === 'service' ? i.itemId : undefined,
        productId: i.type === 'product' ? i.itemId : undefined,
        quantity: i.qty,
        unitPrice: i.price,
      })),
    }

    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      const saleData = data.sale || data
      const pAmt = paymentMethod === 'CASH' ? (Number(paidAmount) || total) : total
      const chg = paymentMethod === 'CASH' ? Math.max(0, pAmt - total) : 0
      setReceipt({ ...saleData, paidAmount: pAmt, change: chg })
      setCart([])
      setClientName('')
      setDiscount(0)
      setPaidAmount('')
      toast.success('Venta registrada exitosamente')
    } else {
      toast.error(data.error || 'Error al procesar la venta')
    }
  }

  if (receipt) {
    return <ReceiptView receipt={receipt} onNew={() => setReceipt(null)} />
  }

  const filteredServices = services.filter(s => {
    if (serviceCategory === 'ALL') return true
    return (s.category || 'BARBERIA') === serviceCategory
  })

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] -m-6 p-6 min-h-0">
      {/* ── Mobile tabs (only on small screens) ── */}
      <div className="flex lg:hidden bg-dark-900 p-1.5 rounded-xl border border-dark-700 gap-1 mb-3 shrink-0">
        <button
          onClick={() => setActiveMobileView('catalog')}
          className={`flex-1 py-2.5 text-center text-sm font-semibold rounded-lg transition-all ${activeMobileView === 'catalog' ? 'bg-gold-500 text-dark-950 shadow' : 'text-dark-500 hover:text-white'}`}
        >
          🏷️ Catálogo
        </button>
        <button
          onClick={() => setActiveMobileView('summary')}
          className={`flex-1 py-2.5 text-center text-sm font-semibold rounded-lg transition-all relative ${activeMobileView === 'summary' ? 'bg-gold-500 text-dark-950 shadow' : 'text-dark-500 hover:text-white'}`}
        >
          🛒 Resumen
          {cart.length > 0 && (
            <span className="absolute top-1.5 right-4 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {cart.reduce((sum, item) => sum + item.qty, 0)}
            </span>
          )}
        </button>
      </div>

      {/* ── Two-column body — each column scrolls independently ── */}
      <div className="flex flex-1 gap-6 min-h-0">

        {/* LEFT: Catalog (scrolls) */}
        <div className={`lg:flex flex-col flex-1 min-h-0 ${activeMobileView === 'catalog' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-1 min-h-0">
            {/* ── POS Header ── */}
            <div className="flex items-center justify-between pb-1">
              <div>
                <h1 className="page-title flex items-center gap-2">
                  <ShoppingCart className="text-gold-400" size={28} />
                  Punto de Venta
                </h1>
                <p className="page-subtitle">
                  {appointmentId ? '📅 Cobrando cita agendada' : 'Nueva venta directa'}
                </p>
              </div>
            </div>
            {/* Barber + Client */}
            <div className="card grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Profesional (Barbero / Estilista) *</label>
                <select id="pos-barber" value={selectedBarber} onChange={e => setSelectedBarber(e.target.value)} className="select">
                  <option value="">Seleccionar profesional</option>
                  {barbers.map(b => <option key={b.id} value={b.id}>{b.name} ({b.specialty})</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Cliente</label>
                <input id="pos-client" value={clientName} onChange={e => setClientName(e.target.value)} className="input" placeholder="Nombre del cliente" />
              </div>
            </div>

            {/* Tab switch */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-2">
                <button id="tab-services" onClick={() => setTab('services')} className={`btn ${tab === 'services' ? 'btn-primary' : 'btn-secondary'}`}>
                  <Scissors size={16} /> Servicios
                </button>
                <button id="tab-products" onClick={() => setTab('products')} className={`btn ${tab === 'products' ? 'btn-primary' : 'btn-secondary'}`}>
                  <Package size={16} /> Productos
                </button>
              </div>

              {tab === 'services' && (
                <div className="flex gap-1 bg-dark-900 p-1 rounded-xl border border-dark-700 text-xs">
                  <button
                    onClick={() => setServiceCategory('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${serviceCategory === 'ALL' ? 'bg-gold-500 text-black shadow' : 'text-dark-400 hover:text-white'}`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setServiceCategory('BARBERIA')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${serviceCategory === 'BARBERIA' ? 'bg-gold-500 text-black shadow' : 'text-dark-400 hover:text-white'}`}
                  >
                    💈 Barbería
                  </button>
                  <button
                    onClick={() => setServiceCategory('PELUQUERIA')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${serviceCategory === 'PELUQUERIA' ? 'bg-purple-600 text-white shadow' : 'text-dark-400 hover:text-white'}`}
                  >
                    💅 Peluquería
                  </button>
                </div>
              )}
            </div>

            {/* Services grid */}
            {tab === 'services' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-2">
                {filteredServices.map(s => {
                  const isWomenSvc = (s.category || 'BARBERIA') === 'PELUQUERIA'
                  return (
                    <button key={s.id} id={`svc-${s.id}`} onClick={() => addService(s)}
                            className={`card !p-3.5 flex flex-col justify-between text-left transition-all active:scale-95 cursor-pointer min-h-[90px] ${
                              isWomenSvc ? 'hover:border-purple-500/50 hover:bg-purple-950/20' : 'hover:border-gold-700/50 hover:bg-dark-700'
                            }`}>
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-sm font-semibold text-white truncate">{s.name}</span>
                          {isWomenSvc && <Sparkles size={12} className="text-purple-400 shrink-0" />}
                        </div>
                        {s.description && <div className="text-[11px] text-dark-500 mb-2 line-clamp-1">{s.description}</div>}
                      </div>
                      <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-dark-700/50">
                        <span className={`price text-sm ${isWomenSvc ? 'text-purple-300' : ''}`}>{fmt(s.price)}</span>
                        <span className="text-[11px] text-dark-500 font-medium ml-1">{s.durationMinutes}min</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Products grid */}
            {tab === 'products' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-2">
                {products.map(p => (
                  <button key={p.id} id={`prd-${p.id}`} onClick={() => addProduct(p)} disabled={p.stock <= 0}
                          className={`card !p-3.5 flex flex-col justify-between text-left transition-all active:scale-95 cursor-pointer min-h-[80px] ${p.stock <= 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-gold-700/50 hover:bg-dark-700'}`}>
                    <div className="text-sm font-semibold text-white mb-1">{p.name}</div>
                    <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-dark-700/50">
                      <span className="price text-sm">{fmt(p.salePrice)}</span>
                      <span className={`text-[11px] font-medium ml-1 ${p.stock <= p.minStock ? 'text-red-400' : 'text-dark-500'}`}>
                        Stock: {p.stock}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Order Summary */}
        <div className={`lg:flex flex-col w-full lg:w-80 xl:w-96 shrink-0 min-h-0 ${activeMobileView === 'summary' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="card flex flex-col flex-1 min-h-0 overflow-hidden !p-4">
            <h2 className="section-title mb-2 flex items-center gap-1.5 shrink-0 text-sm">
              <Receipt size={16} className="text-gold-400" /> Resumen
            </h2>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-1 mb-4 min-h-[120px] pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-6 text-dark-600">
                  <ShoppingCart size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Agrega servicios o productos</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center gap-2 py-2 border-b border-dark-700">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${item.type === 'service' ? 'badge-gold' : 'badge-blue'}`}>
                      {item.type === 'service' ? 'S' : 'P'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{item.name}</div>
                      <div className="text-xs text-dark-500">{fmt(item.price)} c/u</div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded bg-dark-700 hover:bg-dark-600 flex items-center justify-center text-white">
                        <Minus size={12} />
                      </button>
                      <span className="w-6 text-center text-sm text-white">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded bg-dark-700 hover:bg-dark-600 flex items-center justify-center text-white">
                        <Plus size={12} />
                      </button>
                    </div>
                    <div className="text-sm font-semibold text-white w-20 text-right">{fmt(item.price * item.qty)}</div>
                    <button onClick={() => removeItem(item.id)} className="text-dark-500 hover:text-red-400 ml-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Fixed bottom */}
            <div className="shrink-0 space-y-2 border-t border-dark-700 pt-2">
              <div>
                <label className="input-label" style={{fontSize:'10px'}}>Descuento ($)</label>
                <input id="pos-discount" type="number" min="0" max={subtotal} value={discount}
                       onChange={e => setDiscount(Number(e.target.value))}
                       className="input !py-1.5 !text-sm" placeholder="0" />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-dark-500">Subtotal</span>
                  <span className="text-white">{fmt(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-red-400">Descuento</span>
                    <span className="text-red-400">-{fmt(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold border-t border-dark-700 pt-1.5">
                  <span className="text-white">TOTAL</span>
                  <span className="text-gold-400">{fmt(total)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-dark-500">Comisión (60%)</span>
                  <span className="text-emerald-400">{fmt(commission)}</span>
                </div>
              </div>

              <div>
                <label className="input-label" style={{fontSize:'10px'}}>Método de pago</label>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  {Object.entries(PAYMENT_LABELS).map(([key, label]) => {
                    const Icon = PAYMENT_ICONS[key]
                    return (
                      <button key={key} id={`pay-${key.toLowerCase()}`} type="button"
                              onClick={() => setPaymentMethod(key)}
                              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs transition-all ${paymentMethod === key ? 'border-gold-600 bg-gold-900/20 text-gold-400 font-semibold' : 'border-dark-600 text-dark-400 hover:border-dark-500'}`}>
                        <Icon size={13} />
                        {label}
                      </button>
                    )
                  })}
                </div>

                {paymentMethod === 'CASH' && (
                  <div className="space-y-1.5 p-2 rounded-lg bg-dark-800/80 border border-dark-600">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-dark-400 text-[11px] font-medium">Paga con ($)</span>
                      {Number(paidAmount) > 0 && (
                        <span className={`font-bold text-xs ${Number(paidAmount) >= total ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {Number(paidAmount) >= total ? `Vueltas: ${fmt(Number(paidAmount) - total)}` : `Faltan: ${fmt(total - Number(paidAmount))}`}
                        </span>
                      )}
                    </div>
                    <input
                      id="pos-paid-amount"
                      type="number"
                      min="0"
                      value={paidAmount}
                      onChange={e => setPaidAmount(e.target.value)}
                      className="input !py-1.5 !text-sm text-right font-bold text-emerald-400"
                      placeholder={total > 0 ? total.toString() : '0'}
                    />
                    <div className="flex gap-1 flex-wrap pt-0.5">
                      <button type="button" onClick={() => setPaidAmount(total.toString())} className="btn-ghost !py-0.5 !px-2 text-[10px] bg-dark-700 hover:bg-dark-600">
                        Exacto
                      </button>
                      {[20000, 50000, 100000].map(val => (
                        val >= total && (
                          <button key={val} type="button" onClick={() => setPaidAmount(val.toString())} className="btn-ghost !py-0.5 !px-2 text-[10px] bg-dark-700 hover:bg-dark-600">
                            {fmt(val)}
                          </button>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button id="btn-checkout" onClick={handleCheckout} disabled={loading || cart.length === 0 || !selectedBarber}
                      className="btn-primary w-full py-2.5 text-sm font-bold">
                {loading ? 'Procesando...' : `Cobrar ${fmt(total)}`}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function ReceiptView({ receipt, onNew }) {
  const { barber, clientName, paymentMethod, items, total, discount, commission, createdAt, paidAmount, change } = receipt
  return (
    <div className="max-w-md mx-auto">
      <div className="card text-center border-gold-800/50 bg-gradient-to-b from-dark-800 to-dark-900">
        <div className="w-16 h-16 rounded-full bg-emerald-900/40 border-2 border-emerald-600 flex items-center justify-center mx-auto mb-4">
          <Receipt size={28} className="text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">¡Venta exitosa!</h2>
        <p className="text-dark-500 text-sm mt-1">{new Date(createdAt).toLocaleString('es-CO')}</p>

        <div className="divider" />

        <div className="text-left space-y-2 mb-4">
          <div className="flex justify-between"><span className="text-dark-500">Cliente</span><span className="text-white">{clientName || 'Cliente'}</span></div>
          <div className="flex justify-between"><span className="text-dark-500">Profesional</span><span className="text-white">{barber?.name}</span></div>
          <div className="flex justify-between"><span className="text-dark-500">Método de Pago</span><span className="text-white font-medium">{PAYMENT_LABELS[paymentMethod]}</span></div>
          {paymentMethod === 'CASH' && paidAmount > 0 && (
            <>
              <div className="flex justify-between"><span className="text-dark-500">Paga con</span><span className="text-white font-medium">{fmt(paidAmount)}</span></div>
              <div className="flex justify-between font-bold text-base bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/40 mt-1">
                <span className="text-emerald-400">Vueltas / Cambio</span>
                <span className="text-emerald-400">{fmt(change || 0)}</span>
              </div>
            </>
          )}
        </div>

        <div className="bg-dark-700/50 rounded-xl p-4 mb-4">
          {items?.map((item, i) => (
            <div key={i} className="flex justify-between text-sm py-1">
              <span className="text-dark-400">{item.quantity}x {item.service?.name || item.product?.name}</span>
              <span className="text-white">{fmt(item.total)}</span>
            </div>
          ))}
          <div className="border-t border-dark-600 mt-2 pt-2 flex justify-between font-bold text-lg">
            <span className="text-white">TOTAL</span>
            <span className="price-large">{fmt(total)}</span>
          </div>
        </div>

        <div className="text-xs text-dark-500 mb-6">Comisión generada para {barber?.name}: {fmt(commission?.commissionAmount || 0)}</div>

        <button id="btn-new-sale" onClick={onNew} className="btn-primary w-full py-3">
          <ShoppingCart size={16} />
          Nueva Venta
        </button>
      </div>
    </div>
  )
}

export default function POSPage() {
  return (
    <Suspense fallback={<div className="text-dark-500">Cargando...</div>}>
      <POSContent />
    </Suspense>
  )
}
