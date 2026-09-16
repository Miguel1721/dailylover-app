import React, { useState, useEffect } from 'react'
import {
  Settings, Sliders, List, Plus, Trash2, ArrowUp, ArrowDown,
  Edit2, CheckCircle, AlertCircle, RefreshCw, Shield, HelpCircle,
  FolderPlus, X, Save, AlertTriangle
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

const FORM_TABS = [
  { id: 'datos_objetivos', label: '📊 Datos Objetivos' },
  { id: 'percepcion_psicologa', label: '🧠 Percepción Psicóloga' }
]

const FIELD_TYPES = [
  { id: 'scale_1_10', label: 'Escala 1 a 10', badge: '#9c27b0', desc: 'Slider numérico del 1 al 10' },
  { id: 'dropdown', label: 'Lista Desplegable', badge: '#2196f3', desc: 'Selección única de opciones predefinidas' },
  { id: 'boolean', label: 'Sí / No', badge: '#4caf50', desc: 'Respuesta afirmativa o negativa' },
  { id: 'text', label: 'Texto Libre', badge: '#ff9800', desc: 'Campo de texto o notas' }
]

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

export default function ConfiguracionFormularios() {
  const { user, token } = useAuth()
  const [activeTab, setActiveTab] = useState('datos_objetivos')
  const [schema, setSchema] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  // Modals
  const [fieldModal, setFieldModal] = useState(null)
  const [sectionModal, setSectionModal] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [newSectionDesc, setNewSectionDesc] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Field modal state
  const [fieldId, setFieldId] = useState('')
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldType, setFieldType] = useState('scale_1_10')
  const [fieldRequired, setFieldRequired] = useState(false)
  const [fieldHelp, setFieldHelp] = useState('')
  const [fieldOptions, setFieldOptions] = useState([])
  const [optionInput, setOptionInput] = useState('')
  const [targetSectionId, setTargetSectionId] = useState('')

  useEffect(() => {
    loadSchema(activeTab)
  }, [activeTab])

  const loadSchema = async (formCode) => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/v1/admin/forms/schemas/${formCode}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      if (!res.ok) throw new Error('Error al cargar la configuración del formulario')
      const data = await res.json()
      setSchema(data)
    } catch (err) {
      console.error(err)
      setToast({ type: 'error', text: err.message || 'Error al conectar con el servidor' })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSchema = async () => {
    if (!schema) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/v1/admin/forms/schemas/${activeTab}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          title: schema.title,
          description: schema.description,
          sections: schema.sections
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al guardar los cambios')

      setSchema(prev => ({ ...prev, ...data.schema }))
      setToast({ type: 'success', text: `¡Formulario "${schema.title}" guardado y publicado en vivo!` })
      setTimeout(() => setToast(null), 4500)
    } catch (err) {
      console.error(err)
      setToast({ type: 'error', text: err.message || 'No se pudo guardar el formulario' })
      setTimeout(() => setToast(null), 5000)
    } finally {
      setSaving(false)
    }
  }

  const handleResetDefault = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/v1/admin/forms/schemas/${activeTab}/reset-default`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al restaurar valores de fábrica')

      await loadSchema(activeTab)
      setConfirmReset(false)
      setToast({ type: 'success', text: 'El formulario ha sido restablecido a su estructura inicial de fábrica.' })
      setTimeout(() => setToast(null), 4500)
    } catch (err) {
      console.error(err)
      setToast({ type: 'error', text: err.message || 'Error al restaurar' })
      setTimeout(() => setToast(null), 5000)
    } finally {
      setSaving(false)
    }
  }

  const moveSection = (secIndex, direction) => {
    if (!schema) return
    const newSections = [...schema.sections]
    const targetIndex = secIndex + direction
    if (targetIndex < 0 || targetIndex >= newSections.length) return
    const temp = newSections[secIndex]
    newSections[secIndex] = newSections[targetIndex]
    newSections[targetIndex] = temp
    setSchema({ ...schema, sections: newSections })
  }

  const handleAddSection = () => {
    if (!newSectionTitle.trim()) return
    const secId = 'sec_' + slugify(newSectionTitle) + '_' + Date.now().toString().slice(-4)
    const newSec = {
      id: secId,
      title: newSectionTitle.trim(),
      order: (schema?.sections?.length || 0) + 1,
      description: newSectionDesc.trim(),
      fields: []
    }
    setSchema(prev => ({
      ...prev,
      sections: [...(prev.sections || []), newSec]
    }))
    setNewSectionTitle('')
    setNewSectionDesc('')
    setSectionModal(false)
  }

  const handleDeleteSection = (secId) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta sección y todas las preguntas que contiene?')) return
    setSchema(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.id !== secId)
    }))
  }

  const moveField = (secIndex, fieldIndex, direction) => {
    if (!schema) return
    const newSections = [...schema.sections]
    const fields = [...newSections[secIndex].fields]
    const targetIndex = fieldIndex + direction
    if (targetIndex < 0 || targetIndex >= fields.length) return
    const temp = fields[fieldIndex]
    fields[fieldIndex] = fields[targetIndex]
    fields[targetIndex] = temp
    newSections[secIndex].fields = fields
    setSchema({ ...schema, sections: newSections })
  }

  const openCreateFieldModal = (secId) => {
    setFieldModal({ mode: 'create', sectionId: secId })
    setTargetSectionId(secId)
    setFieldId('')
    setFieldLabel('')
    setFieldType('scale_1_10')
    setFieldRequired(false)
    setFieldHelp('')
    setFieldOptions([])
    setOptionInput('')
  }

  const openEditFieldModal = (secId, field) => {
    setFieldModal({ mode: 'edit', sectionId: secId, originalFieldId: field.id })
    setTargetSectionId(secId)
    setFieldId(field.id)
    setFieldLabel(field.label)
    setFieldType(field.type || 'scale_1_10')
    setFieldRequired(!!field.required)
    setFieldHelp(field.help_text || '')
    setFieldOptions(field.options || [])
    setOptionInput('')
  }

  const handleSaveField = () => {
    if (!fieldLabel.trim()) {
      alert('Debes ingresar la pregunta o etiqueta del campo.')
      return
    }

    const resolvedId = fieldId.trim() ? slugify(fieldId) : slugify(fieldLabel)
    if (!resolvedId) {
      alert('El identificador del campo no es válido.')
      return
    }

    const fieldObj = {
      id: resolvedId,
      label: fieldLabel.trim(),
      type: fieldType,
      required: fieldRequired,
      help_text: fieldHelp.trim(),
      options: fieldType === 'dropdown' ? fieldOptions : []
    }

    setSchema(prev => {
      const newSections = prev.sections.map(sec => {
        if (fieldModal.mode === 'edit') {
          if (sec.id === fieldModal.sectionId && sec.id !== targetSectionId) {
            return {
              ...sec,
              fields: sec.fields.filter(f => f.id !== fieldModal.originalFieldId)
            }
          }
          if (sec.id === fieldModal.sectionId && sec.id === targetSectionId) {
            return {
              ...sec,
              fields: sec.fields.map(f => f.id === fieldModal.originalFieldId ? fieldObj : f)
            }
          }
          if (sec.id === targetSectionId && sec.id !== fieldModal.sectionId) {
            return {
              ...sec,
              fields: [...sec.fields, fieldObj]
            }
          }
        } else {
          if (sec.id === targetSectionId) {
            return {
              ...sec,
              fields: [...sec.fields, fieldObj]
            }
          }
        }
        return sec
      })
      return { ...prev, sections: newSections }
    })

    setFieldModal(null)
  }

  const confirmDeleteField = () => {
    if (!confirmDelete) return
    const { sectionId, fieldId } = confirmDelete
    setSchema(prev => ({
      ...prev,
      sections: prev.sections.map(sec => {
        if (sec.id === sectionId) {
          return {
            ...sec,
            fields: sec.fields.filter(f => f.id !== fieldId)
          }
        }
        return sec
      })
    }))
    setConfirmDelete(null)
  }

  const handleAddOption = () => {
    if (!optionInput.trim()) return
    if (!fieldOptions.includes(optionInput.trim())) {
      setFieldOptions([...fieldOptions, optionInput.trim()])
    }
    setOptionInput('')
  }

  const handleRemoveOption = (indexToRemove) => {
    setFieldOptions(fieldOptions.filter((_, idx) => idx !== indexToRemove))
  }

  return (
    <div style={{ padding: '24px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>⚙️</span>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Constructor de Formularios Clínicos
            </h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Edita las preguntas, opciones y escalas de los formularios sin tocar código. Los cambios aplican de inmediato en vivo.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setConfirmReset(true)}
            disabled={saving || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 16px',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} />
            Restaurar Defecto
          </button>

          <button
            onClick={handleSaveSchema}
            disabled={saving || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--color-primary)',
              color: 'white',
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? 'wait' : 'pointer',
              boxShadow: '0 4px 12px var(--color-primary-glow)'
            }}
          >
            <Save size={15} />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 18px',
          borderRadius: 8,
          marginBottom: 20,
          background: toast.type === 'success' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 107, 107, 0.15)',
          border: `1px solid ${toast.type === 'success' ? '#4CAF50' : '#ff6b6b'}`,
          color: toast.type === 'success' ? '#4CAF50' : '#ff6b6b'
        }}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span style={{ fontSize: 13, fontWeight: 600 }}>{toast.text}</span>
        </div>
      )}

      {/* Tabs Selector */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-color)', marginBottom: 24 }}>
        {FORM_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              background: activeTab === tab.id ? 'rgba(150, 21, 0, 0.12)' : 'transparent',
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="spinner" style={{ margin: '0 auto 12px' }} />
          <div>Cargando estructura del formulario...</div>
        </div>
      ) : !schema ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          No se pudo cargar el schema del formulario.
        </div>
      ) : (
        <div>
          {/* Schema Metadata Card */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            padding: '18px 24px',
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ flex: 1, marginRight: 24 }}>
              <input
                type="text"
                value={schema.title || ''}
                onChange={e => setSchema({ ...schema, title: e.target.value })}
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--border-color)',
                  outline: 'none',
                  width: '100%',
                  paddingBottom: 4,
                  marginBottom: 6
                }}
              />
              <input
                type="text"
                value={schema.description || ''}
                onChange={e => setSchema({ ...schema, description: e.target.value })}
                placeholder="Descripción para este formulario..."
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  width: '100%'
                }}
              />
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
              <div>Última actualización:</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {schema.updated_at ? new Date(schema.updated_at).toLocaleString('es-CO') : 'Por defecto'}
              </div>
              <div>Por: {schema.updated_by || 'Admin'}</div>
            </div>
          </div>

          {/* Sections List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {schema.sections?.map((section, secIdx) => (
              <div
                key={section.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 12,
                  overflow: 'hidden'
                }}
              >
                {/* Section Header */}
                <div style={{
                  padding: '16px 20px',
                  background: 'rgba(255,255,255,0.02)',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: 'rgba(150, 21, 0, 0.2)',
                      color: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700
                    }}>
                      {secIdx + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {section.title}
                      </div>
                      {section.description && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{section.description}</div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.05)',
                      color: 'var(--text-secondary)',
                      marginLeft: 8
                    }}>
                      {section.fields?.length || 0} preguntas
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => moveSection(secIdx, -1)}
                      disabled={secIdx === 0}
                      title="Mover sección arriba"
                      style={{ background: 'transparent', border: 'none', color: secIdx === 0 ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: secIdx === 0 ? 'default' : 'pointer', padding: 4 }}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      onClick={() => moveSection(secIdx, 1)}
                      disabled={secIdx === schema.sections.length - 1}
                      title="Mover sección abajo"
                      style={{ background: 'transparent', border: 'none', color: secIdx === schema.sections.length - 1 ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: secIdx === schema.sections.length - 1 ? 'default' : 'pointer', padding: 4 }}
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      onClick={() => openCreateFieldModal(section.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--color-primary)',
                        background: 'rgba(150, 21, 0, 0.15)',
                        color: 'var(--color-primary)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginLeft: 8
                      }}
                    >
                      <Plus size={14} />
                      Agregar Pregunta
                    </button>
                    <button
                      onClick={() => handleDeleteSection(section.id)}
                      title="Eliminar sección"
                      style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', padding: 4, marginLeft: 6 }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Section Fields */}
                <div style={{ padding: '12px 16px' }}>
                  {(!section.fields || section.fields.length === 0) ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      No hay preguntas en esta sección. Haz clic en "Agregar Pregunta" para crear una.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {section.fields.map((field, fIdx) => {
                        const typeInfo = FIELD_TYPES.find(t => t.id === field.type) || FIELD_TYPES[3]
                        return (
                          <div
                            key={field.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 14px',
                              background: 'var(--bg-base)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 8
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <button
                                  onClick={() => moveField(secIdx, fIdx, -1)}
                                  disabled={fIdx === 0}
                                  style={{ background: 'transparent', border: 'none', color: fIdx === 0 ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: fIdx === 0 ? 'default' : 'pointer', padding: 0 }}
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  onClick={() => moveField(secIdx, fIdx, 1)}
                                  disabled={fIdx === section.fields.length - 1}
                                  style={{ background: 'transparent', border: 'none', color: fIdx === section.fields.length - 1 ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: fIdx === section.fields.length - 1 ? 'default' : 'pointer', padding: 0 }}
                                >
                                  <ArrowDown size={12} />
                                </button>
                              </div>

                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {field.label}
                                  </span>
                                  {field.required && (
                                    <span style={{ fontSize: 10, background: 'rgba(255, 107, 107, 0.15)', color: '#ff6b6b', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                                      Obligatoria
                                    </span>
                                  )}
                                  <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                                    id: {field.id}
                                  </span>
                                </div>
                                {field.help_text && (
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                    {field.help_text}
                                  </div>
                                )}
                                {field.type === 'dropdown' && field.options?.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                    {field.options.map((opt, oIdx) => (
                                      <span key={oIdx} style={{ fontSize: 10, background: 'rgba(33, 150, 243, 0.1)', color: '#2196f3', padding: '1px 6px', borderRadius: 4 }}>
                                        {opt}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: `${typeInfo.badge}22`,
                                color: typeInfo.badge,
                                border: `1px solid ${typeInfo.badge}44`
                              }}>
                                {typeInfo.label}
                              </span>

                              <button
                                onClick={() => openEditFieldModal(section.id, field)}
                                title="Editar pregunta"
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
                              >
                                <Edit2 size={14} />
                              </button>

                              <button
                                onClick={() => setConfirmDelete({ sectionId: section.id, fieldId: field.id, fieldLabel: field.label })}
                                title="Eliminar pregunta"
                                style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', padding: 4 }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Add Section Button */}
            <button
              onClick={() => setSectionModal(true)}
              style={{
                padding: '14px 20px',
                borderRadius: 12,
                border: '2px dashed var(--border-color)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s'
              }}
            >
              <FolderPlus size={16} />
              Agregar Nueva Sección a este Formulario
            </button>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Field */}
      {fieldModal && (
        <div className="modal-overlay" onClick={() => setFieldModal(null)}>
          <div className="modal" style={{ width: 560, maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                {fieldModal.mode === 'create' ? 'Nueva Pregunta' : 'Editar Pregunta'}
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setFieldModal(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Target Section */}
              <div className="form-group" style={{ margin: 0 }}>
                <label>Sección de destino</label>
                <select
                  value={targetSectionId}
                  onChange={e => setTargetSectionId(e.target.value)}
                >
                  {schema.sections.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>

              {/* Label */}
              <div className="form-group" style={{ margin: 0 }}>
                <label>Pregunta / Etiqueta visible <span style={{ color: '#ff6b6b' }}>*</span></label>
                <input
                  type="text"
                  placeholder="Ej. ¿Tiene disponibilidad para mudarse de ciudad?"
                  value={fieldLabel}
                  onChange={e => {
                    setFieldLabel(e.target.value)
                  }}
                />
              </div>

              {/* Field ID / Slug */}
              <div className="form-group" style={{ margin: 0 }}>
                <label>Identificador en Base de Datos (Slug único)</label>
                <input
                  type="text"
                  placeholder={slugify(fieldLabel) || 'ej: disposicion_mudanza'}
                  value={fieldId}
                  onChange={e => setFieldId(slugify(e.target.value))}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Nombre con el que se almacena en la base de datos (letras minúsculas y guiones bajos).
                </div>
              </div>

              {/* Type */}
              <div className="form-group" style={{ margin: 0 }}>
                <label>Tipo de Campo</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {FIELD_TYPES.map(ft => (
                    <div
                      key={ft.id}
                      onClick={() => setFieldType(ft.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: fieldType === ft.id ? `2px solid ${ft.badge}` : '1px solid var(--border-color)',
                        background: fieldType === ft.id ? `${ft.badge}15` : 'var(--bg-base)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: fieldType === ft.id ? ft.badge : 'var(--text-primary)' }}>
                        {ft.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {ft.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dropdown Options Editor */}
              {fieldType === 'dropdown' && (
                <div className="form-group" style={{ margin: 0, background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <label>Opciones de la lista desplegable</label>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <input
                      type="text"
                      placeholder="Nueva opción (ej: Frecuente)"
                      value={optionInput}
                      onChange={e => setOptionInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddOption() } }}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="btn btn-primary btn-sm"
                    >
                      Agregar
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {fieldOptions.map((opt, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          background: 'rgba(33, 150, 243, 0.15)',
                          color: '#2196f3',
                          border: '1px solid rgba(33, 150, 243, 0.3)',
                          padding: '3px 8px',
                          borderRadius: 6
                        }}
                      >
                        {opt}
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          style={{ background: 'transparent', border: 'none', color: '#2196f3', cursor: 'pointer', padding: 0 }}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Help Text */}
              <div className="form-group" style={{ margin: 0 }}>
                <label>Instrucciones o texto de ayuda para la psicóloga (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Indagar si estaría dispuesto a cambiar de país por amor"
                  value={fieldHelp}
                  onChange={e => setFieldHelp(e.target.value)}
                />
              </div>

              {/* Required Switch */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  id="chk_required"
                  checked={fieldRequired}
                  onChange={e => setFieldRequired(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }}
                />
                <label htmlFor="chk_required" style={{ fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', margin: 0 }}>
                  Marcar como pregunta obligatoria
                </label>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => setFieldModal(null)}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveField}
                >
                  {fieldModal.mode === 'create' ? 'Crear Pregunta' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Section */}
      {sectionModal && (
        <div className="modal-overlay" onClick={() => setSectionModal(false)}>
          <div className="modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Nueva Sección</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setSectionModal(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Título de la Sección <span style={{ color: '#ff6b6b' }}>*</span></label>
                <input
                  type="text"
                  placeholder="Ej. Intereses Culturales & Hobbies"
                  value={newSectionTitle}
                  onChange={e => setNewSectionTitle(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Descripción (Opcional)</label>
                <input
                  type="text"
                  placeholder="Breve explicación de los temas de esta sección"
                  value={newSectionDesc}
                  onChange={e => setNewSectionDesc(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button className="btn btn-ghost" onClick={() => setSectionModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleAddSection}>Crear Sección</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Field with Non-destructive Guarantee */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'rgba(255, 107, 107, 0.15)',
                color: '#ff6b6b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  ¿Quitar esta pregunta del formulario?
                </h3>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  "{confirmDelete.fieldLabel}"
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '12px 14px',
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              marginBottom: 20
            }}>
              🛡️ <strong style={{ color: 'var(--text-primary)' }}>Seguridad de datos garantizada:</strong> Quitar esta pregunta la ocultará de los formularios futuros de las psicólogas, pero <strong>las respuestas históricas ya registradas en clientes existentes no se borrarán de la base de datos</strong>.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button
                style={{
                  background: '#ff6b6b',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
                onClick={confirmDeleteField}
              >
                Sí, quitar pregunta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Reset to Factory Defaults */}
      {confirmReset && (
        <div className="modal-overlay" onClick={() => setConfirmReset(false)}>
          <div className="modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'rgba(255, 193, 7, 0.15)',
                color: '#ffc107',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <RefreshCw size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  ¿Restaurar formulario de fábrica?
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Se restablecerán las preguntas estándar originales.
                </div>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              Esta acción sobreescribirá la estructura actual con la plantilla original del sistema. Los datos y respuestas ya guardados de los clientes se preservan.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={handleResetDefault}
              >
                Confirmar y Restaurar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
