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

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

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

const pad2 = (n) => String(n).padStart(2, '0')
const fmtDateLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const todayLocal = () => fmtDateLocal(new Date())

// "7:00 AM" | "07:00" -> "07:00" (formato que entiende <input type="time">)
function to24(timeStr) {
  const dec = parseTimeToDecimal(timeStr)
  const h = Math.floor(dec)
  const m = Math.round((dec - h) * 60)
  return `${pad2(h)}:${pad2(m)}`
}

function rangeHours(start, end) {
  if (!start || !end) return 0
  return Math.max(0, Math.round((parseTimeToDecimal(end) - parseTimeToDecimal(start)) * 10) / 10)
}

// Devuelve '' si las franjas son válidas, o el mensaje de error en español.
function validateRanges(ranges, { allowEmpty = false } = {}) {
  if (!ranges.length) return allowEmpty ? '' : 'Agrega al menos una franja.'
  for (const r of ranges) {
    if (!r.start_time || !r.end_time) return 'Completa la hora de inicio y de fin de cada franja.'
    if (parseTimeToDecimal(r.end_time) <= parseTimeToDecimal(r.start_time)) {
      return `En la franja ${formatTo12Hour(r.start_time)} → ${formatTo12Hour(r.end_time)} la hora de fin debe ser posterior a la de inicio.`
    }
  }
  const sorted = [...ranges].sort((a, b) => parseTimeToDecimal(a.start_time) - parseTimeToDecimal(b.start_time))
  for (let i = 1; i < sorted.length; i++) {
    if (parseTimeToDecimal(sorted[i].start_time) < parseTimeToDecimal(sorted[i - 1].end_time)) {
      return `Las franjas ${formatTo12Hour(sorted[i - 1].start_time)}–${formatTo12Hour(sorted[i - 1].end_time)} y ${formatTo12Hour(sorted[i].start_time)}–${formatTo12Hour(sorted[i].end_time)} se cruzan.`
    }
  }
  return ''
}

const normName = (v) => (v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean)

// ¿Este nombre del equipo corresponde a la persona que inició sesión? (coincidencia por palabras del nombre)
function isSamePerson(staffName, loginName) {
  const a = normName(staffName), b = normName(loginName)
  if (!a.length || !b.length) return false
  const common = a.filter(t => t.length > 2 && b.includes(t)).length
  return common >= 2 || (a.length === 1 && common === 1)
}

const AVAIL_DAYS = [
  { key: 'mon', label: 'Lunes' }, { key: 'tue', label: 'Martes' }, { key: 'wed', label: 'Miércoles' },
  { key: 'thu', label: 'Jueves' }, { key: 'fri', label: 'Viernes' }, { key: 'sat', label: 'Sábado' }, { key: 'sun', label: 'Domingo' }
]

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
  const [currentDate, setCurrentDate] = useState(todayLocal())
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('week')
  const [departmentFilter, setDepartmentFilter] = useState('all')

  // Celda seleccionada en la matriz
  const [selectedShiftKey, setSelectedShiftKey] = useState('')

  // Estados de Time-Off
  const [timeOffRequests, setTimeOffRequests] = useState([])
  const [timeOffStatusFilter, setTimeOffStatusFilter] = useState('All')

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
  const [copying, setCopying] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [shiftError, setShiftError] = useState('')

  // Modal de disponibilidad semanal (varias franjas por día)
  // Permisos (time off)
  const [timeOffModal, setTimeOffModal] = useState(null)
  const [timeOffSaving, setTimeOffSaving] = useState(false)
  const [timeOffError, setTimeOffError] = useState('')
  const [canDecideTimeOff, setCanDecideTimeOff] = useState(false)

  const [availModal, setAvailModal] = useState(null)
  const [availSaving, setAvailSaving] = useState(false)
  const [availError, setAvailError] = useState('')

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  // Vista simple: para psicólogas / matchmakers (sin costos ni botones de administración). María puede activarla para ver lo mismo que ellas.
  const isTeamView = /psic[oó]log|matchmaker/i.test(user?.role || '')
  const [simplePreview, setSimplePreview] = useState(false)
  const simple = isTeamView || simplePreview
  const loginName = user?.name || user?.full_name || ''
  const isMe = (staffName) => isSamePerson(staffName, loginName)
  // En vista simple cada persona edita solo su propia disponibilidad (si no se reconoce su nombre, puede elegir).
  const myRosterName = (glanceData?.roster || ALL_STAFF_MEMBERS).find(n => isSamePerson(n, loginName)) || null
  const lockToMe = simple && !!myRosterName

  // Equipo: horas semanales, activar / desactivar personas y si ya pusieron su disponibilidad (solo administración).
  const [showTeam, setShowTeam] = useState(false)
  const [teamCfg, setTeamCfg] = useState([])
  const [readiness, setReadiness] = useState(null)
  const fetchTeam = useCallback(() => {
    fetch(`${API}/api/v1/shifts/team-config`, { headers: authHeaders }).then(r => (r.ok ? r.json() : null)).then(d => d && setTeamCfg(d.team || [])).catch(() => {})
    fetch(`${API}/api/v1/shifts/readiness`, { headers: authHeaders }).then(r => (r.ok ? r.json() : null)).then(d => d && setReadiness(d)).catch(() => {})
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!simple) fetchTeam() }, [simple, fetchTeam])
  const [coverage, setCoverage] = useState(null)
  useEffect(() => {
    if (simple) return
    fetch(`${API}/api/v1/shifts/coverage?week_date=${currentDate}`, { headers: authHeaders })
      .then(r => (r.ok ? r.json() : null)).then(d => d && setCoverage(d)).catch(() => {})
  }, [simple, currentDate, weekData]) // eslint-disable-line react-hooks/exhaustive-deps
  // Fase 4: generar la semana siguiente, aprobar y enviar correos, recordatorios (solo administración)
  const [weekStatus, setWeekStatus] = useState(null)
  const [planSettings, setPlanSettings] = useState(null)
  const [planMsg, setPlanMsg] = useState('')
  const [planBusy, setPlanBusy] = useState(false)
  const fetchPlanning = useCallback(() => {
    fetch(`${API}/api/v1/shifts/week-status?week_date=${currentDate}`, { headers: authHeaders }).then(r => (r.ok ? r.json() : null)).then(d => d && setWeekStatus(d)).catch(() => {})
    fetch(`${API}/api/v1/shifts/planning-settings`, { headers: authHeaders }).then(r => (r.ok ? r.json() : null)).then(d => setPlanSettings(d)).catch(() => {})
  }, [currentDate, token]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!simple) fetchPlanning() }, [simple, fetchPlanning, weekData])
  const callPlan = async (path, body, okMsg) => {
    setPlanBusy(true); setPlanMsg('')
    try {
      const res = await fetch(`${API}/api/v1/shifts/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify(body) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        const d = j.detail
        if (d?.code === 'HAS_SHIFTS' && window.confirm(`${d.message}\n\n¿Reemplazarlos?`)) { setPlanBusy(false); return callPlan(path, { ...body, replace: true }, okMsg) }
        if (d?.code === 'ALREADY_SENT' && window.confirm(`${d.message}\n\n¿Reenviar los correos?`)) { setPlanBusy(false); return callPlan(path, { ...body, resend: true }, okMsg) }
        setPlanMsg(typeof d === 'string' ? d : (d?.message || 'No se pudo completar la acción.'))
        return
      }
      setPlanMsg(okMsg(j))
      fetchWeek(); fetchTeam(); fetchPlanning()
    } catch (e) {
      setPlanMsg('No se pudo completar la acción.')
    } finally { setPlanBusy(false) }
  }
  const patchSettings = async (body) => {
    const res = await fetch(`${API}/api/v1/shifts/planning-settings`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify(body) })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setPlanMsg(typeof j.detail === 'string' ? j.detail : 'No se pudo guardar el ajuste.'); return }
    setPlanSettings(j)
  }
  const updateMember = async (id, body) => {
    const res = await fetch(`${API}/api/v1/shifts/team/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify(body) })
    if (!res.ok) { setNotification('No se pudo actualizar a la persona.'); setTimeout(() => setNotification(''), 4000); return }
    fetchTeam()
    fetchWeek()
  }

  // Cargar datos de la semana (Schedule)
  const fetchWeek = useCallback(() => {
    setLoading(true)
    fetch(`${API}/api/v1/shifts/week?week_date=${currentDate}`, { headers: authHeaders })
      .then(r => {
        if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Tu sesión no tiene acceso a los turnos. Vuelve a iniciar sesión.' : 'No se pudieron cargar los turnos.')
        return r.json()
      })
      .then(data => {
        setWeekData(data)
        setLoadError('')
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching weekly shifts:', err)
        setLoadError(err.message || 'No se pudieron cargar los turnos.')
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, token])

  // Cargar datos de Time-Off
  const fetchTimeOff = useCallback(() => {
    fetch(`${API}/api/v1/shifts/time-off/requests`, { headers: authHeaders })
      .then(r => r.ok ? r.json() : { requests: [] })
      .then(d => { setTimeOffRequests(d.requests || []); setCanDecideTimeOff(!!d.can_decide) })
      .catch(err => console.error('Error fetching time-off:', err))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Cargar datos de Availability
  const fetchAvailability = useCallback(() => {
    fetch(`${API}/api/v1/shifts/availability/requests`, { headers: authHeaders })
      .then(r => r.ok ? r.json() : { requests: [] })
      .then(d => setAvailRequests(d.requests || []))
      .catch(err => console.error('Error fetching avail requests:', err))

    fetch(`${API}/api/v1/shifts/availability/glance`, { headers: authHeaders })
      .then(r => r.ok ? r.json() : null)
      .then(d => setGlanceData(d))
      .catch(err => console.error('Error fetching glance:', err))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

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

  // Abrir Modal de Turno estilo 7shifts. Recibe TODOS los turnos (franjas) de la celda: turno partido = varias franjas.
  const openEditShiftModal = (empName, dateStr, dayShifts = [], roleName = "Customer Service Assistant") => {
    setSelectedShiftKey(`${empName}_${dateStr}`)

    // Calcular día de la semana para el Apply to inicial
    const dObj = new Date(dateStr + "T00:00:00")
    const dayIndex = (dObj.getDay() + 6) % 7 // 0=Mon, 6=Sun
    const daysAbbr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const initialDay = daysAbbr[dayIndex] || 'Mon'

    const existing = (dayShifts || []).filter(Boolean)
    const ranges = existing.length
      ? existing.map(sh => ({ start_time: to24(sh.start_time), end_time: to24(sh.end_time), shift_type: sh.shift_type === 'MATCHMAKING' ? 'MATCHMAKING' : 'ENTREVISTAS' }))
      : [{ start_time: '09:00', end_time: '13:00', shift_type: 'ENTREVISTAS' }]

    setEditModal({
      has_existing: existing.length > 0,
      employee_name: empName,
      role: roleName,
      date: dateStr,
      ranges,
      is_close: false,
      is_bd: false,
      notes: existing[0]?.notes || "",
      apply_to_days: [initialDay],
      flag: existing.find(sh => sh.shift_flag && sh.shift_flag !== 'None')?.shift_flag || "None"
    })
    setShiftError('')
    setModalTab('details')
    setShowCommonTimes(false)
  }

  // Franjas del turno partido: agregar / editar / quitar
  const updateRange = (idx, field, value) => {
    if (!editModal) return
    const ranges = editModal.ranges.map((r, i) => i === idx ? { ...r, [field]: value } : r)
    setEditModal({ ...editModal, ranges })
    setShiftError('')
  }

  const addRange = () => {
    if (!editModal || editModal.ranges.length >= 6) return
    const last = editModal.ranges[editModal.ranges.length - 1]
    const startDec = last?.end_time ? Math.min(parseTimeToDecimal(last.end_time) + 1, 22) : 14
    const endDec = Math.min(startDec + 2, 23)
    const toHHMM = (dec) => `${pad2(Math.floor(dec))}:${pad2(Math.round((dec - Math.floor(dec)) * 60))}`
    setEditModal({ ...editModal, ranges: [...editModal.ranges, { start_time: toHHMM(startDec), end_time: toHHMM(endDec), shift_type: last?.shift_type === 'MATCHMAKING' ? 'ENTREVISTAS' : 'MATCHMAKING' }] })
    setShiftError('')
  }

  const removeRange = (idx) => {
    if (!editModal || editModal.ranges.length <= 1) return
    setEditModal({ ...editModal, ranges: editModal.ranges.filter((_, i) => i !== idx) })
    setShiftError('')
  }

  // Convierte los días marcados en "Apply to" en fechas reales de la semana que se está viendo
  const applyDatesFromModal = () => {
    const daysAbbr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const mondayObj = new Date((weekData?.week_monday || currentDate) + "T00:00:00")
    const dates = (editModal.apply_to_days || []).map(dayStr => {
      const offset = daysAbbr.indexOf(dayStr)
      if (offset < 0) return editModal.date
      const d = new Date(mondayObj)
      d.setDate(d.getDate() + offset)
      return fmtDateLocal(d)
    })
    return dates.length ? dates : [editModal.date]
  }

  const shiftTypeForRole = (role) => {
    const r = (role || '').toLowerCase()
    return r.includes('matchmaker') ? 'MATCHMAKING' : (r.includes('interviewer') ? 'ENTREVISTAS' : 'CS')
  }

  const saveDayRequest = async (ranges, dates, force = false) => {
    const res = await fetch(`${API}/api/v1/shifts/day`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        psychologist_name: editModal.employee_name,
        dates,
        ranges,
        shift_type: shiftTypeForRole(editModal.role),
        is_published: true,
        notes: editModal.notes,
        shift_flag: editModal.flag,
        force
      })
    })
    if (!res.ok) {
      let detail = 'No se pudo guardar el turno.'
      try {
        const j = await res.json()
        if (typeof j.detail === 'string') detail = j.detail
        else if (j.detail?.code === 'HAS_APPOINTMENTS') {
          if (window.confirm(`${j.detail.message}

El cliente seguirá con su cita agendada pero sin turno que la cubra. ¿Guardar igual?`)) {
            return saveDayRequest(ranges, dates, true)
          }
          throw new Error('Cambio cancelado: hay entrevistas agendadas en ese horario.')
        }
      } catch (e) { if (e instanceof Error && e.message.startsWith('Cambio cancelado')) throw e }
      throw new Error(detail)
    }
  }

  // Guardar Turno (todas las franjas del día)
  const handleSaveShiftModal = async (e) => {
    e.preventDefault()
    if (!editModal) return
    const err = validateRanges(editModal.ranges)
    if (err) { setShiftError(err); return }
    setSavingShift(true)
    setShiftError('')
    try {
      await saveDayRequest(editModal.ranges, applyDatesFromModal())
      setNotification(editModal.ranges.length > 1 ? 'Turno partido guardado.' : 'Turno guardado.')
      setEditModal(null)
      fetchWeek()
      fetchAvailability()
      setTimeout(() => setNotification(''), 4000)
    } catch (error) {
      setShiftError(error.message || 'Error al guardar el turno')
    } finally {
      setSavingShift(false)
    }
  }

  // Borrar el día (todas las franjas) de esa persona
  const handleDeleteShiftModal = async () => {
    if (!editModal?.has_existing) {
      setEditModal(null)
      return
    }
    if (!window.confirm(`¿Borrar todos los turnos de ${editModal.employee_name} el ${editModal.date}?`)) {
      return
    }
    setDeletingShift(true)
    setShiftError('')
    try {
      await saveDayRequest([], [editModal.date])
      setNotification('Turnos del día eliminados.')
      setEditModal(null)
      fetchWeek()
      setTimeout(() => setNotification(''), 4000)
    } catch (error) {
      setShiftError(error.message || 'Error al eliminar el turno')
    } finally {
      setDeletingShift(false)
    }
  }

  // Copiar la semana anterior a la semana que se está viendo (no toca días que ya tienen turnos)
  const handleCopyPreviousWeek = async () => {
    if (!weekData?.week_monday) return
    if (!window.confirm('¿Copiar los turnos de la semana anterior a esta semana? Los días que ya tienen turnos no se modifican.')) return
    const prev = new Date(weekData.week_monday + 'T00:00:00')
    prev.setDate(prev.getDate() - 7)
    setCopying(true)
    try {
      const res = await fetch(`${API}/api/v1/shifts/copy-week`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ from_monday: fmtDateLocal(prev), to_monday: weekData.week_monday })
      })
      const j = await res.json().catch(() => ({}))
      setNotification(res.ok ? (j.message || 'Semana copiada.') : (j.detail || 'No se pudo copiar la semana.'))
      fetchWeek()
      setTimeout(() => setNotification(''), 5000)
    } catch (err) {
      setNotification('No se pudo copiar la semana.')
    } finally {
      setCopying(false)
    }
  }

  // ---------- Permisos (time off) ----------
  const openTimeOffModal = (employeeName) => {
    const today = todayLocal()
    setTimeOffModal({
      employee_name: employeeName || myRosterName || (glanceData?.roster || ALL_STAFF_MEMBERS)[0] || ALL_STAFF_MEMBERS[0],
      start_date: today,
      end_date: today,
      reason: ''
    })
    setTimeOffError('')
  }

  const timeOffFetch = async (path, method, body) => {
    const res = await fetch(`${API}/api/v1/shifts/time-off${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: body ? JSON.stringify(body) : undefined
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(typeof j.detail === 'string' ? j.detail : 'No se pudo completar la acción.')
    return j
  }

  const flashNotice = (msg, ms = 4000) => {
    setNotification(msg)
    setTimeout(() => setNotification(''), ms)
  }

  const handleSaveTimeOff = async (e) => {
    e.preventDefault()
    if (!timeOffModal) return
    if (!timeOffModal.start_date || !timeOffModal.end_date) { setTimeOffError('Elige las fechas.'); return }
    if (timeOffModal.end_date < timeOffModal.start_date) { setTimeOffError('La fecha final no puede ser anterior a la inicial.'); return }
    setTimeOffSaving(true)
    setTimeOffError('')
    try {
      const j = await timeOffFetch('', 'POST', {
        psychologist_name: timeOffModal.employee_name,
        start_date: timeOffModal.start_date,
        end_date: timeOffModal.end_date,
        reason: timeOffModal.reason || 'Permiso'
      })
      flashNotice(j.message || 'Permiso guardado.', 5000)
      setTimeOffModal(null)
      fetchTimeOff()
      fetchWeek()
    } catch (err) {
      setTimeOffError(err.message)
    } finally {
      setTimeOffSaving(false)
    }
  }

  const handleDecideTimeOff = async (id, status) => {
    try {
      await timeOffFetch(`/${id}`, 'PATCH', { status })
      flashNotice(status === 'APPROVED' ? 'Permiso aprobado.' : (status === 'DENIED' ? 'Permiso rechazado.' : 'Permiso en pendiente.'))
      fetchTimeOff()
      fetchWeek()
    } catch (err) {
      flashNotice(err.message, 5000)
    }
  }

  const handleDeleteTimeOff = async (id) => {
    if (!window.confirm('¿Eliminar este permiso?')) return
    try {
      await timeOffFetch(`/${id}`, 'DELETE')
      flashNotice('Permiso eliminado.')
      fetchTimeOff()
      fetchWeek()
    } catch (err) {
      flashNotice(err.message, 5000)
    }
  }

  // ---------- Disponibilidad semanal ----------
  const openAvailModal = (employeeName) => {
    const row = (glanceData?.glance_matrix || []).find(e => e.name === employeeName)
    const days = {}
    AVAIL_DAYS.forEach(({ key }) => {
      const cell = row?.days?.[key]
      days[key] = {
        mode: cell?.mode || 'UNSET',
        ranges: (cell?.ranges || []).map(r => ({ start_time: r.start_time, end_time: r.end_time }))
      }
    })
    setAvailModal({ employee_name: employeeName || (glanceData?.roster || [])[0] || ALL_STAFF_MEMBERS[0], days })
    setAvailError('')
  }

  const changeAvailEmployee = (name) => {
    openAvailModal(name)
  }

  const setAvailMode = (key, mode) => {
    const cur = availModal.days[key]
    const ranges = mode === 'RANGES' && cur.ranges.length === 0 ? [{ start_time: '09:00', end_time: '12:00' }] : cur.ranges
    setAvailModal({ ...availModal, days: { ...availModal.days, [key]: { mode, ranges } } })
    setAvailError('')
  }

  const setAvailRange = (key, idx, field, value) => {
    const cur = availModal.days[key]
    const ranges = cur.ranges.map((r, i) => i === idx ? { ...r, [field]: value } : r)
    setAvailModal({ ...availModal, days: { ...availModal.days, [key]: { ...cur, ranges } } })
    setAvailError('')
  }

  const addAvailRange = (key) => {
    const cur = availModal.days[key]
    if (cur.ranges.length >= 6) return
    const last = cur.ranges[cur.ranges.length - 1]
    const startDec = last?.end_time ? Math.min(parseTimeToDecimal(last.end_time) + 1, 22) : 14
    const endDec = Math.min(startDec + 2, 23)
    const toHHMM = (dec) => `${pad2(Math.floor(dec))}:${pad2(Math.round((dec - Math.floor(dec)) * 60))}`
    setAvailModal({ ...availModal, days: { ...availModal.days, [key]: { ...cur, ranges: [...cur.ranges, { start_time: toHHMM(startDec), end_time: toHHMM(endDec) }] } } })
    setAvailError('')
  }

  const removeAvailRange = (key, idx) => {
    const cur = availModal.days[key]
    const ranges = cur.ranges.filter((_, i) => i !== idx)
    setAvailModal({ ...availModal, days: { ...availModal.days, [key]: { mode: ranges.length ? 'RANGES' : 'UNSET', ranges } } })
    setAvailError('')
  }

  const handleSaveAvailability = async (e) => {
    e.preventDefault()
    if (!availModal) return
    for (const { key, label } of AVAIL_DAYS) {
      const d = availModal.days[key]
      if (d.mode === 'RANGES') {
        const err = validateRanges(d.ranges)
        if (err) { setAvailError(`${label}: ${err}`); return }
      }
    }
    setAvailSaving(true)
    setAvailError('')
    try {
      const days = {}
      AVAIL_DAYS.forEach(({ key }) => {
        const d = availModal.days[key]
        days[key] = { mode: d.mode, ranges: d.mode === 'RANGES' ? d.ranges : [] }
      })
      const res = await fetch(`${API}/api/v1/shifts/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ employee_name: availModal.employee_name, days })
      })
      if (!res.ok) {
        let detail = 'No se pudo guardar la disponibilidad.'
        try { const j = await res.json(); if (typeof j.detail === 'string') detail = j.detail } catch (_) {}
        throw new Error(detail)
      }
      setNotification(`Disponibilidad de ${availModal.employee_name} guardada.`)
      setAvailModal(null)
      fetchAvailability()
      fetchWeek()
      setTimeout(() => setNotification(''), 4000)
    } catch (error) {
      setAvailError(error.message || 'Error al guardar la disponibilidad')
    } finally {
      setAvailSaving(false)
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
    ? Math.round(editModal.ranges.reduce((acc, r) => acc + rangeHours(r.start_time, r.end_time), 0) * 10) / 10
    : 0

  return (
    <div style={{ background: '#f5f6f8', minHeight: '100vh', color: '#1a1f2c', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      {/* 1. TOP HEADER ACCESOS DIRECTOS */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#961500', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CalendarIcon size={15} />
            </div>
            <div>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#1a1f2c', letterSpacing: '-0.3px' }}>Agenda y turnos</span>
              <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>Daily Lover</span>
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
              <CalendarIcon size={14} /> Horario
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
              <CalendarDays size={14} /> Permisos
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
              <Clock size={14} /> {simple ? 'Mi disponibilidad' : 'Disponibilidad'}
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

          {!simple && (
            <>
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
            </>
          )}

          {!isTeamView && (
            <label
              title="Mira esta pantalla como la ven las psicólogas y matchmakers"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#334155', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 10px', background: simplePreview ? '#fef3c7' : '#ffffff' }}
            >
              <input type="checkbox" checked={simplePreview} onChange={(e) => setSimplePreview(e.target.checked)} />
              Vista simple
            </label>
          )}

          {activeTab === 'schedule' && !simple && (
            <button
              onClick={handleCopyPreviousWeek}
              disabled={copying}
              title="Copia los turnos de la semana anterior a esta semana (no toca días que ya tienen turnos)"
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
              {copying ? <RefreshCw size={13} className="animate-spin" /> : <Copy size={13} />}
              Copiar semana anterior
            </button>
          )}

          {activeTab === 'schedule' && !simple && (
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
              Publicar semana
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          VISTA 1: SCHEDULE (MATRIZ SEMANAL IDÉNTICA A 7SHIFTS - IMÁGENES 1 A 4)
          ========================================================================= */}
      {activeTab === 'schedule' && (
        <div>
          {loadError && (
            <div role="alert" style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, fontWeight: 600, padding: '10px 20px' }}>
              {loadError}
            </div>
          )}
          {!simple && readiness && (
            <div style={{ background: readiness.ready ? '#ecfdf5' : '#fffbeb', borderBottom: `1px solid ${readiness.ready ? '#a7f3d0' : '#fde68a'}`, color: readiness.ready ? '#065f46' : '#92400e', fontSize: 13, fontWeight: 600, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span>
                {readiness.ready
                  ? `✅ Disponibilidad completa (${readiness.active_people} personas activas). Ya se puede generar el horario.`
                  : `⏳ Falta la disponibilidad de: ${readiness.missing.join(', ')}. El horario se genera cuando todas las personas activas la pongan.`}
              </span>
              <button type="button" onClick={() => setShowTeam(true)} style={{ border: '1px solid currentColor', background: 'transparent', color: 'inherit', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Equipo (activar / horas)
              </button>
            </div>
          )}
          {!simple && coverage && (() => {
            const open = coverage.days.filter(d => !d.is_past && d.gaps.length)
            return (
              <div role={open.length ? 'alert' : 'status'} style={{ background: open.length ? '#fef2f2' : '#ecfdf5', borderBottom: `1px solid ${open.length ? '#fecaca' : '#a7f3d0'}`, color: open.length ? '#991b1b' : '#065f46', fontSize: 13, fontWeight: 600, padding: '10px 20px' }}>
                {open.length ? (
                  <>
                    <div>🚨 Hay {coverage.total_gaps} tramo(s) sin nadie en entrevistas esta semana:</div>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontWeight: 500 }}>
                      {open.map(d => (<li key={d.date}><b>{d.weekday} {d.date.slice(8)}/{d.date.slice(5, 7)}</b>: {d.gaps.map(g => g.label).join(', ')}</li>))}
                    </ul>
                  </>
                ) : '✅ Todas las horas de entrevistas de esta semana tienen cobertura.'}
              </div>
            )
          })()}
          {!simple && planSettings && weekStatus && (() => {
            const future = weekStatus.week_monday >= weekStatus.next_monday
            const st = weekStatus.status
            const label = st === 'APROBADA' ? 'Aprobada' : (st === 'BORRADOR' ? 'Borrador (aún no publicado)' : 'Sin generar')
            const btn = { border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#fff' }
            return (
              <div style={{ background: '#eff6ff', borderBottom: '1px solid #bfdbfe', color: '#1e3a8a', fontSize: 13, fontWeight: 600, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span>Semana del {weekStatus.week_monday.slice(8)}/{weekStatus.week_monday.slice(5, 7)}: <b>{label}</b>{st === 'APROBADA' && weekStatus.approved_by ? ` · por ${weekStatus.approved_by}` : ''}</span>
                {future && st !== 'APROBADA' && (
                  <button type="button" disabled={planBusy || !readiness?.ready} title={readiness?.ready ? 'Crea el borrador con las reglas y las disponibilidades' : 'Falta la disponibilidad de alguna persona activa'}
                    onClick={() => callPlan('generate', { week_monday: weekStatus.week_monday }, r => `Borrador generado: ${r.shifts} turnos.${r.uncovered?.length ? ` Quedan ${r.uncovered.length} tramo(s) sin cobertura.` : ' Cobertura completa.'}`)}
                    style={{ ...btn, background: readiness?.ready ? '#2563eb' : '#94a3b8', cursor: readiness?.ready && !planBusy ? 'pointer' : 'not-allowed' }}>
                    {planBusy ? 'Trabajando…' : 'Generar horario de esta semana'}
                  </button>
                )}
                {st === 'BORRADOR' && (
                  <button type="button" disabled={planBusy}
                    onClick={() => { if (window.confirm(`Se publicará esta semana y se enviará a cada persona activa su horario por correo${planSettings.email_test_to ? ` (MODO PRUEBA: todos a ${planSettings.email_test_to})` : ''}. ¿Aprobar?`)) callPlan('week/approve', { week_monday: weekStatus.week_monday }, r => `Semana aprobada. Correos enviados: ${r.sent.filter(x => x.ok).length} de ${r.sent.length}.`) }}
                    style={{ ...btn, background: '#16a34a' }}>
                    Aprobar y enviar correos
                  </button>
                )}
                {!future && (
                  <button type="button" onClick={() => setCurrentDate(weekStatus.next_monday)} style={{ ...btn, background: '#475569' }}>Ir a la semana siguiente</button>
                )}
                {planMsg && <span role="status" style={{ fontWeight: 500 }}>{planMsg}</span>}
              </div>
            )
          })()}
          {showTeam && (
            <div role="dialog" aria-label="Equipo" onClick={() => setShowTeam(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto', padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Equipo de matchmaking</h3>
                  <button type="button" onClick={() => setShowTeam(false)} aria-label="Cerrar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#475569' }}><X size={18} /></button>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: 12, color: '#475569' }}>Solo las personas activas cuentan para las horas, la cobertura y la generación del horario.</p>
                {planSettings && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12, color: '#334155' }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Correos del horario</div>
                    <label style={{ display: 'block', marginBottom: 8 }}>Enviar todo a esta dirección de prueba (vacío = a cada persona):
                      <input type="email" defaultValue={planSettings.email_test_to} aria-label="Correo de prueba"
                        onBlur={(e) => { if (e.target.value.trim() !== (planSettings.email_test_to || '')) patchSettings({ email_test_to: e.target.value.trim() }) }}
                        style={{ display: 'block', width: '100%', marginTop: 4, border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 8px', fontSize: 13 }} />
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" aria-pressed={planSettings.reminders_enabled} onClick={() => patchSettings({ reminders_enabled: !planSettings.reminders_enabled })}
                        style={{ border: 'none', borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: planSettings.reminders_enabled ? '#16a34a' : '#94a3b8', color: '#fff' }}>
                        Recordatorio diario: {planSettings.reminders_enabled ? 'ACTIVADO' : 'apagado'}
                      </button>
                      <button type="button" disabled={planBusy || !planSettings.missing_availability?.length}
                        onClick={() => callPlan('reminders/run', {}, r => `Recordatorios enviados hoy: ${r.sent.length}.`)}
                        style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#334155' }}>
                        Enviar recordatorio ahora
                      </button>
                    </div>
                    <div style={{ marginTop: 6, color: '#64748b' }}>Con el recordatorio activado, cada día desde las 9:00 (Bogotá) se avisa por correo a quien aún no puso su disponibilidad.</div>
                  </div>
                )}
                {teamCfg.filter(m => m.weekly_hours != null || m.is_active).map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #e2e8f0', opacity: m.is_active ? 1 : 0.55 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{readiness?.people?.find(p => p.name === m.name)?.ready ? 'Disponibilidad puesta' : (m.is_active ? 'Falta su disponibilidad' : 'Inactiva')}</div>
                    </div>
                    <label style={{ fontSize: 12, color: '#334155', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="number" min="0" max="60" step="0.5" defaultValue={m.weekly_hours ?? ''} aria-label={`Horas por semana de ${m.name}`}
                        onBlur={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v) && v !== m.weekly_hours) updateMember(m.id, { weekly_hours: v }) }}
                        style={{ width: 56, border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 6px', fontSize: 13 }} /> h/sem
                    </label>
                    <button type="button" onClick={() => updateMember(m.id, { is_active: !m.is_active })} aria-pressed={m.is_active}
                      style={{ border: 'none', borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: m.is_active ? '#16a34a' : '#94a3b8', color: '#fff', minWidth: 84 }}>
                      {m.is_active ? 'Activa' : 'Inactiva'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Sub-barra de Controles y Filtros 7shifts */}
          <div style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            {/* Lado Izquierdo: Dropdowns */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {!simple && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: 6, fontSize: 13, background: '#fff', cursor: 'pointer' }}>
                <Building2 size={14} style={{ color: '#64748b' }} />
                <select 
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#1e293b' }}
                >
                  <option value="all">All departments</option>
                  <option value="Customer Service">Customer Service</option>
                  <option value="Matchmaking">Matchmaking</option>
                </select>
              </div>
              )}

              {/* Navegación Semanal */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 10 }}>
                <button onClick={handlePrevWeek} style={{ border: '1px solid #e2e8f0', background: '#fff', padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}>
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: 13, fontWeight: 700, padding: '0 8px', color: '#1e293b' }}>
                  {weekData?.week_label || ''}
                </span>
                <button onClick={() => setCurrentDate(todayLocal())} style={{ border: '1px solid #e2e8f0', background: '#fff', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#334155', marginRight: 4 }}>
                  Hoy
                </button>
                <button onClick={handleNextWeek} style={{ border: '1px solid #e2e8f0', background: '#fff', padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

          </div>

          {/* MATRIZ SEMANAL */}
          <div style={{ overflowX: 'auto', paddingBottom: simple ? 16 : 60 }}>
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
                            boxSizing: 'border-box',
                            padding: '6px 8px 6px 28px',
                            border: '1px solid #cbd5e1',
                            borderRadius: 6,
                            fontSize: 12,
                            outline: 'none',
                            color: '#1e293b'
                          }}
                        />
                      </div>
                    </div>
                  </th>

                  {(weekData?.week_columns || []).map((col) => (
                    <th key={col.date} style={{ padding: '8px 12px', borderRight: '1px solid #e2e8f0', textAlign: 'left', verticalAlign: 'top', minWidth: 140 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{col.day_short}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{col.month_name} {col.day_number}</div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#475569', fontWeight: 600 }}>
                            <User size={12} />
                            <span>{col.scheduled_count}</span>
                          </div>
                        </div>
                      </div>
                    </th>
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

                    {dept.roles.filter(role => !simple || role.employees.length > 0).map((role) => (
                      <React.Fragment key={role.role_name}>
                        <tr>
                          <td colSpan={8} style={{ background: role.color, color: '#ffffff', padding: '5px 14px', fontWeight: 700, fontSize: 11, letterSpacing: '0.2px' }}>
                            {role.role_name}
                          </td>
                        </tr>

                        {!simple && role.allow_add && role.employees.length === 0 && (
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '8px 14px', borderRight: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                <User size={14} />
                              </div>
                              <span 
                                onClick={() => openEditShiftModal(ALL_STAFF_MEMBERS[0], currentDate, [], role.role_name)}
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
                          <tr key={emp.name} style={{ borderBottom: '1px solid #e2e8f0', background: simple && isMe(emp.name) ? '#fff7ed' : undefined, opacity: emp.is_active === false ? 0.45 : 1 }}>
                            {/* Columna Empleado con Drag Handle ::: (Imagen 2) */}
                            <td style={{ padding: '10px 12px', borderRight: '1px solid #e2e8f0', background: '#ffffff', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {!simple && <GripVertical size={14} style={{ color: '#94a3b8', cursor: 'grab' }} />}
                                <img 
                                  src={emp.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
                                  alt={emp.name}
                                  style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1px solid #cbd5e1' }}
                                />
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', textDecoration: 'underline', cursor: 'pointer' }}>
                                    {emp.name}{simple && isMe(emp.name) ? ' (tú)' : ''}
                                  </div>
                                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                                    {emp.total_hours.toFixed(1)}{emp.weekly_hours != null ? ` / ${emp.weekly_hours}` : ''} hrs{simple ? '' : ` · $${emp.total_cost.toFixed(2)}`}
                                  </div>
                                  {emp.weekly_hours != null && (
                                    <div style={{ fontSize: 10, color: '#64748b' }}>
                                      Entrevistas {emp.interview_hours.toFixed(1)} · Matches {emp.matches_hours.toFixed(1)} (meta {(emp.weekly_hours / 3).toFixed(1)})
                                    </div>
                                  )}
                                  {!simple && emp.total_ot_badge && (
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
                                  onClick={simple ? undefined : () => openEditShiftModal(emp.name, col.date, shifts, role.role_name)}
                                  title={simple ? undefined : (hasShifts ? (shifts.length > 1 ? 'Turno partido: clic para editar las franjas' : 'Clic para editar') : 'Clic para agregar turno')}
                                  style={{
                                    borderRight: '1px solid #e2e8f0',
                                    padding: '4px 6px',
                                    verticalAlign: 'top',
                                    position: 'relative',
                                    background: isSelectedCell ? '#f8fafc' : '#ffffff',
                                    cursor: simple ? 'default' : 'pointer',
                                    height: 54
                                  }}
                                >
                                  {!simple && cell.corner_flag && (
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

                                          {!simple && sh.outside_availability && (
                                            <span title="Este turno queda fuera de la disponibilidad declarada de esta persona" style={{ color: '#d97706', fontSize: 11, marginLeft: 2 }}>⚠</span>
                                          )}
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

          {/* PRESUPUESTO DE HORAS Y COSTO (solo administración) */}
          {!simple && (
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
                Horas y costo
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
          )}
        </div>
      )}

      {/* =========================================================================
          VISTA 2: PERMISOS (TIME OFF) — pedir, aprobar / rechazar
          ========================================================================= */}
      {activeTab === 'timeoff' && (
        <div style={{ padding: '32px 40px', background: '#fafafa', minHeight: 'calc(100vh - 60px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>Permisos</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <select
                value={timeOffStatusFilter}
                onChange={(e) => setTimeOffStatusFilter(e.target.value)}
                aria-label="Filtrar por estado"
                style={{ height: 34, padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, color: '#1e293b', background: '#ffffff' }}
              >
                <option value="All">Todos</option>
                <option value="Pending">Pendientes</option>
                <option value="Approved">Aprobados</option>
                <option value="Denied">Rechazados</option>
              </select>
              <button
                onClick={() => openTimeOffModal(simple && myRosterName ? myRosterName : null)}
                style={{ background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                {simple ? 'Solicitar permiso' : '+ Agregar permiso'}
              </button>
            </div>
          </div>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#475569' }}>
            {canDecideTimeOff
              ? 'Los permisos pendientes los decides tú. Solo los aprobados bloquean el agendador de clientes y aparecen como TIME OFF en el horario.'
              : 'Pide tus días libres aquí. María los aprueba o rechaza; hasta entonces quedan pendientes.'}
          </p>

          <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fafafa' }}>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Persona</th>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Fechas y motivo</th>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Pedido</th>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Aprobados este año</th>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Estado</th>
                  <th style={{ width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {timeOffRequests.filter(r => timeOffStatusFilter === 'All' || r.status === timeOffStatusFilter).length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '28px 20px', textAlign: 'center', fontSize: 13, color: '#64748b' }}>
                      No hay permisos en esta lista.
                    </td>
                  </tr>
                )}
                {timeOffRequests
                  .filter(r => timeOffStatusFilter === 'All' || r.status === timeOffStatusFilter)
                  .map((req) => {
                    const badge = req.status === 'Approved'
                      ? { bg: '#ecfdf5', fg: '#047857', label: 'Aprobado' }
                      : (req.status === 'Denied' ? { bg: '#fef2f2', fg: '#b91c1c', label: 'Rechazado' } : { bg: '#fef9c3', fg: '#a16207', label: 'Pendiente' })
                    return (
                      <tr key={req.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                          {req.employee_name}{simple && isMe(req.employee_name) ? ' (tú)' : ''}
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: 13, color: '#1e293b' }}>
                          <div style={{ fontWeight: 600 }}>{req.time_off_requested}</div>
                          {req.reason && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{req.reason}</div>}
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: 13, color: '#475569' }}>{req.date_submitted}</td>
                        <td style={{ padding: '14px 20px', fontSize: 13, color: '#475569', fontWeight: 600 }}>{req.approved_ytd}</td>
                        <td style={{ padding: '14px 20px' }}>
                          {canDecideTimeOff ? (
                            <select
                              value={req.status === 'Approved' ? 'APPROVED' : (req.status === 'Denied' ? 'DENIED' : 'PENDING')}
                              onChange={(e) => handleDecideTimeOff(req.id, e.target.value)}
                              aria-label={`Estado del permiso de ${req.employee_name}`}
                              style={{ height: 30, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, fontWeight: 700, background: badge.bg, color: badge.fg }}
                            >
                              <option value="PENDING">Pendiente</option>
                              <option value="APPROVED">Aprobado</option>
                              <option value="DENIED">Rechazado</option>
                            </select>
                          ) : (
                            <span style={{ background: badge.bg, color: badge.fg, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>{badge.label}</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          {(canDecideTimeOff || req.status === 'Pending') && (
                            <button
                              onClick={() => handleDeleteTimeOff(req.id)}
                              title={canDecideTimeOff ? 'Eliminar' : 'Cancelar solicitud'}
                              aria-label={`${canDecideTimeOff ? 'Eliminar' : 'Cancelar'} permiso de ${req.employee_name}`}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#dc2626', fontSize: 12, fontWeight: 600, textDecoration: 'underline' }}
                            >
                              {canDecideTimeOff ? 'Eliminar' : 'Cancelar'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
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
              {!simple && (
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
                Registro
              </button>
              )}
            </div>
          </div>

          <div style={{ padding: '32px 40px' }}>
            {availSubTab === 'requests' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>
                    Disponibilidad registrada
                  </h1>

                  <button 
                    onClick={() => openAvailModal(lockToMe ? myRosterName : null)}
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
                    {lockToMe ? 'Editar mi disponibilidad' : '+ Add availability'}
                  </button>
                </div>

                <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fafafa' }}>
                        <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Employee</th>
                        <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Vigencia</th>
                        <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Última actualización</th>
                        <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Estado</th>
                        <th style={{ width: 60 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {availRequests.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: '28px 20px', textAlign: 'center', fontSize: 13, color: '#64748b' }}>
                            Aún nadie tiene disponibilidad registrada. Usa “+ Add availability” o haz clic en una celda de Glance View.
                          </td>
                        </tr>
                      )}
                      {availRequests.map((req) => (
                        <tr key={req.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                <User size={16} />
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{req.employee_name}</div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>{req.type_label}</div>
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
                          <td style={{ padding: '14px 20px', textAlign: 'right', color: '#64748b' }}>
                            <button
                              onClick={() => openAvailModal(req.employee_name)}
                              title="Editar disponibilidad"
                              aria-label={`Editar disponibilidad de ${req.employee_name}`}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
                            >
                              <Edit2 size={15} />
                            </button>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>
                    Glance View
                  </h1>

                  <button 
                    onClick={() => openAvailModal(lockToMe ? myRosterName : null)}
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
                    {lockToMe ? 'Editar mi disponibilidad' : '+ Add availability'}
                  </button>
                </div>
                <p style={{ margin: '0 0 20px', fontSize: 13, color: '#475569' }}>
                  Disponibilidad semanal recurrente. Cada día puede tener varias franjas (ej. 9:00–12:00 y 6:00–8:00 pm). {lockToMe ? 'Solo puedes editar tu propia fila (clic en tus celdas).' : 'Haz clic en una celda para editar a esa persona.'}
                </p>

                <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
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
                              {emp.avatar ? (
                                <img src={emp.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                  <User size={16} />
                                </div>
                              )}
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{emp.name}</div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>{emp.type}</div>
                              </div>
                            </div>
                          </td>

                          {AVAIL_DAYS.map(({ key: dKey }) => {
                            const dInfo = emp.days[dKey] || { state: 'undefined', text: 'Sin definir', ranges: [] }
                            let cellBg = '#f1f5f9'
                            let cellText = '#475569'
                            let mainTitle = 'Sin definir'

                            if (dInfo.state === 'available') {
                              cellBg = '#d4f3e9'; cellText = '#065f46'; mainTitle = 'Todo el día'
                            } else if (dInfo.state === 'hours') {
                              cellBg = '#fff4e6'; cellText = '#9a3412'; mainTitle = dInfo.ranges.length > 1 ? 'Turno partido' : 'Franja'
                            } else if (dInfo.state === 'unavailable') {
                              cellBg = '#fde7e7'; cellText = '#991b1b'; mainTitle = 'No disponible'
                            }

                            return (
                              <td 
                                key={dKey}
                                onClick={(!lockToMe || emp.name === myRosterName) ? () => openAvailModal(emp.name) : undefined}
                                title={(!lockToMe || emp.name === myRosterName) ? `Editar disponibilidad de ${emp.name}` : undefined}
                                style={{
                                  padding: '8px',
                                  borderLeft: '1px solid #e2e8f0',
                                  textAlign: 'center',
                                  verticalAlign: 'middle',
                                  background: cellBg,
                                  cursor: (!lockToMe || emp.name === myRosterName) ? 'pointer' : 'default'
                                }}
                              >
                                <div style={{ fontSize: 11, fontWeight: 700, color: cellText }}>
                                  {mainTitle}
                                </div>
                                {dInfo.state === 'hours' && dInfo.ranges.map((r, i) => (
                                  <div key={i} style={{ fontSize: 10, color: cellText, marginTop: 2, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    {r.label}
                                  </div>
                                ))}
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
                {editModal.has_existing ? 'Editar turno' : 'Agregar turno'}
              </h2>
              <button 
                type="button"
                onClick={() => setEditModal(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
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

                {/* 3. Franjas del día (turno partido = varias franjas) */}
                <div style={{ marginBottom: 6 }}>
                  {editModal.ranges.map((rg, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
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
                        <input
                          type="time"
                          value={rg.start_time}
                          onChange={(e) => updateRange(idx, 'start_time', e.target.value)}
                          aria-label={`Inicio franja ${idx + 1}`}
                          style={{ width: 96, border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: '#1e293b', background: 'transparent' }}
                        />
                        <span style={{ color: '#94a3b8' }}>→</span>
                        <input
                          type="time"
                          value={rg.end_time}
                          onChange={(e) => updateRange(idx, 'end_time', e.target.value)}
                          aria-label={`Fin franja ${idx + 1}`}
                          style={{ width: 96, border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: '#1e293b', background: 'transparent' }}
                        />
                        <span style={{ color: '#64748b', fontSize: 12, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                          ({rangeHours(rg.start_time, rg.end_time)} hrs)
                        </span>
                      </div>
                      {!/customer|assistant/i.test(editModal.role || '') && (
                        <div role="group" aria-label={`Tipo de la franja ${idx + 1}`} style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
                          {[['ENTREVISTAS', 'Entrevistas', '#0f766e'], ['MATCHMAKING', 'Matches', '#be185d']].map(([v, l, c]) => {
                            const on = (rg.shift_type || 'ENTREVISTAS') === v
                            return (
                              <button key={v} type="button" onClick={() => updateRange(idx, 'shift_type', v)} aria-pressed={on}
                                style={{ border: 'none', padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: on ? c : '#ffffff', color: on ? '#ffffff' : '#475569' }}>
                                {l}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      {editModal.ranges.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRange(idx)}
                          title="Quitar esta franja"
                          aria-label={`Quitar franja ${idx + 1}`}
                          style={{ border: '1px solid #fecaca', background: '#fff5f5', color: '#dc2626', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={addRange}
                      disabled={editModal.ranges.length >= 6}
                      style={{ border: 'none', background: 'transparent', color: '#2563eb', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Plus size={13} /> Agregar otra franja (turno partido)
                    </button>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      Total del día: {modalDuration} hrs{editModal.ranges.length > 1 ? ` · ${editModal.ranges.length} franjas` : ''}
                    </span>
                  </div>

                </div>

                {shiftError && (
                  <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12, fontWeight: 600, padding: '8px 10px', borderRadius: 8, marginBottom: 8 }}>
                    {shiftError}
                  </div>
                )}

                {/* Enlace rápido "or use common shift times" */}
                <div style={{ marginBottom: 10 }}>
                  <span 
                    onClick={() => setShowCommonTimes(!showCommonTimes)}
                    style={{ color: '#2563eb', fontSize: 12, textDecoration: 'underline', cursor: 'pointer', fontWeight: 500 }}
                  >
                    o usa un horario común (se aplica a la última franja)
                  </span>

                  {showCommonTimes && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, background: '#f8fafc', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      {COMMON_SHIFT_TIMES.map(preset => (
                        <button 
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            const last = editModal.ranges.length - 1
                            setEditModal({
                              ...editModal,
                              ranges: editModal.ranges.map((r, i) => i === last ? { start_time: to24(preset.start), end_time: to24(preset.end) } : r)
                            })
                            setShiftError('')
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

                {/* Textarea para Notas */}
                <div style={{ marginBottom: 10 }}>
                  <textarea 
                    value={editModal.notes}
                    onChange={(e) => setEditModal({ ...editModal, notes: e.target.value.slice(0, 250) })}
                    placeholder="Notas para la persona sobre este turno (opcional)"
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
                    Aplicar a estos días
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
                    Marca del turno
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
                  {editModal.has_existing && (
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
                      {deletingShift ? 'Borrando...' : 'Borrar día'}
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
                    Cancelar
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
                    {savingShift ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* =========================================================================
          MODAL: SOLICITAR / AGREGAR PERMISO
          ========================================================================= */}
      {timeOffModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, overflowY: 'auto' }}
          onClick={() => setTimeOffModal(null)}
        >
          <div
            style={{ background: '#ffffff', borderRadius: 12, width: 440, maxWidth: '100%', boxShadow: '0 20px 30px -5px rgba(0, 0, 0, 0.35)', overflow: 'hidden', margin: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '14px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{simple ? 'Solicitar permiso' : 'Agregar permiso'}</h2>
              <button type="button" onClick={() => setTimeOffModal(null)} aria-label="Cerrar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', padding: 4, display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveTimeOff}>
              <div style={{ padding: '16px 20px' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Persona</label>
                <select
                  value={timeOffModal.employee_name}
                  disabled={simple && !!myRosterName}
                  onChange={(e) => setTimeOffModal({ ...timeOffModal, employee_name: e.target.value })}
                  style={{ width: '100%', height: 38, padding: '0 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#1e293b', background: '#ffffff', marginBottom: 12 }}
                >
                  {(glanceData?.roster || ALL_STAFF_MEMBERS).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>

                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Desde</label>
                    <input
                      type="date"
                      value={timeOffModal.start_date}
                      onChange={(e) => setTimeOffModal({ ...timeOffModal, start_date: e.target.value, end_date: timeOffModal.end_date < e.target.value ? e.target.value : timeOffModal.end_date })}
                      style={{ width: '100%', boxSizing: 'border-box', height: 38, padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#1e293b', background: '#ffffff' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Hasta</label>
                    <input
                      type="date"
                      value={timeOffModal.end_date}
                      min={timeOffModal.start_date}
                      onChange={(e) => setTimeOffModal({ ...timeOffModal, end_date: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', height: 38, padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#1e293b', background: '#ffffff' }}
                    />
                  </div>
                </div>

                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Motivo (opcional)</label>
                <input
                  type="text"
                  value={timeOffModal.reason}
                  maxLength={250}
                  onChange={(e) => setTimeOffModal({ ...timeOffModal, reason: e.target.value })}
                  placeholder="Ej. cita médica, vacaciones"
                  style={{ width: '100%', boxSizing: 'border-box', height: 38, padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#1e293b', background: '#ffffff' }}
                />
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                  {simple ? 'Quedará pendiente hasta que María lo apruebe.' : 'Como administración, el permiso se guarda ya aprobado.'} Son días completos.
                </div>

                {timeOffError && (
                  <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12, fontWeight: 600, padding: '8px 10px', borderRadius: 8, marginTop: 10 }}>
                    {timeOffError}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #e2e8f0', padding: '12px 20px' }}>
                <button type="button" onClick={() => setTimeOffModal(null)} style={{ padding: '7px 16px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#ffffff', color: '#334155', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={timeOffSaving} style={{ padding: '7px 22px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {timeOffSaving ? 'Guardando...' : (simple ? 'Enviar solicitud' : 'Guardar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: DISPONIBILIDAD SEMANAL (VARIAS FRANJAS POR DÍA)
          ========================================================================= */}
      {availModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, overflowY: 'auto' }}
          onClick={() => setAvailModal(null)}
        >
          <div
            style={{ background: '#ffffff', borderRadius: 12, width: 640, maxWidth: '100%', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 30px -5px rgba(0, 0, 0, 0.35)', overflow: 'hidden', margin: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '14px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>Disponibilidad semanal</h2>
              <button type="button" onClick={() => setAvailModal(null)} aria-label="Cerrar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', padding: 4, display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAvailability} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Persona</label>
                <select
                  value={availModal.employee_name}
                  disabled={lockToMe}
                  onChange={(e) => changeAvailEmployee(e.target.value)}
                  style={{ width: '100%', height: 38, padding: '0 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#1e293b', background: '#ffffff', fontWeight: 500, marginBottom: 14 }}
                >
                  {(glanceData?.roster || ALL_STAFF_MEMBERS).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>

                <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>
                  Para cada día elige: sin definir, todo el día, no disponible u “Horas específicas” (puedes agregar varias franjas, por ejemplo 9:00–12:00 y 6:00–8:00 pm).
                </div>

                {AVAIL_DAYS.map(({ key, label }) => {
                  const d = availModal.days[key]
                  return (
                    <div key={key} style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 10, alignItems: 'start', padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', paddingTop: 8 }}>{label}</div>
                      <div>
                        <select
                          value={d.mode}
                          onChange={(e) => setAvailMode(key, e.target.value)}
                          aria-label={`Disponibilidad del ${label}`}
                          style={{ height: 34, padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#1e293b', background: '#ffffff', marginBottom: d.mode === 'RANGES' ? 8 : 0 }}
                        >
                          <option value="UNSET">Sin definir</option>
                          <option value="ALL_DAY">Todo el día</option>
                          <option value="UNAVAILABLE">No disponible</option>
                          <option value="RANGES">Horas específicas</option>
                        </select>

                        {d.mode === 'RANGES' && (
                          <div>
                            {d.ranges.map((rg, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #cbd5e1', borderRadius: 8, padding: '4px 10px', background: '#ffffff' }}>
                                  <Clock size={14} style={{ color: '#64748b' }} />
                                  <input type="time" value={rg.start_time} onChange={(e) => setAvailRange(key, idx, 'start_time', e.target.value)} aria-label={`Inicio franja ${idx + 1} ${label}`} style={{ width: 96, border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: '#1e293b', background: 'transparent' }} />
                                  <span style={{ color: '#94a3b8' }}>→</span>
                                  <input type="time" value={rg.end_time} onChange={(e) => setAvailRange(key, idx, 'end_time', e.target.value)} aria-label={`Fin franja ${idx + 1} ${label}`} style={{ width: 96, border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: '#1e293b', background: 'transparent' }} />
                                </div>
                                <button type="button" onClick={() => removeAvailRange(key, idx)} title="Quitar franja" aria-label={`Quitar franja ${idx + 1} ${label}`} style={{ border: '1px solid #fecaca', background: '#fff5f5', color: '#dc2626', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <X size={13} />
                                </button>
                              </div>
                            ))}
                            <button type="button" onClick={() => addAvailRange(key)} disabled={d.ranges.length >= 6} style={{ border: 'none', background: 'transparent', color: '#2563eb', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Plus size={13} /> Agregar otra franja
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {availError && (
                  <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12, fontWeight: 600, padding: '8px 10px', borderRadius: 8, marginTop: 10 }}>
                    {availError}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #e2e8f0', padding: '12px 20px', background: '#ffffff', flexShrink: 0 }}>
                <button type="button" onClick={() => setAvailModal(null)} style={{ padding: '7px 16px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#ffffff', color: '#334155', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={availSaving} style={{ padding: '7px 22px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {availSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
