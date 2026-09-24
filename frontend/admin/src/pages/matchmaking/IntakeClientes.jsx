import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  Users, Plus, Search, Filter, RefreshCw, CheckCircle,
  Clock, Heart, ShieldCheck, ArrowRight, UserPlus, X, Layers, MapPin, Tag,
  ExternalLink, FileSpreadsheet, FileText, Sparkles, Eye, Edit3, FolderOpen, AlertCircle
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CrmPersonLink from '../../components/CrmPersonLink'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

const PSYCHOLOGIST_LIST = [
  'SILVI', 'JENN', 'ANA', 'ALEJA', 'STEFFY', 'SOFI', 'MAPE D', 'MANU', 'PIA', 'ISA'
]

const CITIES = [
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga',
  'Pereira', 'Cartagena', 'Manizales', 'Santa Marta', 'Miami', 'Madrid'
]

const PLAN_TIERS = [
  'Estándar 65k (2 citas)',
  'Estándar 65k (1 cita)',
  'Estándar Plus 98k',
  'Premium',
  'Premium 150k',
  'VIP 195k',
  'VIP 295k',
  'VIP Oro',
  'Básico 40k',
  'Matchmaking Experience',
  'Eventos Presenciales'
]

export default function IntakeClientes() {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const isAdmin = Boolean(
    user?.role && (
      user.role === 'Admin' ||
      user.role === 'Super Admin' ||
      user.role === 'María' ||
      user.role.toLowerCase().includes('admin') ||
      user.role.toLowerCase().includes('director')
    )
  )

  // Detectar psicóloga logueada
  const detectedUserPsyc = useMemo(() => {
    if (!user) return 'SILVI'
    const nameUpper = (user.name || '').toUpperCase()
    const emailUpper = (user.email || '').toUpperCase()
    const found = PSYCHOLOGIST_LIST.find(p => nameUpper.includes(p) || emailUpper.includes(p))
    return found || 'SILVI'
  }, [user])

  const initialPsyc = useMemo(() => {
    const fromParam = searchParams.get('psychologist')
    if (fromParam) return fromParam
    if (isAdmin) return 'all'
    return detectedUserPsyc
  }, [searchParams, isAdmin, detectedUserPsyc])

  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedPsyc, setSelectedPsyc] = useState(initialPsyc)
  const [selectedCity, setSelectedCity] = useState('all')
  const [selectedPlan, setSelectedPlan] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [quickNoteModalTarget, setQuickNoteModalTarget] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [psycList, setPsycList] = useState(PSYCHOLOGIST_LIST)

  useEffect(() => {
    if (!searchParams.get('psychologist') && !isAdmin && detectedUserPsyc) {
      setSelectedPsyc(detectedUserPsyc)
    }
  }, [detectedUserPsyc, isAdmin, searchParams])

  const initialFormState = {
    person_a: '',
    profile_url: '',
    psychologist_name: detectedUserPsyc,
    quick_notes: '',
    city: '',
    age: '',
    pref: 'hetero',
    plan_tier: '',
    phone: '',
    email: '',
    crm_id: '',
    is_priority: false,
    observations: ''
  }

  const [formData, setFormData] = useState(initialFormState)
  const [submitting, setSubmitting] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [resolveHint, setResolveHint] = useState('')

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

  const [totalCount, setTotalCount] = useState(0)
  const [totalProfilesCrm, setTotalProfilesCrm] = useState(0)
  const [totalSlotsAll, setTotalSlotsAll] = useState(0)
  const [serverTotalPages, setServerTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedDateFilter, setSelectedDateFilter] = useState('all')
  const [sortBy, setSortBy] = useState('recent_first')
  const pageSize = 50

  const fetchIntakeList = useCallback(() => {
    setLoading(true)
    let url = `${API}/api/v1/matchmaking/intake-list?page=${currentPage}&page_size=${pageSize}&sort_by=${encodeURIComponent(sortBy)}&`
    if (selectedPsyc && selectedPsyc !== 'all') url += `psychologist=${encodeURIComponent(selectedPsyc)}&`
    if (selectedCity && selectedCity !== 'all') url += `city=${encodeURIComponent(selectedCity)}&`
    if (selectedPlan && selectedPlan !== 'all') url += `plan_tier=${encodeURIComponent(selectedPlan)}&`
    if (selectedDateFilter && selectedDateFilter !== 'all') url += `date_filter=${encodeURIComponent(selectedDateFilter)}&`
    if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setClients(data.clients || [])
        setTotalCount(data.total || 0)
        if (data.total_profiles_crm) setTotalProfilesCrm(data.total_profiles_crm)
        if (data.total_slots_created) setTotalSlotsAll(data.total_slots_created)
        setServerTotalPages(data.total_pages || 1)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching intake list:', err)
        setLoading(false)
      })
  }, [selectedPsyc, selectedCity, selectedPlan, selectedDateFilter, sortBy, searchTerm, currentPage, token])

  useEffect(() => {
    fetchIntakeList()
  }, [fetchIntakeList])

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedPsyc, selectedCity, selectedPlan, selectedDateFilter, sortBy, searchTerm])

  // Autocompletado inteligente al pegar URL de SmartMatchApp
  const handleResolveQuery = async (queryVal) => {
    if (!queryVal || queryVal.trim().length < 3) return
    const cleanVal = queryVal.trim()
    setResolving(true)
    setResolveHint('🔍 Extrayendo nombre, perfil y notas clínicas desde SmartMatchApp...')

    try {
      const res = await fetch(`${API}/api/v1/matchmaking/resolve-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ url_or_query: cleanVal })
      })
      const data = await res.json()
      if (res.ok && data.found) {
        setFormData(prev => ({
          ...prev,
          person_a: data.name || prev.person_a || '',
          profile_url: cleanVal.startsWith('http') ? cleanVal : (prev.profile_url || data.profile_url || data.crm_url || ''),
          psychologist_name: data.psychologist || prev.psychologist_name || detectedUserPsyc,
          city: data.city || prev.city || '',
          age: data.age || prev.age || '',
          pref: data.pref || prev.pref || 'hetero',
          plan_tier: data.plan_tier || prev.plan_tier || '',
          crm_id: data.crm_id || prev.crm_id || '',
          phone: data.phone || prev.phone || '',
          email: data.email || prev.email || '',
          quick_notes: data.quick_notes || prev.quick_notes || ''
        }))
        setResolveHint(`✅ Perfil extraído automáticamente: ${data.name}${data.crm_id ? ` (CRM #${data.crm_id})` : ''}`)
      } else {
        setResolveHint('⚠️ No se encontraron datos previos para este enlace en el CRM.')
      }
    } catch (err) {
      setResolveHint('')
    } finally {
      setResolving(false)
    }
  }

  const handleCreateClient = async (e) => {
    e.preventDefault()
    if (!formData.profile_url.trim() && !formData.person_a.trim()) {
      alert('Por favor pega la URL del perfil en SmartMatchApp')
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
        body: JSON.stringify({
          ...formData,
          age: formData.age ? parseInt(formData.age, 10) : null
        })
      })
      const data = await res.json()
      if (res.ok) {
        setShowModal(false)
        setResolveHint('')
        const savedName = data.person_a || formData.person_a || 'Cliente'
        const savedPsyc = data.psychologist || formData.psychologist_name
        setFeedback({
          message: data.message || `Perfil de "${savedName}" guardado y asignado a ${savedPsyc}.`,
          person_a: savedName,
          psychologist: savedPsyc
        })
        setFormData({ ...initialFormState, psychologist_name: detectedUserPsyc })
        fetchIntakeList()
      } else {
        alert(data.detail || 'Error al registrar perfil')
      }
    } catch (e) {
      alert('Error de conexión con el servidor')
    } finally {
      setSubmitting(false)
    }
  }

  const totalClients = totalCount > 0 ? totalCount : clients.length
  const totalSlotsCreated = clients.reduce((acc, c) => acc + (c.total_slots || 0), 0)
  const totalWithMatches = clients.filter(c => c.filled_slots > 0).length

  const paginatedClients = clients

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1650, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              background: 'rgba(184, 50, 79, 0.15)',
              color: '#B8324F',
              padding: '6px 10px',
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              fontWeight: 800,
              fontSize: 14
            }}>
              <FileSpreadsheet size={18} style={{ marginRight: 6 }} /> PROFILES
            </span>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Ingreso de Perfiles & Asignación a Psicólogas
            </h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, maxWidth: 850 }}>
            Mesa de entrada para registrar a las personas con su URL de carpeta/entrevista externa, extraer sus notas clínicas (Quick Notes) y llevarlas automáticamente a la mesa de trabajo de cada psicóloga en <b>Matches Psicólogas</b>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() => {
              setFormData({ ...initialFormState, psychologist_name: detectedUserPsyc })
              setResolveHint('')
              setShowModal(true)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#961500',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(150,21,0,0.35)',
              transition: 'all 0.2s'
            }}
          >
            <UserPlus size={16} /> + Registrar Perfil (PROFILES)
          </button>
        </div>
      </div>

      {/* Banner de Feedback Interactivo */}
      {feedback && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: 10,
          padding: '12px 18px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#10B981', fontSize: 13, fontWeight: 600 }}>
            <CheckCircle size={18} />
            <span>{feedback.message}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => navigate(`/matchmaking/mis-matches?psychologist=${encodeURIComponent(feedback.psychologist)}&search=${encodeURIComponent(feedback.person_a)}`)}
              style={{
                background: '#10B981',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Heart size={14} fill="#fff" /> Ver en Matches de {feedback.psychologist} <ArrowRight size={14} />
            </button>
            <button
              onClick={() => setFeedback(null)}
              style={{ background: 'transparent', border: 'none', color: '#10B981', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg-card)', padding: '16px 20px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Perfiles Globales (CRM)</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
            {totalProfilesCrm > 0 ? totalProfilesCrm.toLocaleString('es-CO') : '4.645'}
          </div>
          <div style={{ fontSize: 11, color: '#10B981', marginTop: 4 }}>Total perfiles en base de datos</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '16px 20px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clientes en Mesa Operativa</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#3B82F6', marginTop: 4 }}>
            {totalCount > 0 ? totalCount.toLocaleString('es-CO') : '2.939'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Con cupos activos asignados a psicólogas</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '16px 20px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Slots de Citas Totales</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#F59E0B', marginTop: 4 }}>
            {totalSlotsAll > 0 ? totalSlotsAll.toLocaleString('es-CO') : '4.424'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Cupos de match creados</div>
        </div>
      </div>

      {/* Selector de Psicólogas */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
        <button
          onClick={() => setSelectedPsyc('all')}
          style={{
            padding: '6px 14px',
            borderRadius: 20,
            border: 'none',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            background: selectedPsyc === 'all' ? '#961500' : 'var(--bg-card)',
            color: selectedPsyc === 'all' ? '#FFFFFF' : 'var(--text-secondary)',
            boxShadow: selectedPsyc === 'all' ? '0 2px 6px rgba(150,21,0,0.3)' : 'none'
          }}
        >
          Todas ({clients.length})
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
              fontWeight: 700,
              cursor: 'pointer',
              background: selectedPsyc === p ? '#961500' : 'var(--bg-card)',
              color: selectedPsyc === p ? '#FFFFFF' : 'var(--text-secondary)',
              boxShadow: selectedPsyc === p ? '0 2px 6px rgba(150,21,0,0.3)' : 'none'
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
        background: 'var(--bg-card)',
        padding: '12px 16px',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        marginBottom: 16
      }}>
        {/* Búsqueda */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 240px' }}>
          <Search size={16} color="var(--text-secondary)" />
          <input
            type="text"
            placeholder="Buscar por nombre, psicóloga, notas clínicas..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 13,
              width: '100%'
            }}
          />
        </div>

        {/* Ciudad */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={14} color="var(--text-secondary)" />
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

        {/* Plan */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tag size={14} color="var(--text-secondary)" />
          <select
            value={selectedPlan}
            onChange={e => setSelectedPlan(e.target.value)}
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
            {PLAN_TIERS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Filtro Fecha de Creación en PROFILES */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <select
            value={selectedDateFilter}
            onChange={e => setSelectedDateFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 700,
              outline: 'none'
            }}
          >
            <option value="all">📅 Fecha creación: Todos</option>
            <option value="today">🆕 Agregados Hoy</option>
            <option value="7d">📅 Últimos 7 días</option>
            <option value="30d">📅 Últimos 30 días</option>
          </select>
        </div>

        {/* Ordenamiento */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid rgba(16,185,129,0.4)',
              background: 'rgba(16,185,129,0.08)',
              color: '#10B981',
              fontSize: 12,
              fontWeight: 700,
              outline: 'none'
            }}
          >
            <option value="recent_first">🕒 Más recientes primero (PROFILES)</option>
            <option value="sheet_order">📋 Orden Hoja (Sheet)</option>
            <option value="created_asc">⏳ Más antiguos primero</option>
          </select>
        </div>

        <button
          onClick={fetchIntakeList}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            padding: 6
          }}
          title="Refrescar lista"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Tabla de PROFILES */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        <table style={{ width: '100%', minWidth: 1050, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap' }}>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>CLIENTE (PROFILES)</th>
              <th style={{ padding: '12px 14px', fontWeight: 700 }}>URL / CARPETA</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>PSICÓLOGA ASIGNADA</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>CIUDAD & EDAD</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>QUICK NOTE / NOTAS CLÍNICAS</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>PLAN</th>
              <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center' }}>SLOTS MATCHES</th>
              <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  Cargando lista de PROFILES...
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  No se encontraron perfiles para los filtros seleccionados.
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
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CrmPersonLink name={c.person_a} crmId={c.crm_id} />
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {c.profile_url ? (
                      <a
                        href={c.profile_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 11,
                          color: '#ff8a80',
                          background: 'rgba(150, 21, 0, 0.12)',
                          border: '1px solid rgba(150, 21, 0, 0.3)',
                          padding: '3px 8px',
                          borderRadius: 4,
                          textDecoration: 'none',
                          fontWeight: 600
                        }}
                        title={c.profile_url}
                      >
                        <FolderOpen size={13} /> Carpeta / Perfil <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontWeight: 700,
                      color: '#961500',
                      background: 'rgba(150, 21, 0, 0.12)',
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 11
                    }}>
                      {c.psychologist_name}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 12 }}>
                    {c.city || '—'}{c.age ? ` (${c.age} años)` : ''}
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: 280 }}>
                    {c.quick_notes ? (
                      <div
                        onClick={() => setQuickNoteModalTarget(c)}
                        style={{
                          fontSize: 12,
                          color: 'var(--text-primary)',
                          background: 'rgba(255,255,255,0.03)',
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6
                        }}
                        title="Clic para ver notas clínicas completas"
                      >
                        <span style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 220
                        }}>
                          {c.quick_notes}
                        </span>
                        <Eye size={12} color="var(--text-secondary)" />
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sin notas</span>
                    )}
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
                      {c.plan_tier || 'Pendiente Plan'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
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
                      <span style={{ fontSize: 10, color: c.filled_slots > 0 ? '#10B981' : '#F59E0B', fontWeight: 600 }}>
                        {c.filled_slots}/{c.total_slots} asignados
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {/* Botón directo a Matches de la Psicóloga */}
                    <button
                      onClick={() => navigate(`/matchmaking/mis-matches?psychologist=${encodeURIComponent(c.psychologist_name)}&search=${encodeURIComponent(c.person_a)}`)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'rgba(150, 21, 0, 0.15)',
                        border: '1px solid rgba(150, 21, 0, 0.4)',
                        borderRadius: 6,
                        padding: '5px 10px',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#ff8a80',
                        cursor: 'pointer',
                        marginRight: 6
                      }}
                      title={`Ver mesa de matches de ${c.psychologist_name}`}
                    >
                      <Heart size={13} fill="#ff8a80" /> Matches {c.psychologist_name}
                    </button>

                    <button
                      onClick={() => navigate(`/matchmaking/entrevista?user_id=${encodeURIComponent(c.crm_id || c.person_a)}`)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'transparent',
                        border: '1px solid var(--border-color)',
                        borderRadius: 6,
                        padding: '5px 10px',
                        fontSize: 12,
                        color: 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                      title="Abrir Entrevista Clínica 360°"
                    >
                      🎙️ Entrevista
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {serverTotalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 16,
          padding: '12px 16px',
          background: 'var(--bg-card)',
          borderRadius: 8,
          border: '1px solid var(--border-color)',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Mostrando <b>{(currentPage - 1) * pageSize + 1}</b> - <b>{Math.min(currentPage * pageSize, totalClients)}</b> de <b>{totalClients.toLocaleString('es-CO')}</b> perfiles
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1 || loading}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-base)',
                color: currentPage === 1 || loading ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: currentPage === 1 || loading ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 600
              }}
            >
              Anterior
            </button>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '0 8px', color: 'var(--text-primary)' }}>
              Página {currentPage} de {serverTotalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, serverTotalPages))}
              disabled={currentPage === serverTotalPages || loading}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-base)',
                color: currentPage === serverTotalPages || loading ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: currentPage === serverTotalPages || loading ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 600
              }}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Modal para Ver Quick Notes Completas */}
      {quickNoteModalTarget && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: 20
        }}>
          <div style={{
            background: 'var(--bg-card)',
            width: '100%',
            maxWidth: 580,
            borderRadius: 12,
            border: '1px solid var(--border-color)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-base)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color="#961500" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Notas Clínicas — {quickNoteModalTarget.person_a}
                </h3>
              </div>
              <button
                onClick={() => setQuickNoteModalTarget(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{
                background: 'var(--bg-base)',
                padding: '16px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                fontSize: 13,
                lineHeight: 1.6,
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap'
              }}>
                {quickNoteModalTarget.quick_notes}
              </div>
              {quickNoteModalTarget.profile_url && (
                <div style={{ marginTop: 14 }}>
                  <a
                    href={quickNoteModalTarget.profile_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      color: '#ff8a80',
                      textDecoration: 'none',
                      fontWeight: 700
                    }}
                  >
                    <FolderOpen size={14} /> Abrir Carpeta Externa / Google Drive <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-base)' }}>
              <button
                onClick={() => setQuickNoteModalTarget(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 12
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Principal: Registrar Perfil (PROFILES) */}
      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: 20
        }}>
          <div style={{
            background: 'var(--bg-card)',
            width: '100%',
            maxWidth: 640,
            borderRadius: 14,
            border: '1px solid var(--border-color)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-base)'
            }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserPlus size={20} color="#961500" /> Ingresar Perfil — PROFILES
                </h2>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Pega únicamente el enlace de SmartMatchApp; el sistema extrae el nombre y todos los datos clínicos automáticamente.
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateClient} style={{ padding: '20px 24px', maxHeight: '80vh', overflowY: 'auto' }}>
              {/* Campo 1: URL de Perfil en SmartMatchApp (CRM) */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  🔗 URL de Perfil en SmartMatchApp (CRM) *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Pega aquí la URL (ej: https://dailylover.smartmatchapp.com/#!/client/4842/)"
                  value={formData.profile_url}
                  onChange={e => {
                    const val = e.target.value
                    setFormData(prev => ({ ...prev, profile_url: val }))
                    if (val.includes('http') || val.includes('client/') || /^\d{3,}$/.test(val.trim())) {
                      handleResolveQuery(val)
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {resolving && (
                  <div style={{ fontSize: 12, marginTop: 6, color: '#3B82F6', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <RefreshCw size={14} className="animate-spin" /> Extrayendo nombre, edad, ciudad y perfil clínico desde el CRM...
                  </div>
                )}
                {resolveHint && !resolving && (
                  <div style={{
                    fontSize: 12,
                    marginTop: 6,
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: resolveHint.startsWith('✅') ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                    color: resolveHint.startsWith('✅') ? '#10B981' : '#F59E0B',
                    fontWeight: 600
                  }}>
                    {resolveHint}
                  </div>
                )}
              </div>

              {/* Campo 2: Psicóloga Responsable */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  💖 Psicóloga Responsable (A cuya mesa de matches irá la persona) *
                </label>
                <select
                  value={formData.psychologist_name}
                  onChange={e => setFormData({ ...formData, psychologist_name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontWeight: 700,
                    outline: 'none'
                  }}
                >
                  {psycList.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Resumen de Datos Extraídos Automáticamente (Incluyendo Nombre) */}
              {(formData.person_a || formData.city || formData.plan_tier || formData.quick_notes || formData.age || formData.crm_id) && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.07)',
                  border: '1px solid rgba(16, 185, 129, 0.28)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 16,
                  fontSize: 12
                }}>
                  <div style={{ fontWeight: 800, color: '#10B981', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>✓ Datos Extraídos Automáticamente del CRM</span>
                    {formData.crm_id && (
                      <span style={{ background: 'rgba(16,185,129,0.15)', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>
                        CRM #{formData.crm_id}
                      </span>
                    )}
                  </div>

                  {/* Nombre extraído (editable inline solo si desean ajustarlo) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontWeight: 600 }}>👤 Nombre:</span>
                    <input
                      type="text"
                      value={formData.person_a}
                      onChange={e => setFormData(prev => ({ ...prev, person_a: e.target.value }))}
                      style={{
                        flex: 1,
                        padding: '5px 10px',
                        borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(0,0,0,0.25)',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 13
                      }}
                    />
                  </div>

                  <div style={{ color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '8px 14px' }}>
                    {formData.age && <span>🎂 Edad: <b style={{ color: 'var(--text-primary)' }}>{formData.age} años</b></span>}
                    {formData.city && <span>📍 Ciudad: <b style={{ color: 'var(--text-primary)' }}>{formData.city}</b></span>}
                    {formData.pref && <span>🧭 Orientación: <b style={{ color: 'var(--text-primary)' }}>{formData.pref}</b></span>}
                    {formData.phone && <span>📞 Tel: <b style={{ color: 'var(--text-primary)' }}>{formData.phone}</b></span>}
                    {formData.plan_tier && <span>💎 Plan: <b style={{ color: 'var(--text-primary)' }}>{formData.plan_tier}</b></span>}
                  </div>

                  {formData.quick_notes && (
                    <div style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                      color: 'var(--text-secondary)',
                      fontSize: 11.5,
                      lineHeight: 1.4
                    }}>
                      <b style={{ color: 'var(--text-primary)' }}>📝 Resumen / Notas Clínicas:</b> {formData.quick_notes}
                    </div>
                  )}
                </div>
              )}

              {/* Botones de Acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || resolving || !formData.person_a}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#961500',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: (submitting || resolving || !formData.person_a) ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(150,21,0,0.35)',
                    opacity: (submitting || resolving || !formData.person_a) ? 0.6 : 1
                  }}
                >
                  {submitting ? 'Guardando y asignando...' : `✓ Guardar en PROFILES y Llevar a Matches de ${formData.psychologist_name}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
