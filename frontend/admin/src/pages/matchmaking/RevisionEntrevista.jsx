import React, { useCallback, useEffect, useState } from 'react'

// Revisión de una entrevista grabada: asociar cliente -> transcribir -> extraer datos -> aprobar / editar / rechazar campo por campo.
// Nada entra al perfil sin la aprobación de la psicóloga.
const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'
const fmt = (v) => Array.isArray(v) ? v.join(', ') : (v === true ? 'Sí' : v === false ? 'No' : String(v ?? ''))
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function RevisionEntrevista({ call, headers, onBack }) {
  const [tr, setTr] = useState(null)
  const [props, setProps] = useState({ cliente: null, propuestas: [] })
  const [q, setQ] = useState('')
  const [res, setRes] = useState([])
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [edit, setEdit] = useState({})

  const cargar = useCallback(async () => {
    const [a, b] = await Promise.all([
      fetch(`${API}/api/v1/calls/${call.id}/transcript`, { headers }).then((r) => r.json()).catch(() => null),
      fetch(`${API}/api/v1/calls/${call.id}/proposals`, { headers }).then((r) => r.json()).catch(() => ({ propuestas: [] })),
    ])
    setTr(a); setProps(b)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.id])
  useEffect(() => { cargar() }, [cargar])

  async function post(path, body, etiqueta) {
    setBusy(etiqueta); setMsg('')
    try {
      const r = await fetch(`${API}/api/v1/calls/${call.id}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || 'Error')
      await cargar()
      return d
    } catch (e) { setMsg(e.message) } finally { setBusy('') }
  }

  async function buscar() {
    if (q.trim().length < 3) return
    const r = await fetch(`${API}/api/v1/calls/buscar/clientes?q=${encodeURIComponent(q.trim())}`, { headers })
    setRes(r.ok ? await r.json() : [])
  }

  const card = { background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 12, padding: 14, marginBottom: 12 }
  const btn = (bg, fg = '#fff') => ({ border: 'none', background: bg, color: fg, borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' })
  const segs = tr?.segmentos || []
  const pend = props.propuestas.filter((p) => p.estado === 'PROPUESTA').length

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <button style={btn('#e2e8f0', '#1e293b')} onClick={onBack}>← Volver</button>
      <h2>Revisión de la entrevista: {call.client_name}</h2>
      {msg && <div style={{ ...card, background: '#fef2f2', color: '#991b1b' }}>{msg}</div>}

      <div style={card}>
        <strong>1. Cliente del sistema</strong>
        {props.cliente ? <p style={{ margin: '6px 0 0' }}>Asociada a <b>{props.cliente.nombre}</b> (id {props.cliente.id}). Lo aprobado se guarda en su perfil.</p> : (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscar()} placeholder="Buscar por nombre (mín. 3 letras)"
                style={{ flex: '1 1 220px', padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }} />
              <button style={btn('#334155')} onClick={buscar}>Buscar</button>
            </div>
            {res.map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9', gap: 8 }}>
                <span>{c.nombre} · {c.ciudad || 'sin ciudad'}{c.edad ? ` · ${c.edad} años` : ''} · CRM {c.crm_id}</span>
                <button style={btn('#be123c')} onClick={() => post('link-client', { user_id: c.id }, 'link')}>Asociar</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong>2. Transcripción {tr?.status === 'LISTA' ? `(${segs.length} frases)` : ''}</strong>
          <button disabled={!!busy} style={btn('#0f766e')} onClick={() => post('transcribe', null, 'tr')}>{busy === 'tr' ? 'Transcribiendo…' : (tr?.status === 'LISTA' ? 'Volver a transcribir' : 'Transcribir')}</button>
        </div>
        {tr?.status === 'ERROR' && <p style={{ color: '#b91c1c' }}>Error: {tr.error}</p>}
        {segs.length > 0 && (
          <div style={{ maxHeight: 260, overflow: 'auto', marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>
            {segs.map((s, i) => <div key={i}><span style={{ color: '#64748b' }}>[{mmss(s.inicio)}]</span> <b style={{ color: s.quien === 'CLIENTE' ? '#be123c' : '#0f766e' }}>{s.quien === 'CLIENTE' ? 'Cliente' : 'Psicóloga'}:</b> {s.texto}</div>)}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong>3. Datos propuestos {props.propuestas.length ? `(${pend} por revisar)` : ''}</strong>
          <button disabled={!!busy || tr?.status !== 'LISTA'} style={btn('#7c3aed')} onClick={() => post('extract', null, 'ex')}>{busy === 'ex' ? 'Analizando…' : 'Extraer datos'}</button>
        </div>
        <p style={{ fontSize: 12, color: '#64748b', margin: '6px 0 10px' }}>Cada dato trae la frase exacta de la cliente. Revisa la cita antes de aprobar.</p>
        {props.propuestas.map((p) => (
          <div key={p.id} style={{ borderTop: '1px solid #f1f5f9', padding: '10px 0', opacity: p.estado === 'PROPUESTA' ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{p.etiqueta}: <span style={{ color: '#7c3aed' }}>{fmt(p.valor_final ?? p.valor)}</span>
                  {p.conflicto && <span style={{ marginLeft: 6, background: '#fef3c7', color: '#92400e', fontSize: 11, padding: '2px 6px', borderRadius: 6 }}>Hoy dice: {p.valor_actual}</span>}
                  {p.solo_sugerencia && <span style={{ marginLeft: 6, background: '#e0f2fe', color: '#075985', fontSize: 11, padding: '2px 6px', borderRadius: 6 }}>Sugerencia (lo decide la psicóloga)</span>}
                  {p.confianza === 'media' && <span style={{ marginLeft: 6, color: '#b45309', fontSize: 11 }}>confianza media</span>}
                </div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>“{p.cita}” <span style={{ color: '#94a3b8' }}>{p.minuto}</span></div>
              </div>
              {p.estado === 'PROPUESTA' ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {edit[p.id] !== undefined ? (
                    <>
                      <input value={edit[p.id]} onChange={(e) => setEdit({ ...edit, [p.id]: e.target.value })} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', width: 180 }} />
                      <button style={btn('#7c3aed')} onClick={async () => { const v = Array.isArray(p.valor) ? edit[p.id].split(',').map((x) => x.trim()).filter(Boolean) : edit[p.id]; await post(`proposals/${p.id}/decision`, { accion: 'editar', valor: v }, 'd'); setEdit({ ...edit, [p.id]: undefined }) }}>Guardar</button>
                    </>
                  ) : <button style={btn('#e2e8f0', '#1e293b')} onClick={() => setEdit({ ...edit, [p.id]: fmt(p.valor) })}>Editar</button>}
                  <button disabled={!props.cliente} title={props.cliente ? '' : 'Asocia primero la cliente'} style={btn('#16a34a')} onClick={() => post(`proposals/${p.id}/decision`, { accion: 'aprobar' }, 'd')}>Aprobar</button>
                  <button style={btn('#dc2626')} onClick={() => post(`proposals/${p.id}/decision`, { accion: 'rechazar' }, 'd')}>Rechazar</button>
                </div>
              ) : <span style={{ fontSize: 12, fontWeight: 700 }}>{p.estado} {p.revisado_por ? `· ${p.revisado_por}` : ''}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
