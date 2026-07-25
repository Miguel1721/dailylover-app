import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { Calculator, CheckCircle2, FileDown, FileText, History, ChevronRight } from 'lucide-react'

const API = 'https://prueba-daily.agentesia.cloud'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function Payroll() {
  const { token, hasPermission } = useAuth()
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [currentRun, setCurrentRun] = useState(null) // { payroll_run, items }
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch(`${API}/api/v1/admin/payroll/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setHistory(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setHistoryLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setCurrentRun(null)
    try {
      const res = await fetch(`${API}/api/v1/admin/payroll/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ month: Number(selectedMonth), year: Number(selectedYear) })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al generar nómina')
      
      // Load generated details
      const detailRes = await fetch(`${API}/api/v1/admin/payroll/${data.run_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const details = await detailRes.json()
      setCurrentRun(details)
      fetchHistory()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLiquidate = async () => {
    if (!currentRun) return
    if (!window.confirm('¿Estás seguro de liquidar la nómina actual? Esta acción no se puede deshacer, historizará los salarios y registrará la transacción en el flujo de caja.')) return
    
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/v1/admin/payroll/${currentRun.payroll_run.id}/liquidate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Error al liquidar')
      }
      
      // Reload current run
      const detailRes = await fetch(`${API}/api/v1/admin/payroll/${currentRun.payroll_run.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const details = await detailRes.json()
      setCurrentRun(details)
      fetchHistory()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadRun = async (runId) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/v1/admin/payroll/${runId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const details = await res.json()
      setCurrentRun(details)
      setSelectedMonth(details.payroll_run.period_month)
      setSelectedYear(details.payroll_run.period_year)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!currentRun) return
    const items = currentRun.items
    let csv = '\uFEFFEmpleado,Cargo,Salario Base,Comisiones,Deducciones,Total Neto\n'
    items.forEach(i => {
      csv += `"${i.employee_name}","${i.employee_role}",${i.base_salary},${i.commissions},${i.deductions},${i.total}\n`
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `nomina_${currentRun.payroll_run.period_year}_${currentRun.payroll_run.period_month}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const run = currentRun?.payroll_run
  const items = currentRun?.items || []

  return (
    <div>
      <div className="page-header">
        <h1>Cálculo de Nómina</h1>
        <p className="page-subtitle">Gestión salarial, comisiones e impuestos de personal</p>
      </div>

      <div className="content-area">
        {/* Controls Toolbar */}
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, width: 140 }}>
              <label>Mes</label>
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                {MONTHS.map((m, idx) => (
                  <option key={m} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0, width: 100 }}>
              <label>Año</label>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>
            {hasPermission('nomina', 'generate') && (
              <button className="btn btn-primary" onClick={handleGenerate} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calculator size={16} /> Generar Nómina
              </button>
            )}
            {currentRun && (
              <>
                <button className="btn btn-ghost" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileDown size={16} /> Exportar CSV
                </button>
                {currentRun.payroll_run?.id && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => window.open(`${API}/api/v1/admin/payroll/${currentRun.payroll_run.id}/export-pdf`, '_blank')}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <FileText size={16} /> ⬇️ Exportar PDF
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(150,21,0,0.1)', border: '1px solid rgba(150,21,0,0.2)', color: '#ff6b6b', padding: 14, borderRadius: 8, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {currentRun ? (
          <div>
            {/* KPI Cards */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-label">Salarios Base</div>
                <div className="stat-number">COP {run.total_base.toLocaleString('es-CO')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Comisiones Liquidadas</div>
                <div className="stat-number" style={{ color: '#4CAF50' }}>COP {run.total_commissions.toLocaleString('es-CO')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Deducciones (8%)</div>
                <div className="stat-number" style={{ color: '#ff6b6b' }}>COP {run.total_deductions.toLocaleString('es-CO')}</div>
              </div>
              <div className="stat-card" style={{ background: 'var(--color-primary-glow)' }}>
                <div className="stat-label" style={{ color: 'var(--text-primary)' }}>Total Neto a Pagar</div>
                <div className="stat-number" style={{ color: 'var(--color-primary-light)' }}>COP {run.total_paid.toLocaleString('es-CO')}</div>
              </div>
            </div>

            {/* Run details table */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>
                  Detalle del Periodo: {MONTHS[run.period_month - 1]} {run.period_year}
                </span>
                <span className={`badge ${run.status === 'liquidated' ? 'badge-green' : 'badge-yellow'}`}>
                  {run.status === 'liquidated' ? 'Liquidada' : 'Borrador'}
                </span>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th>Cargo</th>
                      <th>Salario Base</th>
                      <th>Comisiones</th>
                      <th>Deducción</th>
                      <th>Total Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 600 }}>{item.employee_name}</td>
                        <td>{item.employee_role}</td>
                        <td style={{ fontFamily: 'monospace' }}>COP {item.base_salary.toLocaleString('es-CO')}</td>
                        <td style={{ fontFamily: 'monospace', color: '#4CAF50' }}>COP {item.commissions.toLocaleString('es-CO')}</td>
                        <td style={{ fontFamily: 'monospace', color: '#ff6b6b' }}>COP {item.deductions.toLocaleString('es-CO')}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>COP {item.total.toLocaleString('es-CO')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {run.status === 'draft' && hasPermission('nomina', 'liquidate') && (
                <div style={{ marginTop: 24, textAlign: 'right' }}>
                  <button className="btn btn-primary" onClick={handleLiquidate} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={16} /> Liquidar Nómina del Periodo
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 48, textAlign: 'center', marginBottom: 24, color: 'var(--text-muted)' }}>
            Selecciona un periodo y haz clic en "Generar Nómina" o selecciona una nómina histórica del listado inferior.
          </div>
        )}

        {/* History Section */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <History size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Historial de Nóminas Liquidadas</h3>
          </div>

          {historyLoading ? (
            <div className="empty-state" style={{ padding: 24 }}>Cargando historial...</div>
          ) : history.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>No hay nóminas liquidadas anteriormente.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Periodo</th>
                    <th>Estado</th>
                    <th>Total Pagado</th>
                    <th>Fecha Liquidación</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} style={{ cursor: 'pointer' }} onClick={() => loadRun(h.id)}>
                      <td style={{ fontWeight: 600 }}>{MONTHS[h.period_month - 1]} {h.period_year}</td>
                      <td>
                        <span className={`badge ${h.status === 'liquidated' ? 'badge-green' : 'badge-yellow'}`}>
                          {h.status === 'liquidated' ? 'Liquidada' : 'Borrador'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>COP {h.total_paid.toLocaleString('es-CO')}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {h.liquidated_at ? new Date(h.liquidated_at).toLocaleString('es-CO') : '—'}
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); loadRun(h.id) }}>
                          <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
