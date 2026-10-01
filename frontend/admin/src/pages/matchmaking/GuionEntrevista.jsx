import React, { useEffect, useState } from 'react'

// Guion de entrevista como lista de chequeo durante la llamada. Lo marcado se recuerda en este navegador por llamada.
const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

export default function GuionEntrevista({ callId, headers }) {
  const [g, setG] = useState(null)
  const clave = `guion_llamada_${callId}`
  const [hechas, setHechas] = useState(() => { try { return JSON.parse(localStorage.getItem(clave) || '{}') } catch { return {} } })
  const [abierto, setAbierto] = useState(0)

  useEffect(() => {
    fetch(`${API}/api/v1/calls/recursos/guion`, { headers }).then((r) => r.json()).then(setG).catch(() => setG(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { try { localStorage.setItem(clave, JSON.stringify(hechas)) } catch { /* sin almacenamiento */ } }, [hechas, clave])

  if (!g) return null
  const todas = g.bloques.flatMap((b) => b.preguntas)
  const faltanClave = todas.filter((p) => p.clave && !hechas[p.id]).length

  return (
    <div style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 12, padding: 12, fontSize: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <strong>Guion de entrevista</strong>
        <span style={{ color: faltanClave ? '#b45309' : '#15803d', fontWeight: 700 }}>{faltanClave ? `Faltan ${faltanClave} clave` : 'Claves completas'}</span>
      </div>
      {g.bloques.map((b, i) => {
        const hechasB = b.preguntas.filter((p) => hechas[p.id]).length
        return (
          <div key={i} style={{ borderTop: '1px solid #f1f5f9', marginTop: 8, paddingTop: 6 }}>
            <button onClick={() => setAbierto(abierto === i ? -1 : i)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', width: '100%', fontWeight: 700 }}>
              <span>{b.titulo}</span><span style={{ color: '#64748b' }}>{hechasB}/{b.preguntas.length}</span>
            </button>
            {abierto === i && b.preguntas.map((p) => (
              <label key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', cursor: 'pointer', opacity: hechas[p.id] ? 0.55 : 1 }}>
                <input type="checkbox" checked={!!hechas[p.id]} onChange={(e) => setHechas({ ...hechas, [p.id]: e.target.checked })} style={{ marginTop: 3 }} />
                <span>
                  {p.clave && <b style={{ color: '#be123c' }}>● </b>}{p.texto}
                  {p.nota && <span style={{ display: 'block', color: '#64748b', fontSize: 12 }}>{p.nota}</span>}
                </span>
              </label>
            ))}
          </div>
        )
      })}
      <div style={{ color: '#64748b', fontSize: 11, marginTop: 8 }}>● = pregunta clave para el cálculo de compatibilidad.</div>
    </div>
  )
}
