import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const TIMES = Array.from({ length: 22 }, (_, i) => `${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
const pad = (n) => String(n).padStart(2, '0')
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const mondayOf = (d) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x }
const t12 = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${(h % 12) || 12}${m ? ':' + pad(m) : ''}${h < 12 ? 'am' : 'pm'}` }
const dayLabel = (iso) => { const d = new Date(iso + 'T00:00:00'); return `${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()}/${d.getMonth() + 1}` }
const TYPE = { ENTREVISTAS: { label: 'Entrevistas', bg: '#ccfbf1', fg: '#0f766e' }, MATCHMAKING: { label: 'Matches', bg: '#fce7f3', fg: '#be185d' } }
const card = { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, marginBottom: 10, color: '#1e293b' }
const btn = (bg, fg = '#fff') => ({ border: 'none', background: bg, color: fg, borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' })

export default function MisTurnos() {
  const { token } = useAuth()
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const [monday, setMonday] = useState(toISO(mondayOf(new Date())))
  const [data, setData] = useState(null)
  const [msg, setMsg] = useState('')
  const [moveFor, setMoveFor] = useState(null)   // franja que se está moviendo
  const [swapFor, setSwapFor] = useState(null)   // franja para la que se pide cambio
  const [cands, setCands] = useState([])
  const [pick, setPick] = useState(null)
  const [note, setNote] = useState('')
  const [mv, setMv] = useState({ date: '', start: '09:00' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    fetch(`${API}/api/v1/shifts/mine?week_date=${monday}`, { headers })
      .then(r => { if (!r.ok) throw new Error('No se pudo cargar tu semana.'); return r.json() })
      .then(setData).catch(e => setMsg(e.message))
  }, [monday, token]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const shiftWeek = (n) => { const d = new Date(monday + 'T00:00:00'); d.setDate(d.getDate() + 7 * n); setMonday(toISO(d)) }
  const detail = async (res) => { const j = await res.json().catch(() => ({})); const d = j.detail; return typeof d === 'string' ? d : (d?.message || 'No se pudo completar la acción.') }

  const post = async (path, body, ok) => {
    setBusy(true); setErr(''); setMsg('')
    try {
      const res = await fetch(`${API}/api/v1/shifts/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body || {}) })
      if (!res.ok) { setErr(await detail(res)); return false }
      setMsg(ok); setMoveFor(null); setSwapFor(null); setPick(null); setNote(''); load(); return true
    } catch (e) { setErr('Sin conexión, intenta otra vez.'); return false } finally { setBusy(false) }
  }

  const openMove = (s) => { setMoveFor(s); setMv({ date: s.date, start: s.start }); setErr('') }
  const openSwap = async (s) => {
    setSwapFor(s); setCands([]); setPick(null); setErr('')
    const res = await fetch(`${API}/api/v1/shifts/swap-candidates?shift_id=${s.id}`, { headers })
    if (res.ok) setCands((await res.json()).candidates || []); else setErr(await detail(res))
  }

  if (!data) return <div style={{ padding: 16 }}>{msg || 'Cargando…'}</div>
  if (!data.me) return <div style={{ padding: 16, maxWidth: 560 }}><div style={card}>Tu cuenta no está asociada a una persona del equipo de matchmaking, por eso aquí no hay turnos para mostrar. Si crees que es un error, avisa a administración.</div></div>

  const byDay = {}
  data.shifts.forEach(s => { (byDay[s.date] = byDay[s.date] || []).push(s) })
  const pending = [...data.incoming.filter(x => x.status === 'PENDIENTE'), ...data.outgoing.filter(x => x.status === 'PENDIENTE')]
  const recent = [...data.incoming, ...data.outgoing].filter(x => x.status !== 'PENDIENTE')
  const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
  const sheet = { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 460, maxHeight: '90vh', overflow: 'auto', padding: 18, color: '#1e293b' }
  const sel = { width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px', fontSize: 15, marginTop: 4, background: '#fff', color: '#0f172a' }

  return (
    <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>Mis turnos y cambios</h2>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>
        Hola {data.me.split(' ')[0]}. Las <b>entrevistas</b> no se mueven por tu cuenta (solo puedes pedirle un cambio a otra persona).
        Tus horas de <b>matches</b> sí puedes moverlas dentro de la misma semana: hoy te quedan <b>{data.moves_left_today}</b> de {data.max_moves_per_day} cambios.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button type="button" onClick={() => shiftWeek(-1)} style={btn('#e2e8f0', '#334155')} aria-label="Semana anterior">‹</button>
        <b>Semana del {dayLabel(monday)}</b>
        <button type="button" onClick={() => shiftWeek(1)} style={btn('#e2e8f0', '#334155')} aria-label="Semana siguiente">›</button>
      </div>

      {(msg || err) && !moveFor && !swapFor && <div role="status" style={{ ...card, background: err ? '#fef2f2' : '#ecfdf5', borderColor: err ? '#fecaca' : '#a7f3d0', color: err ? '#991b1b' : '#065f46', fontWeight: 600 }}>{err || msg}</div>}

      {pending.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Solicitudes pendientes</h3>
          {data.incoming.filter(x => x.status === 'PENDIENTE').map(x => (
            <div key={x.id} style={{ ...card, borderColor: '#fde68a', background: '#fffbeb' }}>
              <div><b>{x.from_name}</b> te propone cambiar:</div>
              <div style={{ fontSize: 14, margin: '4px 0' }}>Te da: <b>{x.from_shift ? `${dayLabel(x.from_shift.date)} ${t12(x.from_shift.start)}–${t12(x.from_shift.end)}` : '—'}</b><br />Recibe: <b>{x.to_shift ? `${dayLabel(x.to_shift.date)} ${t12(x.to_shift.start)}–${t12(x.to_shift.end)}` : '—'}</b></div>
              {x.message && <div style={{ fontSize: 13, color: '#475569' }}>“{x.message}”</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" disabled={busy} onClick={() => post(`swaps/${x.id}/accept`, {}, 'Cambio aceptado. Tus turnos ya se actualizaron.')} style={btn('#16a34a')}>Aceptar</button>
                <button type="button" disabled={busy} onClick={() => post(`swaps/${x.id}/reject`, {}, 'Cambio rechazado.')} style={btn('#e2e8f0', '#334155')}>Rechazar</button>
              </div>
            </div>
          ))}
          {data.outgoing.filter(x => x.status === 'PENDIENTE').map(x => (
            <div key={x.id} style={card}>
              Esperando respuesta de <b>{x.to_name}</b>
              <div style={{ fontSize: 13, color: '#475569' }}>{x.from_shift ? `${dayLabel(x.from_shift.date)} ${t12(x.from_shift.start)}–${t12(x.from_shift.end)}` : ''} ⇄ {x.to_shift ? `${dayLabel(x.to_shift.date)} ${t12(x.to_shift.start)}–${t12(x.to_shift.end)}` : ''}</div>
              <button type="button" disabled={busy} onClick={() => post(`swaps/${x.id}/cancel`, {}, 'Solicitud cancelada.')} style={{ ...btn('#fee2e2', '#b91c1c'), marginTop: 8 }}>Cancelar solicitud</button>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Mis franjas</h3>
      {Object.keys(byDay).length === 0 && <div style={card}>Todavía no tienes turnos esta semana.</div>}
      {Object.keys(byDay).sort().map(d => (
        <div key={d} style={card}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>{dayLabel(d)}</div>
          {byDay[d].map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid #f1f5f9' }}>
              <div>
                <b style={{ fontSize: 15 }}>{t12(s.start)} – {t12(s.end)}</b>{' '}
                <span style={{ background: TYPE[s.type]?.bg, color: TYPE[s.type]?.fg, borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{TYPE[s.type]?.label || s.type}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {s.can_move && <button type="button" onClick={() => openMove(s)} style={btn('#be185d')}>Mover</button>}
                {s.can_swap && <button type="button" onClick={() => openSwap(s)} style={btn('#2563eb')}>Pedir cambio</button>}
              </div>
            </div>
          ))}
        </div>
      ))}

      {recent.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Cambios recientes</h3>
          {recent.map(x => <div key={x.id} style={{ fontSize: 13, color: '#475569', padding: '4px 0' }}>{x.from_name} ⇄ {x.to_name}: <b>{x.status.toLowerCase()}</b></div>)}
        </div>
      )}

      {moveFor && (
        <div role="dialog" aria-label="Mover horas de matches" style={overlay} onClick={() => setMoveFor(null)}>
          <div style={sheet} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px' }}>Mover mis horas de matches</h3>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#64748b' }}>Ahora: {dayLabel(moveFor.date)} {t12(moveFor.start)}–{t12(moveFor.end)}. La duración se mantiene; debe quedar dentro de esta semana, del horario del equipo y de tu disponibilidad.</p>
            <label style={{ fontSize: 13, fontWeight: 700 }}>Día
              <select value={mv.date} onChange={(e) => setMv({ ...mv, date: e.target.value })} style={sel}>
                {DAYS.slice(0, 6).map((n, i) => { const d = new Date(monday + 'T00:00:00'); d.setDate(d.getDate() + i); return <option key={i} value={toISO(d)}>{n} {d.getDate()}/{d.getMonth() + 1}</option> })}
              </select>
            </label>
            <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginTop: 10 }}>Hora de inicio
              <select value={mv.start} onChange={(e) => setMv({ ...mv, start: e.target.value })} style={sel}>{TIMES.map(t => <option key={t} value={t}>{t12(t)}</option>)}</select>
            </label>
            {err && <div role="alert" style={{ marginTop: 10, color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="button" disabled={busy} onClick={() => post('matches/move', { shift_id: moveFor.id, new_date: mv.date, new_start: mv.start }, 'Horas de matches movidas.')} style={btn('#be185d')}>Guardar cambio</button>
              <button type="button" onClick={() => setMoveFor(null)} style={btn('#e2e8f0', '#334155')}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {swapFor && (
        <div role="dialog" aria-label="Pedir cambio" style={overlay} onClick={() => setSwapFor(null)}>
          <div style={sheet} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px' }}>Pedir un cambio</h3>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#64748b' }}>Tu franja: <b>{dayLabel(swapFor.date)} {t12(swapFor.start)}–{t12(swapFor.end)}</b> ({TYPE[swapFor.type]?.label}). Elige la franja de otra persona con la que quieres cambiar; solo aparecen las que cumplen las reglas. Se hace el cambio cuando ella acepte.</p>
            {cands.length === 0 && !err && <div style={{ fontSize: 14 }}>No hay franjas disponibles para cambiar con esta.</div>}
            {cands.map(c => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1px solid ${pick === c.id ? '#2563eb' : '#e2e8f0'}`, borderRadius: 8, marginBottom: 6, cursor: 'pointer', background: pick === c.id ? '#eff6ff' : '#fff' }}>
                <input type="radio" name="cand" checked={pick === c.id} onChange={() => setPick(c.id)} />
                <span><b>{c.name}</b><br />{dayLabel(c.date)} {t12(c.start)}–{t12(c.end)}</span>
              </label>
            ))}
            {cands.length > 0 && <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mensaje (opcional)" maxLength={300} style={{ ...sel, marginTop: 6 }} />}
            {err && <div role="alert" style={{ marginTop: 10, color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="button" disabled={busy || !pick} onClick={() => post('swaps', { from_shift_id: swapFor.id, to_shift_id: pick, message: note }, 'Solicitud enviada. Te avisamos cuando responda.')} style={{ ...btn(pick ? '#2563eb' : '#94a3b8'), cursor: pick ? 'pointer' : 'not-allowed' }}>Enviar solicitud</button>
              <button type="button" onClick={() => setSwapFor(null)} style={btn('#e2e8f0', '#334155')}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
