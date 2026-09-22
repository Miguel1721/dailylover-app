import React, { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, Calendar, Download, RefreshCw, Users, Coffee,
  Award, Clock, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight,
  ShieldAlert, Sparkles, MessageSquare, ExternalLink, FileSpreadsheet,
  Headphones, BarChart3, Target, ArrowUpRight, ArrowDownRight, Edit3, Save, X
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia')))
  ? window.location.origin 
  : 'https://daily-lover.agentesia.cloud'

export default function DashboardKPIs() {
  const { token, user } = useAuth()

  // Navigation tab: 'commercial' | 'matchmakers' | 'cs'
  const [activeTab, setActiveTab] = useState('commercial')

  // Date filters
  const now = new Date()
  const [year, setYear] = useState(2026)
  const [month, setMonth] = useState(9) // Septiembre por defecto

  // ─── 1. COMMERCIAL KPIS STATE ──────────────────────────────────────────────
  const [commData, setCommData] = useState(null)
  const [loadingComm, setLoadingComm] = useState(true)

  // ─── 2. MATCHMAKER EFFICIENCY STATE ────────────────────────────────────────
  const [mmData, setMmData] = useState(null)
  const [mmCommitment, setMmCommitment] = useState([])
  const [loadingMm, setLoadingMm] = useState(false)
  const [evalModal, setEvalModal] = useState(null) // mm object to evaluate
  const [evalForm, setEvalForm] = useState({
    cumplimiento: 4,
    puntualidad: 4,
    gestion_perfiles: 4,
    calidad_entrevistas: 4,
    seguimiento: 4,
    compromiso: 4,
    missed_miguel_meetings: 0,
    observations: ''
  })
  const [savingEval, setSavingEval] = useState(false)

  // ─── 3. CUSTOMER SERVICE (CS) STATE ────────────────────────────────────────
  const [csData, setCsData] = useState(null)
  const [loadingCs, setLoadingCs] = useState(false)

  // ─── FETCH COMMERCIAL KPIS ─────────────────────────────────────────────────
  const fetchCommercial = useCallback(async () => {
    setLoadingComm(true)
    try {
      const res = await fetch(`${API}/api/v1/admin/reports/commercial-kpis?year=${year}&month=${month}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setCommData(data)
      }
    } catch (e) {
      console.error('Error fetching commercial KPIs:', e)
    } finally {
      setLoadingComm(false)
    }
  }, [token, year, month])

  // ─── FETCH MATCHMAKER METRICS ──────────────────────────────────────────────
  const fetchMatchmakers = useCallback(async () => {
    setLoadingMm(true)
    try {
      const [resEff, resComm] = await Promise.all([
        fetch(`${API}/api/v1/work-time/matchmaker-shift-efficiency?year=${year}&month=${month}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/api/v1/work-time/commitment-scores?year=${year}&month=${month}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      if (resEff.ok) {
        const dEff = await resEff.json()
        setMmData(dEff)
      }
      if (resComm.ok) {
        const dComm = await resComm.json()
        setMmCommitment(dComm.evaluations || [])
      }
    } catch (e) {
      console.error('Error fetching matchmaker KPIs:', e)
    } finally {
      setLoadingMm(false)
    }
  }, [token, year, month])

  // ─── FETCH CS METRICS ──────────────────────────────────────────────────────
  const fetchCS = useCallback(async () => {
    setLoadingCs(true)
    try {
      const res = await fetch(`${API}/api/v1/scheduling/cs-daily-metrics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setCsData(data)
      }
    } catch (e) {
      console.error('Error fetching CS metrics:', e)
    } finally {
      setLoadingCs(false)
    }
  }, [token])

  useEffect(() => {
    if (activeTab === 'commercial') fetchCommercial()
    else if (activeTab === 'matchmakers') fetchMatchmakers()
    else if (activeTab === 'cs') fetchCS()
  }, [activeTab, fetchCommercial, fetchMatchmakers, fetchCS])

  const handleExportCSV = () => {
    window.open(`${API}/api/v1/admin/reports/commercial-kpis/export-csv?year=${year}&month=${month}`, '_blank')
  }

  const handleOpenEvalModal = (mm) => {
    // Buscar evaluación existente
    const existing = mmCommitment.find(e => e.matchmaker_name.toUpperCase() === mm.name.toUpperCase() || e.matchmaker_name.toUpperCase() === mm.key.toUpperCase())
    if (existing) {
      setEvalForm({
        cumplimiento: existing.cumplimiento,
        puntualidad: existing.puntualidad,
        gestion_perfiles: existing.gestion_perfiles,
        calidad_entrevistas: existing.calidad_entrevistas,
        seguimiento: existing.seguimiento,
        compromiso: existing.compromiso,
        missed_miguel_meetings: existing.missed_miguel_meetings,
        observations: existing.observations || ''
      })
    } else {
      setEvalForm({
        cumplimiento: 3,
        puntualidad: 3,
        gestion_perfiles: 3,
        calidad_entrevistas: 3,
        seguimiento: 3,
        compromiso: 3,
        missed_miguel_meetings: 0,
        observations: ''
      })
    }
    setEvalModal(mm)
  }

  const handleSaveEval = async (e) => {
    e.preventDefault()
    if (!evalModal) return
    setSavingEval(true)
    try {
      const res = await fetch(`${API}/api/v1/work-time/commitment-scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          year,
          month,
          matchmaker_name: evalModal.name,
          ...evalForm
        })
      })
      if (res.ok) {
        setEvalModal(null)
        fetchMatchmakers()
      }
    } catch (err) {
      console.error('Error saving eval:', err)
    } finally {
      setSavingEval(false)
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1440, margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(235, 0, 141, 0.2) 0%, rgba(150, 21, 0, 0.2) 100%)',
              border: '1px solid rgba(235, 0, 141, 0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#EB008D'
            }}>
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                Tablero Ejecutivo de KPIs Operativos
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                Consolidado oficial de metas de María, Lina y Miguel. Sincronizado automáticamente desde la base de datos.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Selector de Mes y Año */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              <option value="8">Agosto</option>
              <option value="9">Septiembre</option>
              <option value="10">Octubre</option>
              <option value="11">Noviembre</option>
              <option value="12">Diciembre</option>
            </select>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>2026</span>
          </div>

          {activeTab === 'commercial' && (
            <button
              onClick={handleExportCSV}
              className="btn btn-secondary"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 16px', fontSize: 13, fontWeight: 700,
                background: 'rgba(16, 185, 129, 0.12)', color: '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.3)', cursor: 'pointer', borderRadius: 8
              }}
              title="Descargar plantilla de cálculo CSV idéntica a Google Sheets"
            >
              <Download size={15} />
              Exportar a CSV / Excel
            </button>
          )}

          <button
            onClick={() => {
              if (activeTab === 'commercial') fetchCommercial()
              else if (activeTab === 'matchmakers') fetchMatchmakers()
              else fetchCS()
            }}
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', fontSize: 13 }}
            title="Recargar datos"
          >
            <RefreshCw size={15} className={(loadingComm || loadingMm || loadingCs) ? 'spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
        <button
          onClick={() => setActiveTab('commercial')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 10, border: 'none',
            background: activeTab === 'commercial' ? 'linear-gradient(135deg, #EB008D 0%, #B8324F 100%)' : 'var(--bg-card)',
            color: activeTab === 'commercial' ? '#FFF' : 'var(--text-secondary)',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: activeTab === 'commercial' ? '0 4px 14px rgba(235, 0, 141, 0.35)' : 'none'
          }}
        >
          <Target size={16} />
          🎯 Clientes Nuevos & Metas Diarias (15/día)
        </button>

        <button
          onClick={() => setActiveTab('matchmakers')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 10, border: 'none',
            background: activeTab === 'matchmakers' ? 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)' : 'var(--bg-card)',
            color: activeTab === 'matchmakers' ? '#FFF' : 'var(--text-secondary)',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: activeTab === 'matchmakers' ? '0 4px 14px rgba(59, 130, 246, 0.35)' : 'none'
          }}
        >
          <Clock size={16} />
          ⏱️ Rendimiento Matchmakers & Compromiso
        </button>

        <button
          onClick={() => setActiveTab('cs')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 10, border: 'none',
            background: activeTab === 'cs' ? 'linear-gradient(135deg, #10B981 0%, #047857 100%)' : 'var(--bg-card)',
            color: activeTab === 'cs' ? '#FFF' : 'var(--text-secondary)',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: activeTab === 'cs' ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none'
          }}
        >
          <Headphones size={16} />
          🎧 Métricas Automatizadas CS (Citas & Reservas)
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PESTAÑA 1: CLIENTES NUEVOS & METAS DIARIAS                            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'commercial' && (
        <div>
          {/* Summary KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 14,
            marginBottom: 24
          }}>
            {/* Acumulado Mes vs Meta */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid rgba(235, 0, 141, 0.3)',
              borderRadius: 14, padding: 20
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Acumulado {commData?.month_name}
                </span>
                <span style={{
                  background: 'rgba(235, 0, 141, 0.15)', color: '#EB008D',
                  padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800
                }}>
                  Meta: {commData?.monthly_target || 350}
                </span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#EB008D' }}>
                {loadingComm ? '...' : commData?.total_month?.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Cumplimiento mes: <strong style={{ color: '#FFF' }}>{commData?.compliance_month_pct}%</strong>
              </div>
            </div>

            {/* Meta diaria de 15 */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: 14, padding: 20
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Meta Diaria Resto Mes
              </span>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#3B82F6', marginTop: 4 }}>
                15 <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-muted)' }}>clientes/día</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Objetivo operacional fijado por María
              </div>
            </div>

            {/* Bogotá */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: 14, padding: 20
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Bogotá
              </span>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#60A5FA', marginTop: 4 }}>
                {loadingComm ? '...' : commData?.summary_by_city?.bogota?.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {commData?.summary_by_city?.pct_bogota}% del total
              </div>
            </div>

            {/* Medellín */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: 14, padding: 20
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Medellín
              </span>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#34D399', marginTop: 4 }}>
                {loadingComm ? '...' : commData?.summary_by_city?.medellin?.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {commData?.summary_by_city?.pct_medellin}% del total
              </div>
            </div>

            {/* Eje Cafetero (Agrupado Oficial) */}
            <div style={{
              background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: 14, padding: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Coffee size={14} color="#F59E0B" />
                <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700, textTransform: 'uppercase' }}>
                  Eje Cafetero
                </span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#F59E0B', marginTop: 4 }}>
                {loadingComm ? '...' : commData?.summary_by_city?.eje_cafetero?.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Pereira, Manizales, Armenia ({commData?.summary_by_city?.pct_eje_cafetero}%)
              </div>
            </div>
          </div>

          {/* Daily Breakdown Table (Replica exacta del Google Sheet de Lina) */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 14, overflow: 'hidden', marginBottom: 28,
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--border-color)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                  Seguimiento Diario · {commData?.month_name} {commData?.year}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Meta: 15 clientes al día. Meta acumulada = meta diaria × días transcurridos.
                </p>
              </div>
            </div>

            {loadingComm ? (
              <div style={{ padding: 60, textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Calculando métricas diarias...</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Fecha</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Bogotá</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Medellín</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Cali</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Miami</th>
                      <th style={{ padding: '12px 10px', fontWeight: 700, color: '#F59E0B', fontSize: 11 }}>Eje Cafetero</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Otras</th>
                      <th style={{ padding: '12px 12px', fontWeight: 800, color: '#FFF', fontSize: 11, background: 'rgba(255,255,255,0.03)' }}>Total Día</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Meta Día</th>
                      <th style={{ padding: '12px 12px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>% Cumplimiento</th>
                      <th style={{ padding: '12px 12px', fontWeight: 800, color: '#60A5FA', fontSize: 11, background: 'rgba(59, 130, 246, 0.05)' }}>Acumulado</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Meta Acum.</th>
                      <th style={{ padding: '12px 12px', fontWeight: 800, fontSize: 11 }}>% Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commData?.days?.map((d) => {
                      const dayCompliant = d.total_day >= d.target_day
                      const cumCompliant = d.cumulative >= d.target_cumulative

                      return (
                        <tr key={d.day} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>{d.date}</td>
                          <td style={{ padding: '10px 10px' }}>{d.bogota || '-'}</td>
                          <td style={{ padding: '10px 10px' }}>{d.medellin || '-'}</td>
                          <td style={{ padding: '10px 10px' }}>{d.cali || '-'}</td>
                          <td style={{ padding: '10px 10px' }}>{d.miami || '-'}</td>
                          <td style={{ padding: '10px 10px', fontWeight: d.eje_cafetero > 0 ? 700 : 400, color: d.eje_cafetero > 0 ? '#F59E0B' : 'inherit' }}>
                            {d.eje_cafetero || '-'}
                          </td>
                          <td style={{ padding: '10px 10px' }}>{d.otras || '-'}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 800, background: 'rgba(255,255,255,0.03)' }}>
                            {d.total_day}
                          </td>
                          <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>{d.target_day}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: dayCompliant ? '#10B981' : '#EF4444' }}>
                            {d.compliance_day_pct}%
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: '#60A5FA', background: 'rgba(59, 130, 246, 0.05)' }}>
                            {d.cumulative}
                          </td>
                          <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>{d.target_cumulative}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: cumCompliant ? '#10B981' : '#F59E0B' }}>
                            {d.compliance_cumulative_pct}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'rgba(235, 0, 141, 0.08)', fontWeight: 800 }}>
                      <td style={{ padding: '12px 14px', textAlign: 'left' }}>Total Mes</td>
                      <td style={{ padding: '12px 10px' }}>{commData?.summary_by_city?.bogota}</td>
                      <td style={{ padding: '12px 10px' }}>{commData?.summary_by_city?.medellin}</td>
                      <td style={{ padding: '12px 10px' }}>{commData?.summary_by_city?.cali}</td>
                      <td style={{ padding: '12px 10px' }}>{commData?.summary_by_city?.miami}</td>
                      <td style={{ padding: '12px 10px', color: '#F59E0B' }}>{commData?.summary_by_city?.eje_cafetero}</td>
                      <td style={{ padding: '12px 10px' }}>{commData?.summary_by_city?.otras}</td>
                      <td style={{ padding: '12px 12px', fontSize: 14, color: '#EB008D' }}>{commData?.total_month}</td>
                      <td style={{ padding: '12px 10px' }}>{commData?.monthly_target}</td>
                      <td style={{ padding: '12px 12px', color: '#10B981' }}>{commData?.compliance_month_pct}%</td>
                      <td colSpan={3} style={{ textAlign: 'right', paddingRight: 20, color: 'var(--text-muted)' }}>
                        Sincronizado con Stripe & Nequi
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Historical Monthly Comparison Table (Sheet Clientes por Ciudad) */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                Comparativa Histórica Mensual · 2026
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Evolución de clientes nuevos por ciudad desde enero.
              </p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Mes</th>
                    <th style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-muted)' }}>Bogotá</th>
                    <th style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-muted)' }}>Medellín</th>
                    <th style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-muted)' }}>Cali</th>
                    <th style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-muted)' }}>Miami</th>
                    <th style={{ padding: '12px 10px', fontWeight: 700, color: '#F59E0B' }}>Eje Cafetero</th>
                    <th style={{ padding: '12px 12px', fontWeight: 800, color: '#FFF' }}>Total</th>
                    <th style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--text-muted)' }}>Crecimiento</th>
                    <th style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-muted)' }}>Meta</th>
                    <th style={{ padding: '12px 12px', fontWeight: 700 }}>% Cumplimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {commData?.historical_months?.map((hm) => (
                    <tr key={hm.month} style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: hm.month === month ? 'rgba(235, 0, 141, 0.05)' : 'transparent'
                    }}>
                      <td style={{ padding: '10px 14px', textAlign: 'left', fontWeight: hm.month === month ? 800 : 600 }}>
                        {hm.name} {hm.month === month && '👈'}
                      </td>
                      <td style={{ padding: '10px 10px' }}>{hm.bogota || '-'}</td>
                      <td style={{ padding: '10px 10px' }}>{hm.medellin || '-'}</td>
                      <td style={{ padding: '10px 10px' }}>{hm.cali || '-'}</td>
                      <td style={{ padding: '10px 10px' }}>{hm.miami || '-'}</td>
                      <td style={{ padding: '10px 10px', color: '#F59E0B' }}>{hm.eje_cafetero || '-'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 800 }}>{hm.total}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {hm.growth_pct !== null ? (
                          <span style={{ color: hm.growth_pct >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                            {hm.growth_pct >= 0 ? '+' : ''}{hm.growth_pct}%
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>{hm.target}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: hm.compliance_pct >= 70 ? '#10B981' : '#F59E0B' }}>
                        {hm.compliance_pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PESTAÑA 2: RENDIMIENTO MATCHMAKERS & COMPROMISO                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'matchmakers' && (
        <div>
          {/* Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
            marginBottom: 24
          }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 20 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Horas Activas del Equipo
              </span>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#3B82F6', marginTop: 4 }}>
                {loadingMm ? '...' : mmData?.team_summary?.total_team_hours} h
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Horas efectivas en turnos registrados
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 20 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Matches Realizados
              </span>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#10B981', marginTop: 4 }}>
                {loadingMm ? '...' : mmData?.team_summary?.total_matches_produced}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {mmData?.team_summary?.total_matches_approved} aprobados por María
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 20 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Tasa de Aprobación Global
              </span>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#8B5CF6', marginTop: 4 }}>
                {loadingMm ? '...' : mmData?.team_summary?.overall_approval_rate}%
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Meta de aprobación: 70%
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 20 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Velocidad Promedio Match
              </span>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#F59E0B', marginTop: 4 }}>
                {loadingMm ? '...' : mmData?.team_summary?.overall_avg_minutes_per_match} min
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Benchmark: 20 - 30 min / match
              </div>
            </div>
          </div>

          {/* Table of Matchmakers */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                Matriz de Desempeño y Velocidad por Matchmaker
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Datos objetivos de sesiones registradas vs matches creados en el CRM.
              </p>
            </div>

            {loadingMm ? (
              <div style={{ padding: 60, textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Cargando métricas de psicólogas...</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Psicóloga</th>
                      <th style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Horas en Turno</th>
                      <th style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Matches Creados</th>
                      <th style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Aprobados María</th>
                      <th style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Tasa Aprobación</th>
                      <th style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Minutos / Match</th>
                      <th style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Diagnóstico</th>
                      <th style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Puntaje Compromiso</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textAlign: 'right' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mmData?.matchmakers?.map((mm) => {
                      const evalEntry = mmCommitment.find(e => e.matchmaker_name.toUpperCase() === mm.name.toUpperCase() || e.matchmaker_name.toUpperCase() === mm.key.toUpperCase())

                      return (
                        <tr key={mm.key} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                            <div>{mm.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{mm.role}</div>
                          </td>
                          <td style={{ padding: '12px 12px' }}>{mm.active_hours} h</td>
                          <td style={{ padding: '12px 12px', fontWeight: 700 }}>{mm.matches_count}</td>
                          <td style={{ padding: '12px 12px' }}>{mm.approved_count}</td>
                          <td style={{ padding: '12px 12px', fontWeight: 700, color: mm.approval_rate >= 70 ? '#10B981' : '#F59E0B' }}>
                            {mm.approval_rate}%
                          </td>
                          <td style={{ padding: '12px 12px', fontWeight: 800, color: '#3B82F6' }}>
                            {mm.avg_minutes_per_match > 0 ? `${mm.avg_minutes_per_match} min` : '-'}
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            <span style={{
                              padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                              background: mm.badge_color === 'emerald' ? 'rgba(16, 185, 129, 0.15)' : mm.badge_color === 'rose' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.06)',
                              color: mm.badge_color === 'emerald' ? '#34D399' : mm.badge_color === 'rose' ? '#F87171' : 'var(--text-secondary)'
                            }}>
                              {mm.speed_diagnosis}
                            </span>
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            {evalEntry ? (
                              <div>
                                <span style={{ fontWeight: 800, color: evalEntry.final_score_100 >= 80 ? '#10B981' : '#F59E0B' }}>
                                  {evalEntry.final_score_100} / 100
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
                                  ({evalEntry.average_5}/5)
                                </span>
                                {evalEntry.missed_miguel_meetings > 0 && (
                                  <div style={{ fontSize: 10, color: '#EF4444' }}>
                                    ⚠️ -{evalEntry.missed_miguel_meetings * 5} pts (Reuniones)
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin evaluar</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <button
                              onClick={() => handleOpenEvalModal(mm)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)',
                                background: 'var(--bg-base)', color: 'var(--text-primary)',
                                fontSize: 12, fontWeight: 600, cursor: 'pointer'
                              }}
                            >
                              <Edit3 size={13} /> Evaluar
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PESTAÑA 3: CUSTOMER SERVICE (CS)                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'cs' && (
        <div>
          {/* Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
            marginBottom: 24
          }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 20 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Citas Agendadas
              </span>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#3B82F6', marginTop: 4 }}>
                {loadingCs ? '...' : csData?.summary?.total_scheduled_dates?.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Citas de pareja gestionadas en el sistema
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 20 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Citas Reprogramadas
              </span>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#EF4444', marginTop: 4 }}>
                {loadingCs ? '...' : csData?.summary?.total_rescheduled?.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Tasa de reprogramación: {csData?.summary?.reschedule_rate_pct}%
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 20 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Reservas Confirmadas en Restaurantes
              </span>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#10B981', marginTop: 4 }}>
                {loadingCs ? '...' : csData?.summary?.total_confirmed_reservations?.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Mesas reservadas por Servicio al Cliente
              </div>
            </div>

            {/* Eje Cafetero CS */}
            <div style={{
              background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: 14, padding: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Coffee size={14} color="#F59E0B" />
                <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700, textTransform: 'uppercase' }}>
                  Eje Cafetero (Citas)
                </span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#F59E0B', marginTop: 4 }}>
                {loadingCs ? '...' : csData?.summary?.scheduled_by_city?.['Eje Cafetero'] || 0}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Reservas hechas: {csData?.summary?.reservations_by_city?.['Eje Cafetero'] || 0}
              </div>
            </div>
          </div>

          {/* Daily CS Table */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                Registro Diario de Operaciones CS
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Citas y reservas registradas por fecha y ciudad en DailyLover.
              </p>
            </div>

            {loadingCs ? (
              <div style={{ padding: 60, textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Cargando operaciones CS...</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Fecha</th>
                      <th style={{ padding: '12px 10px', fontWeight: 700, color: '#FFF' }}>Citas Agendadas</th>
                      <th style={{ padding: '12px 10px', fontWeight: 700, color: '#EF4444' }}>Reprogramadas</th>
                      <th style={{ padding: '12px 10px', fontWeight: 700, color: '#10B981' }}>Reservas Hechas</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-muted)' }}>Bogotá</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-muted)' }}>Medellín</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-muted)' }}>Cali</th>
                      <th style={{ padding: '12px 10px', fontWeight: 700, color: '#F59E0B' }}>Eje Cafetero</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-muted)' }}>Miami</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csData?.daily_breakdown?.slice(0, 30).map((row) => (
                      <tr key={row.date} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>{row.date}</td>
                        <td style={{ padding: '10px 10px', fontWeight: 800 }}>{row.total_scheduled}</td>
                        <td style={{ padding: '10px 10px', color: row.total_rescheduled > 0 ? '#EF4444' : 'inherit', fontWeight: row.total_rescheduled > 0 ? 700 : 400 }}>
                          {row.total_rescheduled}
                        </td>
                        <td style={{ padding: '10px 10px', fontWeight: 700, color: '#10B981' }}>{row.total_reservations}</td>
                        <td style={{ padding: '10px 10px' }}>{row.by_city?.['Bogotá'] || '-'}</td>
                        <td style={{ padding: '10px 10px' }}>{row.by_city?.['Medellín'] || '-'}</td>
                        <td style={{ padding: '10px 10px' }}>{row.by_city?.['Cali'] || '-'}</td>
                        <td style={{ padding: '10px 10px', color: '#F59E0B', fontWeight: row.by_city?.['Eje Cafetero'] > 0 ? 700 : 400 }}>
                          {row.by_city?.['Eje Cafetero'] || '-'}
                        </td>
                        <td style={{ padding: '10px 10px' }}>{row.by_city?.['Miami'] || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Evaluación de Compromiso */}
      {evalModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 14,
            border: '1px solid var(--border-color)', width: '100%', maxWidth: 500,
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)', padding: 24, color: 'var(--text-primary)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  Evaluación de Compromiso · {evalModal.name}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Período: {String(month).padStart(2, '0')}/2026. Escala 1 a 5 según la rúbrica de María y Lina.
                </p>
              </div>
              <button onClick={() => setEvalModal(null)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEval} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                    Cumplimiento (1-5)
                  </label>
                  <select
                    value={evalForm.cumplimiento}
                    onChange={e => setEvalForm({ ...evalForm, cumplimiento: Number(e.target.value) })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: '#FFF', fontSize: 12 }}
                  >
                    <option value="5">5 - Sobresaliente</option>
                    <option value="4">4 - Cumple Muy Bien</option>
                    <option value="3">3 - Cumple Estándar</option>
                    <option value="2">2 - Parcial</option>
                    <option value="1">1 - No Cumple</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                    Puntualidad (1-5)
                  </label>
                  <select
                    value={evalForm.puntualidad}
                    onChange={e => setEvalForm({ ...evalForm, puntualidad: Number(e.target.value) })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: '#FFF', fontSize: 12 }}
                  >
                    <option value="5">5 - Siempre a tiempo</option>
                    <option value="4">4 - Buena puntualidad</option>
                    <option value="3">3 - Ocasionales retrasos</option>
                    <option value="2">2 - Frecuentes retrasos</option>
                    <option value="1">1 - Crítico</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                    Gestión de Perfiles (1-5)
                  </label>
                  <select
                    value={evalForm.gestion_perfiles}
                    onChange={e => setEvalForm({ ...evalForm, gestion_perfiles: Number(e.target.value) })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: '#FFF', fontSize: 12 }}
                  >
                    <option value="5">5 - Fichas impecables</option>
                    <option value="4">4 - Buena calidad</option>
                    <option value="3">3 - Aceptable</option>
                    <option value="2">2 - Faltan datos</option>
                    <option value="1">1 - Muy incompleta</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                    Calidad Entrevistas (1-5)
                  </label>
                  <select
                    value={evalForm.calidad_entrevistas}
                    onChange={e => setEvalForm({ ...evalForm, calidad_entrevistas: Number(e.target.value) })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: '#FFF', fontSize: 12 }}
                  >
                    <option value="5">5 - Diagnóstico clínico profundo</option>
                    <option value="4">4 - Bueno</option>
                    <option value="3">3 - Estándar</option>
                    <option value="2">2 - Superficial</option>
                    <option value="1">1 - Deficiente</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                    Seguimiento (1-5)
                  </label>
                  <select
                    value={evalForm.seguimiento}
                    onChange={e => setEvalForm({ ...evalForm, seguimiento: Number(e.target.value) })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: '#FFF', fontSize: 12 }}
                  >
                    <option value="5">5 - Seguimiento proactivo</option>
                    <option value="4">4 - Bueno</option>
                    <option value="3">3 - Normal</option>
                    <option value="2">2 - Lento</option>
                    <option value="1">1 - Sin respuesta</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                    Compromiso General (1-5)
                  </label>
                  <select
                    value={evalForm.compromiso}
                    onChange={e => setEvalForm({ ...evalForm, compromiso: Number(e.target.value) })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: '#FFF', fontSize: 12 }}
                  >
                    <option value="5">5 - Máxima dedicación</option>
                    <option value="4">4 - Buen compromiso</option>
                    <option value="3">3 - Cumple horario</option>
                    <option value="2">2 - Bajo compromiso</option>
                    <option value="1">1 - Desconectada</option>
                  </select>
                </div>
              </div>

              {/* Penalización de Reuniones con Miguel */}
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: 10, borderRadius: 8
              }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#F87171', marginBottom: 4 }}>
                  ⚠️ Reuniones con Miguel no asistidas (-5 pts cada una)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={evalForm.missed_miguel_meetings}
                    onChange={e => setEvalForm({ ...evalForm, missed_miguel_meetings: Number(e.target.value) })}
                    style={{ width: 80, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: '#FFF', fontSize: 13, fontWeight: 700 }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Descuento total: <strong style={{ color: '#F87171' }}>-{evalForm.missed_miguel_meetings * 5} puntos</strong> del puntaje sobre 100.
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                  Observaciones Clínicas / Desempeño (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Comentarios adicionales para María o feedback del mes..."
                  value={evalForm.observations}
                  onChange={e => setEvalForm({ ...evalForm, observations: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: '#FFF', fontSize: 12, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setEvalModal(null)}
                  style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: 12 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEval}
                  style={{
                    padding: '8px 18px', borderRadius: 6, border: 'none',
                    background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
                    color: '#FFF', fontWeight: 700, cursor: 'pointer', fontSize: 12
                  }}
                >
                  {savingEval ? 'Guardando...' : 'Guardar Evaluación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
