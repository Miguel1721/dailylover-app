'use client'
import { useState, useEffect } from 'react'
import { DollarSign, CheckCircle, Clock, Users, ChevronDown, ChevronRight, Eye, Store, FileText, Ticket, Plus, Trash2, AlertCircle } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)

export default function CommissionsPage() {
  const now = new Date()
  const [filters, setFilters] = useState({
    barberId: 'all',
    startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
    isPaid: 'all',
  })
  const [data, setData] = useState({ commissions: [], advances: [], summary: {} })
  const [barbers, setBarbers] = useState([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [expandedBarber, setExpandedBarber] = useState(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [payTarget, setPayTarget] = useState(null) // { barberId?, label, amount, netAmount, pendingAdvances, body }
  const [detailModalBarber, setDetailModalBarber] = useState(null) // { barberId, barberName, summaryBarber }
  const [detailTab, setDetailTab] = useState('services') // 'services' | 'advances'

  // Modal para Registrar Vale
  const [showValeModal, setShowValeModal] = useState(false)
  const [valeForm, setValeForm] = useState({
    barberId: '',
    amount: '',
    reason: '',
    date: format(now, 'yyyy-MM-dd'),
  })
  const [savingVale, setSavingVale] = useState(false)

  useEffect(() => {
    fetch('/api/barbers').then(r => r.json()).then(setBarbers)
  }, [])

  useEffect(() => { load() }, [filters])

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.barberId !== 'all') params.append('barberId', filters.barberId)
    params.append('startDate', filters.startDate)
    params.append('endDate', filters.endDate)
    if (filters.isPaid !== 'all') params.append('isPaid', filters.isPaid === 'paid' ? 'true' : 'false')
    const res = await fetch(`/api/commissions?${params}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }

  const handlePay = async (body) => {
    setPaying(true)
    const res = await fetch('/api/commissions/pay', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setPaying(false)
    if (res.ok) {
      const respJson = await res.json()
      toast.success(respJson.message || 'Comisiones liquidadas exitosamente')
      load()
      setShowConfirmModal(false)
    } else {
      const d = await res.json()
      toast.error(d.error || 'Error al liquidar')
    }
  }

  const handleCreateVale = async (e) => {
    e.preventDefault()
    if (!valeForm.barberId) { toast.error('Selecciona un barbero'); return }
    if (!valeForm.amount || Number(valeForm.amount) <= 0) { toast.error('Ingresa un monto válido'); return }

    setSavingVale(true)
    const res = await fetch('/api/barbers/advances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(valeForm),
    })
    setSavingVale(false)

    if (res.ok) {
      toast.success('Vale registrado exitosamente')
      setShowValeModal(false)
      setValeForm({ barberId: '', amount: '', reason: '', date: format(new Date(), 'yyyy-MM-dd') })
      load()
    } else {
      const err = await res.json()
      toast.error(err.error || 'Error al registrar vale')
    }
  }

  const handleDeleteVale = async (advanceId) => {
    if (!confirm('¿Seguro que deseas anular este vale?')) return
    const res = await fetch(`/api/barbers/advances/${advanceId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Vale anulado correctamente')
      load()
    } else {
      const err = await res.json()
      toast.error(err.error || 'Error al anular vale')
    }
  }

  const openPayBarber = (barberSummary) => {
    setPayTarget({
      barberId: barberSummary.barberId,
      label: `${barberSummary.barberName}`,
      grossAmount: barberSummary.pending,
      advancesAmount: barberSummary.advancesPending || 0,
      netAmount: Math.max(0, barberSummary.pending - (barberSummary.advancesPending || 0)),
      body: { barberId: barberSummary.barberId, startDate: filters.startDate, endDate: filters.endDate },
    })
    setShowConfirmModal(true)
  }

  const openPayAll = () => {
    const gross = data.summary.totalPending || 0
    const advs = data.summary.totalPendingAdvances || 0
    const net = Math.max(0, gross - advs)
    setPayTarget({
      label: 'Todos los barberos',
      grossAmount: gross,
      advancesAmount: advs,
      netAmount: net,
      body: { startDate: filters.startDate, endDate: filters.endDate },
    })
    setShowConfirmModal(true)
  }

  const openDetailsModal = (barberSummary, initialTab = 'services') => {
    setDetailModalBarber(barberSummary)
    setDetailTab(initialTab)
  }

  const { summary } = data
  const totalServiceRev = summary.totalServiceRevenue || 0
  const barbershopRetained = summary.totalBarbershopRetained || Math.max(0, totalServiceRev - (summary.totalCommissions || 0))
  const displayNetPending = summary.netPendingToPay !== undefined ? summary.netPendingToPay : (summary.totalPending || 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <DollarSign className="text-gold-400" size={28} />
            Comisiones y Distribución
          </h1>
          <p className="page-subtitle">Liquidación de barberos (60%), descuento de vales y ganancia de barbería (40%)</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setValeForm(f => ({ ...f, barberId: barbers[0]?.id || '' }))
              setShowValeModal(true)
            }}
            className="btn-secondary !bg-gold-500/10 !text-gold-300 border border-gold-500/30 hover:!bg-gold-500/20"
          >
            <Ticket size={16} />
            Registrar Vale / Préstamo
          </button>
          {summary.totalPending > 0 && (
            <button id="btn-pay-all" onClick={openPayAll} className="btn-success">
              <CheckCircle size={16} />
              Liquidar todo ({fmt(displayNetPending)})
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-4 items-center">
        <div>
          <label className="input-label">Barbero</label>
          <select className="select w-48" value={filters.barberId} id="filter-barber"
                  onChange={e => setFilters(f => ({...f, barberId: e.target.value}))}>
            <option value="all">Todos los barberos</option>
            {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Desde</label>
          <input type="date" className="input w-36" value={filters.startDate}
                 onChange={e => setFilters(f => ({...f, startDate: e.target.value}))} />
        </div>
        <div>
          <label className="input-label">Hasta</label>
          <input type="date" className="input w-36" value={filters.endDate}
                 onChange={e => setFilters(f => ({...f, endDate: e.target.value}))} />
        </div>
        <div>
          <label className="input-label">Estado</label>
          <select className="select w-36" value={filters.isPaid}
                  onChange={e => setFilters(f => ({...f, isPaid: e.target.value}))}>
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="paid">Pagados</option>
          </select>
        </div>
        <div className="flex gap-2 ml-auto">
          {['Este mes', 'Esta semana', 'Hoy'].map((label, i) => {
            const ranges = [
              [format(startOfMonth(now), 'yyyy-MM-dd'), format(endOfMonth(now), 'yyyy-MM-dd')],
              [format(new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()), 'yyyy-MM-dd'), format(now, 'yyyy-MM-dd')],
              [format(now, 'yyyy-MM-dd'), format(now, 'yyyy-MM-dd')],
            ]
            return (
              <button key={label} onClick={() => setFilters(f => ({...f, startDate: ranges[i][0], endDate: ranges[i][1]}))}
                      className="btn-ghost text-xs px-3 py-1.5 border border-dark-600 rounded-lg">
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Resumen de la Barbería */}
      <div className="card bg-gradient-to-r from-dark-800 via-dark-700 to-dark-800 border-gold-500/20 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gold-400/15 flex items-center justify-center border border-gold-400/30">
            <Store size={22} className="text-gold-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Resumen de Barbería & Vales
              <span className="text-xs px-2 py-0.5 rounded-full bg-gold-400/20 text-gold-400 font-medium">
                Retención {summary.barbershopShareRate || 40}%
              </span>
            </h2>
            <p className="text-xs text-dark-400">Comisiones brutas, vales descontables y neto pendiente por entregar</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-dark-700/60">
          <div className="p-3.5 rounded-xl bg-dark-900/60 border border-dark-700">
            <div className="text-xs text-dark-400 font-medium mb-1">Total Servicios Brutos</div>
            <div className="text-xl font-bold text-white">{loading ? '...' : fmt(totalServiceRev)}</div>
            <div className="text-[11px] text-dark-500 mt-1">Ingreso de servicios</div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
            <div className="text-xs text-emerald-400 font-medium mb-1">Ganancia Barbería (40%)</div>
            <div className="text-xl font-bold text-emerald-400">{loading ? '...' : fmt(barbershopRetained)}</div>
            <div className="text-[11px] text-emerald-500/80 mt-1">Retenido por la barbería</div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30">
            <div className="text-xs text-amber-400 font-medium mb-1">Vales / Préstamos Pendientes</div>
            <div className="text-xl font-bold text-amber-400">{loading ? '...' : fmt(summary.totalPendingAdvances || 0)}</div>
            <div className="text-[11px] text-amber-500/80 mt-1">Por descontar en liquidación</div>
          </div>

          <div className="p-3.5 rounded-xl bg-gold-950/30 border border-gold-500/30">
            <div className="text-xs text-gold-400 font-medium mb-1">Neto Pendiente a Barberos</div>
            <div className="text-xl font-bold text-gold-400">{loading ? '...' : fmt(displayNetPending)}</div>
            <div className="text-[11px] text-dark-400 mt-1 flex justify-between">
              <span>Bruto: {fmt(summary.totalPending || 0)}</span>
              <span className="text-amber-400">Vales: -{fmt(summary.totalPendingAdvances || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs Rápidos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <DollarSign size={22} className="text-gold-400" />
          </div>
          <div>
            <div className="kpi-value">{fmt(summary.totalCommissions || 0)}</div>
            <div className="kpi-label">Comisión Total Barberos (60%)</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <Ticket size={22} className="text-amber-400" />
          </div>
          <div>
            <div className="kpi-value text-amber-400">{fmt(summary.totalPendingAdvances || 0)}</div>
            <div className="kpi-label">Vales Pendientes por Descontar</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>
            <CheckCircle size={22} className="text-emerald-400" />
          </div>
          <div>
            <div className="kpi-value text-emerald-400">{fmt(summary.totalPaid || 0)}</div>
            <div className="kpi-label">Liquidado / Pagado</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(234,179,8,0.15)' }}>
            <Clock size={22} className="text-yellow-400" />
          </div>
          <div>
            <div className="kpi-value text-yellow-400">{fmt(displayNetPending)}</div>
            <div className="kpi-label">Neto por Liquidar</div>
          </div>
        </div>
      </div>

      {/* By barber summary */}
      <div className="card">
        <h2 className="section-title mb-4">Resumen por Barbero</h2>
        <div className="space-y-3">
          {loading ? (
            [1,2,3].map(i => <div key={i} className="h-16 bg-dark-700 rounded-lg animate-pulse" />)
          ) : (summary.byBarber || []).length === 0 ? (
            <p className="text-dark-500 text-sm text-center py-6">Sin barberos en este período</p>
          ) : (
            (summary.byBarber || []).map(b => {
              const barberCommissions = data.commissions.filter(c => c.barber?.id === b.barberId || c.barberId === b.barberId)
              const isExpanded = expandedBarber === b.barberId
              return (
                <div key={b.barberId} className="border border-dark-700 rounded-xl overflow-hidden bg-dark-800/40">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-dark-700/30 transition-colors cursor-pointer"
                       onClick={() => setExpandedBarber(isExpanded ? null : b.barberId)}>
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="w-10 h-10 rounded-full bg-gold-600 flex items-center justify-center text-black font-bold flex-shrink-0">
                        {b.barberName[0]}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{b.barberName}</div>
                        <div className="text-xs text-dark-500">Servicios: {fmt(b.totalServices || (b.total ? b.total / 0.6 : 0))}</div>
                      </div>
                    </div>

                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div>
                        <div className="font-semibold text-gold-400">{fmt(b.total)}</div>
                        <div className="text-[11px] text-dark-500">Comisión 60%</div>
                      </div>
                      <div>
                        <div className={`font-semibold ${b.advancesPending > 0 ? 'text-amber-400 font-bold' : 'text-dark-500'}`}>
                          {fmt(b.advancesPending || 0)}
                        </div>
                        <div className="text-[11px] text-dark-500">Vales Pend.</div>
                      </div>
                      <div>
                        <div className="font-semibold text-emerald-400">{fmt(b.paid)}</div>
                        <div className="text-[11px] text-dark-500">Pagado</div>
                      </div>
                      <div>
                        <div className={`font-bold ${b.netPending > 0 ? 'text-yellow-400' : 'text-dark-500'}`}>
                          {fmt(b.netPending)}
                        </div>
                        <div className="text-[11px] text-dark-400 font-medium">Neto a Liquidar</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button type="button"
                              onClick={e => {
                                e.stopPropagation()
                                setValeForm(f => ({ ...f, barberId: b.barberId }))
                                setShowValeModal(true)
                              }}
                              className="btn-secondary !py-1 !px-2.5 text-xs text-amber-300 border-amber-800/40 bg-amber-950/20 hover:bg-amber-900/40">
                        + Vale
                      </button>

                      <button id={`btn-details-${b.barberId}`}
                              onClick={e => { e.stopPropagation(); openDetailsModal(b, 'services') }}
                              className="btn-secondary btn-sm flex items-center gap-1">
                        <Eye size={13} />
                        <span>Detalles</span>
                      </button>

                      {(b.pending > 0 || b.advancesPending > 0) && (
                        <button id={`btn-pay-${b.barberId}`}
                                onClick={e => { e.stopPropagation(); openPayBarber(b) }}
                                className="btn-success btn-sm font-bold">
                          Liquidar
                        </button>
                      )}

                      {isExpanded ? <ChevronDown size={16} className="text-dark-500" /> : <ChevronRight size={16} className="text-dark-500" />}
                    </div>
                  </div>

                  {/* Expandable detail quick table */}
                  {isExpanded && (
                    <div className="border-t border-dark-700 bg-dark-700/20 overflow-x-auto">
                      <table className="table text-xs">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Cliente</th>
                            <th>Servicio / Ítems</th>
                            <th>Total servicio</th>
                            <th>Comisión (60%)</th>
                            <th>Ganancia Barbería (40%)</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {barberCommissions.map(c => {
                            const serviceNames = c.sale?.items
                              ?.map(i => i.service?.name || i.product?.name)
                              .filter(Boolean)
                              .join(', ') || 'Servicio'
                            const barbershopPart = Math.max(0, (c.serviceTotal || 0) - c.commissionAmount)
                            return (
                              <tr key={c.id}>
                                <td>{c.createdAt ? format(new Date(c.createdAt), 'dd/MM/yy hh:mm a', { locale: es }) : '-'}</td>
                                <td className="font-medium text-white">{c.sale?.clientName || 'Cliente General'}</td>
                                <td className="text-dark-300 max-w-[180px] truncate">{serviceNames}</td>
                                <td>{fmt(c.serviceTotal)}</td>
                                <td className="text-gold-400 font-semibold">{fmt(c.commissionAmount)}</td>
                                <td className="text-emerald-400">{fmt(barbershopPart)}</td>
                                <td>
                                  {c.isPaid
                                    ? <span className="badge badge-green"><CheckCircle size={10} /> Pagado</span>
                                    : <span className="badge" style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)' }}><Clock size={10} /> Pendiente</span>
                                  }
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Modal para Registrar Vale / Préstamo */}
      {showValeModal && (
        <div className="modal-overlay p-4 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="modal w-full max-w-md bg-dark-800 border border-gold-800/40 rounded-2xl shadow-2xl overflow-hidden p-5">
            <div className="flex items-center justify-between pb-3 border-b border-dark-700 mb-4">
              <div className="flex items-center gap-2">
                <Ticket className="text-gold-400" size={22} />
                <h3 className="text-lg font-bold text-white">Registrar Vale / Préstamo</h3>
              </div>
              <button onClick={() => setShowValeModal(false)} className="text-dark-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateVale} className="space-y-4">
              <div>
                <label className="input-label">Barbero / Profesional *</label>
                <select
                  value={valeForm.barberId}
                  onChange={e => setValeForm(f => ({ ...f, barberId: e.target.value }))}
                  className="select w-full"
                  required
                >
                  <option value="">Seleccionar barbero</option>
                  {barbers.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.specialty})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label">Monto del Vale ($) *</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={valeForm.amount}
                  onChange={e => setValeForm(f => ({ ...f, amount: e.target.value }))}
                  className="input w-full font-bold text-gold-400 text-base"
                  placeholder="Ej. 50000"
                  required
                />
              </div>

              <div>
                <label className="input-label">Motivo / Observación</label>
                <input
                  type="text"
                  value={valeForm.reason}
                  onChange={e => setValeForm(f => ({ ...f, reason: e.target.value }))}
                  className="input w-full"
                  placeholder="Ej. Adelanto pasajes / personal"
                />
              </div>

              <div>
                <label className="input-label">Fecha</label>
                <input
                  type="date"
                  value={valeForm.date}
                  onChange={e => setValeForm(f => ({ ...f, date: e.target.value }))}
                  className="input w-full"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowValeModal(false)} className="btn-secondary flex-1 py-2.5">
                  Cancelar
                </button>
                <button type="submit" disabled={savingVale} className="btn-primary flex-1 py-2.5 font-bold">
                  {savingVale ? 'Guardando...' : 'Guardar Vale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Liquidación */}
      {showConfirmModal && payTarget && (
        <div className="modal-overlay p-4 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="modal w-full max-w-md bg-dark-800 border border-dark-700 rounded-2xl p-5 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle className="text-emerald-400" size={22} />
              Confirmar Liquidación
            </h3>
            <p className="text-sm text-dark-300">
              Vas a liquidar comisiones para <span className="font-semibold text-white">{payTarget.label}</span>.
            </p>

            <div className="p-3.5 rounded-xl bg-dark-900 border border-dark-700 space-y-2 text-xs">
              <div className="flex justify-between text-dark-300">
                <span>(+) Comisiones brutas (60%):</span>
                <span className="font-bold text-white">{fmt(payTarget.grossAmount)}</span>
              </div>

              {payTarget.advancesAmount > 0 && (
                <div className="flex justify-between text-amber-400 font-semibold border-t border-dark-800 pt-1">
                  <span>(-) Vales / Préstamos a descontar:</span>
                  <span>-{fmt(payTarget.advancesAmount)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-extrabold border-t border-dark-700 pt-2 text-emerald-400">
                <span>(=) TOTAL NETO A ENTREGAR:</span>
                <span>{fmt(payTarget.netAmount)}</span>
              </div>
            </div>

            <p className="text-xs text-dark-400">
              Al confirmar, las comisiones se marcarán como pagadas y los vales pendientes quedarán descontados.
            </p>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowConfirmModal(false)} className="btn-secondary flex-1 py-2.5">
                Cancelar
              </button>
              <button onClick={() => handlePay(payTarget.body)} disabled={paying} className="btn-success flex-1 py-2.5 font-bold">
                {paying ? 'Procesando...' : `Confirmar y Pagar ${fmt(payTarget.netAmount)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalles por Barbero (Servicios vs Vales) */}
      {detailModalBarber && (
        <div className="modal-overlay p-3 sm:p-6 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
             onClick={e => e.target === e.currentTarget && setDetailModalBarber(null)}>
          <div className="modal w-full max-w-3xl max-h-[90vh] flex flex-col bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header del Modal */}
            <div className="modal-header p-4 sm:p-5 border-b border-dark-700 flex items-center justify-between bg-dark-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold-500/20 border border-gold-500/40 flex items-center justify-center text-gold-400 font-bold">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Detalle de Barbero — {detailModalBarber.barberName}</h3>
                  <p className="text-xs text-dark-400">
                    Período: <span className="text-gold-400 font-medium">{filters.startDate}</span> al <span className="text-gold-400 font-medium">{filters.endDate}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setDetailModalBarber(null)} className="btn-ghost p-2 text-dark-400 hover:text-white rounded-lg">✕</button>
            </div>

            {/* Selector de Pestañas en el Modal */}
            <div className="flex border-b border-dark-700 bg-dark-900/60 px-4 pt-2 gap-2">
              <button
                onClick={() => setDetailTab('services')}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all ${
                  detailTab === 'services'
                    ? 'bg-dark-800 text-gold-400 border-t border-x border-dark-700'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                💈 Servicios Realizados ({data.commissions.filter(c => c.barber?.id === detailModalBarber.barberId || c.barberId === detailModalBarber.barberId).length})
              </button>
              <button
                onClick={() => setDetailTab('advances')}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all ${
                  detailTab === 'advances'
                    ? 'bg-dark-800 text-amber-400 border-t border-x border-dark-700'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                🎟️ Vales y Préstamos ({(detailModalBarber.advancesList || []).length})
              </button>
            </div>

            {/* Resumen dentro del Modal */}
            <div className="grid grid-cols-4 gap-2 p-3 sm:p-4 bg-dark-900/40 border-b border-dark-700 text-center">
              <div className="p-2 rounded-lg bg-dark-700/40 border border-dark-600/40">
                <div className="text-[10px] text-dark-400">Total Servicios</div>
                <div className="text-xs sm:text-sm font-bold text-white">{fmt(detailModalBarber.totalServices || (detailModalBarber.total ? detailModalBarber.total / 0.6 : 0))}</div>
              </div>
              <div className="p-2 rounded-lg bg-gold-950/30 border border-gold-500/30">
                <div className="text-[10px] text-gold-400">Comisión (60%)</div>
                <div className="text-xs sm:text-sm font-bold text-gold-400">{fmt(detailModalBarber.total)}</div>
              </div>
              <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-500/30">
                <div className="text-[10px] text-amber-400">Vales Pendientes</div>
                <div className="text-xs sm:text-sm font-bold text-amber-400">-{fmt(detailModalBarber.advancesPending || 0)}</div>
              </div>
              <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
                <div className="text-[10px] text-emerald-400">Neto Pendiente</div>
                <div className="text-xs sm:text-sm font-bold text-emerald-400">{fmt(detailModalBarber.netPending)}</div>
              </div>
            </div>

            {/* Cuerpo del Modal */}
            <div className="modal-body p-3 sm:p-5 overflow-y-auto flex-1 max-h-[50vh] no-scrollbar">
              {detailTab === 'services' && (() => {
                const list = data.commissions.filter(c => c.barber?.id === detailModalBarber.barberId || c.barberId === detailModalBarber.barberId)
                if (list.length === 0) {
                  return <p className="text-dark-500 text-sm text-center py-8">No hay servicios registrados para este barbero en el período.</p>
                }
                return (
                  <div className="overflow-x-auto">
                    <table className="table text-xs w-full">
                      <thead>
                        <tr className="text-dark-400 border-b border-dark-700">
                          <th>Día y Hora</th>
                          <th>Cliente</th>
                          <th>Servicios realizados</th>
                          <th>Monto</th>
                          <th>Barbero (60%)</th>
                          <th>Barbería (40%)</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-700/50">
                        {list.map(c => {
                          const dateStr = c.createdAt ? format(new Date(c.createdAt), "EEE d MMM, hh:mm a", { locale: es }) : '-'
                          const serviceNames = c.sale?.items
                            ?.map(i => i.service?.name || i.product?.name)
                            .filter(Boolean)
                            .join(', ') || 'Servicios'
                          const barbershopPart = Math.max(0, (c.serviceTotal || 0) - c.commissionAmount)

                          return (
                            <tr key={c.id} className="hover:bg-dark-700/30">
                              <td className="text-dark-300 font-medium capitalize">{dateStr}</td>
                              <td className="font-semibold text-white">{c.sale?.clientName || 'Cliente General'}</td>
                              <td className="text-dark-300 max-w-[160px] truncate" title={serviceNames}>{serviceNames}</td>
                              <td className="font-medium text-white">{fmt(c.serviceTotal)}</td>
                              <td className="text-gold-400 font-semibold">{fmt(c.commissionAmount)}</td>
                              <td className="text-emerald-400 font-medium">{fmt(barbershopPart)}</td>
                              <td>
                                {c.isPaid
                                  ? <span className="badge badge-green"><CheckCircle size={10} /> Pagado</span>
                                  : <span className="badge" style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)' }}><Clock size={10} /> Pendiente</span>
                                }
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })()}

              {detailTab === 'advances' && (() => {
                const advList = detailModalBarber.advancesList || []
                if (advList.length === 0) {
                  return (
                    <div className="text-center py-8 text-dark-500">
                      <Ticket size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">El barbero no tiene vales registrados.</p>
                    </div>
                  )
                }
                return (
                  <div className="overflow-x-auto">
                    <table className="table text-xs w-full">
                      <thead>
                        <tr className="text-dark-400 border-b border-dark-700">
                          <th>Fecha</th>
                          <th>Motivo / Nota</th>
                          <th>Monto ($)</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-700/50">
                        {advList.map(a => (
                          <tr key={a.id} className="hover:bg-dark-700/30">
                            <td className="text-dark-300">{a.date ? format(new Date(a.date), 'dd/MM/yyyy hh:mm a', { locale: es }) : '-'}</td>
                            <td className="font-medium text-white">{a.reason || 'Adelanto'}</td>
                            <td className="font-bold text-amber-400">{fmt(a.amount)}</td>
                            <td>
                              {a.status === 'DEDUCTED' ? (
                                <span className="badge badge-green">✓ Descontado</span>
                              ) : a.status === 'CANCELLED' ? (
                                <span className="badge bg-dark-700 text-dark-400">Cancelado</span>
                              ) : (
                                <span className="badge bg-amber-950 text-amber-300 border border-amber-800/40">⏳ Pendiente</span>
                              )}
                            </td>
                            <td>
                              {a.status === 'PENDING' && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVale(a.id)}
                                  className="text-red-400 hover:text-red-300 text-xs font-semibold flex items-center gap-1"
                                >
                                  <Trash2 size={12} /> Anular
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
