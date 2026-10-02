import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Clock, Users, ArrowLeftRight, ChevronLeft, ChevronRight, Check, X, Plus, Trash2, Video, Info, Copy } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const WINDOW = { mon: [540, 1200], tue: [540, 1200], wed: [540, 1200], thu: [540, 1200], fri: [540, 1200], sat: [540, 780] }
const pad = (n) => String(n).padStart(2, '0')
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const mondayOf = (d) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x }
const m2s = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
const s2m = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m }
const t12 = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${(h % 12) || 12}${m ? ':' + pad(m) : ''} ${h < 12 ? 'am' : 'pm'}` }
const dayLabel = (iso) => { const d = new Date(iso + 'T00:00:00'); return `${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()}/${d.getMonth() + 1}` }
const horas = (a, b) => Math.round(((s2m(b) - s2m(a)) / 60) * 10) / 10
const stepsFor = (key) => { const [a, b] = WINDOW[key]; const out = []; for (let m = a; m <= b; m += 30) out.push(m2s(m)); return out }

const TYPE = { ENTREVISTAS: { label: 'Entrevistas', tone: 'teal' }, MATCHMAKING: { label: 'Matches', tone: 'rose' } }
const TONES = {
  teal: { bg: 'rgba(20,184,166,.14)', fg: '#0f9488' },
  rose: { bg: 'rgba(150,21,0,.12)', fg: 'var(--color-primary-light)' },
  green: { bg: 'rgba(22,163,74,.14)', fg: '#16a34a' },
  amber: { bg: 'rgba(217,119,6,.15)', fg: '#d97706' },
  gray: { bg: 'rgba(120,120,120,.15)', fg: 'var(--text-secondary)' },
}

const card = { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 14, marginBottom: 12, color: 'var(--text-primary)' }
const btn = (primary, extra = {}) => ({
  border: primary ? 'none' : '1px solid var(--border-color)', background: primary ? 'var(--color-primary)' : 'transparent',
  color: primary ? '#fff' : 'var(--text-primary)', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6, ...extra,
})
const field = { width: '100%', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px', fontSize: 14, background: 'var(--bg-base)', color: 'var(--text-primary)' }

function Pill({ tone = 'gray', children }) {
  const t = TONES[tone]
  return <span style={{ background: t.bg, color: t.fg, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</span>
}

export default function MisTurnos() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token])
  const [tab, setTab] = useState('horario')
  const [monday, setMonday] = useState(toISO(mondayOf(new Date())))
  const [data, setData] = useState(null)
  const [appts, setAppts] = useState([])
  const [avail, setAvail] = useState(null)
  const [draft, setDraft] = useState(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [moveFor, setMoveFor] = useState(null)
  const [swapFor, setSwapFor] = useState(null)
  const [cands, setCands] = useState([])
  const [pick, setPick] = useState(null)
  const [note, setNote] = useState('')
  const [mv, setMv] = useState({ date: '', start: '09:00' })

  const detail = async (res) => { const j = await res.json().catch(() => ({})); const d = j.detail; return typeof d === 'string' ? d : (d?.message || 'No se pudo completar la acción.') }

  const load = useCallback(() => {
    fetch(`${API}/api/v1/shifts/mine?week_date=${monday}`, { headers })
      .then(r => { if (!r.ok) throw new Error('No se pudo cargar tu semana.'); return r.json() })
      .then(setData).catch(e => setErr(e.message))
    fetch(`${API}/api/v1/shifts/my-appointments?week_date=${monday}`, { headers }).then(r => r.ok ? r.json() : { appointments: [] }).then(j => setAppts(j.appointments || [])).catch(() => {})
  }, [monday, headers])
  useEffect(() => { load() }, [load])

  const loadAvail = useCallback(() => {
    fetch(`${API}/api/v1/shifts/my-availability`, { headers }).then(r => r.ok ? r.json() : null).then(j => {
      if (!j) return
      setAvail(j)
      const d = {}
      KEYS.forEach(k => {
        const x = j.days[k] || { mode: 'UNSET', ranges: [] }
        d[k] = { mode: x.mode, ranges: (x.ranges || []).map(r => ({ start_time: r.start_time, end_time: r.end_time })) }
      })
      setDraft(d)
    }).catch(() => {})
  }, [headers])
  useEffect(() => { loadAvail() }, [loadAvail])

  const shiftWeek = (n) => { const d = new Date(monday + 'T00:00:00'); d.setDate(d.getDate() + 7 * n); setMonday(toISO(d)) }

  const post = async (path, body, ok) => {
    setBusy(true); setErr(''); setMsg('')
    try {
      const res = await fetch(`${API}/api/v1/shifts/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body || {}) })
      if (!res.ok) { setErr(await detail(res)); return false }
      setMsg(ok); setMoveFor(null); setSwapFor(null); setPick(null); setNote(''); load(); return true
    } catch (e) { setErr('Sin conexión, intenta otra vez.'); return false } finally { setBusy(false) }
  }

  const openSwap = async (s) => {
    setSwapFor(s); setCands([]); setPick(null); setErr('')
    const res = await fetch(`${API}/api/v1/shifts/swap-candidates?shift_id=${s.id}`, { headers })
    if (res.ok) setCands((await res.json()).candidates || []); else setErr(await detail(res))
  }

  // ---- disponibilidad
  const setDay = (k, patch) => setDraft(d => ({ ...d, [k]: { ...d[k], ...patch } }))
  const chooseMode = (k, mode) => {
    const [a, b] = WINDOW[k]
    setDay(k, { mode, ranges: mode === 'RANGES' && draft[k].ranges.length === 0 ? [{ start_time: m2s(a), end_time: m2s(Math.min(a + 240, b)) }] : draft[k].ranges })
  }
  const addRange = (k) => {
    const [a, b] = WINDOW[k]; const r = draft[k].ranges
    const from = r.length ? Math.min(s2m(r[r.length - 1].end_time) + 60, b - 30) : a
    setDay(k, { ranges: [...r, { start_time: m2s(from), end_time: m2s(Math.min(from + 120, b)) }] })
  }
  const setRange = (k, i, patch) => setDay(k, { ranges: draft[k].ranges.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  const delRange = (k, i) => setDay(k, { ranges: draft[k].ranges.filter((_, j) => j !== i) })
  const copyToWeekdays = (k) => setDraft(d => { const n = { ...d }; KEYS.slice(0, 5).forEach(o => { if (o !== k) n[o] = { mode: d[k].mode, ranges: d[k].ranges.map(r => ({ ...r })) } }); return n })
  const hoursOf = (k) => {
    const x = draft?.[k]; if (!x) return 0
    if (x.mode === 'ALL_DAY') return (WINDOW[k][1] - WINDOW[k][0]) / 60
    if (x.mode === 'RANGES') return x.ranges.reduce((t, r) => t + Math.max(0, (s2m(r.end_time) - s2m(r.start_time)) / 60), 0)
    return 0
  }
  const totalHours = draft ? KEYS.reduce((t, k) => t + hoursOf(k), 0) : 0
  const missing = draft ? KEYS.filter(k => draft[k].mode === 'UNSET').map(k => DAYS[KEYS.indexOf(k)]) : []
  const saveAvail = async () => {
    setBusy(true); setErr(''); setMsg('')
    try {
      const res = await fetch(`${API}/api/v1/shifts/my-availability`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ days: draft }) })
      if (!res.ok) { setErr(await detail(res)); return }
      setMsg('Disponibilidad guardada. Se usa para armar el horario de las próximas semanas.'); loadAvail(); load()
    } catch (e) { setErr('Sin conexión, intenta otra vez.') } finally { setBusy(false) }
  }

  if (!data) return <div style={{ padding: 16, color: 'var(--text-primary)' }}>{err || 'Cargando…'}</div>
  if (!data.me) return <div style={{ padding: 16, maxWidth: 560 }}><div style={card}>Tu cuenta no está asociada a una persona del equipo de matchmaking, por eso aquí no hay turnos para mostrar. Si crees que es un error, avisa a administración.</div></div>

  const byDay = {}
  data.shifts.forEach(s => { (byDay[s.date] = byDay[s.date] || []).push(s) })
  const apptByDay = {}
  appts.forEach(a => { (apptByDay[a.date] = apptByDay[a.date] || []).push(a) })
  const incomingPending = data.incoming.filter(x => x.status === 'PENDIENTE')
  const outgoingPending = data.outgoing.filter(x => x.status === 'PENDIENTE')
  const recent = [...data.incoming, ...data.outgoing].filter(x => x.status !== 'PENDIENTE')
  const myHours = data.shifts.reduce((t, s) => t + horas(s.start, s.end), 0)
  const stLabel = { APROBADA: ['Aprobado', 'green'], BORRADOR: ['En revisión', 'amber'], SIN_GENERAR: ['Sin generar', 'gray'] }[data.week_status] || ['Sin generar', 'gray']
  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
  const sheet = { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, width: '100%', maxWidth: 460, maxHeight: '90vh', overflow: 'auto', padding: 18, color: 'var(--text-primary)' }
  const range = (a, b) => `${t12(a)} – ${t12(b)}`

  const tabBtn = (id, label, Icon, badge) => (
    <button type="button" onClick={() => { setTab(id); setMsg(''); setErr('') }} style={{
      flex: 1, border: 'none', cursor: 'pointer', padding: '10px 6px', borderRadius: 10, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      background: tab === id ? 'var(--color-primary)' : 'transparent', color: tab === id ? '#fff' : 'var(--text-secondary)',
    }}><Icon size={15} />{label}{badge > 0 && <span style={{ background: '#d97706', color: '#fff', borderRadius: 999, padding: '0 6px', fontSize: 11 }}>{badge}</span>}</button>
  )

  return (
    <div style={{ padding: 16, maxWidth: 680, margin: '0 auto', fontFamily: 'var(--font-family)' }}>
      <h2 style={{ margin: '0 0 2px', fontSize: 22, color: 'var(--text-primary)' }}>Mi semana</h2>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>Hola {data.me.split(' ')[0]}. Aquí pones tu disponibilidad, ves tu horario y tus citas, y pides cambios a tus compañeras.</p>

      {!data.availability_set && tab !== 'disponibilidad' && (
        <div style={{ ...card, borderColor: '#d97706', background: 'rgba(217,119,6,.10)' }}>
          <b>Falta tu disponibilidad.</b> El horario de la semana no se arma hasta que todas la pongan.{' '}
          <button type="button" onClick={() => setTab('disponibilidad')} style={btn(true, { marginTop: 8 })}>Ponerla ahora</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, marginBottom: 14 }}>
        {tabBtn('horario', 'Horario', CalendarDays, incomingPending.length)}
        {tabBtn('disponibilidad', 'Disponibilidad', Clock, 0)}
        {tabBtn('citas', 'Citas', Users, 0)}
      </div>

      {(msg || err) && !moveFor && !swapFor && (
        <div role="status" style={{ ...card, borderColor: err ? '#dc2626' : '#16a34a', background: err ? 'rgba(220,38,38,.10)' : 'rgba(22,163,74,.10)', fontWeight: 600 }}>{err || msg}</div>
      )}

      {tab !== 'disponibilidad' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button type="button" onClick={() => shiftWeek(-1)} style={btn(false, { padding: '8px 10px' })} aria-label="Semana anterior"><ChevronLeft size={16} /></button>
          <div style={{ textAlign: 'center' }}>
            <b style={{ color: 'var(--text-primary)' }}>Semana del {dayLabel(monday)}</b>
            {tab === 'horario' && <div style={{ marginTop: 4 }}><Pill tone={stLabel[1]}>{stLabel[0]}</Pill></div>}
          </div>
          <button type="button" onClick={() => shiftWeek(1)} style={btn(false, { padding: '8px 10px' })} aria-label="Semana siguiente"><ChevronRight size={16} /></button>
        </div>
      )}

      {/* ============ HORARIO ============ */}
      {tab === 'horario' && (
        <div>
          {incomingPending.map(x => (
            <div key={x.id} style={{ ...card, borderColor: '#d97706', background: 'rgba(217,119,6,.10)' }}>
              <div><b>{x.from_name}</b> te propone cambiar franjas:</div>
              <div style={{ fontSize: 14, margin: '6px 0' }}>Te da: <b>{x.from_shift ? `${dayLabel(x.from_shift.date)}, ${range(x.from_shift.start, x.from_shift.end)}` : '-'}</b><br />Recibe: <b>{x.to_shift ? `${dayLabel(x.to_shift.date)}, ${range(x.to_shift.start, x.to_shift.end)}` : '-'}</b></div>
              {x.message && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>"{x.message}"</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" disabled={busy} onClick={() => post(`swaps/${x.id}/accept`, {}, 'Cambio aceptado. Tus turnos ya se actualizaron.')} style={btn(true, { background: '#16a34a' })}><Check size={15} />Aceptar</button>
                <button type="button" disabled={busy} onClick={() => post(`swaps/${x.id}/reject`, {}, 'Cambio rechazado.')} style={btn(false)}><X size={15} />Rechazar</button>
              </div>
            </div>
          ))}
          {outgoingPending.map(x => (
            <div key={x.id} style={card}>
              Esperando respuesta de <b>{x.to_name}</b>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{x.from_shift ? `${dayLabel(x.from_shift.date)} ${range(x.from_shift.start, x.from_shift.end)}` : ''} <ArrowLeftRight size={12} style={{ verticalAlign: 'middle' }} /> {x.to_shift ? `${dayLabel(x.to_shift.date)} ${range(x.to_shift.start, x.to_shift.end)}` : ''}</div>
              <button type="button" disabled={busy} onClick={() => post(`swaps/${x.id}/cancel`, {}, 'Solicitud cancelada.')} style={btn(false, { marginTop: 8, color: '#dc2626' })}>Cancelar solicitud</button>
            </div>
          ))}

          {data.shifts.length > 0 && (
            <div style={{ ...card, display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              <div><div style={{ fontSize: 22, fontWeight: 800 }}>{myHours}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>horas esta semana{data.weekly_hours ? ` (meta ${data.weekly_hours})` : ''}</div></div>
              <div><div style={{ fontSize: 22, fontWeight: 800 }}>{data.moves_left_today}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>cambios de matches que te quedan hoy</div></div>
            </div>
          )}

          {Object.keys(byDay).length === 0 && (
            <div style={card}>
              {data.week_status === 'APROBADA' ? 'No tienes turnos esta semana.' : 'El horario de esta semana todavía no está aprobado. Cuando administración lo apruebe te llega un correo y aparece aquí.'}
            </div>
          )}
          {Object.keys(byDay).sort().map(d => (
            <div key={d} style={card}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>{dayLabel(d)}</div>
              {byDay[d].map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <b style={{ fontSize: 15 }}>{range(s.start, s.end)}</b>
                    <Pill tone={TYPE[s.type]?.tone}>{TYPE[s.type]?.label || s.type}</Pill>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {s.can_move && <button type="button" onClick={() => { setMoveFor(s); setMv({ date: s.date, start: s.start }); setErr('') }} style={btn(true, { padding: '7px 12px' })}>Mover</button>}
                    {s.can_swap && <button type="button" onClick={() => openSwap(s)} style={btn(false, { padding: '7px 12px' })}><ArrowLeftRight size={14} />Pedir cambio</button>}
                  </div>
                </div>
              ))}
            </div>
          ))}

          <p style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 6 }}><Info size={14} style={{ flexShrink: 0, marginTop: 2 }} /><span>Las <b>entrevistas</b> no se mueven por tu cuenta: solo puedes pedirle un cambio a otra compañera (las citas agendadas pasan con la franja). Tus horas de <b>matches</b> sí las puedes mover dentro de la misma semana, hasta {data.max_moves_per_day} veces por día.</span></p>

          {recent.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <h3 style={{ fontSize: 14, margin: '0 0 6px' }}>Cambios recientes</h3>
              {recent.map(x => <div key={x.id} style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '3px 0' }}>{x.from_name} - {x.to_name}: <b>{x.status.toLowerCase()}</b></div>)}
            </div>
          )}
        </div>
      )}

      {/* ============ DISPONIBILIDAD ============ */}
      {tab === 'disponibilidad' && draft && (
        <div>
          <div style={{ ...card, background: 'rgba(150,21,0,.06)' }}>
            <b>Cuándo puedes trabajar cada semana.</b>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Elige una opción para cada día, de lunes a sábado. Esta disponibilidad se repite todas las semanas: con ella el sistema arma el horario de la semana siguiente. Para un día puntual en que no puedas (viaje, cita médica) pide un permiso en <i>Agenda y turnos</i>.
              El equipo atiende de lunes a viernes de 9 am a 8 pm y el sábado de 9 am a 1 pm.
            </div>
          </div>

          {KEYS.map((k, i) => {
            const x = draft[k]
            const opt = (mode, label) => (
              <button type="button" key={mode} onClick={() => chooseMode(k, mode)} style={{
                flex: 1, padding: '9px 4px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${x.mode === mode ? 'var(--color-primary)' : 'var(--border-color)'}`,
                background: x.mode === mode ? (mode === 'UNAVAILABLE' ? 'rgba(120,120,120,.2)' : 'var(--color-primary)') : 'transparent',
                color: x.mode === mode ? (mode === 'UNAVAILABLE' ? 'var(--text-primary)' : '#fff') : 'var(--text-secondary)',
              }}>{label}</button>
            )
            return (
              <div key={k} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <b style={{ fontSize: 15 }}>{DAYS[i]}</b>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{x.mode === 'UNSET' ? 'Sin elegir' : `${hoursOf(k)} h`}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {opt('ALL_DAY', 'Todo el día')}{opt('RANGES', 'Por horas')}{opt('UNAVAILABLE', 'No puedo')}
                </div>
                {x.mode === 'RANGES' && (
                  <div style={{ marginTop: 10 }}>
                    {x.ranges.map((r, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <select aria-label="Desde" value={r.start_time} onChange={(e) => setRange(k, j, { start_time: e.target.value })} style={field}>{stepsFor(k).slice(0, -1).map(t => <option key={t} value={t}>{t12(t)}</option>)}</select>
                        <span style={{ color: 'var(--text-secondary)' }}>a</span>
                        <select aria-label="Hasta" value={r.end_time} onChange={(e) => setRange(k, j, { end_time: e.target.value })} style={field}>{stepsFor(k).slice(1).map(t => <option key={t} value={t}>{t12(t)}</option>)}</select>
                        <button type="button" onClick={() => delRange(k, j)} aria-label="Quitar franja" style={btn(false, { padding: '9px' })}><Trash2 size={15} /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => addRange(k)} style={btn(false, { padding: '7px 10px' })}><Plus size={14} />Agregar otra franja</button>
                  </div>
                )}
                {i < 5 && x.mode !== 'UNSET' && <button type="button" onClick={() => copyToWeekdays(k)} style={{ ...btn(false, { marginTop: 10, padding: '6px 10px', fontSize: 12 }) }}><Copy size={13} />Usar esto de lunes a viernes</button>}
              </div>
            )
          })}

          <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <b>{totalHours} horas</b> disponibles por semana{avail?.weekly_hours ? <span style={{ color: 'var(--text-secondary)' }}> (tu meta es {avail.weekly_hours})</span> : null}
              {avail?.weekly_hours && totalHours < avail.weekly_hours && <div style={{ fontSize: 12, color: '#d97706', marginTop: 2 }}>Con estas horas no se alcanza tu meta semanal.</div>}
              {missing.length > 0 && <div style={{ fontSize: 12, color: '#d97706', marginTop: 2 }}>Falta elegir: {missing.join(', ')}.</div>}
              {avail?.updated_at && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Última actualización: {new Date(avail.updated_at).toLocaleString('es-CO')}</div>}
            </div>
            <button type="button" disabled={busy || missing.length > 0} onClick={saveAvail} style={btn(true, { opacity: busy || missing.length > 0 ? 0.55 : 1, cursor: missing.length ? 'not-allowed' : 'pointer' })}><Check size={15} />Guardar disponibilidad</button>
          </div>
        </div>
      )}

      {/* ============ CITAS ============ */}
      {tab === 'citas' && (
        <div>
          {Object.keys(apptByDay).length === 0 && <div style={card}>No tienes entrevistas agendadas esta semana. Cuando un cliente reserve en una de tus franjas de entrevistas, aparece aquí.</div>}
          {Object.keys(apptByDay).sort().map(d => (
            <div key={d} style={card}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>{dayLabel(d)}</div>
              {apptByDay[d].map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--border-color)' }}>
                  <div>
                    <b style={{ fontSize: 15 }}>{range(a.start, a.end)}</b>
                    <div style={{ fontSize: 13 }}>{a.client}{a.city ? <span style={{ color: 'var(--text-secondary)' }}> · {a.city}</span> : null}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Pill tone={a.status === 'COMPLETADA' ? 'green' : 'teal'}>{a.status === 'COMPLETADA' ? 'Realizada' : 'Agendada'}</Pill>
                    {a.status !== 'COMPLETADA' && <button type="button" onClick={() => navigate('/matchmaking/sala/' + (a.token || a.id))} style={btn(true, { padding: '7px 12px' })}><Video size={14} />Entrar</button>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {moveFor && (
        <div role="dialog" aria-label="Mover horas de matches" style={overlay} onClick={() => setMoveFor(null)}>
          <div style={sheet} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px' }}>Mover mis horas de matches</h3>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-secondary)' }}>Ahora: {dayLabel(moveFor.date)}, {range(moveFor.start, moveFor.end)}. La duración se mantiene; debe quedar dentro de esta semana, del horario del equipo y de tu disponibilidad.</p>
            <label style={{ fontSize: 13, fontWeight: 700 }}>Día
              <select value={mv.date} onChange={(e) => setMv({ ...mv, date: e.target.value })} style={{ ...field, marginTop: 4 }}>
                {DAYS.slice(0, 6).map((n, i) => { const d = new Date(monday + 'T00:00:00'); d.setDate(d.getDate() + i); return <option key={i} value={toISO(d)}>{n} {d.getDate()}/{d.getMonth() + 1}</option> })}
              </select>
            </label>
            <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginTop: 10 }}>Hora de inicio
              <select value={mv.start} onChange={(e) => setMv({ ...mv, start: e.target.value })} style={{ ...field, marginTop: 4 }}>{stepsFor('mon').slice(0, -1).map(t => <option key={t} value={t}>{t12(t)}</option>)}</select>
            </label>
            {err && <div role="alert" style={{ marginTop: 10, color: '#dc2626', fontSize: 13, fontWeight: 600 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="button" disabled={busy} onClick={() => post('matches/move', { shift_id: moveFor.id, new_date: mv.date, new_start: mv.start }, 'Horas de matches movidas.')} style={btn(true)}>Guardar cambio</button>
              <button type="button" onClick={() => setMoveFor(null)} style={btn(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {swapFor && (
        <div role="dialog" aria-label="Pedir cambio" style={overlay} onClick={() => setSwapFor(null)}>
          <div style={sheet} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px' }}>Pedir un cambio</h3>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-secondary)' }}>Tu franja: <b>{dayLabel(swapFor.date)}, {range(swapFor.start, swapFor.end)}</b> ({TYPE[swapFor.type]?.label}). Elige la franja de otra compañera con la que quieres cambiar; solo aparecen las que cumplen las reglas. El cambio se hace cuando ella acepte.</p>
            {cands.length === 0 && !err && <div style={{ fontSize: 14 }}>No hay franjas disponibles para cambiar con esta.</div>}
            {cands.map(c => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1px solid ${pick === c.id ? 'var(--color-primary)' : 'var(--border-color)'}`, borderRadius: 10, marginBottom: 6, cursor: 'pointer', background: pick === c.id ? 'rgba(150,21,0,.10)' : 'transparent' }}>
                <input type="radio" name="cand" checked={pick === c.id} onChange={() => setPick(c.id)} />
                <span><b>{c.name}</b><br />{dayLabel(c.date)}, {range(c.start, c.end)}</span>
              </label>
            ))}
            {cands.length > 0 && <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mensaje (opcional)" maxLength={300} style={{ ...field, marginTop: 6 }} />}
            {err && <div role="alert" style={{ marginTop: 10, color: '#dc2626', fontSize: 13, fontWeight: 600 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="button" disabled={busy || !pick} onClick={() => post('swaps', { from_shift_id: swapFor.id, to_shift_id: pick, message: note }, 'Solicitud enviada. Te avisamos cuando responda.')} style={btn(true, { opacity: pick ? 1 : 0.5, cursor: pick ? 'pointer' : 'not-allowed' })}>Enviar solicitud</button>
              <button type="button" onClick={() => setSwapFor(null)} style={btn(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
