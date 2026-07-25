import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Bar, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Wallet, Landmark, TrendingUp, TrendingDown, RefreshCw, FileText } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler)

const API = 'https://prueba-daily.agentesia.cloud'

function CategoryProgress({ label, value, maxVal }) {
  const pct = maxVal > 0 ? Math.round((value / maxVal) * 100) : 0
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{label.replace('_', ' ')}</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          COP {value.toLocaleString('es-CO')} ({pct}%)
        </span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function CashFlow() {
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchCashflow = () => {
    setLoading(true)
    fetch(`${API}/api/v1/admin/finance/cashflow`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => setData(d))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchCashflow()
  }, [])

  if (loading) return <div className="empty-state">Cargando flujo de caja...</div>
  if (!data || data.detail || !data.monthly_summary) {
    return <div className="empty-state">Error al cargar flujo de caja. {data?.detail && `(${data.detail})`}</div>
  }

  const months = data.monthly_summary.map(item => item.month)
  const incomes = data.monthly_summary.map(item => item.income)
  const expenses = data.monthly_summary.map(item => item.expenses)

  const chartData = {
    labels: months,
    datasets: [
      {
        label: 'Ingresos',
        data: incomes,
        backgroundColor: '#4CAF50',
        borderRadius: 4
      },
      {
        label: 'Gastos',
        data: expenses,
        backgroundColor: '#961500',
        borderRadius: 4
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#9A8A8D', font: { family: 'Inter Tight', size: 12 } }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(150,21,0,0.05)' },
        ticks: { color: '#9A8A8D' }
      },
      y: {
        grid: { color: 'rgba(150,21,0,0.05)' },
        ticks: { color: '#9A8A8D' }
      }
    }
  }

  const totalInc = Object.values(data.by_category.income).reduce((sum, v) => sum + v, 0)
  const totalExp = Object.values(data.by_category.expenses).reduce((sum, v) => sum + v, 0)

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Flujo de Caja</h1>
          <p className="page-subtitle">Balance general y análisis de sostenibilidad financiera</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => window.open('/api/v1/admin/finance/cashflow/export-pdf', '_blank')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <FileText size={14} /> ⬇️ Exportar PDF
          </button>
          <button className="btn btn-ghost btn-sm" onClick={fetchCashflow} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      <div className="content-area">
        {/* KPI Panel */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 24 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--color-primary-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)'
            }}>
              <Wallet size={24} />
            </div>
            <div>
              <div className="stat-label">Saldo Disponible</div>
              <div className="stat-number" style={{ fontSize: 26, marginTop: 4, color: data.current_balance >= 0 ? '#4CAF50' : '#ff6b6b' }}>
                COP {data.current_balance.toLocaleString('es-CO')}
              </div>
            </div>
          </div>

          <div className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 24 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(76,175,80,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4CAF50'
            }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <div className="stat-label">Ingresos Totales</div>
              <div className="stat-number" style={{ fontSize: 26, marginTop: 4, color: '#4CAF50' }}>
                COP {totalInc.toLocaleString('es-CO')}
              </div>
            </div>
          </div>

          <div className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 24 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(150,21,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)'
            }}>
              <TrendingDown size={24} />
            </div>
            <div>
              <div className="stat-label">Gastos Totales</div>
              <div className="stat-number" style={{ fontSize: 26, marginTop: 4, color: '#ff6b6b' }}>
                COP {totalExp.toLocaleString('es-CO')}
              </div>
            </div>
          </div>
        </div>

        {/* Chart section */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">Historial Comparativo (Últimos 6 Meses)</div>
          <div className="chart-container" style={{ height: 280 }}>
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* 90-day projection chart */}
        {data.projection_90d && data.projection_90d.length > 0 && (() => {
          const projLabels = data.projection_90d.map(item =>
            new Date(item.date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })
          )
          const projBalances = data.projection_90d.map(item => item.projected_balance)

          const projChartData = {
            labels: projLabels,
            datasets: [
              {
                label: 'Proyección 90 días',
                data: projBalances,
                borderColor: '#b06aff',
                backgroundColor: 'rgba(176,106,255,0.08)',
                borderDash: [6, 4],
                borderWidth: 2,
                pointRadius: 4,
                pointBackgroundColor: '#b06aff',
                pointBorderColor: '#b06aff',
                tension: 0.35,
                fill: true
              }
            ]
          }

          const projChartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                labels: { color: '#9A8A8D', font: { family: 'Inter Tight', size: 12 } }
              },
              tooltip: {
                callbacks: {
                  label: ctx => `COP ${ctx.parsed.y.toLocaleString('es-CO')}`
                }
              }
            },
            scales: {
              x: {
                grid: { color: 'rgba(150,21,0,0.05)' },
                ticks: { color: '#9A8A8D', font: { size: 11 } }
              },
              y: {
                grid: { color: 'rgba(150,21,0,0.05)' },
                ticks: {
                  color: '#9A8A8D',
                  callback: val => `COP ${Number(val).toLocaleString('es-CO')}`
                }
              }
            }
          }

          return (
            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>📈 Proyección de Flujo de Caja — Próximos 90 Días</div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: '1.5em' }}>
                Las líneas punteadas representan proyecciones basadas en eventos programados y gastos recurrentes.
              </p>
              <div className="chart-container" style={{ height: 300 }}>
                <Line data={projChartData} options={projChartOptions} />
              </div>
            </div>
          )
        })()}

        {/* Projection and Category breakdown */}
        <div className="responsive-grid-2">
          {/* Categories breakdown */}
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 20 }}>
            <div className="card">
              <div className="card-title" style={{ color: '#4CAF50' }}>Ingresos por Categoría</div>
              {Object.keys(data.by_category.income).length === 0 ? (
                <div className="empty-state" style={{ padding: 12 }}>Sin registros.</div>
              ) : (
                Object.entries(data.by_category.income).map(([cat, val]) => (
                  <CategoryProgress key={cat} label={cat} value={val} maxVal={totalInc} />
                ))
              )}
            </div>

            <div className="card">
              <div className="card-title" style={{ color: '#ff6b6b' }}>Gastos por Categoría</div>
              {Object.keys(data.by_category.expenses).length === 0 ? (
                <div className="empty-state" style={{ padding: 12 }}>Sin registros.</div>
              ) : (
                Object.entries(data.by_category.expenses).map(([cat, val]) => (
                  <CategoryProgress key={cat} label={cat} value={val} maxVal={totalExp} />
                ))
              )}
            </div>
          </div>

          {/* Projections card */}
          <div className="card" style={{ height: 'fit-content' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Landmark size={20} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Proyección Financiera</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: '1.5em', marginBottom: 20 }}>
              Calculado en base al promedio de ingresos netos mensuales de los últimos 3 meses operativos:
            </p>

            <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Ingreso Neto Proyectado (Próximos 30 días)
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8, color: data.projection_30d >= 0 ? '#4CAF50' : '#ff6b6b' }}>
                COP {data.projection_30d.toLocaleString('es-CO')}
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16, lineHeight: '1.4em' }}>
              * Esta proyección asume estabilidad en gastos operativos de nómina, mercadeo y arriendo de oficina, y constancia en suscripciones recurrentes.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
