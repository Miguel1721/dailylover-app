import React, { useState, useEffect, useCallback } from 'react'
import { 
  AlertTriangle, PhoneCall, MessageSquare, CheckCircle2, 
  ExternalLink, Search, Filter, RefreshCw, UserX, 
  Flame, ShieldAlert, Sparkles, User, ChevronLeft, ChevronRight,
  HelpCircle, FileText, Check, Copy, ArrowUpDown, Coffee, Send
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) 
  ? window.location.origin 
  : 'https://daily-lover.agentesia.cloud'

const PSYCHOLOGISTS = [
  'SILVI', 'JENN', 'ANA', 'STEFF', 'ISA', 'PIA', 'MAPE'
]

export default function PerfilesIncompletos() {
  const { token, user } = useAuth()
  
  // Tab state: 'rescue_men' | 'incomplete_crm'
  const [currentTab, setCurrentTab] = useState('rescue_men')

  // ─── RESCATE DE HOMBRES STATE ──────────────────────────────────────────────
  const [menList, setMenList] = useState([])
  const [menStats, setMenStats] = useState(null)
  const [loadingMen, setLoadingMen] = useState(true)
  const [menTotal, setMenTotal] = useState(0)
  const [menTotalPages, setMenTotalPages] = useState(1)
  const [menCityFilter, setMenCityFilter] = useState('all')
  const [menStatusFilter, setMenStatusFilter] = useState('all')
  const [menRespFilter, setMenRespFilter] = useState('')
  const [menSearch, setMenSearch] = useState('')
  const [menPage, setMenPage] = useState(1)
  const [menPageSize, setMenPageSize] = useState(25)
  const [updatingUserId, setUpdatingUserId] = useState(null)
  const [copiedMenId, setCopiedMenId] = useState(null)

  // ─── CRM INCOMPLETE PROFILES STATE ─────────────────────────────────────────
  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [profiles, setProfiles] = useState([])
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [totalProfiles, setTotalProfiles] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [missingField, setMissingField] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [psychologist, setPsychologist] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [copiedId, setCopiedId] = useState(null)

  // ─── FETCH RESCATE DE HOMBRES ──────────────────────────────────────────────
  const fetchMenRescue = useCallback(async () => {
    setLoadingMen(true)
    try {
      const params = new URLSearchParams()
      params.append('city_filter', menCityFilter)
      params.append('status_filter', menStatusFilter)
      if (menRespFilter && menRespFilter !== 'all') params.append('responsable', menRespFilter)
      if (menSearch.trim()) params.append('search', menSearch.trim())
      params.append('page', menPage)
      params.append('page_size', menPageSize)

      const res = await fetch(`${API}/api/v1/matchmaking/leads-men-rescue?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setMenList(data.leads || [])
        setMenTotal(data.total || 0)
        setMenTotalPages(data.total_pages || 1)
        if (data.stats) setMenStats(data.stats)
      }
    } catch (err) {
      console.error('Error fetching leads men rescue:', err)
    } finally {
      setLoadingMen(false)
    }
  }, [token, menCityFilter, menStatusFilter, menRespFilter, menSearch, menPage, menPageSize])

  const handleUpdateLead = async (userId, patchData) => {
    setUpdatingUserId(userId)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/leads-men-rescue/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(patchData)
      })
      if (res.ok) {
        setMenList(prev => prev.map(item => item.user_id === userId ? { ...item, ...patchData } : item))
        // Refrescar stats suavemente
        const statsRes = await fetch(`${API}/api/v1/matchmaking/leads-men-rescue?page=1&page_size=1`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (statsRes.ok) {
          const sdata = await statsRes.json()
          if (sdata.stats) setMenStats(sdata.stats)
        }
      }
    } catch (e) {
      console.error('Error updating lead:', e)
    } finally {
      setUpdatingUserId(null)
    }
  }

  // No se presentó a la ENTREVISTA: suma 1, envía correo de reprogramación; a la 3ª sale de la lista
  const handleInterviewNoShow = async (lead) => {
    const next = (lead.interview_no_shows || 0) + 1
    const msg = next >= 3
      ? `Esta será la inasistencia 3 de 3 de ${lead.name}: saldrá de la lista de entrevistas y recibirá el correo de política. ¿Confirmas?`
      : `Registrar que ${lead.name} no se presentó a la entrevista (${next} de 3). Se le enviará un correo para reprogramar. ¿Confirmas?`
    if (!window.confirm(msg)) return
    setUpdatingUserId(lead.user_id)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/leads-men-rescue/${lead.user_id}/no-show`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.detail || 'No se pudo registrar la inasistencia')
        return
      }
      setMenList(prev => prev.map(item => item.user_id === lead.user_id ? {
        ...item,
        interview_no_shows: data.interview_no_shows,
        contact_status: data.contact_status,
        contact_notes: data.contact_notes
      } : item))
      if (!data.has_email) {
        alert('Inasistencia registrada, pero la persona no tiene correo: avísale por WhatsApp.')
      } else if (!data.email_sent) {
        alert('Inasistencia registrada, pero el correo no se pudo enviar. Avísale por WhatsApp.')
      }
    } catch (e) {
      console.error('Error registrando no-show:', e)
      alert('Error de conexión')
    } finally {
      setUpdatingUserId(null)
    }
  }

  // ─── FETCH CRM INCOMPLETES ─────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/incomplete-stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Error fetching incomplete stats:', err)
    } finally {
      setLoadingStats(false)
    }
  }, [token])

  const fetchProfiles = useCallback(async () => {
    setLoadingProfiles(true)
    try {
      const params = new URLSearchParams()
      params.append('page', page)
      params.append('page_size', pageSize)
      if (missingField && missingField !== 'all') params.append('missing_field', missingField)
      if (planFilter === 'with_plan') params.append('has_plan', 'true')
      if (planFilter === 'no_plan') params.append('has_plan', 'false')
      if (psychologist && psychologist !== 'all') params.append('psychologist', psychologist)
      if (search.trim()) params.append('search', search.trim())

      const res = await fetch(`${API}/api/v1/matchmaking/incomplete-profiles?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setProfiles(data.profiles || [])
        setTotalProfiles(data.total || 0)
        setTotalPages(data.total_pages || 1)
      }
    } catch (err) {
      console.error('Error fetching incomplete profiles:', err)
    } finally {
      setLoadingProfiles(false)
    }
  }, [token, page, pageSize, missingField, planFilter, psychologist, search])

  useEffect(() => {
    fetchMenRescue()
  }, [fetchMenRescue])

  useEffect(() => {
    fetchStats()
    fetchProfiles()
  }, [fetchStats, fetchProfiles])

  // Helper copia WhatsApp para Rescate de Hombres
  const handleCopyMenMessage = (lead) => {
    if (!lead.whatsapp_url) return
    try {
      const urlObj = new URL(lead.whatsapp_url)
      const text = urlObj.searchParams.get('text') || ''
      navigator.clipboard.writeText(text)
      setCopiedMenId(lead.user_id)
      setTimeout(() => setCopiedMenId(null), 2500)
    } catch (e) {
      console.error(e)
    }
  }

  // Helper copia WhatsApp para Fichas Incompletas CRM
  const handleCopyMessage = (prof) => {
    if (!prof.whatsapp_url) return
    try {
      const urlObj = new URL(prof.whatsapp_url)
      const text = urlObj.searchParams.get('text') || ''
      navigator.clipboard.writeText(text)
      setCopiedId(prof.user_id)
      setTimeout(() => setCopiedId(null), 2500)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1440, margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: currentTab === 'rescue_men' ? 'rgba(255, 107, 53, 0.18)' : 'rgba(234, 153, 153, 0.15)',
              border: `1px solid ${currentTab === 'rescue_men' ? 'rgba(255, 107, 53, 0.35)' : 'rgba(234, 153, 153, 0.3)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: currentTab === 'rescue_men' ? '#FF6B35' : '#ff6b6b'
            }}>
              {currentTab === 'rescue_men' ? <Flame size={24} /> : <ShieldAlert size={22} />}
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                {currentTab === 'rescue_men' ? 'Campaña de Rescate de Hombres' : 'Fichas Incompletas & Saneamiento CRM'}
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                {currentTab === 'rescue_men'
                  ? '1.116 hombres registrados sin entrevista clínica en base de datos. Contacta con 1 clic para reactivarlos y agendarlos.'
                  : 'Perfiles bloqueados del motor por datos faltantes en CRM. Contacta para completar su ficha y habilitar el matching.'}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => {
              if (currentTab === 'rescue_men') fetchMenRescue()
              else { fetchStats(); fetchProfiles(); }
            }}
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', fontSize: 13 }}
            title="Recargar datos"
          >
            <RefreshCw size={15} className={(loadingMen || loadingProfiles) ? 'spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Main Tab Selector */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
        <button
          onClick={() => { setCurrentTab('rescue_men'); setMenPage(1); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: currentTab === 'rescue_men' ? 'linear-gradient(135deg, #FF6B35 0%, #D84315 100%)' : 'var(--bg-card)',
            color: currentTab === 'rescue_men' ? '#FFF' : 'var(--text-secondary)',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: currentTab === 'rescue_men' ? '0 4px 14px rgba(216, 67, 21, 0.35)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <Flame size={16} />
          🔥 Rescate de Hombres ({menStats?.total_men?.toLocaleString() || '1.116'})
        </button>

        <button
          onClick={() => { setCurrentTab('incomplete_crm'); setPage(1); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: currentTab === 'incomplete_crm' ? 'var(--color-primary, #961500)' : 'var(--bg-card)',
            color: currentTab === 'incomplete_crm' ? '#FFF' : 'var(--text-secondary)',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <ShieldAlert size={16} />
          ⚠️ Fichas Incompletas CRM ({stats?.total_incomplete?.toLocaleString() || '0'})
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* VISTA 1: RESCATE DE HOMBRES (1.116)                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {currentTab === 'rescue_men' && (
        <div>
          {/* KPI Cards Hombres */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 14,
            marginBottom: 24
          }}>
            {/* Total Hombres */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid rgba(255, 107, 53, 0.3)',
              borderRadius: 12, padding: '16px 18px'
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                Hombres por Rescatar
              </span>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#FF6B35', marginTop: 4 }}>
                {loadingMen ? '...' : (menStats?.total_men?.toLocaleString() || '1.116')}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Leads sin entrevista clínica</span>
            </div>

            {/* Bogotá */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: 12, padding: '16px 18px'
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                Bogotá
              </span>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#3B82F6', marginTop: 4 }}>
                {loadingMen ? '...' : (menStats?.c_bogota?.toLocaleString() || '0')}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Candidatos registrados</span>
            </div>

            {/* Medellín */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: 12, padding: '16px 18px'
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                Medellín
              </span>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#10B981', marginTop: 4 }}>
                {loadingMen ? '...' : (menStats?.c_medellin?.toLocaleString() || '0')}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Área metropolitana</span>
            </div>

            {/* Cali */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: 12, padding: '16px 18px'
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                Cali
              </span>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#EC4899', marginTop: 4 }}>
                {loadingMen ? '...' : (menStats?.c_cali?.toLocaleString() || '0')}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Valle del Cauca</span>
            </div>

            {/* Eje Cafetero (Destacado) */}
            <div style={{
              background: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.4)',
              borderRadius: 12, padding: '16px 18px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Coffee size={14} color="#F59E0B" />
                <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700, textTransform: 'uppercase' }}>
                  Eje Cafetero
                </span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#F59E0B', marginTop: 4 }}>
                {loadingMen ? '...' : (menStats?.c_eje_cafetero?.toLocaleString() || '0')}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pereira, Manizales, Armenia</span>
            </div>

            {/* Miami */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: 12, padding: '16px 18px'
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                Miami
              </span>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#8B5CF6', marginTop: 4 }}>
                {loadingMen ? '...' : (menStats?.c_miami?.toLocaleString() || '0')}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Florida & Internacional</span>
            </div>
          </div>

          {/* Filter Bar Rescate */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 14, padding: '16px 20px', marginBottom: 20,
            display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', flex: 1 }}>
              {/* Buscador */}
              <div style={{ position: 'relative', minWidth: 260, flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Buscar por nombre, WhatsApp, email o ID..."
                  value={menSearch}
                  onChange={(e) => { setMenSearch(e.target.value); setMenPage(1); }}
                  style={{
                    width: '100%', padding: '9px 12px 9px 36px',
                    background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                    borderRadius: 8, color: 'var(--text-primary)', fontSize: 13
                  }}
                />
              </div>

              {/* Filtro Ciudad con Eje Cafetero */}
              <div style={{ minWidth: 180 }}>
                <select
                  value={menCityFilter}
                  onChange={(e) => { setMenCityFilter(e.target.value); setMenPage(1); }}
                  style={{
                    width: '100%', padding: '9px 12px',
                    background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                    borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontWeight: 600
                  }}
                >
                  <option value="all">📍 Todas las Ciudades</option>
                  <option value="bogota">Bogotá</option>
                  <option value="medellin">Medellín</option>
                  <option value="cali">Cali</option>
                  <option value="eje_cafetero">☕ Eje Cafetero (Pereira/Man/Arm)</option>
                  <option value="miami">Miami / Florida</option>
                  <option value="otras">Otras Ciudades</option>
                </select>
              </div>

              {/* Filtro Estado de Contacto */}
              <div style={{ minWidth: 160 }}>
                <select
                  value={menStatusFilter}
                  onChange={(e) => { setMenStatusFilter(e.target.value); setMenPage(1); }}
                  style={{
                    width: '100%', padding: '9px 12px',
                    background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                    borderRadius: 8, color: 'var(--text-primary)', fontSize: 13
                  }}
                >
                  <option value="all">⚡ Todos los Estados</option>
                  <option value="PENDIENTE">⏳ Pendiente</option>
                  <option value="CONTACTADO">💬 Contactado</option>
                  <option value="AGENDO">✅ Agendó Cita</option>
                  <option value="DESCARTADO">❌ Descartado</option>
                </select>
              </div>

              {/* Filtro Responsable */}
              <div style={{ minWidth: 150 }}>
                <select
                  value={menRespFilter}
                  onChange={(e) => { setMenRespFilter(e.target.value); setMenPage(1); }}
                  style={{
                    width: '100%', padding: '9px 12px',
                    background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                    borderRadius: 8, color: 'var(--text-primary)', fontSize: 13
                  }}
                >
                  <option value="">Todas las Psicólogas</option>
                  {PSYCHOLOGISTS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {/* Paginador size */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
              <span>Total: <strong style={{ color: 'var(--text-primary)' }}>{menTotal.toLocaleString()}</strong></span>
              <select
                value={menPageSize}
                onChange={(e) => { setMenPageSize(Number(e.target.value)); setMenPage(1); }}
                style={{
                  padding: '6px 10px', background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)', borderRadius: 6,
                  color: 'var(--text-primary)', fontSize: 12
                }}
              >
                <option value="25">25 / pág</option>
                <option value="50">50 / pág</option>
                <option value="100">100 / pág</option>
              </select>
            </div>
          </div>

          {/* Tabla de Hombres */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            {loadingMen ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                <p style={{ margin: 0, fontSize: 14 }}>Cargando leads de hombres...</p>
              </div>
            ) : menList.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={40} color="#10B981" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  No se encontraron candidatos con los filtros seleccionados
                </h3>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
                        Candidato / Registro
                      </th>
                      <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
                        Acción WhatsApp (1 Clic)
                      </th>
                      <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
                        Ciudad
                      </th>
                      <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
                        Edad / Plan
                      </th>
                      <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
                        Responsable
                      </th>
                      <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
                        Estado Contacto
                      </th>
                      <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
                        Notas de Seguimiento
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {menList.map((lead) => {
                      const isUpdating = updatingUserId === lead.user_id
                      const isCopied = copiedMenId === lead.user_id

                      let statusBadgeBg = 'rgba(255,255,255,0.06)'
                      let statusBadgeColor = '#BBB'
                      if (lead.contact_status === 'CONTACTADO') {
                        statusBadgeBg = 'rgba(59, 130, 246, 0.15)'
                        statusBadgeColor = '#60A5FA'
                      } else if (lead.contact_status === 'AGENDO') {
                        statusBadgeBg = 'rgba(16, 185, 129, 0.15)'
                        statusBadgeColor = '#34D399'
                      } else if (lead.contact_status === 'DESCARTADO') {
                        statusBadgeBg = 'rgba(239, 68, 68, 0.15)'
                        statusBadgeColor = '#F87171'
                      }

                      return (
                        <tr
                          key={lead.user_id}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            opacity: isUpdating ? 0.6 : 1,
                            transition: 'background 0.15s'
                          }}
                        >
                          {/* Candidato */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>
                              {lead.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 6, marginTop: 2 }}>
                              <span>ID: #{lead.user_id}</span>
                              {lead.registration_date && <span>• Reg: {lead.registration_date}</span>}
                            </div>
                          </td>

                          {/* WhatsApp Button */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                            {lead.clean_phone ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button
                                  onClick={() => {
                                    window.open(lead.whatsapp_url, '_blank')
                                    if (lead.contact_status === 'PENDIENTE') {
                                      handleUpdateLead(lead.user_id, { contact_status: 'CONTACTADO' })
                                    }
                                  }}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    padding: '7px 12px', borderRadius: 8, border: 'none',
                                    background: '#25D366', color: '#FFF', fontSize: 12, fontWeight: 700,
                                    cursor: 'pointer', boxShadow: '0 2px 8px rgba(37, 211, 102, 0.25)'
                                  }}
                                  title="Abrir chat en WhatsApp con mensaje de agendamiento preformateado"
                                >
                                  <MessageSquare size={14} />
                                  Contactar ({lead.phone})
                                </button>
                                <button
                                  onClick={() => handleCopyMenMessage(lead)}
                                  style={{
                                    padding: '7px 9px', borderRadius: 8,
                                    background: isCopied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.06)',
                                    border: '1px solid var(--border-color)',
                                    color: isCopied ? '#34D399' : 'var(--text-secondary)',
                                    cursor: 'pointer'
                                  }}
                                  title="Copiar mensaje de WhatsApp"
                                >
                                  {isCopied ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                Sin teléfono
                              </span>
                            )}
                          </td>

                          {/* Ciudad */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {lead.city_group === 'Eje Cafetero' && <Coffee size={13} color="#F59E0B" />}
                              <span style={{
                                padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                background: lead.city_group === 'Eje Cafetero' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.06)',
                                color: lead.city_group === 'Eje Cafetero' ? '#F59E0B' : 'var(--text-primary)'
                              }}>
                                {lead.city || 'Bogotá'}
                              </span>
                            </div>
                          </td>

                          {/* Edad / Plan */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                              {lead.age ? `${lead.age} años` : 'Edad no reg.'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              {lead.plan_tier || 'Sin plan'}
                            </div>
                          </td>

                          {/* Responsable Dropdown */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                            <select
                              value={lead.responsable || 'Sin asignar'}
                              onChange={(e) => handleUpdateLead(lead.user_id, { responsable: e.target.value })}
                              style={{
                                padding: '5px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                                background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)', cursor: 'pointer'
                              }}
                            >
                              <option value="Sin asignar">Sin asignar</option>
                              {PSYCHOLOGISTS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </td>

                          {/* Estado Contacto */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                            <select
                              value={lead.contact_status || 'PENDIENTE'}
                              onChange={(e) => handleUpdateLead(lead.user_id, { contact_status: e.target.value })}
                              style={{
                                padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                                background: statusBadgeBg, color: statusBadgeColor,
                                border: `1px solid ${statusBadgeColor}40`, cursor: 'pointer'
                              }}
                            >
                              <option value="PENDIENTE" style={{ background: '#222', color: '#BBB' }}>⏳ PENDIENTE</option>
                              <option value="CONTACTADO" style={{ background: '#222', color: '#60A5FA' }}>💬 CONTACTADO</option>
                              <option value="AGENDO" style={{ background: '#222', color: '#34D399' }}>✅ AGENDÓ CITA</option>
                              <option value="DESCARTADO" style={{ background: '#222', color: '#F87171' }}>❌ DESCARTADO</option>
                            </select>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                              {(lead.interview_no_shows || 0) > 0 && (
                                <span
                                  title={lead.last_no_show_at ? `Última inasistencia: ${lead.last_no_show_at}` : ''}
                                  style={{
                                    padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 800,
                                    background: lead.interview_no_shows >= 3 ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)',
                                    color: lead.interview_no_shows >= 3 ? '#F87171' : '#F59E0B'
                                  }}
                                >
                                  No se presentó {lead.interview_no_shows}/3
                                </span>
                              )}
                              {lead.contact_status !== 'DESCARTADO' && (
                                <button
                                  onClick={() => handleInterviewNoShow(lead)}
                                  disabled={isUpdating}
                                  title="Registrar que no se presentó a la entrevista y enviarle el correo para reprogramar"
                                  style={{
                                    padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)',
                                    color: 'var(--text-secondary)', cursor: isUpdating ? 'not-allowed' : 'pointer'
                                  }}
                                >
                                  🚫 No se presentó
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Notas */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                            <input
                              type="text"
                              defaultValue={lead.contact_notes || ''}
                              placeholder="Agregar nota..."
                              onBlur={(e) => {
                                if (e.target.value !== (lead.contact_notes || '')) {
                                  handleUpdateLead(lead.user_id, { contact_notes: e.target.value })
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.target.blur()
                              }}
                              style={{
                                width: 180, padding: '5px 8px', borderRadius: 6, fontSize: 12,
                                background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                                color: 'var(--text-secondary)'
                              }}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginación Rescate */}
            <div style={{
              padding: '14px 20px', borderTop: '1px solid var(--border-color)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 13, color: 'var(--text-secondary)'
            }}>
              <div>
                Página <strong style={{ color: 'var(--text-primary)' }}>{menPage}</strong> de <strong style={{ color: 'var(--text-primary)' }}>{menTotalPages}</strong> ({menTotal.toLocaleString()} hombres)
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setMenPage(p => Math.max(1, p - 1))}
                  disabled={menPage <= 1}
                  className="btn btn-ghost"
                  style={{ padding: '6px 12px', fontSize: 12, opacity: menPage <= 1 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Anterior
                </button>
                <button
                  onClick={() => setMenPage(p => Math.min(menTotalPages, p + 1))}
                  disabled={menPage >= menTotalPages}
                  className="btn btn-ghost"
                  style={{ padding: '6px 12px', fontSize: 12, opacity: menPage >= menTotalPages ? 0.4 : 1 }}
                >
                  Siguiente
                  <ChevronRight size={14} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* VISTA 2: FICHAS INCOMPLETAS CRM (VISTA EXISTENTE)                     */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {currentTab === 'incomplete_crm' && (
        <div>
          {/* KPI Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginBottom: 28
          }}>
            {/* Total Incompletos */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(234, 153, 153, 0.25)',
              borderRadius: 14,
              padding: 20,
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Bloqueados del Motor
                </span>
                <span style={{
                  background: 'rgba(234, 153, 153, 0.15)',
                  color: '#ff6b6b',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700
                }}>
                  {stats?.total_users ? `${Math.round((stats.total_incomplete / stats.total_users) * 100)}%` : '...'}
                </span>
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#ff6b6b', letterSpacing: '-0.02em' }}>
                {loadingStats ? '...' : (stats?.total_incomplete?.toLocaleString() || '0')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <UserX size={13} />
                Perfiles con datos críticos vacíos
              </div>
            </div>

            {/* Con Plan Pagado (Alta Prioridad) */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(255, 145, 0, 0.3)',
              borderRadius: 14,
              padding: 20,
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Con Plan (Urgentes)
                </span>
                <span style={{
                  background: 'rgba(255, 145, 0, 0.15)',
                  color: '#FF9100',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <Flame size={12} /> Máxima Prioridad
                </span>
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#FF9100', letterSpacing: '-0.02em' }}>
                {loadingStats ? '...' : (stats?.incomplete_with_plan?.toLocaleString() || '0')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                Clientes que pagaron y requieren completar ficha
              </div>
            </div>

            {/* 100% Elegibles */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(106, 168, 79, 0.25)',
              borderRadius: 14,
              padding: 20,
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Aptos para Match
                </span>
                <span style={{
                  background: 'rgba(106, 168, 79, 0.15)',
                  color: '#6AA84F',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700
                }}>
                  {stats?.total_users ? `${Math.round((stats.total_complete_eligible / stats.total_users) * 100)}%` : '...'}
                </span>
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#6AA84F', letterSpacing: '-0.02em' }}>
                {loadingStats ? '...' : (stats?.total_complete_eligible?.toLocaleString() || '0')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={13} />
                Fichas 100% completas y recomendables
              </div>
            </div>

            {/* Desglose Rápido */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 14,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 6
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                Faltantes Principales
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Falta Edad:</span>
                <span style={{ fontWeight: 700, color: '#ff6b6b' }}>{stats?.missing_age?.toLocaleString() || '0'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Falta Ciudad:</span>
                <span style={{ fontWeight: 700, color: '#ff6b6b' }}>{stats?.missing_city?.toLocaleString() || '0'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Sin Notas de Entrevista:</span>
                <span style={{ fontWeight: 700, color: '#ff6b6b' }}>{stats?.missing_notes?.toLocaleString() || '0'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Sin Qué busca en Pareja:</span>
                <span style={{ fontWeight: 700, color: '#FF9100' }}>{stats?.missing_search_prefs?.toLocaleString() || '0'}</span>
              </div>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 14,
            padding: '16px 20px',
            marginBottom: 20,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', flex: 1 }}>
              {/* Search */}
              <div style={{ position: 'relative', minWidth: 260, flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Buscar por nombre, celular, email o CRM..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13
                  }}
                />
              </div>

              {/* Missing Field filter */}
              <div style={{ minWidth: 190 }}>
                <select
                  value={missingField}
                  onChange={(e) => { setMissingField(e.target.value); setPage(1); }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13
                  }}
                >
                  <option value="all">🔍 Todos los Incompletos</option>
                  <option value="age">❌ Falta Edad</option>
                  <option value="city">❌ Falta Ciudad</option>
                  <option value="gender">❌ Falta Género</option>
                  <option value="estatura">❌ Falta Estatura</option>
                  <option value="notes">❌ Sin Notas Clínicas</option>
                  <option value="search_prefs">❌ Sin Qué busca en Pareja</option>
                </select>
              </div>

              {/* Plan filter */}
              <div style={{ minWidth: 170 }}>
                <select
                  value={planFilter}
                  onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13
                  }}
                >
                  <option value="all">Todos los Planes</option>
                  <option value="with_plan">🔥 Solo con Plan Pagado</option>
                  <option value="no_plan">Sin Plan Activo</option>
                </select>
              </div>

              {/* Psychologist filter */}
              <div style={{ minWidth: 150 }}>
                <select
                  value={psychologist}
                  onChange={(e) => { setPsychologist(e.target.value); setPage(1); }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13
                  }}
                >
                  <option value="all">Todas las Psicólogas</option>
                  {PSYCHOLOGISTS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                  <option value="Sin asignar">Sin Asignar</option>
                </select>
              </div>
            </div>

            {/* Page size selector & count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              <span>
                Total: <strong style={{ color: 'var(--text-primary)' }}>{totalProfiles.toLocaleString()}</strong>
              </span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                style={{
                  padding: '6px 10px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  fontSize: 12
                }}
              >
                <option value="25">25 / pág</option>
                <option value="50">50 / pág</option>
                <option value="100">100 / pág</option>
              </select>
            </div>
          </div>

          {/* Table Card CRM */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            {loadingProfiles ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                <p style={{ margin: 0, fontSize: 14 }}>Cargando perfiles incompletos...</p>
              </div>
            ) : profiles.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={40} style={{ color: '#6AA84F', margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  ¡No se encontraron perfiles con este filtro!
                </h3>
                <p style={{ fontSize: 13, margin: 0 }}>
                  Todos los clientes bajo estos criterios tienen su información al día o coinciden con la búsqueda.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>
                        Cliente / CRM
                      </th>
                      <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>
                        Plan Adquirido
                      </th>
                      <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>
                        Psicóloga
                      </th>
                      <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>
                        Campos Críticos Faltantes
                      </th>
                      <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>
                        Progreso
                      </th>
                      <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: 11, textAlign: 'right' }}>
                        Acciones de Contacto
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((prof) => {
                      const hasPlan = Boolean(prof.plan_tier)
                      const isCopied = copiedId === prof.user_id

                      return (
                        <tr
                          key={prof.user_id}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            background: hasPlan ? 'rgba(255, 145, 0, 0.03)' : 'transparent',
                            transition: 'background 0.15s'
                          }}
                        >
                          <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: 8,
                                background: hasPlan ? 'rgba(255, 145, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: hasPlan ? '#FF9100' : 'var(--text-secondary)',
                                fontWeight: 700, fontSize: 12
                              }}>
                                {prof.name ? prof.name.charAt(0).toUpperCase() : '?'}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {prof.name}
                                  {hasPlan && (
                                    <span title="Cliente con Plan Pagado Activo" style={{ color: '#FF9100', display: 'inline-flex' }}>
                                      <Flame size={13} />
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 6, marginTop: 2 }}>
                                  <span>ID: #{prof.user_id}</span>
                                  {prof.crm_id && <span>• CRM: {prof.crm_id}</span>}
                                  {prof.city && <span>• {prof.city}</span>}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                            {hasPlan ? (
                              <span style={{
                                background: 'rgba(255, 145, 0, 0.15)',
                                color: '#FF9100',
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 700,
                                display: 'inline-block'
                              }}>
                                {prof.plan_tier}
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                Sin plan activo
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              background: 'var(--bg-base)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-secondary)',
                              fontWeight: 600
                            }}>
                              {prof.responsable || 'Sin asignar'}
                            </span>
                          </td>

                          <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 300 }}>
                              {prof.missing_fields?.map((field, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    background: 'rgba(234, 153, 153, 0.15)',
                                    color: '#ff6b6b',
                                    border: '1px solid rgba(234, 153, 153, 0.3)',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    fontSize: 10,
                                    fontWeight: 600
                                  }}
                                >
                                  {field}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                            <div style={{ width: 100 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                                <span style={{ color: 'var(--text-muted)' }}>Ficha:</span>
                                <span style={{ fontWeight: 700, color: prof.completion_percentage >= 70 ? '#6AA84F' : '#ff6b6b' }}>
                                  {prof.completion_percentage}%
                                </span>
                              </div>
                              <div style={{
                                width: '100%', height: 6,
                                background: 'var(--bg-base)',
                                borderRadius: 3,
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${prof.completion_percentage}%`,
                                  height: '100%',
                                  background: prof.completion_percentage >= 70 ? '#6AA84F' : '#ff6b6b',
                                  borderRadius: 3
                                }} />
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              {prof.whatsapp_url && (
                                <a
                                  href={prof.whatsapp_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    background: '#25D366',
                                    color: '#fff',
                                    padding: '7px 11px',
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    textDecoration: 'none',
                                    boxShadow: '0 2px 8px rgba(37, 211, 102, 0.25)'
                                  }}
                                  title="Abrir chat en WhatsApp con mensaje prediseñado"
                                >
                                  <MessageSquare size={14} />
                                  <span>WhatsApp</span>
                                </a>
                              )}

                              {prof.whatsapp_url && (
                                <button
                                  onClick={() => handleCopyMessage(prof)}
                                  style={{
                                    background: isCopied ? 'rgba(106, 168, 79, 0.2)' : 'var(--bg-base)',
                                    border: '1px solid var(--border-color)',
                                    color: isCopied ? '#6AA84F' : 'var(--text-secondary)',
                                    padding: '7px 9px',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center'
                                  }}
                                  title="Copiar texto del mensaje de WhatsApp al portapapeles"
                                >
                                  {isCopied ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                              )}

                              {prof.crm_url && (
                                <a
                                  href={prof.crm_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    background: 'rgba(150, 21, 0, 0.12)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-secondary)',
                                    padding: '7px 9px',
                                    borderRadius: 8,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    textDecoration: 'none'
                                  }}
                                  title="Abrir ficha en SmartMatchApp CRM"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Footer */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13,
              color: 'var(--text-secondary)'
            }}>
              <div>
                Página <strong style={{ color: 'var(--text-primary)' }}>{page}</strong> de <strong style={{ color: 'var(--text-primary)' }}>{totalPages}</strong> ({totalProfiles.toLocaleString()} perfiles)
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn btn-ghost"
                  style={{ padding: '6px 12px', fontSize: 12, opacity: page <= 1 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="btn btn-ghost"
                  style={{ padding: '6px 12px', fontSize: 12, opacity: page >= totalPages ? 0.4 : 1 }}
                >
                  Siguiente
                  <ChevronRight size={14} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
