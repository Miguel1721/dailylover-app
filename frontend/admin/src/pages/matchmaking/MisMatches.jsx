import React, { useState, useEffect, useCallback } from 'react'
import { Heart, Search, Filter, Lock, Plus, CheckCircle, AlertTriangle, RefreshCw, User, MapPin, Tag, ShieldCheck, History, ExternalLink, AlertCircle, X, Check, Clock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import CrmPersonLink from '../../components/CrmPersonLink'

const API = 'https://prueba-daily.agentesia.cloud'

const CITIES = [
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga',
  'Pereira', 'Cartagena', 'Manizales', 'Santa Marta', 'Miami', 'Madrid'
]

const PLAN_TIERS_LIST = [
  'Estándar 65k (2 citas)',
  'Estándar 65k (1 cita)',
  'Estándar Plus 98k',
  'Premium 150k',
  'VIP 195k',
  'VIP 295k',
  'VIP Oro',
  'Básico 40k',
  'Eventos Presenciales'
]

// PALETA EXACTA SSOT
const PREF_COLORS = {
  hetero: { bg: '#CFE2F3', color: '#1B365D' },
  gay: { bg: '#FCE5CD', color: '#783F04' },
  lesb: { bg: '#D9D2E9', color: '#351C75' },
  bi: { bg: '#D9D9D9', color: '#434343' },
}

const PLAN_COLORS = {
  'Básico 40k': { bg: '#F3F3F3', color: '#434343' },
  'Estándar 65k (1 cita)': { bg: '#D9EAD3', color: '#274E13' },
  'Estándar 65k (2 citas)': { bg: '#B6D7A8', color: '#274E13' },
  'Estándar Plus 98k': { bg: '#A2C4C9', color: '#134F5C' },
  'Premium 150k': { bg: '#C9DAF8', color: '#1155CC' },
  'VIP 195k': { bg: '#FFE599', color: '#7F6000' },
}

const STATUS_COLORS = {
  'APROBADO': { bg: '#B6D7A8', color: '#274E13' },
  'HECHO': { bg: '#A2C4C9', color: '#134F5C' },
  'CITA COMPLETADA': { bg: '#6AA84F', color: '#FFFFFF' },
  'Listo para match': { bg: '#FFE599', color: '#7F6000' },
  'EN PAUSA': { bg: '#F9CB9C', color: '#783F04' },
  'EN PAUSA INDEFINIDA': { bg: '#B4A7D6', color: '#351C75' },
  'HECHO POR MAPE': { bg: '#A2C4C9', color: '#134F5C' },
  'NOT APPROVED': { bg: '#F4CCCC', color: '#660000' },
  'TROUBLE': { bg: '#FF6B35', color: '#FFFFFF' },
  'TROUBLEMAKER': { bg: '#FF6B35', color: '#FFFFFF' },
  'REFUND': { bg: '#EA9999', color: '#660000' },
  'REFUND DONE': { bg: '#D9EAD3', color: '#274E13' },
  'DESCALIFICADO': { bg: '#CCCCCC', color: '#434343' },
  'NO HAY GENTE': { bg: '#E69138', color: '#FFFFFF' },
  'REVISAR': { bg: '#D5A6BD', color: '#4C1130' },
  'REVISAR POR SI TOCA OTRO MATCH': { bg: '#B4A7D6', color: '#351C75' },
  'MATCH DONE': { bg: '#6AA84F', color: '#FFFFFF' },
  'RESUELTO': { bg: '#D9EAD3', color: '#274E13' },
  'Pendiente': { bg: '#FFF2CC', color: '#7F6000' },
  'PENDIENTE': { bg: '#FFF2CC', color: '#7F6000' },
  'PENDIENTE PLAN': { bg: '#FFF2CC', color: '#7F6000' },
  'Urgente': { bg: '#E06666', color: '#FFFFFF' },
  'EN ESPERA': { bg: '#D9D2E9', color: '#351C75' },
  'REQUEST PROFILE UPDATE': { bg: '#C9DAF8', color: '#1155CC' },
}

const PSYCHOLOGIST_LIST = [
  'JENN', 'ANA', 'SILVI', 'STEFFY', 'SOFI', 'MAPE D', 'ALEJA', 'MANU', 'PIA', 'ISA'
]

const STATUS_OPTIONS = [
  'HECHO', 'HECHO POR MAPE', 'NOT APPROVED', 'TROUBLE', 'TROUBLEMAKER',
  'REFUND', 'REFUND DONE', 'DESCALIFICADO', 'NO HAY GENTE', 'REVISAR',
  'REVISAR POR SI TOCA OTRO MATCH', 'MATCH DONE', 'RESUELTO', 'Pendiente',
  'Urgente', 'Listo para match', 'PENDIENTE PLAN', 'REQUEST PROFILE UPDATE',
  'EN PAUSA', 'EN PAUSA INDEFINIDA', 'CITA COMPLETADA', 'EN ESPERA'
]

// ─── MODAL DE HISTORIAL POR PERSONA ──────────────────────────────────────────
function PersonHistoryModal({ queryTarget, onClose }) {
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!queryTarget) return
    setLoading(true)
    fetch(`${API}/api/v1/matchmaking/history/${encodeURIComponent(queryTarget)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(e => {
        console.error('Error fetching history:', e)
        setLoading(false)
      })
  }, [queryTarget, token])

  if (!queryTarget) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16
    }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 12,
        border: '1px solid var(--border-color)',
        width: '100%',
        maxWidth: 750,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <History size={20} color="#B8324F" />
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Historial de Matchmaking — {data?.person_name || queryTarget}
              </h2>
              {data?.crm_id && (
                <a
                  href={`https://dailylover.smartmatchapp.com/client/${data.crm_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#B8324F', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2 }}
                >
                  Ver Perfil CRM #{data.crm_id} <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando historial...</div>
          ) : !data ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No se encontró información para esta persona.</div>
          ) : (
            <>
              {/* Profile Summary & Counters */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                <div style={{ background: 'var(--bg-base)', border: '1px solid #B6D7A8', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, color: '#274E13', fontWeight: 700, textTransform: 'uppercase' }}>Citas Completadas</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#274E13', marginTop: 2 }}>{data.dates_completed_count}</div>
                </div>
                <div style={{ background: 'var(--bg-base)', border: '1px solid #EA9999', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, color: '#660000', fontWeight: 700, textTransform: 'uppercase' }}>Rechazos / Trouble</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#660000', marginTop: 2 }}>{data.rejections_count}</div>
                </div>
                <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Matches Históricos</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{data.total_matches_count}</div>
                </div>
              </div>

              {/* Profile Tags */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {data.psychologist && (
                  <span style={{ fontSize: 11, background: 'rgba(184,50,79,0.12)', color: '#B8324F', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>
                    Psicóloga: {data.psychologist}
                  </span>
                )}
                {data.city && (
                  <span style={{ fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-color)', padding: '3px 8px', borderRadius: 4 }}>
                    Ciudad: {data.city}
                  </span>
                )}
                {data.plan_tier && (
                  <span style={{ fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-color)', padding: '3px 8px', borderRadius: 4 }}>
                    Plan: {data.plan_tier}
                  </span>
                )}
                {data.pref && (
                  <span style={{ fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-color)', padding: '3px 8px', borderRadius: 4 }}>
                    Pref: {data.pref.toUpperCase()}
                  </span>
                )}
              </div>

              {/* Matches List */}
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Historial de Matches Anteriores
                </h3>
                {data.matches?.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 12, background: 'var(--bg-base)', borderRadius: 6 }}>
                    No registra otros matches en el sistema.
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: 6, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                          <th style={{ padding: '6px 10px' }}>Pareja</th>
                          <th style={{ padding: '6px 10px' }}>Psicóloga</th>
                          <th style={{ padding: '6px 10px' }}>Estado</th>
                          <th style={{ padding: '6px 10px' }}>Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.matches?.map((m) => (
                          <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '6px 10px', fontWeight: 600 }}>
                              {m.person_a} × {m.person_b || '(Vacío)'}
                            </td>
                            <td style={{ padding: '6px 10px' }}>{m.psychologist}</td>
                            <td style={{ padding: '6px 10px' }}>
                              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: STATUS_COLORS[m.status]?.bg || '#f3f3f3', color: STATUS_COLORS[m.status]?.color || '#333' }}>
                                {m.status}
                              </span>
                            </td>
                            <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{m.fecha}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Event Timeline */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Línea de Tiempo de Eventos
                </h3>
                {data.events?.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin eventos registrados.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {data.events?.map((ev) => (
                      <div key={ev.id} style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontWeight: 700, color: '#B8324F' }}>{ev.event_type}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{ev.fecha}</span>
                        </div>
                        <div style={{ color: 'var(--text-primary)' }}>{ev.details}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MisMatches() {
  const { user, token } = useAuth()
  const isAdmin = user?.role && (user.role === 'Admin' || user.role === 'Super Admin' || user.role.toLowerCase().includes('admin') || user.role.toLowerCase().includes('director'))
  
  const getInitialPsyc = () => {
    if (isAdmin) return 'all'
    const name = user?.name || ''
    const email = user?.email || ''
    if (name.toLowerCase().includes('jenn') || email.toLowerCase().includes('jenn')) return 'JENN'
    if (name.toLowerCase().includes('ana') || email.toLowerCase().includes('ana')) return 'ANA'
    if (name.toLowerCase().includes('silvi') || email.toLowerCase().includes('silvi')) return 'SILVI'
    if (name.toLowerCase().includes('steffy') || email.toLowerCase().includes('steffy')) return 'STEFFY'
    if (name.toLowerCase().includes('sofi') || email.toLowerCase().includes('sofi')) return 'SOFI'
    if (name.toLowerCase().includes('mape') || email.toLowerCase().includes('mape')) return 'MAPE D'
    if (name.toLowerCase().includes('aleja') || email.toLowerCase().includes('aleja')) return 'ALEJA'
    if (name.toLowerCase().includes('manu') || email.toLowerCase().includes('manu')) return 'MANU'
    if (name.toLowerCase().includes('pia') || email.toLowerCase().includes('pia')) return 'PIA'
    if (name.toLowerCase().includes('isa') || email.toLowerCase().includes('isa') || name.toLowerCase().includes('isabella')) return 'ISA'
    return 'SILVI'
  }
  
  const [selectedPsyc, setSelectedPsyc] = useState(getInitialPsyc())
  const [psycList, setPsycList] = useState(PSYCHOLOGIST_LIST)
  const [statusFilter, setStatusFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [approvedFilter, setApprovedFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState('')
  const [historyTarget, setHistoryTarget] = useState(null)

  // Modal para ingresar cliente nuevo
  const [showIntakeModal, setShowIntakeModal] = useState(false)
  const [intakeData, setIntakeData] = useState({
    person_a: '',
    psychologist_name: selectedPsyc === 'all' ? 'SILVI' : selectedPsyc,
    city: '',
    pref: '',
    plan_tier: 'Estándar 65k (2 citas)',
    is_priority: false,
    observations: ''
  })
  const [creatingIntake, setCreatingIntake] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/v1/matchmaking/psychologists`)
      .then(r => r.json())
      .then(d => {
        if (d && d.names && d.names.length > 0) {
          setPsycList(d.names)
        }
      })
      .catch(e => console.error('Error fetching psychologists list:', e))
  }, [])

  const fetchMatches = useCallback(() => {
    setLoading(true)
    let url = `${API}/api/v1/matchmaking/my-matches?`
    if (selectedPsyc && selectedPsyc !== 'all') url += `psychologist=${encodeURIComponent(selectedPsyc)}&`
    if (statusFilter && statusFilter !== 'all') url += `status_filter=${encodeURIComponent(statusFilter)}&`
    if (cityFilter && cityFilter !== 'all') url += `city=${encodeURIComponent(cityFilter)}&`
    if (planFilter && planFilter !== 'all') url += `plan_tier=${encodeURIComponent(planFilter)}&`
    if (approvedFilter && approvedFilter !== 'all') url += `approved=${encodeURIComponent(approvedFilter)}&`
    if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setMatches(data.matches || [])
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching matches:', err)
        setLoading(false)
      })
  }, [selectedPsyc, statusFilter, cityFilter, planFilter, approvedFilter, searchTerm, token])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedPsyc, statusFilter, cityFilter, planFilter, approvedFilter, searchTerm])

  const totalPages = Math.ceil(matches.length / pageSize) || 1
  const paginatedMatches = matches.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleUpdateField = async (matchId, field, value, matchRow) => {
    let finalValue = value

    // Si se edita Persona B, resolver CRM y chequear duplicados
    if (field === 'person_b' && value) {
      const isUrlOrId = value.includes('http') || value.includes('smartmatchapp') || value.includes('client/') || value.includes('profile/') || /^\d{3,}$/.test(value.trim())
      if (isUrlOrId) {
        try {
          const resRes = await fetch(`${API}/api/v1/matchmaking/resolve-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ url_or_query: value })
          })
          if (resRes.ok) {
            const dataRes = await resRes.json()
            if (dataRes.name) {
              finalValue = dataRes.name
            }
          }
        } catch (e) {
          // ignore
        }
      }

      // Check Duplicates / Conflicts en vivo
      if (matchRow?.person_a && finalValue) {
        try {
          const dupRes = await fetch(`${API}/api/v1/matchmaking/check-duplicate-match?person_a=${encodeURIComponent(matchRow.person_a)}&person_b=${encodeURIComponent(finalValue)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (dupRes.ok) {
            const dupData = await dupRes.json()
            if (dupData.duplicate) {
              setDuplicateWarning(`⚠️ ALERTA: ${matchRow.person_a} y ${finalValue} ya tuvieron un match previo (${dupData.previous_matches[0]?.date || 'anteriormente'}).`)
              setTimeout(() => setDuplicateWarning(''), 6000)
            } else if (dupData.has_active_conflict) {
              setDuplicateWarning(`⚠️ INFORMACIÓN: ${finalValue} ya tiene citas o matches activos en curso.`)
              setTimeout(() => setDuplicateWarning(''), 6000)
            }
          }
        } catch (e) {
          // ignore
        }
      }
    }

    setSavingId(matchId)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${matchId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ [field]: finalValue })
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.detail || 'Error al actualizar')
      } else {
        setMatches(prev => prev.map(m => m.id === matchId ? { ...m, [field]: finalValue } : m))
        setFeedbackMsg('Actualizado correctamente')
        setTimeout(() => setFeedbackMsg(''), 2500)
        if (field === 'status' && value === 'HECHO') {
          fetchMatches()
        }
      }
    } catch (e) {
      alert('Error de conexión al actualizar')
    } finally {
      setSavingId(null)
    }
  }

  const handleCreateIntake = async (e) => {
    e.preventDefault()
    if (!intakeData.person_a.trim()) {
      alert('Debes ingresar el nombre o enlace de Persona A')
      return
    }
    setCreatingIntake(true)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/intake-client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(intakeData)
      })
      const data = await res.json()
      if (res.ok) {
        setShowIntakeModal(false)
        setIntakeData({
          person_a: '',
          psychologist_name: selectedPsyc === 'all' ? 'SILVI' : selectedPsyc,
          city: '',
          pref: '',
          plan_tier: 'Estándar 65k (2 citas)',
          is_priority: false,
          observations: ''
        })
        setFeedbackMsg(data.message || 'Cliente registrado con éxito')
        setTimeout(() => setFeedbackMsg(''), 4000)
        fetchMatches()
      } else {
        alert(data.detail || 'Error al registrar cliente')
      }
    } catch (err) {
      alert('Error de conexión con el servidor')
    } finally {
      setCreatingIntake(false)
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1700, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Heart size={26} color="#B8324F" fill="#B8324F" />
            Mis Matches — Hoja Operativa de Psicólogas
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Gestión diaria de matches por psicóloga. Incluye cruce de psicóloga de B, historial con 1-clic y detección de duplicados.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {feedbackMsg && (
            <span style={{ fontSize: 12, color: '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle size={14} /> {feedbackMsg}
            </span>
          )}
          <button
            onClick={() => setShowIntakeModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#B8324F',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Plus size={16} /> + Ingresar Cliente (Slots Automáticos)
          </button>
        </div>
      </div>

      {/* Duplicate Warning Banner */}
      {duplicateWarning && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid #F59E0B',
          color: '#B45309',
          padding: '10px 16px',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <AlertCircle size={18} color="#F59E0B" />
          {duplicateWarning}
        </div>
      )}

      {/* Selector de Píldoras por Psicóloga */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
          <button
            onClick={() => setSelectedPsyc('all')}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: selectedPsyc === 'all' ? '#B8324F' : 'var(--bg-card)',
              color: selectedPsyc === 'all' ? '#FFFFFF' : 'var(--text-secondary)',
              boxShadow: selectedPsyc === 'all' ? '0 2px 6px rgba(184,50,79,0.3)' : 'none'
            }}
          >
            Todas las Psicólogas
          </button>
          {psycList.map(p => (
            <button
              key={p}
              onClick={() => setSelectedPsyc(p)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                background: selectedPsyc === p ? '#B8324F' : 'var(--bg-card)',
                color: selectedPsyc === p ? '#FFFFFF' : 'var(--text-secondary)'
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Filtros Bar */}
      <div style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        background: 'var(--bg-card)',
        padding: '12px 16px',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        marginBottom: 16,
        flexWrap: 'wrap'
      }}>
        {/* Filtro Psicóloga */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <User size={13} color="var(--text-secondary)" />
          <select
            value={selectedPsyc}
            onChange={e => setSelectedPsyc(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none'
            }}
          >
            <option value="all">Todas las Psicólogas</option>
            {psycList.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Filtro Estado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={13} color="var(--text-secondary)" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none'
            }}
          >
            <option value="all">Todos los Estados</option>
            {STATUS_OPTIONS.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>

        {/* Filtro Ciudad */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={13} color="var(--text-secondary)" />
          <select
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none'
            }}
          >
            <option value="all">Todas las Ciudades</option>
            {CITIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Filtro Plan */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tag size={13} color="var(--text-secondary)" />
          <select
            value={planFilter}
            onChange={e => setPlanFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none'
            }}
          >
            <option value="all">Todos los Planes</option>
            {PLAN_TIERS_LIST.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Filtro Aprobado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={13} color="var(--text-secondary)" />
          <select
            value={approvedFilter}
            onChange={e => setApprovedFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none'
            }}
          >
            <option value="all">Aprobado: Todos</option>
            <option value="yes">Aprobado: Sí (Bloqueado)</option>
            <option value="no">Aprobado: No (En Proceso)</option>
          </select>
        </div>

        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por Persona A, Persona B o Ciudad..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 32px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <button
          onClick={fetchMatches}
          title="Refrescar"
          style={{
            background: 'none',
            border: '1px solid var(--border-color)',
            borderRadius: 6,
            padding: '6px 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-secondary)'
          }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Main Table */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        <table style={{ width: '100%', minWidth: 1250, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap' }}>
              <th style={{ padding: '12px 10px', fontWeight: 600 }}>CIUDAD</th>
              <th style={{ padding: '12px 8px', fontWeight: 600 }}>PREF</th>
              <th style={{ padding: '12px 10px', fontWeight: 600 }}>PLAN</th>
              <th style={{ padding: '12px 12px', fontWeight: 600 }}>PERSONA A</th>
              <th style={{ padding: '12px 12px', fontWeight: 600, minWidth: 220 }}>PERSONA B (PROPUESTA)</th>
              <th style={{ padding: '12px 10px', fontWeight: 600 }}>PSICÓLOGA DE B</th>
              <th style={{ padding: '12px 10px', fontWeight: 600 }}>FECHA</th>
              <th style={{ padding: '12px 12px', fontWeight: 600 }}>STATUS</th>
              <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'center' }}>APROBADO</th>
              <th style={{ padding: '12px 12px', fontWeight: 600 }}>OBSERVACIONES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  Cargando matches...
                </td>
              </tr>
            ) : paginatedMatches.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  No se encontraron matches para el filtro seleccionado.
                </td>
              </tr>
            ) : (
              paginatedMatches.map((m) => {
                const isLocked = m.is_locked
                const prefCfg = PREF_COLORS[m.pref] || (m.pref ? { bg: '#F3F3F3', color: '#333' } : { bg: '#FFF2CC', color: '#7F6000' })
                const planCfg = PLAN_COLORS[m.plan_tier] || (m.plan_tier ? { bg: '#F3F3F3', color: '#434343' } : { bg: '#FFF2CC', color: '#7F6000' })
                const statusCfg = STATUS_COLORS[m.status] || { bg: '#FFF2CC', color: '#7F6000' }

                return (
                  <tr
                    key={m.id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: m.is_priority ? 'rgba(255, 229, 153, 0.12)' : isLocked ? 'rgba(182, 215, 168, 0.05)' : 'transparent',
                      transition: 'background 0.15s'
                    }}
                  >
                    {/* CIUDAD */}
                    <td style={{ padding: '10px 10px', fontWeight: 500 }}>
                      {m.city ? (
                        <span>{m.city}</span>
                      ) : (
                        <span style={{ background: '#FFF2CC', color: '#7F6000', padding: '2px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                          Falta ciudad
                        </span>
                      )}
                    </td>

                    {/* PREF */}
                    <td style={{ padding: '10px 8px' }}>
                      {m.pref ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 7px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: prefCfg.bg,
                          color: prefCfg.color
                        }}>
                          {m.pref}
                        </span>
                      ) : (
                        <span style={{ background: '#FFF2CC', color: '#7F6000', padding: '2px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                          Falta pref
                        </span>
                      )}
                    </td>

                    {/* PLAN */}
                    <td style={{ padding: '10px 10px' }}>
                      {m.plan_tier ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 7px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          background: planCfg.bg,
                          color: planCfg.color
                        }}>
                          {m.plan_tier}
                        </span>
                      ) : (
                        <span style={{ background: '#FFF2CC', color: '#7F6000', padding: '2px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                          Falta plan
                        </span>
                      )}
                    </td>

                    {/* PERSONA A */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CrmPersonLink name={m.person_a} crmId={m.person_a_crm_id} />
                        {m.is_priority && (
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#FFE599', color: '#7F6000', fontWeight: 800 }}>
                            ⚡ PRIORITARIO
                          </span>
                        )}
                        <button
                          onClick={() => setHistoryTarget(m.person_a_crm_id || m.person_a)}
                          title="Ver historial de Persona A"
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                        >
                          <History size={13} />
                        </button>
                      </div>
                    </td>

                    {/* PERSONA B - EDITABLE */}
                    <td style={{ padding: '8px 12px', minWidth: 220 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="text"
                          defaultValue={m.person_b || ''}
                          placeholder="Nombre o link CRM Persona B..."
                          disabled={isLocked}
                          onBlur={e => {
                            if (e.target.value !== (m.person_b || '')) {
                              handleUpdateField(m.id, 'person_b', e.target.value, m)
                            }
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') e.target.blur()
                          }}
                          style={{
                            width: '100%',
                            padding: '5px 8px',
                            borderRadius: 6,
                            border: '1px solid var(--border-color)',
                            background: isLocked ? 'var(--bg-card-hover)' : 'var(--bg-base)',
                            color: 'var(--text-primary)',
                            fontSize: 12,
                            fontWeight: 600,
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                        {m.person_b && m.person_b.trim() !== '' && (
                          <button
                            onClick={() => setHistoryTarget(m.person_b_crm_id || m.person_b)}
                            title={`Ver historial de ${m.person_b}`}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                          >
                            <History size={13} />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* PSICÓLOGA DE B (CRUCE INFORMATIVO) */}
                    <td style={{ padding: '10px 10px' }}>
                      {m.psychologist_b ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          background: 'rgba(184, 50, 79, 0.12)',
                          color: '#B8324F'
                        }}>
                          {m.psychologist_b}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                      )}
                    </td>

                    {/* FECHA */}
                    <td style={{ padding: '10px 10px', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {m.fecha}
                    </td>

                    {/* STATUS */}
                    <td style={{ padding: '8px 10px' }}>
                      {isLocked ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          background: statusCfg.bg,
                          color: statusCfg.color
                        }}>
                          <Lock size={11} /> {m.status}
                        </span>
                      ) : (
                        <select
                          value={m.status}
                          onChange={e => handleUpdateField(m.id, 'status', e.target.value, m)}
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            borderRadius: 4,
                            border: `1px solid ${statusCfg.bg}`,
                            background: statusCfg.bg,
                            color: statusCfg.color,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          {STATUS_OPTIONS.map(st => (
                            <option key={st} value={st} style={{ background: '#FFFFFF', color: '#000000' }}>
                              {st}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    {/* APROBADO POR MARÍA */}
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      {isLocked ? (
                        <span title="Aprobado por María (Fila Bloqueada)" style={{ display: 'inline-flex', color: '#274E13' }}>
                          <Lock size={15} />
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* OBSERVACIONES */}
                    <td style={{ padding: '8px 12px', minWidth: 180 }}>
                      <input
                        type="text"
                        defaultValue={m.observations || ''}
                        placeholder="Notas..."
                        onBlur={e => {
                          if (e.target.value !== (m.observations || '')) {
                            handleUpdateField(m.id, 'observations', e.target.value, m)
                          }
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') e.target.blur()
                        }}
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          borderRadius: 4,
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-base)',
                          color: 'var(--text-primary)',
                          fontSize: 12,
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Historial */}
      {historyTarget && (
        <PersonHistoryModal queryTarget={historyTarget} onClose={() => setHistoryTarget(null)} />
      )}

      {/* Modal Intake Cliente */}
      {showIntakeModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 12,
            border: '1px solid var(--border-color)',
            width: '100%',
            maxWidth: 520,
            padding: 24,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Ingresar Cliente (Slots Automáticos)
              </h2>
              <button onClick={() => setShowIntakeModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateIntake}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Nombre o Link/ID de SmartMatchApp (Persona A) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: https://dailylover.smartmatchapp.com/?#!/client/791/ o Laura Riascos"
                  value={intakeData.person_a}
                  onChange={e => setIntakeData({ ...intakeData, person_a: e.target.value })}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                    color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Psicóloga Asignada *
                  </label>
                  <select
                    value={intakeData.psychologist_name}
                    onChange={e => setIntakeData({ ...intakeData, psychologist_name: e.target.value })}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 6,
                      border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                      color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                    }}
                  >
                    {psycList.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Plan Oficial
                  </label>
                  <select
                    value={intakeData.plan_tier}
                    onChange={e => setIntakeData({ ...intakeData, plan_tier: e.target.value })}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 6,
                      border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                      color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                    }}
                  >
                    <option value="">(Sin plan — marcar en amarillo)</option>
                    <option value="Estándar 65k (2 citas)">Estándar 65k (3 slots)</option>
                    <option value="VIP 195k">VIP 195k (4 slots)</option>
                    <option value="Básico 40k">Básico 40k (2 slots)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={intakeData.is_priority}
                    onChange={e => setIntakeData({ ...intakeData, is_priority: e.target.checked })}
                    style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#B8324F' }}>
                    ⚡ Marcar como PROFILE PRIORITARIO (Personas Difíciles)
                  </span>
                </label>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Observaciones iniciales
                </label>
                <textarea
                  rows={2}
                  placeholder="Notas para la psicóloga..."
                  value={intakeData.observations}
                  onChange={e => setIntakeData({ ...intakeData, observations: e.target.value })}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                    color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowIntakeModal(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border-color)',
                    background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingIntake}
                  style={{
                    padding: '8px 20px', borderRadius: 6, border: 'none',
                    background: '#B8324F', color: '#fff', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  {creatingIntake ? 'Creando slots...' : 'Crear Slots'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
