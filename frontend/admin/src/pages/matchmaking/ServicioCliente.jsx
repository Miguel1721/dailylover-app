import React, { useState, useEffect, useCallback } from 'react'
import { Headphones, Phone, Search, RefreshCw, AlertTriangle, CheckCircle, Clock, ArrowRight, User, MapPin, Filter, PauseCircle, PhoneCall, ExternalLink } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import CrmPersonLink from '../../components/CrmPersonLink'

const API = 'https://prueba-daily.agentesia.cloud'

const CITIES = [
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga',
  'Pereira', 'Cartagena', 'Manizales', 'Santa Marta', 'Miami', 'Madrid'
]

const PSYCHOLOGIST_LIST = [
  'JENN', 'ANA', 'SILVI', 'STEFFY', 'SOFI', 'MAPE D', 'ALEJA', 'MANU', 'PIA', 'ISA'
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

const STAGE_LABELS = {
  'pendientes': 'Pendiente',
  'en_pausa': 'En Pausa',
  'en_pausa_indefinida': 'Pausa Indefinida',
  'trouble': 'Trouble'
}

export default function ServicioCliente() {
  const { token } = useAuth()
  const [selectedPsyc, setSelectedPsyc] = useState('all')
  const [selectedStage, setSelectedStage] = useState('all')
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
    let url = `${API}/api/v1/matchmaking/confirmations?stage=${selectedStage}&`
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
  }, [selectedStage, selectedPsyc, selectedCity, selectedConfA, selectedConfB, searchTerm, token])

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
        // En el modelo de tabla única (v2), actualizamos el registro en el lugar sin desaparecer la fila
        setConfirmations(prev => prev.map(c => c.confirmation_id === confirmationId ? {
          ...c,
          [field]: value,
          stage: data.stage || c.stage,
          pause_reason: data.pause_reason !== undefined ? data.pause_reason : c.pause_reason
        } : c))
        setNotification(`Estado de confirmación actualizado (${value})`)
        setTimeout(() => setNotification(''), 3000)
      } else {
        alert(data.detail || 'Error al actualizar confirmación')
      }
    } catch (e) {
      alert('Error de conexión al actualizar')
    } finally {
      setUpdatingId(null)
    }
  }

  // Métricas rápidas
  const totalCount = confirmations.length
  const bothAcceptedCount = confirmations.filter(c => c.person_a_confirmation === 'Aceptó' && c.person_b_confirmation === 'Aceptó').length
  const pendingCount = confirmations.filter(c => c.person_a_confirmation === 'Pendiente' || c.person_b_confirmation === 'Pendiente').length
  const pausedCount = confirmations.filter(c => c.stage === 'en_pausa' || c.stage === 'en_pausa_indefinida').length

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1650, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Headphones size={28} color="#B8324F" />
            Servicio al Cliente — Panel Único de Confirmaciones
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Tabla unificada de gestión de llamadas para matches aprobados. Las llamadas a Persona A y Persona B son 100% independientes.
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

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Parejas</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{totalCount}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid #B6D7A8', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: '#274E13', fontWeight: 600, textTransform: 'uppercase' }}>Listos para Agendar (Aceptaron Ambos)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#274E13', marginTop: 2 }}>{bothAcceptedCount}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid #FFE599', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: '#7F6000', fontWeight: 600, textTransform: 'uppercase' }}>Pendientes de Llamar</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#7F6000', marginTop: 2 }}>{pendingCount}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid #F9CB9C', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: '#783F04', fontWeight: 600, textTransform: 'uppercase' }}>En Pausa / Reprogramar</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#783F04', marginTop: 2 }}>{pausedCount}</div>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10B981',
          color: '#065F46',
          padding: '10px 16px',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <CheckCircle size={16} color="#10B981" />
          {notification}
        </div>
      )}

      {/* Filtros Bar */}
      <div style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        background: 'var(--bg-card)',
        padding: '12px 16px',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        marginBottom: 16,
        flexWrap: 'wrap'
      }}>
        {/* Filtro Etapa / Estado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={13} color="var(--text-secondary)" />
          <select
            value={selectedStage}
            onChange={e => setSelectedStage(e.target.value)}
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
            <option value="all">Todas las Etapas</option>
            <option value="pendientes">Pendientes</option>
            <option value="en_pausa">En Pausa</option>
            <option value="en_pausa_indefinida">En Pausa Indefinida</option>
            <option value="trouble">Trouble Matches</option>
          </select>
        </div>

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

        {/* Filtro Confirmación A */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>Conf. A:</span>
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
            <option value="all">Conf. A: Todos</option>
            {CONFIRMATION_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Filtro Confirmación B */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>Conf. B:</span>
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
            <option value="all">Conf. B: Todos</option>
            {CONFIRMATION_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
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

        {/* Buscador */}
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por Persona A, Persona B o teléfono..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 32px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 12,
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Unified Table */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        overflowX: 'auto'
      }}>
        <table style={{ width: '100%', minWidth: 1200, borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap' }}>
              <th style={{ padding: '12px 14px', width: 220, fontWeight: 600 }}>PERSONA A (CLIENTE)</th>
              <th style={{ padding: '12px 14px', width: 170, fontWeight: 600 }}>CONFIRMACIÓN A</th>
              <th style={{ padding: '12px 14px', width: 220, fontWeight: 600 }}>PERSONA B (MATCH)</th>
              <th style={{ padding: '12px 14px', width: 170, fontWeight: 600 }}>CONFIRMACIÓN B</th>
              <th style={{ padding: '12px 10px', width: 110, fontWeight: 600 }}>PSICÓLOGA</th>
              <th style={{ padding: '12px 10px', width: 100, fontWeight: 600 }}>CIUDAD</th>
              <th style={{ padding: '12px 10px', width: 110, fontWeight: 600 }}>PLAN</th>
              <th style={{ padding: '12px 10px', width: 110, fontWeight: 600 }}>ETAPA</th>
            </tr>
          </thead>
          <tbody>
            {loading && confirmations.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Cargando confirmaciones...
                </td>
              </tr>
            ) : confirmations.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No se encontraron confirmaciones registradas con los filtros actuales.
                </td>
              </tr>
            ) : (
              confirmations.map((item) => {
                const confAColor = CONFIRMATION_COLORS[item.person_a_confirmation] || CONFIRMATION_COLORS['Pendiente']
                const confBColor = CONFIRMATION_COLORS[item.person_b_confirmation] || CONFIRMATION_COLORS['Pendiente']
                const isBothAccepted = item.person_a_confirmation === 'Aceptó' && item.person_b_confirmation === 'Aceptó'
                const isTrouble = item.person_a_confirmation === 'Rechazó' || item.person_b_confirmation === 'Rechazó'

                let rowBg = 'transparent'
                if (isBothAccepted) rowBg = 'rgba(106, 168, 79, 0.08)'
                else if (isTrouble) rowBg = 'rgba(234, 153, 153, 0.08)'

                return (
                  <tr
                    key={item.confirmation_id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: rowBg,
                      transition: 'background 0.15s'
                    }}
                  >
                    {/* Persona A */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>
                        <CrmPersonLink name={item.person_a} crmId={item.person_a_crm_id} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                        <Phone size={12} />
                        <span style={{ fontFamily: 'monospace' }}>{item.phone_a || '—'}</span>
                      </div>
                    </td>

                    {/* Selector Confirmación A */}
                    <td style={{ padding: '10px 14px' }}>
                      <select
                        value={item.person_a_confirmation || 'Pendiente'}
                        onChange={e => handleUpdateConfirmation(item.confirmation_id, 'person_a_confirmation', e.target.value)}
                        disabled={updatingId === item.confirmation_id}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: `1px solid ${confAColor.bg}`,
                          background: confAColor.bg,
                          color: confAColor.color,
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        {CONFIRMATION_OPTIONS.map(opt => (
                          <option key={opt} value={opt} style={{ background: '#fff', color: '#000' }}>{opt}</option>
                        ))}
                      </select>
                    </td>

                    {/* Persona B */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>
                        <CrmPersonLink name={item.person_b} crmId={item.person_b_crm_id} style={{ color: '#134F5C' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                        <Phone size={12} />
                        <span style={{ fontFamily: 'monospace' }}>{item.phone_b || '—'}</span>
                      </div>
                    </td>

                    {/* Selector Confirmación B */}
                    <td style={{ padding: '10px 14px' }}>
                      <select
                        value={item.person_b_confirmation || 'Pendiente'}
                        onChange={e => handleUpdateConfirmation(item.confirmation_id, 'person_b_confirmation', e.target.value)}
                        disabled={updatingId === item.confirmation_id}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: `1px solid ${confBColor.bg}`,
                          background: confBColor.bg,
                          color: confBColor.color,
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        {CONFIRMATION_OPTIONS.map(opt => (
                          <option key={opt} value={opt} style={{ background: '#fff', color: '#000' }}>{opt}</option>
                        ))}
                      </select>
                    </td>

                    {/* Psicóloga */}
                    <td style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.psychologist_name || '—'}
                    </td>

                    {/* Ciudad */}
                    <td style={{ padding: '12px 10px' }}>
                      {item.city ? (
                        <span>{item.city}</span>
                      ) : (
                        <span style={{ background: '#FFF2CC', color: '#7F6000', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                          Falta ciudad
                        </span>
                      )}
                    </td>

                    {/* Plan */}
                    <td style={{ padding: '12px 10px' }}>
                      {item.plan_tier ? (
                        <span style={{ fontSize: 12 }}>{item.plan_tier}</span>
                      ) : (
                        <span style={{ background: '#FFF2CC', color: '#7F6000', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                          Falta plan
                        </span>
                      )}
                    </td>

                    {/* Etapa */}
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        background: isBothAccepted ? '#D9EAD3' : isTrouble ? '#EA9999' : '#F3F3F3',
                        color: isBothAccepted ? '#274E13' : isTrouble ? '#660000' : '#434343'
                      }}>
                        {STAGE_LABELS[item.stage] || item.stage}
                      </span>
                    </td>
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
