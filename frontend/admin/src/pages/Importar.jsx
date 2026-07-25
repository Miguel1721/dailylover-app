import { useState, useRef } from 'react'
import { FileSpreadsheet, CheckCircle, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

const IMPORT_TYPES = [
  { id: 'clientes', label: 'Clientes', desc: 'Nombre, teléfono, email, perfil psicográfico' },
  { id: 'eventos', label: 'Eventos', desc: 'Nombre, fecha, lugar, capacidad, precio' },
  { id: 'asistentes', label: 'Asistentes a Evento', desc: 'Evento, cliente, estado de asistencia' }
]

const FIELD_OPTIONS = {
  clientes: [
    'users.name',
    'users.phone',
    'users.email',
    'profiles.motivacion',
    'profiles.rol_social',
    'profiles.energia_social',
    'profiles.momento_vital',
    'profiles.intereses',
    'profiles.valores',
    '(ignorar)'
  ],
  eventos: [
    'events.name',
    'events.date',
    'events.location',
    'events.format',
    'events.capacity',
    'events.price',
    '(ignorar)'
  ],
  asistentes: [
    'event_attendees.event_id',
    'event_attendees.user_phone',
    'event_attendees.status',
    '(ignorar)'
  ]
}

function StepIndicator({ step }) {
  const steps = ['Subir Archivo', 'Revisar Mapeo IA', 'Resultado']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
            background: step >= i + 1 ? '#961500' : 'var(--bg-card)',
            color: step >= i + 1 ? 'white' : 'var(--text-muted)',
            border: step >= i + 1 ? 'none' : '1px solid var(--border-color)'
          }}>
            {step > i + 1 ? '✓' : i + 1}
          </div>
          <span style={{
            fontSize: 13,
            color: step === i + 1 ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: step === i + 1 ? 600 : 400
          }}>
            {s}
          </span>
          {i < 2 && <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
        </div>
      ))}
    </div>
  )
}

export default function Importar() {
  const { token } = useAuth()
  const [step, setStep] = useState(1)
  const [importType, setImportType] = useState('clientes')
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [mapping, setMapping] = useState({})
  const [result, setResult] = useState(null)
  const fileRef = useRef()

  const handleFile = async file => {
    if (!file) return
    setLoading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('import_type', importType)
    try {
      const res = await fetch(`${API}/api/v1/admin/import/excel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al procesar el archivo')
      setPreview(data)
      setMapping(data.mapping || {})
      setStep(2)
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/v1/admin/import/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          import_type: importType,
          mapping,
          data: preview.rows
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error en la importación')
      setResult(data)
      setStep(3)
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const resetAll = () => {
    setStep(1)
    setPreview(null)
    setResult(null)
    setMapping({})
  }

  return (
    <div>
      <div className="page-header">
        <h1>Importar desde Excel</h1>
        <p className="page-subtitle">La IA mapea automáticamente tus columnas a la base de datos</p>
      </div>
      <div className="content-area">
        <StepIndicator step={step} />

        {/* ── STEP 1: Upload ── */}
        {step === 1 && (
          <>
            {/* Import type selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              {IMPORT_TYPES.map(t => (
                <div
                  key={t.id}
                  className="step-card"
                  style={{
                    cursor: 'pointer',
                    border: importType === t.id
                      ? '1px solid var(--color-primary)'
                      : '1px solid var(--border-color)',
                    background: importType === t.id
                      ? 'rgba(150,21,0,0.08)'
                      : 'var(--bg-card)'
                  }}
                  onClick={() => setImportType(t.id)}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.desc}</div>
                </div>
              ))}
            </div>

            {/* Drop zone */}
            <div
              className={`drop-zone${dragOver ? ' drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
              onClick={() => !loading && fileRef.current.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
              <FileSpreadsheet
                size={48}
                style={{ color: 'var(--color-primary)', margin: '0 auto 16px', display: 'block' }}
              />
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
                {loading ? 'Procesando con IA...' : 'Arrastra tu Excel aquí'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                {loading
                  ? 'Analizando las columnas automáticamente...'
                  : 'o haz click para seleccionar — .xlsx, .xls, .csv'}
              </div>
              {loading && (
                <div style={{ marginTop: 24 }}>
                  <div className="progress-bar" style={{ width: 220, margin: '0 auto' }}>
                    <div className="progress-fill" style={{ width: '65%' }} />
                  </div>
                </div>
              )}
            </div>

            <div className="import-steps">
              {[
                { n: 1, title: 'Sube el archivo', desc: 'Excel o CSV con tus datos' },
                { n: 2, title: 'IA mapea columnas', desc: 'Detecta automáticamente cada campo' },
                { n: 3, title: 'Confirma e importa', desc: 'Revisa y confirma la importación' }
              ].map(s => (
                <div key={s.n} className="step-card">
                  <div className="step-number">{s.n}</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── STEP 2: Preview & Mapping ── */}
        {step === 2 && preview && (
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">Mapeo de Columnas (sugerido por IA)</div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                La IA analizó tu archivo y propuso este mapeo. Puedes ajustarlo antes de confirmar.
              </p>
              <div className="table-container">
                <table className="mapping-table">
                  <thead>
                    <tr>
                      <th>Columna en tu Excel</th>
                      <th>Campo en la Base de Datos</th>
                      <th>Ejemplo de Dato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.columns.map(col => (
                      <tr key={col} className="mapping-row-ai">
                        <td style={{ fontWeight: 600 }}>{col}</td>
                        <td>
                          <select
                            className="mapping-select"
                            value={mapping[col] || '(ignorar)'}
                            onChange={e => setMapping({ ...mapping, [col]: e.target.value })}
                          >
                            {(FIELD_OPTIONS[importType] || []).map(o => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {preview.rows[0]?.[col] ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">
                Vista previa ({preview.rows.length} filas totales, mostrando {Math.min(3, preview.rows.length)})
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>{preview.columns.map(c => <th key={c}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 3).map((row, i) => (
                      <tr key={i}>
                        {preview.columns.map(c => (
                          <td key={c} style={{ fontSize: 12 }}>{String(row[c] ?? '—')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-ghost" onClick={() => { setStep(1); setPreview(null) }}>
                ← Volver
              </button>
              <button className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
                {loading
                  ? 'Importando...'
                  : `Confirmar e Importar ${preview.rows.length} registros`}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Result ── */}
        {step === 3 && result && (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <CheckCircle
              size={56}
              style={{ color: '#4CAF50', margin: '0 auto 20px', display: 'block' }}
            />
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
              Importación Completa
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
              Tu base de datos ha sido actualizada exitosamente
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
              maxWidth: 400,
              margin: '0 auto 32px'
            }}>
              <div className="stat-card" style={{ textAlign: 'center' }}>
                <div className="stat-number" style={{ color: '#4CAF50' }}>{result.imported ?? 0}</div>
                <div className="stat-label">Importados</div>
              </div>
              <div className="stat-card" style={{ textAlign: 'center' }}>
                <div className="stat-number" style={{ color: '#FFC107' }}>{result.skipped ?? 0}</div>
                <div className="stat-label">Omitidos (dup.)</div>
              </div>
              <div className="stat-card" style={{ textAlign: 'center' }}>
                <div className="stat-number" style={{ color: '#ff6b6b' }}>{result.errors ?? 0}</div>
                <div className="stat-label">Errores</div>
              </div>
            </div>
            <button className="btn btn-primary" onClick={resetAll}>
              Importar otro archivo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
