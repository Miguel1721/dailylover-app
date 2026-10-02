import React, { useMemo, useState } from 'react'
import { RefreshCw, UserPlus, X, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

// Personas en 'No hay gente': seguimiento diario. La revisión automática solo gasta el motor cuando entra gente nueva compatible
// (ciudad, género buscado y edad); la IA se pide al proponer, solo para la candidata que interesa.
export default function NoHayGenteLista({ items = [], onCambio, onProponer }) {
  const { token } = useAuth()
  const [q, setQ] = useState('')
  const [solo, setSolo] = useState(false)
  const [busy, setBusy] = useState(null)
  const [aviso, setAviso] = useState('')
  const [verOcultas, setVerOcultas] = useState(false)
  const lista = useMemo(() => items.filter(x => (!solo || (x.nuevos || []).length > 0) && (!q.trim() || `${x.person_a} ${x.city}`.toLowerCase().includes(q.trim().toLowerCase()))), [items, q, solo])
  const conNuevos = items.filter(x => (x.nuevos || []).length > 0).length

  const llamar = async (ruta, body, id) => {
    setBusy(id); setAviso('')
    try {
      const r = await fetch(`${API}/api/v1/matchmaking/matches/no-hay-gente/${ruta}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setAviso(typeof j.detail === 'string' ? j.detail : 'No se pudo completar.'); return null }
      return j
    } catch (e) { setAviso('Sin conexión, intenta otra vez.'); return null } finally { setBusy(null) }
  }
  const revisar = async (x) => {
    const j = await llamar('revisar', { user_id_a: x.user_id_a }, `r${x.user_id_a}`)
    if (j) { setAviso(j.motor_llamado ? (j.hay_nuevos ? 'Hay candidatas nuevas.' : 'Se revisó con el motor: no hay candidatas nuevas.') : 'Revisado: no entró gente nueva compatible, por eso no se gastó el motor.'); onCambio && onCambio() }
  }
  const analizar = async (x, c) => {
    setAviso('Analizando con IA (tarda cerca de un minuto)…')
    const j = await llamar('analizar', { user_id_a: x.user_id_a, candidate_user_id: Number(c.user_id) }, `a${x.user_id_a}-${c.user_id}`)
    if (j) { setAviso(`Análisis listo: ${j.analisis?.puntaje}/10 - ${j.analisis?.veredicto}`); onCambio && onCambio() }
  }
  const descartar = async (x, c) => {
    const j = await llamar('descartar', { user_id_a: x.user_id_a, candidate_user_id: Number(c.user_id) }, `d${x.user_id_a}-${c.user_id}`)
    if (j) onCambio && onCambio()
  }
  const chip = (activo) => ({ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: activo ? '1.5px solid #F59E0B' : '1px solid var(--border-color)', background: activo ? 'rgba(245,158,11,.15)' : 'var(--bg-card)', color: activo ? '#F59E0B' : 'var(--text-secondary)' })

  return (
    <div>
      <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-secondary)' }}>
        Personas sin candidatas por ahora. Cada día se revisa si entró gente nueva que cumpla lo básico (ciudad, género buscado y edad de las dos personas); solo entonces se consulta el motor. Las candidatas nuevas que el motor puntúa alto se analizan solas con la IA (con un tope diario); las demás las analizas tú con el botón.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <button type="button" style={chip(!solo)} onClick={() => setSolo(false)}>Todas {items.length}</button>
        <button type="button" style={chip(solo)} onClick={() => setSolo(true)}>Con candidatas nuevas {conNuevos}</button>
        <button type="button" style={chip(verOcultas)} onClick={() => setVerOcultas(v => !v)}>{verOcultas ? 'Ocultar' : 'Ver'} las que la IA descartó</button>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o ciudad..." style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', minWidth: 220 }} />
      </div>
      {aviso && <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--text-primary)', background: 'rgba(245,158,11,.12)', padding: 10, borderRadius: 10 }}>{aviso}</div>}
      {lista.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 12 }}>No hay personas en esta lista.</div>}
      <div style={{ display: 'grid', gap: 10 }}>
        {lista.map(x => (
          <div key={x.user_id_a} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderLeft: `4px solid ${(x.nuevos || []).length ? '#10B981' : '#F59E0B'}`, borderRadius: 12, padding: 12, color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <b style={{ fontSize: 15 }}>{x.person_a}</b>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}> · {x.gender || '-'}{x.age ? `, ${x.age} años` : ''} · {x.city || 'sin ciudad'} · {x.plan_tier || 'sin plan'}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" disabled={busy === `r${x.user_id_a}`} onClick={() => revisar(x)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  <RefreshCw size={13} /> {busy === `r${x.user_id_a}` ? 'Revisando…' : 'Revisar ahora'}
                </button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {x.slots_sin_gente} slot(s) sin gente · {x.dias_sin_gente != null ? `${x.dias_sin_gente} días sin gente` : 'desde: sin dato'} · última revisión: {x.ultima_revision}
            </div>
            {(x.nuevos || []).length > 0 && (
              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                {[...x.nuevos].filter(c => verOcultas || !c.ocultar_por_ia).sort((a, b) => ((b.ia?.puntaje ?? -1) - (a.ia?.puntaje ?? -1)) || ((b.score ?? 0) - (a.score ?? 0))).map(c => (
                  <div key={c.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', background: 'rgba(16,185,129,.10)', borderRadius: 10, padding: '8px 10px' }}>
                    <span style={{ fontSize: 13.5, flex: '1 1 260px' }}>
                      <Sparkles size={13} style={{ verticalAlign: 'middle', color: '#10B981' }} /> <b>{c.name}</b>{c.score != null ? ` · motor ${c.score}` : ''}{c.detectado ? ` · detectada ${c.detectado}` : ''}
                      {c.ia && <span style={{ display: 'block', marginTop: 4, fontSize: 12.5, color: 'var(--text-secondary)' }}><b style={{ color: c.ia.puntaje >= 8 ? '#10B981' : (c.ia.puntaje >= 6 ? '#F59E0B' : '#EF4444') }}>IA {c.ia.puntaje}/10 · {c.ia.veredicto}</b>{c.ia.resumen ? ` — ${c.ia.resumen}` : ''}{(c.ia.vetos || []).length ? ` · Vetos: ${c.ia.vetos.join('; ')}` : ''}</span>}
                      {!c.ia && c.ia_error && <span style={{ display: 'block', fontSize: 12, color: '#EF4444' }}>La IA no pudo analizarla ({c.ia_error})</span>}
                    </span>
                    <span style={{ display: 'flex', gap: 6 }}>
                      {!c.ia && <button type="button" disabled={busy === `a${x.user_id_a}-${c.user_id}`} onClick={() => analizar(x, c)} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #8B5CF6', background: 'transparent', color: '#8B5CF6', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Analizar con IA</button>}
                      {onProponer && <button type="button" onClick={() => onProponer(x)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: 'none', background: '#10B981', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}><UserPlus size={13} /> Proponer</button>}
                      <button type="button" disabled={busy === `d${x.user_id_a}-${c.user_id}`} onClick={() => descartar(x, c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}><X size={13} /> Descartar</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
