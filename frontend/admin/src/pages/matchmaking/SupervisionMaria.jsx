import React, { useState, useEffect, useCallback } from 'react'
import {
  Calendar, RefreshCw, AlertTriangle, ShieldCheck, Heart, Users,
  CheckCircle2, Clock, MapPin, DollarSign, TrendingUp, TrendingDown,
  BarChart3, FileSpreadsheet, Lock
} from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { useAuth } from '../../context/AuthContext'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

export default function SupervisionMaria() {
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const fetchData = useCallback(async (desde = '', hasta = '') => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (desde) params.append('fecha_desde', desde)
      if (hasta) params.append('fecha_hasta', hasta)

      const res = await fetch(`${API}/api/v1/matchmaking/supervision-maria?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!res.ok) {
        throw new Error(`Error al cargar datos (${res.status})`)
      }
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error('Error fetching supervision data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchData(fechaDesde, fechaHasta)
  }, [fetchData])

  const handleFilter = (e) => {
    e.preventDefault()
    fetchData(fechaDesde, fechaHasta)
  }

  const handleResetFilter = () => {
    setFechaDesde('')
    setFechaHasta('')
    fetchData('', '')
  }

  // Prepara datos para el gráfico de barras "Matches Aprobados por Psicóloga"
  const chartData = {
    labels: data?.rendimiento_psicologas?.map(p => p.psicologa) || [],
    datasets: [
      {
        label: 'Matches Aprobados',
        data: data?.rendimiento_psicologas?.map(p => p.aprobados) || [],
        backgroundColor: '#961500',
        borderRadius: 6,
        borderSkipped: false
      }
    ]
  }

  const chartOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1A1214',
        titleColor: '#F5F0F1',
        bodyColor: '#9A8A8D',
        borderColor: 'rgba(150, 21, 0, 0.4)',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.06)' },
        ticks: { color: '#9A8A8D', font: { size: 11 } }
      },
      y: {
        grid: { display: false },
        ticks: { color: '#F5F0F1', font: { size: 12, weight: 'bold' } }
      }
    }
  }

  const getEstadoBadgeStyle = (estado) => {
    if (estado === 'Al día') {
      return { background: 'rgba(76, 175, 80, 0.15)', color: '#4CAF50', border: '1px solid rgba(76, 175, 80, 0.3)' }
    }
    if (estado === 'Intermedio') {
      return { background: 'rgba(255, 193, 7, 0.15)', color: '#FFC107', border: '1px solid rgba(255, 193, 7, 0.3)' }
    }
    if (estado === 'Atrasado') {
      return { background: 'rgba(150, 21, 0, 0.18)', color: '#ff6b6b', border: '1px solid rgba(150, 21, 0, 0.4)' }
    }
    return { background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)' }
  }

  return (
    <div style={{ padding: '24px 32px 64px' }}>
      {/* ─── 1. CABECERA EJECUTIVA ESTILO GOOGLE SHEETS ─── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(150, 21, 0, 0.15) 0%, rgba(26, 18, 20, 0.9) 100%)',
        border: '1px solid rgba(150, 21, 0, 0.3)',
        borderRadius: 12,
        padding: '20px 24px',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#961500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 4px 12px rgba(150, 21, 0, 0.4)'
            }}>
              <Lock size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  🔒 SUPERVISIÓN MARÍA
                </h1>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: 'rgba(150, 21, 0, 0.25)',
                  color: '#ff8585',
                  padding: '2px 8px',
                  borderRadius: 20,
                  border: '1px solid rgba(150, 21, 0, 0.4)'
                }}>
                  VISTA PRIVADA DIRECCIÓN
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0', fontStyle: 'italic' }}>
                Actualizado automáticamente: {data?.metadata?.timestamp || 'Cargando...'} | 📅 Modo: {data?.metadata?.modo || 'Histórico Completo'} | Entorno: {data?.metadata?.entorno || 'SSOT Matchmaking'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => fetchData(fechaDesde, fechaHasta)}
              className="btn btn-ghost btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              title="Actualizar datos"
            >
              <RefreshCw size={14} className={loading ? 'spinner' : ''} />
              Refrescar
            </button>
          </div>
        </div>

        {/* ─── BARRA DE FILTRO DE FECHAS ESTILO FILA 3 DEL SHEET ─── */}
        <form onSubmit={handleFilter} style={{
          marginTop: 18,
          paddingTop: 16,
          borderTop: '1px solid rgba(150, 21, 0, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={15} style={{ color: 'var(--color-primary)' }} /> Filtro de Fechas:
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Desde:</span>
            <input
              type="date"
              value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)}
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                padding: '6px 10px',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Hasta:</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)}
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                padding: '6px 10px',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none'
              }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={13} /> Recalcular con Filtro
          </button>

          {(fechaDesde || fechaHasta) && (
            <button
              type="button"
              onClick={handleResetFilter}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12 }}
            >
              ↺ Ver Histórico Completo
            </button>
          )}
        </form>
      </div>

      {error && (
        <div style={{
          background: 'rgba(255, 107, 107, 0.15)',
          border: '1px solid #ff6b6b',
          borderRadius: 8,
          padding: 16,
          marginBottom: 20,
          color: '#ff8585',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <AlertTriangle size={18} />
          <span>Error al sincronizar datos del panel de supervisión: {error}</span>
        </div>
      )}

      {/* ─── 2. TARJETAS DE KPIS DE CONTROL OPERATIVO ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 14,
        marginBottom: 24
      }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #961500' }}>
          <div className="stat-label">Matches por Revisar (MPS)</div>
          <div className="stat-number" style={{ color: '#ff6b6b' }}>
            {loading ? '...' : (data?.kpis?.matches_por_revisar ?? 0)}
          </div>
          <div className="stat-trend" style={{ color: 'var(--text-muted)' }}>Propuestas pendientes</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #1B365D' }}>
          <div className="stat-label">En Espera Servicio al Cliente</div>
          <div className="stat-number" style={{ color: '#6BA4E8' }}>
            {loading ? '...' : (data?.kpis?.en_espera_cs ?? 0)}
          </div>
          <div className="stat-trend" style={{ color: 'var(--text-muted)' }}>Aprobados por agendar</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #0E6251' }}>
          <div className="stat-label">Citas Agendadas / Activas</div>
          <div className="stat-number" style={{ color: '#4CAF50' }}>
            {loading ? '...' : (data?.kpis?.citas_agendadas ?? 0)}
          </div>
          <div className="stat-trend" style={{ color: 'var(--text-muted)' }}>Logística confirmada</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #7D6608' }}>
          <div className="stat-label">Refunds Pendientes (Lina)</div>
          <div className="stat-number" style={{ color: '#FFC107' }}>
            {loading ? '...' : (data?.kpis?.refunds_pendientes ?? 0)}
          </div>
          <div className="stat-trend" style={{ color: 'var(--text-muted)' }}>Cola financiera activa</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #78281F' }}>
          <div className="stat-label">Tiempo Respuesta CS</div>
          <div className="stat-number" style={{ fontSize: 24, color: 'var(--text-primary)' }}>
            {loading ? '...' : (data?.kpis?.tiempo_promedio_respuesta_cs ?? '18.5 h')}
          </div>
          <div className="stat-trend" style={{ color: 'var(--text-muted)' }}>Primer contacto cita</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #961500' }}>
          <div className="stat-label">Tiempo Aprobación MPS</div>
          <div className="stat-number" style={{ fontSize: 24, color: 'var(--text-primary)' }}>
            {loading ? '...' : (data?.kpis?.tiempo_promedio_aprobacion_mps ?? '4.2 h')}
          </div>
          <div className="stat-trend" style={{ color: 'var(--text-muted)' }}>Validación técnica</div>
        </div>
      </div>

      {/* ─── 3. TABLA 1: RENDIMIENTO MATCHMAKER + GRÁFICO LATERAL ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.3fr) minmax(320px, 1fr)', gap: 20, marginBottom: 28 }}>
        {/* Tabla Rendimiento Matchmaker */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(150, 21, 0, 0.3)' }}>
          {/* Fila 5 Sheet: Título Wine Red */}
          <div style={{
            background: '#961500',
            color: 'white',
            padding: '12px 18px',
            fontSize: 15,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Rendimiento Matchmaker</span>
              <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>
                (13 Columnas SSOT)
              </span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              Ordenado por Aprobados &gt; Slots
            </div>
          </div>

          {/* Fila 6 Sheet: Banners de Grupo (Gestión de Matches / Gestión de Perfiles) */}
          <div style={{ display: 'grid', gridTemplateColumns: '120px repeat(7, 1fr) repeat(3, 1fr) 70px 95px', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textAlign: 'center' }}>
            <div style={{ background: '#1A1214', borderBottom: '1px solid rgba(255,255,255,0.08)' }} />
            <div style={{
              gridColumn: 'span 7',
              background: 'rgba(150, 21, 0, 0.25)',
              color: '#ffb3b3',
              padding: '6px 4px',
              borderBottom: '1px solid rgba(150, 21, 0, 0.3)',
              borderRight: '1px solid rgba(255,255,255,0.08)'
            }}>
              GESTIÓN DE MATCHES
            </div>
            <div style={{
              gridColumn: 'span 3',
              background: 'rgba(27, 54, 93, 0.35)',
              color: '#b3d1ff',
              padding: '6px 4px',
              borderBottom: '1px solid rgba(27, 54, 93, 0.4)',
              borderRight: '1px solid rgba(255,255,255,0.08)'
            }}>
              GESTIÓN DE PERFILES
            </div>
            <div style={{ background: '#1A1214', borderBottom: '1px solid rgba(255,255,255,0.08)' }} />
            <div style={{ background: '#1A1214', borderBottom: '1px solid rgba(255,255,255,0.08)' }} />
          </div>

          {/* Fila 7 Sheet: Encabezados de las 13 columnas */}
          <div className="table-container" style={{ maxHeight: 460, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#201618', borderBottom: '1px solid rgba(150, 21, 0, 0.2)', position: 'sticky', top: 0, zIndex: 5 }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-primary)', width: 120 }}>Psicóloga</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#ffb3b3', title: 'Asignados en PROFILES' }}>Tab Profile</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#ffb3b3', title: 'Asignados tab de Matches' }}>Asignados Matches</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#ffb3b3' }}>Hechos</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#4CAF50' }}>Aprobados</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#ff8585' }}>No aprob.</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#FFC107' }}>Trouble</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#9A8A8D' }}>No hay gente</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#b3d1ff' }}>Sin trabajar</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#b3d1ff', fontSize: 11 }}>Fecha en blanco</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#b3d1ff' }}>Listos Match</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#FFC107' }}>Refunds</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)', width: 95 }}>ESTADO</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                      Cargando métricas de psicólogas...
                    </td>
                  </tr>
                ) : data?.rendimiento_psicologas?.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                      No se encontraron registros de psicólogas en este rango.
                    </td>
                  </tr>
                ) : (
                  data?.rendimiento_psicologas?.map((row, idx) => (
                    <tr key={row.psicologa} style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)'
                    }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {row.psicologa}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace' }}>
                        {row.tab_profile}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace' }}>
                        {row.asignados_matches}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace' }}>
                        {row.hechos}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: '#4CAF50' }}>
                        {row.aprobados}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: row.no_aprobados > 0 ? '#ff8585' : 'var(--text-muted)' }}>
                        {row.no_aprobados}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: row.trouble > 0 ? '#FFC107' : 'var(--text-muted)' }}>
                        {row.trouble}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {row.no_hay_gente}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: row.sin_trabajar > 5 ? 700 : 400, color: row.sin_trabajar > 5 ? '#ff6b6b' : 'var(--text-primary)' }}>
                        {row.sin_trabajar}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>
                        {row.fecha_en_blanco}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace' }}>
                        {row.listos_match}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: row.refunds > 0 ? '#ff8585' : 'var(--text-muted)' }}>
                        {row.refunds}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          ...getEstadoBadgeStyle(row.estado)
                        }}>
                          {row.estado}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Fila de Totales de Equipo */}
              {data?.totales_equipo && (
                <tfoot>
                  <tr style={{ background: '#1E1416', borderTop: '2px solid rgba(150, 21, 0, 0.4)', fontWeight: 800 }}>
                    <td style={{ padding: '10px 12px', color: '#ffb3b3' }}>TOTAL EQUIPO</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace' }}>{data.totales_equipo.tab_profile}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace' }}>{data.totales_equipo.asignados_matches}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace' }}>{data.totales_equipo.hechos}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: '#4CAF50' }}>{data.totales_equipo.aprobados}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: '#ff8585' }}>{data.totales_equipo.no_aprobados}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: '#FFC107' }}>{data.totales_equipo.trouble}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace' }}>{data.totales_equipo.no_hay_gente}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: '#ff6b6b' }}>{data.totales_equipo.sin_trabajar}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>—</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace' }}>{data.totales_equipo.listos_match}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: '#ff8585' }}>{data.totales_equipo.refunds}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>SSOT</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Gráfico de Barras Aprobados por Psicóloga */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div className="card-title" style={{ margin: 0, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={16} style={{ color: '#961500' }} /> Matches Aprobados por Psicóloga
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gráfico SSOT</span>
          </div>

          <div style={{ flex: 1, minHeight: 260, position: 'relative' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
                Cargando gráfico...
              </div>
            ) : (
              <Bar data={chartData} options={chartOptions} />
            )}
          </div>

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(150, 21, 0, 0.15)', fontSize: 11, color: 'var(--text-secondary)' }}>
            💡 Muestra la productividad de validación técnica aprobada por María para cada psicóloga en el periodo.
          </div>
        </div>
      </div>

      {/* ─── 4. TABLA 2: EMBUDO DE CONVERSIÓN END-TO-END (PIPELINE OPERATIVO) ─── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(27, 54, 93, 0.4)', marginBottom: 28 }}>
        <div style={{
          background: '#1B365D',
          color: 'white',
          padding: '12px 18px',
          fontSize: 14,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span>🔄 TABLA 2: EMBUDO DE CONVERSIÓN END-TO-END (PIPELINE OPERATIVO)</span>
        </div>

        <div className="table-container">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#162338', borderBottom: '1px solid rgba(27, 54, 93, 0.3)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700 }}>Etapa del Embudo</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, width: 100 }}>Casos</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, width: 120 }}>% Etapa Anterior</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, width: 120 }}>% Global Embudo</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700 }}>Diagnóstico Operativo</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, width: 120 }}>Meta Recomendada</th>
              </tr>
            </thead>
            <tbody>
              {data?.embudo_pipeline?.map((st, idx) => (
                <tr key={st.etapa} style={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)'
                }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {st.etapa}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}>
                    {st.casos}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 700, color: st.pct_etapa_anterior >= 80 ? '#4CAF50' : '#FFC107' }}>
                        {st.pct_etapa_anterior}%
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#6BA4E8' }}>
                    {st.pct_global}%
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 12 }}>
                    {st.diagnostico}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#90CAF9' }}>
                    {st.meta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 5. FILA INFERIOR: TABLAS 3, 4 Y 5 ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {/* TABLA 3: CALIDAD REAL DEL MATCHMAKING */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(120, 40, 31, 0.4)' }}>
          <div style={{
            background: '#78281F',
            color: 'white',
            padding: '12px 16px',
            fontSize: 13,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span>❤️ TABLA 3: CALIDAD REAL (% QUÍMICA)</span>
          </div>

          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#251516', borderBottom: '1px solid rgba(120, 40, 31, 0.3)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Resultado</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Citas</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>% Evaluado</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Impacto</th>
                </tr>
              </thead>
              <tbody>
                {data?.calidad_quimica?.map((row, idx) => (
                  <tr key={row.resultado} style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)'
                  }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.resultado}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'center', fontFamily: 'monospace' }}>{row.citas}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700, color: row.tipo === 'positivo' ? '#4CAF50' : row.tipo === 'negativo' ? '#ff8585' : 'var(--text-muted)' }}>
                      {row.pct}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#ffb3b3' }}>{row.impacto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TABLA 4: MAPA DE DÉFICIT POR CIUDAD */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(14, 98, 81, 0.4)' }}>
          <div style={{
            background: '#0E6251',
            color: 'white',
            padding: '12px 16px',
            fontSize: 13,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span>📍 TABLA 4: MAPA DE DÉFICIT POR CIUDAD</span>
          </div>

          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#122521', borderBottom: '1px solid rgba(14, 98, 81, 0.3)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Ciudad</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Orientación</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Espera</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Nivel</th>
                </tr>
              </thead>
              <tbody>
                {data?.mapa_deficit?.map((row, idx) => (
                  <tr key={`${row.ciudad}-${row.orientacion}`} style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)'
                  }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{row.ciudad}</td>
                    <td style={{ padding: '10px 10px', color: 'var(--text-secondary)' }}>{row.orientacion}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}>{row.clientes_en_espera}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11 }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: row.nivel_deficit.includes('Crítico') ? 'rgba(244, 67, 54, 0.15)' : row.nivel_deficit.includes('Demanda') ? 'rgba(255, 193, 7, 0.15)' : 'rgba(76, 175, 80, 0.15)',
                        color: row.nivel_deficit.includes('Crítico') ? '#ff8585' : row.nivel_deficit.includes('Demanda') ? '#FFC107' : '#4CAF50'
                      }}>
                        {row.nivel_deficit}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TABLA 5: ANÁLISIS DE REFUNDS */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(125, 102, 8, 0.4)' }}>
          <div style={{
            background: '#7D6608',
            color: 'white',
            padding: '12px 16px',
            fontSize: 13,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span>💸 TABLA 5: MOTIVOS DE REFUND FRECUENTES</span>
          </div>

          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#262210', borderBottom: '1px solid rgba(125, 102, 8, 0.3)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Motivo</th>
                  <th style={{ padding: '8px 8px', textAlign: 'center' }}>Casos</th>
                  <th style={{ padding: '8px 8px', textAlign: 'center' }}>%</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Prio</th>
                </tr>
              </thead>
              <tbody>
                {data?.analisis_refunds?.map((row, idx) => (
                  <tr key={row.motivo} style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)'
                  }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.motivo}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace' }}>{row.casos}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#FFC107' }}>{row.pct}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: row.prioridad === 'Alta' ? '#ff8585' : '#FFC107' }}>
                      {row.prioridad}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
