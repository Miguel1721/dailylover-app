import { useEffect, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Search, Eye, ChevronLeft, ChevronRight, History, User, Heart, MapPin, Briefcase, GraduationCap, Sparkles, BookOpen, UserCheck, Phone, Cake, Ruler, Shield, Smile, Filter, CheckCircle, ExternalLink, UserX, Crown, Calendar } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import ClinicalNotesViewer from '../components/ClinicalNotesViewer'
import NuevoClienteExpresModal from '../components/NuevoClienteExpresModal'
import RegistrarNovedadModal from '../components/RegistrarNovedadModal'
import DarDeBajaModal from '../components/DarDeBajaModal'
import CrmPersonLink, { getSmartMatchAppUrl } from '../components/CrmPersonLink'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

const MOTIVACION_BADGES = {
  exploracion: 'badge-blue',
  conexion_profunda: 'badge-red',
  validacion: 'badge-yellow',
  diversion: 'badge-green'
}

const PSYCHOLOGISTS = [
  { id: 'all', label: 'Todas las Psicólogas' },
  { id: 'Ana', label: '👩‍⚕️ Ana' },
  { id: 'Silvana', label: '👩‍⚕️ Silvi / Silvana' },
  { id: 'Manu', label: '👩‍⚕️ Manu' },
  { id: 'Aleja', label: '👩‍⚕️ Aleja' },
  { id: 'Jenn', label: '👩‍⚕️ Jenn' },
  { id: 'Sofi', label: '👩‍⚕️ Sofi' },
  { id: 'Steff', label: '👩‍⚕️ Steffy' },
  { id: 'Pia', label: '👩‍⚕️ Pia' },
  { id: 'Isa', label: '👩‍⚕️ Isa' },
  { id: 'Mape', label: '👩‍⚕️ Mape / María Paula' }
]

// Planes de membresía
const PLANS = [
  { id: 'all',       label: 'Todos los Planes',      icon: '📋', color: null },
  { id: 'sin_plan',  label: '⚠️ Sin Plan Asignado',   icon: '⚠️', color: '#888' },
  { id: '195',       label: '👑 VIP 195k',            icon: '👑', color: '#FFD700', bg: 'rgba(255,215,0,0.15)' },
  { id: '150',       label: '💎 Premium 150k',        icon: '💎', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
  { id: '98',        label: '⭐ Estándar Plus 98k',   icon: '⭐', color: '#FF5A36', bg: 'rgba(255,90,54,0.15)' },
  { id: '65',        label: '🔵 Estándar 65k',        icon: '🔵', color: '#2196F3', bg: 'rgba(33,150,243,0.15)' },
  { id: '40',        label: '🟢 Básico 40k',          icon: '🟢', color: '#4CAF50', bg: 'rgba(76,175,80,0.15)' },
]




function getPlanStyle(planTier) {
  if (!planTier) return { icon: '📋', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)', label: 'Sin plan', maxCitas: 1 }
  const t = String(planTier).trim()
  if (t.includes('195')) return { icon: '👑', color: '#FFD700', bg: 'rgba(255,215,0,0.15)', label: t, maxCitas: 5 }
  if (t.includes('150')) return { icon: '💎', color: '#a855f7', bg: 'rgba(168,85,247,0.15)', label: t, maxCitas: 3 }
  if (t.includes('98'))  return { icon: '⭐', color: '#FF5A36', bg: 'rgba(255,90,54,0.15)',  label: t, maxCitas: 2 }
  if (t.includes('65'))  return { icon: '🔵', color: '#2196F3', bg: 'rgba(33,150,243,0.15)', label: t, maxCitas: 1 }
  if (t.includes('40'))  return { icon: '🟢', color: '#4CAF50', bg: 'rgba(76,175,80,0.15)',  label: t, maxCitas: 1 }
  if (t.toLowerCase().includes('vip')) return { icon: '👑', color: '#FFD700', bg: 'rgba(255,215,0,0.15)', label: t, maxCitas: 5 }
  if (t.toLowerCase().includes('premium')) return { icon: '💎', color: '#a855f7', bg: 'rgba(168,85,247,0.15)', label: t, maxCitas: 3 }
  return { icon: '📋', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)', label: t, maxCitas: 1 }
}

function formatClinicalValue(val, fallback = 'No especificada') {
  if (val === null || val === undefined || val === '') return fallback
  if (typeof val === 'string' || typeof val === 'number') return String(val)
  if (typeof val === 'object') {
    if (val.style || val.estilo) {
      const parts = [val.style || val.estilo]
      if (val.temperament) parts.push(val.temperament)
      if (val.love_language) parts.push(val.love_language)
      return parts.join(' • ')
    }
    if (val.label || val.name) return val.label || val.name
    const values = Object.values(val).filter(v => typeof v === 'string' || typeof v === 'number')
    if (values.length > 0) return values.join(' • ')
  }
  return fallback
}



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

  const entries = Object.entries(obj).filter(([k, v]) => {
    if (v === null || v === undefined || String(v).trim() === '') return false
    const keyUpper = k.toUpperCase()
    if (keyUpper.includes('ACCEPTED') || keyUpper.includes('TERMS') || keyUpper.includes('DATE') || keyUpper.includes('TOKEN')) return false
    return true
  })
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

function ClienteModal({ cliente, token, onClose, onDarDeBaja, onReactivate }) {
  if (!cliente) return null
  const [activeTab, setActiveTab] = useState('perfil')
  const [fullProfile, setFullProfile] = useState(cliente)
  const [matchHistory, setMatchHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)

  const [reassigning, setReassigning] = useState(false)
  const [newPsyc, setNewPsyc] = useState('AUTO')
  const [reassignReason, setReassignReason] = useState('')
  const [reassignMsg, setReassignMsg] = useState(null)

  const handleReassign = () => {
    const targetId = fullProfile?.id || cliente?.id
    if (!targetId) return
    setReassigning(true)
    setReassignMsg(null)
    fetch(`${API}/api/v1/admin/users/${targetId}/reassign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ new_responsable: newPsyc, reason: reassignReason || 'Re-asignación de caso' })
    })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setReassignMsg(`✅ ${d.message}`)
          setFullProfile(prev => ({ ...prev, profile: { ...(prev?.profile || {}), responsable: d.new_responsable } }))
        } else {
          alert(d.detail || 'Error re-asignando cliente')
        }
      })
      .catch(() => alert('Error enviando la re-asignación'))
      .finally(() => setReassigning(false))
  }


  // 1. Cargar perfil clínico completo unificado (igual a Matching.jsx)
  useEffect(() => {
    if (cliente?.name) {
      setLoadingProfile(true)
      fetch(`${API}/api/v1/admin/users?search=${encodeURIComponent(cliente.name.trim())}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(d => {
          const found = (d.users || []).find(u => u.id === cliente.id) || (d.users || [])[0]
          if (found) {
            setFullProfile(found)
          }
        })
        .catch(() => {})
        .finally(() => setLoadingProfile(false))
    }
  }, [cliente, token])

  // 2. Cargar historial de citas estrictamente por user_id, client_code o nombre exacto (evita mezclar homónimos)
  useEffect(() => {
    if (cliente) {
      setLoadingHistory(true)
      const queryParam = cliente.id
        ? `user_id=${cliente.id}`
        : (cliente.client_code ? `client_code=${encodeURIComponent(cliente.client_code)}` : `exact_name=${encodeURIComponent(cliente.name?.trim() || '')}`)

      fetch(`${API}/api/v1/admin/historical-matches?${queryParam}&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(d => {
          setMatchHistory(d.matches || [])
        })
        .catch(() => setMatchHistory([]))
        .finally(() => setLoadingHistory(false))
    }
  }, [cliente, token])


  const targetClient = fullProfile || cliente
  const p = targetClient.profile || {}
  const ocean = p.ocean || {}

  const avatarBg = getAvatarGradient(targetClient.id || cliente.id)
  const lifestyleBadges = renderCleanBadges(p.lifestyle)
  const prefsBadges = renderCleanBadges(p.search_preferences)


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 750, maxWidth: '95vw', padding: 24, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* Header Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
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
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {cliente.name}
                {cliente.client_code && (
                  <span style={{
                    background: 'linear-gradient(135deg, #6c3ff5, #a855f7)',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12
                  }}>{cliente.client_code}</span>
                )}
                <a
                  href={getSmartMatchAppUrl(cliente.name, cliente.crm_id || fullProfile?.crm_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'rgba(184, 50, 79, 0.15)',
                    color: '#B8324F',
                    border: '1px solid rgba(184, 50, 79, 0.35)',
                    borderRadius: 8,
                    padding: '3px 8px',
                    fontSize: 11.5,
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                  title="Abrir perfil completo en SmartMatchApp CRM"
                >
                  🔗 CRM #{cliente.crm_id || fullProfile?.crm_id || 'Buscar'} <ExternalLink size={11} />
                </a>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {cliente.phone && <span>📞 {cliente.phone}</span>}
                {p.city && <span>📍 {p.city}</span>}
                {p.age && <span>🎂 {p.age} años</span>}
                {p.estatura && <span>📏 {p.estatura}m</span>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {targetClient.status === 'baja' ? (
              <button
                className="btn btn-sm"
                style={{ background: '#10B981', color: '#fff', border: 'none', fontWeight: 700, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}
                onClick={() => onReactivate && onReactivate(targetClient)}
              >
                ✅ Reactivar
              </button>
            ) : (
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.08)', fontWeight: 700, padding: '5px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                onClick={() => onDarDeBaja && onDarDeBaja(targetClient)}
                title="Dar de baja a este cliente"
              >
                <UserX size={13} /> Dar de Baja
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: 16, padding: '4px 10px' }}>✕</button>
          </div>
        </div>

        {/* Banner de Baja si aplica */}
        {targetClient.status === 'baja' && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ color: '#EF4444', fontWeight: 800, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserX size={15} /> CLIENTE DADO DE BAJA DEL SISTEMA
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Motivo: <strong>{targetClient.deactivation_reason || 'No especificado'}</strong>
                {targetClient.deactivated_at && ` • Fecha: ${new Date(targetClient.deactivated_at).toLocaleDateString('es-CO')}`}
              </div>
              {targetClient.deactivation_notes && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                  "{targetClient.deactivation_notes}"
                </div>
              )}
            </div>
            <button
              className="btn btn-sm"
              style={{ background: '#10B981', color: '#fff', border: 'none', fontWeight: 700, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}
              onClick={() => onReactivate && onReactivate(targetClient)}
            >
              ✅ Reactivar
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 16 }}>
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
            <History size={15} style={{ marginRight: 6 }} /> Historial de Matches ({loadingHistory ? '...' : matchHistory.length})
          </button>

          <button
            className="btn btn-ghost"
            style={{
              borderRadius: 0,
              borderBottom: activeTab === 'plan' ? '2px solid #FFD700' : 'none',
              color: activeTab === 'plan' ? '#FFD700' : 'var(--text-secondary)',
              fontWeight: 700,
              padding: '10px 16px'
            }}
            onClick={() => setActiveTab('plan')}
          >
            💳 Plan & Membresía
          </button>
        </div>


        {/* Scrollable Modal Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
          {/* Re-asignación / Derivación de Cliente */}
          <div style={{ background: 'rgba(150,21,0,0.08)', border: '1px solid rgba(150,21,0,0.25)', borderRadius: 10, padding: 12, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🔄 <strong>Derivar / Pasar este Caso a:</strong></span>
              <select
                value={newPsyc}
                onChange={e => setNewPsyc(e.target.value)}
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px 10px', borderRadius: 6, fontSize: 12 }}
              >
                <option value="AUTO">⚡ Auto (Siguiente con menor carga)</option>
                <option value="Silvi">Silvi</option>
                <option value="Steffy">Steffy</option>
                <option value="Manu">Manu</option>
                <option value="María Paula">María Paula (MAPE)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, flex: 1, maxWidth: 400 }}>
              <input
                type="text"
                placeholder="Motivo de derivación (ej: tiempo, afinidad)..."
                value={reassignReason}
                onChange={e => setReassignReason(e.target.value)}
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px 10px', borderRadius: 6, fontSize: 12, flex: 1 }}
              />
              <button
                className="btn btn-primary btn-sm"
                disabled={reassigning}
                onClick={handleReassign}
                style={{ fontSize: 12, padding: '5px 12px', whiteSpace: 'nowrap' }}
              >
                {reassigning ? 'Derivando...' : 'Re-asignar Caso'}
              </button>
            </div>
          </div>
          {reassignMsg && <div style={{ fontSize: 12, color: '#4CAF50', marginBottom: 16, fontWeight: 600 }}>{reassignMsg}</div>}



        {/* TAB 1: PERFIL CLINICO COMPLETO */}
        {activeTab === 'perfil' && (
          <div>

            {/* GRID CLINICO MULTIDIMENSIONAL */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              marginBottom: 16,
              background: 'var(--bg-base)',
              padding: 16,
              borderRadius: 12,
              border: '1px solid var(--border-color)'
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>👩‍⚕️ PSICÓLOGA ASIGNADA:</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>{(p.responsable || targetClient.responsable || 'SILVI').replace('MATCHES ', '')}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>📍 CIUDAD DE RESIDENCIA:</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.city || targetClient.city || 'Bogotá'}</div>
              </div>


              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>🎂 EDAD / GRUPO ETARIO:</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.age || targetClient.age || '28'} años</div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>💼 PROFESIÓN / OCUPACIÓN:</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.occupation || targetClient.occupation || 'No especificada'}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>🎓 ESTUDIOS / UNIVERSIDAD:</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.education || targetClient.education || 'No especificada'}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>📏 ESTATURA:</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{p.estatura || targetClient.estatura || 'No especificada'}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>❤️ LENGUAJE DEL AMOR:</div>
                <div style={{ fontSize: 13, color: '#FFC107', fontWeight: 600 }}>
                  {formatClinicalValue(p.love_language || (typeof p.apego === 'object' && p.apego?.love_language) || targetClient.love_language, 'Palabras de afirmación / Tiempo de calidad')}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>🧠 ESTILO DE APEGO:</div>
                <div style={{ fontSize: 13, color: '#4CAF50', fontWeight: 600 }}>
                  {formatClinicalValue(p.apego, 'Seguro / Constructivo')}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>🎯 MOTIVACIÓN PRINCIPAL:</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {formatClinicalValue(p.motivacion, 'Conexión profunda & proyecto de vida')}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>⚡ ENERGÍA SOCIAL & ROL:</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {formatClinicalValue(p.energia_social, 'Ambivertido')} • {formatClinicalValue(p.rol_social, 'Equilibrado')}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>⛪ RELIGIÓN / VALORES:</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {formatClinicalValue(p.religion || targetClient.religion, 'No especificada')}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>⏳ MOMENTO VITAL:</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {formatClinicalValue(p.momento_vital, 'Buscando relación estable a largo plazo')}
                </div>
              </div>
            </div>


            <div style={{ marginBottom: 16 }}>
              <ClinicalNotesViewer
                notes={p.bio_notes}
                title="Evaluación & Notas Clínicas de la Psicóloga"
              />
            </div>

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

        {/* TAB 2: HISTORIAL DE MATCHES & CITAS REALIZADAS */}
        {activeTab === 'historial' && (
          <div>
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
                  const cleanDate = formatExcelDateOrStatus(m.match_date) || 'Cita Realizada'
                  const isExcelDateStatus = !isNaN(Number(m.status)) && Number(m.status) > 40000

                  // Limpiar sugerencias previas genéricas del formulario inicial para reemplazarlas por feedback post-cita real
                  const rawObs = m.observations || ''
                  const isFormulaicSuggestion = rawObs.includes('Sugerencia estricta basada en formulario') || rawObs.includes('Propuesta Formulario')
                  const postFeedback = m.post_date_notes || m.feedback || (!isFormulaicSuggestion ? rawObs : null)

                  return (
                    <div
                      key={m.id}
                      style={{
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 10,
                        padding: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{m.person_a}</span>
                          {m.code_a && <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#a855f7', fontWeight: 700, background: 'rgba(168,85,247,0.1)', padding: '1px 5px', borderRadius: 6 }}>{m.code_a}</span>}
                          <span style={{ fontSize: 12, color: 'var(--color-primary)' }}>💘</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{m.person_b}</span>
                          {m.code_b && <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#a855f7', fontWeight: 700, background: 'rgba(168,85,247,0.1)', padding: '1px 5px', borderRadius: 6 }}>{m.code_b}</span>}
                        </div>

                        <span className="badge badge-green" style={{ fontSize: 11 }}>
                          {isExcelDateStatus
                            ? `📅 ${cleanStatus}`
                            : (cleanStatus?.includes('SUGERIDO') || cleanStatus?.includes('FORMULARIO') || cleanStatus?.includes('APROBADO')
                                ? '🟢 Cita Realizada'
                                : cleanStatus)}
                        </span>
                      </div>


                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        <span>📅 {cleanDate !== 'Por agendar' ? cleanDate : (isExcelDateStatus ? cleanStatus : 'Fecha efectuada en historial')}</span>
                        <span>👩‍⚕️ Psicóloga: {m.matchmaker?.replace('MATCHES ', '') || 'Sistema'}</span>
                        {m.city && <span>📍 {m.city}</span>}
                      </div>


                      {postFeedback ? (
                        <div style={{ fontSize: 12, color: '#F5F0F1', fontStyle: 'italic', background: 'rgba(150, 21, 0, 0.08)', borderLeft: '3px solid var(--color-primary)', padding: '8px 10px', borderRadius: 6, marginTop: 2 }}>
                          📝 <strong>Retroalimentación Post-Cita:</strong> "{postFeedback}"
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          <span>💬 Cita efectuada. Evaluación clínica archivada en expediente.</span>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, borderColor: 'rgba(150,21,0,0.4)', color: 'var(--text-primary)', padding: '3px 8px' }}
                            onClick={() => {
                              fetch(`${API}/api/v1/admin/historical-matches/${m.id}/send-feedback-email`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}` }
                              })
                                .then(r => r.json())
                                .then(d => alert(d.message || 'Encuesta enviada por correo electrónico'))
                                .catch(() => alert('Error enviando la encuesta por correo'))
                            }}
                          >
                            ✉️ Re-enviar Encuesta por Email
                          </button>
                        </div>
                      )}

                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PLAN, MEMBRESÍA & LÍMITES */}
        {activeTab === 'plan' && (
          <div>

            {(() => {
              const tier = p.plan_tier || targetClient.plan_tier
              const ps = getPlanStyle(tier)
              const used = targetClient.total_matches || 0
              const max = ps.maxCitas
              const remaining = Math.max(0, max - used)
              const pct = Math.min(100, Math.round((used / max) * 100))
              const isCompleted = used >= max

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Header Card del Plan */}
                  <div style={{
                    background: `linear-gradient(135deg, ${ps.bg}, rgba(18,13,15,0.9))`,
                    border: `1px solid ${ps.color}55`,
                    borderRadius: 14,
                    padding: 20,
                    boxShadow: `0 4px 20px ${ps.color}15`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                          Plan Contratado Activo
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: ps.color, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{ps.icon}</span>
                          <span>{tier || 'Sin Plan Asignado'}</span>
                        </div>
                      </div>
                      <span className="badge" style={{ background: isCompleted ? 'rgba(255,193,7,0.2)' : 'rgba(76,175,80,0.2)', color: isCompleted ? '#FFC107' : '#4CAF50', border: `1px solid ${isCompleted ? '#FFC10755' : '#4CAF5055'}`, padding: '6px 12px', fontSize: 12, fontWeight: 800 }}>
                        {isCompleted ? '⚠️ CUOTA CUMPLIDA' : '🟢 ACTIVO'}
                      </span>
                    </div>

                    {/* Barra de Consumo de Citas */}
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Consumo de Citas Incluidas:</span>
                        <span style={{ color: isCompleted ? '#FFC107' : ps.color, fontSize: 14 }}>
                          {used} de {max} Citas Realizadas ({pct}%)
                        </span>
                      </div>

                      <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 5, background: isCompleted ? 'linear-gradient(90deg, #FFC107, #FF9800)' : `linear-gradient(90deg, #961500, ${ps.color})`, transition: 'width 0.4s ease' }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                        <span>Realizadas: <strong>{used}</strong></span>
                        <span>Disponibles: <strong style={{ color: remaining === 0 ? '#FFC107' : '#4CAF50' }}>{remaining}</strong></span>
                        <span>Cuota Total: <strong>{max} citas</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Especificaciones y Detalles del Plan */}
                  <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 18 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>📊</span> Especificaciones del Servicio ({tier || 'Básico'})
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🎯 Citas Garantizadas</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{max} Citas Incluidas</div>
                      </div>

                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>👩‍⚕️ Acompañamiento Clínico</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>Psicóloga Dedicada</div>
                      </div>

                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>💳 Método de Pago</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#4CAF50', marginTop: 2 }}>Stripe Automatic</div>
                      </div>
                    </div>
                  </div>

                  {/* Estado de Renovación / Alerta para la Psicóloga */}
                  <div style={{ background: isCompleted ? 'rgba(255,193,7,0.08)' : 'rgba(76,175,80,0.08)', border: `1px solid ${isCompleted ? '#FFC10744' : '#4CAF5044'}`, borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: isCompleted ? '#FFC107' : '#4CAF50', marginBottom: 4 }}>
                      {isCompleted ? '⚠️ Atención Psicóloga (Silvi / Mape / Team):' : '✅ Estado del Cliente:'}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-primary)', margin: 0, lineHeight: '1.5em' }}>
                      {isCompleted
                        ? `El cliente ha utilizado la totalidad de sus ${max} citas contratadas. Al procesar el pago de renovación en Stripe, el sistema resetea automáticamente esta cuota y notifica a su psicóloga.`
                        : `El cliente tiene ${remaining} cita(s) pendiente(s) por programar dentro de su plan activo. El sistema descontará automáticamente cada cita una vez agendada.`
                      }
                    </p>
                  </div>

                </div>
              )
            })()}
          </div>
        )}




        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Cliente ID: #{cliente.id}</span>
          <span>Registrado: {new Date(cliente.created_at).toLocaleDateString('es-CO')}</span>
        </div>
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
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [darDeBajaTarget, setDarDeBajaTarget] = useState(null)
  const [quickCreateMode, setQuickCreateMode] = useState('vip')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showNuevoClienteModal, setShowNuevoClienteModal] = useState(false)
  const [showNovedadModal, setShowNovedadModal] = useState(false)
  const [successBanner, setSuccessBanner] = useState('')
  const limit = 20

  const location = useLocation()

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const q = searchParams.get('q') || searchParams.get('search')
    const urlResp = searchParams.get('responsable')
    if (q) {
      setSearch(q)
      setPage(1)
    }
    if (urlResp) {
      setPsychologistFilter(urlResp)
      setPage(1)
    }
  }, [location.search])

  const handleReactivate = async (targetUser) => {
    if (!window.confirm(`¿Seguro que deseas reactivar al cliente ${targetUser.name}? Volverá a estar disponible para citas y matchmaking.`)) return
    try {
      const res = await fetch(`${API}/api/v1/admin/users/${targetUser.id}/reactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await res.json()
      if (res.ok) {
        setSuccessBanner(data.message || 'Cliente reactivado con éxito')
        setTimeout(() => setSuccessBanner(''), 4000)
        fetchUsers()
        if (selected && selected.id === targetUser.id) {
          setSelected(prev => ({ ...prev, status: 'active', deactivation_reason: null, deactivation_notes: null }))
        }
      } else {
        alert(data.detail || 'Error al reactivar cliente')
      }
    } catch (e) {
      alert('Error de conexión al reactivar cliente')
    }
  }

  const fetchUsers = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page,
      limit,
      ...(search && { search }),
      ...(psychologistFilter !== 'all' && { responsable: psychologistFilter }),
      ...(notesFilter !== 'all' && { has_notes: notesFilter }),
      ...(cityFilter !== 'all' && { city: cityFilter }),
      ...(matchesFilter !== 'all' && { has_matches: matchesFilter }),
      ...(planFilter !== 'all' && { plan_tier: planFilter }),
      ...(difficultFilter !== 'all' && { is_difficult: difficultFilter }),
      ...(statusFilter !== 'all' && { status: statusFilter })
    })

    fetch(`${API}/api/v1/admin/users?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => {
        if (r.status === 401) {
          localStorage.removeItem('dl_token')
          localStorage.removeItem('dl_user')
          window.location.href = '/login'
          return null
        }
        return r.json()
      })
      .then(d => {
        if (!d) return
        const list = d.users || []
        setUsers(list)
        setTotal(d.total || 0)

        // Si venimos con parámetro ?q= o ?search= y hay resultados, abrir automáticamente el expediente del cliente
        const currentParams = new URLSearchParams(location.search)
        const q = currentParams.get('q') || currentParams.get('search')
        if (q && list.length > 0 && !selected) {
          // Coincidencia exacta o por coincidencia parcial
          const exact = list.find(u => u.name && (u.name.toLowerCase() === q.toLowerCase() || u.name.toLowerCase().includes(q.toLowerCase()))) || list[0]
          setSelected(exact)
        }
      })
      .catch(() => {
        setUsers([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [page, search, psychologistFilter, notesFilter, cityFilter, matchesFilter, planFilter, difficultFilter, statusFilter, token])


  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handlePsychologistChange = (val) => {
    setPsychologistFilter(val)
    setPage(1)
  }


  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Clientes Daily Lover</h1>
          <p className="page-subtitle">Expedientes clínicos reales de clientes ({total} clientes encontrados)</p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => setShowNovedadModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#3B82F6',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              borderRadius: 8,
              padding: '9px 15px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Registrar citas extras, cambios de ciudad o novedades de CS"
          >
            📢 + Novedad / Cita Extra
          </button>
          <button
            onClick={() => {
              setQuickCreateMode('vip')
              setShowNuevoClienteModal(true)
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
              color: '#1a1012',
              border: 'none',
              borderRadius: 8,
              padding: '9px 16px',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(255, 215, 0, 0.3)',
              transition: 'all 0.15s ease'
            }}
            title="Registrar cliente VIP directamente en el sistema con código DL"
          >
            <Crown size={15} color="#1a1012" /> + Registrar VIP
          </button>
          <button
            onClick={() => {
              setQuickCreateMode('novip')
              setShowNuevoClienteModal(true)
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '9px 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(150, 21, 0, 0.3)',
              transition: 'all 0.15s ease'
            }}
            title="Agendar cita para cliente No-VIP vía Calendly"
          >
            <Calendar size={15} /> + Agendar Cita (No-VIP)
          </button>
        </div>
      </div>

      {successBanner && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10B981',
          color: '#10B981',
          padding: '10px 16px',
          borderRadius: 8,
          margin: '0 32px 16px',
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <CheckCircle size={16} />
          {successBanner}
        </div>
      )}

      <div className="content-area">
        {/* ── FILTROS (COMPACTO Y ALINEADO HORIZONTALMENTE) ───────────────── */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          border: '1px solid var(--border-color)',
          padding: '10px 14px',
          marginBottom: 20,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          {/* Búsqueda */}
          <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 260 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="search-bar"
              style={{ paddingLeft: 32, width: '100%', height: 36, fontSize: 12 }}
              placeholder="Buscar cliente..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>

          {/* Filtro por Estado: Activo / Baja */}
          <select
            style={{
              padding: '6px 10px', fontSize: 12, height: 36, width: 'fit-content', maxWidth: 'fit-content',
              background: statusFilter === 'baja' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-base)',
              border: statusFilter === 'baja' ? '1px solid #EF4444' : '1px solid var(--border-color)',
              color: statusFilter === 'baja' ? '#EF4444' : 'var(--text-primary)',
              borderRadius: 8, fontWeight: 600, cursor: 'pointer'
            }}
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          >
            <option value="active">🟢 Clientes Activos</option>
            <option value="baja">🚫 Clientes de Baja</option>
            <option value="all">📋 Todos los Estados</option>
          </select>

          {/* Filtro por Plan */}
          <select
            style={{
              padding: '6px 10px', fontSize: 12, height: 36, width: 'fit-content', maxWidth: 'fit-content',
              background: planFilter !== 'all' ? 'rgba(255,215,0,0.1)' : 'var(--bg-base)',
              border: planFilter !== 'all' ? '1px solid #FFD700' : '1px solid var(--border-color)',
              color: planFilter !== 'all' ? '#FFD700' : 'var(--text-primary)',
              borderRadius: 8, fontWeight: planFilter !== 'all' ? 700 : 500,
              cursor: 'pointer'
            }}
            value={planFilter}
            onChange={e => { setPlanFilter(e.target.value); setPage(1) }}
          >
            {PLANS.map(pl => (
              <option key={pl.id} value={pl.id}>{pl.label}</option>
            ))}
          </select>

          {/* Psicóloga Responsable */}
          <select
            style={{ padding: '6px 10px', fontSize: 12, height: 36, width: 'fit-content', maxWidth: 'fit-content', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 8, fontWeight: 600 }}
            value={psychologistFilter}
            onChange={e => handlePsychologistChange(e.target.value)}
          >
            {PSYCHOLOGISTS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>

          {/* Evaluación clínica */}
          <select
            style={{ padding: '6px 10px', fontSize: 12, height: 36, width: 'fit-content', maxWidth: 'fit-content', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 8 }}
            value={notesFilter}
            onChange={e => { setNotesFilter(e.target.value); setPage(1) }}
          >
            <option value="all">Todas las Evaluaciones</option>
            <option value="with_notes">🧠 Con Bio Clínica</option>
            <option value="without_notes">📋 En Lista de Espera</option>
          </select>

          {/* Ciudad */}
          <select
            style={{ padding: '6px 10px', fontSize: 12, height: 36, width: 'fit-content', maxWidth: 'fit-content', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 8 }}
            value={cityFilter}
            onChange={e => { setCityFilter(e.target.value); setPage(1) }}
          >
            <option value="all">Todas las Ciudades</option>
            <option value="Bogotá">📍 Bogotá</option>
            <option value="Medellín">📍 Medellín</option>
          </select>

          {/* Historial de matches */}
          <select
            style={{ padding: '6px 10px', fontSize: 12, height: 36, width: 'fit-content', maxWidth: 'fit-content', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 8 }}
            value={matchesFilter}
            onChange={e => { setMatchesFilter(e.target.value); setPage(1) }}
          >
            <option value="all">Todos Historiales</option>
            <option value="with_matches">💘 Con Citas Previas</option>
            <option value="without_matches">✨ Listos para 1ra Cita</option>
          </select>

          {/* Personas difíciles */}
          <select
            style={{ padding: '6px 10px', fontSize: 12, height: 36, width: 'fit-content', maxWidth: 'fit-content', background: 'var(--bg-base)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 8 }}
            value={difficultFilter}
            onChange={e => { setDifficultFilter(e.target.value); setPage(1) }}
          >
            <option value="all">Todos los Casos</option>
            <option value="difficult_only">⚠️ Casos Complejos / Exigentes</option>
          </select>
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
                      {u.status === 'baja' && (
                        <span className="badge badge-red" style={{ fontSize: 10, background: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                          🚫 DADO DE BAJA: {u.deactivation_reason || 'Inactivo'}
                        </span>
                      )}
                      <CrmPersonLink name={u.name} crmId={u.crm_id} />
                      {u.is_difficult && (
                        <span className="badge badge-yellow" style={{ fontSize: 10, background: 'rgba(255,193,7,0.2)', color: '#FFC107', border: '1px solid rgba(255,193,7,0.4)' }}>
                          ⚠️ Caso Complejo
                        </span>
                      )}
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
                      {(() => {
                        const plan = getPlanStyle(p.plan_tier || u.plan_tier)
                        if (!p.plan_tier && !u.plan_tier) return null
                        const used = u.total_matches || 0
                        const max = plan.maxCitas
                        const isDone = used >= max
                        return (
                          <>
                            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: plan.bg, color: plan.color, border: `1px solid ${plan.color}44` }}>
                              {plan.icon} {plan.label}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: isDone ? 'rgba(255,193,7,0.15)' : 'rgba(255,255,255,0.05)', color: isDone ? '#FFC107' : 'var(--text-secondary)', border: `1px solid ${isDone ? '#FFC10755' : 'rgba(255,255,255,0.1)'}` }}>
                              🎯 {used}/{max} Citas
                            </span>
                          </>
                        )
                      })()}

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
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {u.status === 'baja' ? (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11, borderColor: 'rgba(16, 185, 129, 0.3)', color: '#10B981', padding: '2px 8px' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleReactivate(u)
                          }}
                          title="Reactivar a este cliente"
                        >
                          ✅ Reactivar
                        </button>
                      ) : (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11, borderColor: 'rgba(239, 68, 68, 0.3)', color: '#EF4444', padding: '2px 8px' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setDarDeBajaTarget(u)
                          }}
                          title="Dar de baja a este cliente"
                        >
                          🚫 Dar de Baja
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, borderColor: 'rgba(150,21,0,0.3)', color: 'var(--color-primary)', padding: '2px 8px' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelected(u)
                        }}
                      >
                        🔄 Derivar Caso
                      </button>
                      <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                        Expediente Clínico &amp; Fit →
                      </span>
                    </div>

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

      {selected && (
        <ClienteModal
          cliente={selected}
          token={token}
          onClose={() => setSelected(null)}
          onDarDeBaja={(c) => setDarDeBajaTarget(c)}
          onReactivate={handleReactivate}
        />
      )}

      {darDeBajaTarget && (
        <DarDeBajaModal
          client={darDeBajaTarget}
          onClose={() => setDarDeBajaTarget(null)}
          onSuccess={(msg) => {
            setSuccessBanner(msg)
            setTimeout(() => setSuccessBanner(''), 4000)
            fetchUsers()
            if (selected && selected.id === darDeBajaTarget.id) {
              setSelected(prev => ({
                ...prev,
                status: 'baja',
                deactivation_reason: 'Dado de baja recientemente'
              }))
            }
          }}
        />
      )}

      {showNuevoClienteModal && (
        <NuevoClienteExpresModal
          initialMode={quickCreateMode}
          onClose={() => setShowNuevoClienteModal(false)}
          onSuccess={(msg) => {
            setSuccessBanner(msg)
            setTimeout(() => setSuccessBanner(''), 4000)
            fetchUsers()
          }}
        />
      )}

      {showNovedadModal && (
        <RegistrarNovedadModal
          onClose={() => setShowNovedadModal(false)}
          onSuccess={(msg) => {
            setSuccessBanner(msg)
            setTimeout(() => setSuccessBanner(''), 4000)
            fetchUsers()
          }}
        />
      )}
    </div>
  )
}
