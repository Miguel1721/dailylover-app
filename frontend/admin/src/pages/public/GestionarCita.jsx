import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const t12 = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${(h % 12) || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}` }
const dia = (iso) => { const d = new Date(iso + 'T00:00:00'); return `${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}` }

// Página pública: la clienta cambia o cancela su entrevista con el enlace de su cita (el enlace es su credencial)
export default function GestionarCita() {
  const { token } = useParams()
  const [cita, setCita] = useState(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [elige, setElige] = useState(null)
  const [busy, setBusy] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [modo, setModo] = useState('ver')

  const cargar = () => fetch(`${API}/api/v1/booking/manage/${encodeURIComponent(token)}`).then(r => { if (!r.ok) throw new Error('Este enlace no es válido.'); return r.json() }).then(setCita).catch(e => setErr(e.message))
  useEffect(() => { cargar() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = async (ruta, body, ok) => {
    setBusy(true); setErr(''); setMsg('')
    try {
      const r = await fetch(`${API}/api/v1/booking/manage/${encodeURIComponent(token)}/${ruta}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(typeof j.detail === 'string' ? j.detail : 'No se pudo completar.'); return }
      setMsg(ok); setModo('ver'); setElige(null); cargar()
    } catch (e) { setErr('Sin conexión, intenta otra vez.') } finally { setBusy(false) }
  }

  const box = { maxWidth: 520, margin: '0 auto', padding: 20, color: '#F5F0F1', fontFamily: "'Inter Tight', system-ui, sans-serif" }
  const card = { background: '#1A1214', border: '1px solid rgba(150,21,0,.35)', borderRadius: 14, padding: 16, marginBottom: 12 }
  const btn = (bg, fg = '#fff') => ({ border: 'none', background: bg, color: fg, borderRadius: 10, padding: '11px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' })

  return (
    <div style={{ minHeight: '100vh', background: '#0D0A0B' }}>
      <div style={box}>
        <h2 style={{ margin: '0 0 4px' }}>Tu entrevista</h2>
        {err && !cita && <div style={card}>{err}</div>}
        {cita && (
          <>
            <div style={card}>
              <div style={{ color: '#9A8A8D', fontSize: 13 }}>Hola {cita.client_name}</div>
              <div style={{ fontSize: 18, fontWeight: 800, margin: '6px 0' }}>{dia(cita.date)} a las {t12(cita.time_slot)}</div>
              <div style={{ color: '#9A8A8D', fontSize: 13 }}>Con {cita.psychologist?.name || 'tu psicóloga'} · Estado: {cita.status === 'CANCELADA' ? 'cancelada' : (cita.status === 'COMPLETADA' ? 'realizada' : 'confirmada')}</div>
            </div>
            {msg && <div style={{ ...card, borderColor: '#16a34a' }}>{msg}</div>}
            {err && <div style={{ ...card, borderColor: '#dc2626' }}>{err}</div>}
            {!cita.editable && <div style={card}>{cita.motivo_no_editable}</div>}
            {cita.editable && modo === 'ver' && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a href={`${API}/admin/llamada/${token}`} style={{ ...btn('#961500'), textDecoration: 'none' }}>Entrar a la videollamada</a>
                <button type="button" style={btn('#2a1d20')} onClick={() => setModo('cambiar')}>Cambiar el horario</button>
                <button type="button" style={btn('#2a1d20', '#fca5a5')} onClick={() => setModo('cancelar')}>Cancelar la cita</button>
              </div>
            )}
            {cita.editable && modo === 'cambiar' && (
              <div style={card}>
                <b>Elige un nuevo horario</b>
                {Object.keys(cita.slots_by_day).length === 0 && <p style={{ color: '#9A8A8D' }}>Por ahora no hay otros horarios disponibles. Escríbenos y lo resolvemos.</p>}
                {Object.keys(cita.slots_by_day).sort().map(d => (
                  <div key={d} style={{ margin: '10px 0' }}>
                    <div style={{ fontSize: 13, color: '#9A8A8D', marginBottom: 4 }}>{dia(d)}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {cita.slots_by_day[d].map(h => {
                        const sel = elige && elige.d === d && elige.h === h
                        return <button key={h} type="button" onClick={() => setElige({ d, h })} style={{ ...btn(sel ? '#961500' : '#2a1d20'), padding: '8px 12px' }}>{t12(h)}</button>
                      })}
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button type="button" disabled={!elige || busy} style={{ ...btn('#961500'), opacity: elige ? 1 : 0.5 }} onClick={() => enviar('reschedule', { date: elige.d, time_slot: elige.h }, 'Listo, cambiamos tu cita.')}>Confirmar el cambio</button>
                  <button type="button" style={btn('#2a1d20')} onClick={() => setModo('ver')}>Volver</button>
                </div>
              </div>
            )}
            {cita.editable && modo === 'cancelar' && (
              <div style={card}>
                <b>¿Cancelar tu entrevista?</b>
                <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Cuéntanos el motivo (opcional)" maxLength={200}
                  style={{ width: '100%', margin: '10px 0', padding: 10, borderRadius: 10, border: '1px solid #3a2a2d', background: '#0D0A0B', color: '#F5F0F1' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" disabled={busy} style={btn('#dc2626')} onClick={() => enviar('cancel', { reason: motivo }, 'Tu cita quedó cancelada.')}>Sí, cancelar</button>
                  <button type="button" style={btn('#2a1d20')} onClick={() => setModo('ver')}>No, volver</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
