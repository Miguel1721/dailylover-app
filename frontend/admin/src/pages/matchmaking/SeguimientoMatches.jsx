import React, { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import SeguimientoLista from '../../components/SeguimientoLista'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

// Pantalla de María y la dirección: todos los matches aprobados y su avance, con la psicóloga ACTUAL de cada persona
export default function SeguimientoMatches() {
  const { token } = useAuth()
  const [dias, setDias] = useState(21)
  const [data, setData] = useState({ items: [] })
  const [err, setErr] = useState('')
  const [cargando, setCargando] = useState(true)
  useEffect(() => {
    setCargando(true)
    fetch(`${API}/api/v1/matchmaking/matches/seguimiento?dias=${dias}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error('No se pudo cargar el seguimiento.'); return r.json() })
      .then(j => { setData(j); setErr('') }).catch(e => setErr(e.message)).finally(() => setCargando(false))
  }, [dias, token])
  return (
    <div style={{ padding: 16, maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text-primary)' }}>Seguimiento de matches</h2>
        <select value={dias} onChange={(e) => setDias(Number(e.target.value))} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
          {[7, 14, 21, 30, 60, 90].map(d => <option key={d} value={d}>Últimos {d} días</option>)}
        </select>
      </div>
      {err && <div style={{ color: '#dc2626', marginBottom: 8 }}>{err}</div>}
      {cargando ? <div style={{ color: 'var(--text-secondary)' }}>Cargando…</div> : <SeguimientoLista items={data.items || []} dias={data.dias || dias} />}
    </div>
  )
}
