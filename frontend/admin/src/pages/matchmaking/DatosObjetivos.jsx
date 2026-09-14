import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Save, CheckCircle, AlertCircle, RefreshCw, Sparkles, UserCheck, Shield, Award, Compass, HeartHandshake } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import RatingSlider10 from '../../components/RatingSlider10'
import ClientSelectorBar from '../../components/ClientSelectorBar'

const API = 'https://prueba-daily.agentesia.cloud'

const WEEKEND_STYLES = [
  { id: 'Casero', label: '🛋️ Casero / Tranquilo' },
  { id: 'Activo urbano', label: '🏙️ Activo urbano (Cultura/Restaurantes)' },
  { id: 'Naturaleza-aventura', label: '🌲 Naturaleza / Aventura' },
  { id: 'Social', label: '🎉 Social / Vida nocturna / Eventos' },
  { id: 'Mixto', label: '⚖️ Mixto y flexible' }
]

export default function DatosObjetivos({ standalone = true, onContinue, client = null }) {
  const { user, token } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlUserId = searchParams.get('user_id') || searchParams.get('id')

  const [selectedClient, setSelectedClient] = useState(client)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [exists, setExists] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [updatedBy, setUpdatedBy] = useState(null)

  // Form State
  const [formData, setFormData] = useState({
    social_group_score: 5.0,
    education_level: 5,
    mobility_travel: 5,
    physical_activity_level: 5,
    social_energy_level: 5,
    life_structure_level: 5,
    weekend_style: [],
    religion_importance: 1,
    political_self_placement: 'apolítico',
    kids_importance: 5,
    traditionalism_level: 5
  })

  // Load client from prop or URL
  useEffect(() => {
    if (client && (!selectedClient || selectedClient.id !== client.id)) {
      setSelectedClient(client)
      loadExtendedProfile(client.id)
    } else if (urlUserId && !selectedClient) {
      loadExtendedProfile(urlUserId)
    }
  }, [client, urlUserId])

  const handleSelectClient = (client) => {
    setSelectedClient(client)
    setSearchParams({ user_id: client.id })
    loadExtendedProfile(client.id)
  }

  const handleClearClient = () => {
    setSelectedClient(null)
    setSearchParams({})
    setExists(false)
    setLastUpdated(null)
    setUpdatedBy(null)
  }

  const loadExtendedProfile = (userId) => {
    setLoading(true)
    fetch(`${API}/api/v1/matchmaking/extended-profile/${userId}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
      .then(r => r.json())
      .then(res => {
        if (res.client) {
          setSelectedClient(res.client)
        }
        if (res.exists && res.profile) {
          const p = res.profile
          setFormData({
            social_group_score: p.social_group_score !== null && p.social_group_score !== undefined ? Number(p.social_group_score) : 5.0,
            education_level: p.education_level || 5,
            mobility_travel: p.mobility_travel || 5,
            physical_activity_level: p.physical_activity_level || 5,
            social_energy_level: p.social_energy_level || 5,
            life_structure_level: p.life_structure_level || 5,
            weekend_style: p.weekend_style || [],
            religion_importance: p.religion_importance || 1,
            political_self_placement: p.political_self_placement || 'apolítico',
            kids_importance: p.kids_importance || 5,
            traditionalism_level: p.traditionalism_level || 5
          })
          setExists(true)
          setLastUpdated(p.updated_at)
          setUpdatedBy(p.updated_by)
        } else {
          setExists(false)
          setLastUpdated(null)
          setUpdatedBy(null)
          // Default values
          setFormData({
            social_group_score: 5.0,
            education_level: 5,
            mobility_travel: 5,
            physical_activity_level: 5,
            social_energy_level: 5,
            life_structure_level: 5,
            weekend_style: [],
            religion_importance: 1,
            political_self_placement: 'apolítico',
            kids_importance: 5,
            traditionalism_level: 5
          })
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Error loading extended profile:', err)
        setLoading(false)
      })
  }

  const handleToggleWeekend = (styleId) => {
    setFormData(prev => {
      const cur = prev.weekend_style || []
      if (cur.includes(styleId)) {
        return { ...prev, weekend_style: cur.filter(s => s !== styleId) }
      } else {
        return { ...prev, weekend_style: [...cur, styleId] }
      }
    })
  }

  const handleSave = async (e) => {
    if (e) e.preventDefault()
    if (!selectedClient) {
      alert('Debes seleccionar un cliente primero.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        social_group_score: formData.social_group_score,
        education_level: formData.education_level,
        mobility_travel: formData.mobility_travel,
        physical_activity_level: formData.physical_activity_level,
        social_energy_level: formData.social_energy_level,
        life_structure_level: formData.life_structure_level,
        weekend_style: formData.weekend_style,
        religion_importance: formData.religion_importance,
        political_self_placement: formData.political_self_placement,
        kids_importance: formData.kids_importance,
        traditionalism_level: formData.traditionalism_level,
        updated_by: user?.name || 'Psicóloga'
      }

      const res = await fetch(`${API}/api/v1/matchmaking/extended-profile/${selectedClient.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al guardar los datos')

      setExists(true)
      setLastUpdated(data.profile?.updated_at || new Date().toISOString())
      setUpdatedBy(data.profile?.updated_by || user?.name || 'Psicóloga')
      setToast({ type: 'success', text: '¡Datos Objetivos guardados correctamente en la base de datos!' })
      setTimeout(() => setToast(null), 4500)
    } catch (err) {
      console.error('Error saving extended profile:', err)
      setToast({ type: 'error', text: err.message || 'Error al guardar' })
      setTimeout(() => setToast(null), 5000)
    } finally {
      setSaving(false)
    }
  }

  const isApolitico = formData.political_self_placement === 'apolítico' || formData.political_self_placement === 'apolitico'
  const politicalVal = isApolitico ? 5 : (parseInt(formData.political_self_placement, 10) || 5)

  return (
    <div style={{ paddingBottom: 60 }}>
      {standalone && (
        <div className="page-header" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'rgba(150, 21, 0, 0.15)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Award size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
                📋 Formulario 1: Datos Objetivos del Cliente
              </h1>
              <p className="page-subtitle" style={{ margin: '3px 0 0' }}>
                Nivel socioeconómico ampliado (1.0 - 10.0), hábitos de vida, educación y valores cuantificables.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={standalone ? "content-area" : ""}>
        {standalone && (
          <ClientSelectorBar
            selectedClient={selectedClient}
            onSelectClient={handleSelectClient}
            onClearClient={handleClearClient}
            lastUpdated={lastUpdated}
            updatedBy={updatedBy}
            exists={exists}
          />
        )}

        {/* Toast Notification */}
        {toast && (
          <div style={{
            marginBottom: 20,
            padding: '12px 18px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: toast.type === 'success' ? 'rgba(76, 175, 80, 0.18)' : 'rgba(150, 21, 0, 0.18)',
            border: `1px solid ${toast.type === 'success' ? '#4CAF50' : '#ff6b6b'}`,
            color: toast.type === 'success' ? '#4CAF50' : '#ff6b6b',
            fontSize: 14,
            fontWeight: 600,
            boxShadow: '0 4px 14px rgba(0,0,0,0.3)'
          }}>
            {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            {toast.text}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Cargando perfil extendido del cliente...</div>
          </div>
        )}

        {/* Empty State when no client selected */}
        {!selectedClient && !loading && (
          <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(150, 21, 0, 0.1)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Compass size={32} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
              Selecciona un cliente para comenzar
            </h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: 460, margin: '0 auto 20px', fontSize: 13, lineHeight: 1.5 }}>
              Usa el buscador superior para encontrar a la persona por su nombre o teléfono. Los datos que ingreses se vincularán de forma única a su ficha en la base de datos.
            </p>
          </div>
        )}

        {/* Active Form */}
        {selectedClient && !loading && (
          <form onSubmit={handleSave}>
            {/* SECCIÓN A: Nivel Socioeconómico & Educación */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
                <Award size={18} style={{ color: 'var(--color-primary)' }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Sección A — Nivel Socioeconómico, Educación & Movilidad
                </h2>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                Expansión del Social Group Classifier a escala 1.0 - 10.0 para mayor precisión y resolución de emparejamiento.
              </p>

              {/* Social Group Score */}
              <RatingSlider10
                label="Puntaje Social Group General (1.0 a 10.0)"
                hint="Ponderación de barrio (30%), ingresos (25%), universidad (20%), colegio (15%), lugares (5%) y música (5%)."
                value={formData.social_group_score}
                onChange={(v) => setFormData({ ...formData, social_group_score: v })}
                min={1.0}
                max={10.0}
                step={0.5}
                leftAnchor="1.0 - Nivel Básico (Grupo D)"
                middleAnchor="5.0 - Nivel Medio (Grupo B)"
                rightAnchor="10.0 - Élite Exclusivo (Grupo A+)"
              />

              {/* Nivel Educativo */}
              <RatingSlider10
                label="Nivel Educativo Alcanzado"
                hint="Grado académico y reconocimiento institucional formal."
                value={formData.education_level}
                onChange={(v) => setFormData({ ...formData, education_level: v })}
                min={1}
                max={10}
                leftAnchor="1 - Bachillerato incompleto"
                middleAnchor="5 - Pregrado / Profesional"
                rightAnchor="10 - Doctorado / Postgrado Internacional de Élite"
              />

              {/* Movilidad / Viajes */}
              <RatingSlider10
                label="Movilidad & Viajes Internacionales"
                hint="Frecuencia y exposición a cultura y viajes por el mundo."
                value={formData.mobility_travel}
                onChange={(v) => setFormData({ ...formData, mobility_travel: v })}
                min={1}
                max={10}
                leftAnchor="1 - Nunca ha salido del país"
                middleAnchor="5 - Viajes vacacionales 1-2 veces/año"
                rightAnchor="10 - Viajero frecuente global / Nómada internacional"
              />
            </div>

            {/* SECCIÓN B: Estilo de Vida & Hábitos */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
                <Compass size={18} style={{ color: 'var(--color-primary)' }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Sección B — Estilo de Vida & Ritmo Diario
                </h2>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                Métricas de compatibilidad de rutina, energía y uso del tiempo libre.
              </p>

              {/* Actividad Física */}
              <RatingSlider10
                label="Nivel de Actividad Física y Deporte"
                hint="Frecuencia e intensidad deportiva en su estilo de vida."
                value={formData.physical_activity_level}
                onChange={(v) => setFormData({ ...formData, physical_activity_level: v })}
                min={1}
                max={10}
                leftAnchor="1 - Sedentario absoluto, no entrena"
                middleAnchor="5 - Ejercicio regular 2-3 veces/sem"
                rightAnchor="10 - Alto rendimiento / Atleta / Identidad deportiva"
              />

              {/* Energía Social */}
              <RatingSlider10
                label="Nivel de Energía Social (Extroversión)"
                hint="Demanda de interacción social y exposición pública."
                value={formData.social_energy_level}
                onChange={(v) => setFormData({ ...formData, social_energy_level: v })}
                min={1}
                max={10}
                leftAnchor="1 - Introvertido extremo / Casero total"
                middleAnchor="5 - Socialmente equilibrado y selectivo"
                rightAnchor="10 - Extroversión intensa / Alma de cada fiesta"
              />

              {/* Estructura de Vida */}
              <RatingSlider10
                label="Estructura de Vida Diaria (Organización vs Espontaneidad)"
                hint="Grado de rigidez o adaptabilidad de su calendario y rutina diaria."
                value={formData.life_structure_level}
                onChange={(v) => setFormData({ ...formData, life_structure_level: v })}
                min={1}
                max={10}
                leftAnchor="1 - Totalmente caótico e improvisado"
                middleAnchor="5 - Estructurado pero adaptable"
                rightAnchor="10 - Rutina metódica y milimétricamente planificada"
              />

              {/* Estilo de Fin de Semana */}
              <div style={{ marginTop: 22 }}>
                <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Estilo Predilecto de Fin de Semana (Multi-select)
                </label>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Selecciona uno o más planes habituales con los que recarga energía los fines de semana:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {WEEKEND_STYLES.map((ws) => {
                    const active = (formData.weekend_style || []).includes(ws.id)
                    return (
                      <button
                        key={ws.id}
                        type="button"
                        onClick={() => handleToggleWeekend(ws.id)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 20,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          border: active ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                          background: active ? 'rgba(150, 21, 0, 0.2)' : 'var(--bg-base)',
                          color: active ? '#fff' : 'var(--text-secondary)'
                        }}
                      >
                        {active ? '✓ ' : ''}{ws.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* SECCIÓN C: Valores & Visión de Pareja */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
                <HeartHandshake size={18} style={{ color: 'var(--color-primary)' }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Sección C — Valores, Familia & Convicciones
                </h2>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                Pilares fundamentales donde la disparidad suele provocar fricción a mediano y largo plazo.
              </p>

              {/* Religión */}
              <RatingSlider10
                label="Importancia de la Religión / Fe en la Pareja"
                hint="Requerimiento de compartir creencias religiosas o espirituales."
                value={formData.religion_importance}
                onChange={(v) => setFormData({ ...formData, religion_importance: v })}
                min={1}
                max={10}
                leftAnchor="1 - Cero relevancia / No creyente"
                middleAnchor="5 - Fe moderada / Valores compartidos"
                rightAnchor="10 - Innegociable que practique la misma fe activamente"
              />

              {/* Política */}
              <div style={{
                marginBottom: 20,
                padding: '16px 18px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 10,
                border: '1px solid rgba(150, 21, 0, 0.12)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                      Orientación Política / Autoubicación
                    </span>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Espectro de pensamiento político o postura apolítica.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        political_self_placement: isApolitico ? '5' : 'apolítico'
                      })
                    }}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 14,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: isApolitico ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                      background: isApolitico ? 'rgba(150, 21, 0, 0.25)' : 'transparent',
                      color: isApolitico ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.15s'
                    }}
                  >
                    {isApolitico ? '✓ Marcado: Apolítico' : 'Cambiar a Apolítico'}
                  </button>
                </div>

                {!isApolitico && (
                  <RatingSlider10
                    label="Posición en el Espectro Político"
                    value={politicalVal}
                    onChange={(v) => setFormData({ ...formData, political_self_placement: String(v) })}
                    min={1}
                    max={10}
                    leftAnchor="1 - Izquierda progresista"
                    middleAnchor="5 - Centro / Moderado"
                    rightAnchor="10 - Derecha conservadora"
                  />
                )}
                {isApolitico && (
                  <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    Esta persona se considera apolítica o la política no es un factor relevante en su vida sentimental.
                  </div>
                )}
              </div>

              {/* Deseo de Hijos */}
              <RatingSlider10
                label="Deseo / Prioridad de Tener Hijos"
                hint="Plan de maternidad / paternidad presente o futuro."
                value={formData.kids_importance}
                onChange={(v) => setFormData({ ...formData, kids_importance: v })}
                min={1}
                max={10}
                leftAnchor="1 - Cero hijos bajo ninguna circunstancia"
                middleAnchor="5 - Abierto / Indiferente según la pareja"
                rightAnchor="10 - Prioridad #1 innegociable en su proyecto"
              />

              {/* Tradicionalismo en Roles */}
              <RatingSlider10
                label="Tradicionalismo en Roles de Pareja"
                hint="Expectativa sobre roles domésticos, económicos y familiares."
                value={formData.traditionalism_level}
                onChange={(v) => setFormData({ ...formData, traditionalism_level: v })}
                min={1}
                max={10}
                leftAnchor="1 - 100% igualitario / Moderno"
                middleAnchor="5 - Modelo híbrido y consensuado"
                rightAnchor="10 - Roles tradicionales definidos de género"
              />
            </div>

            {/* Bottom Sticky Action Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 24px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              boxShadow: '0 -4px 20px rgba(0,0,0,0.3)'
            }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Cliente actual: <strong style={{ color: 'var(--text-primary)' }}>{selectedClient.name}</strong>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 24px',
                  fontSize: 14,
                  fontWeight: 700
                }}
              >
                {saving ? (
                  <>
                    <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    Guardando datos...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Guardar Datos Objetivos
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
