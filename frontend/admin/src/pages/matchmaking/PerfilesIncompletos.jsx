import React, { useState, useEffect, useCallback } from 'react'
import { 
  AlertTriangle, PhoneCall, MessageSquare, CheckCircle2, 
  ExternalLink, Search, Filter, RefreshCw, UserX, 
  Flame, ShieldAlert, Sparkles, User, ChevronLeft, ChevronRight,
  HelpCircle, FileText, Check, Copy, ArrowUpDown
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) 
  ? window.location.origin 
  : 'https://daily-lover.agentesia.cloud'

const PSYCHOLOGISTS = [
  'STEFF', 'MAPE', 'SILVI', 'ANA', 'JENN', 'ALEJA', 'MANU', 'LAU', 'SOFI', 'PIA'
]

export default function PerfilesIncompletos() {
  const { token, user } = useAuth()
  
  // Stats
  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)

  // Profiles list
  const [profiles, setProfiles] = useState([])
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [totalProfiles, setTotalProfiles] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Filters
  const [search, setSearch] = useState('')
  const [missingField, setMissingField] = useState('all')
  const [planFilter, setPlanFilter] = useState('all') // 'all', 'with_plan', 'no_plan'
  const [psychologist, setPsychologist] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [copiedId, setCopiedId] = useState(null)

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/incomplete-stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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

  // Fetch profiles
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
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  // Copy WhatsApp message to clipboard helper
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
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(234, 153, 153, 0.15)',
              border: '1px solid rgba(234, 153, 153, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ff6b6b'
            }}>
              <ShieldAlert size={22} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              Fichas Incompletas & Saneamiento
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            Perfiles bloqueados del motor de matches por falta de datos críticos. Contacta con 1 clic por WhatsApp para completar sus fichas y habilitarlos.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => { fetchStats(); fetchProfiles(); }}
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', fontSize: 13 }}
            title="Recargar datos"
          >
            <RefreshCw size={15} className={loadingProfiles ? 'spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

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

      {/* Table Card */}
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
                    Contacto (Celular)
                  </th>
                  <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>
                    Plan & Responsable
                  </th>
                  <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>
                    Completitud
                  </th>
                  <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>
                    Campos Faltantes (Motivo de Bloqueo)
                  </th>
                  <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: 11, textAlign: 'right' }}>
                    Acción de Contacto
                  </th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((prof) => {
                  const hasPlan = prof.plan_tier && prof.plan_tier !== 'Sin plan'
                  const pctColor = prof.completeness_pct >= 70 ? '#6AA84F' : prof.completeness_pct >= 40 ? '#FFD966' : '#ff6b6b'

                  return (
                    <tr 
                      key={prof.user_id} 
                      style={{ 
                        borderBottom: '1px solid rgba(150, 21, 0, 0.08)',
                        background: hasPlan ? 'rgba(255, 145, 0, 0.02)' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                    >
                      {/* Cliente */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: hasPlan ? 'rgba(255, 145, 0, 0.15)' : 'rgba(150, 21, 0, 0.12)',
                            color: hasPlan ? '#FF9100' : 'var(--color-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 700
                          }}>
                            {prof.name ? prof.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
                              {prof.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, fontSize: 12, color: 'var(--text-secondary)' }}>
                              <span>{prof.gender || 'Sin género'}</span>
                              <span>•</span>
                              <span>{prof.age ? `${prof.age} años` : 'Edad ?'}</span>
                              <span>•</span>
                              <span>{prof.city || 'Ciudad ?'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contacto */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                          {prof.phone || 'Sin celular'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {prof.email || 'Sin correo'}
                        </div>
                      </td>

                      {/* Plan & Responsable */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                          {hasPlan ? (
                            <span style={{
                              background: 'rgba(255, 145, 0, 0.15)',
                              color: '#FF9100',
                              border: '1px solid rgba(255, 145, 0, 0.3)',
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700
                            }}>
                              ⭐ {prof.plan_tier}
                            </span>
                          ) : (
                            <span style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              color: 'var(--text-muted)',
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontSize: 11
                            }}>
                              Sin Plan
                            </span>
                          )}
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            Psic: <strong>{prof.responsable || 'Sin asignar'}</strong>
                          </span>
                        </div>
                      </td>

                      {/* Completitud */}
                      <td style={{ padding: '14px 16px', minWidth: 120 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              width: `${prof.completeness_pct}%`,
                              height: '100%',
                              background: pctColor,
                              borderRadius: 3
                            }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: pctColor }}>
                            {prof.completeness_pct}%
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                          {prof.missing_fields.length} datos por llenar
                        </div>
                      </td>

                      {/* Badges de Faltantes */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {prof.missing_fields.map((mf, i) => (
                            <span
                              key={i}
                              style={{
                                background: 'rgba(234, 153, 153, 0.12)',
                                color: '#EA9999',
                                border: '1px solid rgba(234, 153, 153, 0.25)',
                                padding: '2px 7px',
                                borderRadius: 5,
                                fontSize: 10,
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3
                              }}
                            >
                              <AlertTriangle size={10} />
                              {mf}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Acciones */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                          {/* Botón WhatsApp 1-Clic */}
                          {prof.whatsapp_url ? (
                            <a
                              href={prof.whatsapp_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                background: '#25D366',
                                color: '#000',
                                padding: '7px 12px',
                                borderRadius: 8,
                                fontWeight: 700,
                                fontSize: 12,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                textDecoration: 'none',
                                transition: 'all 0.2s',
                                boxShadow: '0 2px 8px rgba(37, 211, 102, 0.25)'
                              }}
                              title="Abrir WhatsApp Web con mensaje personalizado prellenado"
                            >
                              <MessageSquare size={14} />
                              Pedir Datos
                            </a>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sin tel</span>
                          )}

                          {/* Copiar mensaje */}
                          {prof.whatsapp_url && (
                            <button
                              onClick={() => handleCopyMessage(prof)}
                              style={{
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid var(--border-color)',
                                color: copiedId === prof.user_id ? '#6AA84F' : 'var(--text-secondary)',
                                padding: '7px 9px',
                                borderRadius: 8,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              title="Copiar mensaje de WhatsApp"
                            >
                              {copiedId === prof.user_id ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          )}

                          {/* Enlace CRM */}
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
  )
}
