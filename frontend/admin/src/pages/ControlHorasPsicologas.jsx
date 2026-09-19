import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Clock, DollarSign, Calendar, Users, Filter, Download,
  RefreshCw, Settings, Play, Pause, CheckCircle2, AlertCircle,
  Coffee, ChevronRight, X, Sparkles, Heart, Headphones,
  Eye, ArrowUpRight, Search, FileSpreadsheet
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia')))
  ? window.location.origin
  : 'https://daily-lover.agentesia.cloud'

const PSYCHOLOGISTS_LIST = [
  'Todas',
  'Jenn',
  'Ana',
  'Silvi',
  'Steffy',
  'Sofi',
  'Aleja',
  'Manu',
  'Pia',
  'Isa'
]

export default function ControlHorasPsicologas() {
  const { token, user } = useAuth()

  // Estados principales
  const [sessions, setSessions] = useState([])
  const [kpis, setKpis] = useState({
    total_active_hours: 0,
    total_active_formatted: '0h 00m',
    total_idle_hours: 0,
    total_idle_formatted: '0h 00m',
    total_liquidation_cop: 0,
    total_liquidation_formatted: '$0 COP',
    active_now_count: 0
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filtros
  const [selectedPsyc, setSelectedPsyc] = useState('Todas')
  const [activePreset, setActivePreset] = useState('month') // 'today' | 'week' | 'fortnight' | 'month' | 'all'
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [statusFilter, setStatusFilter] = useState('todos')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal de Bitácora detallada
  const [selectedSession, setSelectedSession] = useState(null)
  const [sessionActivities, setSessionActivities] = useState([])
  const [loadingActivities, setLoadingActivities] = useState(false)

  // Modal de configuración de tarifas
  const [showRatesModal, setShowRatesModal] = useState(false)
  const [ratesList, setRatesList] = useState([])
  const [savingRates, setSavingRates] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  // 1. Cargar sesiones
  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedPsyc && selectedPsyc !== 'Todas') params.append('psychologist', selectedPsyc)
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      if (statusFilter && statusFilter !== 'todos') params.append('status_filter', statusFilter)

      const res = await fetch(`${API}/api/v1/work-time/sessions?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
        if (data.kpis) setKpis(data.kpis)
      }
    } catch (err) {
      console.error('Error cargando sesiones:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedPsyc, startDate, endDate, statusFilter])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  // 2. Presets de fecha
  const handlePreset = (preset) => {
    setActivePreset(preset)
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    if (preset === 'today') {
      setStartDate(todayStr)
      setEndDate(todayStr)
    } else if (preset === 'week') {
      const d = new Date()
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Lunes
      const monday = new Date(d.setDate(diff))
      setStartDate(monday.toISOString().split('T')[0])
      setEndDate(todayStr)
    } else if (preset === 'fortnight') {
      // Quincena actual (1-15 o 16-fin)
      const day = today.getDate()
      const startDay = day <= 15 ? 1 : 16
      const start = new Date(today.getFullYear(), today.getMonth(), startDay)
      setStartDate(start.toISOString().split('T')[0])
      setEndDate(todayStr)
    } else if (preset === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      setStartDate(start.toISOString().split('T')[0])
      setEndDate(todayStr)
    } else if (preset === 'all') {
      setStartDate('')
      setEndDate('')
    }
  }

  // 3. Abrir Bitácora de actividades de una sesión
  const handleOpenActivities = async (sess) => {
    setSelectedSession(sess)
    setLoadingActivities(true)
    try {
      const res = await fetch(`${API}/api/v1/work-time/sessions/${sess.id}/activities`)
      if (res.ok) {
        const d = await res.json()
        setSessionActivities(d.activities || [])
      }
    } catch (err) {
      console.error('Error cargando actividades:', err)
    } finally {
      setLoadingActivities(false)
    }
  }

  // 4. Cargar tarifas de psicólogas
  const handleOpenRates = async () => {
    setShowRatesModal(true)
    try {
      const res = await fetch(`${API}/api/v1/work-time/rates`)
      if (res.ok) {
        const d = await res.json()
        setRatesList(d.rates || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleRateChange = (key, val) => {
    setRatesList(prev => prev.map(r => r.key === key ? { ...r, hourly_rate: parseFloat(val) || 0 } : r))
  }

  const handleSaveRates = async () => {
    setSavingRates(true)
    try {
      for (const r of ratesList) {
        await fetch(`${API}/api/v1/work-time/rates/${r.key}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hourly_rate: r.hourly_rate,
            idle_timeout_minutes: r.idle_timeout_minutes || 15
          })
        })
      }
      showToast('Tarifas actualizadas correctamente')
      setShowRatesModal(false)
      fetchSessions()
    } catch (err) {
      alert('Error guardando tarifas: ' + err.message)
    } finally {
      setSavingRates(false)
    }
  }

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  // 5. Exportar a CSV para Nómina / Contabilidad
  const handleExportCSV = () => {
    if (sessions.length === 0) {
      alert('No hay datos de sesiones para exportar en este periodo.')
      return
    }

    const headers = ['Psicologa', 'Rol', 'Fecha', 'Hora Inicio', 'Hora Fin', 'Horas Activas (h)', 'Tiempo Activo', 'Tiempo Inactivo', 'Tarifa Hora (COP)', 'Total a Pagar (COP)', 'Estado', 'Actividades']
    const rows = sessions.map(s => [
      `"${s.user_name}"`,
      `"${s.user_role || 'Psicóloga'}"`,
      `"${s.started_at ? s.started_at.split('T')[0] : ''}"`,
      `"${s.started_at ? s.started_at.split('T')[1].slice(0,5) : ''}"`,
      `"${s.ended_at ? s.ended_at.split('T')[1].slice(0,5) : (s.status === 'active' ? 'En curso' : '')}"`,
      s.active_hours_decimal,
      `"${s.active_formatted}"`,
      `"${s.idle_formatted}"`,
      s.hourly_rate,
      s.total_amount,
      `"${s.status}"`,
      s.activities_count
    ])

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Liquidacion_Horas_Psicologas_${startDate || 'inicio'}_${endDate || 'fin'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filtrado de búsqueda local
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions
    const q = searchQuery.toLowerCase()
    return sessions.filter(s =>
      s.user_name?.toLowerCase().includes(q) ||
      s.started_at?.toLowerCase().includes(q) ||
      s.status?.toLowerCase().includes(q)
    )
  }, [sessions, searchQuery])

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          background: '#10B981',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          zIndex: 9999,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <CheckCircle2 size={18} />
          {toastMsg}
        </div>
      )}

      {/* Header Principal */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>⏱️ Control de Horas & Rendimiento</h1>
            {kpis.active_now_count > 0 && (
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }} />
                {kpis.active_now_count} conectada{kpis.active_now_count > 1 ? 's' : ''} ahora
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '6px 0 0' }}>
            Supervisión de jornadas en vivo, liquidación salarial por hora y bitácora de actividades minuto a minuto.
          </p>
        </div>

        {/* Botones de acción de cabecera */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={handleOpenRates}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '9px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Settings size={15} />
            Configurar Tarifas ($/h)
          </button>

          <button
            onClick={handleExportCSV}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10B981',
              padding: '9px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Download size={15} />
            Exportar Nómina (CSV)
          </button>

          <button
            onClick={() => { setRefreshing(true); fetchSessions(); }}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--color-primary, #961500)',
              color: '#fff',
              border: 'none',
              padding: '9px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Tarjetas de KPIs Generales */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: 16,
        marginBottom: 28
      }}>
        {/* Horas Activas */}
        <div style={{
          background: 'var(--bg-card, #1A1214)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Horas Activas Liquidadas
            </span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#10B981' }}>
              {kpis.total_active_formatted}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              {kpis.total_active_hours} horas netas de trabajo
            </div>
          </div>
        </div>

        {/* Tiempo Inactivo Descontado */}
        <div style={{
          background: 'var(--bg-card, #1A1214)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Inactividad Descontada
            </span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
              <Coffee size={18} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#F59E0B' }}>
              {kpis.total_idle_formatted}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Pausas y tiempos muertos no pagados
            </div>
          </div>
        </div>

        {/* Total Liquidación ($ COP) */}
        <div style={{
          background: 'var(--bg-card, #1A1214)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Liquidación Estimada
            </span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#3B82F6' }}>
              {kpis.total_liquidation_formatted}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Cálculo según tarifas configuradas
            </div>
          </div>
        </div>

        {/* Total Jornadas */}
        <div style={{
          background: 'var(--bg-card, #1A1214)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Jornadas Registradas
            </span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A855F7' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>
              {sessions.length} turnos
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              En el rango de fechas seleccionado
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div style={{
        background: 'var(--bg-card, #1A1214)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Presets de fecha */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'today', label: 'Hoy' },
            { id: 'week', label: 'Esta Semana' },
            { id: 'fortnight', label: 'Esta Quincena' },
            { id: 'month', label: 'Este Mes' },
            { id: 'all', label: 'Todo' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => handlePreset(p.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid',
                borderColor: activePreset === p.id ? 'var(--color-primary, #961500)' : 'var(--border-color)',
                background: activePreset === p.id ? 'rgba(150, 21, 0, 0.2)' : 'transparent',
                color: activePreset === p.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Filtros desplegables y buscador */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Psicóloga */}
          <select
            value={selectedPsyc}
            onChange={e => setSelectedPsyc(e.target.value)}
            style={{
              background: 'var(--bg-base, #0D0A0B)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: 6,
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {PSYCHOLOGISTS_LIST.map(p => (
              <option key={p} value={p}>{p === 'Todas' ? '👥 Todas las Psicólogas' : `🩺 ${p}`}</option>
            ))}
          </select>

          {/* Rango de fechas manual */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              value={startDate}
              onChange={e => { setActivePreset('custom'); setStartDate(e.target.value); }}
              style={{
                background: 'var(--bg-base, #0D0A0B)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>a</span>
            <input
              type="date"
              value={endDate}
              onChange={e => { setActivePreset('custom'); setEndDate(e.target.value); }}
              style={{
                background: 'var(--bg-base, #0D0A0B)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12
              }}
            />
          </div>

          {/* Buscador */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar psicóloga o fecha..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'var(--bg-base, #0D0A0B)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: 6,
                padding: '6px 12px 6px 30px',
                fontSize: 12,
                width: 180,
                outline: 'none'
              }}
            />
          </div>
        </div>
      </div>

      {/* Tabla de Sesiones de Trabajo */}
      <div style={{
        background: 'var(--bg-card, #1A1214)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Psicóloga</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Fecha & Horario</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Horas Activas</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Inactividad</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Tarifa / Hora</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Total Liquidado</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Estado</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>Bitácora</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Cargando registros de jornadas laborales...
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No se encontraron turnos de trabajo registrados para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredSessions.map(sess => {
                  const isLive = sess.status === 'active'
                  const isPaused = sess.status === 'paused'

                  return (
                    <tr
                      key={sess.id}
                      style={{
                        borderBottom: '1px solid rgba(150, 21, 0, 0.08)',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Psicóloga */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: isLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(150, 21, 0, 0.2)',
                            color: isLive ? '#10B981' : 'var(--color-primary-light)',
                            border: `1px solid ${isLive ? '#10B981' : 'var(--border-color)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: 13
                          }}>
                            {sess.user_name?.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{sess.user_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sess.user_role || 'Psicóloga'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Fecha y Horario */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 600 }}>
                          {sess.started_at ? new Date(sess.started_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {sess.started_at ? new Date(sess.started_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                          {' - '}
                          {sess.ended_at
                            ? new Date(sess.ended_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
                            : isLive ? <strong style={{ color: '#10B981' }}>En curso</strong> : 'Pausado'}
                        </div>
                      </td>

                      {/* Horas Activas */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{
                          fontWeight: 800,
                          fontSize: 14,
                          color: isLive ? '#10B981' : 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          {isLive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />}
                          {sess.active_formatted}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {sess.active_hours_decimal}h liquidables
                        </div>
                      </td>

                      {/* Inactividad Descontada */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ color: sess.idle_seconds > 0 ? '#F59E0B' : 'var(--text-muted)', fontWeight: 600 }}>
                          {sess.idle_formatted}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          no remunerado
                        </div>
                      </td>

                      {/* Tarifa por Hora */}
                      <td style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        ${Number(sess.hourly_rate || 30000).toLocaleString('es-CO')} COP/h
                      </td>

                      {/* Total Liquidado */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#10B981' }}>
                          ${Number(sess.total_amount || 0).toLocaleString('es-CO')} COP
                        </div>
                      </td>

                      {/* Estado */}
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 10px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          background: isLive
                            ? 'rgba(16, 185, 129, 0.15)'
                            : isPaused
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(59, 130, 246, 0.15)',
                          color: isLive
                            ? '#10B981'
                            : isPaused
                              ? '#F59E0B'
                              : '#3B82F6',
                          border: `1px solid ${
                            isLive ? 'rgba(16, 185, 129, 0.3)' : isPaused ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)'
                          }`
                        }}>
                          {isLive ? '🟢 EN CURSO' : isPaused ? '🟡 EN PAUSA' : '✓ FINALIZADO'}
                        </span>
                      </td>

                      {/* Acción: Ver Bitácora */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleOpenActivities(sess)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            padding: '6px 12px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <Eye size={13} />
                          Bitácora
                          {sess.activities_count > 0 && (
                            <span style={{
                              background: 'var(--color-primary, #961500)',
                              color: '#fff',
                              borderRadius: 10,
                              padding: '1px 6px',
                              fontSize: 10,
                              marginLeft: 2
                            }}>
                              {sess.activities_count}
                            </span>
                          )}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── DRAWER / MODAL DE BITÁCORA MINUTO A MINUTO ───────────────────────── */}
      {selectedSession && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(3px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            background: 'var(--bg-card, #1A1214)',
            borderLeft: '1px solid var(--border-color)',
            width: '100%',
            maxWidth: 540,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
            animation: 'slideInRight 0.25s ease-out'
          }}>
            {/* Header del Drawer */}
            <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                    Bitácora de Actividades
                  </h2>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: selectedSession.status === 'active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                    color: selectedSession.status === 'active' ? '#10B981' : '#3B82F6'
                  }}>
                    {selectedSession.user_name}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  {selectedSession.started_at ? new Date(selectedSession.started_at).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : ''}
                </div>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 6 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Resumen del Turno */}
            <div style={{ padding: '16px 28px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tiempo Activo</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#10B981', marginTop: 2 }}>{selectedSession.active_formatted}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Inactividad</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#F59E0B', marginTop: 2 }}>{selectedSession.idle_formatted}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Liquidación</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#3B82F6', marginTop: 2 }}>${Number(selectedSession.total_amount).toLocaleString('es-CO')}</div>
              </div>
            </div>

            {/* Línea de Tiempo Cronológica */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
              {loadingActivities ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  Cargando actividades realizadas en este turno...
                </div>
              ) : sessionActivities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  <Coffee size={36} style={{ opacity: 0.4, marginBottom: 12 }} />
                  <p style={{ margin: 0 }}>No hay eventos registrados para este turno.</p>
                </div>
              ) : (
                <div style={{ position: 'relative', paddingLeft: 24, borderLeft: '2px solid rgba(150, 21, 0, 0.2)' }}>
                  {sessionActivities.map((act, idx) => {
                    const isClockIn = act.type === 'CLOCK_IN'
                    const isClockOut = act.type === 'CLOCK_OUT'
                    const isMatch = act.category === 'matchmaking'
                    const isInterview = act.category === 'entrevista'

                    return (
                      <div key={act.id || idx} style={{ position: 'relative', marginBottom: 24 }}>
                        {/* Nodo en la línea */}
                        <div style={{
                          position: 'absolute',
                          left: -31,
                          top: 2,
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: isClockIn ? '#10B981' : isClockOut ? '#EF4444' : isMatch ? '#EC4899' : '#A855F7',
                          border: '3px solid var(--bg-card, #1A1214)',
                          boxShadow: '0 0 6px rgba(0,0,0,0.5)'
                        }} />

                        {/* Hora y Categoría */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>
                            {act.time}
                          </span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                            background: isClockIn ? 'rgba(16, 185, 129, 0.15)' : isClockOut ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.06)',
                            color: isClockIn ? '#10B981' : isClockOut ? '#EF4444' : 'var(--text-secondary)'
                          }}>
                            {act.category}
                          </span>
                        </div>

                        {/* Título y detalles */}
                        <div style={{
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid rgba(150, 21, 0, 0.12)',
                          borderRadius: 8,
                          padding: '10px 14px'
                        }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                            {act.title}
                          </div>
                          {act.entity_name && (
                            <div style={{ fontSize: 12, color: 'var(--color-primary-light, #c41a00)', marginTop: 2 }}>
                              📌 {act.entity_name}
                            </div>
                          )}
                          {act.details && Object.keys(act.details).length > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                              {JSON.stringify(act.details)}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE CONFIGURACIÓN DE TARIFAS ($/HORA) ───────────────────────── */}
      {showRatesModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(3px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card, #1A1214)',
            border: '1px solid var(--border-color)',
            borderRadius: 16,
            maxWidth: 620,
            width: '100%',
            padding: 28,
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>⚙️ Configurar Tarifas de Psicólogas</h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                  Define el valor por hora a liquidar para cada integrante del equipo.
                </p>
              </div>
              <button onClick={() => setShowRatesModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, marginBottom: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11 }}>Psicóloga / Cargo</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 11 }}>Tarifa / Hora (COP)</th>
                  </tr>
                </thead>
                <tbody>
                  {ratesList.map(r => (
                    <tr key={r.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 700 }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.role}</div>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>$</span>
                          <input
                            type="number"
                            step="1000"
                            value={r.hourly_rate}
                            onChange={e => handleRateChange(r.key, e.target.value)}
                            style={{
                              width: 120,
                              textAlign: 'right',
                              background: 'var(--bg-base, #0D0A0B)',
                              border: '1px solid var(--border-color)',
                              color: '#10B981',
                              fontWeight: 700,
                              borderRadius: 6,
                              padding: '6px 10px',
                              fontSize: 13
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
              <button
                onClick={() => setShowRatesModal(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRates}
                disabled={savingRates}
                style={{
                  padding: '9px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--color-primary, #961500)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                {savingRates ? 'Guardando...' : 'Guardar Tarifas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
