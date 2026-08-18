import React, { useState, useEffect, useCallback } from 'react'
import { Headphones, Phone, Search, RefreshCw, AlertTriangle, CheckCircle, Clock, ArrowRight, UserCheck, UserX, PauseCircle, User, MapPin, Filter } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import CrmPersonLink from '../../components/CrmPersonLink'

const API = 'https://prueba-daily.agentesia.cloud'

const CITIES = [
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga',
  'Pereira', 'Cartagena', 'Manizales', 'Santa Marta', 'Miami', 'Madrid'
]

const PSYCHOLOGIST_LIST = [
  'JENN', 'ANA', 'SILVI', 'STEFFY', 'SOFI', 'MAPE D', 'ALEJA', 'MANU 1', 'MANU 2', 'PIA'
]

const CONFIRMATION_OPTIONS = [
  'Pendiente',
  'Listo para escribir',
  'No contesta',
  'De viaje',
  'Problema personal',
  'Reprogramar',
  'Viaje largo / indefinido',
  'Aceptó',
  'Rechazó'
]

const CONFIRMATION_COLORS = {
  'Aceptó': { bg: '#D9EAD3', color: '#274E13' },
  'Rechazó': { bg: '#EA9999', color: '#660000' },
  'No contesta': { bg: '#FFF2CC', color: '#7F6000' },
  'De viaje': { bg: '#FCE5CD', color: '#783F04' },
  'Problema personal': { bg: '#F9CB9C', color: '#783F04' },
  'Reprogramar': { bg: '#F9CB9C', color: '#783F04' },
  'Viaje largo / indefinido': { bg: '#B4A7D6', color: '#351C75' },
  'Listo para escribir': { bg: '#EFEFEF', color: '#434343' },
  'Pendiente': { bg: '#F3F3F3', color: '#666666' }
}

const TABS = [
  { id: 'pendientes', label: 'Pendientes de Confirmación', icon: Clock, desc: 'Matches recién aprobados por María' },
  { id: 'en_pausa', label: 'En Pausa', icon: PauseCircle, desc: 'Pausas temporales (No contesta, viaje corto, reprogramar)' },
  { id: 'en_pausa_indefinida', label: 'En Pausa Indefinida', icon: PauseCircle, desc: 'Viaje largo o sin fecha cierta' },
  { id: 'trouble', label: 'Trouble Matches', icon: AlertTriangle, desc: 'Matches rechazados (Historial de solo lectura)' }
]

export default function ServicioCliente() {
  const { token } = useAuth()
  const [activeTab, setActiveTab] = useState('pendientes')
  const [selectedPsyc, setSelectedPsyc] = useState('all')
  const [selectedCity, setSelectedCity] = useState('all')
  const [selectedConfA, setSelectedConfA] = useState('all')
  const [selectedConfB, setSelectedConfB] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [psycList, setPsycList] = useState(PSYCHOLOGIST_LIST)
  const [confirmations, setConfirmations] = useState([])
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [notification, setNotification] = useState('')

  useEffect(() => {
    fetch(`${API}/api/v1/matchmaking/psychologists`)
      .then(r => r.json())
      .then(d => {
        if (d && d.names && d.names.length > 0) {
          setPsycList(d.names)
        }
      })
      .catch(e => console.error('Error fetching psychologists:', e))
  }, [])

  const fetchConfirmations = useCallback(() => {
    setLoading(true)
    let url = `${API}/api/v1/matchmaking/confirmations?stage=${activeTab}&`
    if (selectedPsyc && selectedPsyc !== 'all') url += `psychologist=${encodeURIComponent(selectedPsyc)}&`
    if (selectedCity && selectedCity !== 'all') url += `city=${encodeURIComponent(selectedCity)}&`
    if (selectedConfA && selectedConfA !== 'all') url += `confirmation_a=${encodeURIComponent(selectedConfA)}&`
    if (selectedConfB && selectedConfB !== 'all') url += `confirmation_b=${encodeURIComponent(selectedConfB)}&`
    if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setConfirmations(data.confirmations || [])
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching confirmations:', err)
        setLoading(false)
      })
  }, [activeTab, selectedPsyc, selectedCity, selectedConfA, selectedConfB, searchTerm, token])

  useEffect(() => {
    fetchConfirmations()
  }, [fetchConfirmations])

  const handleUpdateConfirmation = async (confirmationId, field, value) => {
    setUpdatingId(confirmationId)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/confirmations/${confirmationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ [field]: value })
      })

      const data = await res.json()
      if (res.ok) {
        if (data.stage !== activeTab) {
          setNotification(`Pareja transferida automáticamente a: ${data.stage.toUpperCase()}`)
          setTimeout(() => setNotification(''), 4000)
          setConfirmations(prev => prev.filter(c => c.confirmation_id !== confirmationId))
        } else {
          setConfirmations(prev => prev.map(c => c.confirmation_id === confirmationId ? {
            ...c,
            [field]: value
          } : c))
        }
      } else {
        alert(data.detail || 'Error al actualizar confirmación')
      }
    } catch (e) {
      alert('Error de conexión al actualizar')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Headphones size={28} color="#B8324F" />
            Servicio al Cliente — Confirmación de Matches
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Gestión telefónica de parejas aprobadas. Las llamadas a Persona A y Persona B son 100% independientes.
          </p>
        </div>

        <button
          onClick={fetchConfirmations}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 13,
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refrescar
        </button>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div style={{
          background: 'rgba(184, 50, 79, 0.12)',
          border: '1px solid #B8324F',
          color: '#B8324F',
          padding: '10px 16px',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <ArrowRight size={16} />
          {notification}
        </div>
      )}

      {/* 4 Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-color)', marginBottom: 20 }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          const TabIcon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 18px',
                border: 'none',
                borderBottom: isActive ? '3px solid #B8324F' : '3px solid transparent',
                background: 'transparent',
                color: isActive ? '#B8324F' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <TabIcon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

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

        {/* Filtro Ciudad */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={13} color="var(--text-secondary)" />
          <select
            value={selectedCity}
            onChange={e => setSelectedCity(e.target.value)}
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

        {/* Filtro Confirmación Persona A */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <UserCheck size={13} color="var(--text-secondary)" />
          <select
            value={selectedConfA}
            onChange={e => setSelectedConfA(e.target.value)}
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
            <option value="all">Confirmación A: Todas</option>
            {CONFIRMATION_OPTIONS.map(opt => (
              <option key={opt} value={opt}>A: {opt}</option>
            ))}
          </select>
        </div>

        {/* Filtro Confirmación Persona B */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <UserCheck size={13} color="var(--text-secondary)" />
          <select
            value={selectedConfB}
            onChange={e => setSelectedConfB(e.target.value)}
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
            <option value="all">Confirmación B: Todas</option>
            {CONFIRMATION_OPTIONS.map(opt => (
              <option key={opt} value={opt}>B: {opt}</option>
            ))}
          </select>
        </div>

        {/* Buscador */}
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por Persona A, Persona B, Psicóloga o Ciudad..."
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
          onClick={fetchConfirmations}
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

      {/* Confirmations Table */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        overflowX: 'auto'
      }}>
        <table style={{ width: '100%', minWidth: 1050, borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap' }}>
              <th style={{ padding: '12px 14px', width: 90, fontWeight: 600 }}>MATCH ID</th>
              <th style={{ padding: '12px 14px', minWidth: 240, fontWeight: 600 }}>PERSONA A & CONFIRMACIÓN</th>
              <th style={{ padding: '12px 14px', minWidth: 240, fontWeight: 600 }}>PERSONA B & CONFIRMACIÓN</th>
              <th style={{ padding: '12px 12px', width: 110, fontWeight: 600 }}>PSICÓLOGA</th>
              <th style={{ padding: '12px 12px', width: 110, fontWeight: 600 }}>CIUDAD</th>
              <th style={{ padding: '12px 12px', width: 130, fontWeight: 600 }}>FECHA APROBADO</th>
              {activeTab === 'en_pausa' || activeTab === 'en_pausa_indefinida' ? (
                <th style={{ padding: '12px 14px', minWidth: 160, fontWeight: 600 }}>MOTIVO DE PAUSA</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {loading && confirmations.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Cargando registros...
                </td>
              </tr>
            ) : confirmations.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No hay registros en la pestaña <strong>{TABS.find(t => t.id === activeTab)?.label}</strong> para los filtros seleccionados.
                </td>
              </tr>
            ) : (
              confirmations.map((c) => {
                const confACfg = CONFIRMATION_COLORS[c.person_a_confirmation] || CONFIRMATION_COLORS['Pendiente']
                const confBCfg = CONFIRMATION_COLORS[c.person_b_confirmation] || CONFIRMATION_COLORS['Pendiente']
                const isReadOnly = activeTab === 'trouble'

                return (
                  <tr key={c.confirmation_id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }}>
                    {/* Match ID */}
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      #{c.match_id}
                    </td>

                    {/* Persona A + Confirmation */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ marginBottom: 4 }}>
                        <CrmPersonLink name={c.person_a} crmId={c.person_a_crm_id} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Phone size={11} /> {c.phone_a}
                      </div>
                      {isReadOnly ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          background: confACfg.bg,
                          color: confACfg.color
                        }}>
                          {c.person_a_confirmation}
                        </span>
                      ) : (
                        <select
                          value={c.person_a_confirmation}
                          onChange={e => handleUpdateConfirmation(c.confirmation_id, 'person_a_confirmation', e.target.value)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 4,
                            border: `1px solid ${confACfg.bg}`,
                            background: confACfg.bg,
                            color: confACfg.color,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          {CONFIRMATION_OPTIONS.map(opt => (
                            <option key={opt} value={opt} style={{ background: '#FFFFFF', color: '#000000' }}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    {/* Persona B + Confirmation */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ marginBottom: 4 }}>
                        <CrmPersonLink name={c.person_b} crmId={c.person_b_crm_id} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Phone size={11} /> {c.phone_b}
                      </div>
                      {isReadOnly ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          background: confBCfg.bg,
                          color: confBCfg.color
                        }}>
                          {c.person_b_confirmation}
                        </span>
                      ) : (
                        <select
                          value={c.person_b_confirmation}
                          onChange={e => handleUpdateConfirmation(c.confirmation_id, 'person_b_confirmation', e.target.value)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 4,
                            border: `1px solid ${confBCfg.bg}`,
                            background: confBCfg.bg,
                            color: confBCfg.color,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          {CONFIRMATION_OPTIONS.map(opt => (
                            <option key={opt} value={opt} style={{ background: '#FFFFFF', color: '#000000' }}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    {/* Psicóloga */}
                    <td style={{ padding: '12px 12px', fontWeight: 600, color: '#B8324F' }}>
                      {c.psychologist_name}
                    </td>

                    {/* Ciudad */}
                    <td style={{ padding: '12px 12px' }}>
                      {c.city || '—'}
                    </td>

                    {/* Fecha Aprobado */}
                    <td style={{ padding: '12px 12px', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {c.fecha_aprobado}
                    </td>

                    {/* Motivo de Pausa si aplica */}
                    {activeTab === 'en_pausa' || activeTab === 'en_pausa_indefinida' ? (
                      <td style={{ padding: '12px 14px', fontSize: 12, color: '#783F04', fontWeight: 600 }}>
                        {c.pause_reason || '—'}
                      </td>
                    ) : null}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
