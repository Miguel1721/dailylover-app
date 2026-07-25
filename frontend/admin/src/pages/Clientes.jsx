import { useEffect, useState, useCallback } from 'react'
import { Search, Eye, ChevronLeft, ChevronRight, History, User, Heart, MapPin, Briefcase, GraduationCap, Sparkles, BookOpen, UserCheck, Phone, Cake, Ruler, Shield, Smile, Filter } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

const MOTIVACION_BADGES = {
  exploracion: 'badge-blue',
  conexion_profunda: 'badge-red',
  validacion: 'badge-yellow',
  diversion: 'badge-green'
}

const PSYCHOLOGISTS = [
  { id: 'all', label: 'Todas las Psicólogas' },
  { id: 'Ana', label: '👩‍⚕️ Ana (207)' },
  { id: 'Silvana', label: '👩‍⚕️ Silvi / Silvana (51)' },
  { id: 'Manu', label: '👩‍⚕️ Manu (227)' },
  { id: 'Aleja', label: '👩‍⚕️ Aleja (151)' },
  { id: 'Jenn', label: '👩‍⚕️ Jenn (176)' },
  { id: 'Sofi', label: '👩‍⚕️ Sofi (85)' },
  { id: 'Steff', label: '👩‍⚕️ Steff (233)' },
  { id: 'Lau', label: '👩‍⚕️ Lau (264)' },
  { id: 'Mape', label: '👩‍⚕️ Mape / María Paula (376)' }
]

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #961500 0%, #d32f2f 100%)',
  'linear-gradient(135deg, #1976d2 0%, #0288d1 100%)',
  'linear-gradient(135deg, #7b1fa2 0%, #512da8 100%)',
  'linear-gradient(135deg, #388e3c 0%, #00796b 100%)',
  'linear-gradient(135deg, #e64a19 0%, #f57c00 100%)',
  'linear-gradient(135deg, #455a64 0%, #263238 100%)'
]

function getAvatarGradient(id) {
  const index = Math.abs(id || 0) % AVATAR_GRADIENTS.length
  return AVATAR_GRADIENTS[index]
}

function formatExcelDateOrStatus(val) {
  if (!val) return 'Por agendar'
  const str = String(val).trim()
  const num = Number(str)
  if (!isNaN(num) && num > 30000 && num < 70000) {
    const date = new Date((num - 25569) * 86400 * 1000)
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    }
  }
  return str
}

function renderCleanBadges(data) {
  if (!data) return null
  let obj = data
  if (typeof data === 'string') {
    try {
      obj = JSON.parse(data)
    } catch {
      return <span className="badge badge-gray">{data}</span>
    }
  }

  if (typeof obj !== 'object') return <span className="badge badge-gray">{String(obj)}</span>

  const entries = Object.entries(obj).filter(([_, v]) => v !== null && v !== undefined && String(v).trim() !== '')
  if (entries.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {entries.map(([k, v]) => {
        const cleanKey = k.replace(/_/g, ' ').toUpperCase()
        const cleanVal = typeof v === 'object' ? JSON.stringify(v) : String(v)
        return (
          <span key={k} className="badge badge-gray" style={{ fontSize: 11, padding: '4px 10px' }}>
            <strong>{cleanKey}:</strong> {cleanVal}
          </span>
        )
      })}
    </div>
  )
}

function OceanBar({ label, value }) {
  const pct = Math.round((value || 0) * 100)
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pct}%</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ClienteModal({ cliente, token, onClose }) {
  if (!cliente) return null
  const p = cliente.profile || {}
  const ocean = p.ocean || {}
  const [activeTab, setActiveTab] = useState('perfil')
  const [matchHistory, setMatchHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    if (cliente?.name) {
      setLoadingHistory(true)
      const cleanName = cliente.name.trim().toLowerCase()
      fetch(`${API}/api/v1/admin/historical-matches?exact_name=${encodeURIComponent(cliente.name.trim())}&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(d => {
          const raw = d.matches || []
          const strictMatches = raw.filter(m => 
            (m.person_a && m.person_a.trim().toLowerCase() === cleanName) ||
            (m.person_b && m.person_b.trim().toLowerCase() === cleanName)
          )
          setMatchHistory(strictMatches)
        })
        .catch(() => setMatchHistory([]))
        .finally(() => setLoadingHistory(false))
    }
  }, [cliente, token])

  const avatarBg = getAvatarGradient(cliente.id)
  const lifestyleBadges = renderCleanBadges(p.lifestyle)
  const prefsBadges = renderCleanBadges(p.search_preferences)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 700, maxWidth: '95vw', padding: 24 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {cliente.photo_url ? (
              <img
                src={cliente.photo_url}
                alt={cliente.name}
                style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }}
              />
            ) : (
              <div style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: avatarBg,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 22,
                boxShadow: '0 4px 14px rgba(0,0,0,0.3)'
              }}>
                {cliente.name ? cliente.name.charAt(0).toUpperCase() : '?'}
              </div>
            )}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--text-primary)' }}>{cliente.name || 'Sin nombre'}</span>
                {cliente.client_code && (
                  <span style={{
                    background: 'linear-gradient(135deg, #6c3ff5, #a855f7)',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 20,
                    letterSpacing: 1,
                    fontFamily: 'monospace'
                  }}>{cliente.client_code}</span>
                )}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={13} /> {cliente.phone}</span>
                {p.city && <span>📍 {p.city}</span>}
                {p.age && <span>🎂 {p.age} años</span>}
                {p.estatura && <span>📏 {p.estatura}m</span>}
                {cliente.id_number && <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>🪪 CC: {cliente.id_number}</span>}
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Tab Navigation — ORDERED FROM RIGHT TO LEFT (DERECHA A IZQUIERDA) */}
        <div style={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'flex-start', borderBottom: '1px solid var(--border-color)', marginBottom: 20 }}>
          <button
            className="btn btn-ghost"
            style={{
              borderRadius: 0,
              borderBottom: activeTab === 'historial' ? '2px solid var(--color-primary)' : 'none',
              color: activeTab === 'historial' ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              padding: '10px 16px'
            }}
            onClick={() => setActiveTab('historial')}
          >
            <History size={15} style={{ marginRight: 6 }} /> Historial de Matches ({matchHistory.length || '...'})
          </button>

          <button
            className="btn btn-ghost"
            style={{
              borderRadius: 0,
              borderBottom: activeTab === 'perfil' ? '2px solid var(--color-primary)' : 'none',
              color: activeTab === 'perfil' ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              padding: '10px 16px'
            }}
            onClick={() => setActiveTab('perfil')}
          >
            <User size={15} style={{ marginRight: 6 }} /> Perfil Clínico & Hábitos
          </button>
        </div>

        {/* TAB 1: PERFIL CLINICO */}
        {activeTab === 'perfil' && (
          <div style={{ maxHeight: 440, overflowY: 'auto', paddingRight: 6 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 10,
              marginBottom: 16,
              background: 'var(--bg-base)',
              padding: 14,
              borderRadius: 10,
              border: '1px solid var(--border-color)'
            }}>
              {p.responsable && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>PSICÓLOGA ASIGNADA:</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>👩‍⚕️ {p.responsable.replace('MATCHES ', '')}</div>
                </div>
              )}
              {p.occupation && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>PROFESIÓN / ACTIVIDAD:</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>💼 {p.occupation}</div>
                </div>
              )}
              {p.education && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>ESTUDIOS / UNIVERSIDAD:</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>🎓 {p.education}</div>
                </div>
              )}
              {p.love_language && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>LENGUAJE DEL AMOR:</div>
                  <div style={{ fontSize: 13, color: '#FFC107', fontWeight: 600 }}>❤️ {p.love_language}</div>
                </div>
              )}
            </div>

            {p.bio_notes ? (
              <div style={{ background: 'var(--bg-base)', padding: 16, borderRadius: 12, border: '1px solid rgba(150,21,0,0.2)', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <BookOpen size={15} /> EVALUACIÓN & NOTAS CLÍNICAS DE LA PSICÓLOGA:
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  "{p.bio_notes}"
                </div>
              </div>
            ) : (
              <div style={{ background: 'var(--bg-base)', padding: 14, borderRadius: 10, border: '1px solid var(--border-color)', marginBottom: 16, fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={16} /> Este cliente no registra notas clínicas extensas en la ficha.
              </div>
            )}

            {lifestyleBadges && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
                  🌱 Estilo de Vida & Hábitos
                </div>
                {lifestyleBadges}
              </div>
            )}

            {prefsBadges && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
                  🔍 Criterios de Búsqueda
                </div>
                {prefsBadges}
              </div>
            )}

            {ocean && Object.keys(ocean).length > 0 && (
              <div style={{ marginBottom: 16, background: 'var(--bg-base)', padding: 14, borderRadius: 10, border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>
                  📊 Perfil de Personalidad OCEAN
                </div>
                <OceanBar label="Apertura a Experiencias" value={ocean.apertura} />
                <OceanBar label="Responsabilidad & Metas" value={ocean.responsabilidad} />
                <OceanBar label="Extroversión & Sociabilidad" value={ocean.extroversion} />
                <OceanBar label="Amabilidad & Empatía" value={ocean.amabilidad} />
                <OceanBar label="Neuroticismo & Estabilidad" value={ocean.neuroticismo} />
              </div>
            )}
          </div>
        )}

        {/* TAB 2: HISTORIAL DE MATCHES */}
        {activeTab === 'historial' && (
          <div style={{ maxHeight: 440, overflowY: 'auto' }}>
            {loadingHistory ? (
              <div className="empty-state">Cargando citas e historial del cliente...</div>
            ) : matchHistory.length === 0 ? (
              <div className="empty-state">
                <Heart size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px', display: 'block' }} />
                No se encontraron citas pasadas registradas para {cliente.name}.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {matchHistory.map(m => {
                  const cleanStatus = formatExcelDateOrStatus(m.status)
                  const cleanDate = formatExcelDateOrStatus(m.match_date) || 'Fecha no registrada'
                  const isExcelDateStatus = !isNaN(Number(m.status)) && Number(m.status) > 40000

                  return (
                    <div
                      key={m.id}
                      style={{
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 10,
                        padding: 14,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.person_a}</span>
                          {m.code_a && <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#a855f7', fontWeight: 700, background: 'rgba(168,85,247,0.1)', padding: '1px 5px', borderRadius: 6 }}>{m.code_a}</span>}
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>💘</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.person_b}</span>
                          {m.code_b && <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#a855f7', fontWeight: 700, background: 'rgba(168,85,247,0.1)', padding: '1px 5px', borderRadius: 6 }}>{m.code_b}</span>}
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <span>📅 {isExcelDateStatus ? cleanStatus : cleanDate}</span>
                          <span>👩‍⚕️ Psicóloga: {m.matchmaker?.replace('MATCHES ', '') || 'Sistema'}</span>
                          {m.city && <span>📍 {m.city}</span>}
                        </div>

                        {m.observations && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', padding: 6, borderRadius: 6 }}>
                            💬 "{m.observations}"
                          </div>
                        )}
                      </div>

                      <span className={`badge ${
                        cleanStatus?.includes('APROBADO') ? 'badge-green' :
                        cleanStatus?.includes('RECHAZADO') ? 'badge-red' :
                        cleanStatus?.includes('TROUBLE') ? 'badge-red' : 'badge-yellow'
                      }`}>
                        {isExcelDateStatus ? 'REGISTRADO' : cleanStatus}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Cliente ID: #{cliente.id}</span>
          <span>Registrado: {new Date(cliente.created_at).toLocaleDateString('es-CO')}</span>
        </div>
      </div>
    </div>
  )
}

export default function Clientes() {
  const { user, token } = useAuth()
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [psychologistFilter, setPsychologistFilter] = useState('all')
  const [notesFilter, setNotesFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [matchesFilter, setMatchesFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const limit = 20

  useEffect(() => {
    const handleUrlSearch = () => {
      const q = new URLSearchParams(window.location.search).get('q')
      if (q) {
        setSearch(q)
        setPage(1)
      }
    }
    handleUrlSearch()
    window.addEventListener('popstate', handleUrlSearch)
    return () => window.removeEventListener('popstate', handleUrlSearch)
  }, [])

  const fetchUsers = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page,
      limit,
      ...(search && { search }),
      ...(psychologistFilter !== 'all' && { responsable: psychologistFilter }),
      ...(notesFilter !== 'all' && { has_notes: notesFilter }),
      ...(cityFilter !== 'all' && { city: cityFilter }),
      ...(matchesFilter !== 'all' && { has_matches: matchesFilter })
    })

    fetch(`${API}/api/v1/admin/users?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        setUsers(d.users || [])
        setTotal(d.total || 0)
      })
      .catch(() => {
        setUsers([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [page, search, psychologistFilter, notesFilter, cityFilter, matchesFilter, token])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handlePsychologistChange = (val) => {
    setPsychologistFilter(val)
    // Auto-reset secondary filters so picking a psychologist ALWAYS shows her full client list immediately!
    setNotesFilter('all')
    setCityFilter('all')
    setMatchesFilter('all')
    setPage(1)
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Clientes Daily Lover</h1>
          <p className="page-subtitle">Expedientes clínicos reales de clientes ({total} clientes encontrados)</p>
        </div>
      </div>

      <div className="content-area">
        {/* Multidimensional Filters Control Bar — SINGLE HORIZONTAL LINE FROM RIGHT TO LEFT (DERECHA A IZQUIERDA) */}
        <div style={{
          display: 'flex',
          gap: 10,
          marginBottom: 20,
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-card)',
          padding: '12px 16px',
          borderRadius: 12,
          border: '1px solid var(--border-color)',
          flexWrap: 'nowrap',
          overflowX: 'auto'
        }}>
          
          {/* Left side: Search input */}
          <div style={{ position: 'relative', flex: '1 1 280px', minWidth: 220 }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }}
            />
            <input
              className="search-bar"
              style={{ paddingLeft: 36, width: '100%', height: 38, fontSize: 13 }}
              placeholder="Buscar cliente por nombre o teléfono..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>

          {/* Right side: 4 Filter Dropdowns arranged from RIGHT TO LEFT */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, flexDirection: 'row-reverse' }}>
            
            {/* Filter 1 (Far Right): Psicóloga Responsable */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                style={{
                  padding: '8px 12px',
                  fontSize: 13,
                  width: 'auto',
                  minWidth: 170,
                  height: 38,
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: 8,
                  fontWeight: 600
                }}
                value={psychologistFilter}
                onChange={e => handlePsychologistChange(e.target.value)}
              >
                {PSYCHOLOGISTS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Filter 2: Clinical Bio Notes */}
            <select
              style={{
                padding: '8px 12px',
                fontSize: 13,
                width: 'auto',
                minWidth: 160,
                height: 38,
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: 8
              }}
              value={notesFilter}
              onChange={e => { setNotesFilter(e.target.value); setPage(1) }}
            >
              <option value="all">Todas las Evaluaciones</option>
              <option value="with_notes">🧠 Con Bio Clínica (134)</option>
              <option value="without_notes">📋 En Lista de Espera</option>
            </select>

            {/* Filter 3: City */}
            <select
              style={{
                padding: '8px 12px',
                fontSize: 13,
                width: 'auto',
                minWidth: 130,
                height: 38,
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: 8
              }}
              value={cityFilter}
              onChange={e => { setCityFilter(e.target.value); setPage(1) }}
            >
              <option value="all">Todas las Ciudades</option>
              <option value="Bogotá">📍 Bogotá</option>
              <option value="Medellín">📍 Medellín</option>
            </select>

            {/* Filter 4: History of Matches */}
            <select
              style={{
                padding: '8px 12px',
                fontSize: 13,
                width: 'auto',
                minWidth: 140,
                height: 38,
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: 8
              }}
              value={matchesFilter}
              onChange={e => { setMatchesFilter(e.target.value); setPage(1) }}
            >
              <option value="all">Todos Historiales</option>
              <option value="with_matches">💘 Con Citas Previas</option>
              <option value="without_matches">✨ Listos para 1ra Cita</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="card"><div className="empty-state">Cargando expedientes clínicos con filtros SQL...</div></div>
        ) : users.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              No se encontraron clientes bajo los filtros combinados aplicados.
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16
          }}>
            {users.map(u => {
              const p = u.profile || {}
              const avatarBg = getAvatarGradient(u.id)
              const initials = u.name ? u.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?'
              const bioSnippet = p.bio_notes ? (p.bio_notes.length > 90 ? p.bio_notes.substring(0, 90) + '...' : p.bio_notes) : null

              return (
                <div
                  key={u.id}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    padding: 18
                  }}
                  onClick={() => setSelected(u)}
                >
                  <div>
                    {/* Header: Avatar + Name + Phone */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      {u.photo_url ? (
                        <img
                          src={u.photo_url}
                          alt={u.name}
                          style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: avatarBg,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 16,
                          flexShrink: 0
                        }}>
                          {initials}
                        </div>
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: 700,
                          fontSize: 15,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {u.name || 'Sin nombre'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', display: 'flex', gap: 8, alignItems: 'center' }}>
                          {u.client_code && (
                            <span style={{
                              background: 'linear-gradient(135deg, #6c3ff5, #a855f7)',
                              color: '#fff',
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 10,
                              letterSpacing: 0.5
                            }}>{u.client_code}</span>
                          )}
                          <span>{u.phone}</span>
                        </div>
                      </div>
                    </div>

                    {/* Metadata Badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                      {p.age && (
                        <span className="badge badge-gray" style={{ fontSize: 10 }}>
                          🎂 {p.age} años
                        </span>
                      )}
                      {p.city && (
                        <span className="badge badge-gray" style={{ fontSize: 10 }}>
                          📍 {p.city}
                        </span>
                      )}
                      {p.occupation && (
                        <span className="badge badge-gray" style={{ fontSize: 10 }}>
                          💼 {p.occupation}
                        </span>
                      )}
                      {p.responsable && (
                        <span className="badge badge-red" style={{ fontSize: 10 }}>
                          👩‍⚕️ {p.responsable.replace('MATCHES ', '')}
                        </span>
                      )}
                    </div>

                    {/* Bio Clinical Snippet */}
                    {bioSnippet && (
                      <div style={{
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        background: 'rgba(255,255,255,0.02)',
                        padding: '8px 10px',
                        borderRadius: 6,
                        borderLeft: '2px solid var(--color-primary)',
                        marginBottom: 10,
                        lineHeight: 1.4,
                        fontStyle: 'italic'
                      }}>
                        "{bioSnippet}"
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid rgba(150,21,0,0.1)',
                    paddingTop: 10,
                    marginTop: 6,
                    fontSize: 11,
                    color: 'var(--text-muted)'
                  }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'monospace', color: u.client_code ? '#a855f7' : 'var(--text-muted)', fontWeight: 600 }}>
                        {u.client_code || `#${u.id}`}
                      </span>
                      {u.id_number && <span style={{ color: 'var(--text-muted)' }}>🪪 {u.id_number}</span>}
                    </div>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                      Expediente Clínico &amp; Fit →
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{page} / {totalPages}</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {selected && <ClienteModal cliente={selected} token={token} onClose={() => setSelected(null)} />}
    </div>
  )
}
