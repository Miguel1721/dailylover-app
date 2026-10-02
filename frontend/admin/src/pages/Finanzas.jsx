import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { Wallet, TrendingUp, TrendingDown, Download, Plus, Trash2, Pencil, Lock, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'
const cop = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const NOMBRE_CAT = { nomina: 'Nómina', honorarios: 'Honorarios', arriendo: 'Arriendo', restaurantes_y_citas: 'Restaurantes y citas', publicidad: 'Publicidad', software: 'Software', comisiones_stripe: 'Comisiones de Stripe', impuestos: 'Impuestos', eventos: 'Eventos', reembolsos: 'Reembolsos', otros: 'Otros' }
const card = { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 14, color: 'var(--text-primary)' }
const btn = (primary, extra = {}) => ({ border: primary ? 'none' : '1px solid var(--border-color)', background: primary ? 'var(--color-primary)' : 'transparent', color: primary ? '#fff' : 'var(--text-primary)', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, ...extra })
const campo = { border: '1px solid var(--border-color)', borderRadius: 10, padding: '8px 10px', fontSize: 13, background: 'var(--bg-base)', color: 'var(--text-primary)' }

function Delta({ actual, anterior, invertir }) {
  if (!anterior) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>sin comparación</span>
  const pct = Math.round(((actual - anterior) / Math.abs(anterior)) * 100)
  const bueno = invertir ? pct <= 0 : pct >= 0
  const Icono = pct >= 0 ? ArrowUpRight : ArrowDownRight
  return <span style={{ fontSize: 12, fontWeight: 700, color: bueno ? '#16a34a' : '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 2 }}><Icono size={13} />{Math.abs(pct)}%</span>
}

function Tarjeta({ titulo, p, ant, etiquetaAnt, mostrarGastos }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>{titulo}</div>
      <div style={{ fontSize: 26, fontWeight: 800, margin: '4px 0' }}>{cop(p?.ingresos)}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p?.n_pagos || 0} pagos · reembolsos {cop(p?.reembolsos)}</div>
      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}>
        <Delta actual={p?.ingresos || 0} anterior={ant?.ingresos || 0} /> vs {etiquetaAnt} ({cop(ant?.ingresos)})
      </div>
      {mostrarGastos && <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-color)', fontSize: 13 }}>Gastos {cop(p?.gastos)} · <b style={{ color: (p?.utilidad || 0) >= 0 ? '#16a34a' : '#dc2626' }}>Utilidad {cop(p?.utilidad)}</b></div>}
    </div>
  )
}

export default function Finanzas() {
  const { token, user } = useAuth()
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])
  const esMaria = (user?.role || '') === 'Super Admin'
  const [tab, setTab] = useState('resumen')
  const [agrupar, setAgrupar] = useState('dia')
  const [res, setRes] = useState(null)
  const [ing, setIng] = useState(null)
  const [gas, setGas] = useState(null)
  const hoy = new Date()
  const [rIng, setRIng] = useState({ desde: iso(new Date(hoy.getTime() - 6 * 86400000)), hasta: iso(hoy), q: '' })
  const [rGas, setRGas] = useState({ desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: iso(hoy) })
  const [err, setErr] = useState('')
  const [form, setForm] = useState(null)   // { tipo: 'ingreso'|'gasto', id?, ...campos }
  const [busy, setBusy] = useState(false)

  const get = useCallback(async (ruta) => {
    const r = await fetch(`${API}/api/v1/finanzas/${ruta}`, { headers })
    if (!r.ok) throw new Error(r.status === 403 ? 'Finanzas es solo para María.' : 'No se pudo cargar.')
    return r.json()
  }, [headers])

  useEffect(() => { if (esMaria) get(`resumen?agrupar=${agrupar}`).then(setRes).catch(e => setErr(e.message)) }, [agrupar, get, esMaria])
  useEffect(() => { if (esMaria && tab === 'ingresos') get(`ingresos?desde=${rIng.desde}&hasta=${rIng.hasta}&q=${encodeURIComponent(rIng.q)}`).then(setIng).catch(e => setErr(e.message)) }, [tab, rIng, get, esMaria])
  const cargarGastos = useCallback(() => get(`gastos?desde=${rGas.desde}&hasta=${rGas.hasta}`).then(setGas).catch(e => setErr(e.message)), [rGas, get])
  useEffect(() => { if (esMaria && tab === 'gastos') cargarGastos() }, [tab, cargarGastos, esMaria])

  if (!esMaria) return <div style={{ padding: 24, maxWidth: 520, margin: '0 auto' }}><div style={{ ...card, display: 'flex', gap: 10, alignItems: 'center' }}><Lock size={18} /> Finanzas es solo para María.</div></div>

  const exportar = async (tipo, desde, hasta) => {
    const r = await fetch(`${API}/api/v1/finanzas/exportar?tipo=${tipo}&desde=${desde}&hasta=${hasta}`, { headers })
    if (!r.ok) { setErr('No se pudo exportar.'); return }
    const url = URL.createObjectURL(await r.blob())
    const a = document.createElement('a'); a.href = url; a.download = `finanzas_${tipo}_${desde}_${hasta}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const guardar = async () => {
    setBusy(true); setErr('')
    try {
      const esGasto = form.tipo === 'gasto'
      const body = esGasto
        ? { fecha: form.fecha, monto: Number(form.monto), categoria: form.categoria, descripcion: form.descripcion, proveedor: form.proveedor || null, metodo: form.metodo || null, recurrente: !!form.recurrente, notas: form.notas || null }
        : { fecha: form.fecha, monto: Number(form.monto), categoria: form.categoria, descripcion: form.descripcion, cliente: form.cliente || null, metodo: form.metodo || null }
      const url = `${API}/api/v1/finanzas/${esGasto ? 'gastos' : 'ingresos'}${form.id ? `/${form.id}` : ''}`
      const r = await fetch(url, { method: form.id ? 'PUT' : 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(typeof j.detail === 'string' ? j.detail : 'Revisa los datos del formulario.'); return }
      setForm(null)
      if (esGasto) cargarGastos(); else setRIng({ ...rIng })
      get(`resumen?agrupar=${agrupar}`).then(setRes)
    } finally { setBusy(false) }
  }
  const borrar = async (tipo, id) => {
    if (!window.confirm(tipo === 'gasto' ? '¿Borrar este gasto?' : '¿Borrar este ingreso manual?')) return
    const r = await fetch(`${API}/api/v1/finanzas/${tipo === 'gasto' ? 'gastos' : 'ingresos'}/${id}`, { method: 'DELETE', headers })
    if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(j.detail || 'No se pudo borrar.'); return }
    if (tipo === 'gasto') cargarGastos(); else setRIng({ ...rIng })
    get(`resumen?agrupar=${agrupar}`).then(setRes)
  }

  const t = res?.tarjetas
  const etiqueta = (p) => { const d = new Date(p + 'T00:00:00'); return agrupar === 'mes' ? d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }) : `${d.getDate()}/${d.getMonth() + 1}` }
  const grafico = res ? {
    labels: res.serie.map(s => etiqueta(s.periodo)),
    datasets: [
      { label: 'Ingresos', data: res.serie.map(s => s.ingresos), backgroundColor: 'rgba(22,163,74,.75)', borderRadius: 4 },
      { label: 'Gastos', data: res.serie.map(s => s.gastos), backgroundColor: 'rgba(220,38,38,.7)', borderRadius: 4 },
    ],
  } : null
  const tabBtn = (id, label) => <button type="button" onClick={() => setTab(id)} style={{ ...btn(tab === id), flex: 1, justifyContent: 'center' }}>{label}</button>

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto', fontFamily: 'var(--font-family)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <Wallet size={22} color="var(--color-primary-light)" />
        <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text-primary)' }}>Finanzas</h2>
        <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: 'rgba(150,21,0,.15)', color: 'var(--color-primary-light)', display: 'inline-flex', gap: 4, alignItems: 'center' }}><Lock size={11} /> Solo María</span>
      </div>
      {err && <div style={{ ...card, borderColor: '#dc2626', marginBottom: 10 }}>{err}</div>}

      {t && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 14 }}>
          <Tarjeta titulo="HOY" p={t.hoy} ant={t.ayer} etiquetaAnt="ayer" />
          <Tarjeta titulo="ESTA SEMANA (lun-hoy)" p={t.semana} ant={t.semana_anterior} etiquetaAnt="la semana pasada (mismo tramo)" />
          <Tarjeta titulo="ESTE MES" p={t.mes} ant={t.mes_anterior} etiquetaAnt="el mes pasado (mismo tramo)" mostrarGastos />
        </div>
      )}
      {res?.ultimo_pago_registrado && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Último pago registrado: {res.ultimo_pago_registrado}. Los pagos de Stripe entran solos; las transferencias y el efectivo se registran como ingreso manual.</div>}

      <div style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, marginBottom: 14 }}>
        {tabBtn('resumen', 'Resumen')}{tabBtn('ingresos', 'Ingresos')}{tabBtn('gastos', 'Gastos')}
      </div>

      {tab === 'resumen' && res && (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
            {['dia', 'semana', 'mes'].map(a => <button key={a} type="button" onClick={() => setAgrupar(a)} style={btn(agrupar === a, { padding: '6px 14px' })}>{a === 'dia' ? 'Por día' : a === 'semana' ? 'Por semana' : 'Por mes'}</button>)}
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{res.desde} a {res.hasta}</span>
          </div>
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8, fontSize: 13 }}>
              <span>Ingresos <b>{cop(res.totales.ingresos)}</b></span><span>Gastos <b>{cop(res.totales.gastos)}</b></span>
              <span>Utilidad <b style={{ color: res.totales.utilidad >= 0 ? '#16a34a' : '#dc2626' }}>{cop(res.totales.utilidad)}</b></span><span>{res.totales.n_pagos} pagos</span><span>Reembolsos {cop(res.totales.reembolsos)}</span>
            </div>
            <div style={{ height: 260 }}><Bar data={grafico} options={{ maintainAspectRatio: false, plugins: { legend: { labels: { color: '#9A8A8D' } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${cop(c.parsed.y)}` } } }, scales: { x: { ticks: { color: '#9A8A8D' }, grid: { display: false } }, y: { ticks: { color: '#9A8A8D', callback: (v) => cop(v) }, grid: { color: 'rgba(255,255,255,.06)' } } } }} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div style={card}><b>Ingresos por categoría</b>{res.por_categoria.map(c => <div key={c.categoria} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderTop: '1px solid var(--border-color)' }}><span>{c.categoria}</span><b>{cop(c.monto)}</b></div>)}</div>
            <div style={card}><b>Planes que más ingresan</b>{res.por_plan.map(c => <div key={c.plan} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '5px 0', borderTop: '1px solid var(--border-color)' }}><span>{c.plan} <span style={{ color: 'var(--text-muted)' }}>({c.n})</span></span><b>{cop(c.neto)}</b></div>)}</div>
            <div style={card}><b>Gastos por categoría</b>{res.gastos_por_categoria.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Sin gastos en este rango.</div>}{res.gastos_por_categoria.map(c => <div key={c.categoria} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderTop: '1px solid var(--border-color)' }}><span>{NOMBRE_CAT[c.categoria] || c.categoria}</span><b>{cop(c.monto)}</b></div>)}</div>
          </div>
          <div style={{ ...card, overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: 'var(--text-secondary)', textAlign: 'right' }}><th style={{ textAlign: 'left', padding: 6 }}>Periodo</th><th>Pagos</th><th>Ingresos</th><th>Gastos</th><th>Utilidad</th></tr></thead>
              <tbody>{[...res.serie].reverse().map(s => <tr key={s.periodo} style={{ borderTop: '1px solid var(--border-color)', textAlign: 'right' }}><td style={{ textAlign: 'left', padding: 6 }}>{s.periodo}</td><td>{s.n_pagos}</td><td>{cop(s.ingresos)}</td><td>{cop(s.gastos)}</td><td style={{ color: s.utilidad >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{cop(s.utilidad)}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ingresos' && (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
            <input type="date" style={campo} value={rIng.desde} onChange={(e) => setRIng({ ...rIng, desde: e.target.value })} /><input type="date" style={campo} value={rIng.hasta} onChange={(e) => setRIng({ ...rIng, hasta: e.target.value })} />
            <input style={{ ...campo, minWidth: 180 }} placeholder="Buscar cliente, plan o referencia" value={rIng.q} onChange={(e) => setRIng({ ...rIng, q: e.target.value })} />
            <button type="button" style={btn(true)} onClick={() => setForm({ tipo: 'ingreso', fecha: iso(new Date()), monto: '', categoria: 'transferencia', descripcion: '', cliente: '', metodo: 'transferencia' })}><Plus size={14} />Ingreso manual</button>
            <button type="button" style={btn(false)} onClick={() => exportar('ingresos', rIng.desde, rIng.hasta)}><Download size={14} />CSV</button>
          </div>
          {ing && <div style={{ fontSize: 13, marginBottom: 8 }}>{ing.n} movimientos · bruto <b>{cop(ing.total_bruto)}</b> · reembolsos {cop(ing.reembolsos)} · neto <b>{cop(ing.total_neto)}</b></div>}
          <div style={{ ...card, overflowX: 'auto', padding: 8 }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}><th style={{ padding: 6 }}>Fecha</th><th>Cliente</th><th>Plan / concepto</th><th>Categoría</th><th style={{ textAlign: 'right' }}>Bruto</th><th style={{ textAlign: 'right' }}>Reembolso</th><th style={{ textAlign: 'right' }}>Neto</th><th /></tr></thead>
              <tbody>{(ing?.items || []).map(x => <tr key={x.origen + x.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                <td style={{ padding: 6, whiteSpace: 'nowrap' }}>{x.fecha} {x.hora}</td><td>{x.cliente}</td><td>{x.plan}</td><td>{x.categoria}</td>
                <td style={{ textAlign: 'right' }}>{cop(x.bruto)}</td><td style={{ textAlign: 'right', color: x.reembolso ? '#dc2626' : 'inherit' }}>{x.reembolso ? cop(x.reembolso) : ''}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{cop(x.neto)}</td>
                <td>{x.origen === 'manual' && <button type="button" style={btn(false, { padding: '4px 8px' })} onClick={() => borrar('ingreso', x.id)} aria-label="Borrar"><Trash2 size={13} /></button>}</td></tr>)}</tbody>
            </table>
            {ing && ing.items.length === 0 && <div style={{ padding: 16, color: 'var(--text-muted)' }}>No hay ingresos en este rango.</div>}
          </div>
        </div>
      )}

      {tab === 'gastos' && (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
            <input type="date" style={campo} value={rGas.desde} onChange={(e) => setRGas({ ...rGas, desde: e.target.value })} /><input type="date" style={campo} value={rGas.hasta} onChange={(e) => setRGas({ ...rGas, hasta: e.target.value })} />
            <button type="button" style={btn(true)} onClick={() => setForm({ tipo: 'gasto', fecha: iso(new Date()), monto: '', categoria: 'otros', descripcion: '', proveedor: '', metodo: 'transferencia', recurrente: false, notas: '' })}><Plus size={14} />Registrar gasto</button>
            <button type="button" style={btn(false)} onClick={() => exportar('gastos', rGas.desde, rGas.hasta)}><Download size={14} />CSV</button>
          </div>
          {gas && <div style={{ fontSize: 13, marginBottom: 8 }}>Total gastos del rango: <b>{cop(gas.total)}</b>{Object.entries(gas.por_categoria).map(([k, v]) => <span key={k} style={{ marginLeft: 12, color: 'var(--text-secondary)' }}>{NOMBRE_CAT[k] || k}: {cop(v)}</span>)}</div>}
          <div style={{ ...card, overflowX: 'auto', padding: 8 }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}><th style={{ padding: 6 }}>Fecha</th><th>Categoría</th><th>Descripción</th><th>Proveedor</th><th style={{ textAlign: 'right' }}>Monto</th><th /></tr></thead>
              <tbody>{(gas?.items || []).map(g => <tr key={g.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                <td style={{ padding: 6, whiteSpace: 'nowrap' }}>{g.fecha}</td><td>{NOMBRE_CAT[g.categoria] || g.categoria}{g.recurrente ? ' · recurrente' : ''}</td><td>{g.descripcion}</td><td>{g.proveedor}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{cop(g.monto)}</td>
                <td style={{ whiteSpace: 'nowrap' }}><button type="button" style={btn(false, { padding: '4px 8px' })} onClick={() => setForm({ tipo: 'gasto', id: g.id, fecha: g.fecha, monto: g.monto, categoria: g.categoria, descripcion: g.descripcion, proveedor: g.proveedor, metodo: g.metodo, recurrente: g.recurrente, notas: g.notas })} aria-label="Editar"><Pencil size={13} /></button> <button type="button" style={btn(false, { padding: '4px 8px' })} onClick={() => borrar('gasto', g.id)} aria-label="Borrar"><Trash2 size={13} /></button></td></tr>)}</tbody>
            </table>
            {gas && gas.items.length === 0 && <div style={{ padding: 16, color: 'var(--text-muted)' }}>No hay gastos en este rango. La nómina liquidada se registra sola como gasto.</div>}
          </div>
        </div>
      )}

      {form && (
        <div role="dialog" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setForm(null)}>
          <div style={{ ...card, width: '100%', maxWidth: 440, maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{form.tipo === 'gasto' ? (form.id ? 'Editar gasto' : 'Registrar gasto') : 'Ingreso manual'}</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Fecha<input type="date" style={{ ...campo, width: '100%' }} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></label>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Monto (COP)<input type="number" min="0" style={{ ...campo, width: '100%' }} value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} /></label>
              {form.tipo === 'gasto'
                ? <label style={{ fontSize: 12, fontWeight: 700 }}>Categoría<select style={{ ...campo, width: '100%' }} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>{Object.entries(NOMBRE_CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                : <label style={{ fontSize: 12, fontWeight: 700 }}>Tipo<select style={{ ...campo, width: '100%' }} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>{['transferencia', 'efectivo', 'plan', 'evento', 'otro'].map(k => <option key={k} value={k}>{k}</option>)}</select></label>}
              <label style={{ fontSize: 12, fontWeight: 700 }}>Descripción<input style={{ ...campo, width: '100%' }} value={form.descripcion} maxLength={255} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></label>
              {form.tipo === 'gasto'
                ? <label style={{ fontSize: 12, fontWeight: 700 }}>Proveedor<input style={{ ...campo, width: '100%' }} value={form.proveedor || ''} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} /></label>
                : <label style={{ fontSize: 12, fontWeight: 700 }}>Cliente<input style={{ ...campo, width: '100%' }} value={form.cliente || ''} onChange={(e) => setForm({ ...form, cliente: e.target.value })} /></label>}
              <label style={{ fontSize: 12, fontWeight: 700 }}>Medio de pago<input style={{ ...campo, width: '100%' }} value={form.metodo || ''} onChange={(e) => setForm({ ...form, metodo: e.target.value })} /></label>
              {form.tipo === 'gasto' && <label style={{ fontSize: 13 }}><input type="checkbox" checked={!!form.recurrente} onChange={(e) => setForm({ ...form, recurrente: e.target.checked })} /> Gasto recurrente (mensual)</label>}
            </div>
            {err && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button type="button" disabled={busy} style={btn(true)} onClick={guardar}>Guardar</button><button type="button" style={btn(false)} onClick={() => setForm(null)}>Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
