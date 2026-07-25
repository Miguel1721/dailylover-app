import { useEffect, useState } from 'react'
import { Users, Calendar, Heart, Star } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

import RemindersWidget from '../components/RemindersWidget'

const API = 'https://prueba-daily.agentesia.cloud'

const PLACEHOLDER_STATS = {
  total_users: 0,
  events_this_month: 0,
  active_matches: 0,
  avg_satisfaction: 0
}

export default function Dashboard() {
  const { token } = useAuth()
  const [stats, setStats] = useState(null)
  const [recentUsers, setRecentUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [todaySummary, setTodaySummary] = useState(null)
  const [report, setReport] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportPeriod, setReportPeriod] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() })

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/v1/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.json())
        .catch(() => PLACEHOLDER_STATS),
      fetch(`${API}/api/v1/admin/users?limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.json())
        .catch(() => ({ users: [] }))
    ]).then(([s, u]) => {
      setStats(s)
      setRecentUsers(u.users || [])
      setLoading(false)
    })
  }, [token])

  useEffect(() => {
    if (!token) return
    fetch(`${API}/api/v1/admin/today-summary`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => setTodaySummary(data))
      .catch(() => setTodaySummary(null))
  }, [token])

  const fetchExistingReport = async () => {
    try {
      const r = await fetch(`${API}/api/v1/admin/reports/executive-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ month: reportPeriod.month, year: reportPeriod.year, force_regenerate: false })
      })
      if (r.ok) setReport(await r.json())
    } catch {}
  }

  const generateReport = async () => {
    setReportLoading(true)
    try {
      const r = await fetch(`${API}/api/v1/admin/reports/executive-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ month: reportPeriod.month, year: reportPeriod.year, force_regenerate: true })
      })
      if (r.ok) setReport(await r.json())
    } finally {
      setReportLoading(false)
    }
  }

  useEffect(() => { fetchExistingReport() }, [])

  const chartData = {
    labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'],
    datasets: [{
      label: 'Nuevos Clientes',
      data: stats?.weekly_growth || [2, 5, 4, 8, 6, 12, 9, 15],
      fill: true,
      backgroundColor: 'rgba(150, 21, 0, 0.1)',
      borderColor: '#961500',
      pointBackgroundColor: '#961500',
      pointRadius: 4,
      tension: 0.4
    }]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1A1214',
        borderColor: 'rgba(150,21,0,0.3)',
        borderWidth: 1,
        titleColor: '#F5F0F1',
        bodyColor: '#9A8A8D'
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(150,21,0,0.08)' },
        ticks: { color: '#9A8A8D', font: { size: 11, family: 'Inter Tight' } }
      },
      y: {
        grid: { color: 'rgba(150,21,0,0.08)' },
        ticks: { color: '#9A8A8D', font: { size: 11, family: 'Inter Tight' } }
      }
    }
  }

  const statCards = [
    { label: 'Total Clientes', value: stats?.total_users ?? '—', icon: Users, trend: '+12% este mes' },
    { label: 'Eventos este Mes', value: stats?.events_this_month ?? '—', icon: Calendar, trend: 'Próximo: en 3 días' },
    { label: 'Match Requests', value: stats?.active_matches ?? '—', icon: Heart, trend: 'Activos' },
    {
      label: 'Satisfacción Prom.',
      value: stats?.avg_satisfaction ? `${stats.avg_satisfaction}/10` : '—',
      icon: Star,
      trend: 'Basado en feedback'
    }
  ]

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="page-subtitle">Resumen operativo de Daily Lover</p>
      </div>
      <div className="content-area">
        {/* ── Vista Hoy Banner ── */}
        {todaySummary && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            marginBottom: 20
          }}>
            {/* 🗓 Eventos próximas 48h */}
            <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid #961500' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>🗓</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Eventos próximas 48h</span>
              </div>
              {todaySummary.upcoming_events?.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {todaySummary.upcoming_events.map((ev, i) => {
                    const bg =
                      ev.status === 'critical' ? '#dc2626' :
                      ev.status === 'warning'  ? '#d97706' :
                                                  '#16a34a'
                    return (
                      <span key={i} style={{
                        background: bg,
                        color: '#fff',
                        borderRadius: 999,
                        padding: '3px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        whiteSpace: 'nowrap'
                      }}>
                        {ev.name} • {ev.hours_until}h • {ev.occupancy_pct}%
                      </span>
                    )
                  })}
                </div>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin eventos próximos</span>
              )}
            </div>

            {/* 💸 Cobros vencidos */}
            <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid #dc2626' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>💸</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Cobros vencidos</span>
              </div>
              {todaySummary.overdue_payments?.length > 0 ? (
                <span style={{
                  background: '#dc2626',
                  color: '#fff',
                  borderRadius: 999,
                  padding: '4px 14px',
                  fontSize: 13,
                  fontWeight: 700
                }}>
                  {todaySummary.overdue_payments.length} pendientes
                </span>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin cobros vencidos ✓</span>
              )}
            </div>

            {/* 💼 Nómina pendiente */}
            <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid #d97706' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>💼</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Nómina pendiente</span>
              </div>
              {todaySummary.pending_payroll?.has_pending ? (
                <span style={{
                  background: '#d97706',
                  color: '#fff',
                  borderRadius: 999,
                  padding: '4px 14px',
                  fontSize: 12,
                  fontWeight: 700
                }}>
                  ⚠ Hay nómina sin liquidar
                </span>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nómina al día ✓</span>
              )}
            </div>

            {/* 🚨 Incidencias recientes */}
            <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid #ea580c' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>🚨</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Incidencias recientes</span>
              </div>
              {todaySummary.recent_incidents?.length > 0 ? (
                <span style={{
                  background: '#ea580c',
                  color: '#fff',
                  borderRadius: 999,
                  padding: '4px 14px',
                  fontSize: 13,
                  fontWeight: 700
                }}>
                  {todaySummary.recent_incidents.length} incidencia{todaySummary.recent_incidents.length !== 1 ? 's' : ''}
                </span>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin incidencias ✓</span>
              )}
            </div>
          </div>
        )}

        {/* Sección de Alertas Operativas */}
        {stats && (stats.active_debts > 0 || stats.pending_payrolls > 0 || stats.critical_events > 0) && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
            marginBottom: 24
          }}>
            {stats.active_debts > 0 && (
              <div className="card" style={{
                borderLeft: '4px solid #FFC107',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                background: 'rgba(255, 193, 7, 0.04)'
              }}>
                <div style={{ color: '#FFC107', display: 'flex', alignItems: 'center' }}>
                  <Star size={22} fill="#FFC107" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{stats.active_debts} Cobros Vencidos</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>Membresías VIP pendientes de renovación cartera.</div>
                </div>
              </div>
            )}
            
            {stats.pending_payrolls > 0 && (
              <div className="card" style={{
                borderLeft: '4px solid #ff6b6b',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                background: 'rgba(255, 107, 107, 0.04)'
              }}>
                <div style={{ color: '#ff6b6b', display: 'flex', alignItems: 'center' }}>
                  <Users size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{stats.pending_payrolls} Nómina Pendiente</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>Hay periodos activos de nómina sin liquidar.</div>
                </div>
              </div>
            )}

            {stats.critical_events > 0 && (
              <div className="card" style={{
                borderLeft: '4px solid #ff9f43',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                background: 'rgba(255, 159, 67, 0.04)'
              }}>
                <div style={{ color: '#ff9f43', display: 'flex', alignItems: 'center' }}>
                  <Calendar size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{stats.critical_events} Evento con Baja Ocupación</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>Eventos próximos a 48h con menos del 50% de capacidad.</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 📌 RECORDATORIOS & TAREAS PRIORITARIAS DE SEGUIMIENTO */}
        <RemindersWidget />

        <div className="stats-grid">
          {statCards.map(({ label, value, icon: Icon, trend }) => (
            <div key={label} className="stat-card">
              <div className="stat-icon"><Icon size={20} /></div>
              <div className="stat-number">{loading ? '...' : value}</div>
              <div className="stat-label">{label}</div>
              <div className="stat-trend">{trend}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-title">Crecimiento de Clientes</div>
            <div className="chart-container">
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
          <div className="card">
            <div className="card-title">Actividad Reciente</div>
            {recentUsers.length === 0 ? (
              <div className="empty-state">
                No hay clientes aún.<br />Importa tu primer Excel.
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Teléfono</th>
                      <th>Desde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUsers.map(u => (
                      <tr key={u.id}>
                        <td>{u.name || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{u.phone}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {new Date(u.created_at).toLocaleDateString('es-CO')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* AI Executive Report */}
        <div className="card" style={{
          background: 'linear-gradient(135deg, #1a0a2e 0%, #2d0050 50%, #1a0a2e 100%)',
          border: '1px solid rgba(176,106,255,0.3)',
          marginTop: 24
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>✨</span>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#e8b4ff' }}>Reporte Ejecutivo IA</span>
                <span style={{ fontSize: 11, background: 'rgba(176,106,255,0.2)', color: '#b06aff', padding: '2px 8px', borderRadius: 20 }}>Claude AI</span>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(232,180,255,0.6)', marginTop: 4 }}>Análisis automático del desempeño del negocio</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={reportPeriod.month}
                onChange={e => setReportPeriod(p => ({ ...p, month: Number(e.target.value) }))}
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(176,106,255,0.3)', color: '#e8b4ff', borderRadius: 8, padding: '4px 8px', fontSize: 12 }}
              >
                {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) => (
                  <option key={i+1} value={i+1} style={{ background: '#1a0a2e' }}>{m}</option>
                ))}
              </select>
              <select
                value={reportPeriod.year}
                onChange={e => setReportPeriod(p => ({ ...p, year: Number(e.target.value) }))}
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(176,106,255,0.3)', color: '#e8b4ff', borderRadius: 8, padding: '4px 8px', fontSize: 12 }}
              >
                {[2024,2025,2026].map(y => <option key={y} value={y} style={{ background: '#1a0a2e' }}>{y}</option>)}
              </select>
              <button
                onClick={generateReport}
                disabled={reportLoading}
                style={{ background: 'linear-gradient(135deg, #7c3aed, #b06aff)', border: 'none', color: 'white', padding: '6px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {reportLoading ? '⟳ Generando...' : '✨ Generar Reporte'}
              </button>
            </div>
          </div>

          {report ? (
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'rgba(232,180,255,0.5)' }}>Periodo: {report.period}</span>
                <span style={{ fontSize: 11, color: 'rgba(232,180,255,0.5)' }}>Generado: {new Date(report.generated_at).toLocaleDateString('es-CO')}</span>
              </div>
              <p style={{ color: '#e8b4ff', lineHeight: 1.7, fontSize: 14, whiteSpace: 'pre-line' }}>{report.summary}</p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(232,180,255,0.4)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
              <p style={{ fontSize: 13 }}>Selecciona un periodo y presiona "Generar Reporte" para obtener un análisis ejecutivo con IA</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
