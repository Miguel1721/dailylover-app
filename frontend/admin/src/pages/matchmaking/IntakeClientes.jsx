import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  Users, Plus, Search, Filter, RefreshCw, CheckCircle,
  Clock, Heart, ShieldCheck, ArrowRight, UserPlus, X
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const API = 'https://prueba-daily.agentesia.cloud'

const PSYCHOLOGIST_LIST = [
  'JENN', 'ANA', 'SILVI', 'STEFFY', 'SOFI', 'MAPE D', 'ALEJA', 'MANU 1', 'MANU 2', 'PIA'
]

const CITIES = [
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga',
  'Pereira', 'Cartagena', 'Manizales', 'Santa Marta', 'Miami', 'Madrid'
]

const PLAN_TIERS = [
  'Estándar 65k (2 citas)',
  'Estándar 65k (1 cita)',
  'VIP 195k',
  'VIP 295k',
  'VIP Oro',
  'Eventos Presenciales'
]

export default function IntakeClientes() {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedPsyc, setSelectedPsyc] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [psycList, setPsycList] = useState(PSYCHOLOGIST_LIST)

  const [formData, setFormData] = useState({
    person_a: '',
    phone: '',
    psychologist_name: 'SILVI',
    city: 'Bogotá',
    pref: 'hetero',
    plan_tier: 'Estándar 65k (2 citas)',
    observations: ''
  })
  const [submitting, setSubmitting] = useState(false)

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

  const fetchIntakeList = useCallback(() => {
    setLoading(true)
    let url = `${API}/api/v1/matchmaking/intake-list?`
    if (selectedPsyc && selectedPsyc !== 'all') url += `psychologist=${encodeURIComponent(selectedPsyc)}&`
    if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setClients(data.clients || [])
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching intake list:', err)
        setLoading(false)
      })
  }, [selectedPsyc, searchTerm, token])

  useEffect(() => {
    fetchIntakeList()
  }, [fetchIntakeList])

  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedPsyc, searchTerm])

  const [resolving, setResolving] = useState(false)
  const [resolveHint, setResolveHint] = useState('')

  const handleResolveInput = async (val) => {
    setFormData(prev => ({ ...prev, person_a: val }))
    const isUrlOrId = val.includes('http') || val.includes('smartmatchapp') || val.includes('client/') || val.includes('profile/') || /^\d{3,}$/.test(val.trim())
    if (isUrlOrId) {
      setResolving(true)
      setResolveHint('🔍 Detectado enlace/ID del CRM SmartMatchApp — consultando datos...')
      try {
        const res = await fetch(`${API}/api/v1/matchmaking/resolve-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ url_or_query: val })
        })
        const data = await res.json()
        if (res.ok && data.name) {
          setFormData(prev => ({
            ...prev,
            person_a: data.name,
            city: data.city || prev.city,
            pref: data.pref || prev.pref,
            plan_tier: data.plan_tier || prev.plan_tier,
          }))
          setResolveHint(`✅ Datos extraídos del CRM: ${data.name} (${data.city || 'Sin ciudad'}, ${data.pref.toUpperCase()}, ${data.plan_tier})`)
        } else {
          setResolveHint('⚠️ Link detectado pero el cliente no está en base local aún.')
        }
      } catch (err) {
        setResolveHint('')
      } finally {
        setResolving(false)
      }
    } else {
      setResolveHint('')
    }
  }

  const handleCreateClient = async (e) => {
    e.preventDefault()
    if (!formData.person_a.trim()) {
      alert('Por favor ingresa el nombre de Persona A')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/intake-client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (res.ok) {
        setShowModal(false)
        setResolveHint('')
        setFeedback(`Cliente "${formData.person_a}" registrado con 3 slots asignados a ${formData.psychologist_name}`)
        setTimeout(() => setFeedback(''), 4000)
        setFormData({
          person_a: '',
          phone: '',
          psychologist_name: 'SILVI',
          city: 'Bogotá',
          pref: 'hetero',
          plan_tier: 'Estándar 65k (2 citas)',
          observations: ''
        })
        fetchIntakeList()
      } else {
        alert(data.detail || 'Error al registrar cliente')
      }
    } catch (e) {
      alert('Error de conexión con el servidor')
    } finally {
      setSubmitting(false)
    }
  }

  const totalClients = clients.length
  const totalSlotsCreated = clients.reduce((acc, c) => acc + (c.total_slots || 0), 0)
  const totalWithMatches = clients.filter(c => c.filled_slots > 0).length

  const totalPages = Math.ceil(clients.length / pageSize) || 1
  const paginatedClients = clients.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={26} color="#B8324F" />
            Intake de Clientes — PROFILES
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Registro inicial de clientes, asignación de psicóloga y generación automática de los 3 slots de matchmaking.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {feedback && (
            <span style={{ fontSize: 13, color: '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.1)', padding: '6px 12px', borderRadius: 6 }}>
              <CheckCircle size={15} /> {feedback}
            </span>
          )}
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#B8324F',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(184,50,79,0.3)'
            }}
          >
            <UserPlus size={16} /> + Registrar Nuevo Cliente (Crear 3 Slots)
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg-card)', padding: '16px 20px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Clientes Registrados</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{totalClients}</div>
          <div style={{ fontSize: 11, color: '#10B981', marginTop: 4 }}>Total en base de datos</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '16px 20px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Total Slots Activos</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#3B82F6', marginTop: 4 }}>{totalSlotsCreated}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>3 cupos por cada cliente</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '16px 20px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Con Candidatos Asignados</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#F59E0B', marginTop: 4 }}>{totalWithMatches}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>En proceso por psicóloga</div>
        </div>
      </div>

      {/* Filter Tabs by Psychologist */}
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
          Todas las Psicólogas ({clients.length})
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

      {/* Search Bar */}
      <div style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        background: 'var(--bg-card)',
        padding: '12px 16px',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        marginBottom: 16
      }}>
        <Search size={16} color="var(--text-secondary)" />
        <input
          type="text"
          placeholder="Buscar cliente por nombre, ciudad o psicóloga..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 13,
            flex: 1
          }}
        />
        <button
          onClick={fetchIntakeList}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)'
          }}
          title="Refrescar lista"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Clients Table */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>PERSONA A (CLIENTE)</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>PSICÓLOGA ASIGNADA</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>CIUDAD</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>PREF</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>PLAN TIER</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>SLOTS ASIGNADOS</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>ESTADO SLOTS</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>FECHA INTAKE</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  Cargando clientes de intake...
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  No se encontraron clientes para los filtros seleccionados.
                </td>
              </tr>
            ) : (
              paginatedClients.map((c, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {c.person_a}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontWeight: 700,
                      color: '#B8324F',
                      background: 'rgba(184,50,79,0.1)',
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 11
                    }}>
                      {c.psychologist_name}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    {c.city}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      background: c.pref_color || '#CFE2F3',
                      color: '#073763',
                      textTransform: 'uppercase'
                    }}>
                      {c.pref}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      background: c.plan_color || '#B6D7A8',
                      color: '#274E13'
                    }}>
                      {c.plan_tier}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--text-primary)'
                    }}>
                      <Layers size={13} color="#3B82F6" /> {c.total_slots} slots
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: c.filled_slots > 0 ? '#10B981' : '#F59E0B', fontWeight: 600 }}>
                        {c.filled_slots}/{c.total_slots} con candidato
                      </span>
                      {c.approved_slots > 0 && (
                        <span style={{ fontSize: 10, background: '#D1FAE5', color: '#065F46', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>
                          {c.approved_slots} Aprobado
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 12 }}>
                    {c.created_at || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => navigate(`/matchmaking/mis-matches?search=${encodeURIComponent(c.person_a)}`)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'transparent',
                        border: '1px solid var(--border-color)',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: 12,
                        color: 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                      title="Ver slots de este cliente en la hoja de trabajo"
                    >
                      Ver Slots <ArrowRight size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Toolbar */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 16,
          padding: '12px 16px',
          background: 'var(--bg-card)',
          borderRadius: 8,
          border: '1px solid var(--border-color)'
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Mostrando <b>{(currentPage - 1) * pageSize + 1}</b> - <b>{Math.min(currentPage * pageSize, clients.length)}</b> de <b>{clients.length}</b> clientes
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-base)',
                color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 600
              }}
            >
              Anterior
            </button>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '0 8px', color: 'var(--text-primary)' }}>
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-base)',
                color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 600
              }}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Modal para Crear Cliente Nuevo (3 Slots) */}
      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--bg-card)',
            width: '100%',
            maxWidth: 560,
            borderRadius: 12,
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-base)'
            }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={18} color="#B8324F" /> Registrar Cliente & Crear 3 Slots
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateClient} style={{ padding: '20px 24px' }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Nombre Completo o Link del CRM (SmartMatchApp) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Valeria Linero o pega enlace https://dailylover.smartmatchapp.com/client/3923..."
                  value={formData.person_a}
                  onChange={e => handleResolveInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 6,
                    border: resolveHint.startsWith('✅') ? '1px solid #10B981' : '1px solid var(--border-color)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {resolving && (
                  <div style={{ fontSize: 12, marginTop: 5, color: '#3B82F6', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <RefreshCw size={12} className="animate-spin" /> Extrayendo datos del CRM...
                  </div>
                )}
                {resolveHint && !resolving && (
                  <div style={{
                    fontSize: 12,
                    marginTop: 6,
                    padding: '6px 10px',
                    borderRadius: 4,
                    background: resolveHint.startsWith('✅') ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                    color: resolveHint.startsWith('✅') ? '#059669' : '#D97706',
                    fontWeight: 500
                  }}>
                    {resolveHint}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Psicóloga Asignada *
                  </label>
                  <select
                    value={formData.psychologist_name}
                    onChange={e => setFormData({ ...formData, psychologist_name: e.target.value })}
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
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Ciudad *
                  </label>
                  <select
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
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
                    {CITIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Preferencia *
                  </label>
                  <select
                    value={formData.pref}
                    onChange={e => setFormData({ ...formData, pref: e.target.value })}
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
                    <option value="hetero">HETERO</option>
                    <option value="gay">GAY</option>
                    <option value="lesbiana">LESBIANA</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Plan Tier *
                  </label>
                  <select
                    value={formData.plan_tier}
                    onChange={e => setFormData({ ...formData, plan_tier: e.target.value })}
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
                    {PLAN_TIERS.map(pt => (
                      <option key={pt} value={pt}>{pt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Criterios Clínicos / Observaciones de Búsqueda
                </label>
                <textarea
                  rows={3}
                  placeholder="Ej: Interesada en profesionales con afinidad deportiva, rango 28-35 años..."
                  value={formData.observations}
                  onChange={e => setFormData({ ...formData, observations: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    borderRadius: 6,
                    padding: '8px 16px',
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: '#B8324F',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 18px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: submitting ? 'wait' : 'pointer'
                  }}
                >
                  {submitting ? 'Creando 3 Slots...' : '✓ Registrar & Crear 3 Slots'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
