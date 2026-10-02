import React, { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia')))
  ? window.location.origin
  : 'https://daily-lover.agentesia.cloud'

// Despues de agendar, la persona llena su formulario en el CRM
const CRM_FORM_URL = 'https://dailylover.smartmatchapp.com/sf65'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const css = `
.av-wrap{min-height:100vh;background:#0D0A0B;color:#F5F0F1;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;padding:24px 16px}
.av-card{max-width:860px;margin:0 auto;background:#1A1214;border:1px solid rgba(212,175,55,.4);border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(0,0,0,.5)}
.av-head{text-align:center;border-bottom:1px solid rgba(212,175,55,.25);padding-bottom:18px;margin-bottom:22px}
.av-badge{display:inline-block;background:rgba(212,175,55,.15);color:#D4AF37;font-weight:700;font-size:12px;padding:6px 14px;border-radius:20px;border:1px solid #D4AF37;margin-bottom:10px}
.av-logo{font-size:24px;font-weight:800;color:#D4AF37;letter-spacing:1px}
.av-sub{font-size:14px;color:#C5B083;margin-top:4px}
.av-title{font-size:20px;font-weight:700;margin:0 0 6px}
.av-text{font-size:15px;line-height:1.6;color:#E5DFE1;margin:0 0 16px}
.av-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:24px}
@media(max-width:720px){.av-grid{grid-template-columns:1fr}.av-card{padding:20px 16px}}
.av-cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.av-cal-title{font-weight:700;font-size:16px}
.av-nav{background:transparent;border:1px solid rgba(212,175,55,.4);color:#D4AF37;border-radius:8px;width:34px;height:34px;font-size:16px;cursor:pointer}
.av-nav:disabled{opacity:.3;cursor:default}
.av-dows,.av-days{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.av-dow{text-align:center;font-size:11px;color:#9A8A8D;padding:4px 0}
.av-day{aspect-ratio:1/1;border-radius:10px;border:1px solid transparent;background:transparent;color:#6f6266;font-size:14px;display:flex;align-items:center;justify-content:center}
.av-day.has{color:#F5F0F1;background:rgba(212,175,55,.10);border-color:rgba(212,175,55,.35);cursor:pointer;font-weight:700}
.av-day.has:hover{background:rgba(212,175,55,.22)}
.av-day.sel{background:linear-gradient(135deg,#D4AF37 0%,#AA820A 100%);color:#0D0A0B;border-color:#D4AF37}
.av-side h3{font-size:15px;margin:0 0 4px;color:#D4AF37}
.av-hint{font-size:13px;color:#9A8A8D;margin:0 0 12px}
.av-slots{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;max-height:300px;overflow:auto}
.av-slot{padding:12px 8px;border-radius:8px;border:1px solid rgba(212,175,55,.4);background:rgba(255,255,255,.04);color:#F5F0F1;font-size:14px;font-weight:600;cursor:pointer}
.av-slot:hover{background:rgba(212,175,55,.18)}
.av-slot.sel{background:linear-gradient(135deg,#D4AF37 0%,#AA820A 100%);color:#0D0A0B;border-color:#D4AF37}
.av-confirm{margin-top:22px;padding-top:18px;border-top:1px solid rgba(212,175,55,.2);text-align:center}
.av-summary{font-size:15px;margin:0 0 12px;color:#E5DFE1}
.av-btn{background:linear-gradient(135deg,#D4AF37 0%,#AA820A 100%);color:#0D0A0B;font-weight:800;font-size:16px;border:none;border-radius:8px;padding:14px 32px;cursor:pointer}
.av-btn:disabled{opacity:.45;cursor:default}
.av-link{display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:8px}
.av-box{background:rgba(212,175,55,.08);border-left:4px solid #D4AF37;padding:14px;border-radius:8px;margin:16px 0;font-size:14px;line-height:1.6}
.av-err{background:rgba(220,60,60,.12);border-left:4px solid #dc3c3c;padding:12px 14px;border-radius:8px;margin:14px 0;font-size:14px}
.av-center{text-align:center;padding:30px 0}
.av-foot{font-size:12px;color:#7A6A6D;text-align:center;margin-top:24px}
.av-det{display:grid;grid-template-columns:1fr 1.3fr;gap:28px}
.av-det-left{border-right:1px solid rgba(212,175,55,.2);padding-right:24px}
@media(max-width:720px){.av-det{grid-template-columns:1fr}.av-det-left{border-right:none;padding-right:0;border-bottom:1px solid rgba(212,175,55,.2);padding-bottom:16px}}
.av-back{background:transparent;border:1px solid rgba(212,175,55,.4);color:#D4AF37;border-radius:50%;width:38px;height:38px;font-size:18px;cursor:pointer;margin-bottom:14px}
.av-muted{font-size:13px;color:#C5B083}
.av-meta{font-size:14px;color:#E5DFE1;margin:8px 0;line-height:1.5}
.av-label{display:block;font-size:13px;font-weight:700;margin:14px 0 6px}
.av-input,.av-area{width:100%;box-sizing:border-box;background:rgba(255,255,255,.05);border:1px solid rgba(212,175,55,.4);color:#F5F0F1;border-radius:8px;padding:12px;font-size:15px;font-family:inherit}
.av-area{min-height:90px;resize:vertical}
.av-fine{font-size:12px;color:#9A8A8D;margin:14px 0}
`

function Shell({ children }) {
  return (
    <div className="av-wrap">
      <style>{css}</style>
      <div className="av-card">
        <div className="av-head">
          <div className="av-badge">MATCHMAKING SERVICE</div>
          <div className="av-logo">DAILY LOVER</div>
          <div className="av-sub">3 citas curadas en 90 días · Una sola matchmaker asignada a ti: María Paula Salinas</div>
        </div>
        {children}
        <div className="av-foot">© Daily Lover Matchmaking · Bogotá &amp; Medellín, Colombia</div>
      </div>
    </div>
  )
}

const pad = (n) => String(n).padStart(2, '0')

export default function AgendarVip() {
  const { search } = useLocation()
  const token = useMemo(() => { const q = new URLSearchParams(search); return q.get('token') || q.get('session_id') || '' }, [search])

  const [state, setState] = useState('loading') // loading | ready | error | booked | done
  const [errorMsg, setErrorMsg] = useState('')
  const [firstName, setFirstName] = useState('')
  const [days, setDays] = useState([])
  const [already, setAlready] = useState(null)
  const [month, setMonth] = useState({ y: new Date().getFullYear(), m: new Date().getMonth() })
  const [selDate, setSelDate] = useState('')
  const [selSlot, setSelSlot] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [done, setDone] = useState(null)
  const [step, setStep] = useState('pick')   // pick: elegir hora | details: nombre, correo y notas
  const [fName, setFName] = useState('')
  const [fEmail, setFEmail] = useState('')
  const [fNotes, setFNotes] = useState('')
  const [countdown, setCountdown] = useState(0)

  const loadSlots = () => {
    if (!token) {
      setErrorMsg('Este enlace no es válido. Usa el botón del correo que te enviamos.')
      setState('error')
      return Promise.resolve()
    }
    return fetch(`${API}/api/v1/client/vip-booking/slots?token=${encodeURIComponent(token)}&days_ahead=45`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.detail || 'No pudimos cargar la agenda. Intenta de nuevo en unos minutos.')
        return d
      })
      .then((d) => {
        setFirstName(d.first_name || '')
        setFName((prev) => prev || d.client_name || '')
        setFEmail((prev) => prev || d.client_email || '')
        if (d.already_booked) {
          setAlready(d.already_booked)
          setState('booked')
          return
        }
        const list = d.days || []
        setDays(list)
        if (list.length > 0) {
          const [y, m] = list[0].date.split('-').map(Number)
          setMonth({ y, m: m - 1 })
        }
        setState('ready')
      })
      .catch((e) => {
        setErrorMsg(e.message)
        setState('error')
      })
  }

  useEffect(() => {
    loadSlots()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (state !== 'done') return undefined
    setCountdown(12)
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t)
          window.location.href = CRM_FORM_URL
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [state])

  const byDate = useMemo(() => {
    const map = {}
    days.forEach((d) => { map[d.date] = d })
    return map
  }, [days])

  const firstAvail = days.length ? days[0].date.slice(0, 7) : null
  const lastAvail = days.length ? days[days.length - 1].date.slice(0, 7) : null
  const curKey = `${month.y}-${pad(month.m + 1)}`

  const grid = useMemo(() => {
    const first = new Date(month.y, month.m, 1)
    const lead = (first.getDay() + 6) % 7 // lunes = 0
    const total = new Date(month.y, month.m + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < lead; i++) cells.push(null)
    for (let d = 1; d <= total; d++) cells.push(`${month.y}-${pad(month.m + 1)}-${pad(d)}`)
    return cells
  }, [month])

  const shiftMonth = (delta) => {
    setMonth((p) => {
      const d = new Date(p.y, p.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  const pickDate = (date) => {
    setSelDate(date)
    setSelSlot(null)
    setFormError('')
  }

  const confirm = async () => {
    if (!selSlot) return
    if (!fName.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fEmail.trim())) {
      setFormError('Escribe tu nombre y un correo válido.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const r = await fetch(`${API}/api/v1/client/vip-booking/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, slot_iso: selSlot.slot_iso, name: fName.trim(), email: fEmail.trim(), notes: fNotes.trim() }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.status === 409 && /ya no está disponible/i.test(d.detail || '')) {
        setFormError(d.detail)
        setSelSlot(null)
        setStep('pick')
        await loadSlots()
        setSaving(false)
        return
      }
      if (r.status === 409) {
        await loadSlots()
        setSaving(false)
        return
      }
      if (!r.ok) throw new Error(d.detail || 'No pudimos confirmar tu horario. Intenta de nuevo.')
      setDone(d)
      setState('done')
    } catch (e) {
      setFormError(e.message)
    }
    setSaving(false)
  }

  if (state === 'loading') {
    return <Shell><div className="av-center">Cargando la agenda…</div></Shell>
  }

  if (state === 'error') {
    return (
      <Shell>
        <div className="av-err">{errorMsg}</div>
        <p className="av-text">Si necesitas ayuda, respóndenos por WhatsApp o al correo desde el que recibiste el enlace y te agendamos manualmente.</p>
      </Shell>
    )
  }

  if (state === 'booked' && already) {
    return (
      <Shell>
        <h2 className="av-title">Tu entrevista ya está agendada </h2>
        <div className="av-box">
          <strong>{already.display_date}</strong><br />
          ⏰ <strong>{already.display_time}</strong> (Hora Colombia)
        </div>
        {already.meet_link
          ? <div style={{ textAlign: 'center' }}><a className="av-link" href={already.meet_link} target="_blank" rel="noreferrer">Entrar a Google Meet</a></div>
          : <p className="av-text">Te enviaremos la invitación con el enlace de la videollamada a tu correo.</p>}
        <div className="av-box" style={{ marginTop: 20 }}>
          <strong>Falta tu formulario.</strong> Si aún no lo has llenado, complétalo para que preparemos tu entrevista y tus matches.
        </div>
        <div style={{ textAlign: 'center' }}><a className="av-link" href={CRM_FORM_URL}>Completar mi formulario</a></div>
      </Shell>
    )
  }

  if (state === 'done' && done) {
    return (
      <Shell>
        <h2 className="av-title">¡Listo{firstName ? `, ${firstName}` : ''}! Tu entrevista está confirmada </h2>
        <div className="av-box">
          <strong>{done.display_date}</strong><br />
          ⏰ <strong>{done.display_time}</strong> (Hora Colombia)<br />
          Videollamada Google Meet · 30 minutos con María Paula Salinas
        </div>
        {done.meet_link ? (
          <>
            <div style={{ textAlign: 'center', margin: '18px 0' }}>
              <a className="av-link" href={done.meet_link} target="_blank" rel="noreferrer">Enlace de Google Meet</a>
            </div>
            <p className="av-text" style={{ textAlign: 'center' }}>
              También te enviamos la invitación oficial a tu Google Calendar y un correo de confirmación.
            </p>
          </>
        ) : (
          <p className="av-text">Tu horario quedó reservado. En breve te enviaremos la invitación con el enlace de la videollamada a tu correo.</p>
        )}
        <div className="av-box" style={{ marginTop: 20 }}>
          <strong>Último paso: completa tu formulario.</strong><br />
          Lo necesitamos para preparar tu entrevista y buscar tus matches.
          {countdown > 0 ? ` Te llevamos automáticamente en ${countdown} segundos.` : ''}
        </div>
        <div style={{ textAlign: 'center' }}><a className="av-link" href={CRM_FORM_URL}>Completar mi formulario</a></div>
      </Shell>
    )
  }

  // state === 'ready'
  const dayInfo = selDate ? byDate[selDate] : null
  const selLabel = dayInfo && selSlot ? `${dayInfo.display_date} · ${selSlot.display_time}` : ''

  if (step === 'details' && selSlot && dayInfo) {
    return (
      <Shell>
        <div className="av-det">
          <div className="av-det-left">
            <button className="av-back" onClick={() => { setStep('pick'); setFormError('') }} aria-label="Volver">&larr;</button>
            <div className="av-muted">Daily Lover Matchmaking</div>
            <h2 className="av-title">Entrevista Matchmaking Service</h2>
            <div className="av-meta">30 minutos</div>
            <div className="av-meta">Videollamada por Google Meet. El enlace llega a tu correo al confirmar.</div>
            <div className="av-meta"><strong>{selLabel}</strong></div>
            <div className="av-meta">Hora de Colombia (Bogotá)</div>
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 20 }}>Tus datos</h3>
            <label className="av-label" htmlFor="av-name">Nombre *</label>
            <input id="av-name" className="av-input" type="text" value={fName} onChange={(e) => setFName(e.target.value)} autoComplete="name" />
            <label className="av-label" htmlFor="av-email">Correo *</label>
            <input id="av-email" className="av-input" type="email" value={fEmail} onChange={(e) => setFEmail(e.target.value)} autoComplete="email" />
            <label className="av-label" htmlFor="av-notes">Cuéntanos algo que nos ayude a preparar la entrevista</label>
            <textarea id="av-notes" className="av-area" value={fNotes} onChange={(e) => setFNotes(e.target.value)} />
            <p className="av-fine">Al continuar aceptas que usemos estos datos para agendar tu entrevista y contactarte.</p>
            {formError && <div className="av-err">{formError}</div>}
            <button className="av-btn" disabled={saving} onClick={confirm}>
              {saving ? 'Agendando…' : 'Agendar entrevista'}
            </button>
            <p className="av-fine">Después te llevaremos a tu formulario de perfil.</p>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <h2 className="av-title">{firstName ? `Hola ${firstName}, elige` : 'Elige'} el día y la hora de tu entrevista</h2>
      <p className="av-text">
        Son 30 minutos por Google Meet con María Paula Salinas. Selecciona un día del calendario y luego uno de los horarios disponibles.
        Todos los horarios están en hora de Colombia.
      </p>

      {days.length === 0 ? (
        <div className="av-err">
          En este momento no hay horarios disponibles en los próximos días. Escríbenos y te ayudamos a coordinar tu entrevista.
        </div>
      ) : (
        <div className="av-grid">
          <div>
            <div className="av-cal-head">
              <button className="av-nav" onClick={() => shiftMonth(-1)} disabled={!firstAvail || curKey <= firstAvail} aria-label="Mes anterior">‹</button>
              <div className="av-cal-title">{MESES[month.m]} {month.y}</div>
              <button className="av-nav" onClick={() => shiftMonth(1)} disabled={!lastAvail || curKey >= lastAvail} aria-label="Mes siguiente">›</button>
            </div>
            <div className="av-dows">
              {DIAS_CORTOS.map((d) => <div key={d} className="av-dow">{d}</div>)}
            </div>
            <div className="av-days">
              {grid.map((date, i) => {
                if (!date) return <div key={`e${i}`} />
                const has = !!byDate[date]
                const cls = `av-day${has ? ' has' : ''}${selDate === date ? ' sel' : ''}`
                return has
                  ? <button key={date} className={cls} onClick={() => pickDate(date)}>{Number(date.slice(8))}</button>
                  : <div key={date} className={cls}>{Number(date.slice(8))}</div>
              })}
            </div>
          </div>

          <div className="av-side">
            {!dayInfo ? (
              <>
                <h3>Horarios disponibles</h3>
                <p className="av-hint">Elige un día resaltado en el calendario para ver las horas libres.</p>
              </>
            ) : (
              <>
                <h3>{dayInfo.display_date}</h3>
                <p className="av-hint">Elige la hora que prefieras (30 min):</p>
                <div className="av-slots">
                  {dayInfo.slots.map((s) => (
                    <button
                      key={s.slot_iso}
                      className={`av-slot${selSlot && selSlot.slot_iso === s.slot_iso ? ' sel' : ''}`}
                      onClick={() => { setSelSlot(s); setFormError('') }}
                    >
                      {s.display_time}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {formError && <div className="av-err">{formError}</div>}

      {days.length > 0 && (
        <div className="av-confirm">
          <p className="av-summary">
            {selLabel ? <>Tu entrevista: <strong>{selLabel}</strong> (Hora Colombia)</> : 'Aún no has elegido día y hora.'}
          </p>
          <button className="av-btn" disabled={!selSlot} onClick={() => { setFormError(''); setStep('details') }}>
            Continuar
          </button>
        </div>
      )}
    </Shell>
  )
}
