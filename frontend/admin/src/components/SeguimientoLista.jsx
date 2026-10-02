import React, { useMemo, useState } from 'react'
import { CalendarCheck, AlertTriangle, CheckCircle2, Clock, UserCheck, Heart } from 'lucide-react'

const TONO = {
  'Aprobado por María - falta agendar': ['#10B981', CheckCircle2],
  'Agendando la cita': ['#F59E0B', Clock],
  'Por confirmar': ['#F59E0B', Clock],
  'Por reprogramar': ['#F59E0B', Clock],
  'En pausa': ['#94A3B8', Clock],
  'Cita programada': ['#3B82F6', CalendarCheck],
  'Cita reservada': ['#3B82F6', CalendarCheck],
  'Cita realizada': ['#16A34A', UserCheck],
  'Rechazo (trouble)': ['#8B5CF6', AlertTriangle],
  'Rechazo (persona)': ['#8B5CF6', AlertTriangle],
  'No match / cambiar': ['#8B5CF6', AlertTriangle],
  'Reembolso': ['#EF4444', AlertTriangle],
  'Enamorados': ['#EC4899', Heart],
}

// Lista de seguimiento: lo que pasa con cada match después de que María lo aprueba. La ven María y las DOS psicólogas (la de A y la de B).
export default function SeguimientoLista({ items = [], titulo = 'Seguimiento', dias = 21 }) {
  const [estado, setEstado] = useState('todos')
  const [q, setQ] = useState('')
  const conteo = useMemo(() => items.reduce((acc, x) => { acc[x.estado] = (acc[x.estado] || 0) + 1; return acc }, {}), [items])
  const lista = items.filter(x => (estado === 'todos' || x.estado === estado) && (!q.trim() || `${x.person_a} ${x.person_b} ${x.psicologa_a} ${x.psicologa_b}`.toLowerCase().includes(q.trim().toLowerCase())))
  const chip = (activo, color) => ({
    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
    border: activo ? `1.5px solid ${color}` : '1px solid var(--border-color)', background: activo ? `${color}26` : 'var(--bg-card)', color: activo ? color : 'var(--text-secondary)',
  })
  return (
    <div>
      <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-secondary)' }}>
        {titulo}: novedades de los últimos {dias} días en matches que ya aprobó María. Aquí ven lo mismo María, la psicóloga de la persona A y la de la persona B.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <button type="button" onClick={() => setEstado('todos')} style={chip(estado === 'todos', '#B8324F')}>Todos {items.length}</button>
        {Object.keys(conteo).sort().map(e => <button key={e} type="button" onClick={() => setEstado(e)} style={chip(estado === e, (TONO[e] || ['#94A3B8'])[0])}>{e} {conteo[e]}</button>)}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por persona o psicóloga..."
        style={{ width: '100%', maxWidth: 420, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', marginBottom: 12 }} />
      {lista.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 12 }}>No hay novedades en este momento.</div>}
      <div style={{ display: 'grid', gap: 10 }}>
        {lista.map(x => {
          const [color, Icono] = TONO[x.estado] || ['#94A3B8', Clock]
          return (
            <div key={x.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderLeft: `4px solid ${color}`, borderRadius: 12, padding: 12, color: 'var(--text-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <b style={{ fontSize: 15 }}>{x.person_a} <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>x</span> {x.person_b}</b>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${color}26`, color, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 800 }}>
                  <Icono size={13} /> {x.estado}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 6, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <span>Psicóloga de A: <b>{x.psicologa_a || '-'}</b></span>
                <span>Psicóloga de B: <b>{x.psicologa_b || '-'}</b></span>
                {x.plan_tier && <span>Plan: {x.plan_tier}</span>}
                {x.city && <span>{x.city}</span>}
              </div>
              {(x.cita_fecha || x.cita_lugar) && <div style={{ fontSize: 13, marginTop: 6 }}><CalendarCheck size={13} style={{ verticalAlign: 'middle' }} /> {x.cita_fecha} {x.cita_lugar ? `· ${x.cita_lugar}` : ''} {x.cita_realizada ? '· realizada' : ''}</div>}
              {(x.confirmacion_a || x.confirmacion_b) && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Confirmación: A {x.confirmacion_a || '-'} · B {x.confirmacion_b || '-'}{x.etapa_cs ? ` · etapa: ${x.etapa_cs}` : ''}</div>}
              {x.motivo_rechazo && <div style={{ fontSize: 12.5, marginTop: 4, color: '#8B5CF6' }}>Motivo: {x.motivo_rechazo}</div>}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Última novedad: {x.ultima_novedad}{x.aprobado_en ? ` · aprobado ${x.aprobado_en}` : ''}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
