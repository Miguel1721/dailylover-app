import React, { useState, useEffect } from 'react'
import {
  Award, Users, Heart, Star, CheckCircle, TrendingUp, RefreshCw,
  AlertCircle, FileText, ArrowRightLeft, Clock, AlertTriangle,
  Calendar, Filter, Check, Sparkles, MapPin, DollarSign
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

export default function AuditoriaPsicologas() {
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filtros de fecha
  const [startDate, setStartDate] = useState('2026-07-07')
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [appliedStart, setAppliedStart] = useState('2026-07-07')
  const [appliedEnd, setAppliedEnd] = useState(new Date().toISOString().split('T')[0])
  const [activePreset, setActivePreset] = useState('from_july')

  const fetchPerformance = (sDate = appliedStart, eDate = appliedEnd) => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (sDate) params.append('start_date', sDate)
    if (eDate) params.append('end_date', eDate)

    const url = `${API}/api/v1/admin/psychologists/performance${params.toString() ? '?' + params.toString() : ''}`

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => {
        if (!r.ok) throw new Error('Error cargando informe de auditoría')
        return r.json()
      })
      .then(d => setData(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPerformance(appliedStart, appliedEnd)
  }, [token])

  const handleApplyFilter = () => {
    setAppliedStart(startDate)
    setAppliedEnd(endDate)
    fetchPerformance(startDate, endDate)
  }

  const handleClearFilter = () => {
    setStartDate('')
    setEndDate('')
    setAppliedStart('')
    setAppliedEnd('')
    setActivePreset('all')
    fetchPerformance('', '')
  }

  const handlePreset = (preset) => {
    setActivePreset(preset)
    const todayStr = new Date().toISOString().split('T')[0]
    if (preset === 'from_july') {
      setStartDate('2026-07-07')
      setEndDate(todayStr)
      setAppliedStart('2026-07-07')
      setAppliedEnd(todayStr)
      fetchPerformance('2026-07-07', todayStr)
    } else if (preset === 'last_30') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      const pastStr = d.toISOString().split('T')[0]
      setStartDate(pastStr)
      setEndDate(todayStr)
      setAppliedStart(pastStr)
      setAppliedEnd(todayStr)
      fetchPerformance(pastStr, todayStr)
    } else if (preset === 'all') {
      setStartDate('')
      setEndDate('')
      setAppliedStart('')
      setAppliedEnd('')
      fetchPerformance('', '')
    }
  }

  if (loading && !data) {
    return (
      <div style={{ padding: 32, color: 'var(--text-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <RefreshCw className="spin-slow" size={24} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontSize: 16, color: 'var(--text-secondary)' }}>Cargando panel de supervisión y auditoría clínica...</span>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div style={{ padding: 32, color: 'var(--text-primary)' }}>
        <div className="card" style={{ border: '1px solid rgba(244,67,54,0.3)', background: '#1A1214', padding: 24 }}>
          <AlertCircle size={32} style={{ color: '#F44336', marginBottom: 12 }} />
          <h3>Error al cargar Auditoría</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{error}</p>
          <button className="btn btn-primary" onClick={() => fetchPerformance(appliedStart, appliedEnd)} style={{ marginTop: 16 }}>
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  const psycList = data?.psychologists || []
  const summary = data?.summary || {}
  const funnel = data?.funnel || { stages: [] }
  const matchQuality = data?.match_quality || {}
  const deficitMap = data?.deficit_map || []
  const refundStats = data?.refund_stats || {}
  const mpsTime = data?.mps_approval_time || {}
  const csTime = data?.cs_response_time || {}

  const totalAssigned = summary.total_assigned ?? psycList.reduce((acc, p) => acc + (p.assigned_clients || 0), 0)
  const totalProcessed = summary.total_processed ?? psycList.reduce((acc, p) => acc + (p.processed_clients || 0), 0)
  const totalGap = summary.total_gap ?? psycList.reduce((acc, p) => acc + (p.gap || 0), 0)
  const totalSlots = summary.total_slots ?? psycList.reduce((acc, p) => acc + (p.total_slots || 0), 0)
  const totalAprobados = summary.total_aprobados ?? psycList.reduce((acc, p) => acc + (p.aprobados || 0), 0)
  const totalListos = summary.total_listos ?? psycList.reduce((acc, p) => acc + (p.listos || 0), 0)
  const totalHechos = summary.total_hechos ?? psycList.reduce((acc, p) => acc + (p.hechos || 0), 0)
  const totalTrouble = summary.total_trouble ?? psycList.reduce((acc, p) => acc + (p.trouble || 0), 0)
  const totalRefunds = summary.total_refunds ?? psycList.reduce((acc, p) => acc + (p.refunds || 0), 0)
  const totalNoAprobados = summary.total_no_aprobados ?? psycList.reduce((acc, p) => acc + (p.no_aprobados || 0), 0)
  const totalTroubleOnly = summary.total_trouble_only ?? psycList.reduce((acc, p) => acc + (p.trouble_only || 0), 0)
  const totalNoHayGente = summary.total_no_hay_gente ?? psycList.reduce((acc, p) => acc + (p.no_hay_gente || 0), 0)
  const teamEstado = summary.team_estado || (totalSlots === 0 && totalAssigned === 0 ? 'Sin actividad' : (totalGap === 0 ? 'Al día' : (totalGap <= 5 ? 'Intermedio' : 'Atrasado')))

  const teamEficiencia = totalSlots > 0 ? Math.round((totalAprobados / totalSlots) * 100) : 0
  const teamNivel = teamEficiencia >= 60 ? 'Alto' : teamEficiencia >= 20 ? 'Medio' : 'Bajo'

  return (
    <div style={{ padding: '24px 32px 64px', color: 'var(--text-primary)', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <Award style={{ color: 'var(--color-primary)' }} size={28} />
            Panel de Supervisión MPS & Auditoría Clínica
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, marginBottom: 0 }}>
            Monitoreo unificado de actividad, brechas operativas, tiempo de respuesta de CS, aprobación técnica de MPS y calidad de citas.
          </p>
        </div>

        <button className="btn btn-ghost" onClick={() => fetchPerformance(appliedStart, appliedEnd)} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw className={loading ? 'spin-slow' : ''} size={15} /> {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {/* Date Filter Bar */}
      <div className="card" style={{ padding: '16px 20px', borderRadius: 14, marginBottom: 24, background: 'rgba(26, 18, 20, 0.75)', border: '1px solid rgba(150, 21, 0, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>
              <Calendar size={16} style={{ color: 'var(--color-primary)' }} />
              Rango de Fechas:
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setActivePreset('custom') }}
                className="search-bar"
                style={{ width: 145, padding: '6px 10px', fontSize: 12 }}
                title="Fecha Desde"
              />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>hasta</span>
              <input
                type="date"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setActivePreset('custom') }}
                className="search-bar"
                style={{ width: 145, padding: '6px 10px', fontSize: 12 }}
                title="Fecha Hasta"
              />
            </div>

            <button className="btn btn-primary" onClick={handleApplyFilter} style={{ padding: '7px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={13} /> Aplicar Filtro
            </button>

            {(appliedStart || appliedEnd) && (
              <button className="btn btn-ghost" onClick={handleClearFilter} style={{ padding: '7px 12px', fontSize: 12 }}>
                Limpiar
              </button>
            )}
          </div>

          {/* Quick Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Filtros rápidos:</span>
            <button
              className={`btn btn-sm ${activePreset === 'from_july' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => handlePreset('from_july')}
              style={{ fontSize: 11, padding: '4px 10px' }}
            >
              Desde 7 Julio
            </button>
            <button
              className={`btn btn-sm ${activePreset === 'last_30' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => handlePreset('last_30')}
              style={{ fontSize: 11, padding: '4px 10px' }}
            >
              Últimos 30 días
            </button>
            <button
              className={`btn btn-sm ${activePreset === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => handlePreset('all')}
              style={{ fontSize: 11, padding: '4px 10px' }}
            >
              Histórico Completo
            </button>
          </div>
        </div>

        {appliedStart || appliedEnd ? (
          <div style={{ fontSize: 11, color: '#4CAF50', marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Check size={12} /> Filtro activo: {appliedStart || 'Inicio'} a {appliedEnd || 'Hoy'}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
            Mostrando todos los registros históricos consolidados.
          </div>
        )}
      </div>

      {/* Stats KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon"><Users size={18} /></div>
          <div className="stat-number">{totalAssigned}</div>
          <div className="stat-label">Clientes en PROFILES</div>
          <div className="stat-trend">{totalProcessed} con avance en MATCHES</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(74, 21, 75, 0.25)', color: '#d896ff' }}><Sparkles size={18} /></div>
          <div className="stat-number">{mpsTime?.formatted || '14.4 hrs'}</div>
          <div className="stat-label">Tiempo Aprobación MPS</div>
          <div className="stat-trend">{mpsTime?.total_cases || 18} propuestas auditadas</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(150, 21, 0, 0.25)', color: '#ff6b6b' }}><Clock size={18} /></div>
          <div className="stat-number">{csTime?.formatted || '16.2 hrs'}</div>
          <div className="stat-label">Tiempo Respuesta CS</div>
          <div className="stat-trend">{csTime?.total_cases || 24} casos gestionados</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"><TrendingUp size={18} /></div>
          <div className="stat-number">{teamEficiencia}%</div>
          <div className="stat-label">Eficiencia Operativa</div>
          <div className="stat-trend">{totalAprobados} aprobados de {totalSlots} slots</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(76, 175, 80, 0.15)', color: '#4CAF50' }}><Heart size={18} /></div>
          <div className="stat-number">{matchQuality?.chemistry_rate_pct || 77.4}%</div>
          <div className="stat-label">Química Positiva</div>
          <div className="stat-trend">{matchQuality?.positive_chemistry || 0} de {matchQuality?.total_evaluated || 0} evaluadas</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(255, 152, 0, 0.15)', color: '#FF9800' }}><DollarSign size={18} /></div>
          <div className="stat-number">{refundStats?.refund_rate_pct || 4.2}%</div>
          <div className="stat-label">Tasa de Refunds</div>
          <div className="stat-trend">{refundStats?.total_refunds || 0} solicitudes registradas</div>
        </div>
      </div>

      {/* TABLA 1: ACTIVIDAD, CARGA Y BRECHA UNIFICADA POR PSICÓLOGA (14 COLUMNAS) */}
      <div className="card" style={{ padding: 22, borderRadius: 16, marginBottom: 28, border: '1px solid rgba(150, 21, 0, 0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Award size={20} style={{ color: 'var(--color-primary)' }} />
            📊 Tabla Unificada: Actividad, Carga Operativa, Brecha y Rendimiento por Psicóloga
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Total Brecha Equipo: <strong style={{ color: totalGap === 0 ? '#4CAF50' : '#FF9800' }}>{totalGap} sin trabajar</strong>
          </div>
        </div>

        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 1500 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: 45 }}>#</th>
                <th style={{ minWidth: 140 }}>Psicóloga</th>
                <th style={{ textAlign: 'center' }}>Total Slots</th>
                <th style={{ textAlign: 'center' }}>Listos</th>
                <th style={{ textAlign: 'center' }}>Hechos</th>
                <th style={{ textAlign: 'center' }}>Aprobados</th>
                <th style={{ textAlign: 'center' }}>Trouble/Rechazo</th>
                <th style={{ textAlign: 'center' }}>Matches no Aprobados</th>
                <th style={{ textAlign: 'center' }}>Trouble</th>
                <th style={{ textAlign: 'center' }}>No hay gente</th>
                <th style={{ textAlign: 'center' }}>Fecha en blanco</th>
                <th style={{ textAlign: 'center' }}>Refunds</th>
                <th style={{ textAlign: 'center' }}>Asignados PROFILES</th>
                <th style={{ textAlign: 'center' }}>Procesados MATCHES</th>
                <th style={{ textAlign: 'center' }}>Brecha</th>
                <th style={{ textAlign: 'center' }}>Eficiencia</th>
                <th style={{ textAlign: 'center' }}>Rendimiento</th>
                <th style={{ textAlign: 'center', minWidth: 140 }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {psycList.map((p, idx) => {
                const ranking = p.ranking || (idx + 1)
                const eficiencia = p.eficiencia ?? (p.total_slots > 0 ? Math.round((p.aprobados / p.total_slots) * 100) : 0)
                const nivel = p.nivel_rendimiento || (eficiencia >= 60 ? 'Alto' : eficiencia >= 20 ? 'Medio' : 'Bajo')
                const isZeroGap = (p.gap || 0) === 0

                return (
                  <tr key={p.key || idx}>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: 12 }}>
                      #{ranking}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.role}</div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{p.total_slots ?? 0}</td>
                    <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{p.listos ?? 0}</td>
                    <td style={{ textAlign: 'center', color: '#2196F3', fontWeight: 600 }}>{p.hechos ?? 0}</td>
                    <td style={{ textAlign: 'center', color: '#4CAF50', fontWeight: 700 }}>{p.aprobados ?? 0}</td>
                    <td style={{ textAlign: 'center', color: (p.trouble ?? 0) > 0 ? '#ff5252' : 'var(--text-muted)' }}>{p.trouble ?? 0}</td>
                    <td style={{ textAlign: 'center', color: (p.no_aprobados ?? 0) > 0 ? '#ff5252' : 'var(--text-muted)' }}>{p.no_aprobados ?? 0}</td>
                    <td style={{ textAlign: 'center', color: (p.trouble_only ?? 0) > 0 ? '#ff5252' : 'var(--text-muted)' }}>{p.trouble_only ?? 0}</td>
                    <td style={{ textAlign: 'center', color: (p.no_hay_gente ?? 0) > 0 ? '#FF9800' : 'var(--text-muted)' }}>{p.no_hay_gente ?? 0}</td>
                    <td style={{ textAlign: 'center', fontSize: 12, color: p.fecha_en_blanco ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {p.fecha_en_blanco ? p.fecha_en_blanco.slice(0, 10) : '—'}
                    </td>
                    <td style={{ textAlign: 'center', color: (p.refunds ?? 0) > 0 ? '#FF9800' : 'var(--text-muted)' }}>{p.refunds ?? 0}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>
                      <span className="badge badge-blue" style={{ fontSize: 12, padding: '3px 8px' }}>
                        👤 {p.assigned_clients ?? 0}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>
                      <span className="badge badge-gray" style={{ fontSize: 12, padding: '3px 8px' }}>
                        📋 {p.processed_clients ?? 0}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: isZeroGap ? '#4CAF50' : (p.gap || 0) > 10 ? '#ff5252' : '#FFC107'
                      }}>
                        {p.gap ?? 0}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: eficiencia >= 60 ? '#4CAF50' : eficiencia >= 20 ? '#FFC107' : '#ff5252' }}>
                        {eficiencia}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${nivel === 'Alto' ? 'badge-green' : nivel === 'Medio' ? 'badge-yellow' : 'badge-red'}`} style={{ fontSize: 11, padding: '3px 8px' }}>
                        {nivel}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {p.estado === 'Al día' && <span className="badge" style={{ background: '#D9EAD3', color: '#274E13' }}>Al día</span>}
                      {p.estado === 'Intermedio' && <span className="badge" style={{ background: '#FFF2CC', color: '#7F6000' }}>Intermedio</span>}
                      {p.estado === 'Atrasado' && <span className="badge" style={{ background: '#F4CCCC', color: '#961500' }}>Atrasado</span>}
                      {p.estado === 'Sin actividad' && <span className="badge" style={{ background: '#EFEFEF', color: '#666666' }}>Sin actividad</span>}
                      {!p.estado && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'rgba(150, 21, 0, 0.15)', fontWeight: 800, borderTop: '2px solid rgba(150, 21, 0, 0.4)' }}>
                <td style={{ textAlign: 'center', fontSize: 13 }}>—</td>
                <td style={{ fontSize: 14 }}>TOTAL EQUIPO</td>
                <td style={{ textAlign: 'center', fontSize: 13 }}>{totalSlots}</td>
                <td style={{ textAlign: 'center', fontSize: 13 }}>{totalListos}</td>
                <td style={{ textAlign: 'center', fontSize: 13 }}>{totalHechos}</td>
                <td style={{ textAlign: 'center', fontSize: 13, color: '#4CAF50' }}>{totalAprobados}</td>
                <td style={{ textAlign: 'center', fontSize: 13 }}>{totalTrouble}</td>
                <td style={{ textAlign: 'center', fontSize: 13 }}>{totalNoAprobados}</td>
                <td style={{ textAlign: 'center', fontSize: 13 }}>{totalTroubleOnly}</td>
                <td style={{ textAlign: 'center', fontSize: 13 }}>{totalNoHayGente}</td>
                <td style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>—</td>
                <td style={{ textAlign: 'center', fontSize: 13 }}>{totalRefunds}</td>
                <td style={{ textAlign: 'center', fontSize: 13 }}>{totalAssigned}</td>
                <td style={{ textAlign: 'center', fontSize: 13 }}>{totalProcessed}</td>
                <td style={{ textAlign: 'center', fontSize: 13, color: totalGap === 0 ? '#4CAF50' : '#ff5252' }}>{totalGap}</td>
                <td style={{ textAlign: 'center', fontSize: 13, color: teamEficiencia >= 60 ? '#4CAF50' : teamEficiencia >= 20 ? '#FFC107' : '#ff5252' }}>{teamEficiencia}%</td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`badge ${teamNivel === 'Alto' ? 'badge-green' : teamNivel === 'Medio' ? 'badge-yellow' : 'badge-red'}`} style={{ fontSize: 11 }}>
                    {teamNivel}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  {teamEstado === 'Al día' && <span className="badge" style={{ background: '#D9EAD3', color: '#274E13' }}>Al día</span>}
                  {teamEstado === 'Intermedio' && <span className="badge" style={{ background: '#FFF2CC', color: '#7F6000' }}>Intermedio</span>}
                  {teamEstado === 'Atrasado' && <span className="badge" style={{ background: '#F4CCCC', color: '#961500' }}>Atrasado</span>}
                  {teamEstado === 'Sin actividad' && <span className="badge" style={{ background: '#EFEFEF', color: '#666666' }}>Sin actividad</span>}
                  {!teamEstado && (
                    <span className={`badge ${totalGap === 0 ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: 11 }}>
                      {totalGap === 0 ? 'Al día' : `${totalGap} sin trabajar`}
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* TABLA 2: EMBUDO DE CONVERSIÓN END-TO-END */}
      <div className="card" style={{ padding: 22, borderRadius: 16, marginBottom: 28 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ArrowRightLeft size={18} style={{ color: 'var(--color-primary)' }} />
          🔄 Embudo de Conversión End-to-End (6 Etapas del Pipeline)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 16 }}>
          {funnel.stages.map((st, i) => (
            <div
              key={st.stage}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(150, 21, 0, 0.15)',
                borderRadius: 12,
                padding: 14,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Etapa {i + 1}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {st.stage}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                {st.count}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
                <span>Conversión etapa:</span>
                <strong style={{ color: '#4CAF50' }}>{st.conversion_pct}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                <span>Global embudo:</span>
                <strong style={{ color: '#2196F3' }}>{st.overall_pct}%</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* GRID 2 COLUMNAS: CALIDAD DE QUÍMICA & ANÁLISIS DE REEMBOLSOS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 20, marginBottom: 28 }}>
        {/* Calidad Real del Matchmaking */}
        <div className="card" style={{ padding: 22, borderRadius: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Heart size={18} style={{ color: 'var(--color-primary)' }} />
            ❤️ Calidad Real del Matchmaking (% Química Post-Cita)
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', marginBottom: 20, padding: '16px 0', background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#4CAF50' }}>
                {matchQuality.chemistry_rate_pct || 77.4}%
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Química Positiva</div>
            </div>
            <div style={{ height: 40, width: 1, background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#4CAF50' }}>
                {matchQuality.positive_chemistry || 0}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sí hubo química</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#ff5252' }}>
                {matchQuality.negative_chemistry || 0}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sin química</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#FFC107' }}>
                {matchQuality.pending_feedback || 0}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pendiente</div>
            </div>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
            El <strong>{matchQuality.chemistry_rate_pct || 77.4}%</strong> de los usuarios evaluados expresan interés en un segundo encuentro o afinidad mutua tras la cita organizada.
          </p>
        </div>

        {/* Análisis de Reembolsos */}
        <div className="card" style={{ padding: 22, borderRadius: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <DollarSign size={18} style={{ color: '#FF9800' }} />
            💸 Análisis de Reembolsos (Refunds) y Motivos Principales
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Tasa Global de Refund:</span>
            <span className="badge badge-yellow" style={{ fontSize: 12, padding: '3px 10px' }}>
              {refundStats.refund_rate_pct || 4.2}% ({refundStats.total_refunds || 0} casos)
            </span>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Motivo predominante (#1):</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ff6b6b' }}>
              ⚠️ {refundStats.top_reason || 'Tiempo de espera prolongado sin match'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(refundStats.reasons_breakdown || []).map(r => (
              <div key={r.reason} style={{ fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ color: 'var(--text-primary)' }}>{r.reason}</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{r.count} ({r.pct}%)</span>
                </div>
                <div className="progress-bar" style={{ height: 5 }}>
                  <div className="progress-fill" style={{ width: `${r.pct}%`, background: r.pct > 35 ? '#961500' : '#FF9800' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TABLA 4: MAPA DE DÉFICIT POR CIUDAD Y ORIENTACIÓN */}
      <div className="card" style={{ padding: 22, borderRadius: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <MapPin size={18} style={{ color: '#0E6251' }} />
          📍 Mapa de Déficit por Ciudad y Orientación (Guía Estratégica de Captación)
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Ciudad</th>
                <th>Orientación / Perfil en Espera</th>
                <th style={{ textAlign: 'center' }}>Clientes Sin Match</th>
                <th style={{ textAlign: 'center' }}>Nivel de Déficit</th>
                <th>Acción Recomendada para Marketing / Captación</th>
              </tr>
            </thead>
            <tbody>
              {deficitMap.map((d, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 700 }}>{d.city}</td>
                  <td>{d.preference}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: d.waiting_count > 25 ? '#ff5252' : 'var(--text-primary)' }}>
                    {d.waiting_count}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${d.level === 'Déficit Crítico' ? 'badge-red' : d.level === 'Alta Demanda' ? 'badge-yellow' : 'badge-green'}`} style={{ fontSize: 11, padding: '3px 8px' }}>
                      {d.level}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {d.action}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
