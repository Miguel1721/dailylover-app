import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Calendar as CalendarIcon, Clock, Users, ChevronLeft, ChevronRight, 
  Plus, Check, Sparkles, Copy, ExternalLink, Video, ShieldCheck, 
  AlertCircle, RefreshCw, X, User, CheckCircle2, Link2, Award,
  MapPin, Building2, ArrowUpDown, Grid, Search, MoreVertical, Edit2,
  CalendarDays, Download, Filter, Info, Zap, AlertTriangle, Flag, HelpCircle, GripVertical
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

const ALL_STAFF_MEMBERS = [
  "Valentina Ospina",
  "Catalina Cely Rueda",
  "Valentina Prieto",
  "Nina Andrade Carrizosa",
  "Monica Ospina",
  "Maria Pia Cottrino",
  "Mara Paula de la Espriella",
  "Estefania Rodriguez",
  "Jennifer Pimiento",
  "Ana Maria Tolosa",
  "Silvana Manrique",
  "Isabela Marquez",
  "Maria Salinas"
]

const ALL_ROLES = [
  "Customer Service Assistant",
  "matchmaker",
  "interviewer",
  "Head of Operations",
  "VIP INTERVIEWER",
  "Horas extra"
]

const COMMON_SHIFT_TIMES = [
  { start: "07:00 AM", end: "02:00 PM", label: "7am - 2pm (7 hrs)" },
  { start: "02:00 PM", end: "08:30 PM", label: "2pm - 8:30pm (6.5 hrs)" },
  { start: "08:00 AM", end: "01:00 PM", label: "8am - 1pm (5 hrs)" },
  { start: "09:00 AM", end: "01:00 PM", label: "9am - 1pm (4 hrs)" },
  { start: "11:00 AM", end: "03:00 PM", label: "11am - 3pm (4 hrs)" },
  { start: "05:00 PM", end: "08:00 PM", label: "5pm - 8pm (3 hrs)" },
  { start: "06:00 AM", end: "01:00 PM", label: "6am - 1pm (7 hrs)" },
  { start: "01:00 PM", end: "08:00 PM", label: "1pm - 8pm (7 hrs)" }
]

function formatTo12Hour(timeStr) {
  if (!timeStr) return "09:00 AM"
  const clean = timeStr.trim().toUpperCase()
  if (clean.includes("AM") || clean.includes("PM")) return clean
  const parts = clean.split(":")
  let h = parseInt(parts[0], 10)
  const m = parts[1] ? parts[1].padStart(2, "0") : "00"
  const ampm = h >= 12 ? "PM" : "AM"
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${m} ${ampm}`
}

function parseTimeToDecimal(timeStr) {
  if (!timeStr) return 9.0
  const clean = timeStr.trim().toUpperCase()
  const isPM = clean.includes("PM")
  const isAM = clean.includes("AM")
  const raw = clean.replace("AM", "").replace("PM", "").trim()
  const parts = raw.split(":")
  let h = parseInt(parts[0], 10) || 0
  const m = parseInt(parts[1], 10) || 0
  if (isPM && h < 12) h += 12
  if (isAM && h === 12) h = 0
  return h + (m / 60.0)
}

function calculateShiftDurationHours(startTime, endTime) {
  const s = parseTimeToDecimal(startTime)
  const e = parseTimeToDecimal(endTime)
  let diff = e - s
  if (diff < 0) diff += 24
  return Math.max(0, Math.round(diff * 10) / 10)
}

export default function CalendarioTurnos7shifts() {
  const { token, user } = useAuth()
  const navigate = useNavigate()

  // Navegación principal: 'schedule' | 'timeoff' | 'availability'
  const [activeTab, setActiveTab] = useState('schedule')

  // Sub-pestañas para Time-Off y Availability
  const [timeOffSubTab, setTimeOffSubTab] = useState('requests')
  const [availSubTab, setAvailSubTab] = useState('glance')

  // Estados de Schedule
  const [weekData, setWeekData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState('2026-09-07')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('week')
  const [departmentFilter, setDepartmentFilter] = useState('all')

  // Celda seleccionada en la matriz
  const [selectedShiftKey, setSelectedShiftKey] = useState('Valentina Ospina_2026-09-07')

  // Estados de Time-Off
  const [timeOffRequests, setTimeOffRequests] = useState([])
  const [timeOffStatusFilter, setTimeOffStatusFilter] = useState('Pending')

  // Estados de Availability
  const [availRequests, setAvailRequests] = useState([])
  const [glanceData, setGlanceData] = useState(null)

  // Modal 7shifts "Edit shift" exacto (Imágenes 1 y 2)
  const [editModal, setEditModal] = useState(null)
  const [modalTab, setModalTab] = useState('details') // 'details' | 'punch'
  const [showCommonTimes, setShowCommonTimes] = useState(false)
  const [savingShift, setSavingShift] = useState(false)
  const [deletingShift, setDeletingShift] = useState(false)
  const [notification, setNotification] = useState('')
  const [publishing, setPublishing] = useState(false)

  // Cargar datos de la semana (Schedule)
  const fetchWeek = useCallback(() => {
    setLoading(true)
    fetch(`${API}/api/v1/shifts/week?week_date=${currentDate}`)
      .then(r => r.json())
      .then(data => {
        setWeekData(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching weekly shifts:', err)
        setLoading(false)
      })
  }, [currentDate])

  // Cargar datos de Time-Off
  const fetchTimeOff = useCallback(() => {
    fetch(`${API}/api/v1/shifts/time-off/requests`)
      .then(r => r.json())
      .then(d => setTimeOffRequests(d.requests || []))
      .catch(err => console.error('Error fetching time-off:', err))
  }, [])

  // Cargar datos de Availability
  const fetchAvailability = useCallback(() => {
    fetch(`${API}/api/v1/shifts/availability/requests`)
      .then(r => r.json())
      .then(d => setAvailRequests(d.requests || []))
      .catch(err => console.error('Error fetching avail requests:', err))

    fetch(`${API}/api/v1/shifts/availability/glance`)
      .then(r => r.json())
      .then(d => setGlanceData(d))
      .catch(err => console.error('Error fetching glance:', err))
  }, [])

  useEffect(() => {
    fetchWeek()
    fetchTimeOff()
    fetchAvailability()
  }, [fetchWeek, fetchTimeOff, fetchAvailability])

  const handlePrevWeek = () => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - 7)
    setCurrentDate(d.toISOString().split('T')[0])
  }

  const handleNextWeek = () => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + 7)
    setCurrentDate(d.toISOString().split('T')[0])
  }

  // Abrir Modal de Turno estilo 7shifts
  const openEditShiftModal = (empName, dateStr, shift = null, roleName = "Customer Service Assistant") => {
    setSelectedShiftKey(`${empName}_${dateStr}`)
    
    // Calcular día de la semana para el Apply to inicial
    const dObj = new Date(dateStr + "T00:00:00")
    const dayIndex = (dObj.getDay() + 6) % 7 // 0=Mon, 6=Sun
    const daysAbbr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const initialDay = daysAbbr[dayIndex] || 'Mon'

    const startTimeFormatted = shift?.start_time ? formatTo12Hour(shift.start_time) : "7:00 AM"
    const endTimeFormatted = shift?.end_time ? formatTo12Hour(shift.end_time) : "2:00 PM"

    setEditModal({
      id: shift?.id || null,
      employee_name: empName,
      role: roleName,
      date: dateStr,
      start_time: startTimeFormatted,
      end_time: endTimeFormatted,
      is_close: false,
      is_bd: false,
      notes: shift?.notes || "",
      apply_to_days: [initialDay],
      flag: shift?.flag || "None"
    })
    setModalTab('details')
    setShowCommonTimes(false)
  }

  // Guardar Turno
  const handleSaveShiftModal = async (e) => {
    e.preventDefault()
    if (!editModal) return
    setSavingShift(true)

    // Convertir días seleccionados en fechas de la semana actual
    const daysAbbr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const mondayObj = new Date((weekData?.week_monday || currentDate) + "T00:00:00")
    
    const targetDates = (editModal.apply_to_days || []).map(dayStr => {
      const offset = daysAbbr.indexOf(dayStr)
      if (offset >= 0) {
        const d = new Date(mondayObj)
        d.setDate(d.getDate() + offset)
        return d.toISOString().split('T')[0]
      }
      return editModal.date
    })

    const payload = {
      id: editModal.id,
      psychologist_name: editModal.employee_name,
      shift_date: editModal.date,
      start_time: editModal.start_time,
      end_time: editModal.end_time,
      shift_type: editModal.role.toLowerCase().includes('matchmaker') ? 'MATCHMAKING' : (editModal.role.toLowerCase().includes('interviewer') ? 'ENTREVISTAS' : 'CS'),
      is_published: true,
      notes: editModal.notes,
      apply_to_dates: targetDates,
      shift_flag: editModal.flag
    }

    try {
      const res = await fetch(`${API}/api/v1/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        setNotification('Turno actualizado exitosamente en 7shifts.')
        setEditModal(null)
        fetchWeek()
        setTimeout(() => setNotification(''), 4000)
      }
    } catch (err) {
      alert('Error al guardar el turno')
    } finally {
      setSavingShift(false)
    }
  }

  // Eliminar Turno
  const handleDeleteShiftModal = async () => {
    if (!editModal?.id) {
      setEditModal(null)
      return
    }
    if (!window.confirm(`¿Estás seguro de eliminar este turno de ${editModal.employee_name}?`)) {
      return
    }
    setDeletingShift(true)
    try {
      const res = await fetch(`${API}/api/v1/shifts/${editModal.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        setNotification('Turno eliminado exitosamente.')
        setEditModal(null)
        fetchWeek()
        setTimeout(() => setNotification(''), 4000)
      }
    } catch (err) {
      alert('Error al eliminar turno')
    } finally {
      setDeletingShift(false)
    }
  }

  // Toggle día en Apply to
  const toggleApplyDay = (day) => {
    if (!editModal) return
    const current = editModal.apply_to_days || []
    if (current.includes(day)) {
      if (current.length > 1) {
        setEditModal({ ...editModal, apply_to_days: current.filter(d => d !== day) })
      }
    } else {
      setEditModal({ ...editModal, apply_to_days: [...current, day] })
    }
  }

  const handlePublishWeek = async () => {
    if (!weekData?.week_monday) return
    setPublishing(true)
    try {
      const res = await fetch(`${API}/api/v1/shifts/publish-week`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ week_monday: weekData.week_monday })
      })
      if (res.ok) {
        setNotification('Horario publicado exitosamente en 7shifts y sincronizado con Calendly.')
        fetchWeek()
        setTimeout(() => setNotification(''), 4000)
      }
    } catch (e) {
      alert('Error al publicar horario semanal')
    } finally {
      setPublishing(false)
    }
  }

  // Filtrado de departamentos y búsqueda
  const filteredDepartments = (weekData?.departments || []).filter(dept => {
    if (departmentFilter !== 'all' && dept.name.toLowerCase() !== departmentFilter.toLowerCase()) {
      return false
    }
    return true
  }).map(dept => {
    if (!searchQuery.trim()) return dept
    const q = searchQuery.toLowerCase()
    return {
      ...dept,
      roles: dept.roles.map(r => ({
        ...r,
        employees: r.employees.filter(emp => emp.name.toLowerCase().includes(q))
      })).filter(r => r.employees.length > 0 || r.allow_add)
    }
  })

  // Duración calculada para el modal
  const modalDuration = editModal 
    ? calculateShiftDurationHours(editModal.start_time, editModal.end_time)
    : 7

  return (
    <div style={{ background: '#f5f6f8', minHeight: '100vh', color: '#1a1f2c', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      {/* 1. TOP HEADER ACCESOS DIRECTOS */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#e02424', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>
              7
            </div>
            <div>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#1a1f2c', letterSpacing: '-0.3px' }}>7shifts</span>
              <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>Daily Lover (Company 408848)</span>
            </div>
          </div>

          {/* Selector de Pestaña Principal */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 8, gap: 4, marginLeft: 20 }}>
            <button 
              onClick={() => setActiveTab('schedule')}
              style={{
                border: 'none',
                background: activeTab === 'schedule' ? '#ffffff' : 'transparent',
                color: activeTab === 'schedule' ? '#0f172a' : '#64748b',
                fontWeight: activeTab === 'schedule' ? 700 : 500,
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: activeTab === 'schedule' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <CalendarIcon size={14} /> Schedule (Horario)
            </button>
            <button 
              onClick={() => setActiveTab('timeoff')}
              style={{
                border: 'none',
                background: activeTab === 'timeoff' ? '#ffffff' : 'transparent',
                color: activeTab === 'timeoff' ? '#0f172a' : '#64748b',
                fontWeight: activeTab === 'timeoff' ? 700 : 500,
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: activeTab === 'timeoff' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <CalendarDays size={14} /> Time off
            </button>
            <button 
              onClick={() => setActiveTab('availability')}
              style={{
                border: 'none',
                background: activeTab === 'availability' ? '#ffffff' : 'transparent',
                color: activeTab === 'availability' ? '#0f172a' : '#64748b',
                fontWeight: activeTab === 'availability' ? 700 : 500,
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: activeTab === 'availability' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Clock size={14} /> Availability
            </button>
          </div>
        </div>

        {/* Acciones Rápidas: Calendly + Copiloto IA + Publicar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {notification && (
            <div style={{ background: '#dcfce7', color: '#15803d', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={14} /> {notification}
            </div>
          )}

          <button 
            onClick={() => navigate('/agendar')}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <ExternalLink size={13} style={{ color: '#2563eb' }} />
            Agendador Clientes (Calendly)
          </button>

          <button 
            onClick={() => navigate('/matchmaking/entrevista')}
            style={{
              background: '#ffffff',
              border: '1px solid #961500',
              color: '#961500',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 1px 3px rgba(150, 21, 0, 0.15)'
            }}
            title="Ir a Entrevista Clínica y Evaluación de Candidatos"
          >
            <Sparkles size={13} style={{ color: '#961500' }} />
            🎙️ Entrevista Clínica & Matching
          </button>

          <button 
            onClick={() => navigate('/matchmaking/sala/1')}
            style={{
              background: '#961500',
              border: 'none',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Video size={13} />
            Sala Videollamada & IA
          </button>

          {activeTab === 'schedule' && (
            <button 
              onClick={handlePublishWeek}
              disabled={publishing}
              style={{
                background: '#16a34a',
                border: 'none',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              {publishing ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
              Publish
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          VISTA 1: SCHEDULE (MATRIZ SEMANAL IDÉNTICA A 7SHIFTS - IMÁGENES 1 A 4)
          ========================================================================= */}
      {activeTab === 'schedule' && (
        <div>
          {/* Sub-barra de Controles y Filtros 7shifts */}
          <div style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            {/* Lado Izquierdo: Dropdowns */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: 6, fontSize: 13, background: '#fff', cursor: 'pointer' }}>
                <MapPin size={14} style={{ color: '#64748b' }} />
                <span style={{ fontWeight: 600 }}>Daily Lover</span>
                <span style={{ color: '#94a3b8', fontSize: 10 }}>▾</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: 6, fontSize: 13, background: '#fff', cursor: 'pointer' }}>
                <Building2 size={14} style={{ color: '#64748b' }} />
                <select 
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#1e293b' }}
                >
                  <option value="all">All departments</option>
                  <option value="Customer Service">Customer Service</option>
                  <option value="Matchamking">Matchmaking</option>
                </select>
              </div>

              {/* Navegación Semanal */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 10 }}>
                <button onClick={handlePrevWeek} style={{ border: '1px solid #e2e8f0', background: '#fff', padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}>
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: 13, fontWeight: 700, padding: '0 8px', color: '#1e293b' }}>
                  {weekData?.week_label || 'Mon Sep 7 - Sun Sep 13, 2026'}
                </span>
                <button onClick={handleNextWeek} style={{ border: '1px solid #e2e8f0', background: '#fff', padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Lado Derecho */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: 6, fontSize: 13, background: '#fff' }}>
                <ArrowUpDown size={14} style={{ color: '#64748b' }} />
                <span>Sorted by First name</span>
                <span style={{ color: '#94a3b8', fontSize: 10 }}>▾</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: 6, fontSize: 13, background: '#fff' }}>
                <Grid size={14} style={{ color: '#64748b' }} />
                <span>Roles view</span>
                <span style={{ color: '#94a3b8', fontSize: 10 }}>▾</span>
              </div>

              <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden' }}>
                <button 
                  onClick={() => setViewMode('day')}
                  style={{
                    border: 'none',
                    background: viewMode === 'day' ? '#2b2b2b' : '#ffffff',
                    color: viewMode === 'day' ? '#ffffff' : '#64748b',
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Day
                </button>
                <button 
                  onClick={() => setViewMode('week')}
                  style={{
                    border: 'none',
                    background: viewMode === 'week' ? '#2b2b2b' : '#ffffff',
                    color: viewMode === 'week' ? '#ffffff' : '#64748b',
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Week
                </button>
              </div>
            </div>
          </div>

          {/* MATRIZ SEMANAL */}
          <div style={{ overflowX: 'auto', paddingBottom: 60 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200, background: '#ffffff' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fafafa' }}>
                  <th style={{ width: 230, minWidth: 230, padding: '10px 14px', textAlign: 'left', background: '#ffffff', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input 
                          type="text" 
                          placeholder="Search employees" 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 8px 6px 28px',
                            border: '1px solid #cbd5e1',
                            borderRadius: 6,
                            fontSize: 12,
                            outline: 'none',
                            color: '#1e293b'
                          }}
                        />
                      </div>
                      <button style={{ border: '1px solid #cbd5e1', background: '#f8fafc', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', color: '#475569' }}>
                        <Users size={14} />
                      </button>
                    </div>
                  </th>

                  {(weekData?.week_columns || []).map((col, idx) => (
                    <th key={col.date} style={{ padding: '8px 12px', borderRight: '1px solid #e2e8f0', textAlign: 'left', verticalAlign: 'top', minWidth: 140 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{col.day_short}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{col.month_name} {col.day_number}</div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {idx === 0 && <span style={{ fontSize: 13 }} title="Clima / Óptimo">🌡️</span>}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#475569', fontWeight: 600 }}>
                            <User size={12} />
                            <span>{col.scheduled_count}</span>
                          </div>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>

                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
                  <td style={{ padding: '8px 14px', borderRight: '1px solid #e2e8f0', fontSize: 12, color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}>
                    Events
                  </td>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <td key={i} style={{ borderRight: '1px solid #e2e8f0', background: '#fafafa', height: 28 }} />
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredDepartments.map((dept) => (
                  <React.Fragment key={dept.name}>
                    <tr>
                      <td colSpan={8} style={{ background: '#333333', color: '#ffffff', padding: '7px 14px', fontWeight: 700, fontSize: 12, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                        {dept.name}
                      </td>
                    </tr>

                    <tr style={{ background: '#eef2f6', borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 14px', borderRight: '1px solid #cbd5e1', fontSize: 11, fontWeight: 600, color: '#475569' }}>
                        Open Shifts
                      </td>
                      {Array.from({ length: 7 }).map((_, i) => (
                        <td key={i} style={{ borderRight: '1px solid #cbd5e1', height: 26 }} />
                      ))}
                    </tr>

                    {dept.roles.map((role) => (
                      <React.Fragment key={role.role_name}>
                        <tr>
                          <td colSpan={8} style={{ background: role.color, color: '#ffffff', padding: '5px 14px', fontWeight: 700, fontSize: 11, letterSpacing: '0.2px' }}>
                            {role.role_name}
                          </td>
                        </tr>

                        {role.allow_add && role.employees.length === 0 && (
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '8px 14px', borderRight: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                <User size={14} />
                              </div>
                              <span 
                                onClick={() => openEditShiftModal(ALL_STAFF_MEMBERS[0], currentDate, null, role.role_name)}
                                style={{ fontSize: 11, color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}
                              >
                                + Add employee
                              </span>
                            </td>
                            {Array.from({ length: 7 }).map((_, i) => (
                              <td key={i} style={{ borderRight: '1px solid #e2e8f0', background: '#fafafa' }} />
                            ))}
                          </tr>
                        )}

                        {role.employees.map((emp) => (
                          <tr key={emp.name} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            {/* Columna Empleado con Drag Handle ::: (Imagen 2) */}
                            <td style={{ padding: '10px 12px', borderRight: '1px solid #e2e8f0', background: '#ffffff', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <GripVertical size={14} style={{ color: '#94a3b8', cursor: 'grab' }} />
                                <img 
                                  src={emp.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
                                  alt={emp.name}
                                  style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1px solid #cbd5e1' }}
                                />
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', textDecoration: 'underline', cursor: 'pointer' }}>
                                    {emp.name}
                                  </div>
                                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                                    {emp.total_hours.toFixed(2)} hrs · ${emp.total_cost.toFixed(2)}
                                  </div>
                                  {emp.total_ot_badge && (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#fee2e2', color: '#dc2626', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, marginTop: 2 }}>
                                      ⏰ {emp.total_ot_badge}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Celdas por día */}
                            {(weekData?.week_columns || []).map((col) => {
                              const cell = emp.days[col.date] || {}
                              const shifts = cell.shifts || []
                              const hasShifts = shifts.length > 0
                              const isAvailableHover = cell.is_available_hover
                              const cellKey = `${emp.name}_${col.date}`
                              const isSelectedCell = selectedShiftKey === cellKey

                              return (
                                <td 
                                  key={col.date}
                                  onClick={() => {
                                    const primaryShift = shifts[0] || null
                                    openEditShiftModal(emp.name, col.date, primaryShift, role.role_name)
                                  }}
                                  style={{
                                    borderRight: '1px solid #e2e8f0',
                                    padding: '4px 6px',
                                    verticalAlign: 'top',
                                    position: 'relative',
                                    background: isSelectedCell ? '#f8fafc' : '#ffffff',
                                    cursor: 'pointer',
                                    height: 54
                                  }}
                                >
                                  {cell.corner_flag && (
                                    <div 
                                      style={{
                                        position: 'absolute',
                                        top: 0,
                                        right: 0,
                                        width: 0,
                                        height: 0,
                                        borderStyle: 'solid',
                                        borderWidth: '0 10px 10px 0',
                                        borderColor: cell.corner_flag === 'red' ? 'transparent #ef4444 transparent transparent' : 'transparent #eab308 transparent transparent',
                                        zIndex: 2
                                      }}
                                    />
                                  )}

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {shifts.map((sh, sIdx) => {
                                      const badgeBg = sh.code === 'c' ? '#f38218' : (sh.code === 'm' ? '#f78a8a' : '#4a6977')
                                      
                                      // Si es la celda activa seleccionada, mostrar estilo idéntico a Imagen 2
                                      const isCurrentActive = isSelectedCell && sIdx === 0

                                      return (
                                        <div 
                                          key={sIdx}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            background: '#ffffff',
                                            border: isCurrentActive ? '2px solid #000000' : '1px solid #e2e8f0',
                                            borderRadius: 4,
                                            padding: '2px 4px',
                                            fontSize: 11,
                                            fontWeight: 600,
                                            color: '#1e293b',
                                            boxShadow: isCurrentActive ? '0 1px 3px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.03)'
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span 
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: 16,
                                                height: 16,
                                                borderRadius: 3,
                                                background: badgeBg,
                                                color: '#ffffff',
                                                fontSize: 10,
                                                fontWeight: 800,
                                                textTransform: 'uppercase'
                                              }}
                                            >
                                              {sh.code}
                                            </span>
                                            <span style={{ fontSize: 11, whiteSpace: 'nowrap', fontWeight: 600, color: '#1e293b' }}>
                                              {sh.time_label}
                                            </span>
                                          </div>

                                          {sh.is_lightning && (
                                            <span style={{ color: '#e02424', fontSize: 11, marginLeft: 2 }}>⚡</span>
                                          )}
                                        </div>
                                      )
                                    })}

                                    {cell.overtime_note && (
                                      <div style={{ fontSize: 9, color: '#dc2626', background: '#fee2e2', padding: '1px 4px', borderRadius: 3, textAlign: 'center', fontWeight: 600 }}>
                                        ⏰ {cell.overtime_note}
                                      </div>
                                    )}

                                    {cell.time_off_badge && (
                                      <div 
                                        style={{
                                          fontSize: 9,
                                          fontWeight: 800,
                                          textAlign: 'center',
                                          padding: '2px 4px',
                                          borderRadius: 3,
                                          border: cell.time_off_badge === 'TIME OFF' ? '1px solid #cbd5e1' : '1px solid #fde047',
                                          background: cell.time_off_badge === 'TIME OFF' ? '#f1f5f9' : '#fef9c3',
                                          color: cell.time_off_badge === 'TIME OFF' ? '#475569' : '#a16207',
                                          letterSpacing: '0.2px'
                                        }}
                                      >
                                        {cell.time_off_badge}
                                      </div>
                                    )}

                                    {isAvailableHover && (
                                      <div style={{ background: '#2dd4bf', color: '#ffffff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, textAlign: 'center' }}>
                                        Available
                                      </div>
                                    )}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* 7SHIFTS BUDGET TOOL (BARRA INFERIOR FIJA) */}
          <div 
            style={{
              position: 'fixed',
              bottom: 0,
              left: 240,
              right: 0,
              background: '#ffffff',
              borderTop: '2px solid #cbd5e1',
              boxShadow: '0 -2px 10px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              height: 48,
              zIndex: 90
            }}
          >
            <div style={{ width: 230, minWidth: 230, display: 'flex', borderRight: '1px solid #e2e8f0', height: '100%' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', fontWeight: 700, fontSize: 12, color: '#1e293b', borderBottom: '2px solid #2563eb' }}>
                Budget Tool
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontWeight: 600, fontSize: 11, color: '#8b5cf6', gap: 4 }}>
                <Award size={12} /> Optimal Labor
              </div>
            </div>

            {(weekData?.week_columns || []).map((col) => (
              <div key={col.date} style={{ flex: 1, minWidth: 140, padding: '4px 10px', borderRight: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#64748b' }}>
                  -
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>
                    {col.budget_hours} Hrs
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 500 }}>
                    ${col.budget_labor.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          VISTA 2: TIME OFF (REQUESTS & CALENDAR - IMÁGENES 5 Y 8)
          ========================================================================= */}
      {activeTab === 'timeoff' && (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 'calc(100vh - 60px)', background: '#fafafa' }}>
          <div style={{ background: '#ffffff', borderRight: '1px solid #e2e8f0', padding: '24px 16px' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>
              Time off
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button 
                onClick={() => setTimeOffSubTab('requests')}
                style={{
                  border: 'none',
                  background: timeOffSubTab === 'requests' ? '#f3f2ef' : 'transparent',
                  color: timeOffSubTab === 'requests' ? '#1e293b' : '#64748b',
                  fontWeight: timeOffSubTab === 'requests' ? 700 : 500,
                  padding: '10px 14px',
                  borderRadius: 8,
                  textAlign: 'left',
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Requests
              </button>
              <button 
                onClick={() => setTimeOffSubTab('calendar')}
                style={{
                  border: 'none',
                  background: timeOffSubTab === 'calendar' ? '#f3f2ef' : 'transparent',
                  color: timeOffSubTab === 'calendar' ? '#1e293b' : '#64748b',
                  fontWeight: timeOffSubTab === 'calendar' ? 700 : 500,
                  padding: '10px 14px',
                  borderRadius: 8,
                  textAlign: 'left',
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Calendar
              </button>
              <button 
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#64748b',
                  fontWeight: 500,
                  padding: '10px 14px',
                  borderRadius: 8,
                  textAlign: 'left',
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Blocked Days
              </button>
            </div>
          </div>

          <div style={{ padding: '32px 40px' }}>
            {timeOffSubTab === 'requests' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>
                    Requests
                  </h1>

                  <button 
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    + Add time off
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 6, fontSize: 13, background: '#fff' }}>
                    <MapPin size={13} style={{ color: '#64748b' }} />
                    <span>All locations</span>
                    <span style={{ color: '#94a3b8', fontSize: 10 }}>▾</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 6, fontSize: 13, background: '#fff' }}>
                    <User size={13} style={{ color: '#64748b' }} />
                    <span>All employees</span>
                    <span style={{ color: '#94a3b8', fontSize: 10 }}>▾</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 6, fontSize: 13, background: '#fff' }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1px solid #64748b', display: 'inline-block' }} />
                    <select 
                      value={timeOffStatusFilter}
                      onChange={(e) => setTimeOffStatusFilter(e.target.value)}
                      style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, cursor: 'pointer' }}
                    >
                      <option value="All">All statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                    </select>
                  </div>

                  <span style={{ color: '#2563eb', fontSize: 13, cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>
                    Reset filters
                  </span>
                </div>

                <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fafafa' }}>
                        <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Employee</th>
                        <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Date submitted ˅</th>
                        <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Approved (YTD)</th>
                        <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Time off requested ↕</th>
                        <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Status</th>
                        <th style={{ width: 40 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {timeOffRequests
                        .filter(r => timeOffStatusFilter === 'All' || r.status === timeOffStatusFilter)
                        .map((req) => (
                          <tr key={req.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '14px 20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <img src={req.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                                  {req.employee_name}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '14px 20px', fontSize: 13, color: '#475569' }}>
                              {req.date_submitted}
                            </td>
                            <td style={{ padding: '14px 20px', fontSize: 13, color: '#475569', fontWeight: 600 }}>
                              {req.approved_ytd}
                            </td>
                            <td style={{ padding: '14px 20px', fontSize: 13, color: '#1e293b', fontWeight: 500 }}>
                              {req.time_off_requested}
                            </td>
                            <td style={{ padding: '14px 20px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: req.status === 'Approved' ? '#ecfdf5' : '#ffffff', color: req.status === 'Approved' ? '#059669' : '#1e293b' }}>
                                {req.status} ▾
                              </div>
                            </td>
                            <td style={{ padding: '14px 20px', textAlign: 'right', color: '#94a3b8' }}>
                              <MoreVertical size={16} style={{ cursor: 'pointer' }} />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {timeOffSubTab === 'calendar' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button style={{ border: '1px solid #cbd5e1', background: '#fff', padding: '6px 8px', borderRadius: 6 }}>
                      <ChevronLeft size={14} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                      <CalendarIcon size={16} /> September, 2026
                    </div>
                    <button style={{ border: '1px solid #cbd5e1', background: '#fff', padding: '6px 8px', borderRadius: 6 }}>
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  <button 
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    + Add time off
                  </button>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e2e8f0', background: '#fafafa' }}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                      <div key={d} style={{ padding: '10px', fontSize: 12, fontWeight: 700, color: '#64748b', textAlign: 'left' }}>
                        {d}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 400 }}>
                    <div style={{ borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: 8, minHeight: 90 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>31</div>
                      <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>🟡 Ana Maria Tolosa</div>
                      <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>🟢 Valentina Prieto</div>
                    </div>
                    <div style={{ borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>Sep 1</div>
                      <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>🟡 Ana Maria Tolosa</div>
                      <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>🟢 Catalina Cely Rueda</div>
                    </div>
                    <div style={{ borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>2</div>
                      <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>🟢 Estefania Rodriguez</div>
                    </div>
                    <div style={{ borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>3</div>
                      <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>🟡 Estefania Rodriguez</div>
                    </div>
                    <div style={{ borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>4</div>
                      <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>🟡 Ana Maria Tolosa</div>
                    </div>
                    <div style={{ borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>5</div>
                      <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>🟡 Estefania Rodriguez</div>
                    </div>
                    <div style={{ borderBottom: '1px solid #f1f5f9', padding: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>6</div>
                    </div>

                    <div style={{ borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: 8, minHeight: 90 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>7</div>
                      <div style={{ fontSize: 10, color: '#059669', marginTop: 4, fontWeight: 600 }}>🟢 Estefania Rodriguez</div>
                    </div>
                    <div style={{ borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>8</div>
                      <div style={{ fontSize: 10, color: '#059669', marginTop: 4, fontWeight: 600 }}>🟢 Estefania Rodriguez</div>
                    </div>
                    <div style={{ borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>9</div>
                      <div style={{ fontSize: 10, color: '#059669', marginTop: 4, fontWeight: 600 }}>🟢 Estefania Rodriguez</div>
                    </div>
                    <div style={{ borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>10</div>
                      <div style={{ fontSize: 10, color: '#059669', marginTop: 4, fontWeight: 600 }}>🟢 Estefania Rodriguez</div>
                    </div>
                    <div style={{ borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>11</div>
                      <div style={{ fontSize: 10, color: '#059669', marginTop: 4, fontWeight: 600 }}>🟢 Estefania Rodriguez</div>
                    </div>
                    <div style={{ borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: 8, background: '#f8fafc' }}>
                      <div style={{ display: 'inline-block', width: 20, height: 20, borderRadius: '50%', background: '#2563eb', color: '#fff', textAlign: 'center', lineHeight: '20px', fontSize: 11, fontWeight: 700 }}>12</div>
                      <div style={{ fontSize: 10, color: '#a16207', marginTop: 4, fontWeight: 600 }}>🟡 Estefania Rodriguez</div>
                    </div>
                    <div style={{ borderBottom: '1px solid #f1f5f9', padding: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>13</div>
                    </div>

                    <div style={{ borderRight: '1px solid #f1f5f9', padding: 8, minHeight: 90 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>14</div>
                      <div style={{ fontSize: 10, color: '#059669', marginTop: 4 }}>🟢 Estefania Rodriguez</div>
                    </div>
                    <div style={{ borderRight: '1px solid #f1f5f9', padding: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>15</div>
                      <div style={{ fontSize: 10, color: '#059669', marginTop: 4 }}>🟢 Estefania Rodriguez</div>
                    </div>
                    <div style={{ borderRight: '1px solid #f1f5f9', padding: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>16</div>
                      <div style={{ fontSize: 10, color: '#059669', marginTop: 4 }}>🟢 Ana Maria Tolosa</div>
                    </div>
                    <div style={{ borderRight: '1px solid #f1f5f9', padding: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>17</div>
                      <div style={{ fontSize: 10, color: '#059669', marginTop: 4 }}>🟢 Estefania Rodriguez</div>
                    </div>
                    <div style={{ borderRight: '1px solid #f1f5f9', padding: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>18</div>
                      <div style={{ fontSize: 10, color: '#059669', marginTop: 4 }}>🟢 Estefania Rodriguez</div>
                    </div>
                    <div style={{ borderRight: '1px solid #f1f5f9', padding: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>19</div>
                      <div style={{ fontSize: 10, color: '#059669', marginTop: 4 }}>🟢 Estefania Rodriguez</div>
                    </div>
                    <div style={{ padding: 8, background: '#ecfdf5' }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>20</div>
                      <div style={{ fontSize: 10, color: '#059669', fontWeight: 700, marginTop: 4 }}>Catalina Cely Rueda</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          VISTA 3: AVAILABILITY (REQUESTS & GLANCE VIEW - IMÁGENES 6 Y 7)
          ========================================================================= */}
      {activeTab === 'availability' && (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 'calc(100vh - 60px)', background: '#fafafa' }}>
          <div style={{ background: '#ffffff', borderRight: '1px solid #e2e8f0', padding: '24px 16px' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>
              Availability
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button 
                onClick={() => setAvailSubTab('requests')}
                style={{
                  border: 'none',
                  background: availSubTab === 'requests' ? '#f3f2ef' : 'transparent',
                  color: availSubTab === 'requests' ? '#1e293b' : '#64748b',
                  fontWeight: availSubTab === 'requests' ? 700 : 500,
                  padding: '10px 14px',
                  borderRadius: 8,
                  textAlign: 'left',
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Requests
              </button>
              <button 
                onClick={() => setAvailSubTab('glance')}
                style={{
                  border: 'none',
                  background: availSubTab === 'glance' ? '#f3f2ef' : 'transparent',
                  color: availSubTab === 'glance' ? '#1e293b' : '#64748b',
                  fontWeight: availSubTab === 'glance' ? 700 : 500,
                  padding: '10px 14px',
                  borderRadius: 8,
                  textAlign: 'left',
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Glance View
              </button>
              <button 
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#64748b',
                  fontWeight: 500,
                  padding: '10px 14px',
                  borderRadius: 8,
                  textAlign: 'left',
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Reasons
              </button>
            </div>
          </div>

          <div style={{ padding: '32px 40px' }}>
            {availSubTab === 'requests' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>
                    Availability requests
                  </h1>

                  <button 
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    + Add availability
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 6, fontSize: 13, background: '#fff' }}>
                    <MapPin size={13} style={{ color: '#64748b' }} />
                    <span>All locations</span>
                    <span style={{ color: '#94a3b8', fontSize: 10 }}>▾</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 6, fontSize: 13, background: '#fff' }}>
                    <User size={13} style={{ color: '#64748b' }} />
                    <span>All Employees</span>
                    <span style={{ color: '#94a3b8', fontSize: 10 }}>▾</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 6, fontSize: 13, background: '#fff' }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1px solid #64748b', display: 'inline-block' }} />
                    <span>All Types</span>
                    <span style={{ color: '#94a3b8', fontSize: 10 }}>▾</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 6, fontSize: 13, background: '#fff' }}>
                    <span>Select...</span>
                    <span style={{ color: '#94a3b8', fontSize: 10 }}>▾</span>
                  </div>
                </div>

                <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fafafa' }}>
                        <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Employee</th>
                        <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Effective dates ↕</th>
                        <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Date submitted ↕</th>
                        <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Status ↕</th>
                        <th style={{ width: 60 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {availRequests.map((req) => (
                        <tr key={req.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                <User size={16} />
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{req.employee_name}</div>
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>{req.type_label}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: 13, color: '#475569' }}>
                            {req.effective_dates}
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: 13, color: '#475569' }}>
                            {req.date_submitted}
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <span style={{ background: '#ccfbf1', color: '#0f766e', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>
                              {req.status}
                            </span>
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'right', color: '#94a3b8' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                              <Edit2 size={15} style={{ cursor: 'pointer' }} />
                              <MoreVertical size={16} style={{ cursor: 'pointer' }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {availSubTab === 'glance' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>
                    Glance View
                  </h1>

                  <button 
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#334155',
                      borderRadius: 6,
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Download size={14} /> Print / Download
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 6, fontSize: 13, background: '#fff' }}>
                    <CalendarIcon size={14} style={{ color: '#64748b' }} />
                    <input 
                      type="text" 
                      defaultValue="09/07/2026"
                      style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: 90 }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 6, fontSize: 13, background: '#fff' }}>
                    <MapPin size={13} style={{ color: '#64748b' }} />
                    <span>All locations</span>
                    <span style={{ color: '#94a3b8', fontSize: 10 }}>▾</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 6, fontSize: 13, background: '#fff' }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1px solid #64748b', display: 'inline-block' }} />
                    <span>All Types</span>
                    <span style={{ color: '#94a3b8', fontSize: 10 }}>▾</span>
                  </div>
                </div>

                <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fafafa' }}>
                        <th style={{ width: 220, textAlign: 'left', padding: '12px 18px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                          Employee
                        </th>
                        {(glanceData?.columns || []).map((col) => (
                          <th key={col.key} style={{ textAlign: 'center', padding: '10px', fontSize: 12, fontWeight: 700, color: '#1e293b', borderLeft: '1px solid #e2e8f0' }}>
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(glanceData?.glance_matrix || []).map((emp) => (
                        <tr key={emp.name} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <img src={emp.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{emp.name}</div>
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>{emp.type}</div>
                              </div>
                            </div>
                          </td>

                          {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((dKey) => {
                            const dInfo = emp.days[dKey] || { state: 'available', text: 'Available' }
                            let cellBg = '#d4f3e9'
                            let cellText = '#065f46'
                            let mainTitle = 'Available'
                            let subHours = null

                            if (dInfo.state === 'hours') {
                              cellBg = '#fff4e6'
                              cellText = '#9a3412'
                              mainTitle = 'Available'
                              subHours = dInfo.text
                            } else if (dInfo.state === 'unavailable') {
                              cellBg = '#fde7e7'
                              cellText = '#991b1b'
                              mainTitle = 'Not available'
                            }

                            return (
                              <td 
                                key={dKey}
                                style={{
                                  padding: '8px',
                                  borderLeft: '1px solid #e2e8f0',
                                  textAlign: 'center',
                                  verticalAlign: 'middle',
                                  background: cellBg
                                }}
                              >
                                <div style={{ fontSize: 11, fontWeight: 700, color: cellText }}>
                                  {mainTitle}
                                </div>
                                {subHours && (
                                  <div style={{ fontSize: 9, color: cellText, marginTop: 2, fontWeight: 600 }}>
                                    {subHours}
                                  </div>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: EDIT SHIFT / ADD SHIFT · EXACTO 7SHIFTS (IMAGEN 1)
          ========================================================================= */}
      {editModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
            overflowY: 'auto'
          }}
          onClick={() => setEditModal(null)}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: 12,
              width: 480,
              maxWidth: '100%',
              maxHeight: 'calc(100vh - 32px)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 30px -5px rgba(0, 0, 0, 0.35)',
              overflow: 'hidden',
              margin: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. Header fijo */}
            <div style={{ padding: '14px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
                {editModal.id ? 'Edit shift' : 'Add shift'}
              </h2>
              <button 
                type="button"
                onClick={() => setEditModal(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* 2. Pestañas fijas: Shift details | Time punch */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 20px', flexShrink: 0, background: '#fafafa' }}>
              <button 
                type="button"
                onClick={() => setModalTab('details')}
                style={{
                  border: 'none',
                  borderBottom: modalTab === 'details' ? '2px solid #0f172a' : '2px solid transparent',
                  background: modalTab === 'details' ? '#ffffff' : 'transparent',
                  color: modalTab === 'details' ? '#0f172a' : '#64748b',
                  fontWeight: modalTab === 'details' ? 700 : 500,
                  fontSize: 13,
                  padding: '9px 16px',
                  cursor: 'pointer'
                }}
              >
                Shift details
              </button>
              <button 
                type="button"
                onClick={() => setModalTab('punch')}
                style={{
                  border: 'none',
                  borderBottom: modalTab === 'punch' ? '2px solid #0f172a' : '2px solid transparent',
                  background: modalTab === 'punch' ? '#ffffff' : 'transparent',
                  color: modalTab === 'punch' ? '#0f172a' : '#64748b',
                  fontWeight: modalTab === 'punch' ? 700 : 500,
                  fontSize: 13,
                  padding: '9px 16px',
                  cursor: 'pointer'
                }}
              >
                Time punch
              </button>
            </div>

            {/* 3. Formulario que contiene cuerpo scrollable y footer fijo */}
            <form 
              onSubmit={handleSaveShiftModal} 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                flex: 1, 
                minHeight: 0, 
                overflow: 'hidden' 
              }}
            >
              {/* Contenedor del contenido con scroll interno suave si la pantalla es reducida */}
              <div 
                style={{ 
                  flex: 1, 
                  overflowY: 'auto', 
                  padding: '16px 20px' 
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Shift details
                </div>

                {/* 1. Selector de Empleado */}
                <div style={{ marginBottom: 10 }}>
                  <select 
                    value={editModal.employee_name}
                    onChange={(e) => setEditModal({ ...editModal, employee_name: e.target.value })}
                    style={{
                      width: '100%',
                      height: 38,
                      padding: '0 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      fontSize: 13,
                      color: '#1e293b',
                      background: '#ffffff',
                      fontWeight: 500,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {ALL_STAFF_MEMBERS.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Selector de Rol */}
                <div style={{ marginBottom: 10 }}>
                  <select 
                    value={editModal.role}
                    onChange={(e) => setEditModal({ ...editModal, role: e.target.value })}
                    style={{
                      width: '100%',
                      height: 38,
                      padding: '0 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      fontSize: 13,
                      color: '#1e293b',
                      background: '#ffffff',
                      fontWeight: 500,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {ALL_ROLES.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Fila de Horarios */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <div 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      padding: '6px 10px',
                      background: '#ffffff',
                      flex: '1 1 auto'
                    }}
                  >
                    <Clock size={15} style={{ color: '#64748b' }} />
                    
                    {/* Start time */}
                    <input 
                      type="text" 
                      value={editModal.start_time}
                      onChange={(e) => setEditModal({ ...editModal, start_time: e.target.value })}
                      style={{ width: 75, border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: '#1e293b', background: 'transparent' }}
                      placeholder="7:00 AM"
                    />

                    <span style={{ color: '#94a3b8' }}>→</span>

                    {/* End time */}
                    <input 
                      type="text" 
                      value={editModal.end_time}
                      onChange={(e) => setEditModal({ ...editModal, end_time: e.target.value })}
                      style={{ width: 75, border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: '#1e293b', background: 'transparent' }}
                      placeholder="2:00 PM"
                    />

                    {/* Duración calculada */}
                    <span style={{ color: '#64748b', fontSize: 12, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                      ({modalDuration} hrs)
                    </span>
                  </div>

                  {/* Checkboxes Close & BD */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#1e293b', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={editModal.is_close}
                        onChange={(e) => setEditModal({ ...editModal, is_close: e.target.checked })}
                      />
                      <span>Close</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#1e293b', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={editModal.is_bd}
                        onChange={(e) => setEditModal({ ...editModal, is_bd: e.target.checked })}
                      />
                      <span>BD</span>
                      <HelpCircle size={13} style={{ color: '#64748b' }} />
                    </label>
                  </div>
                </div>

                {/* Enlace rápido "or use common shift times" */}
                <div style={{ marginBottom: 10 }}>
                  <span 
                    onClick={() => setShowCommonTimes(!showCommonTimes)}
                    style={{ color: '#2563eb', fontSize: 12, textDecoration: 'underline', cursor: 'pointer', fontWeight: 500 }}
                  >
                    or use common shift times
                  </span>

                  {showCommonTimes && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, background: '#f8fafc', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      {COMMON_SHIFT_TIMES.map(preset => (
                        <button 
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setEditModal({
                              ...editModal,
                              start_time: preset.start,
                              end_time: preset.end
                            })
                            setShowCommonTimes(false)
                          }}
                          style={{
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#334155',
                            cursor: 'pointer'
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ribbon 🎖️ 0 free shift notes remaining */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: '#a855f7' }}>
                  <Award size={14} />
                  <span style={{ fontSize: 11, fontWeight: 600 }}>0 free shift notes remaining</span>
                </div>

                {/* Textarea para Notas */}
                <div style={{ marginBottom: 10 }}>
                  <textarea 
                    value={editModal.notes}
                    onChange={(e) => setEditModal({ ...editModal, notes: e.target.value.slice(0, 250) })}
                    placeholder="Add notes the employee needs to know about this shift."
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      fontSize: 12,
                      color: '#1e293b',
                      background: '#ffffff',
                      outline: 'none',
                      resize: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ textAlign: 'right', fontSize: 10, color: '#94a3b8', marginTop: 1 }}>
                    {250 - (editModal.notes?.length || 0)}
                  </div>
                </div>

                {/* 4. Sección "Apply to" con Círculos Mon a Sun */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Apply to
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                      const isSelected = (editModal.apply_to_days || []).includes(day)
                      return (
                        <button 
                          key={day}
                          type="button"
                          onClick={() => toggleApplyDay(day)}
                          style={{
                            width: 40,
                            height: 30,
                            borderRadius: 15,
                            border: 'none',
                            background: isSelected ? '#1e293b' : '#f1f5f9',
                            color: isSelected ? '#ffffff' : '#334155',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 5. Sección "Shift flag" */}
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Shift flag
                  </div>
                  <div style={{ position: 'relative' }}>
                    <select 
                      value={editModal.flag}
                      onChange={(e) => setEditModal({ ...editModal, flag: e.target.value })}
                      style={{
                        width: '100%',
                        height: 36,
                        padding: '0 12px 0 32px',
                        border: '1px solid #cbd5e1',
                        borderRadius: 8,
                        fontSize: 12,
                        color: '#1e293b',
                        background: '#ffffff',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="None">None</option>
                      <option value="red">🚩 Red flag (Alerta / Inasistencia)</option>
                      <option value="yellow">🟡 Yellow flag (Guardia / Pendiente)</option>
                    </select>
                    <Flag size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  </div>
                </div>
              </div>

              {/* 6. Footer Fijo (Delete a la izquierda, Cancel y Save a la derecha) */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  borderTop: '1px solid #e2e8f0', 
                  padding: '12px 20px',
                  background: '#ffffff',
                  flexShrink: 0
                }}
              >
                <div>
                  {editModal.id && (
                    <button 
                      type="button"
                      onClick={handleDeleteShiftModal}
                      disabled={deletingShift}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#dc2626',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      {deletingShift ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button 
                    type="button"
                    onClick={() => setEditModal(null)}
                    style={{
                      padding: '7px 16px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      background: '#ffffff',
                      color: '#334155',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>

                  <button 
                    type="submit"
                    disabled={savingShift}
                    style={{
                      padding: '7px 22px',
                      border: 'none',
                      borderRadius: 8,
                      background: '#2563eb',
                      color: '#ffffff',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                    }}
                  >
                    {savingShift ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
