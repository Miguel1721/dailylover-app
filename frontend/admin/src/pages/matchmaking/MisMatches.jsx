import React, { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Heart, Search, Filter, Lock, Plus, CheckCircle, AlertTriangle, RefreshCw,
  User, MapPin, Tag, ShieldCheck, History, ExternalLink, AlertCircle, X, Check,
  Clock, ChevronLeft, ChevronRight, Sparkles, FileSpreadsheet, ClipboardList, Brain,
  Phone, MessageSquare, Utensils, Copy, Send, Calendar as CalendarIcon, Wallet
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import CrmPersonLink, { getSmartMatchAppUrl } from '../../components/CrmPersonLink'
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
  'CITA PROGRAMADA': { bg: '#0284C7', color: '#FFFFFF' },
  'CITA REALIZADA': { bg: '#10B981', color: '#FFFFFF' },
  'CITA RESERVADA': { bg: '#007791', color: '#FFFFFF' },
  'AGENDADA': { bg: '#0284C7', color: '#FFFFFF' },
  'CONFIRMADA': { bg: '#10B981', color: '#FFFFFF' },
  'AGENDANDO': { bg: '#0EA5E9', color: '#FFFFFF' },
  'POR CONFIRMAR': { bg: '#F59E0B', color: '#FFFFFF' },
  'REPROGRAMAR': { bg: '#EF4444', color: '#FFFFFF' },
  'HECHO': { bg: '#A2C4C9', color: '#134F5C' },
  'CITA COMPLETADA': { bg: '#10B981', color: '#FFFFFF' },
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
  'RECHAZADO POR PERSONA A': { bg: '#FEE2E2', color: '#991B1B' },
  'RECHAZADO POR PERSONA B': { bg: '#FEE2E2', color: '#991B1B' },
  'RECHAZADO AMBOS': { bg: '#FECACA', color: '#7F1D1D' },
  'RECHAZADO': { bg: '#FEE2E2', color: '#991B1B' },
  'CANCELADA': { bg: '#FEE2E2', color: '#991B1B' },
}

export const INHERITED_PSYCHOLOGIST_LABELS = {
  'SILVI': 'Sofi',
  'JENN': 'Aleja',
  'ISA': 'Lau',
  'ANA': 'Maripaz / MariB / MariS',
  'STEFFY': 'Manu',
}

export const OFFICIAL_REFUND_CATEGORIES = [
  'Descalificación Clínica / Protocolo de Seguridad',
  'Pool Insuficiente por Edad (>50 años)',
  'Sin Cobertura Geográfica',
  'Se encuentra actualmente en una relación',
  'Insatisfacción con el Servicio / Troublemakers',
  'Desistimiento voluntario por demora',
  'Desistimiento voluntario por otras razones'
]

const PSYCHOLOGIST_LIST = [
  'SILVI', 'JENN', 'ANA', 'STEFFY', 'ISA', 'PIA', 'MAPE D'
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
      'CITA PROGRAMADA',
      'CITA REALIZADA',
      'CITA RESERVADA',
      'AGENDANDO',
      'POR CONFIRMAR',
      'REPROGRAMAR',
      'RECHAZADO POR PERSONA A',
      'RECHAZADO POR PERSONA B',
      'RECHAZADO AMBOS',
      'CANCELADA',
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
                  href={getSmartMatchAppUrl(data?.person_name || queryTarget, data.crm_id)}
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
  const initialYMD = parseMatchDateToYMD(match?.scheduled_date_time) || getColombiaTodayYMD()
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
  const [budgetA, setBudgetA] = useState('200k-300k')
  const [zoneA, setZoneA] = useState(match?.person_a_neighborhood || '')
  const [foodA, setFoodA] = useState('')

  // Preferencias persona B
  const [budgetB, setBudgetB] = useState('200k-300k')
  const [zoneB, setZoneB] = useState(match?.person_b_neighborhood || '')
  const [foodB, setFoodB] = useState('')

  // Restaurantes desde API (unificado con budgetAgreed, día, fecha, hora y cupos)
  const [restaurants, setRestaurants] = useState([])
  const [loadingRest, setLoadingRest] = useState(false)
  const [budgetFilter, setBudgetFilter] = useState('200k-300k')
  const [searchRest, setSearchRest] = useState('')
  const [saving, setSaving] = useState(false)

  const getDayCodeFromYMD = (ymd) => {
    if (!ymd) return ''
    const parts = ymd.split('-')
    if (parts.length !== 3) return ''
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    return days[d.getDay()] || ''
  }

  const selectedDayCode = getDayCodeFromYMD(citaDate)

  useEffect(() => {
    const params = new URLSearchParams()
    if (city && city !== 'all') params.set('city', city)
    const activeBudget = budgetAgreed || budgetFilter
    if (activeBudget && activeBudget !== 'all') params.set('budget_category', activeBudget)
    if (selectedDayCode) params.set('day', selectedDayCode)
    if (citaDate) params.set('date', citaDate)
    if (citaTime && citaTime !== 'all') params.set('time', citaTime)
    if (match?.id) params.set('exclude_match_id', String(match.id))
    if (searchRest.trim()) params.set('search', searchRest.trim())

    setLoadingRest(true)
    fetch(`${API}/api/v1/matchmaking/restaurants?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        setRestaurants(d.restaurants || [])
        setLoadingRest(false)
      })
      .catch(() => setLoadingRest(false))
  }, [city, budgetAgreed, budgetFilter, selectedDayCode, citaDate, citaTime, match?.id, searchRest])

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
      alert(err?.message || 'Error al guardar la cita')
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
                      HORA DE LA CITA (CADA 30 MIN) *
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
                      <option value="10:00 AM">10:00 AM</option>
                      <option value="10:30 AM">10:30 AM</option>
                      <option value="11:00 AM">11:00 AM</option>
                      <option value="11:30 AM">11:30 AM</option>
                      <option value="12:00 PM">12:00 PM</option>
                      <option value="12:30 PM">12:30 PM</option>
                      <option value="1:00 PM">1:00 PM</option>
                      <option value="1:30 PM">1:30 PM</option>
                      <option value="2:00 PM">2:00 PM</option>
                      <option value="2:30 PM">2:30 PM</option>
                      <option value="3:00 PM">3:00 PM</option>
                      <option value="3:30 PM">3:30 PM</option>
                      <option value="4:00 PM">4:00 PM</option>
                      <option value="4:30 PM">4:30 PM</option>
                      <option value="5:00 PM">5:00 PM</option>
                      <option value="5:30 PM">5:30 PM</option>
                      <option value="6:00 PM">6:00 PM</option>
                      <option value="6:30 PM">6:30 PM</option>
                      <option value="7:00 PM">7:00 PM</option>
                      <option value="7:30 PM">7:30 PM</option>
                      <option value="8:00 PM">8:00 PM</option>
                      <option value="8:30 PM">8:30 PM</option>
                      <option value="9:00 PM">9:00 PM</option>
                      <option value="9:30 PM">9:30 PM</option>
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
                      <option value="all">Todos los presupuestos</option>
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
                  🍽️ Recomendador de Restaurantes Abiertos y con Cupo ({city} • {budgetAgreed === 'all' ? 'Todos' : budgetAgreed} • {selectedDayCode || 'Día'} • {citaTime} • {restaurants.length} disp.)
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
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                {loadingRest ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    Verificando horarios de apertura y cupos disponibles...
                  </div>
                ) : restaurants.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    No hay restaurantes abiertos o con cupos libres para <strong>{city}</strong> el <strong>{selectedDayCode} {citaDate}</strong> a las <strong>{citaTime}</strong> en rango <strong>{budgetAgreed}</strong>.
                  </div>
                ) : (
                  restaurants.map(r => {
                    const isSel = (venue || '').includes(r.name) || (customVenue || '').includes(r.name)
                    const maxSlots = r.max_slots_per_time || 3
                    const availSlots = r.available_slots ?? maxSlots
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: isSel ? '#10B981' : 'var(--text-primary)', fontSize: 12.5 }}>
                              {r.name} {isSel && '✓'}
                            </span>
                            <span style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10B981'
                            }}>
                              🟢 {availSlots}/{maxSlots} cupos ({citaTime})
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {r.food_type || 'Restaurante'} • {r.zone || r.city} • <strong>{r.budget_category}</strong> ({r.price_range_raw ? `$${r.price_range_raw}` : `$${Number(r.price_num_cop || 0).toLocaleString('es-CO')}`})
                          </div>
                          {r.hours_raw && (
                            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                              ⏰ {r.hours_raw}
                            </div>
                          )}
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
  const roleStr = (user?.role || '').toLowerCase()
  const isCs = roleStr.includes('servicio') || roleStr.includes('customer') || roleStr === 'cs'
  const isLina = roleStr.includes('lina') || roleStr.includes('refund')
  const isPsychologistRole = Boolean(
    user?.role === 'Psicóloga' ||
    (typeof user?.role === 'string' && user?.role.toLowerCase().includes('psicolog'))
  )
  const availableStatusGroups = isPsychologistRole
    ? STATUS_GROUPS.filter(g => g.area.toLowerCase().includes('psicóloga') || g.area.toLowerCase().includes('refunds'))
    : STATUS_GROUPS
  
  const getInitialPsyc = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const urlPsyc = urlParams.get('psychologist') || urlParams.get('psyc')
      if (urlPsyc) return urlPsyc
    }
    if (isOfficialMatches || isAdmin) return 'all'
    const name = user?.name || ''
    const email = user?.email || ''
    if (name.toLowerCase().includes('mps') || name.toLowerCase().includes('salinas') || email.toLowerCase().includes('salinas') || email.toLowerCase().includes('mps')) return 'MPS'
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
  const [approvedFilter, setApprovedFilter] = useState(isOfficialMatches ? 'yes' : 'all')
  const [ownershipFilter, setOwnershipFilter] = useState('all') // 'all' | 'propios' | 'heredados'
  const [inheritedFromLabel, setInheritedFromLabel] = useState(null)
  const [searchTerm, setSearchTerm] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      return params.get('search') || params.get('q') || ''
    }
    return ''
  })
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState('')
  const [historyTarget, setHistoryTarget] = useState(null)
  const [viewMode, setViewMode] = useState('mine') // 'mine' | 'cross_review'
  const [crossReviewCount, setCrossReviewCount] = useState(0)

  // Modal de Solicitud de Refund / Descalificación (Enrutamiento directo a Lina)
  const [refundModalTarget, setRefundModalTarget] = useState(null) // { match, isStandalone, targetPerson }
  const [refundPersonName, setRefundPersonName] = useState('')
  const [refundPsychologist, setRefundPsychologist] = useState('General')
  const [refundPlanTier, setRefundPlanTier] = useState('')
  const [refundCategory, setRefundCategory] = useState(OFFICIAL_REFUND_CATEGORIES[0])
  const [refundReason, setRefundReason] = useState('')
  const [submittingRefund, setSubmittingRefund] = useState(false)

  const handleOpenManualRefund = () => {
    setRefundModalTarget({ isStandalone: true })
    setRefundPersonName('')
    setRefundPsychologist(selectedPsyc && selectedPsyc !== 'all' ? selectedPsyc : 'General')
    setRefundPlanTier('')
    setRefundCategory(OFFICIAL_REFUND_CATEGORIES[0])
    setRefundReason('')
  }

  const handleOpenRowRefund = (matchRow, targetPerson = 'A') => {
    const isB = targetPerson === 'B' && matchRow.person_b
    setRefundModalTarget({ match: matchRow, isStandalone: false, targetPerson: isB ? 'B' : 'A' })
    setRefundPersonName(isB ? matchRow.person_b : matchRow.person_a)
    setRefundPsychologist((isB ? matchRow.psyc_b : matchRow.psychologist_name) || matchRow.psychologist_name || 'General')
    setRefundPlanTier(matchRow.plan_tier || '')
    setRefundCategory(OFFICIAL_REFUND_CATEGORIES[0])
    setRefundReason('')
  }

  // Sincronizar parámetros de URL (Ej: /matchmaking/mis-matches?filter=prioritarios&search=Carlos+Mendoza)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const q = params.get('search') || params.get('q')
    const filter = params.get('filter') || params.get('tab')
    const psyc = params.get('psychologist') || params.get('psyc')
    if (q !== null && q !== searchTerm) setSearchTerm(q)
    if (filter && filter !== quickFilter) setQuickFilter(filter)
    if (psyc && psyc !== selectedPsyc) setSelectedPsyc(psyc)
  }, [location.search])

  // Sincronizar approvedFilter y quickFilter cuando se navega entre Mesa Psicólogas y Mesa Oficial MATCHES
  useEffect(() => {
    if (isOfficialMatches) {
      setApprovedFilter('yes')
      setQuickFilter(prev => ['all', 'aprobados', 'vip', 'no_vip_agendar', 'pendientes_agendar', 'cita_programada', 'rechazados', 'pausa'].includes(prev) ? prev : 'no_vip_agendar')
    }
  }, [isOfficialMatches])

  // Asistente Clínico & Sugerencias IA Modal: { clientName, crmId, matchRow, tab: 'sugerencias' | 'objetivos' | 'percepcion' }
  const [aiModalTarget, setAiModalTarget] = useState(null)

  // Modales para mesa oficial MATCHES (Servicio al Cliente)
  const [personFilterTarget, setPersonFilterTarget] = useState(null) // { match, person: 'A' | 'B' }
  const [waTemplateTarget, setWaTemplateTarget] = useState(null) // { match, templateType: 'confirmacion' | 'dia_antes' | 'hoy' }

  // Modos de visualización ergonómica (Sheets vs Cómodo)
  const [density, setDensity] = useState(() => localStorage.getItem('matches_density') || 'comfortable')
  const [quickFilter, setQuickFilter] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const f = params.get('filter') || params.get('tab')
      if (f) return f
    }
    return isOfficialMatches ? 'no_vip_agendar' : 'sin_b'
  })
  const [serverCounts, setServerCounts] = useState(null)
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

  const [sortBy, setSortBy] = useState('oldest_first')
  const [dateFilter, setDateFilter] = useState('all')
  const [approvalDateFilter, setApprovalDateFilter] = useState('')

  const fetchMatches = useCallback(() => {
    setLoading(true)
    const effectiveApproved = isOfficialMatches ? 'yes' : approvedFilter
    let url = `${API}/api/v1/matchmaking/my-matches?view_mode=${viewMode}&sort_by=${encodeURIComponent(sortBy)}&`
    if (selectedPsyc && selectedPsyc !== 'all') url += `psychologist=${encodeURIComponent(selectedPsyc)}&`
    if (statusFilter && statusFilter !== 'all') url += `status_filter=${encodeURIComponent(statusFilter)}&`
    if (cityFilter && cityFilter !== 'all') url += `city=${encodeURIComponent(cityFilter)}&`
    if (planFilter && planFilter !== 'all') url += `plan_tier=${encodeURIComponent(planFilter)}&`
    if (effectiveApproved && effectiveApproved !== 'all') url += `approved=${encodeURIComponent(effectiveApproved)}&`
    if (dateFilter && dateFilter !== 'all') url += `date_filter=${encodeURIComponent(dateFilter)}&`
    if (approvalDateFilter) url += `approved_date=${encodeURIComponent(approvalDateFilter)}&`
    if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`
    if (quickFilter && quickFilter !== 'all') {
      url += `quick_filter=${encodeURIComponent(quickFilter)}&`
    } else if (quickFilter === 'all') {
      url += `all_matches=true&`
    }
    url += `page_size=300&`

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setMatches(data.matches || [])
        if (data.counts) {
          setServerCounts(data.counts)
        }
        if (data.cross_review_count !== undefined) {
          setCrossReviewCount(data.cross_review_count)
        }
        if (data.inherited_from_label !== undefined) {
          setInheritedFromLabel(data.inherited_from_label)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching matches:', err)
        setLoading(false)
      })
  }, [viewMode, selectedPsyc, statusFilter, cityFilter, planFilter, approvedFilter, isOfficialMatches, sortBy, dateFilter, approvalDateFilter, searchTerm, quickFilter, token])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  useEffect(() => {
    setCurrentPage(1)
  }, [viewMode, selectedPsyc, statusFilter, cityFilter, planFilter, approvedFilter, searchTerm, quickFilter, ownershipFilter])

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

  // Helpers para clasificar filas de Parejas Oficiales Confirmadas (MATCHES)
  const isStrictlyApprovedByMaria = (m) => {
    const hasBothPersons = Boolean(m.person_a && m.person_a.trim() !== '' && m.person_b && m.person_b.trim() !== '')
    const stUpper = (m.status || '').trim().toUpperCase()
    const isPreApproval = ['LISTO PARA MATCH', 'PENDIENTE', 'REVISAR', 'NOT APPROVED', 'PENDIENTE PLAN', 'HECHO', 'HECHO POR MAPE', 'PROPUESTO'].includes(stUpper)
    return hasBothPersons && Boolean(m.approved_by_maria) && !isPreApproval
  }

  const checkIsVipPerson = (planStr, flagBool) => {
    if (flagBool) return true
    const up = (planStr || '').toUpperCase()
    return up.includes('VIP') || up.includes('195') || up.includes('295') || up.includes('EXPERIENCE') || up.includes('ORO')
  }

  const checkIsVipMatch = (m) => {
    return Boolean(
      m.is_vip_match ||
      checkIsVipPerson(m.plan_tier, m.is_vip_a) ||
      checkIsVipPerson(m.person_b_plan_tier, m.is_vip_b)
    )
  }

  const checkIsRejectedMatch = (m) => {
    const stUpper = (m.status || '').toUpperCase()
    return (
      m.person_a_confirmation === 'Rechazó' ||
      m.person_b_confirmation === 'Rechazó' ||
      stUpper.includes('RECHAZADO') ||
      stUpper === 'CANCELADA'
    )
  }

  const checkIsPausedMatch = (m) => {
    const stUpper = (m.status || '').toUpperCase()
    return (
      ['De viaje', 'Pausa', 'Problema personal'].includes(m.person_a_confirmation) ||
      ['De viaje', 'Pausa', 'Problema personal'].includes(m.person_b_confirmation) ||
      stUpper.includes('PAUSA')
    )
  }

  const checkHasScheduledVenueOrDate = (m) => {
    const v = (m.scheduled_venue || '').trim()
    const dt = (m.scheduled_date_time || '').trim()
    const stUpper = (m.status || '').toUpperCase()
    return Boolean(
      v !== '' ||
      (dt !== '' && !dt.toLowerCase().includes('por definir')) ||
      ['CITA PROGRAMADA', 'CITA RESERVADA', 'AGENDADA', 'CONFIRMADA', 'CITA REALIZADA', 'CITA COMPLETADA', 'MATCH DONE'].includes(stUpper)
    )
  }

  // Filtrado por Propios vs Heredados (para vista de Psicólogas)
  const ownershipFilteredMatches = matches.filter(m => {
    if (isOfficialMatches) return true
    if (ownershipFilter === 'propios') return !m.is_inherited
    if (ownershipFilter === 'heredados') return Boolean(m.is_inherited)
    return true
  })

  const propiosCount = matches.filter(m => !m.is_inherited).length
  const heredadosCount = matches.filter(m => Boolean(m.is_inherited)).length
  const activeInheritedLabel = inheritedFromLabel || INHERITED_PSYCHOLOGIST_LABELS[selectedPsyc] || (heredadosCount > 0 ? 'Carteras Heredadas' : null)

  // Conjunto base de parejas oficialmente aprobadas por María pendientes por restaurante (si tienen restaurante pasan a Citas Agendadas, si rechazan vuelven a su psicóloga)
  const officialBaseMatches = matches.filter(m => {
    if (approvalDateFilter) {
      const mAppDate = (m.approved_at || m.date || m.fecha || '').slice(0, 10)
      if (mAppDate && mAppDate !== approvalDateFilter) return false
    }
    return isStrictlyApprovedByMaria(m) && !checkHasScheduledVenueOrDate(m) && !checkIsRejectedMatch(m)
  })

  const officialTotalCount = serverCounts?.aprobados ?? officialBaseMatches.length
  const officialVipCount = serverCounts?.vip ?? officialBaseMatches.filter(m => checkIsVipMatch(m)).length
  const officialNoVipAgendarCount = serverCounts?.no_vip_agendar ?? officialBaseMatches.filter(m => !checkIsVipMatch(m) && !checkIsPausedMatch(m)).length
  const officialPausaCount = serverCounts?.pausa ?? officialBaseMatches.filter(m => checkIsPausedMatch(m)).length

  const displayedMatches = (isOfficialMatches ? officialBaseMatches : ownershipFilteredMatches).filter(m => {
    if (!isOfficialMatches && approvalDateFilter) {
      const mAppDate = (m.approved_at || m.date || m.fecha || '').slice(0, 10)
      if (mAppDate && mAppDate !== approvalDateFilter) return false
    }
    if (isOfficialMatches) {
      if (quickFilter === 'vip') return checkIsVipMatch(m)
      if (quickFilter === 'no_vip_agendar') return !checkIsVipMatch(m) && !checkIsPausedMatch(m)
      if (quickFilter === 'pausa') return checkIsPausedMatch(m)
      return true
    }
    if (quickFilter === 'prioritarios') return m.is_priority
    if (quickFilter === 'novedades') return Boolean(m.cs_novedades_count && m.cs_novedades_count > 0)
    if (quickFilter === 'sin_b') return !m.person_b || m.person_b.trim() === ''
    if (quickFilter === 'listos') return (m.status || '').toLowerCase().includes('listo') && m.person_b && m.person_b.trim() !== ''
    if (quickFilter === 'pausa') return (m.status || '').toUpperCase().includes('PAUSA')
    if (quickFilter === 'aprobados') return Boolean(m.approved_by_maria) || (m.status || '').toUpperCase().includes('APROBADO')
    return true
  })

  const totalPages = Math.ceil(displayedMatches.length / pageSize) || 1
  const paginatedMatches = displayedMatches.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Métricas para píldoras de acceso rápido (en vista de Psicóloga respetan Propios vs Heredados)
  const totalCount = serverCounts?.all ?? ownershipFilteredMatches.length
  const prioritariosCount = serverCounts?.prioritarios ?? ownershipFilteredMatches.filter(m => m.is_priority).length
  const conNovedadCount = ownershipFilteredMatches.filter(m => Boolean(m.cs_novedades_count && m.cs_novedades_count > 0)).length
  const sinBCount = serverCounts?.sin_b ?? ownershipFilteredMatches.filter(m => !m.person_b || m.person_b.trim() === '').length
  const listosCount = serverCounts?.listos ?? ownershipFilteredMatches.filter(m => (m.status || '').toLowerCase().includes('listo') && m.person_b && m.person_b.trim() !== '').length
  const enPausaCount = serverCounts?.pausa ?? ownershipFilteredMatches.filter(m => (m.status || '').toUpperCase().includes('PAUSA')).length
  const aprobadosCount = serverCounts?.aprobados ?? ownershipFilteredMatches.filter(m => Boolean(m.approved_by_maria) || (m.status || '').toUpperCase().includes('APROBADO')).length

  const [isLight, setIsLight] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.body.classList.contains('light-mode') || localStorage.getItem('theme') === 'light'
    }
    return false
  })

  useEffect(() => {
    const checkTheme = () => {
      setIsLight(document.body.classList.contains('light-mode') || localStorage.getItem('theme') === 'light')
    }
    checkTheme()
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    window.addEventListener('storage', checkTheme)
    return () => {
      observer.disconnect()
      window.removeEventListener('storage', checkTheme)
    }
  }, [])

  const [compatibilityModalData, setCompatibilityModalData] = useState(null)
  const [loadingCompatId, setLoadingCompatId] = useState(null)
  const [notifyingCs, setNotifyingCs] = useState(false)
  const [csNotifiedSuccess, setCsNotifiedSuccess] = useState('')

  const handleNotifyCsUpsell = async (matchRow, pB, pA) => {
    const personBName = pB?.name || matchRow?.person_b
    if (!personBName) return
    const personBCrm = pB?.crm_id || matchRow?.person_b_crm_id || ''
    const personAName = pA?.name || matchRow?.person_a || ''

    setNotifyingCs(true)
    setCsNotifiedSuccess('')
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/notify-cs-upsell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          match_id: matchRow?.id || null,
          person_b_name: personBName,
          person_b_crm_id: String(personBCrm || ''),
          person_a_name: personAName,
          details: `Persona B (${personBName}) ya cumplió sus citas pactadas y se propone para cita con ${personAName || 'Persona A'}. Se solicita a CS comunicarse con ella para ofrecerle adquirir una nueva cita.`
        })
      })
      const data = await res.json()
      if (res.ok) {
        setCsNotifiedSuccess(`📢 Ticket de venta registrado en CS para ${personBName}. Se gestionará el contacto para nueva cita.`)
        setTimeout(() => setCsNotifiedSuccess(''), 7000)
      } else {
        alert(data.detail || 'Error al notificar a CS')
      }
    } catch (err) {
      alert('Error de conexión al notificar a CS')
    } finally {
      setNotifyingCs(false)
    }
  }

  const runCompatibilityCheck = async (matchRow, pbName, pbCrmId, pbUrl = '', forceOpenModal = false, forceRefresh = false) => {
    if (!matchRow?.person_a || (!pbName && !pbCrmId && !pbUrl)) return
    setLoadingCompatId(matchRow.id)
    try {
      const compRes = await fetch(`${API}/api/v1/matchmaking/check-compatibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          match_id: matchRow.id,
          force_refresh: forceRefresh,
          person_a_name: matchRow.person_a,
          person_a_crm_id: String(matchRow.person_a_crm_id || ''),
          person_b_name: pbName || '',
          person_b_crm_id: String(pbCrmId || ''),
          person_b_url: pbUrl || ''
        })
      })
      if (compRes.ok) {
        const compData = await compRes.json()
        const resolvedPsycBFromCheck = compData?.profile_b?.psychologist || ''
        const resolvedNameBFromCheck = compData?.profile_b?.name || pbName || ''
        const resolvedCidBFromCheck = compData?.profile_b?.crm_id || pbCrmId || ''

        const compScore = compData?.canonical_analysis?.score_factual ?? compData?.ai_evaluation?.ai_score
        const compVerdict = compData?.canonical_analysis?.veredicto ?? compData?.ai_evaluation?.veredicto

        setMatches(prev => prev.map(m => m.id === matchRow.id ? {
          ...m,
          person_b: resolvedNameBFromCheck || m.person_b,
          person_b_crm_id: resolvedCidBFromCheck || m.person_b_crm_id,
          psychologist_b: resolvedPsycBFromCheck || m.psychologist_b || '',
          compatibility_score: compScore !== undefined ? compScore : m.compatibility_score,
          compatibility_verdict: compVerdict || m.compatibility_verdict,
          has_cached_analysis: true
        } : m))

        const hasBlockingIssues = !compData.compatible || (compData.issues && compData.issues.length > 0)
        const hasWarnings = compData.warnings && compData.warnings.length > 0
        const hasAiDealbreakers = compData.ai_evaluation && (
          compData.ai_evaluation.veredicto === 'NO RECOMENDADO' ||
          (compData.ai_evaluation.deal_breakers && compData.ai_evaluation.deal_breakers.length > 0) ||
          (compData.ai_evaluation.red_flags_seguridad && compData.ai_evaluation.red_flags_seguridad.length > 0)
        )

        if (forceOpenModal || hasBlockingIssues || hasWarnings || hasAiDealbreakers) {
          setCompatibilityModalData({
            matchId: matchRow.id,
            matchRow: {
              ...matchRow,
              person_b: resolvedNameBFromCheck || matchRow.person_b,
              person_b_crm_id: resolvedCidBFromCheck || matchRow.person_b_crm_id,
              compatibility_score: compScore !== undefined ? compScore : matchRow.compatibility_score,
              compatibility_verdict: compVerdict || matchRow.compatibility_verdict
            },
            compData
          })
        }
      }
    } catch (err) {
      console.error('Error checking compatibility:', err)
    } finally {
      setLoadingCompatId(null)
    }
  }

  const handleUpdateField = async (matchId, field, value, matchRow, bypassCrmValidation = false) => {
    let finalValue = value

    // Interceptar solicitud de REFUND o DESCALIFICADO desde la mesa de psicólogas para enrutar a Lina
    if (field === 'status' && (value === 'REFUND' || value === 'DESCALIFICADO') && !bypassCrmValidation) {
      const initCat = value === 'DESCALIFICADO'
        ? 'Descalificación Clínica / Protocolo de Seguridad'
        : OFFICIAL_REFUND_CATEGORIES[0]
      setRefundCategory(initCat)
      setRefundReason('')
      setRefundPersonName(matchRow.person_a || '')
      setRefundPsychologist(matchRow.psychologist_name || 'General')
      setRefundPlanTier(matchRow.plan_tier || '')
      setRefundModalTarget({ match: matchRow, isStandalone: false, targetPerson: 'A', initialCategory: initCat })
      return
    }

    // Si se edita Persona B, resolver CRM, Psicóloga B y chequear compatibilidad + Quick Notes IA
    let resolvedCrmIdB = ''
    let resolvedPsycB = ''
    let resolvedProfileMetaB = null
    if (field === 'person_b' && value) {
      const isUrlOrId = value.includes('http') || value.includes('smartmatchapp') || value.includes('client/') || value.includes('profile/') || /^\d{3,}$/.test(value.trim())
      if (!isUrlOrId && !bypassCrmValidation) {
        alert('⚠️ Operación Bloqueada: Es OBLIGATORIO ingresar el enlace directo de SmartMatchApp (ej: https://dailylover.smartmatchapp.com/#!/client/...) o el ID CRM de Persona B. El sistema bloquea nombres en texto plano sin enlace.')
        return
      }
      if (isUrlOrId) {
        const mCid = value.match(/(?:client|clients|profile|profiles|user|users|view)(?:\/[a-z_]+)*[/=#!]+(\d+)/i) || value.match(/\/(\d{3,})(?:\/[a-z_]+)*\/?$/i) || value.match(/^(\d{3,})$/)
        if (mCid) resolvedCrmIdB = mCid[1]
        try {
          const resRes = await fetch(`${API}/api/v1/matchmaking/resolve-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ url_or_query: value })
          })
          if (resRes.ok) {
            const dataRes = await resRes.json()
            resolvedProfileMetaB = dataRes
            if (dataRes.name) {
              finalValue = dataRes.name
            }
            if (dataRes.crm_id) {
              resolvedCrmIdB = String(dataRes.crm_id)
            }
            if (dataRes.psychologist) {
              resolvedPsycB = dataRes.psychologist
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
      const patchBody = { [field]: finalValue }
      if (field === 'person_b') {
        patchBody.person_b_crm_id = resolvedCrmIdB || ''
      }
      const res = await fetch(`${API}/api/v1/matchmaking/matches/${matchId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(patchBody)
      })

      const data = await res.json()
      if (!res.ok) {
        setSyncStatus('error')
        alert(data.detail || 'Error al actualizar')
      } else {
        const effectivePB = (field === 'person_b' ? (data.person_b ?? finalValue) : finalValue)
        const effectivePBCid = (field === 'person_b' ? (data.person_b_crm_id ?? resolvedCrmIdB) : undefined)
        const effectivePsycB = (field === 'person_b' ? (data.psychologist_b || resolvedPsycB || '') : undefined)

        setMatches(prev => prev.map(m => m.id === matchId ? {
          ...m,
          [field]: effectivePB,
          ...(field === 'person_b' ? {
            person_b_crm_id: effectivePBCid || '',
            psychologist_b: effectivePB ? (effectivePsycB || m.psychologist_b || '') : '',
            person_b_meta: resolvedProfileMetaB || m.person_b_meta || null
          } : {})
        } : m))
        setFeedbackMsg('Actualizado correctamente')
        setSyncStatus('synced')
        setTimeout(() => setFeedbackMsg(''), 2500)

        if (field === 'person_b' && effectivePB && matchRow) {
          runCompatibilityCheck(matchRow, effectivePB, effectivePBCid, value, false)
        }

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

  const handleSubmitRefund = async (e) => {
    e.preventDefault()
    const targetName = refundPersonName.trim()
    if (!targetName) {
      alert('Por favor ingrese o seleccione el nombre del cliente para el refund.')
      return
    }
    setSubmittingRefund(true)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/refunds/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          person_name: targetName,
          psychologist_name: refundPsychologist || 'General',
          plan_tier: refundPlanTier || '',
          category: refundCategory,
          reason: refundReason.trim() || `Solicitud registrada por WhatsApp / Servicio al Cliente`
        })
      })
      if (!res.ok) throw new Error('Error al registrar solicitud de refund')

      // Si proviene de un match existente en pantalla:
      if (refundModalTarget?.match?.id) {
        const m = refundModalTarget.match
        if (refundModalTarget.targetPerson === 'A' || targetName.toLowerCase() === (m.person_a || '').toLowerCase()) {
          await handleUpdateField(m.id, 'status', 'REFUND', m, true)
        } else {
          const prevNotes = m.cs_observations || ''
          const updatedNotes = prevNotes ? `${prevNotes} | [REFUND B: ${targetName} (${refundCategory})]` : `[REFUND B: ${targetName} (${refundCategory})]`
          await handleUpdateScheduleDetails(m.id, { cs_observations: updatedNotes })
        }
      }

      setRefundModalTarget(null)
      setFeedbackMsg(`✓ Solicitud de refund para "${targetName}" enviada a la cola de Lina`)
      setTimeout(() => setFeedbackMsg(''), 4500)
      fetchMatches()
    } catch (err) {
      alert(err.message || 'Error al enviar solicitud')
    } finally {
      setSubmittingRefund(false)
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
        let data = {}
        try {
          data = await res.json()
        } catch (_) {}
        setMatches(prev => prev.map(m => {
          if (m.id !== matchId) return m
          const next = { ...m, ...updates }
          const confA = next.person_a_confirmation || 'Pendiente'
          const confB = next.person_b_confirmation || 'Pendiente'
          if (data.new_match_status) {
            next.status = data.new_match_status
          } else if (confA === 'Rechazó' && confB === 'Rechazó') {
            next.status = 'RECHAZADO AMBOS'
          } else if (confA === 'Rechazó') {
            next.status = 'RECHAZADO POR PERSONA A'
          } else if (confB === 'Rechazó') {
            next.status = 'RECHAZADO POR PERSONA B'
          } else if (['De viaje', 'Pausa', 'Problema personal'].includes(confA) || ['De viaje', 'Pausa', 'Problema personal'].includes(confB)) {
            next.status = 'EN PAUSA'
          }
          return next
        }))
        setFeedbackMsg(data.returned_to_psychologist ? `✓ Match devuelto automáticamente a la psicóloga (${data.new_match_status})` : data.new_match_status ? `✓ Estado actualizado a: ${data.new_match_status}` : '✓ Confirmación y cita actualizadas correctamente')
        setSyncStatus('synced')
        setTimeout(() => setFeedbackMsg(''), 3500)
      } else {
        const errData = await res.json().catch(() => ({}))
        setSyncStatus('error')
        const errMsg = errData.detail || 'Error al actualizar datos de cita'
        alert(errMsg)
        throw new Error(errMsg)
      }
    } catch (e) {
      setSyncStatus('error')
      throw e
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
              ? 'Parejas aprobadas por María pendientes por asignar restaurante (al asignar restaurante pasan a Citas Agendadas; si rechazan vuelven a su psicóloga).'
              : 'Mesa de trabajo operativa para que las psicólogas propongan a Persona B con asistente clínico y sugerencias IA.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {feedbackMsg && (
            <span style={{ fontSize: 12, color: '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle size={14} /> {feedbackMsg}
            </span>
          )}
          {!isOfficialMatches && (isPsychologistRole || isAdmin || isLina) && (
            <button
              onClick={handleOpenManualRefund}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'linear-gradient(135deg, #B8324F 0%, #961500 100%)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(184, 50, 79, 0.35)',
                transition: 'all 0.15s ease'
              }}
              title="Registrar solicitud de refund recibida por WhatsApp (enruta directo a la cola de Lina)"
            >
              <Wallet size={16} /> 💰 + Registrar Refund (WhatsApp)
            </button>
          )}
          <button
            onClick={() => navigate('/matchmaking/profiles' + (selectedPsyc && selectedPsyc !== 'all' ? `?psychologist=${encodeURIComponent(selectedPsyc)}` : ''))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(150, 21, 0, 0.15)',
              color: '#ff8a80',
              border: '1px solid rgba(150, 21, 0, 0.4)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="Ir al módulo de ingreso de perfiles (PROFILES)"
          >
            <FileSpreadsheet size={15} /> 📋 PROFILES
          </button>
          {!isOfficialMatches && (
            <button
              onClick={() => navigate('/matchmaking/profiles' + (selectedPsyc && selectedPsyc !== 'all' ? `?psychologist=${encodeURIComponent(selectedPsyc)}` : ''))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#961500',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(150,21,0,0.3)'
              }}
            >
              <Plus size={16} /> + Ingresar Perfil (PROFILES)
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

      {/* Selector de Modo: Mis Clientes vs Matches Cruzados (Psicóloga B) + Cartera Propios vs Heredados */}
      {!isOfficialMatches && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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

          {/* Botones Rápidos de Cartera: Propios vs Heredados */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--bg-card)',
            padding: '5px 10px',
            borderRadius: 10,
            border: '1px solid var(--border-color)'
          }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 2 }}>
              Cartera:
            </span>
            <button
              type="button"
              onClick={() => { setOwnershipFilter('all'); setCurrentPage(1) }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 8,
                border: ownershipFilter === 'all' ? '1.5px solid #B8324F' : '1px solid var(--border-color)',
                background: ownershipFilter === 'all' ? '#B8324F' : 'var(--bg-base)',
                color: ownershipFilter === 'all' ? '#FFFFFF' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Ver todos los clientes (propios + heredados)"
            >
              👥 Todos ({matches.length})
            </button>
            <button
              type="button"
              onClick={() => { setOwnershipFilter(ownershipFilter === 'propios' ? 'all' : 'propios'); setCurrentPage(1) }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 13px',
                borderRadius: 8,
                border: ownershipFilter === 'propios' ? '1.5px solid #0284C7' : '1px solid var(--border-color)',
                background: ownershipFilter === 'propios' ? '#0284C7' : 'var(--bg-base)',
                color: ownershipFilter === 'propios' ? '#FFFFFF' : 'var(--text-primary)',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: ownershipFilter === 'propios' ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title="Ver únicamente los clientes propios de esta psicóloga"
            >
              👤 Propios
              <span style={{
                padding: '1px 6px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 800,
                background: ownershipFilter === 'propios' ? 'rgba(255,255,255,0.25)' : 'rgba(2, 132, 199, 0.15)',
                color: ownershipFilter === 'propios' ? '#FFFFFF' : '#38BDF8'
              }}>
                {propiosCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setOwnershipFilter(ownershipFilter === 'heredados' ? 'all' : 'heredados'); setCurrentPage(1) }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 13px',
                borderRadius: 8,
                border: ownershipFilter === 'heredados' ? '1.5px solid #8B5CF6' : '1px solid var(--border-color)',
                background: ownershipFilter === 'heredados' ? '#8B5CF6' : 'var(--bg-base)',
                color: ownershipFilter === 'heredados' ? '#FFFFFF' : 'var(--text-primary)',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: ownershipFilter === 'heredados' ? '0 2px 8px rgba(139, 92, 246, 0.35)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title={activeInheritedLabel ? `Ver clientes heredados de ${activeInheritedLabel}` : 'Ver clientes heredados de psicólogas retiradas'}
            >
              🔄 Heredados{activeInheritedLabel ? ` (${activeInheritedLabel})` : ''}
              <span style={{
                padding: '1px 6px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 800,
                background: ownershipFilter === 'heredados' ? 'rgba(255,255,255,0.25)' : 'rgba(139, 92, 246, 0.18)',
                color: ownershipFilter === 'heredados' ? '#FFFFFF' : '#A78BFA'
              }}>
                {heredadosCount}
              </span>
            </button>
          </div>
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
          {psycList.map(p => {
            const inhLabel = INHERITED_PSYCHOLOGIST_LABELS[p]
            return (
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
                title={inhLabel ? `${p} (Incluye cartera heredada de ${inhLabel})` : p}
              >
                {p}{inhLabel ? ` (+${inhLabel.split(' / ')[0]})` : ''}
              </button>
            )
          })}
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { id: 'aprobados', icon: '🔒', label: 'Parejas Oficiales Confirmadas', count: officialTotalCount, activeBg: '#16A34A', activeColor: '#FFFFFF', tooltip: 'Todas las parejas aprobadas por María pendientes de agendar restaurante' },
              { id: 'no_vip_agendar', icon: '⚡', label: 'No-VIP — Agendar de una vez', count: officialNoVipAgendarCount, activeBg: '#0284C7', activeColor: '#FFFFFF', tooltip: 'Clientes No-VIP aprobados por María (cita a ciegas, listos para agendar directamente)' },
              { id: 'vip', icon: '👑', label: 'Parejas con VIP (Ven Fotos / Aprueban)', count: officialVipCount, activeBg: '#D97706', activeColor: '#FFFFFF', tooltip: 'Al menos uno de los dos tiene Plan VIP (ven fotos/perfil antes de la cita y pueden aceptar o rechazar)' },
              { id: 'pausa', icon: '✈️', label: 'Viaje / Pausa Personal', count: officialPausaCount, activeBg: '#EA580C', activeColor: '#FFFFFF', tooltip: 'Parejas en pausa por viaje o situación personal' },
            ].map(pill => {
              const isActive = quickFilter === pill.id || (pill.id === 'aprobados' && quickFilter === 'all')
              return (
                <button
                  key={pill.id}
                  onClick={() => setQuickFilter(pill.id)}
                  title={pill.tooltip}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: isActive ? `1.5px solid ${pill.activeBg}` : '1px solid var(--border-color)',
                    fontSize: 12.5,
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

        {/* Filtro Fecha de Aprobación por María */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: approvalDateFilter ? '#10B981' : 'var(--text-secondary)' }}>
            📅 Aprobación:
          </span>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="date"
              value={approvalDateFilter}
              onChange={e => setApprovalDateFilter(e.target.value)}
              title="Filtrar por fecha de aprobación"
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: approvalDateFilter ? '1.5px solid #10B981' : '1px solid var(--border-color)',
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                fontSize: 12,
                outline: 'none'
              }}
            />
            {approvalDateFilter && (
              <button
                type="button"
                onClick={() => setApprovalDateFilter('')}
                title="Limpiar fecha de aprobación"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 700
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filtro Fecha de Creación / Orden PROFILES */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
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
            <option value="all">📅 Fecha: Todos</option>
            <option value="new_profiles">🆕 Nuevos en PROFILES</option>
            <option value="today">📅 Agregados Hoy</option>
            <option value="7d">📅 Últimos 7 días</option>
            <option value="30d">📅 Últimos 30 días</option>
          </select>
        </div>

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
            <option value="oldest_first">⏳ Más antiguos primero (Mayor espera)</option>
            <option value="recent_first">🕒 Más recientes primero (PROFILES arriba)</option>
            <option value="created_desc">📅 Por fecha de creación (Recientes)</option>
            <option value="sheet_order">📋 Orden Original Sheet</option>
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

      {/* Main Table — Sin doble scroll (solo el scroll principal de la página, 20 personas por página) */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        overflowX: 'auto',
        position: 'relative'
      }}>
        {viewMode === 'cross_review' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isCompact ? 12 : 13 }}>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isCompact ? 12 : 13 }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: '12px 10px', fontWeight: 800, width: 165 }}>ESTADO FINAL</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: '12px 12px', fontWeight: 800 }}>PERSONA A (CONTACTO & CONFIRMACIÓN)</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: '12px 12px', fontWeight: 800 }}>PERSONA B (CONTACTO & CONFIRMACIÓN)</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: '12px 10px', fontWeight: 800, width: 205 }}>RESTAURANTE / CITA</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: '12px 12px', fontWeight: 800, width: 220 }}>OBSERVACIONES CS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    Cargando parejas oficiales aprobadas por María...
                  </td>
                </tr>
              ) : paginatedMatches.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    <ShieldCheck size={32} style={{ color: '#10B981', margin: '0 auto 8px', display: 'block' }} />
                    No hay parejas aprobadas por María pendientes por restaurante para este filtro.
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

                  const isVipA = checkIsVipPerson(m.plan_tier, m.is_vip_a)
                  const isVipB = checkIsVipPerson(m.person_b_plan_tier, m.is_vip_b)

                  // Estado efectivo sincronizado con rechazos de Persona A o Persona B
                  let effectiveRowStatus = m.status || 'APROBADO'
                  if (m.person_a_confirmation === 'Rechazó' && m.person_b_confirmation === 'Rechazó') {
                    effectiveRowStatus = 'RECHAZADO AMBOS'
                  } else if (m.person_a_confirmation === 'Rechazó') {
                    effectiveRowStatus = 'RECHAZADO POR PERSONA A'
                  } else if (m.person_b_confirmation === 'Rechazó') {
                    effectiveRowStatus = 'RECHAZADO POR PERSONA B'
                  } else if (['LISTO PARA MATCH', 'REVISAR', 'PENDIENTE', 'HECHO', 'HECHO POR MAPE'].includes((effectiveRowStatus || '').toUpperCase())) {
                    effectiveRowStatus = 'APROBADO'
                  }

                  const isRejectedRow = effectiveRowStatus.includes('RECHAZADO') || effectiveRowStatus === 'CANCELADA'

                  return (
                    <tr
                      key={m.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: isRejectedRow ? 'rgba(239, 68, 68, 0.05)' : currentVenue ? 'rgba(16, 185, 129, 0.03)' : 'transparent',
                        transition: 'background 0.15s'
                      }}
                    >
                      {/* 1. ESTADO FINAL (A la izquierda de Persona A) */}
                      <td style={{ padding: '10px 10px', verticalAlign: 'middle' }}>
                        <select
                          value={effectiveRowStatus}
                          onChange={e => handleUpdateField(m.id, 'status', e.target.value, m)}
                          style={{
                            padding: '5px 8px',
                            borderRadius: 6,
                            border: '1px solid var(--border-color)',
                            background: STATUS_COLORS[effectiveRowStatus]?.bg || 'rgba(182, 215, 168, 0.2)',
                            color: STATUS_COLORS[effectiveRowStatus]?.color || '#274E13',
                            fontSize: 11,
                            fontWeight: 800,
                            outline: 'none',
                            cursor: 'pointer',
                            width: '100%',
                            maxWidth: 165
                          }}
                        >
                          <option value="APROBADO">APROBADO</option>
                          <option value="AGENDANDO">AGENDANDO</option>
                          <option value="POR CONFIRMAR">POR CONFIRMAR</option>
                          <option value="CONFIRMADA">CONFIRMADA</option>
                          <option value="CITA PROGRAMADA">CITA PROGRAMADA</option>
                          <option value="CITA RESERVADA">CITA RESERVADA</option>
                          <option value="AGENDADA">AGENDADA</option>
                          <option value="CITA REALIZADA">CITA REALIZADA</option>
                          <option value="CITA COMPLETADA">CITA COMPLETADA</option>
                          <option value="RECHAZADO POR PERSONA A">❌ RECHAZADO POR PERSONA A</option>
                          <option value="RECHAZADO POR PERSONA B">❌ RECHAZADO POR PERSONA B</option>
                          <option value="RECHAZADO AMBOS">❌ RECHAZADO AMBOS</option>
                          <option value="REPROGRAMAR">REPROGRAMAR</option>
                          <option value="EN PAUSA">EN PAUSA (Viaje / Personal)</option>
                          <option value="CANCELADA">CANCELADA</option>
                          <option value="TROUBLEMAKER">TROUBLEMAKER</option>
                        </select>
                      </td>

                      {/* 2. PERSONA A (Contacto + Badge VIP/No-VIP + Confirmación al lado derecho) */}
                      <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                                <CrmPersonLink name={m.person_a} crmId={m.person_a_crm_id || m.ua_crm_id} />
                              </div>
                              {isVipA ? (
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 800,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: '#FFE599',
                                    color: '#7F6000',
                                    border: '1px solid rgba(127, 96, 0, 0.3)'
                                  }}
                                  title="Cliente VIP: recibe fotos/perfil de la pareja antes de la cita y puede aprobar o rechazar"
                                >
                                  👑 VIP (Ve Fotos)
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: 'rgba(2, 132, 199, 0.14)',
                                    color: '#38BDF8',
                                    border: '1px solid rgba(2, 132, 199, 0.3)'
                                  }}
                                  title={`Plan ${m.plan_tier || 'Estándar'} (No-VIP): cita a ciegas sin fotos previas — listo para agendar de una vez salvo viaje o imprevisto personal`}
                                >
                                  ⚡ No-VIP (Agendar ya)
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
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
                              {(() => {
                                const urlMatchA = (m.observations || '').match(/https?:\/\/[^\s]+/)
                                if (!urlMatchA) return null
                                const folderUrlA = urlMatchA[0].replace(/[)\]]+$/, '')
                                return (
                                  <a
                                    href={folderUrlA}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      fontSize: 10,
                                      color: '#ff8a80',
                                      textDecoration: 'none',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                      background: 'rgba(150, 21, 0, 0.12)',
                                      border: '1px solid rgba(150, 21, 0, 0.3)',
                                      padding: '1px 5px',
                                      borderRadius: 3,
                                      fontWeight: 700
                                    }}
                                    title={`Abrir Carpeta / Perfil: ${folderUrlA}`}
                                  >
                                    <ExternalLink size={9} /> Carpeta
                                  </a>
                                )
                              })()}
                            </div>
                          </div>

                          {/* Confirmación Persona A al lado derecho */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: isVipA ? '#FBBF24' : 'var(--text-muted)', textTransform: 'uppercase' }}>
                              {isVipA ? '👑 Aprobación VIP' : '⚡ Estado Cita'}
                            </span>
                            <select
                              value={m.person_a_confirmation || 'Pendiente'}
                              onChange={e => handleUpdateScheduleDetails(m.id, { person_a_confirmation: e.target.value })}
                              style={{
                                padding: '4px 7px',
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
                              <option value="Pendiente">{isVipA ? 'Pendiente (Ver fotos)' : 'Listo p/ Agendar'}</option>
                              <option value="Aceptó">{isVipA ? 'Aceptó Perfil ✓' : 'Aceptó / Agendado ✓'}</option>
                              <option value="Rechazó">{isVipA ? 'Rechazó Perfil ✗' : 'Rechazó ✗'}</option>
                              <option value="De viaje">De viaje ✈️</option>
                              <option value="Pausa">Pausa / Personal ⚠️</option>
                              <option value="No contesta">No contesta</option>
                            </select>
                          </div>
                        </div>
                      </td>

                      {/* 3. PERSONA B (Contacto + Badge VIP/No-VIP + Confirmación al lado derecho) */}
                      <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--color-primary)' }}>
                                <CrmPersonLink name={m.person_b} crmId={m.person_b_crm_id || m.ub_crm_id} />
                              </div>
                              {isVipB ? (
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 800,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: '#FFE599',
                                    color: '#7F6000',
                                    border: '1px solid rgba(127, 96, 0, 0.3)'
                                  }}
                                  title="Cliente VIP: recibe fotos/perfil de la pareja antes de la cita y puede aprobar o rechazar"
                                >
                                  👑 VIP (Ve Fotos)
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: 'rgba(2, 132, 199, 0.14)',
                                    color: '#38BDF8',
                                    border: '1px solid rgba(2, 132, 199, 0.3)'
                                  }}
                                  title={`Plan ${m.person_b_plan_tier || 'Estándar'} (No-VIP): cita a ciegas sin fotos previas — listo para agendar de una vez salvo viaje o imprevisto personal`}
                                >
                                  ⚡ No-VIP (Agendar ya)
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
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
                            <span style={{ fontSize: 9, fontWeight: 700, color: isVipB ? '#FBBF24' : 'var(--text-muted)', textTransform: 'uppercase' }}>
                              {isVipB ? '👑 Aprobación VIP' : '⚡ Estado Cita'}
                            </span>
                            <select
                              value={m.person_b_confirmation || 'Pendiente'}
                              onChange={e => handleUpdateScheduleDetails(m.id, { person_b_confirmation: e.target.value })}
                              style={{
                                padding: '4px 7px',
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
                              <option value="Pendiente">{isVipB ? 'Pendiente (Ver fotos)' : 'Listo p/ Agendar'}</option>
                              <option value="Aceptó">{isVipB ? 'Aceptó Perfil ✓' : 'Aceptó / Agendado ✓'}</option>
                              <option value="Rechazó">{isVipB ? 'Rechazó Perfil ✗' : 'Rechazó ✗'}</option>
                              <option value="De viaje">De viaje ✈️</option>
                              <option value="Pausa">Pausa / Personal ⚠️</option>
                              <option value="No contesta">No contesta</option>
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

                      {/* 5. OBSERVACIONES CS */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
                              flex: 1,
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
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isCompact ? 13 : 14 }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '10px 14px' : '14px 18px', fontWeight: 800, letterSpacing: '0.04em' }}>PERSONA A</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '10px 14px' : '14px 18px', fontWeight: 800, letterSpacing: '0.04em' }}>PERSONA B (PROPUESTA)</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '10px 12px' : '14px 14px', fontWeight: 800, letterSpacing: '0.04em' }}>PSICÓLOGA DE B</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '10px 12px' : '14px 14px', fontWeight: 800, letterSpacing: '0.04em' }} title="Fecha de pago en Stripe o fecha de creación del slot">FECHA / PAGO</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '10px 14px' : '14px 18px', fontWeight: 800, letterSpacing: '0.04em' }}>STATUS</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '10px 8px' : '14px 12px', fontWeight: 800, textAlign: 'center', width: 95, letterSpacing: '0.04em' }}>APROBADO</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', padding: isCompact ? '10px 14px' : '14px 18px', fontWeight: 800, letterSpacing: '0.04em' }}>OBSERVACIONES</th>
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
                          {m.is_inherited ? (
                            <span
                              style={{
                                fontSize: isCompact ? 9 : 10,
                                padding: isCompact ? '2px 6px' : '2px 7px',
                                borderRadius: 4,
                                background: 'rgba(139, 92, 246, 0.16)',
                                border: '1px solid rgba(139, 92, 246, 0.45)',
                                color: '#A78BFA',
                                fontWeight: 800,
                                letterSpacing: '0.02em'
                              }}
                              title={`Cliente heredado de ${m.inherited_from || 'psicóloga anterior'} -> asignado a ${m.assigned_psychologist || selectedPsyc}`}
                            >
                              🔄 Heredado{m.inherited_from ? ` (${m.inherited_from})` : ''}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: isCompact ? 9 : 9.5,
                                padding: '1px 5px',
                                borderRadius: 4,
                                background: 'rgba(2, 132, 199, 0.12)',
                                border: '1px solid rgba(2, 132, 199, 0.3)',
                                color: '#38BDF8',
                                fontWeight: 700
                              }}
                              title={`Cliente propio de ${m.assigned_psychologist || m.psychologist_name}`}
                            >
                              👤 Propio
                            </span>
                          )}
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              key={`${m.id}-${m.person_b || ''}-${m.person_b_crm_id || ''}`}
                              type="text"
                              defaultValue={m.person_b || ''}
                              placeholder="Pegar URL SmartMatchApp de Persona B..."
                              disabled={isLocked}
                              onPaste={e => {
                                const pasted = (e.clipboardData || window.clipboardData)?.getData('text') || ''
                                if (pasted && (pasted.includes('http') || pasted.includes('smartmatchapp') || pasted.includes('client/'))) {
                                  e.preventDefault()
                                  handleUpdateField(m.id, 'person_b', pasted.trim(), m)
                                }
                              }}
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
                                fontWeight: 700,
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

                          {/* Sub-barra de información y Análisis IA de Persona B */}
                          {m.person_b && m.person_b.trim() !== '' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {m.person_b_crm_id && (
                                <a
                                  href={getSmartMatchAppUrl(m.person_b, m.person_b_crm_id)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    color: '#B8324F',
                                    background: 'rgba(184, 50, 79, 0.12)',
                                    padding: '2px 7px',
                                    borderRadius: 5,
                                    textDecoration: 'none'
                                  }}
                                  title="Abrir perfil de Persona B en SmartMatchApp"
                                >
                                  🔗 #{m.person_b_crm_id} <ExternalLink size={10} />
                                </a>
                              )}
                              {(() => {
                                const hasScore = m.compatibility_score !== undefined && m.compatibility_score !== null
                                const score = m.compatibility_score
                                const verdict = m.compatibility_verdict || ''

                                let btnBg, btnBorder, btnColor, btnText
                                if (loadingCompatId === m.id) {
                                  btnBg = isLight ? '#F1F5F9' : 'rgba(255,255,255,0.08)'
                                  btnBorder = isLight ? '1px solid #CBD5E1' : '1px solid rgba(255,255,255,0.15)'
                                  btnColor = isLight ? '#475569' : '#CBD5E1'
                                  btnText = '⏳ Analizando...'
                                } else if (hasScore) {
                                  if (score >= 70) {
                                    btnBg = isLight ? '#ECFDF5' : 'rgba(16, 185, 129, 0.16)'
                                    btnBorder = isLight ? '1px solid #A7F3D0' : '1px solid rgba(16, 185, 129, 0.4)'
                                    btnColor = isLight ? '#065F46' : '#34D399'
                                  } else if (score >= 45) {
                                    btnBg = isLight ? '#FFFBEB' : 'rgba(245, 158, 11, 0.16)'
                                    btnBorder = isLight ? '1px solid #FCD34D' : '1px solid rgba(245, 158, 11, 0.4)'
                                    btnColor = isLight ? '#92400E' : '#FBBF24'
                                  } else {
                                    btnBg = isLight ? '#FEF2F2' : 'rgba(239, 68, 68, 0.16)'
                                    btnBorder = isLight ? '1px solid #FCA5A5' : '1px solid rgba(239, 68, 68, 0.4)'
                                    btnColor = isLight ? '#991B1B' : '#F87171'
                                  }
                                  const shortVerdict = verdict.length > 20 ? verdict.substring(0, 18) + '...' : verdict
                                  btnText = `🧠 ${score}% • ${shortVerdict || 'Evaluado'}`
                                } else {
                                  btnBg = isLight ? '#EEF2FF' : 'rgba(99, 91, 255, 0.14)'
                                  btnBorder = isLight ? '1px solid #C7D2FE' : '1px solid rgba(99, 91, 255, 0.35)'
                                  btnColor = isLight ? '#4338CA' : '#A594FD'
                                  btnText = '🧠 Compatibilidad & Quick Notes IA'
                                }

                                return (
                                  <button
                                    type="button"
                                    onClick={() => runCompatibilityCheck(m, m.person_b, m.person_b_crm_id, '', true)}
                                    disabled={loadingCompatId === m.id}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      color: btnColor,
                                      background: btnBg,
                                      border: btnBorder,
                                      padding: '2px 8px',
                                      borderRadius: 5,
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                    title={hasScore ? `Compatibilidad guardada: ${score}% (${verdict}). Clic para abrir análisis instantáneo.` : "Ver análisis clínico de compatibilidad, Dealbreakers y Quick Notes IA"}
                                  >
                                    {btnText}
                                  </button>
                                )
                              })()}
                            </div>
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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                            {m.scheduled_date_time && m.scheduled_date_time.trim() !== '' && !m.scheduled_date_time.toLowerCase().includes('por definir') && (
                              <div style={{
                                fontSize: isCompact ? 10.5 : 11,
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                fontWeight: 600,
                                flexWrap: 'wrap'
                              }}>
                                <span>📅 {m.scheduled_date_time.split(' ')[0]}</span>
                                {m.scheduled_venue && <span title={m.scheduled_venue}>• 📍 {m.scheduled_venue}</span>}
                              </div>
                            )}
                          </div>
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
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => handleOpenRowRefund(m, 'A')}
                            title="Solicitar Refund / Descalificación a cola de Lina"
                            style={{
                              marginTop: 4,
                              background: 'rgba(239, 68, 68, 0.08)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#EF4444',
                              borderRadius: 6,
                              padding: isCompact ? '2px 5px' : '3px 8px',
                              fontSize: isCompact ? 10 : 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              width: '100%',
                              justifyContent: 'center'
                            }}
                          >
                            <Wallet size={11} /> Solicitar Refund
                          </button>
                        )}
                      </td>

                      {/* APROBADO POR MARÍA */}
                      <td style={{ padding: isCompact ? '8px 6px' : '12px 10px', textAlign: 'center' }}>
                        {isLocked ? (
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <span title={`Aprobado por María (Fila Bloqueada)${m.approved_at ? ` el ${m.approved_at.slice(0, 10)}` : ''}`} style={{ display: 'inline-flex', color: '#274E13' }}>
                              <Lock size={isCompact ? 14 : 17} />
                            </span>
                            {m.approved_at && (
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>
                                {m.approved_at.slice(5, 10)}
                              </span>
                            )}
                          </div>
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

      {/* Barra de Paginación (20 personas por página, sin doble scroll) */}
      {displayedMatches.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginTop: 14,
          padding: '12px 18px',
          background: 'var(--bg-card)',
          borderRadius: 10,
          border: '1px solid var(--border-color)',
          fontSize: 12.5,
          color: 'var(--text-secondary)'
        }}>
          <div>
            Mostrando <strong style={{ color: 'var(--text-primary)' }}>{((currentPage - 1) * pageSize) + 1}</strong> - <strong style={{ color: 'var(--text-primary)' }}>{Math.min(currentPage * pageSize, displayedMatches.length)}</strong> de <strong style={{ color: 'var(--text-primary)' }}>{displayedMatches.length}</strong> {viewMode === 'cross_review' ? 'matches cruzados' : isOfficialMatches ? 'parejas oficiales aprobadas' : 'personas'} <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>({pageSize} por página)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => { setCurrentPage(1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              disabled={currentPage === 1}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: currentPage === 1 ? 'rgba(255,255,255,0.03)' : 'var(--bg-base)',
                color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
              title="Primera página"
            >
              « Primera
            </button>
            <button
              onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
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

            {(() => {
              const pages = []
              const maxVisible = 7
              let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
              let endPage = Math.min(totalPages, startPage + maxVisible - 1)
              if (endPage - startPage + 1 < maxVisible) {
                startPage = Math.max(1, endPage - maxVisible + 1)
              }
              for (let p = startPage; p <= endPage; p++) {
                pages.push(p)
              }
              return pages.map(p => (
                <button
                  key={p}
                  onClick={() => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  style={{
                    minWidth: 32,
                    height: 30,
                    padding: '0 8px',
                    borderRadius: 6,
                    border: currentPage === p ? '1.5px solid #B8324F' : '1px solid var(--border-color)',
                    background: currentPage === p ? '#B8324F' : 'var(--bg-base)',
                    color: currentPage === p ? '#FFFFFF' : 'var(--text-primary)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {p}
                </button>
              ))
            })()}

            <button
              onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
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
            <button
              onClick={() => { setCurrentPage(totalPages); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              disabled={currentPage === totalPages}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: currentPage === totalPages ? 'rgba(255,255,255,0.03)' : 'var(--bg-base)',
                color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
              }}
              title="Última página"
            >
              Última »
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

      {/* MODAL DE SOLICITUD DE REFUND (WHATSAPP / SERVICIO AL CLIENTE Y PSICÓLOGAS) */}
      {refundModalTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1300, padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card, #1A1214)',
            borderRadius: 14,
            border: '1px solid var(--border-color, #333)',
            width: '100%',
            maxWidth: 540,
            padding: 24,
            boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            color: 'var(--text-primary, #FFF)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: 'rgba(184, 50, 79, 0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#B8324F'
                }}>
                  <Wallet size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {refundModalTarget.isStandalone
                      ? '💰 Registrar Refund (WhatsApp / Servicio al Cliente)'
                      : '💰 Registrar Solicitud de Refund'}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Enrutamiento directo a la cola de revisión de Lina con categorización oficial
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRefundModalTarget(null)}
                style={{ background: 'transparent', border: 'none', color: '#999', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Si viene vinculado a una fila de match existente */}
            {refundModalTarget.match && (
              <div style={{
                background: 'var(--bg-base, #111)',
                border: '1px solid var(--border-color, #333)',
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 14
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                  ¿A quién corresponde el refund en esta pareja?
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setRefundModalTarget(prev => ({ ...prev, targetPerson: 'A' }))
                      setRefundPersonName(refundModalTarget.match.person_a)
                      setRefundPsychologist(refundModalTarget.match.psychologist_name || 'General')
                      setRefundPlanTier(refundModalTarget.match.plan_tier || '')
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: refundModalTarget.targetPerson !== 'B' ? '1.5px solid #B8324F' : '1px solid var(--border-color)',
                      background: refundModalTarget.targetPerson !== 'B' ? 'rgba(184, 50, 79, 0.18)' : 'rgba(255,255,255,0.03)',
                      color: refundModalTarget.targetPerson !== 'B' ? '#FFF' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                      textAlign: 'left'
                    }}
                  >
                    👤 Persona A: <strong>{refundModalTarget.match.person_a}</strong>
                  </button>

                  {refundModalTarget.match.person_b && (
                    <button
                      type="button"
                      onClick={() => {
                        setRefundModalTarget(prev => ({ ...prev, targetPerson: 'B' }))
                        setRefundPersonName(refundModalTarget.match.person_b)
                        setRefundPsychologist(refundModalTarget.match.psyc_b || refundModalTarget.match.psychologist_name || 'General')
                        setRefundPlanTier(refundModalTarget.match.plan_tier || '')
                      }}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: refundModalTarget.targetPerson === 'B' ? '1.5px solid #B8324F' : '1px solid var(--border-color)',
                        background: refundModalTarget.targetPerson === 'B' ? 'rgba(184, 50, 79, 0.18)' : 'rgba(255,255,255,0.03)',
                        color: refundModalTarget.targetPerson === 'B' ? '#FFF' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 700,
                        textAlign: 'left'
                      }}
                    >
                      👤 Persona B: <strong>{refundModalTarget.match.person_b}</strong>
                    </button>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitRefund} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Nombre del Cliente */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
                  Nombre del Cliente que solicita el Refund *
                </label>
                <input
                  type="text"
                  required
                  list="refund-clients-datalist"
                  placeholder="Ej: Laura Gómez / Carlos Mendoza"
                  value={refundPersonName}
                  onChange={e => setRefundPersonName(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    background: 'var(--bg-base, #111)', border: '1px solid var(--border-color, #444)',
                    color: '#FFF', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                  }}
                />
                <datalist id="refund-clients-datalist">
                  {Array.from(new Set(matches.flatMap(m => [m.person_a, m.person_b]).filter(Boolean))).slice(0, 100).map(name => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>

              {/* Psicóloga & Plan */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
                    Psicóloga Responsable
                  </label>
                  <select
                    value={refundPsychologist}
                    onChange={e => setRefundPsychologist(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      background: 'var(--bg-base, #111)', border: '1px solid var(--border-color, #444)',
                      color: '#FFF', fontSize: 12.5, outline: 'none', boxSizing: 'border-box'
                    }}
                  >
                    <option value="General">General / No asignada</option>
                    {psycList.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
                    Plan / Membresía
                  </label>
                  <select
                    value={refundPlanTier}
                    onChange={e => setRefundPlanTier(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      background: 'var(--bg-base, #111)', border: '1px solid var(--border-color, #444)',
                      color: '#FFF', fontSize: 12.5, outline: 'none', boxSizing: 'border-box'
                    }}
                  >
                    <option value="">(Desconocido / Sin especificar)</option>
                    <option value="Membresía">Membresía</option>
                    <option value="Plan Esencial">Plan Esencial</option>
                    <option value="Plan Personalizado">Plan Personalizado</option>
                    <option value="Plan VIP">Plan VIP</option>
                    <option value="Plan Elite">Plan Elite</option>
                    <option value="Plan Diamante">Plan Diamante</option>
                    <option value="Matchmaking Experience">Matchmaking Experience</option>
                  </select>
                </div>
              </div>

              {/* Categoría Oficial del Refund */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
                  Categoría Clínica Oficial *
                </label>
                <select
                  value={refundCategory}
                  onChange={e => setRefundCategory(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    background: 'var(--bg-base, #111)', border: '1px solid var(--border-color, #444)',
                    color: '#FFF', fontSize: 12.5, fontWeight: 600, outline: 'none', boxSizing: 'border-box'
                  }}
                >
                  {OFFICIAL_REFUND_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Motivo / Detalle recibido por WhatsApp */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
                  Mensaje / Observación de WhatsApp (Servicio al Cliente) *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Pegue aquí el mensaje recibido por WhatsApp o detalle el motivo del refund..."
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    background: 'var(--bg-base, #111)', border: '1px solid var(--border-color, #444)',
                    color: '#FFF', fontSize: 12.5, outline: 'none', resize: 'vertical', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setRefundModalTarget(null)}
                  disabled={submittingRefund}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color, #444)',
                    background: 'transparent', color: '#BBB', fontSize: 12.5, cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingRefund}
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg, #B8324F 0%, #961500 100%)',
                    color: '#FFF', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 2px 8px rgba(184, 50, 79, 0.4)'
                  }}
                >
                  {submittingRefund ? 'Enviando...' : 'Enviar a Cola de Lina'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE COMPATIBILIDAD CLÍNICA & ANÁLISIS IA DE QUICK NOTES */}
      {compatibilityModalData && (() => {
        const { matchId, matchRow, compData } = compatibilityModalData
        const pA = compData?.profile_a || {}
        const pB = compData?.profile_b || {}
        const ai = compData?.ai_evaluation || {}
        const canon = compData?.canonical_analysis || {}
        const issues = compData?.issues || []
        const warnings = compData?.warnings || []
        const coincidencias = canon.coincidencias_verificadas || ai.coincidencias || []
        const discrepancias = canon.discrepancias_reales || warnings
        const pendientes = canon.pendientes_para_entrevista || ai.pendientes_entrevista || []
        const coveragePct = canon.coverage_pct ?? ai.coverage_pct ?? 65
        const afinidadScore = canon.score_factual ?? ai.ai_score ?? (issues.length > 0 ? 20 : 65)
        const veredicto = canon.veredicto || ai.veredicto || (issues.length > 0 ? 'NO RECOMENDADO' : 'VIABLE')
        const sintesis = canon.sintesis_clinica || ai.analisis || ''
        const isIncompatible = !compData?.compatible || issues.length > 0 || veredicto === 'NO RECOMENDADO'
        const isCached = Boolean(compData?.is_cached)

        return (
          <div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1250, padding: 18
            }}
            onClick={() => setCompatibilityModalData(null)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: isLight ? '#FFFFFF' : 'var(--bg-card, #1A1214)',
                border: isLight
                  ? (isIncompatible ? '1.5px solid #EF4444' : '1.5px solid #F59E0B')
                  : `1.5px solid ${isIncompatible ? '#EF4444' : '#F59E0B'}`,
                borderRadius: 14,
                width: '100%',
                maxWidth: 840,
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: isLight ? '0 24px 64px rgba(0,0,0,0.18)' : '0 18px 48px rgba(0,0,0,0.75)'
              }}
            >
              {/* Header */}
              <div style={{
                padding: '16px 22px',
                borderBottom: isLight ? '1px solid #E2E8F0' : '1px solid var(--border-color)',
                background: isLight
                  ? (isIncompatible
                      ? 'linear-gradient(135deg, #FEF2F2 0%, #FFFFFF 100%)'
                      : 'linear-gradient(135deg, #FFFBEB 0%, #FFFFFF 100%)')
                  : (isIncompatible
                      ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(26, 18, 20, 0.95) 100%)'
                      : 'linear-gradient(135deg, rgba(245, 158, 11, 0.16) 0%, rgba(26, 18, 20, 0.95) 100%)'),
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 10,
                    background: isLight
                      ? (isIncompatible ? '#FEE2E2' : '#FEF3C7')
                      : (isIncompatible ? 'rgba(239, 68, 68, 0.22)' : 'rgba(245, 158, 11, 0.22)'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22
                  }}>
                    {isIncompatible ? '🚨' : '🧠'}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h3 style={{
                        margin: 0,
                        fontSize: 16,
                        fontWeight: 800,
                        color: isLight ? (isIncompatible ? '#991B1B' : '#92400E') : 'var(--text-primary)'
                      }}>
                        {isIncompatible
                          ? 'Incompatibilidad / Dealbreaker Detectado entre Perfiles'
                          : 'Evaluación de Afinidad Factual 360°'}
                      </h3>
                      <span style={{
                        padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 800,
                        background: isLight
                          ? (afinidadScore >= 70 ? '#ECFDF5' : afinidadScore >= 45 ? '#FFFBEB' : '#FEF2F2')
                          : (afinidadScore >= 70 ? 'rgba(16, 185, 129, 0.2)' : afinidadScore >= 45 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.25)'),
                        color: isLight
                          ? (afinidadScore >= 70 ? '#065F46' : afinidadScore >= 45 ? '#92400E' : '#991B1B')
                          : (afinidadScore >= 70 ? '#10B981' : afinidadScore >= 45 ? '#F59E0B' : '#EF4444'),
                        border: isLight
                          ? (afinidadScore >= 70 ? '1px solid #A7F3D0' : afinidadScore >= 45 ? '1px solid #FCD34D' : '1px solid #FCA5A5')
                          : 'none'
                      }}>
                        Afinidad Factual: {afinidadScore}% • {veredicto}
                      </span>
                      <span style={{
                        padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                        background: isLight ? '#EEF2FF' : 'rgba(99, 91, 255, 0.15)',
                        color: isLight ? '#3730A3' : '#A594FD',
                        border: isLight ? '1px solid #C7D2FE' : '1px solid rgba(99, 91, 255, 0.3)'
                      }}>
                        📊 Ficha Evaluada: {coveragePct}%
                      </span>
                      {isCached && (
                        <span style={{
                          padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                          background: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.08)',
                          color: isLight ? '#475569' : '#CBD5E1',
                          border: isLight ? '1px solid #CBD5E1' : '1px solid rgba(255, 255, 255, 0.15)'
                        }}>
                          ⚡ Guardado en BD
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: isLight ? '#475569' : 'var(--text-secondary)', marginTop: 3 }}>
                      <strong>{pA.name || matchRow?.person_a}</strong> (Psic. {pA.psychologist || matchRow?.psychologist_name || '—'})
                      {' × '}
                      <strong>{pB.name || matchRow?.person_b}</strong> (Psic. B: <strong style={{ color: isLight ? '#B8324F' : '#ff7ac6' }}>{pB.psychologist || 'Sin asignar'}</strong>)
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setCompatibilityModalData(null)}
                  style={{ background: 'none', border: 'none', color: isLight ? '#64748B' : 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* 1. Motivos de Incompatibilidad / Alertas Reales */}
                {(issues.length > 0 || discrepancias.length > 0) && (
                  <div style={{
                    background: isLight
                      ? (issues.length > 0 ? '#FEF2F2' : '#FFFBEB')
                      : (issues.length > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.08)'),
                    border: isLight
                      ? (issues.length > 0 ? '1px solid #FCA5A5' : '1px solid #FCD34D')
                      : `1px solid ${issues.length > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.35)'}`,
                    borderRadius: 10,
                    padding: '12px 16px'
                  }}>
                    <div style={{
                      fontSize: 12.5,
                      fontWeight: 800,
                      color: isLight
                        ? (issues.length > 0 ? '#991B1B' : '#92400E')
                        : (issues.length > 0 ? '#F87171' : '#FBBF24'),
                      marginBottom: 8,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}>
                      ⚠️ {issues.length > 0 ? 'Bloqueos e Incompatibilidades Reales' : 'Discrepancias y Reservas Clínicas Detectadas'}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                      {issues.map((iss, idx) => (
                        <li key={`iss-${idx}`} style={{ color: isLight ? '#991B1B' : '#FCA5A5', fontWeight: 700 }}>{iss}</li>
                      ))}
                      {discrepancias.map((w, idx) => (
                        <li key={`warn-${idx}`} style={{ color: isLight ? '#92400E' : '#FDE68A', fontWeight: 600 }}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 2. Coincidencias Verificadas (Solo datos confirmados) */}
                {coincidencias.length > 0 && (
                  <div style={{
                    background: isLight ? '#ECFDF5' : 'rgba(16, 185, 129, 0.08)',
                    border: isLight ? '1px solid #A7F3D0' : '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: 10,
                    padding: '12px 16px'
                  }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: isLight ? '#065F46' : '#34D399', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      ✅ Coincidencias y Afinidades Verificadas (Solo datos confirmados)
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: isLight ? '#065F46' : '#D1FAE5' }}>
                      {coincidencias.map((c, idx) => (
                        <li key={`coinc-${idx}`} style={{ fontWeight: 600 }}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 3. Pendiente por Validar en Entrevista */}
                {pendientes.length > 0 && (
                  <div style={{
                    background: isLight ? '#EEF2FF' : 'rgba(99, 102, 241, 0.09)',
                    border: isLight ? '1px solid #C7D2FE' : '1px solid rgba(99, 102, 241, 0.35)',
                    borderRadius: 10,
                    padding: '12px 16px'
                  }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: isLight ? '#3730A3' : '#818CF8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      ❓ Pendiente por Validar en Entrevista (Datos no registrados en ficha)
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: isLight ? '#312E81' : '#E0E7FF' }}>
                      {pendientes.map((p, idx) => (
                        <li key={`pend-${idx}`} style={{ fontWeight: 600 }}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 4. Síntesis Clínica Enjaulada */}
                {sintesis && (
                  <div style={{
                    background: isLight
                      ? 'linear-gradient(135deg, #FFF1F2 0%, #FFFFFF 100%)'
                      : 'linear-gradient(135deg, rgba(150, 21, 0, 0.15) 0%, rgba(26, 18, 20, 0.8) 100%)',
                    border: isLight ? '1px solid rgba(150, 21, 0, 0.2)' : '1px solid rgba(184, 50, 79, 0.4)',
                    borderRadius: 10,
                    padding: '12px 16px'
                  }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: isLight ? '#961500' : '#ff7ac6', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      ✨ Síntesis Clínica Enjaulada (Cero Alucinación)
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: isLight ? '#1F1012' : 'var(--text-primary)', whiteSpace: 'pre-line' }}>
                      {sintesis}
                    </div>
                  </div>
                )}

                {/* 5. Comparativa Lado a Lado: Persona A vs Persona B + Quick Notes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {[{ label: 'PERSONA A (CLIENTE)', data: pA, fallbackName: matchRow?.person_a }, { label: 'PERSONA B (CANDIDATO PROPUESTO)', data: pB, fallbackName: matchRow?.person_b }].map((side, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
                        border: isLight ? '1px solid #E2E8F0' : '1px solid var(--border-color)',
                        borderRadius: 10,
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: isLight ? '#64748B' : 'var(--text-muted)', letterSpacing: '0.05em' }}>
                          {side.label}
                        </span>
                        {(side.data.crm_id || side.data.name || side.fallbackName) && (
                          <a
                            href={getSmartMatchAppUrl(side.data.name || side.fallbackName, side.data.crm_id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 11, fontWeight: 700, color: '#B8324F', textDecoration: 'none' }}
                            title="Abrir perfil en SmartMatchApp"
                          >
                            CRM #{side.data.crm_id || 'Buscar'} ↗
                          </a>
                        )}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: isLight ? '#0F172A' : 'var(--text-primary)' }}>
                        {side.data.name || side.fallbackName || '—'}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11.5 }}>
                        <span style={{ background: 'rgba(184, 50, 79, 0.14)', color: isLight ? '#B8324F' : '#ff7ac6', padding: '2px 7px', borderRadius: 5, fontWeight: 700 }}>
                          Psicóloga: {side.data.psychologist || (idx === 0 ? matchRow?.psychologist_name : 'Sin asignar')}
                        </span>
                        {side.data.age && <span style={{ background: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.07)', color: isLight ? '#1E293B' : 'inherit', border: isLight ? '1px solid #E2E8F0' : 'none', padding: '2px 7px', borderRadius: 5 }}>{side.data.age} años</span>}
                        {side.data.city && <span style={{ background: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.07)', color: isLight ? '#1E293B' : 'inherit', border: isLight ? '1px solid #E2E8F0' : 'none', padding: '2px 7px', borderRadius: 5 }}>📍 {side.data.city}</span>}
                        {side.data.orientation && <span style={{ background: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.07)', color: isLight ? '#1E293B' : 'inherit', border: isLight ? '1px solid #E2E8F0' : 'none', padding: '2px 7px', borderRadius: 5 }}>💘 {side.data.orientation}</span>}
                        {side.data.plan_tier && <span style={{ background: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.07)', color: isLight ? '#1E293B' : 'inherit', border: isLight ? '1px solid #E2E8F0' : 'none', padding: '2px 7px', borderRadius: 5 }}>🏷️ {side.data.plan_tier}</span>}
                      </div>
                      <div style={{
                        marginTop: 4,
                        padding: '8px 10px',
                        background: isLight ? '#FFFFFF' : 'rgba(0,0,0,0.28)',
                        borderRadius: 8,
                        border: isLight ? '1px solid #CBD5E1' : '1px solid rgba(255,255,255,0.06)',
                        fontSize: 12,
                        color: isLight ? '#334155' : 'var(--text-secondary)',
                        maxHeight: 140,
                        overflowY: 'auto',
                        whiteSpace: 'pre-line',
                        lineHeight: 1.45
                      }}>
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: isLight ? '#64748B' : 'var(--text-muted)', marginBottom: 4 }}>
                          📋 QUICK NOTES & OBSERVACIONES CLÍNICAS:
                        </div>
                        {side.data.quick_notes || 'Sin Quick Notes registradas en ficha.'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Actions */}
              <div style={{
                padding: '14px 22px',
                borderTop: isLight ? '1px solid #E2E8F0' : '1px solid var(--border-color)',
                background: isLight ? '#F8FAFC' : 'rgba(0,0,0,0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}>
                {csNotifiedSuccess && (
                  <div style={{
                    padding: '8px 14px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid #10B981',
                    borderRadius: 8,
                    color: '#10B981',
                    fontSize: 12.5,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <CheckCircle size={15} /> {csNotifiedSuccess}
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={async () => {
                        setCompatibilityModalData(null)
                        await handleUpdateField(matchId, 'person_b', '', matchRow, true)
                      }}
                      style={{
                        padding: '9px 16px',
                        borderRadius: 8,
                        border: isLight ? '1px solid #FCA5A5' : '1px solid rgba(239, 68, 68, 0.5)',
                        background: isLight ? '#FEF2F2' : 'rgba(239, 68, 68, 0.15)',
                        color: isLight ? '#991B1B' : '#FCA5A5',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      🗑️ Descartar y Quitar Persona B
                    </button>
                    <button
                      type="button"
                      onClick={() => runCompatibilityCheck(matchRow, pB.name || matchRow?.person_b, pB.crm_id || matchRow?.person_b_crm_id, '', true, true)}
                      disabled={loadingCompatId === matchId}
                      style={{
                        padding: '9px 15px',
                        borderRadius: 8,
                        border: isLight ? '1px solid #C7D2FE' : '1px solid rgba(99, 91, 255, 0.4)',
                        background: isLight ? '#EEF2FF' : 'rgba(99, 91, 255, 0.15)',
                        color: isLight ? '#3730A3' : '#A594FD',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                      title="Forzar re-ejecución del motor factual y LLM"
                    >
                      <RefreshCw size={13} className={loadingCompatId === matchId ? 'spin' : ''} />
                      {loadingCompatId === matchId ? 'Re-analizando...' : '🔄 Re-analizar con IA'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNotifyCsUpsell(matchRow, pB, pA)}
                      disabled={notifyingCs}
                      style={{
                        padding: '9px 15px',
                        borderRadius: 8,
                        border: isLight ? '1px solid #FDE68A' : '1px solid rgba(245, 158, 11, 0.4)',
                        background: isLight ? '#FFFBEB' : 'rgba(245, 158, 11, 0.14)',
                        color: isLight ? '#B45309' : '#FBBF24',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                      title="Notificar a Servicio al Cliente que Persona B cumplió citas para ofrecerle pagar nueva cita"
                    >
                      📢 {notifyingCs ? 'Notificando...' : 'Notificar a CS (Venta Nueva Cita)'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCompatibilityModalData(null)}
                    style={{
                      padding: '9px 18px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#FFF',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ✅ Conservar Persona B ({pB.name || matchRow?.person_b})
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
