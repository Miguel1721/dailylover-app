import React, { useState, useEffect } from 'react'
import { Shield, Eye, Trash2, Settings, Plus, Lock, CheckCircle, FileText, UserCheck, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function CmsBlindDate() {
  const { token } = useAuth()
  const [activeTab, setActiveTab] = useState('responses')
  const [responses, setResponses] = useState([])
  const [fields, setFields] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const [selectedResponse, setSelectedResponse] = useState(null)
  const [showFieldModal, setShowFieldModal] = useState(false)
  const [fieldFormData, setFieldFormData] = useState({
    field_key: '',
    label: '',
    field_type: 'text',
    options: '',
    is_required: true,
    sort_order: 1,
    is_active: true
  })

  const API_BASE = 'https://prueba-daily.agentesia.cloud/api/v1/admin'

  const fetchData = async () => {
    setLoading(true)
    try {
      const [resResp, resFields, resAudit] = await Promise.all([
        fetch(`${API_BASE}/blind-date-responses`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/blind-date-fields`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/blind-date-audit-logs`, { headers: { 'Authorization': `Bearer ${token}` } })
      ])
      const dataResp = await resResp.json()
      const dataFields = await resFields.json()
      const dataAudit = await resAudit.json()
      setResponses(Array.isArray(dataResp) ? dataResp : [])
      setFields(Array.isArray(dataFields) ? dataFields : [])
      setAuditLogs(Array.isArray(dataAudit) ? dataAudit : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [token])

  const handleDeleteResponse = async (id) => {
    if (!confirm('¿Confirmas el borrado seguro (Derecho al Olvido / ARCO) de esta respuesta?')) return
    try {
      await fetch(`${API_BASE}/blind-date-responses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      fetchData()
    } catch (e) {
      alert('Error eliminando respuesta')
    }
  }

  const handleSaveField = async (e) => {
    e.preventDefault()
    const optionsArray = fieldFormData.options ? fieldFormData.options.split(',').map(o => o.trim()) : []
    const payload = {
      ...fieldFormData,
      options: optionsArray
    }
    try {
      const res = await fetch(`${API_BASE}/blind-date-fields`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        setShowFieldModal(false)
        fetchData()
      } else {
        alert('Error guardando campo')
      }
    } catch (err) {
      alert('Error de conexión')
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            CMS Blind Date <Shield size={20} color="#10B981" />
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
            Respuestas cifradas (Fernet Base64), logs de auditoría estricta y gestor dinámico de campos
          </p>
        </div>
      </div>

      {/* Security Banner */}
      <div style={{
        background: 'rgba(16, 185, 129, 0.08)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
        <Lock size={24} color="#10B981" />
        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
          <span style={{ fontWeight: 700 }}>Seguridad & Cumplimiento Normativo:</span> Las respuestas de contacto e información personal están cifradas en la base de datos PostgreSQL. Cada consulta realizada en esta pantalla queda registrada con marca de tiempo y correo del usuario administrador.
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
        <button
          onClick={() => setActiveTab('responses')}
          style={{
            background: activeTab === 'responses' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'responses' ? '#FFF' : 'var(--text-secondary)',
            border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <FileText size={16} /> Respuestas ({responses.length})
        </button>
        <button
          onClick={() => setActiveTab('fields')}
          style={{
            background: activeTab === 'fields' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'fields' ? '#FFF' : 'var(--text-secondary)',
            border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <Settings size={16} /> Campos del Formulario ({fields.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          style={{
            background: activeTab === 'audit' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'audit' ? '#FFF' : 'var(--text-secondary)',
            border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <Shield size={16} /> Auditoría ({auditLogs.length})
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando datos...</div>
      ) : (
        <>
          {/* TAB 1: RESPONSES */}
          {activeTab === 'responses' && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: 12 }}>Fecha de Envío</th>
                    <th style={{ padding: 12 }}>Ciudad</th>
                    <th style={{ padding: 12 }}>Email Contacto</th>
                    <th style={{ padding: 12 }}>Teléfono</th>
                    <th style={{ padding: 12 }}>Jurisdicción</th>
                    <th style={{ padding: 12 }}>Consentimiento</th>
                    <th style={{ padding: 12, textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
                        {new Date(r.submitted_at).toLocaleString()}
                      </td>
                      <td style={{ padding: 12, textTransform: 'uppercase', color: 'var(--color-primary)', fontWeight: 700 }}>
                        {r.city_id}
                      </td>
                      <td style={{ padding: 12, color: 'var(--text-primary)' }}>{r.contact_email}</td>
                      <td style={{ padding: 12, color: 'var(--text-primary)' }}>{r.contact_phone}</td>
                      <td style={{ padding: 12 }}>
                        <span style={{ background: '#374151', color: '#FFF', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700 }}>
                          {r.jurisdiction} ({r.retention_days}d)
                        </span>
                      </td>
                      <td style={{ padding: 12, color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle size={14} /> Aceptado
                      </td>
                      <td style={{ padding: 12, textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedResponse(r)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', marginRight: 12 }}
                          title="Ver Detalles de la Respuesta"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteResponse(r.id)}
                          style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}
                          title="Borrado Seguro (Habeas Data)"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {responses.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No hay respuestas registradas aún.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: FIELDS MANAGEMENT */}
          {activeTab === 'fields' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button
                  onClick={() => setShowFieldModal(true)}
                  style={{
                    background: 'var(--color-primary)', color: '#FFF', border: 'none', borderRadius: 6,
                    padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  <Plus size={16} /> Agregar Campo al Formulario
                </button>
              </div>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: 12 }}>Orden</th>
                      <th style={{ padding: 12 }}>Key Campo</th>
                      <th style={{ padding: 12 }}>Etiqueta (Label)</th>
                      <th style={{ padding: 12 }}>Tipo</th>
                      <th style={{ padding: 12 }}>Obligatorio</th>
                      <th style={{ padding: 12 }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map(f => (
                      <tr key={f.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: 12, fontWeight: 700, color: 'var(--color-primary)' }}>#{f.sort_order}</td>
                        <td style={{ padding: 12, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{f.field_key}</td>
                        <td style={{ padding: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{f.label}</td>
                        <td style={{ padding: 12, textTransform: 'uppercase', fontSize: 11, color: 'var(--text-muted)' }}>{f.field_type}</td>
                        <td style={{ padding: 12 }}>
                          {f.is_required ? (
                            <span style={{ color: '#EF4444', fontWeight: 700 }}>Sí</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Opcional</span>
                          )}
                        </td>
                        <td style={{ padding: 12 }}>
                          <span style={{ background: f.is_active ? '#10B981' : '#6B7280', color: '#FFF', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700 }}>
                            {f.is_active ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: 12 }}>Fecha & Hora</th>
                    <th style={{ padding: 12 }}>Usuario Administrador</th>
                    <th style={{ padding: 12 }}>Acción Realizada</th>
                    <th style={{ padding: 12 }}>Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: 12, color: 'var(--text-primary)' }}>{new Date(log.created_at).toLocaleString()}</td>
                      <td style={{ padding: 12, fontWeight: 600, color: 'var(--color-primary)' }}>{log.user_email}</td>
                      <td style={{ padding: 12, fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>{log.action}</td>
                      <td style={{ padding: 12, color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 11 }}>
                        {JSON.stringify(log.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Response Detail Modal */}
      {selectedResponse && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16,
            width: '100%', maxWidth: 550, padding: 24, maxHeight: '85vh', overflowY: 'auto'
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>
              Detalles de la Respuesta (Desencriptada)
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Email de Contacto: </span>
                <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{selectedResponse.contact_email}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Teléfono: </span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedResponse.contact_phone}</span>
              </div>
              <div style={{ background: 'var(--bg-base)', padding: 14, borderRadius: 8, marginTop: 8 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Respuestas del Formulario:</div>
                {typeof selectedResponse.answers === 'object' ? (
                  Object.entries(selectedResponse.answers).map(([k, v]) => (
                    <div key={k} style={{ marginBottom: 6 }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{k}: </span>
                      <span style={{ color: 'var(--text-primary)' }}>{String(v)}</span>
                    </div>
                  ))
                ) : (
                  <div>{selectedResponse.answers}</div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={() => setSelectedResponse(null)}
                style={{ padding: '8px 20px', background: 'var(--color-primary)', border: 'none', borderRadius: 6, color: '#FFF', fontWeight: 600, cursor: 'pointer' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Field Creation Modal */}
      {showFieldModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16,
            width: '100%', maxWidth: 500, padding: 24
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>
              Agregar Campo al Formulario
            </h2>
            <form onSubmit={handleSaveField} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Key Identificador (snake_case) *</label>
                <input
                  type="text" required value={fieldFormData.field_key} placeholder="estilo_vida"
                  onChange={e => setFieldFormData({ ...fieldFormData, field_key: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Etiqueta Visible (Label) *</label>
                <input
                  type="text" required value={fieldFormData.label} placeholder="¿Cómo es tu estilo de vida?"
                  onChange={e => setFieldFormData({ ...fieldFormData, label: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Tipo de Campo</label>
                  <select
                    value={fieldFormData.field_type} onChange={e => setFieldFormData({ ...fieldFormData, field_type: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  >
                    <option value="text">Texto Corto</option>
                    <option value="textarea">Texto Largo</option>
                    <option value="number">Número</option>
                    <option value="select">Selección Única</option>
                    <option value="photo_upload">Subida de Foto</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Orden de Aparición</label>
                  <input
                    type="number" value={fieldFormData.sort_order}
                    onChange={e => setFieldFormData({ ...fieldFormData, sort_order: parseInt(e.target.value) || 1 })}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  />
                </div>
              </div>

              {fieldFormData.field_type === 'select' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Opciones (Separadas por Comas)</label>
                  <input
                    type="text" value={fieldFormData.options} placeholder="Opción 1, Opción 2, Opción 3"
                    onChange={e => setFieldFormData({ ...fieldFormData, options: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input
                  type="checkbox" id="is_required" checked={fieldFormData.is_required}
                  onChange={e => setFieldFormData({ ...fieldFormData, is_required: e.target.checked })}
                />
                <label htmlFor="is_required" style={{ fontSize: 13, color: 'var(--text-primary)' }}>Campo Obligatorio</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" onClick={() => setShowFieldModal(false)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 20px', background: 'var(--color-primary)', border: 'none', borderRadius: 6, color: '#FFF', fontWeight: 600, cursor: 'pointer' }}>Guardar Campo</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
