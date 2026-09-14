import React, { useState, useEffect, useCallback } from 'react'
import { 
  ShieldCheck, Headphones, Search, RefreshCw, CheckCircle, Clock, MapPin, 
  User, AlertTriangle, PhoneCall, ExternalLink, Filter, X, Calendar as CalendarIcon,
  Check, ArrowRight, Undo2, MessageSquare, Sparkles, Heart
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import CrmPersonLink from '../../components/CrmPersonLink'
import RestaurantFilterModal from '../../components/RestaurantFilterModal'

const API = 'https://prueba-daily.agentesia.cloud'

const PSYCHOLOGIST_LIST = [
  'Todas', 'JENN', 'ANA', 'SILVI', 'STEFFY', 'SOFI', 'MAPE D', 'ALEJA', 'MANU', 'PIA', 'ISA'
]

const CITIES = [
  'Todas', 'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga',
  'Pereira', 'Cartagena', 'Manizales', 'Santa Marta', 'Miami', 'Madrid'
]

export default function AprobadosMaria() {
  const { token, user } = useAuth()
  
  // Pestaña activa: 'revision' (Cola de Aprobación de María) o 'servicio' (CS - Citas por agendar)
  const isCsOnly = user?.role === 'Servicio al Cliente'
  const [activeTab, setActiveTab] = useState(isCsOnly ? 'servicio' : 'revision')

  // Filtros
  const [selectedPsyc, setSelectedPsyc] = useState('Todas')
  const [selectedCity, setSelectedCity] = useState('Todas')
  const [searchTerm, setSearchTerm] = useState('')

  // Estado de Cola de Revisión de María
  const [reviewQueue, setReviewQueue] = useState([])
  const [loadingReview, setLoadingReview] = useState(true)
  const [approvingId, setApprovingId] = useState(null)
  const [rejectModalMatch, setRejectModalMatch] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  // Estado de Servicio al Cliente (Citas por Agendar)
  const [serviceMatches, setServiceMatches] = useState([])
  const [loadingService, setLoadingService] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [scheduleModalMatch, setScheduleModalMatch] = useState(null)

  // Notificaciones y UI
  const [notification, setNotification] = useState('')

  // 1. Cargar Cola de Revisión de María
  const fetchReviewQueue = useCallback(() => {
    setLoadingReview(true)
    let url = `${API}/api/v1/matchmaking/approval-queue?`
    if (selectedPsyc && selectedPsyc !== 'Todas') url += `psychologist=${encodeURIComponent(selectedPsyc)}&`
    if (selectedCity && selectedCity !== 'Todas') url += `city=${encodeURIComponent(selectedCity)}&`
    if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setReviewQueue(data.queue || [])
        setLoadingReview(false)
      })
      .catch(err => {
        console.error('Error cargando cola de aprobación:', err)
        setReviewQueue([])
        setLoadingReview(false)
      })
  }, [selectedPsyc, selectedCity, searchTerm, token])

  // 2. Cargar Cola de Servicio al Cliente
  const fetchServiceQueue = useCallback(() => {
    setLoadingService(true)
    let url = `${API}/api/v1/matchmaking/pending-service?`
    if (selectedPsyc && selectedPsyc !== 'Todas') url += `psychologist=${encodeURIComponent(selectedPsyc)}&`
    if (selectedCity && selectedCity !== 'Todas') url += `city=${encodeURIComponent(selectedCity)}&`
    if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setServiceMatches(data.matches || [])
        setLoadingService(false)
      })
      .catch(err => {
        console.error('Error cargando citas por agendar:', err)
        setServiceMatches([])
        setLoadingService(false)
      })
  }, [selectedPsyc, selectedCity, searchTerm, token])

  useEffect(() => {
    fetchReviewQueue()
    fetchServiceQueue()
  }, [fetchReviewQueue, fetchServiceQueue])

  // Acción: Aprobar Match por María
  const handleApproveMatch = async (matchId) => {
    setApprovingId(matchId)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${matchId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setNotification('✓ Match aprobado con éxito. Ahora es visible en la mesa oficial de MATCHES y en Servicio al Cliente.')
        fetchReviewQueue()
        fetchServiceQueue()
      } else {
        alert(data.detail || 'Error al aprobar el match')
      }
    } catch (e) {
      alert('Error de conexión al aprobar el match')
    } finally {
      setApprovingId(null)
      setTimeout(() => setNotification(''), 6000)
    }
  }

  // Acción: Rechazar o solicitar corrección por María
  const handleRejectMatch = async () => {
    if (!rejectModalMatch) return
    setRejecting(true)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${rejectModalMatch.id}/refund-by-maria`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: rejectReason || 'Devuelto por María para revisión de candidata.' })
      })
      if (res.ok) {
        setNotification('Match devuelto / rechazado con éxito.')
        setRejectModalMatch(null)
        setRejectReason('')
        fetchReviewQueue()
      } else {
        const d = await res.json()
        alert(d.detail || 'Error al procesar la acción')
      }
    } catch (e) {
      alert('Error de conexión')
    } finally {
      setRejecting(false)
      setTimeout(() => setNotification(''), 5000)
    }
  }

  // Acción: Actualizar estado de Servicio al Cliente
  const handleUpdateServiceStatus = async (matchId, status) => {
    setUpdatingId(matchId)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${matchId}/service-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      })
      if (res.ok) {
        fetchServiceQueue()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setUpdatingId(null)
    }
  }

  // Guardar agendamiento con restaurante
  const handleSaveSchedule = async (scheduleData) => {
    if (!scheduleModalMatch) return
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${scheduleModalMatch.id}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(scheduleData)
      })
      if (res.ok) {
        setNotification('Cita agendada exitosamente en restaurante y movida a Citas Aceptadas.')
        setScheduleModalMatch(null)
        fetchServiceQueue()
        setTimeout(() => setNotification(''), 4000)
      } else {
        const err = await res.json()
        alert(err.detail || 'Error al guardar la cita.')
      }
    } catch (e) {
      alert('Error de red al guardar la cita.')
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ minHeight: '85vh' }}>
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-800/50 text-red-500 shadow-inner">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Aprobados por María
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-800/40">
                  Filtro Oficial
                </span>
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">
                Circuito de aprobación clínica: las propuestas de entrevista pasan primero por aquí antes de llegar a MATCHES.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchReviewQueue(); fetchServiceQueue(); }}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#1A1214] hover:bg-[#221618] border border-red-950 text-gray-300 text-xs font-semibold rounded-lg transition-colors"
          >
            <RefreshCw size={14} className={loadingReview || loadingService ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Notificación de éxito */}
      {notification && (
        <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-sm flex items-center gap-2 shadow-lg animate-fade-in">
          <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Selector de Pestañas Principales */}
      <div className="flex items-center gap-3 mb-6 border-b border-gray-800/80 pb-3">
        <button
          onClick={() => setActiveTab('revision')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'revision'
              ? 'bg-red-950/80 text-white border border-red-700/60 shadow-lg shadow-red-950/40'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
          }`}
        >
          <ShieldCheck size={18} className={activeTab === 'revision' ? 'text-red-400' : 'text-gray-500'} />
          <span>Cola de Revisión de María</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            activeTab === 'revision' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'
          }`}>
            {reviewQueue.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('servicio')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'servicio'
              ? 'bg-red-950/80 text-white border border-red-700/60 shadow-lg shadow-red-950/40'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
          }`}
        >
          <Headphones size={18} className={activeTab === 'servicio' ? 'text-red-400' : 'text-gray-500'} />
          <span>Citas por Agendar (Servicio al Cliente)</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            activeTab === 'servicio' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'
          }`}>
            {serviceMatches.length}
          </span>
        </button>
      </div>

      {/* Barra de Filtros Globales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 p-4 rounded-xl bg-[#140D0F] border border-red-950/50">
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1">Buscar por nombre</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-gray-500" />
            <input
              type="text"
              placeholder="Nombre cliente o candidata..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#0D0A0B] border border-gray-800 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-red-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1">Psicóloga Asignada</label>
          <select
            value={selectedPsyc}
            onChange={e => setSelectedPsyc(e.target.value)}
            className="w-full px-3 py-2 bg-[#0D0A0B] border border-gray-800 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-red-600"
          >
            {PSYCHOLOGIST_LIST.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1">Ciudad</label>
          <select
            value={selectedCity}
            onChange={e => setSelectedCity(e.target.value)}
            className="w-full px-3 py-2 bg-[#0D0A0B] border border-gray-800 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-red-600"
          >
            {CITIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* VISTA 1: COLA DE REVISIÓN Y APROBACIÓN DE MARÍA                     */}
      {/* ==================================================================== */}
      {activeTab === 'revision' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-xs text-gray-400 font-medium">
              Mostrando <strong className="text-gray-200">{reviewQueue.length}</strong> propuestas pendientes de aprobación por María
            </div>
            <div className="text-xs text-amber-400/90 flex items-center gap-1.5 bg-amber-950/30 px-3 py-1 rounded-lg border border-amber-800/40">
              <Clock size={13} />
              <span>Sólo al hacer click en "Aprobar Match", el registro se desbloquea en la mesa oficial de MATCHES.</span>
            </div>
          </div>

          {loadingReview ? (
            <div className="p-12 text-center text-gray-400 bg-[#140D0F] border border-red-950/40 rounded-xl">
              <RefreshCw size={24} className="animate-spin mx-auto mb-3 text-red-500" />
              <p className="text-sm">Cargando cola de revisión clínica...</p>
            </div>
          ) : reviewQueue.length === 0 ? (
            <div className="p-12 text-center bg-[#140D0F] border border-red-950/40 rounded-xl text-gray-400">
              <CheckCircle size={36} className="mx-auto mb-3 text-emerald-500/80" />
              <h3 className="text-base font-semibold text-gray-200 mb-1">Cola al día</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto">
                No hay propuestas pendientes de visto bueno. Todos los matches propuestos desde la entrevista clínica han sido procesados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {reviewQueue.map(item => (
                <div
                  key={item.id}
                  className="p-5 rounded-xl bg-[#140D0F] border border-red-950/60 hover:border-red-800/50 transition-all shadow-md flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5"
                >
                  {/* Info del Match */}
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-950/60 text-purple-300 border border-purple-800/50 flex items-center gap-1">
                        <User size={12} /> {item.psychologist_name || 'Psicóloga'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-800 text-gray-300 flex items-center gap-1">
                        <MapPin size={12} /> {item.city || 'Bogotá'}
                      </span>
                      <span
                        className="px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                        style={{ backgroundColor: `${item.plan_color || '#333'}20`, borderColor: `${item.plan_color || '#555'}50`, color: item.plan_color || '#ccc' }}
                      >
                        {item.plan_tier || 'Estándar'}
                      </span>
                      {item.fecha_hecho && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock size={12} /> {item.fecha_hecho}
                        </span>
                      )}
                    </div>

                    {/* Pareja: Persona A x Persona B */}
                    <div className="flex flex-wrap items-center gap-3 text-base">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{item.person_a}</span>
                        {item.person_a_crm_id && (
                          <CrmPersonLink crmId={item.person_a_crm_id} name={item.person_a} />
                        )}
                      </div>

                      <div className="p-1 rounded-full bg-red-950/80 text-red-400 flex items-center justify-center">
                        <Heart size={14} className="fill-red-500 text-red-500" />
                      </div>

                      <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                        <span>{item.person_b || 'Por definir'}</span>
                        {item.person_b_crm_id && (
                          <CrmPersonLink crmId={item.person_b_crm_id} name={item.person_b} />
                        )}
                      </div>
                    </div>

                    {/* Observaciones o Justificación de la Psicóloga */}
                    {item.observations && (
                      <div className="text-xs text-gray-300 bg-[#0D0A0B] p-3 rounded-lg border border-gray-800/80 flex items-start gap-2">
                        <Sparkles size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-gray-400 block mb-0.5">Justificación de Match:</strong>
                          <p className="italic leading-relaxed text-gray-300">{item.observations}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Acciones de María */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end gap-2.5 w-full lg:w-auto border-t lg:border-t-0 pt-3 lg:pt-0 border-gray-800">
                    <button
                      onClick={() => handleApproveMatch(item.id)}
                      disabled={approvingId === item.id}
                      className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50"
                    >
                      {approvingId === item.id ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Aprobando...
                        </>
                      ) : (
                        <>
                          <Check size={15} />
                          Aprobar Match (Pasar a MATCHES)
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => { setRejectModalMatch(item); setRejectReason(''); }}
                      className="px-3 py-2 bg-gray-800/60 hover:bg-red-950/50 border border-gray-700 hover:border-red-800/60 text-gray-400 hover:text-red-300 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      <Undo2 size={13} />
                      Devolver / Observación
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* VISTA 2: CITAS POR AGENDAR (SERVICIO AL CLIENTE)                     */}
      {/* ==================================================================== */}
      {activeTab === 'servicio' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-xs text-gray-400 font-medium">
              Mostrando <strong className="text-gray-200">{serviceMatches.length}</strong> matches aprobados listos para agendamiento
            </div>
            <div className="text-xs text-blue-400/90 flex items-center gap-1.5 bg-blue-950/30 px-3 py-1 rounded-lg border border-blue-800/40">
              <PhoneCall size={13} />
              <span>Gestión de llamadas a Persona A y Persona B para fecha y restaurante de la cita.</span>
            </div>
          </div>

          {loadingService ? (
            <div className="p-12 text-center text-gray-400 bg-[#140D0F] border border-red-950/40 rounded-xl">
              <RefreshCw size={24} className="animate-spin mx-auto mb-3 text-red-500" />
              <p className="text-sm">Cargando citas por agendar...</p>
            </div>
          ) : serviceMatches.length === 0 ? (
            <div className="p-12 text-center bg-[#140D0F] border border-red-950/40 rounded-xl text-gray-400">
              <CheckCircle size={36} className="mx-auto mb-3 text-emerald-500/80" />
              <h3 className="text-base font-semibold text-gray-200 mb-1">No hay citas pendientes por agendar</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto">
                Todos los matches aprobados ya han sido agendados o no hay registros pendientes en Servicio al Cliente.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {serviceMatches.map(match => (
                <div
                  key={match.id}
                  className="p-5 rounded-xl bg-[#140D0F] border border-red-950/60 hover:border-red-800/50 transition-all shadow-md flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5"
                >
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-950/60 text-red-300 border border-red-800/50">
                        {match.psychologist_name || 'Psicóloga'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-800 text-gray-300 flex items-center gap-1">
                        <MapPin size={12} /> {match.city || 'Bogotá'}
                      </span>
                      <span
                        className="px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                        style={{ backgroundColor: `${match.plan_color || '#333'}20`, borderColor: `${match.plan_color || '#555'}50`, color: match.plan_color || '#ccc' }}
                      >
                        {match.plan_tier || 'Estándar'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/40">
                        ✓ Aprobado por María
                      </span>
                    </div>

                    {/* Nombres de los clientes */}
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="p-3 rounded-lg bg-[#0D0A0B] border border-gray-800/70 flex-1 min-w-[200px]">
                        <div className="text-xs text-gray-400 font-semibold mb-1">PERSONA A</div>
                        <div className="font-bold text-white text-base flex items-center gap-1.5">
                          {match.person_a}
                          {match.person_a_crm_id && (
                            <CrmPersonLink crmId={match.person_a_crm_id} name={match.person_a} />
                          )}
                        </div>
                        {match.person_a_phone && (
                          <div className="text-xs text-gray-400 font-mono mt-1">📞 {match.person_a_phone}</div>
                        )}
                      </div>

                      <div className="p-3 rounded-lg bg-[#0D0A0B] border border-gray-800/70 flex-1 min-w-[200px]">
                        <div className="text-xs text-gray-400 font-semibold mb-1">PERSONA B</div>
                        <div className="font-bold text-emerald-300 text-base flex items-center gap-1.5">
                          {match.person_b || 'Por definir'}
                          {match.person_b_crm_id && (
                            <CrmPersonLink crmId={match.person_b_crm_id} name={match.person_b} />
                          )}
                        </div>
                        {match.person_b_phone && (
                          <div className="text-xs text-gray-400 font-mono mt-1">📞 {match.person_b_phone}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones de CS */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end gap-2.5 w-full lg:w-auto border-t lg:border-t-0 pt-3 lg:pt-0 border-gray-800">
                    <button
                      onClick={() => setScheduleModalMatch(match)}
                      className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-red-950/40 transition-all"
                    >
                      <CalendarIcon size={14} />
                      Agendar Cita en Restaurante
                    </button>

                    <div className="flex items-center gap-1.5">
                      <select
                        value={match.service_status || 'Por Llamar'}
                        onChange={e => handleUpdateServiceStatus(match.id, e.target.value)}
                        disabled={updatingId === match.id}
                        className="px-3 py-1.5 bg-[#0D0A0B] border border-gray-800 rounded-lg text-xs font-semibold text-gray-300 focus:outline-none focus:border-red-600"
                      >
                        <option value="Por Llamar">📞 Por Llamar</option>
                        <option value="Llamado 1">📞 Llamado 1</option>
                        <option value="En Conversación">💬 En Conversación</option>
                        <option value="Rechazó Match">❌ Rechazó Match</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal para Devolver / Rechazar Propuesta por María */}
      {rejectModalMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-[#160E10] border border-red-900/60 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2 text-red-400 font-bold text-base">
                <Undo2 size={18} />
                <span>Devolver Propuesta a Psicóloga</span>
              </div>
              <button
                onClick={() => setRejectModalMatch(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Indica la razón por la cual no apruebas el match entre <strong className="text-white">{rejectModalMatch.person_a}</strong> y <strong className="text-white">{rejectModalMatch.person_b}</strong> para que la psicóloga {rejectModalMatch.psychologist_name} proponga una alternativa adecuada.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Observación o Motivo</label>
              <textarea
                rows={3}
                placeholder="Ej. Incompatibilidad de rango de edad o estilo de vida, buscar perfil más afin..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full p-3 bg-[#0D0A0B] border border-gray-800 rounded-xl text-xs text-gray-200 focus:outline-none focus:border-red-600 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModalMatch(null)}
                className="px-3.5 py-2 text-xs font-medium text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRejectMatch}
                disabled={rejecting}
                className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-lg shadow-red-950/50 transition-all disabled:opacity-50"
              >
                {rejecting ? 'Devolviendo...' : 'Confirmar Devolución'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Agendamiento en Restaurante */}
      {scheduleModalMatch && (
        <RestaurantFilterModal
          match={scheduleModalMatch}
          onClose={() => setScheduleModalMatch(null)}
          onSave={handleSaveSchedule}
        />
      )}
    </div>
  )
}
