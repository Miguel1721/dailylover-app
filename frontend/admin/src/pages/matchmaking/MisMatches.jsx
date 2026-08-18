import React, { useState, useEffect, useCallback } from 'react'
import { Heart, Search, Filter, Lock, Plus, CheckCircle, AlertTriangle, RefreshCw, User, MapPin } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

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
  'TROUBLE': { bg: '#FF6B35', color: '#FFFFFF' },
  'TROUBLEMAKER': { bg: '#FF6B35', color: '#FFFFFF' },
  'DESCALIFICADO': { bg: '#CCCCCC', color: '#434343' },
  'EN ESPERA': { bg: '#D9D2E9', color: '#351C75' },
  'PENDIENTE': { bg: '#FFF2CC', color: '#7F6000' },
  'REFUND': { bg: '#EA9999', color: '#660000' },
  'NO MATCH/CAMBIAR': { bg: '#F4CCCC', color: '#660000' },
  'REQUEST PROFILE UPDATE': { bg: '#C9DAF8', color: '#1155CC' },
  'REVISAR': { bg: '#D5A6BD', color: '#4C1130' },
  'HACER OTRO MATCH': { bg: '#B4A7D6', color: '#351C75' },
  'NO HAY GENTE': { bg: '#E69138', color: '#FFFFFF' },
}

const PSYCHOLOGIST_LIST = [
  'JENN', 'ANA', 'SILVI', 'STEFFY', 'SOFI', 'MAPE D', 'ALEJA', 'MANU 1', 'MANU 2', 'PIA'
]

const STATUS_OPTIONS = [
  'HECHO', 'DESCALIFICADO', 'TROUBLE', 'TROUBLEMAKER', 'Listo para match',
  'EN PAUSA', 'EN PAUSA INDEFINIDA', 'CITA COMPLETADA', 'EN ESPERA', 'PENDIENTE',
  'REFUND', 'NO MATCH/CAMBIAR', 'REQUEST PROFILE UPDATE', 'REVISAR',
  'HACER OTRO MATCH', 'NO HAY GENTE'
]

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
    if (name.toLowerCase().includes('manu 1') || email.toLowerCase().includes('manu 1')) return 'MANU 1'
    if (name.toLowerCase().includes('manu 2') || email.toLowerCase().includes('manu 2')) return 'MANU 2'
    if (name.toLowerCase().includes('manu') || email.toLowerCase().includes('manu')) return 'MANU 1'
    if (name.toLowerCase().includes('pia') || email.toLowerCase().includes('pia')) return 'PIA'
    return 'SILVI'
  }
  
  const [selectedPsyc, setSelectedPsyc] = useState(getInitialPsyc())
  const [psycList, setPsycList] = useState(PSYCHOLOGIST_LIST)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [feedbackMsg, setFeedbackMsg] = useState('')

  // Modal para ingresar cliente nuevo (3 slots)
  const [showIntakeModal, setShowIntakeModal] = useState(false)
  const [intakeData, setIntakeData] = useState({
    person_a: '',
    psychologist_name: selectedPsyc === 'all' ? 'SILVI' : selectedPsyc,
    city: '',
    pref: 'hetero',
    plan_tier: 'Estándar 65k (2 citas)',
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
  }, [selectedPsyc, statusFilter, searchTerm, token])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  const handleUpdateField = async (matchId, field, value) => {
    let finalValue = value
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
          // ignore fallback to raw value
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
        setFeedbackMsg(finalValue !== value ? `Link CRM resuelto a "${finalValue}" y guardado` : 'Actualizado correctamente')
        setTimeout(() => setFeedbackMsg(''), 3000)
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
      alert('Debes ingresar el nombre de Persona A')
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
          pref: 'hetero',
          plan_tier: 'Estándar 65k (2 citas)',
          observations: ''
        })
        fetchMatches()
      } else {
        alert(data.detail || 'Error al crear slots')
      }
    } catch (err) {
      alert('Error de conexión')
    } finally {
      setCreatingIntake(false)
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Heart size={26} color="#B8324F" fill="#B8324F" />
            Mis Matches — Flujo Operativo
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Hoja de trabajo diaria por psicóloga. Cada cliente cuenta con 3 slots asignados.
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
            <Plus size={16} /> + Ingresar Cliente (3 Slots)
          </button>
        </div>
      </div>

      {/* Selector de Píldoras por Psicóloga para María / Admin */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Psicóloga:</span>
          <select
            value={selectedPsyc}
            onChange={e => setSelectedPsyc(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none'
            }}
          >
            <option value="all">Todas las Psicólogas</option>
            {psycList.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Estado:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none'
            }}
          >
            <option value="all">Todos los Estados</option>
            {STATUS_OPTIONS.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>

        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por Persona A, Persona B, Ciudad u Observaciones..."
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
              outline: 'none'
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
        <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              <th style={{ padding: '10px 12px', width: 90 }}>Ciudad</th>
              <th style={{ padding: '10px 10px', width: 75 }}>Pref</th>
              <th style={{ padding: '10px 10px', width: 140 }}>Plan</th>
              <th style={{ padding: '10px 12px', minWidth: 150 }}>Persona A (Cliente)</th>
              <th style={{ padding: '10px 12px', minWidth: 170 }}>Persona B (Candidato)</th>
              <th style={{ padding: '10px 10px', width: 110 }}>Fecha</th>
              <th style={{ padding: '10px 12px', width: 180 }}>Status</th>
              <th style={{ padding: '10px 10px', width: 70, textAlign: 'center' }}>Aprobado</th>
              <th style={{ padding: '10px 12px', minWidth: 200 }}>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && matches.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Cargando matches...
                </td>
              </tr>
            ) : matches.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No se encontraron matches para el filtro seleccionado.
                </td>
              </tr>
            ) : (
              matches.map((m) => {
                const isLocked = m.is_locked
                const prefCfg = PREF_COLORS[m.pref] || PREF_COLORS['hetero']
                const planCfg = PLAN_COLORS[m.plan_tier] || PLAN_COLORS['Estándar 65k (2 citas)'] || { bg: '#F3F3F3', color: '#434343' }
                const statusCfg = STATUS_COLORS[m.status] || { bg: '#FFF2CC', color: '#7F6000' }

                return (
                  <tr
                    key={m.id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: isLocked ? 'rgba(182, 215, 168, 0.05)' : 'transparent',
                      transition: 'background 0.15s'
                    }}
                  >
                    {/* CIUDAD */}
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                      {m.city || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>

                    {/* PREF */}
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: prefCfg.bg,
                        color: prefCfg.color
                      }}>
                        {m.pref}
                      </span>
                    </td>

                    {/* PLAN */}
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: planCfg.bg,
                        color: planCfg.color
                      }}>
                        {m.plan_tier}
                      </span>
                    </td>

                    {/* PERSONA A */}
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{m.person_a}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 3 }}>
                          Slot {m.slot_number}
                        </span>
                      </div>
                    </td>

                    {/* PERSONA B - ALWAYS EDITABLE */}
                    <td style={{ padding: '8px 12px', minWidth: 170 }}>
                      <input
                        type="text"
                        defaultValue={m.person_b || ''}
                        placeholder="Nombre Persona B..."
                        onBlur={e => {
                          if (e.target.value !== (m.person_b || '')) {
                            handleUpdateField(m.id, 'person_b', e.target.value)
                          }
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') e.target.blur()
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-base)',
                          color: 'var(--text-primary)',
                          fontSize: 13,
                          fontWeight: 600,
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </td>

                    {/* FECHA */}
                    <td style={{ padding: '10px 10px', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {m.fecha}
                    </td>

                    {/* STATUS */}
                    <td style={{ padding: '8px 12px' }}>
                      {isLocked ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 700,
                          background: statusCfg.bg,
                          color: statusCfg.color
                        }}>
                          <Lock size={12} /> {m.status}
                        </span>
                      ) : (
                        <select
                          value={m.status}
                          onChange={e => handleUpdateField(m.id, 'status', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '5px 8px',
                            borderRadius: 4,
                            border: `1px solid ${statusCfg.bg}`,
                            background: statusCfg.bg,
                            color: statusCfg.color,
                            fontSize: 12,
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
                    <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                      {isLocked ? (
                        <span title="Aprobado por María (Fila Bloqueada)" style={{ display: 'inline-flex', color: '#274E13' }}>
                          <Lock size={16} />
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* OBSERVACIONES - ALWAYS EDITABLE */}
                    <td style={{ padding: '8px 12px', minWidth: 200 }}>
                      <input
                        type="text"
                        defaultValue={m.observations || ''}
                        placeholder="Notas u observaciones..."
                        onBlur={e => {
                          if (e.target.value !== (m.observations || '')) {
                            handleUpdateField(m.id, 'observations', e.target.value)
                          }
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') e.target.blur()
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-base)',
                          color: 'var(--text-secondary)',
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

      {/* Modal Ingresar Cliente Nuevo (3 Slots) */}
      {showIntakeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20
        }}>
          <div style={{
            background: 'var(--bg-card)',
            padding: 24,
            borderRadius: 12,
            maxWidth: 500,
            width: '100%',
            border: '1px solid var(--border-color)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
              Ingresar Cliente Nuevo (Creación de 3 Slots)
            </h2>
            <form onSubmit={handleCreateIntake}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                  Nombre de Persona A (Cliente) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Valeria Linero"
                  value={intakeData.person_a}
                  onChange={e => setIntakeData({ ...intakeData, person_a: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                    Psicóloga Asignada *
                  </label>
                  <select
                    value={intakeData.psychologist_name}
                    onChange={e => setIntakeData({ ...intakeData, psychologist_name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-base)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      outline: 'none'
                    }}
                  >
                    {psycList.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                    Preferencia *
                  </label>
                  <select
                    value={intakeData.pref}
                    onChange={e => setIntakeData({ ...intakeData, pref: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-base)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      outline: 'none'
                    }}
                  >
                    <option value="hetero">hetero</option>
                    <option value="gay">gay</option>
                    <option value="lesb">lesb</option>
                    <option value="bi">bi</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                    Ciudad (Opcional, autocompleta)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Bogotá"
                    value={intakeData.city}
                    onChange={e => setIntakeData({ ...intakeData, city: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-base)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                    Plan Contratado
                  </label>
                  <select
                    value={intakeData.plan_tier}
                    onChange={e => setIntakeData({ ...intakeData, plan_tier: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-base)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      outline: 'none'
                    }}
                  >
                    <option value="Básico 40k">Básico 40k</option>
                    <option value="Estándar 65k (1 cita)">Estándar 65k (1 cita)</option>
                    <option value="Estándar 65k (2 citas)">Estándar 65k (2 citas)</option>
                    <option value="Estándar Plus 98k">Estándar Plus 98k</option>
                    <option value="Premium 150k">Premium 150k</option>
                    <option value="VIP 195k">VIP 195k</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                  Observaciones Iniciales
                </label>
                <textarea
                  placeholder="Detalles sobre perfil o preferencias..."
                  value={intakeData.observations}
                  onChange={e => setIntakeData({ ...intakeData, observations: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                    minHeight: 60
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowIntakeModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingIntake}
                  style={{
                    padding: '8px 16px',
                    background: '#B8324F',
                    border: 'none',
                    borderRadius: 6,
                    color: '#FFFFFF',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  {creatingIntake ? 'Creando 3 Slots...' : 'Generar 3 Filas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
