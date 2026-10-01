import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import SalaLiveKit from '../components/SalaLiveKit'

// Página para la cliente (sin cuenta): consentimiento -> sala. Sin consentimiento la entrevista se hace igual, sin grabar.
const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

export default function LlamadaPublica() {
  const { token } = useParams()
  const [info, setInfo] = useState(null)
  const [err, setErr] = useState('')
  const [join, setJoin] = useState(null)
  const [fin, setFin] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/v1/calls/public/${token}`).then(async (r) => {
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || 'Enlace inválido')
      setInfo(d)
    }).catch((e) => setErr(e.message))
  }, [token])

  async function responder(accept) {
    setBusy(true); setErr('')
    try {
      if (info.consent === 'PENDIENTE') {
        const r = await fetch(`${API}/api/v1/calls/public/${token}/consent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accept }) })
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || 'No se pudo guardar tu respuesta')
      }
      const j = await fetch(`${API}/api/v1/calls/public/${token}/join`, { method: 'POST' })
      const d = await j.json().catch(() => ({}))
      if (!j.ok) throw new Error(d.detail || 'No se pudo entrar a la llamada')
      setJoin(d)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const upload = async (seq, startMs, blob) => {
    const r = await fetch(`${API}/api/v1/calls/public/${token}/audio?seq=${seq}&start_ms=${startMs}`, { method: 'POST', body: blob, headers: { 'Content-Type': 'application/octet-stream' } })
    if (!r.ok) throw new Error('upload')
  }

  const page = { minHeight: '100vh', background: '#fff7f7', color: '#1e293b', fontFamily: 'Inter, system-ui, sans-serif', padding: '24px 16px' }
  const card = { maxWidth: 980, margin: '0 auto', background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 8px 30px rgba(0,0,0,.06)' }
  const btn = (bg, fg = '#fff') => ({ border: 'none', background: bg, color: fg, borderRadius: 10, padding: '12px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 15 })

  if (fin) return <div style={page}><div style={card}><h2 style={{ marginTop: 0 }}>Gracias</h2><p>La llamada terminó. Ya puedes cerrar esta ventana.</p></div></div>
  return (
    <div style={page}>
      <div style={card}>
        <div style={{ color: '#be123c', fontWeight: 800, fontSize: 20, marginBottom: 6 }}>♥ Daily Lover</div>
        {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, marginBottom: 12 }}>{err}</div>}
        {!info && !err && <p>Cargando…</p>}
        {info && !join && (
          <>
            <h2 style={{ margin: '6px 0 10px' }}>Hola{info.client_first_name ? `, ${info.client_first_name}` : ''}</h2>
            <p style={{ margin: '0 0 14px' }}>Tu entrevista{info.psychologist_name ? ` con ${info.psychologist_name}` : ''} está por comenzar.</p>
            {info.status === 'FINALIZADA' ? <p>Esta llamada ya finalizó.</p> : (
              <>
                {info.consent === 'PENDIENTE' && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, marginBottom: 14, fontSize: 14, lineHeight: 1.5 }}>
                    <strong>Autorización de grabación</strong>
                    <p style={{ margin: '8px 0 0' }}>{info.consent_text}</p>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {info.consent === 'PENDIENTE' ? (
                    <>
                      <button disabled={busy} style={btn('#be123c')} onClick={() => responder(true)}>Acepto y entrar</button>
                      <button disabled={busy} style={btn('#e2e8f0', '#1e293b')} onClick={() => responder(false)}>No acepto la grabación, entrar sin grabar</button>
                    </>
                  ) : <button disabled={busy} style={btn('#be123c')} onClick={() => responder(info.consent === 'ACEPTADO')}>Entrar a la llamada</button>}
                </div>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>Te pediremos permiso para usar tu cámara y micrófono.</p>
              </>
            )}
          </>
        )}
        {join && <SalaLiveKit join={join} uploadChunk={upload} onLeave={() => setFin(true)} labelLocal="Tú" labelRemote={info?.psychologist_name || 'Psicóloga'} />}
      </div>
    </div>
  )
}
