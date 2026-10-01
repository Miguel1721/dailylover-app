import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import SalaLiveKit from '../../components/SalaLiveKit'
import RevisionEntrevista from './RevisionEntrevista'

// Videollamadas de entrevista (equipo). Crear llamada -> copiar enlace para la cliente -> entrar -> finalizar.
const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'
const PSICOLOGAS = ['SILVI', 'JENN', 'ANA', 'STEFFY', 'ISA', 'PIA', 'MAPE D', 'MPS']
const CONSENT = { ACEPTADO: ['#dcfce7', '#166534', 'Grabación autorizada'], RECHAZADO: ['#fee2e2', '#991b1b', 'Sin grabación (no autorizó)'], PENDIENTE: ['#fef9c3', '#854d0e', 'Consentimiento pendiente'] }

export default function Videollamadas() {
  const { token } = useAuth()
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const [lista, setLista] = useState([])
  const [form, setForm] = useState({ client_name: '', psychologist_name: 'SILVI', is_test: true })
  const [enSala, setEnSala] = useState(null)   // { call, join }
  const [revisar, setRevisar] = useState(null) // llamada en revisión
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const cargar = useCallback(() => {
    fetch(`${API}/api/v1/calls`, { headers }).then((r) => r.json()).then((d) => setLista(Array.isArray(d) ? d : (d.items || d.calls || []))).catch(() => setMsg('No se pudo cargar la lista de llamadas'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])
  useEffect(() => { cargar() }, [cargar])

  async function crear() {
    if (!form.client_name.trim()) { setMsg('Escribe el nombre de la cliente'); return }
    setBusy(true); setMsg('')
    try {
      const r = await fetch(`${API}/api/v1/calls`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(form) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || 'Error')
      setForm({ ...form, client_name: '' }); setMsg('Llamada creada. Copia el enlace y envíaselo a la cliente.'); cargar()
    } catch (e) { setMsg('No se pudo crear: ' + e.message) } finally { setBusy(false) }
  }

  async function entrar(call) {
    setMsg('')
    const r = await fetch(`${API}/api/v1/calls/${call.id}/join`, { method: 'POST', headers })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setMsg(d.detail || 'No se pudo entrar'); return }
    setEnSala({ call, join: d })
  }

  async function finalizar(call) {
    if (!window.confirm('¿Finalizar la llamada? Después ya no se podrá volver a entrar.')) return
    await fetch(`${API}/api/v1/calls/${call.id}/end`, { method: 'POST', headers })
    const r = await fetch(`${API}/api/v1/calls/${call.id}/assemble`, { method: 'POST', headers })
    const d = await r.json().catch(() => ({}))
    const pistas = Object.entries(d || {}).filter(([, v]) => v).map(([k]) => k === 'CLIENTE' ? 'cliente' : 'psicóloga')
    setMsg(pistas.length ? `Llamada finalizada. Audio guardado de: ${pistas.join(' y ')}.` : 'Llamada finalizada (sin audio grabado).')
    setEnSala(null); cargar()
  }

  const copiar = async (url) => { try { await navigator.clipboard.writeText(url); setMsg('Enlace copiado') } catch { setMsg(url) } }

  const upload = (call) => async (seq, startMs, blob) => {
    const r = await fetch(`${API}/api/v1/calls/${call.id}/audio?seq=${seq}&start_ms=${startMs}`, { method: 'POST', body: blob, headers: { 'Content-Type': 'application/octet-stream', ...headers } })
    if (!r.ok) throw new Error('upload')
  }

  const card = { background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 12, padding: 14, marginBottom: 10 }
  const btn = (bg, fg = '#fff') => ({ border: 'none', background: bg, color: fg, borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' })
  const input = { padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, minWidth: 0 }

  if (revisar) return <RevisionEntrevista call={revisar} headers={headers} onBack={() => { setRevisar(null); cargar() }} />

  if (enSala) return (
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>Entrevista con {enSala.call.client_name}</h2>
      {!enSala.join.recording_enabled && <p style={{ color: '#92400e' }}>La cliente no ha autorizado la grabación (o aún no responde): esta llamada no se graba.</p>}
      <SalaLiveKit join={enSala.join} uploadChunk={upload(enSala.call)} labelLocal="Tú" labelRemote={enSala.call.client_name}
        onLeave={() => { setEnSala(null); cargar() }} />
      <div style={{ marginTop: 14, textAlign: 'center' }}>
        <button style={btn('#0f172a')} onClick={() => finalizar(enSala.call)}>Finalizar la entrevista y guardar el audio</button>
      </div>
    </div>
  )

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>Videollamadas de entrevista</h2>
      <p style={{ marginTop: 0, color: 'var(--text-secondary, #64748b)' }}>Crea la llamada, envía el enlace a la cliente y entra. Si ella autoriza, se graba solo el audio de cada persona por separado.</p>
      <div style={{ ...card, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...input, flex: '1 1 220px' }} placeholder="Nombre de la cliente" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
        <select style={input} value={form.psychologist_name} onChange={(e) => setForm({ ...form, psychologist_name: e.target.value })}>
          {PSICOLOGAS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={form.is_test} onChange={(e) => setForm({ ...form, is_test: e.target.checked })} /> Prueba interna
        </label>
        <button disabled={busy} style={btn('#be123c')} onClick={crear}>Crear llamada</button>
      </div>
      {msg && <div style={{ ...card, background: '#f0f9ff', color: '#075985' }}>{msg}</div>}
      {lista.length === 0 && <p>No hay llamadas.</p>}
      {lista.map((c) => {
        const [bg, fg, txt] = CONSENT[c.consent] || CONSENT.PENDIENTE
        return (
          <div key={c.id} style={{ ...card, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{c.client_name} {c.is_test && <span style={{ fontSize: 11, color: '#64748b' }}>(prueba)</span>}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{c.psychologist_name} · {c.status} · {c.created_at ? new Date(c.created_at).toLocaleString('es-CO') : ''}</div>
              <span style={{ display: 'inline-block', marginTop: 4, background: bg, color: fg, fontSize: 12, padding: '2px 8px', borderRadius: 6 }}>{txt}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {c.status !== 'FINALIZADA' && (
                <>
                  <button style={btn('#e2e8f0', '#1e293b')} onClick={() => copiar(c.public_url)}>Copiar enlace para la cliente</button>
                  <button style={btn('#be123c')} onClick={() => entrar(c)}>Entrar</button>
                  <button style={btn('#475569')} onClick={() => finalizar(c)}>Finalizar</button>
                </>
              )}
              {c.consent === 'ACEPTADO' && <button style={btn('#7c3aed')} onClick={() => setRevisar(c)}>Revisar entrevista</button>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
