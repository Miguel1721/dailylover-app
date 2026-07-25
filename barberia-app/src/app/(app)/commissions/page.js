'use client'
import { useState, useEffect } from 'react'
import { DollarSign, CheckCircle, Clock, Users, ChevronDown, ChevronRight, Eye, Store, FileText } from 'lucide-react'
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
  const [data, setData] = useState({ commissions: [], summary: {} })
  const [barbers, setBarbers] = useState([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [expandedBarber, setExpandedBarber] = useState(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [payTarget, setPayTarget] = useState(null) // { barberId?, label, amount, body }
  const [detailModalBarber, setDetailModalBarber] = useState(null) // { barberId, barberName, summaryBarber }

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
      toast.success('Comisiones liquidadas exitosamente')
      load()
      setShowConfirmModal(false)
    } else {
      const d = await res.json()
      toast.error(d.error || 'Error al liquidar')
    }
  }

  const openPayBarber = (barberSummary) => {
    setPayTarget({
      barberId: barberSummary.barberId,
      label: `${barberSummary.barberName} — pendiente`,
      amount: barberSummary.pending,
      body: { barberId: barberSummary.barberId, startDate: filters.startDate, endDate: filters.endDate },
    })
    setShowConfirmModal(true)
  }

  const openPayAll = () => {
    setPayTarget({
      label: 'Todos los barberos — pendiente total',
      amount: data.summary.totalPending,
      body: { startDate: filters.startDate, endDate: filters.endDate },
    })
    setShowConfirmModal(true)
  }

  const openDetailsModal = (barberSummary) => {
    setDetailModalBarber(barberSummary)
  }

  const { summary } = data
  const totalServiceRev = summary.totalServiceRevenue || 0
  const barbershopRetained = summary.totalBarbershopRetained || Math.max(0, totalServiceRev - (summary.totalCommissions || 0))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <DollarSign className="text-gold-400" size={28} />
            Comisiones y Distribución
          </h1>
          <p className="page-subtitle">Liquidación de barberos (60%) y ganancia de barbería (40%)</p>
        </div>
        {summary.totalPending > 0 && (
          <button id="btn-pay-all" onClick={openPayAll} className="btn-success">
            <CheckCircle size={16} />
            Liquidar todo pendiente ({fmt(summary.totalPending)})
          </button>
        )}
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

      {/* Resumen de la Barbería (Porcentaje que le queda a la barbería) */}
      <div className="card bg-gradient-to-r from-dark-800 via-dark-700 to-dark-800 border-gold-500/20 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gold-400/15 flex items-center justify-center border border-gold-400/30">
            <Store size={22} className="text-gold-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Resumen de Barbería
              <span className="text-xs px-2 py-0.5 rounded-full bg-gold-400/20 text-gold-400 font-medium">
                Retención {summary.barbershopShareRate || 40}%
              </span>
            </h2>
            <p className="text-xs text-dark-400">Total retenido por la barbería después de comisión a barberos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-dark-700/60">
          <div className="p-3.5 rounded-xl bg-dark-900/60 border border-dark-700">
            <div className="text-xs text-dark-400 font-medium mb-1">Total Servicios Generados</div>
            <div className="text-xl font-bold text-white">{loading ? '...' : fmt(totalServiceRev)}</div>
            <div className="text-[11px] text-dark-500 mt-1">Ingreso bruto de servicios</div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
            <div className="text-xs text-emerald-400 font-medium mb-1">Ganancia Barbería ({summary.barbershopShareRate || 40}%)</div>
            <div className="text-xl font-bold text-emerald-400">{loading ? '...' : fmt(barbershopRetained)}</div>
            <div className="text-[11px] text-emerald-500/80 mt-1">Monto que le queda a la barbería</div>
          </div>

          <div className="p-3.5 rounded-xl bg-gold-950/30 border border-gold-500/30">
            <div className="text-xs text-gold-400 font-medium mb-1">Total Barberos (60%)</div>
            <div className="text-xl font-bold text-gold-400">{loading ? '...' : fmt(summary.totalCommissions || 0)}</div>
            <div className="text-[11px] text-dark-400 mt-1 flex justify-between">
              <span>Pagado: {fmt(summary.totalPaid || 0)}</span>
              <span className="text-yellow-400 font-medium">Pend: {fmt(summary.totalPending || 0)}</span>
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
            <div className="kpi-label">Comisión Barberos (60%)</div>
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
          <div className="kpi-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <Clock size={22} className="text-yellow-400" />
          </div>
          <div>
            <div className="kpi-value text-yellow-400">{fmt(summary.totalPending || 0)}</div>
            <div className="kpi-label">Pendiente por Pagar</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(168,85,247,0.15)' }}>
            <Users size={22} className="text-purple-400" />
          </div>
          <div>
            <div className="kpi-value">{(summary.byBarber || []).filter(b => b.pending > 0).length}</div>
            <div className="kpi-label">Barberos por liquidar</div>
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
            <p className="text-dark-500 text-sm text-center py-6">Sin comisiones en este período</p>
          ) : (
            (summary.byBarber || []).map(b => {
              const barberCommissions = data.commissions.filter(c => c.barber?.id === b.barberId || c.barberId === b.barberId)
              const isExpanded = expandedBarber === b.barberId
              return (
                <div key={b.barberId} className="border border-dark-700 rounded-xl overflow-hidden bg-dark-800/40">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-dark-700/30 transition-colors cursor-pointer"
                       onClick={() => setExpandedBarber(isExpanded ? null : b.barberId)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gold-600 flex items-center justify-center text-black font-bold flex-shrink-0">
                        {b.barberName[0]}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{b.barberName}</div>
                        <div className="text-xs text-dark-500">Servicios: {fmt(b.totalServices || b.total / 0.6)}</div>
                      </div>
                    </div>

                    <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="font-semibold text-gold-400">{fmt(b.total)}</div>
                        <div className="text-[11px] text-dark-500">Comisión (60%)</div>
                      </div>
                      <div>
                        <div className="font-semibold text-emerald-400">{fmt(b.paid)}</div>
                        <div className="text-[11px] text-dark-500">Pagado</div>
                      </div>
                      <div>
                        <div className={`font-semibold ${b.pending > 0 ? 'text-yellow-400' : 'text-dark-500'}`}>{fmt(b.pending)}</div>
                        <div className="text-[11px] text-dark-500">Pendiente</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button id={`btn-details-${b.barberId}`}
                              onClick={e => { e.stopPropagation(); openDetailsModal(b) }}
                              className="btn-secondary btn-sm flex items-center gap-1.5">
                        <Eye size={14} />
                        <span>Detalles</span>
                      </button>

                      {b.pending > 0 && (
                        <button id={`btn-pay-${b.barberId}`}
                                onClick={e => { e.stopPropagation(); openPayBarber(b) }}
                                className="btn-success btn-sm">
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

      {/* Modal de Detalles por Barbero */}
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
                  <h3 className="text-lg font-bold text-white">Detalle de Servicios — {detailModalBarber.barberName}</h3>
                  <p className="text-xs text-dark-400">
                    Período: <span className="text-gold-400 font-medium">{filters.startDate}</span> al <span className="text-gold-400 font-medium">{filters.endDate}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setDetailModalBarber(null)} className="btn-ghost p-2 text-dark-400 hover:text-white rounded-lg">✕</button>
            </div>

            {/* Resumen dentro del Modal */}
            <div className="grid grid-cols-3 gap-2 p-3 sm:p-4 bg-dark-900/40 border-b border-dark-700 text-center">
              <div className="p-2.5 rounded-lg bg-dark-700/40 border border-dark-600/40">
                <div className="text-[11px] text-dark-400">Total Servicios</div>
                <div className="text-sm sm:text-base font-bold text-white">{fmt(detailModalBarber.totalServices || detailModalBarber.total / 0.6)}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-gold-950/30 border border-gold-500/30">
                <div className="text-[11px] text-gold-400">Comisión Barbero (60%)</div>
                <div className="text-sm sm:text-base font-bold text-gold-400">{fmt(detailModalBarber.total)}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
                <div className="text-[11px] text-emerald-400">Barbería ({summary.barbershopShareRate || 40}%)</div>
                <div className="text-sm sm:text-base font-bold text-emerald-400">{fmt(detailModalBarber.barbershopShare || detailModalBarber.total * 0.666)}</div>
              </div>
            </div>

            {/* Cuerpo del Modal con Scroll Ajustado */}
            <div className="modal-body p-3 sm:p-5 overflow-y-auto flex-1 max-h-[55vh] no-scrollbar">
              {(() => {
                const list = data.commissions.filter(c => c.barber?.id === detailModalBarber.barberId || c.barberId === detailModalBarber.barberId)
                if (list.length === 0) {
                  return <p className="text-dark-500 text-sm text-center py-8">No hay servicios registrados para este barbero en el período.</p>
                }
                return (
                  <div className="space-y-3">
                    {/* Vista Desktop Table / Vista Mobile Cards */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="table text-xs w-full">
                        <thead>
                          <tr className="text-dark-400 border-b border-dark-700">
                            <th>Día y Hora</th>
                            <th>Cliente</th>
                            <th>Servicios realizados</th>
                            <th>Pago</th>
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
                                <td className="text-dark-400">{c.sale?.paymentMethod || 'Efectivo'}</td>
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

                    {/* Mobile cards view */}
                    <div className="sm:hidden space-y-2.5">
                      {list.map(c => {
                        const dateStr = c.createdAt ? format(new Date(c.createdAt), "EEE d MMM, hh:mm a", { locale: es }) : '-'
                        const serviceNames = c.sale?.items
                          ?.map(i => i.service?.name || i.product?.name)
                          .filter(Boolean)
                          .join(', ') || 'Servicios'
                        const barbershopPart = Math.max(0, (c.serviceTotal || 0) - c.commissionAmount)

                        return (
                          <div key={c.id} className="p-3 rounded-xl bg-dark-700/40 border border-dark-700 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gold-400 font-medium capitalize">{dateStr}</span>
                              {c.isPaid
                                ? <span className="badge badge-green text-[10px]"><CheckCircle size={9} /> Pagado</span>
                                : <span className="badge text-[10px]" style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308' }}><Clock size={9} /> Pendiente</span>
                              }
                            </div>
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="text-sm font-semibold text-white">{c.sale?.clientName || 'Cliente General'}</div>
                                <div className="text-xs text-dark-400">{serviceNames}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-white">{fmt(c.serviceTotal)}</div>
                                <div className="text-[11px] text-dark-500">{c.sale?.paymentMethod || 'Efectivo'}</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dark-600/40 text-xs">
                              <div>
                                <span className="text-dark-500">Barbero (60%): </span>
                                <span className="font-semibold text-gold-400">{fmt(c.commissionAmount)}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-dark-500">Barbería (40%): </span>
                                <span className="font-semibold text-emerald-400">{fmt(barbershopPart)}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Footer del Modal */}
            <div className="modal-footer p-4 border-t border-dark-700 flex items-center justify-between bg-dark-900/50">
              {detailModalBarber.pending > 0 ? (
                <button onClick={() => { setDetailModalBarber(null); openPayBarber(detailModalBarber) }} className="btn-success btn-sm">
                  <CheckCircle size={14} />
                  Liquidar Saldo ({fmt(detailModalBarber.pending)})
                </button>
              ) : (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle size={14} /> Sin saldo pendiente
                </span>
              )}
              <button onClick={() => setDetailModalBarber(null)} className="btn-secondary btn-sm">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Pay Modal */}
      {showConfirmModal && payTarget && (
        <div className="modal-overlay p-4 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
             onClick={e => e.target === e.currentTarget && setShowConfirmModal(false)}>
          <div className="modal w-full max-w-sm bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="modal-header p-4 border-b border-dark-700 flex items-center justify-between">
              <h3 className="section-title">Confirmar Liquidación</h3>
              <button onClick={() => setShowConfirmModal(false)} className="btn-ghost p-2 text-dark-400 hover:text-white">✕</button>
            </div>
            <div className="modal-body p-5 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-900/40 border-2 border-emerald-600 flex items-center justify-center mx-auto mb-4">
                <DollarSign size={28} className="text-emerald-400" />
              </div>
              <p className="text-dark-400 text-sm mb-2">{payTarget.label}</p>
              <p className="text-3xl font-bold text-emerald-400">{fmt(payTarget.amount)}</p>
              <p className="text-dark-500 text-xs mt-3">Esta acción marcará las comisiones como pagadas. No se puede deshacer.</p>
            </div>
            <div className="modal-footer p-4 border-t border-dark-700 flex justify-end gap-2">
              <button onClick={() => setShowConfirmModal(false)} className="btn-secondary">Cancelar</button>
              <button id="btn-confirm-pay" onClick={() => handlePay(payTarget.body)} disabled={paying} className="btn-success">
                {paying ? 'Procesando...' : 'Confirmar Pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
