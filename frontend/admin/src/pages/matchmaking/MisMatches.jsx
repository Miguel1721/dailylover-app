import React, { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Heart, Search, Filter, Lock, Plus, CheckCircle, AlertTriangle, RefreshCw,
  User, MapPin, Tag, ShieldCheck, History, ExternalLink, AlertCircle, X, Check,
  Clock, ChevronLeft, ChevronRight, Sparkles, FileSpreadsheet, ClipboardList, Brain,
  Phone, MessageSquare, Utensils, Copy, Send, Calendar as CalendarIcon
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import CrmPersonLink from '../../components/CrmPersonLink'
import EntrevistaResultados from './EntrevistaResultados'
import DatosObjetivos from './DatosObjetivos'
import PercepcionPsicologa from './PercepcionPsicologa'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

const CITIES = [
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga',
  'Pereira', 'Cartagena', 'Manizales', 'Santa Marta', 'Miami', 'Madrid'
]

const PLAN_TIERS_LIST = [
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

// PALETA EXACTA SSOT
const PREF_COLORS = {
  hetero: { bg: '#CFE2F3', color: '#1B365D' },
  gay: { bg: '#FCE5CD', color: '#783F04' },
  lesb: { bg: '#D9D2E9', color: '#351C75' },
  bi: { bg: '#D9D9D9', color: '#434343' },
}

const PLAN_COLORS = {
  'Básico 40k': { bg: '#F3F3F3', color: '#434343' },
  'Básico': { bg: '#F3F3F3', color: '#434343' },
  'Estándar 65k (1 cita)': { bg: '#D9EAD3', color: '#274E13' },
  'Estándar 65k (2 citas)': { bg: '#B6D7A8', color: '#274E13' },
  'Estándar Plus 98k': { bg: '#A2C4C9', color: '#134F5C' },
  'Premium': { bg: '#C9DAF8', color: '#1155CC' },
  'Premium 150k': { bg: '#C9DAF8', color: '#1155CC' },
  'VIP 195k': { bg: '#FFE599', color: '#7F6000' },
  'VIP': { bg: '#FFE599', color: '#7F6000' },
  'Matchmaking Experience': { bg: '#D5A6BD', color: '#4C1130' },
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

function formatRelativeTime(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T'))
    if (isNaN(d.getTime())) return ''
    const now = new Date()
    const diffMs = now - d
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays <= 0) return 'hoy'
    if (diffDays === 1) return 'ayer'
    if (diffDays < 30) return `hace ${diffDays}d`
    const diffMonths = Math.floor(diffDays / 30)
    if (diffMonths === 1) return 'hace 1m'
    if (diffMonths < 12) return `hace ${diffMonths}m`
    const diffYears = Math.floor(diffMonths / 12)
    return `hace ${diffYears}a`
  } catch (e) {
    return ''
  }
}

export const STATUS_GROUPS = [
  {
    area: 'Psicólogas (Mesa de Trabajo)',
    icon: '🧠',
    options: [
      'Listo para match',
      'REVISAR',
      'REVISAR POR SI TOCA OTRO MATCH',
      'Urgente',
      'Pendiente',
      'EN ESPERA',
      'NO HAY GENTE',
      'REQUEST PROFILE UPDATE',
      'PENDIENTE PLAN',
    ]
  },
  {
    area: 'Supervisión & Aprobación (María)',
    icon: '🛡️',
    options: [
      'HECHO',
      'HECHO POR MAPE',
      'APROBADO',
      'NOT APPROVED',
    ]
  },
  {
    area: 'Servicio al Cliente & Citas',
    icon: '📞',
    options: [
      'CITA COMPLETADA',
      'MATCH DONE',
      'EN PAUSA',
      'EN PAUSA INDEFINIDA',
    ]
  },
  {
    area: 'Casos Especiales & Refunds (Lina)',
    icon: '💰',
    options: [
      'REFUND',
      'REFUND DONE',
      'DESCALIFICADO',
      'TROUBLE',
      'TROUBLEMAKER',
      'RESUELTO',
    ]
  }
]

const STATUS_OPTIONS = STATUS_GROUPS.flatMap(g => g.options)

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

  const [filterTroubleOnly, setFilterTroubleOnly] = useState(false)

  const isRejectionStatus = (st) => {
    const s = (st || '').toUpperCase()
    return s.includes('TROUBLE') || s.includes('NOT APPROVED') || s.includes('RECHAZ') || s.includes('NO MATCH') || s.includes('SIN QUÍMICA') || s.includes('SIN QUIMICA') || s.includes('DESCALIFICADO') || s.includes('REFUND')
  }

  const matchesList = data?.matches || []
  const filteredMatches = filterTroubleOnly ? matchesList.filter(m => isRejectionStatus(m.status)) : matchesList

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
              {/* Profile Summary & Counters (Paridad Exacta con Google Sheets) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                <div style={{ background: 'var(--bg-base)', border: '1px solid #B6D7A8', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: '#274E13', fontWeight: 700, textTransform: 'uppercase' }}>Completadas</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#274E13', marginTop: 2 }}>{data.completed_count ?? data.dates_completed_count ?? 0}</div>
                </div>
                <div style={{ background: 'var(--bg-base)', border: '1px solid #FF6B35', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: '#C0392B', fontWeight: 700, textTransform: 'uppercase' }}>Rechazos (Trouble)</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#C0392B', marginTop: 2 }}>{data.trouble_count ?? data.rejections_count ?? 0}</div>
                </div>
                <div style={{ background: 'var(--bg-base)', border: '1px solid #A2C4C9', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: '#134F5C', fontWeight: 700, textTransform: 'uppercase' }}>En Proceso</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#134F5C', marginTop: 2 }}>{data.in_progress_count ?? 0}</div>
                </div>
                <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Cerrados</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{data.closed_count ?? 0}</div>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Historial de Matches Anteriores ({data.matches?.length || 0})
                  </h3>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setFilterTroubleOnly(false)}
                      style={{
                        padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: 'pointer',
                        border: !filterTroubleOnly ? '1px solid #961500' : '1px solid var(--border-color)',
                        background: !filterTroubleOnly ? '#961500' : 'var(--bg-base)',
                        color: !filterTroubleOnly ? '#fff' : 'var(--text-secondary)'
                      }}
                    >
                      Todos ({data.matches?.length || 0})
                    </button>
                    <button
                      onClick={() => setFilterTroubleOnly(true)}
                      style={{
                        padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: 'pointer',
                        border: filterTroubleOnly ? '1px solid #FF6B35' : '1px solid rgba(255,107,53,0.3)',
                        background: filterTroubleOnly ? '#FF6B35' : 'rgba(255,107,53,0.12)',
                        color: filterTroubleOnly ? '#fff' : '#ff8a80'
                      }}
                    >
                      ⚠️ Solo Rechazos ({data.trouble_count || data.rejections_count || 0})
                    </button>
                  </div>
                </div>

                {filterTroubleOnly && (
                  <div style={{ background: 'rgba(255,107,53,0.12)', border: '1px solid #FF6B35', color: '#ff8a80', padding: '8px 12px', borderRadius: 6, marginBottom: 10, fontSize: 12, fontWeight: 700 }}>
                    ⚠️ Esta persona registra {filteredMatches.length} rechazos / salidas en el sistema.
                  </div>
                )}

                {filteredMatches.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 12, background: 'var(--bg-base)', borderRadius: 6 }}>
                    {filterTroubleOnly ? 'No registra rechazos ni troublemakers.' : 'No registra otros matches en el sistema.'}
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
                        {filteredMatches.map((m) => (
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

// ─── AUXILIARES DE MENSAJERÍA, FECHAS Y ZONA HORARIA COLOMBIA (UTC-5) ────────
function getColombiaTodayYMD() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date())
  } catch (e) {
    const d = new Date()
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000)
    const colTime = new Date(utc - (5 * 3600000))
    return colTime.toISOString().split('T')[0]
  }
}

function parseMatchDateToYMD(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const s = dateStr.trim()

  // 1. YYYY-MM-DD
  const mYMD = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (mYMD) {
    return mYMD[1] + '-' + String(mYMD[2]).padStart(2, '0') + '-' + String(mYMD[3]).padStart(2, '0')
  }

  // 2. DD/MM/YYYY o DD-MM-YYYY
  const mDMY = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (mDMY) {
    return mDMY[3] + '-' + String(mDMY[2]).padStart(2, '0') + '-' + String(mDMY[1]).padStart(2, '0')
  }

  // 3. MM.DD o MM/DD (asume año 2026)
  const mMD = s.match(/^(\d{1,2})[\.](\d{1,2})/)
  if (mMD) {
    return '2026-' + String(mMD[1]).padStart(2, '0') + '-' + String(mMD[2]).padStart(2, '0')
  }

  // 4. Texto español: 'Septiembre 18', '18 de septiembre', etc.
  const months = {
    enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
    julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
    sep: '09', oct: '10', nov: '11', dic: '12'
  }
  const sLower = s.toLowerCase()
  for (const [mName, mNum] of Object.entries(months)) {
    if (sLower.includes(mName)) {
      const dayMatch = sLower.match(/(\d{1,2})/)
      if (dayMatch) {
        const d = String(dayMatch[1]).padStart(2, '0')
        const yMatch = sLower.match(/(202\d)/)
        const y = yMatch ? yMatch[1] : '2026'
        return y + '-' + mNum + '-' + d
      }
    }
  }

  return null
}

function getWhatsAppButtonStatus(scheduledDateTime) {
  const colombiaToday = getColombiaTodayYMD()
  const matchYMD = parseMatchDateToYMD(scheduledDateTime)

  const canConfirm = true

  if (!matchYMD) {
    return {
      canConfirm: true,
      canDiaAntes: false,
      diaAntesReason: 'Requiere definir fecha de cita para activar (Día Antes)',
      canHoy: false,
      hoyReason: 'Requiere definir fecha de cita para activar (Día de Hoy)',
      colombiaToday,
      matchYMD: null,
      diffDays: null
    }
  }

  const [y1, m1, d1] = colombiaToday.split('-').map(Number)
  const [y2, m2, d2] = matchYMD.split('-').map(Number)
  const utcToday = Date.UTC(y1, m1 - 1, d1)
  const utcMatch = Date.UTC(y2, m2 - 1, d2)
  const diffDays = Math.round((utcMatch - utcToday) / 86400000)

  // canDiaAntes: activo si diffDays === 1 (día antes) o si es hoy (diffDays === 0)
  const canDiaAntes = (diffDays === 1 || diffDays === 0)
  const diaAntesReason = diffDays === 1
    ? '¡Día Antes! Listo para enviar recordatorio previo'
    : diffDays === 0
      ? 'La cita es hoy (Día antes ya transcurrió)'
      : diffDays > 1
        ? `Se activará 1 día antes de la cita (faltan ${diffDays} días)`
        : 'La fecha de la cita ya pasó'

  // canHoy: activo SOLO el mismo día de la cita (diffDays === 0)
  const canHoy = (diffDays === 0)
  const hoyReason = diffDays === 0
    ? '¡HOY es la cita! Listo para enviar recordatorio de puntualidad x2'
    : diffDays > 0
      ? `Se activará el día de la cita (${matchYMD})`
      : 'La fecha de la cita ya pasó'

  return {
    canConfirm,
    canDiaAntes,
    diaAntesReason,
    canHoy,
    hoyReason,
    colombiaToday,
    matchYMD,
    diffDays
  }
}

function formatWhatsAppLink(phone, messageText = '') {
  if (!phone) return null
  let clean = String(phone).replace(/[^0-9]/g, '')
  if (!clean) return null
  if (clean.length === 10 && clean.startsWith('3')) {
    clean = '57' + clean
  }
  const url = `https://wa.me/${clean}`
  return messageText ? `${url}?text=${encodeURIComponent(messageText)}` : url
}

function getCanonicalWhatsAppTemplates({ personA, personB, dateTime, venue, reservationName = 'María Paula Salinas' }) {
  let dateFormatted = 'Por definir'
  let timeFormatted = ''
  if (dateTime && dateTime.trim()) {
    const parts = dateTime.trim().split(' ')
    dateFormatted = parts[0]
    if (parts.length > 1) {
      timeFormatted = parts[1]
    }
  }
  const place = venue && venue.trim() ? venue.trim() : 'Por definir'
  const timeStr = timeFormatted ? ` ${timeFormatted}` : ''

  const confirmacion = `Para confirmarte tu date! 💛 Fecha y hora: ${dateFormatted}${timeStr} en ${place}\nLa reserva estará a nombre de ${reservationName}.\nEl restaurante estará atento para ayudarte a ubicarte y acompañarte con cualquier detalle logístico o de seguridad.\n\nAdemás, ese mismo día en la mañana te escribiremos para estar pendientes de ti y acompañarte *antes, durante y después de la cita*, para que solo tengas que disfrutar la experiencia.💌💌\nGracias por confiar en nosotras y por permitirnos ser parte de este momento💓`

  const diaAntes = `Para recordarte tu date de mañana! 💛 Fecha y hora: ${dateFormatted}${timeStr} en ${place} Esperamos tu confirmación para asegurarnos de que la cita este en pie!`

  const hoy = `Para recordarte tu date de hoy! 💛 Fecha y hora: ${dateFormatted}${timeStr} en ${place}\nLa reserva estará a nombre de ${reservationName}!! Por favor avisanos cuando vayas en camino para estar pendiente de ti! Recuerda que hay alguien que te esta esperando, y la puntualidad vale X2!! Disfrútalo muchísimo, es solo una cita!! Avísanos cuando vayas en camino para estar pendiente de tiii!`

  return { confirmacion, diaAntes, hoy }
}

// ─── MODAL DE PLANTILLAS WHATSAPP ─────────────────────────────────────────────
function WhatsAppTemplateModal({ match, templateType, onClose, onCopy }) {
  const [copied, setCopied] = useState(false)
  const templates = getCanonicalWhatsAppTemplates({
    personA: match.person_a,
    personB: match.person_b,
    dateTime: match.scheduled_date_time,
    venue: match.scheduled_venue,
    reservationName: match.reservation_name || 'María Paula Salinas'
  })

  let title = 'Plantilla de WhatsApp'
  let messageText = ''
  if (templateType === 'confirmacion') {
    title = '📩 Mensaje de Confirmación de Cita'
    messageText = templates.confirmacion
  } else if (templateType === 'dia_antes') {
    title = '⏰ Mensaje Recordatorio: Día Antes'
    messageText = templates.diaAntes
  } else if (templateType === 'hoy') {
    title = '🚀 Mensaje Recordatorio: Día de Hoy (Puntualidad x2)'
    messageText = templates.hoy
  }

  const phoneA = match.person_a_phone
  const phoneB = match.person_b_phone
  const waUrlA = formatWhatsAppLink(phoneA, messageText)
  const waUrlB = formatWhatsAppLink(phoneB, messageText)

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText)
    setCopied(true)
    if (onCopy) onCopy('Mensaje copiado al portapapeles')
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1200, padding: 16
    }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 14,
        border: '1px solid var(--border-color)',
        width: '100%',
        maxWidth: 580,
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(150, 21, 0, 0.08)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={18} color="#10B981" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {title}
              </h3>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Pareja: {match.person_a} & {match.person_b}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          <div style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            padding: 14,
            fontSize: 13,
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
            maxHeight: 260,
            overflowY: 'auto',
            fontFamily: 'monospace'
          }}>
            {messageText}
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              onClick={handleCopy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: copied ? '#10B981' : 'var(--bg-card)',
                color: copied ? '#fff' : 'var(--text-primary)',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Copy size={14} /> {copied ? '¡Copiado!' : 'Copiar Texto'}
            </button>

            {waUrlA ? (
              <a
                href={waUrlA}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 6,
                  background: '#25D366',
                  color: '#fff',
                  fontSize: 12.5,
                  fontWeight: 700,
                  textDecoration: 'none',
                  cursor: 'pointer'
                }}
              >
                <Send size={14} /> Enviar a Persona A ({match.person_a.split(' ')[0]})
              </a>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
                (Sin tel. A)
              </span>
            )}

            {waUrlB ? (
              <a
                href={waUrlB}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 6,
                  background: '#25D366',
                  color: '#fff',
                  fontSize: 12.5,
                  fontWeight: 700,
                  textDecoration: 'none',
                  cursor: 'pointer'
                }}
              >
                <Send size={14} /> Enviar a Persona B ({match.person_b.split(' ')[0]})
              </a>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
                (Sin tel. B)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL DE FILTROS POR PERSONA Y ASIGNACIÓN DE RESTAURANTE ─────────────────
function PersonRestaurantFilterModal({ match, initialTab = 'restaurants', onClose, onSave }) {
  const initialYMD = parseMatchDateToYMD(match?.scheduled_date_time) || ''
  let initialTime = '7:00 PM'
  if (match?.scheduled_date_time) {
    const tMatch = match.scheduled_date_time.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?|\d{1,2}\s*(?:AM|PM|am|pm))/i)
    if (tMatch) initialTime = tMatch[1].toUpperCase()
  }

  const [tab, setTab] = useState(initialTab) // 'person_a' | 'person_b' | 'restaurants'
  const [city, setCity] = useState(match?.city || 'Bogotá')
  const [citaDate, setCitaDate] = useState(initialYMD)
  const [citaTime, setCitaTime] = useState(initialTime)
  const [venue, setVenue] = useState(match?.scheduled_venue || '')
  const [customVenue, setCustomVenue] = useState('')
  const [budgetAgreed, setBudgetAgreed] = useState('200k-300k')
  const [csNotes, setCsNotes] = useState(match?.cs_observations || '')

  // Preferencias persona A
  const [budgetA, setBudgetA] = useState('100k-200k')
  const [zoneA, setZoneA] = useState(match?.person_a_neighborhood || '')
  const [foodA, setFoodA] = useState('')

  // Preferencias persona B
  const [budgetB, setBudgetB] = useState('100k-200k')
  const [zoneB, setZoneB] = useState(match?.person_b_neighborhood || '')
  const [foodB, setFoodB] = useState('')

  // Restaurantes desde API
  const [restaurants, setRestaurants] = useState([])
  const [loadingRest, setLoadingRest] = useState(false)
  const [budgetFilter, setBudgetFilter] = useState('100k-200k')
  const [searchRest, setSearchRest] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let url = `${API}/api/v1/matchmaking/restaurants?`
    if (city && city !== 'all') url += `city=${encodeURIComponent(city)}&`
    if (budgetFilter && budgetFilter !== 'all') url += `budget_category=${encodeURIComponent(budgetFilter)}&`
    if (searchRest) url += `search=${encodeURIComponent(searchRest)}&`

    setLoadingRest(true)
    fetch(url)
      .then(r => r.json())
      .then(d => {
        setRestaurants(d.restaurants || [])
        setLoadingRest(false)
      })
      .catch(() => setLoadingRest(false))
  }, [city, budgetFilter, searchRest])

  const handleSelectRest = (r) => {
    const vName = `${r.name} (${r.zone || r.city})`
    setVenue(vName)
    setCustomVenue('')
    setTab('restaurants')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const finalVenue = customVenue.trim() || venue
    let finalDateTime = ''
    if (citaDate) {
      finalDateTime = citaTime ? `${citaDate} ${citaTime}`.trim() : citaDate
    } else if (match?.scheduled_date_time) {
      finalDateTime = match.scheduled_date_time
    }

    try {
      await onSave({
        date_time: finalDateTime,
        venue: finalVenue,
        city,
        cs_observations: csNotes
      })
      onClose()
    } catch (err) {
      alert('Error al guardar la cita')
    } finally {
      setSaving(false)
    }
  }

  const phoneA = match.person_a_phone
  const phoneB = match.person_b_phone
  const waUrlA = formatWhatsAppLink(phoneA)
  const waUrlB = formatWhatsAppLink(phoneB)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1150, padding: 16
    }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 14,
        border: '1px solid var(--border-color)',
        width: '100%',
        maxWidth: 820,
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
        overflow: 'hidden'
      }}>
        {/* Modal Top */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(150, 21, 0, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Utensils size={18} color="#B8324F" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                Filtros de Restaurante & Coordinación de Cita
              </h3>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Pareja #{match.id}: <strong style={{ color: 'var(--text-primary)' }}>{match.person_a}</strong> y <strong style={{ color: 'var(--text-primary)' }}>{match.person_b}</strong>
            </div>
          </div>

          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Barra Superior con Resumen de Cita visible en TODAS las pestañas */}
        <div style={{
          padding: '10px 20px',
          background: 'var(--bg-base)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 12.5 }}>
            <span>📅 <strong>Día:</strong> <span style={{ color: citaDate ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600 }}>{citaDate || 'Por definir'}</span></span>
            <span>⏰ <strong>Hora:</strong> <span style={{ color: citaTime ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600 }}>{citaTime || 'Por definir'}</span></span>
            <span>📍 <strong>Ciudad:</strong> <span style={{ fontWeight: 600 }}>{city}</span></span>
            <span>🍽️ <strong>Lugar:</strong> <span style={{ color: (venue || customVenue) ? '#10B981' : 'var(--text-muted)', fontWeight: 700 }}>{venue || customVenue || 'Sin restaurante'}</span></span>
          </div>
          <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            🇨🇴 Hora Colombia: {getColombiaTodayYMD()}
          </div>
        </div>

        {/* Tab Buttons */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-card)',
          padding: '0 12px'
        }}>
          <button
            onClick={() => setTab('person_a')}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderBottom: tab === 'person_a' ? '2px solid #B8324F' : '2px solid transparent',
              background: 'transparent',
              color: tab === 'person_a' ? '#B8324F' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            👤 Filtros Persona A ({match.person_a.split(' ')[0]})
          </button>
          <button
            onClick={() => setTab('person_b')}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderBottom: tab === 'person_b' ? '2px solid #B8324F' : '2px solid transparent',
              background: 'transparent',
              color: tab === 'person_b' ? '#B8324F' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            👤 Filtros Persona B ({match.person_b.split(' ')[0]})
          </button>
          <button
            onClick={() => setTab('restaurants')}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderBottom: tab === 'restaurants' ? '2px solid #B8324F' : '2px solid transparent',
              background: 'transparent',
              color: tab === 'restaurants' ? '#B8324F' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Utensils size={14} /> 🍽️ Coordinación de Cita (Día, Hora & Restaurante)
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {/* TAB PERSONA A */}
          {tab === 'person_a' && (
            <div>
              <div style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: 14,
                marginBottom: 16
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Datos de Contacto
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Nombre Completo:</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                      <CrmPersonLink name={match.person_a} crmId={match.person_a_crm_id} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Teléfono Móvil:</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      {phoneA ? (
                        <>
                          <a
                            href={`tel:${phoneA}`}
                            style={{ fontWeight: 700, color: '#60A5FA', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <Phone size={13} /> {phoneA}
                          </a>
                          {waUrlA && (
                            <a
                              href={waUrlA}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                background: '#25D366',
                                color: '#fff',
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                textDecoration: 'none'
                              }}
                            >
                              WhatsApp
                            </a>
                          )}
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No registrado en CRM</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Presupuesto Máximo Persona A
                  </label>
                  <select
                    value={budgetA}
                    onChange={e => setBudgetA(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 6,
                      border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                      color: 'var(--text-primary)', fontSize: 12.5, outline: 'none'
                    }}
                  >
                    <option value="Menos de 100k">Menos de 100k</option>
                    <option value="100k-200k">100k - 200k</option>
                    <option value="200k-300k">200k - 300k</option>
                    <option value="Más de 300k">Más de 300k</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Zona o Barrio Preferido
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Parque 93, Zona G, Usaquén..."
                    value={zoneA}
                    onChange={e => setZoneA(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 6,
                      border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                      color: 'var(--text-primary)', fontSize: 12.5, outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Restricciones Alimenticias / Preferencias de Comida
                </label>
                <input
                  type="text"
                  placeholder="Ej. Vegetariano, alérgico a mariscos, comida italiana, sushi..."
                  value={foodA}
                  onChange={e => setFoodA(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 6,
                    border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                    color: 'var(--text-primary)', fontSize: 12.5, outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB PERSONA B */}
          {tab === 'person_b' && (
            <div>
              <div style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: 14,
                marginBottom: 16
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Datos de Contacto
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Nombre Completo:</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                      <CrmPersonLink name={match.person_b} crmId={match.person_b_crm_id} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Teléfono Móvil:</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      {phoneB ? (
                        <>
                          <a
                            href={`tel:${phoneB}`}
                            style={{ fontWeight: 700, color: '#60A5FA', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <Phone size={13} /> {phoneB}
                          </a>
                          {waUrlB && (
                            <a
                              href={waUrlB}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                background: '#25D366',
                                color: '#fff',
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                textDecoration: 'none'
                              }}
                            >
                              WhatsApp
                            </a>
                          )}
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No registrado en CRM</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Presupuesto Máximo Persona B
                  </label>
                  <select
                    value={budgetB}
                    onChange={e => setBudgetB(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 6,
                      border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                      color: 'var(--text-primary)', fontSize: 12.5, outline: 'none'
                    }}
                  >
                    <option value="Menos de 100k">Menos de 100k</option>
                    <option value="100k-200k">100k - 200k</option>
                    <option value="200k-300k">200k - 300k</option>
                    <option value="Más de 300k">Más de 300k</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Zona o Barrio Preferido
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Parque 93, Zona G, Usaquén..."
                    value={zoneB}
                    onChange={e => setZoneB(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 6,
                      border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                      color: 'var(--text-primary)', fontSize: 12.5, outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Restricciones Alimenticias / Preferencias de Comida
                </label>
                <input
                  type="text"
                  placeholder="Ej. Vegetariano, alérgico a mariscos, comida italiana, sushi..."
                  value={foodB}
                  onChange={e => setFoodB(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 6,
                    border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                    color: 'var(--text-primary)', fontSize: 12.5, outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB COORDINACIÓN DE CITA & RESTAURANTES */}
          {tab === 'restaurants' && (
            <div>
              {/* Sección de Día, Hora, Ciudad y Presupuesto idéntica a Google Sheets */}
              <div style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: 16,
                marginBottom: 16
              }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#B8324F', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CalendarIcon size={15} /> Agendamiento de Cita (Día, Hora & Presupuesto)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
                  {/* DÍA */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      DÍA DE LA CITA *
                    </label>
                    <input
                      type="date"
                      value={citaDate}
                      onChange={e => setCitaDate(e.target.value)}
                      style={{
                        width: '100%', padding: '8px 10px', borderRadius: 6,
                        border: '1px solid var(--border-color)', background: 'var(--bg-card)',
                        color: 'var(--text-primary)', fontSize: 12.5, fontWeight: 600, outline: 'none', boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* HORA */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      HORA DE LA CITA *
                    </label>
                    <select
                      value={citaTime}
                      onChange={e => setCitaTime(e.target.value)}
                      style={{
                        width: '100%', padding: '8px 10px', borderRadius: 6,
                        border: '1px solid var(--border-color)', background: 'var(--bg-card)',
                        color: 'var(--text-primary)', fontSize: 12.5, fontWeight: 600, outline: 'none'
                      }}
                    >
                      <option value="6:00 PM">6:00 PM</option>
                      <option value="6:30 PM">6:30 PM</option>
                      <option value="7:00 PM">7:00 PM</option>
                      <option value="7:30 PM">7:30 PM</option>
                      <option value="8:00 PM">8:00 PM</option>
                      <option value="8:30 PM">8:30 PM</option>
                      <option value="9:00 PM">9:00 PM</option>
                    </select>
                  </div>

                  {/* CIUDAD */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      CIUDAD
                    </label>
                    <select
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      style={{
                        width: '100%', padding: '8px 10px', borderRadius: 6,
                        border: '1px solid var(--border-color)', background: 'var(--bg-card)',
                        color: 'var(--text-primary)', fontSize: 12.5, fontWeight: 600, outline: 'none'
                      }}
                    >
                      {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* PRESUPUESTO ACORDADO */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      PRESUPUESTO ACORDADO
                    </label>
                    <select
                      value={budgetAgreed}
                      onChange={e => {
                        setBudgetAgreed(e.target.value)
                        setBudgetFilter(e.target.value)
                      }}
                      style={{
                        width: '100%', padding: '8px 10px', borderRadius: 6,
                        border: '1px solid var(--border-color)', background: 'var(--bg-card)',
                        color: 'var(--text-primary)', fontSize: 12.5, fontWeight: 600, outline: 'none'
                      }}
                    >
                      <option value="Menos de 100k">Menos de 100k</option>
                      <option value="100k-200k">100k - 200k</option>
                      <option value="200k-300k">200k - 300k</option>
                      <option value="Más de 300k">Más de 300k</option>
                    </select>
                  </div>
                </div>

                {/* RESTAURANTE ASIGNADO */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    LUGAR / RESTAURANTE ASIGNADO *
                  </label>
                  <input
                    type="text"
                    placeholder="Selecciona un restaurante de la lista o escribe uno personalizado..."
                    value={customVenue || venue}
                    onChange={e => {
                      setCustomVenue(e.target.value)
                      setVenue(e.target.value)
                    }}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 6,
                      border: '1.5px solid #10B981', background: 'rgba(16, 185, 129, 0.08)',
                      color: '#10B981', fontSize: 13, fontWeight: 800, outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* OBSERVACIONES CS */}
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    OBSERVACIONES CS (NOTAS INTERNAS DE RESERVA)
                  </label>
                  <input
                    type="text"
                    placeholder="Notas internas sobre la reserva o preferencias..."
                    value={csNotes}
                    onChange={e => setCsNotes(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 6,
                      border: '1px solid var(--border-color)', background: 'var(--bg-card)',
                      color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Buscador & Recomendador de Restaurantes desde Base de Datos */}
              <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  🍽️ Recomendador de Restaurantes ({city} • {budgetFilter})
                </div>
                <div style={{ position: 'relative', width: 260 }}>
                  <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Buscar por zona, nombre o comida..."
                    value={searchRest}
                    onChange={e => setSearchRest(e.target.value)}
                    style={{
                      width: '100%', padding: '5px 8px 5px 26px', borderRadius: 6,
                      border: '1px solid var(--border-color)', background: 'var(--bg-base)',
                      color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Lista de Restaurantes Disponibles */}
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                {loadingRest ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    Cargando restaurantes...
                  </div>
                ) : restaurants.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    No se encontraron restaurantes con este filtro. Escribe uno personalizado arriba.
                  </div>
                ) : (
                  restaurants.map(r => {
                    const isSel = (venue || '').includes(r.name) || (customVenue || '').includes(r.name)
                    return (
                      <div
                        key={r.id}
                        onClick={() => handleSelectRest(r)}
                        style={{
                          padding: '9px 12px',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          cursor: 'pointer',
                          background: isSel ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'background 0.15s'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: isSel ? '#10B981' : 'var(--text-primary)', fontSize: 12.5 }}>
                            {r.name} {isSel && '✓'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {r.food_type || 'Restaurante'} • {r.zone || r.city} • {r.price_range_raw || r.budget_category}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelectRest(r)
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 4,
                            border: 'none',
                            background: isSel ? '#10B981' : 'rgba(255,255,255,0.08)',
                            color: isSel ? '#fff' : 'var(--text-primary)',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {isSel ? 'Seleccionado' : 'Elegir'}
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          background: 'var(--bg-base)'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13
            }}
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              border: 'none',
              background: '#B8324F',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            {saving ? 'Guardando...' : 'Guardar y Asignar Cita & Restaurante'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MisMatches({ isOfficialMatches: propIsOfficialMatches = false }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isOfficialMatches = Boolean(
    propIsOfficialMatches ||
    location.pathname.includes('matches-aprobados') ||
    location.pathname.endsWith('/matches')
  )

  const { user, token } = useAuth()
  const isAdmin = user?.role && (user.role === 'Admin' || user.role === 'Super Admin' || user.role.toLowerCase().includes('admin') || user.role.toLowerCase().includes('director'))
  const isPsychologistRole = Boolean(
    user?.role === 'Psicóloga' ||
    (typeof user?.role === 'string' && user?.role.toLowerCase().includes('psicolog'))
  )
  const availableStatusGroups = isPsychologistRole
    ? STATUS_GROUPS.filter(g => g.area.toLowerCase().includes('psicóloga'))
    : STATUS_GROUPS
  
  const getInitialPsyc = () => {
    if (isOfficialMatches || isAdmin) return 'all'
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
  const [approvedFilter, setApprovedFilter] = useState(isOfficialMatches ? '1' : 'all')
  const [searchTerm, setSearchTerm] = useState('')
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState('')
  const [historyTarget, setHistoryTarget] = useState(null)
  const [viewMode, setViewMode] = useState('mine') // 'mine' | 'cross_review'
  const [crossReviewCount, setCrossReviewCount] = useState(0)

  // Asistente Clínico & Sugerencias IA Modal: { clientName, crmId, matchRow, tab: 'sugerencias' | 'objetivos' | 'percepcion' }
  const [aiModalTarget, setAiModalTarget] = useState(null)

  // Modales para mesa oficial MATCHES (Servicio al Cliente)
  const [personFilterTarget, setPersonFilterTarget] = useState(null) // { match, person: 'A' | 'B' }
  const [waTemplateTarget, setWaTemplateTarget] = useState(null) // { match, templateType: 'confirmacion' | 'dia_antes' | 'hoy' }

  // Modos de visualización ergonómica (Sheets vs Cómodo)
  const [density, setDensity] = useState(() => localStorage.getItem('matches_density') || 'comfortable')
  const [quickFilter, setQuickFilter] = useState(isOfficialMatches ? 'aprobados' : 'all') // 'all' | 'prioritarios' | 'sin_b' | 'listos' | 'pausa' | 'aprobados'
  const [syncStatus, setSyncStatus] = useState('synced') // 'synced' | 'saving' | 'error'

  const toggleDensity = () => {
    setDensity(prev => {
      const next = prev === 'compact' ? 'comfortable' : 'compact'
      localStorage.setItem('matches_density', next)
      return next
    })
  }

  const isCompact = density === 'compact'

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
    let url = `${API}/api/v1/matchmaking/my-matches?view_mode=${viewMode}&`
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
        if (data.cross_review_count !== undefined) {
          setCrossReviewCount(data.cross_review_count)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching matches:', err)
        setLoading(false)
      })
  }, [viewMode, selectedPsyc, statusFilter, cityFilter, planFilter, approvedFilter, searchTerm, token])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = isCompact ? 75 : 50

  useEffect(() => {
    setCurrentPage(1)
  }, [viewMode, selectedPsyc, statusFilter, cityFilter, planFilter, approvedFilter, searchTerm, quickFilter])

  const handleApproveCross = async (match) => {
    setSavingId(match.id)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${match.id}/approve-cross`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ observations_b: "" })
      })
      if (res.ok) {
        setFeedbackMsg(`✓ Visto bueno registrado. El match queda listo para la aprobación de María.`)
        setTimeout(() => setFeedbackMsg(''), 4000)
        fetchMatches()
      } else {
        alert('Error al dar visto bueno al match cruzado')
      }
    } catch(e) {
      alert('Error de conexión')
    } finally {
      setSavingId(null)
    }
  }

  const handleRejectCross = async (match) => {
    const reason = window.prompt(`Motivo de rechazo de la propuesta para ${match.person_b}:`, "No compatible")
    if (reason === null) return
    setSavingId(match.id)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${match.id}/reject-cross`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: reason })
      })
      if (res.ok) {
        setFeedbackMsg(`✕ Propuesta rechazada. Se liberó a ${match.person_b} y se creó un nuevo intento para ${match.person_a}.`)
        setTimeout(() => setFeedbackMsg(''), 4000)
        fetchMatches()
      } else {
        alert('Error al rechazar propuesta')
      }
    } catch(e) {
      alert('Error de conexión')
    } finally {
      setSavingId(null)
    }
  }

  const displayedMatches = matches.filter(m => {
    if (isOfficialMatches) {
      // En la pestaña oficial MATCHES (Sheets), solo existen parejas aprobadas donde AMBAS personas están confirmadas
      const hasBothPersons = m.person_a && m.person_a.trim() !== '' && m.person_b && m.person_b.trim() !== ''
      const isApproved = m.is_locked || m.approved_by_maria || (m.status || '').toUpperCase().includes('APROBADO')
      return hasBothPersons && isApproved
    }
    if (quickFilter === 'prioritarios') return m.is_priority
    if (quickFilter === 'novedades') return Boolean(m.cs_novedades_count && m.cs_novedades_count > 0)
    if (quickFilter === 'sin_b') return !m.person_b || m.person_b.trim() === ''
    if (quickFilter === 'listos') return (m.status || '').toLowerCase().includes('listo') && m.person_b && m.person_b.trim() !== ''
    if (quickFilter === 'pausa') return (m.status || '').toUpperCase().includes('PAUSA')
    if (quickFilter === 'aprobados') return m.is_locked || (m.status || '').toUpperCase().includes('APROBADO')
    return true
  })

  const totalPages = Math.ceil(displayedMatches.length / pageSize) || 1
  const paginatedMatches = displayedMatches.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Métricas para píldoras de acceso rápido
  const totalCount = matches.length
  const prioritariosCount = matches.filter(m => m.is_priority).length
  const conNovedadCount = matches.filter(m => Boolean(m.cs_novedades_count && m.cs_novedades_count > 0)).length
  const sinBCount = matches.filter(m => !m.person_b || m.person_b.trim() === '').length
  const listosCount = matches.filter(m => (m.status || '').toLowerCase().includes('listo') && m.person_b && m.person_b.trim() !== '').length
  const enPausaCount = matches.filter(m => (m.status || '').toUpperCase().includes('PAUSA')).length
  const aprobadosCount = matches.filter(m => m.is_locked || (m.status || '').toUpperCase().includes('APROBADO')).length

  const handleUpdateField = async (matchId, field, value, matchRow, bypassCrmValidation = false) => {
    let finalValue = value

    // Si se edita Persona B, resolver CRM y chequear duplicados
    if (field === 'person_b' && value) {
      const isUrlOrId = value.includes('http') || value.includes('smartmatchapp') || value.includes('client/') || value.includes('profile/') || /^\d{3,}$/.test(value.trim())
      if (!isUrlOrId && !bypassCrmValidation) {
        alert('⚠️ Operación Bloqueada: Es OBLIGATORIO ingresar el enlace directo de SmartMatchApp (ej: https://dailylover.smartmatchapp.com/#!/client/...) o el ID CRM de Persona B. El sistema bloquea nombres en texto plano sin enlace.')
        return
      }
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
    setSyncStatus('saving')
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
        setSyncStatus('error')
        alert(data.detail || 'Error al actualizar')
      } else {
        setMatches(prev => prev.map(m => m.id === matchId ? { ...m, [field]: finalValue } : m))
        setFeedbackMsg('Actualizado correctamente')
        setSyncStatus('synced')
        setTimeout(() => setFeedbackMsg(''), 2500)
        if (field === 'status' && value === 'HECHO') {
          fetchMatches()
        }
      }
    } catch (e) {
      setSyncStatus('error')
      alert('Error de conexión al actualizar')
    } finally {
      setSavingId(null)
    }
  }

  const handleUpdateScheduleDetails = async (matchId, updates) => {
    setSavingId(matchId)
    setSyncStatus('saving')
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${matchId}/schedule-details`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      })
      if (res.ok) {
        setMatches(prev => prev.map(m => m.id === matchId ? { ...m, ...updates } : m))
        setFeedbackMsg('✓ Cita y restaurante actualizados correctamente')
        setSyncStatus('synced')
        setTimeout(() => setFeedbackMsg(''), 2500)
      } else {
        setSyncStatus('error')
        alert('Error al actualizar datos de cita')
      }
    } catch (e) {
      setSyncStatus('error')
      alert('Error de conexión al actualizar cita')
    } finally {
      setSavingId(null)
    }
  }

  const handleAssignCandidateFromAI = async (cand, targetMatch) => {
    const candidateName = cand.name || cand.full_name
    if (!candidateName || !targetMatch) return
    const candidateId = cand.crm_id || cand.id

    const confirmMsg = `¿Deseas asignar a "${candidateName}" como Persona B para "${targetMatch.person_a}"?`
    if (!window.confirm(confirmMsg)) return

    const valueToSet = candidateId ? `https://dailylover.smartmatchapp.com/#!/client/${candidateId}` : candidateName
    await handleUpdateField(targetMatch.id, 'person_b', valueToSet, targetMatch, true)

    setAiModalTarget(null)
    setFeedbackMsg(`✓ Se asignó exitosamente a "${candidateName}" a la fila de ${targetMatch.person_a}`)
    setTimeout(() => setFeedbackMsg(''), 4000)
    fetchMatches()
  }

  const handleCreateIntake = async (e) => {
    e.preventDefault()
    if (!intakeData.person_a.trim()) {
      alert('Debes ingresar el enlace de SmartMatchApp o CRM ID de Persona A')
      return
    }
    const isUrlOrIdA = intakeData.person_a.includes('http') || intakeData.person_a.includes('smartmatchapp') || intakeData.person_a.includes('client/') || intakeData.person_a.includes('profile/') || /^\d{3,}$/.test(intakeData.person_a.trim())
    if (!isUrlOrIdA) {
      alert('⚠️ Operación Bloqueada: Es OBLIGATORIO ingresar la URL de SmartMatchApp o ID CRM para Persona A. No se permiten nombres en texto plano sin enlace.')
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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            {isOfficialMatches ? (
              <>
                <FileSpreadsheet size={26} color="#10B981" />
                📑 MATCHES (Parejas Aprobadas por María)
              </>
            ) : (
              <>
                <Heart size={26} color="#B8324F" fill="#B8324F" />
                💖 Matches Psicólogas{selectedPsyc && selectedPsyc !== 'all' ? ` — ${selectedPsyc}` : ' (Mesa de Trabajo)'}
              </>
            )}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {isOfficialMatches
              ? 'Base oficial y consolidada de parejas aprobadas por María (Equivalente exacto a la pestaña MATCHES de Google Sheets).'
              : 'Mesa de trabajo operativa para que las psicólogas propongan a Persona B con asistente clínico y sugerencias IA.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {feedbackMsg && (
            <span style={{ fontSize: 12, color: '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle size={14} /> {feedbackMsg}
            </span>
          )}
          {!isOfficialMatches && (
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
          )}
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

      {/* Selector de Modo: Mis Clientes vs Matches Cruzados (Psicóloga B) — Solo en mesa de trabajo */}
      {!isOfficialMatches && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 18, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
          <button
            onClick={() => { setViewMode('mine'); setQuickFilter('all'); setCurrentPage(1) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 8,
              border: viewMode === 'mine' ? '1px solid #B8324F' : '1px solid var(--border-color)',
              background: viewMode === 'mine' ? 'rgba(184, 50, 79, 0.15)' : 'var(--bg-card)',
              color: viewMode === 'mine' ? '#B8324F' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <User size={16} />
            Mis Clientes (Persona A)
          </button>

          <button
            onClick={() => { setViewMode('cross_review'); setQuickFilter('all'); setCurrentPage(1) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 8,
              border: viewMode === 'cross_review' ? '1px solid #B8324F' : '1px solid var(--border-color)',
              background: viewMode === 'cross_review' ? 'rgba(184, 50, 79, 0.15)' : 'var(--bg-card)',
              color: viewMode === 'cross_review' ? '#B8324F' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative'
            }}
          >
            <ShieldCheck size={16} />
            Matches Cruzados por Revisar (Psicóloga B)
            {crossReviewCount > 0 && (
              <span style={{
                background: '#B8324F',
                color: '#FFFFFF',
                borderRadius: 20,
                padding: '2px 7px',
                fontSize: 11,
                fontWeight: 800,
                marginLeft: 4
              }}>
                {crossReviewCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Selector de Píldoras por Psicóloga */}
      {(isAdmin || isOfficialMatches) && (
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

      {/* Barra de Filtros Rápidos de 1-Clic */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 16,
        padding: '4px 0'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 800,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          paddingRight: 4
        }}>
          <Sparkles size={14} color="#B8324F" />
          <span>Vistas Rápidas:</span>
        </div>

        {isOfficialMatches ? (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 10,
            background: '#B6D7A8',
            color: '#274E13',
            fontSize: 13,
            fontWeight: 800,
            border: '1px solid #6AA84F',
            boxShadow: '0 2px 8px rgba(106, 168, 79, 0.2)'
          }}>
            🔒 Parejas Oficiales Confirmadas ({displayedMatches.length})
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { id: 'all', icon: '👥', label: 'Todos', count: totalCount, activeBg: '#B8324F', activeColor: '#FFFFFF' },
              { id: 'prioritarios', icon: '⚡', label: 'Prioritarios', count: prioritariosCount, activeBg: '#D97706', activeColor: '#FFFFFF' },
              { id: 'novedades', icon: '📢', label: 'Con Novedad CS', count: conNovedadCount, activeBg: '#EA580C', activeColor: '#FFFFFF' },
              { id: 'listos', icon: '🟡', label: 'Listos para Match', count: listosCount, activeBg: '#CA8A04', activeColor: '#FFFFFF' },
              { id: 'sin_b', icon: '⏳', label: 'Sin Persona B', count: sinBCount, activeBg: '#7C3AED', activeColor: '#FFFFFF' },
              { id: 'pausa', icon: '⏸️', label: 'En Pausa', count: enPausaCount, activeBg: '#EA580C', activeColor: '#FFFFFF' },
              { id: 'aprobados', icon: '🔒', label: 'Aprobados', count: aprobadosCount, activeBg: '#16A34A', activeColor: '#FFFFFF' },
            ].map(pill => {
              const isActive = quickFilter === pill.id
              return (
                <button
                  key={pill.id}
                  onClick={() => setQuickFilter(pill.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '8px 15px',
                    borderRadius: 10,
                    border: isActive ? `1.5px solid ${pill.activeBg}` : '1px solid var(--border-color)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: isActive ? pill.activeBg : 'var(--bg-card)',
                    color: isActive ? pill.activeColor : 'var(--text-secondary)',
                    boxShadow: isActive ? '0 4px 14px rgba(0,0,0,0.22)' : '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.18s ease',
                    transform: isActive ? 'translateY(-1px)' : 'none'
                  }}
                >
                  <span style={{ fontSize: 14 }}>{pill.icon}</span>
                  <span>{pill.label}</span>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 20,
                    height: 20,
                    padding: '0 6px',
                    borderRadius: 10,
                    fontSize: 11.5,
                    fontWeight: 800,
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(150, 21, 0, 0.08)',
                    color: isActive ? '#FFFFFF' : 'var(--text-primary)',
                    border: isActive ? '1px solid rgba(255,255,255,0.3)' : '1px solid var(--border-color)',
                  }}>
                    {pill.count}
                  </span>
                </button>
              )
            })}
          </div>
        )}
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
            {STATUS_GROUPS.map(group => (
              <optgroup key={group.area} label={`${group.icon} ${group.area}`}>
                {group.options.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </optgroup>
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

        <div style={{ position: 'relative', flex: '1 1 180px' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar Persona A, B o Ciudad..."
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

        {/* Indicador de Sincronización Automática en la Nube */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 10px',
          borderRadius: 16,
          fontSize: 11,
          fontWeight: 600,
          background: syncStatus === 'saving' ? 'rgba(245,158,11,0.15)' : syncStatus === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(39,174,96,0.12)',
          color: syncStatus === 'saving' ? '#D97706' : syncStatus === 'error' ? '#EF4444' : '#27AE60',
          border: `1px solid ${syncStatus === 'saving' ? 'rgba(245,158,11,0.3)' : syncStatus === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(39,174,96,0.25)'}`,
          whiteSpace: 'nowrap'
        }}>
          {syncStatus === 'saving' ? (
            <>
              <RefreshCw size={11} className="animate-spin" /> Guardando...
            </>
          ) : syncStatus === 'error' ? (
            <>
              <AlertTriangle size={11} /> Error de guardado
            </>
          ) : (
            <>
              <Check size={12} /> Sincronizado en BD ✓
            </>
          )}
        </div>

        {/* Toggle de Densidad: Cómoda vs Compacta (Sheets) */}
        <button
          onClick={toggleDensity}
          title={isCompact ? 'Cambiar a Vista Cómoda' : 'Cambiar a Vista Compacta (Sheets)'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 6,
            border: isCompact ? '1px solid #B8324F' : '1px solid var(--border-color)',
            background: isCompact ? 'rgba(184,50,79,0.12)' : 'var(--bg-base)',
            color: isCompact ? '#B8324F' : 'var(--text-primary)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}
        >
          {isCompact ? '⊟ Vista Compacta (Sheets)' : '⊞ Vista Cómoda'}
        </button>

        <button
          onClick={fetchMatches}
          title="Refrescar datos"
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

      {/* Main Table — Con Sticky Header y Contenedor Scrollable */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        overflowX: 'auto',
        maxHeight: 'calc(100vh - 220px)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        position: 'relative'
      }}>
        {viewMode === 'cross_review' ? (
          <table style={{ width: '100%', minWidth: 1200, borderCollapse: 'collapse', fontSize: isCompact ? 12 : 13 }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '8px 10px' : '12px 12px', fontWeight: 700, width: 60 }}># ID</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '8px 10px' : '12px 12px', fontWeight: 700 }}>PROPUESTO POR</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '8px 10px' : '12px 12px', fontWeight: 700 }}>PERSONA A (CLIENTE DE COLEGA)</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '8px 10px' : '12px 12px', fontWeight: 700 }}>MI CANDIDATO / CLIENTE (PERSONA B)</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '8px 10px' : '12px 12px', fontWeight: 700 }}>CIUDAD / PREF / PLAN</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '8px 10px' : '12px 12px', fontWeight: 700 }}>OBSERVACIONES</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '8px 10px' : '12px 12px', fontWeight: 700, textAlign: 'center' }}>ESTADO</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '8px 10px' : '12px 12px', fontWeight: 700, textAlign: 'center' }}>VISTO BUENO / ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    Cargando matches cruzados...
                  </td>
                </tr>
              ) : paginatedMatches.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    <ShieldCheck size={32} style={{ color: '#10B981', margin: '0 auto 8px', display: 'block' }} />
                    No tienes matches cruzados pendientes por revisar como Psicóloga B.
                  </td>
                </tr>
              ) : (
                paginatedMatches.map((m) => {
                  const prefCfg = PREF_COLORS[m.pref] || (m.pref ? { bg: '#F3F3F3', color: '#333' } : { bg: '#FFF2CC', color: '#7F6000' })
                  const planCfg = PLAN_COLORS[m.plan_tier] || (m.plan_tier ? { bg: '#F3F3F3', color: '#434343' } : { bg: '#FFF2CC', color: '#7F6000' })
                  const statusCfg = STATUS_COLORS[m.status] || { bg: '#FFF2CC', color: '#7F6000' }

                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)', background: 'transparent' }}>
                      <td style={{ padding: isCompact ? '8px 10px' : '12px 12px', color: 'var(--text-muted)', fontWeight: 700 }}>
                        {m.id}
                      </td>
                      <td style={{ padding: isCompact ? '8px 10px' : '12px 12px', fontWeight: 700 }}>
                        <span style={{
                          background: 'rgba(184, 50, 79, 0.12)',
                          color: '#B8324F',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 800
                        }}>
                          Psic. {m.psychologist_name}
                        </span>
                      </td>
                      <td style={{ padding: isCompact ? '8px 10px' : '12px 12px', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CrmPersonLink name={m.person_a} crmId={m.person_a_crm_id} />
                          <button
                            onClick={() => setHistoryTarget(m.person_a_crm_id || m.person_a)}
                            title="Ver historial de Persona A"
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                          >
                            <History size={13} />
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: isCompact ? '8px 10px' : '12px 12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CrmPersonLink name={m.person_b} crmId={m.person_b_crm_id} />
                          <button
                            onClick={() => setHistoryTarget(m.person_b_crm_id || m.person_b)}
                            title="Ver historial de Persona B"
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                          >
                            <History size={13} />
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: isCompact ? '8px 10px' : '12px 12px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{m.city || '—'}</span>
                          {m.pref && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: prefCfg.bg, color: prefCfg.color }}>
                              {m.pref}
                            </span>
                          )}
                          {m.plan_tier && (
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: planCfg.bg, color: planCfg.color }}>
                              {m.plan_tier}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: isCompact ? '8px 10px' : '12px 12px', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 260 }}>
                        {m.observations || 'Sin observaciones'}
                      </td>
                      <td style={{ padding: isCompact ? '8px 10px' : '12px 12px', textAlign: 'center' }}>
                        <select
                          value={m.status || 'REVISAR'}
                          onChange={e => handleUpdateField(m.id, 'status', e.target.value, m)}
                          disabled={savingId === m.id}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid var(--border-color)',
                            background: statusCfg.bg,
                            color: statusCfg.color,
                            fontWeight: 700,
                            fontSize: 11,
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          <option value="REVISAR">REVISAR</option>
                          <option value="HECHO">HECHO (Aprobar)</option>
                          <option value="NO MATCH/CAMBIAR">NO MATCH/CAMBIAR</option>
                          <option value="RECHAZADO">RECHAZADO</option>
                          <option value="TROUBLE">TROUBLE</option>
                        </select>
                      </td>
                      <td style={{ padding: isCompact ? '8px 10px' : '12px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            onClick={() => handleApproveCross(m)}
                            disabled={savingId === m.id || m.status === 'HECHO'}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: m.status === 'HECHO' ? 'rgba(39, 174, 96, 0.2)' : '#27AE60',
                              color: m.status === 'HECHO' ? '#27AE60' : '#FFFFFF',
                              border: 'none',
                              borderRadius: 6,
                              padding: '5px 10px',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: m.status === 'HECHO' ? 'default' : 'pointer'
                            }}
                            title="Dar visto bueno como Psicóloga B (pasa a aprobación de María)"
                          >
                            <Check size={12} /> {m.status === 'HECHO' ? 'Aprobado ✓' : 'Visto Bueno'}
                          </button>
                          <button
                            onClick={() => handleRejectCross(m)}
                            disabled={savingId === m.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#EF4444',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: 6,
                              padding: '5px 10px',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                            title="Rechazar propuesta (libera candidato y genera reintento a la psicóloga)"
                          >
                            <X size={12} /> Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        ) : isOfficialMatches ? (
          <table style={{ width: '100%', minWidth: 1440, borderCollapse: 'collapse', fontSize: isCompact ? 12 : 13 }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: '12px 14px', fontWeight: 800, width: 140 }}>ESTADO FINAL</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: '12px 14px', fontWeight: 800, minWidth: 310 }}>PERSONA A (CONTACTO & CONFIRMACIÓN)</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: '12px 14px', fontWeight: 800, minWidth: 310 }}>PERSONA B (CONTACTO & CONFIRMACIÓN)</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: '12px 14px', fontWeight: 800, minWidth: 250 }}>RESTAURANTE / CITA</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: '12px 14px', fontWeight: 800, minWidth: 240, textAlign: 'center' }}>PLANTILLAS WHATSAPP</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: '12px 14px', fontWeight: 800, minWidth: 180 }}>OBSERVACIONES CS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    Cargando parejas oficiales aprobadas...
                  </td>
                </tr>
              ) : paginatedMatches.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    <ShieldCheck size={32} style={{ color: '#10B981', margin: '0 auto 8px', display: 'block' }} />
                    No hay parejas aprobadas pendientes por coordinar restaurante.
                  </td>
                </tr>
              ) : (
                paginatedMatches.map((m) => {
                  const phoneA = m.person_a_phone || ''
                  const phoneB = m.person_b_phone || ''
                  const waA = formatWhatsAppLink(phoneA)
                  const waB = formatWhatsAppLink(phoneB)
                  const currentDateTime = m.scheduled_date_time || ''
                  const currentVenue = m.scheduled_venue || ''
                  const waStatus = getWhatsAppButtonStatus(currentDateTime)

                  return (
                    <tr
                      key={m.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: currentVenue ? 'rgba(16, 185, 129, 0.03)' : 'transparent',
                        transition: 'background 0.15s'
                      }}
                    >
                      {/* 1. ESTADO FINAL (A la izquierda de Persona A) */}
                      <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                        <select
                          value={m.status || 'APROBADO'}
                          onChange={e => handleUpdateField(m.id, 'status', e.target.value, m)}
                          style={{
                            padding: '5px 8px',
                            borderRadius: 6,
                            border: '1px solid var(--border-color)',
                            background: STATUS_COLORS[m.status]?.bg || 'rgba(182, 215, 168, 0.2)',
                            color: STATUS_COLORS[m.status]?.color || '#274E13',
                            fontSize: 11.5,
                            fontWeight: 800,
                            outline: 'none',
                            cursor: 'pointer',
                            width: '100%',
                            maxWidth: 140
                          }}
                        >
                          <option value="APROBADO">APROBADO</option>
                          <option value="AGENDADA">AGENDADA</option>
                          <option value="CONFIRMADA">CONFIRMADA</option>
                          <option value="HECHO">HECHO</option>
                          <option value="CITA COMPLETADA">CITA COMPLETADA</option>
                          <option value="Listo para match">Listo para match</option>
                          <option value="REVISAR">REVISAR</option>
                          <option value="EN PAUSA">EN PAUSA</option>
                          <option value="CANCELADA">CANCELADA</option>
                          <option value="TROUBLEMAKER">TROUBLEMAKER</option>
                        </select>
                      </td>

                      {/* 2. PERSONA A (Contacto + Confirmación al lado derecho) */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                              <CrmPersonLink name={m.person_a} crmId={m.person_a_crm_id || m.ua_crm_id} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              {phoneA ? (
                                <>
                                  <a
                                    href={`tel:${phoneA}`}
                                    style={{ fontSize: 11.5, color: '#60A5FA', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}
                                    title="Llamar a Persona A"
                                  >
                                    <Phone size={11} /> {phoneA}
                                  </a>
                                  {waA && (
                                    <a
                                      href={waA}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        background: '#25D366',
                                        color: '#fff',
                                        padding: '1px 5px',
                                        borderRadius: 4,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        textDecoration: 'none'
                                      }}
                                      title="Abrir WhatsApp con Persona A"
                                    >
                                      WA
                                    </a>
                                  )}
                                </>
                              ) : (
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sin teléfono en CRM</span>
                              )}
                            </div>
                          </div>

                          {/* Confirmación Persona A al lado derecho */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              Confirmación
                            </span>
                            <select
                              value={m.person_a_confirmation || 'Pendiente'}
                              onChange={e => handleUpdateScheduleDetails(m.id, { person_a_confirmation: e.target.value })}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 5,
                                border: '1px solid var(--border-color)',
                                background: m.person_a_confirmation === 'Aceptó' ? 'rgba(16, 185, 129, 0.15)' : m.person_a_confirmation === 'Rechazó' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-base)',
                                color: m.person_a_confirmation === 'Aceptó' ? '#10B981' : m.person_a_confirmation === 'Rechazó' ? '#EF4444' : 'var(--text-primary)',
                                fontSize: 11,
                                fontWeight: 700,
                                outline: 'none',
                                cursor: 'pointer'
                              }}
                            >
                              <option value="Pendiente">Pendiente</option>
                              <option value="Aceptó">Aceptó ✓</option>
                              <option value="Rechazó">Rechazó ✗</option>
                              <option value="No contesta">No contesta</option>
                              <option value="De viaje">De viaje</option>
                              <option value="Pausa">Pausa</option>
                            </select>
                          </div>
                        </div>
                      </td>

                      {/* 3. PERSONA B (Contacto + Confirmación al lado derecho) */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--color-primary)' }}>
                              <CrmPersonLink name={m.person_b} crmId={m.person_b_crm_id || m.ub_crm_id} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              {phoneB ? (
                                <>
                                  <a
                                    href={`tel:${phoneB}`}
                                    style={{ fontSize: 11.5, color: '#60A5FA', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}
                                    title="Llamar a Persona B"
                                  >
                                    <Phone size={11} /> {phoneB}
                                  </a>
                                  {waB && (
                                    <a
                                      href={waB}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        background: '#25D366',
                                        color: '#fff',
                                        padding: '1px 5px',
                                        borderRadius: 4,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        textDecoration: 'none'
                                      }}
                                      title="Abrir WhatsApp con Persona B"
                                    >
                                      WA
                                    </a>
                                  )}
                                </>
                              ) : (
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sin teléfono en CRM</span>
                              )}
                            </div>
                          </div>

                          {/* Confirmación Persona B al lado derecho */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              Confirmación
                            </span>
                            <select
                              value={m.person_b_confirmation || 'Pendiente'}
                              onChange={e => handleUpdateScheduleDetails(m.id, { person_b_confirmation: e.target.value })}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 5,
                                border: '1px solid var(--border-color)',
                                background: m.person_b_confirmation === 'Aceptó' ? 'rgba(16, 185, 129, 0.15)' : m.person_b_confirmation === 'Rechazó' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-base)',
                                color: m.person_b_confirmation === 'Aceptó' ? '#10B981' : m.person_b_confirmation === 'Rechazó' ? '#EF4444' : 'var(--text-primary)',
                                fontSize: 11,
                                fontWeight: 700,
                                outline: 'none',
                                cursor: 'pointer'
                              }}
                            >
                              <option value="Pendiente">Pendiente</option>
                              <option value="Aceptó">Aceptó ✓</option>
                              <option value="Rechazó">Rechazó ✗</option>
                              <option value="No contesta">No contesta</option>
                              <option value="De viaje">De viaje</option>
                              <option value="Pausa">Pausa</option>
                            </select>
                          </div>
                        </div>
                      </td>

                      {/* 4. RESTAURANTE / CITA (Botón que abre el modal únicamente) */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                        {currentVenue ? (
                          <div
                            onClick={() => setPersonFilterTarget({ match: m })}
                            style={{
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 3,
                              background: 'rgba(16, 185, 129, 0.08)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              borderRadius: 8,
                              padding: '6px 10px',
                              transition: 'all 0.15s ease'
                            }}
                            title="Hacer clic para ver filtros y coordinar restaurante, día y hora"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#10B981', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                🍽️ {currentVenue}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>✏️</span>
                            </div>
                            {currentDateTime && (
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                                <CalendarIcon size={11} color="#10B981" /> {currentDateTime}
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => setPersonFilterTarget({ match: m })}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '8px 14px',
                              borderRadius: 8,
                              border: '1.5px dashed #10B981',
                              background: 'rgba(16, 185, 129, 0.08)',
                              color: '#10B981',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              width: '100%',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease'
                            }}
                            title="Abrir modal para filtrar y coordinar restaurante, día y hora"
                          >
                            <Utensils size={14} /> Elegir Restaurante
                          </button>
                        )}
                      </td>

                      {/* 5. PLANTILLAS WHATSAPP (Activación secuencial por hora de Colombia) */}
                      <td style={{ padding: '10px 12px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
                          {/* Botón 1: Confirmar (Siempre habilitado primero) */}
                          <button
                            onClick={() => setWaTemplateTarget({ match: m, templateType: 'confirmacion' })}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '5px 8px',
                              borderRadius: 6,
                              border: '1px solid #10B981',
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#10B981',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            title="Plantilla 1: Confirmación de Cita (Activa para enviar)"
                          >
                            📩 Confirmar
                          </button>

                          {/* Botón 2: Día Antes (Habilitado solo 1 día antes según hora Colombia) */}
                          <button
                            onClick={() => {
                              if (waStatus.canDiaAntes) {
                                setWaTemplateTarget({ match: m, templateType: 'dia_antes' })
                              }
                            }}
                            disabled={!waStatus.canDiaAntes}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '5px 8px',
                              borderRadius: 6,
                              border: waStatus.canDiaAntes ? '1.5px solid #F59E0B' : '1px solid rgba(255,255,255,0.1)',
                              background: waStatus.canDiaAntes ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.03)',
                              color: waStatus.canDiaAntes ? '#F59E0B' : 'var(--text-muted)',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: waStatus.canDiaAntes ? 'pointer' : 'not-allowed',
                              opacity: waStatus.canDiaAntes ? 1 : 0.38,
                              transition: 'all 0.15s ease'
                            }}
                            title={waStatus.diaAntesReason}
                          >
                            ⏰ Día Antes
                          </button>

                          {/* Botón 3: Hoy (Habilitado solo el mismo día de la cita según hora Colombia) */}
                          <button
                            onClick={() => {
                              if (waStatus.canHoy) {
                                setWaTemplateTarget({ match: m, templateType: 'hoy' })
                              }
                            }}
                            disabled={!waStatus.canHoy}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '5px 8px',
                              borderRadius: 6,
                              border: waStatus.canHoy ? '1.5px solid #3B82F6' : '1px solid rgba(255,255,255,0.1)',
                              background: waStatus.canHoy ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                              color: waStatus.canHoy ? '#3B82F6' : 'var(--text-muted)',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: waStatus.canHoy ? 'pointer' : 'not-allowed',
                              opacity: waStatus.canHoy ? 1 : 0.38,
                              transition: 'all 0.15s ease'
                            }}
                            title={waStatus.hoyReason}
                          >
                            🚀 Hoy
                          </button>
                        </div>
                      </td>

                      {/* 6. OBSERVACIONES CS */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                        <input
                          type="text"
                          defaultValue={m.cs_observations || ''}
                          placeholder="Notas CS..."
                          onBlur={e => {
                            if (e.target.value !== (m.cs_observations || '')) {
                              handleUpdateScheduleDetails(m.id, { cs_observations: e.target.value })
                            }
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') e.target.blur()
                          }}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: 6,
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
        ) : (
          <table style={{ width: '100%', minWidth: isCompact ? 1050 : 1150, borderCollapse: 'collapse', fontSize: isCompact ? 13 : 14 }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '10px 14px' : '14px 18px', fontWeight: 800, minWidth: isCompact ? 200 : 230, letterSpacing: '0.04em' }}>PERSONA A</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '10px 14px' : '14px 18px', fontWeight: 800, minWidth: isCompact ? 290 : 360, letterSpacing: '0.04em' }}>PERSONA B (PROPUESTA)</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '10px 12px' : '14px 14px', fontWeight: 800, minWidth: isCompact ? 120 : 140, letterSpacing: '0.04em' }}>PSICÓLOGA DE B</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '10px 12px' : '14px 14px', fontWeight: 800, minWidth: isCompact ? 120 : 145, letterSpacing: '0.04em' }} title="Fecha de pago en Stripe o fecha de creación del slot">FECHA / PAGO</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '10px 14px' : '14px 18px', fontWeight: 800, minWidth: isCompact ? 160 : 185, letterSpacing: '0.04em' }}>STATUS</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '10px 8px' : '14px 12px', fontWeight: 800, textAlign: 'center', width: 95, letterSpacing: '0.04em' }}>APROBADO</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '10px 14px' : '14px 18px', fontWeight: 800, minWidth: isCompact ? 240 : 340, letterSpacing: '0.04em' }}>OBSERVACIONES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    Cargando matches...
                  </td>
                </tr>
              ) : paginatedMatches.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    No se encontraron matches para el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                paginatedMatches.map((m) => {
                  const isLocked = m.is_locked
                  const statusCfg = STATUS_COLORS[m.status] || { bg: '#FFF2CC', color: '#7F6000' }
                  const extraMeta = [m.city, m.pref, m.plan_tier].filter(Boolean).join(' • ')

                  return (
                    <tr
                      key={m.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: m.is_priority ? 'rgba(255, 229, 153, 0.12)' : isLocked ? 'rgba(182, 215, 168, 0.05)' : 'transparent',
                        transition: 'background 0.15s'
                      }}
                    >
                      {/* PERSONA A */}
                      <td
                        style={{ padding: isCompact ? '10px 14px' : '15px 18px', fontSize: isCompact ? 13 : 14 }}
                        title={extraMeta ? `${m.person_a} (${extraMeta})` : m.person_a}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                          <CrmPersonLink name={m.person_a} crmId={m.person_a_crm_id} />
                          {m.is_priority && (
                            <span style={{
                              fontSize: isCompact ? 9 : 10,
                              padding: isCompact ? '2px 5px' : '3px 7px',
                              borderRadius: 4,
                              background: '#FFE599',
                              color: '#7F6000',
                              fontWeight: 800,
                              letterSpacing: '0.03em'
                            }}>
                              ⚡ PRIORITARIO
                            </span>
                          )}
                          {Boolean(m.cs_novedades_count && m.cs_novedades_count > 0) && (
                            <span style={{
                              fontSize: isCompact ? 9 : 10,
                              padding: isCompact ? '2px 5px' : '3px 7px',
                              borderRadius: 4,
                              background: 'rgba(234, 88, 12, 0.15)',
                              border: '1px solid rgba(234, 88, 12, 0.5)',
                              color: '#F97316',
                              fontWeight: 800,
                              letterSpacing: '0.03em',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3
                            }} title={`${m.cs_novedades_count} Novedad(es) registrada(s) por CS`}>
                              📢 NOVEDAD CS ({m.cs_novedades_count})
                            </span>
                          )}
                          <button
                            onClick={() => setHistoryTarget(m.person_a_crm_id || m.ua_crm_id || m.person_a)}
                            title="Ver historial de Persona A"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: 3,
                              display: 'inline-flex',
                              alignItems: 'center',
                              borderRadius: 4
                            }}
                          >
                            <History size={isCompact ? 13 : 15} />
                          </button>
                        </div>
                      </td>

                      {/* PERSONA B - EDITABLE */}
                      <td style={{ padding: isCompact ? '8px 14px' : '14px 18px', minWidth: isCompact ? 290 : 360 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                              padding: isCompact ? '6px 10px' : '8px 12px',
                              height: isCompact ? 33 : 38,
                              borderRadius: 8,
                              border: '1px solid var(--border-color)',
                              background: isLocked ? 'var(--bg-card-hover)' : 'var(--bg-base)',
                              color: 'var(--text-primary)',
                              fontSize: isCompact ? 12.5 : 13.5,
                              fontWeight: 600,
                              outline: 'none',
                              boxSizing: 'border-box',
                              transition: 'border-color 0.15s'
                            }}
                          />
                          {(!m.person_b || m.person_b.trim() === '') ? (
                            <button
                              onClick={() => setAiModalTarget({ clientName: m.person_a, crmId: m.person_a_crm_id || m.ua_crm_id, matchRow: m, tab: 'sugerencias' })}
                              title={`Buscar candidatos afines con IA para ${m.person_a}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: isCompact ? '5px 10px' : '7px 13px',
                                height: isCompact ? 33 : 38,
                                borderRadius: 8,
                                border: '1.5px dashed #10B981',
                                background: 'rgba(16, 185, 129, 0.12)',
                                color: '#10B981',
                                fontSize: isCompact ? 11 : 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <Sparkles size={isCompact ? 12 : 14} /> Buscar con IA
                            </button>
                          ) : (
                            <button
                              onClick={() => setAiModalTarget({ clientName: m.person_a, crmId: m.person_a_crm_id || m.ua_crm_id, matchRow: m, tab: 'sugerencias' })}
                              title={`Ver o cambiar candidatos con sugerencias IA para ${m.person_a}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: isCompact ? '4px 9px' : '6px 12px',
                                height: isCompact ? 33 : 38,
                                borderRadius: 8,
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                background: 'rgba(16, 185, 129, 0.1)',
                                color: '#10B981',
                                fontSize: isCompact ? 11 : 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <Sparkles size={isCompact ? 11 : 13} /> Sugerencias IA
                            </button>
                          )}
                          {m.person_b && m.person_b.trim() !== '' && (
                            <button
                              onClick={() => setHistoryTarget(m.person_b_crm_id || m.ub_crm_id || m.person_b)}
                              title={`Ver historial de ${m.person_b}`}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: 3,
                                display: 'inline-flex',
                                alignItems: 'center',
                                borderRadius: 4
                              }}
                            >
                              <History size={isCompact ? 13 : 15} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* PSICÓLOGA DE B (CRUCE INFORMATIVO) */}
                      <td style={{ padding: isCompact ? '10px 12px' : '15px 14px' }}>
                        {m.psychologist_b ? (
                          <span style={{
                            display: 'inline-block',
                            padding: isCompact ? '3px 8px' : '4px 10px',
                            borderRadius: 6,
                            fontSize: isCompact ? 11.5 : 12.5,
                            fontWeight: 800,
                            background: 'rgba(184, 50, 79, 0.12)',
                            color: '#B8324F'
                          }}>
                            {m.psychologist_b}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: isCompact ? 12 : 13 }}>—</span>
                        )}
                      </td>

                      {/* FECHA / PAGO STRIPE */}
                      <td style={{ padding: isCompact ? '8px 12px' : '12px 14px', whiteSpace: 'nowrap' }}>
                        {m.tiene_pago_stripe ? (
                          <div
                            title={`✓ Pago confirmado en Stripe\nPlan pagado: ${m.plan_pago_stripe || m.plan_tier || 'Plan activo'}\nFecha Pago: ${m.fecha_pago_stripe}\nSlot Sistema: ${m.fecha_slot || m.fecha}`}
                            style={{ display: 'flex', flexDirection: 'column', gap: 3, cursor: 'help' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                background: 'rgba(99, 91, 255, 0.15)',
                                color: '#A594FD',
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontSize: isCompact ? 10.5 : 11,
                                fontWeight: 800,
                                border: '1px solid rgba(99, 91, 255, 0.3)'
                              }}>
                                💳 Stripe
                              </span>
                              {formatRelativeTime(m.fecha_pago_stripe) && (
                                <span style={{ fontSize: isCompact ? 10.5 : 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                                  ({formatRelativeTime(m.fecha_pago_stripe)})
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: isCompact ? 11.5 : 12.5, color: 'var(--text-primary)', fontWeight: 600 }}>
                              {m.fecha_pago_stripe ? m.fecha_pago_stripe.split(' ')[0] : m.fecha}
                            </div>
                            {(m.plan_pago_stripe || m.plan_tier) && (
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                fontSize: isCompact ? 10.5 : 11,
                                color: '#60A5FA',
                                fontWeight: 700
                              }}>
                                🏷️ {m.plan_pago_stripe || m.plan_tier}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            title={`Fecha de creación del slot en sistema: ${m.fecha_slot || m.fecha}\nPlan: ${m.plan_tier || 'Sin plan'}`}
                            style={{ display: 'flex', flexDirection: 'column', gap: 2, cursor: 'help' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: isCompact ? 11 : 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                                📅 {m.fecha_slot ? m.fecha_slot.split(' ')[0] : (m.fecha ? m.fecha.split(' ')[0] : '—')}
                              </span>
                              {formatRelativeTime(m.fecha_slot || m.fecha) && (
                                <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                                  ({formatRelativeTime(m.fecha_slot || m.fecha)})
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                              {m.plan_tier ? `🏷️ ${m.plan_tier}` : 'Slot sistema'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* STATUS (AGRUPADO POR ÁREA) */}
                      <td style={{ padding: isCompact ? '8px 14px' : '14px 18px' }}>
                        {isLocked ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: isCompact ? '5px 10px' : '7px 12px',
                            borderRadius: 8,
                            fontSize: isCompact ? 11.5 : 12.5,
                            fontWeight: 800,
                            background: statusCfg.bg,
                            color: statusCfg.color
                          }}>
                            <Lock size={isCompact ? 12 : 13} /> {m.status}
                          </span>
                        ) : (
                          <select
                            value={m.status}
                            onChange={e => handleUpdateField(m.id, 'status', e.target.value, m)}
                            style={{
                              width: '100%',
                              padding: isCompact ? '5px 9px' : '7px 12px',
                              height: isCompact ? 33 : 38,
                              borderRadius: 8,
                              border: `1.5px solid ${statusCfg.bg}`,
                              background: statusCfg.bg,
                              color: statusCfg.color,
                              fontSize: isCompact ? 11.5 : 12.5,
                              fontWeight: 800,
                              cursor: 'pointer',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          >
                            {m.status && !availableStatusGroups.some(g => g.options.includes(m.status)) && (
                              <option value={m.status} style={{ background: '#FFFFFF', color: '#000000', fontWeight: 'bold' }}>
                                📍 {m.status} (Estado Asignado)
                              </option>
                            )}
                            {availableStatusGroups.map(group => (
                              <optgroup
                                key={group.area}
                                label={`${group.icon} ${group.area}`}
                                style={{ background: '#F1F5F9', color: '#0F172A', fontWeight: 'bold' }}
                              >
                                {group.options.map(st => (
                                  <option
                                    key={st}
                                    value={st}
                                    style={{ background: '#FFFFFF', color: '#1E293B', fontWeight: 'normal' }}
                                  >
                                    {st}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        )}
                      </td>

                      {/* APROBADO POR MARÍA */}
                      <td style={{ padding: isCompact ? '10px 8px' : '15px 12px', textAlign: 'center' }}>
                        {isLocked ? (
                          <span title="Aprobado por María (Fila Bloqueada)" style={{ display: 'inline-flex', color: '#274E13' }}>
                            <Lock size={isCompact ? 14 : 17} />
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* OBSERVACIONES */}
                      <td style={{ padding: isCompact ? '8px 14px' : '14px 18px', minWidth: isCompact ? 240 : 340 }}>
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
                            padding: isCompact ? '6px 10px' : '8px 12px',
                            height: isCompact ? 33 : 38,
                            borderRadius: 8,
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-base)',
                            color: 'var(--text-primary)',
                            fontSize: isCompact ? 12 : 13,
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
        )}
      </div>

      {/* Barra de Paginación */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 14,
          padding: '10px 16px',
          background: 'var(--bg-card)',
          borderRadius: 8,
          border: '1px solid var(--border-color)',
          fontSize: 12,
          color: 'var(--text-secondary)'
        }}>
          <div>
            Mostrando <strong style={{ color: 'var(--text-primary)' }}>{((currentPage - 1) * pageSize) + 1}</strong> - <strong style={{ color: 'var(--text-primary)' }}>{Math.min(currentPage * pageSize, displayedMatches.length)}</strong> de <strong style={{ color: 'var(--text-primary)' }}>{displayedMatches.length}</strong> {viewMode === 'cross_review' ? 'matches cruzados' : 'matches'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: currentPage === 1 ? 'rgba(255,255,255,0.03)' : 'var(--bg-base)',
                color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: currentPage === totalPages ? 'rgba(255,255,255,0.03)' : 'var(--bg-base)',
                color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Siguiente <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

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
                    <option value="Básico 40k">Básico (2 slots)</option>
                    <option value="Premium">Premium (3 slots)</option>
                    <option value="VIP 195k">VIP (4 slots)</option>
                    <option value="Matchmaking Experience">Matchmaking Experience (4 slots - solo MAPE)</option>
                    <option value="Estándar 65k (2 citas)">Estándar 65k (3 slots)</option>
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

      {/* MODAL ASISTENTE CLÍNICO: SUGERENCIAS IA, DATOS OBJETIVOS Y PERCEPCIÓN */}
      {aiModalTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100, padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 14,
            border: '1px solid var(--border-color)',
            width: '100%',
            maxWidth: 1180,
            maxHeight: '94vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
            overflow: 'hidden'
          }}>
            {/* Top Bar */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid var(--border-color)',
              background: 'rgba(150, 21, 0, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'linear-gradient(135deg, #961500, #B8324F)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', flexShrink: 0
                }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      {aiModalTarget.clientName}
                    </h2>
                    {aiModalTarget.matchRow?.city && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                        📍 {aiModalTarget.matchRow.city}
                      </span>
                    )}
                    {aiModalTarget.matchRow?.pref && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(207, 226, 243, 0.3)', color: '#1B365D' }}>
                        {aiModalTarget.matchRow.pref}
                      </span>
                    )}
                    {aiModalTarget.matchRow?.plan_tier && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(182, 215, 168, 0.3)', color: '#274E13' }}>
                        {aiModalTarget.matchRow.plan_tier}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Fila #{aiModalTarget.matchRow?.id} • Psicóloga: {aiModalTarget.matchRow?.psychologist_name || 'Asignada'} • Asistente Clínico Inteligente
                  </div>
                </div>
              </div>

              {/* Botones de Tab del Modal */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setAiModalTarget(prev => ({ ...prev, tab: 'sugerencias' }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 8, border: 'none',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    background: aiModalTarget.tab === 'sugerencias' ? '#961500' : 'rgba(255,255,255,0.06)',
                    color: aiModalTarget.tab === 'sugerencias' ? '#FFFFFF' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Sparkles size={14} /> ✨ Sugerencias IA
                </button>
                <button
                  onClick={() => setAiModalTarget(prev => ({ ...prev, tab: 'objetivos' }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 8, border: 'none',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    background: aiModalTarget.tab === 'objetivos' ? '#961500' : 'rgba(255,255,255,0.06)',
                    color: aiModalTarget.tab === 'objetivos' ? '#FFFFFF' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <ClipboardList size={14} /> 📋 Datos Objetivos
                </button>
                <button
                  onClick={() => setAiModalTarget(prev => ({ ...prev, tab: 'percepcion' }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 8, border: 'none',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    background: aiModalTarget.tab === 'percepcion' ? '#961500' : 'rgba(255,255,255,0.06)',
                    color: aiModalTarget.tab === 'percepcion' ? '#FFFFFF' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Brain size={14} /> 🧠 Percepción Psicóloga
                </button>

                <button
                  onClick={() => setAiModalTarget(null)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    borderRadius: 8,
                    width: 34, height: 34,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    marginLeft: 8
                  }}
                  title="Cerrar ventana"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content Area del Modal */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {aiModalTarget.tab === 'sugerencias' && (
                <EntrevistaResultados
                  clientId={aiModalTarget.crmId || aiModalTarget.matchRow?.person_a_crm_id || aiModalTarget.matchRow?.ua_crm_id}
                  clientName={aiModalTarget.clientName}
                  onGoToTab={(tab) => {
                    if (tab === 'objetivos' || tab === 'percepcion') {
                      setAiModalTarget(prev => ({ ...prev, tab }))
                    }
                  }}
                  onAssignCandidate={(cand) => handleAssignCandidateFromAI(cand, aiModalTarget.matchRow)}
                />
              )}
              {aiModalTarget.tab === 'objetivos' && (
                <DatosObjetivos
                  standalone={false}
                  client={{
                    id: aiModalTarget.crmId || aiModalTarget.clientName,
                    name: aiModalTarget.clientName,
                    crm_id: aiModalTarget.crmId
                  }}
                />
              )}
              {aiModalTarget.tab === 'percepcion' && (
                <PercepcionPsicologa
                  standalone={false}
                  client={{
                    id: aiModalTarget.crmId || aiModalTarget.clientName,
                    name: aiModalTarget.clientName,
                    crm_id: aiModalTarget.crmId
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE FILTROS POR PERSONA Y RESTAURANTE (MESA OFICIAL MATCHES) */}
      {personFilterTarget && (
        <PersonRestaurantFilterModal
          match={personFilterTarget.match}
          initialTab={personFilterTarget.person === 'B' ? 'person_b' : 'person_a'}
          onClose={() => setPersonFilterTarget(null)}
          onSave={async (details) => {
            await handleUpdateScheduleDetails(personFilterTarget.match.id, details)
          }}
        />
      )}

      {/* MODAL DE PLANTILLAS CANÓNICAS DE WHATSAPP */}
      {waTemplateTarget && (
        <WhatsAppTemplateModal
          match={waTemplateTarget.match}
          templateType={waTemplateTarget.templateType}
          onClose={() => setWaTemplateTarget(null)}
          onCopy={(msg) => {
            setFeedbackMsg(msg)
            setTimeout(() => setFeedbackMsg(''), 3000)
          }}
        />
      )}
    </div>
  )
}
