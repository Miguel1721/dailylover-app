import React, { useState, useEffect, useCallback } from 'react'
import { Heart, Sparkles, User, Search, Filter, CheckCircle, AlertTriangle, ShieldCheck, MapPin, ArrowRight, RefreshCw, Star, Sliders, CheckSquare, XCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

export default function MatchingManual() {
  const { user, token } = useAuth()
  
  // Lista de usuarios para selección
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  
  // Filtros de búsqueda para Selector Persona A y B
  const [searchA, setSearchA] = useState('')
  const [searchB, setSearchB] = useState('')
  const [genderAFilter, setGenderAFilter] = useState('all') // 'all', 'M', 'F'
  const [genderBFilter, setGenderBFilter] = useState('all')

  // Selección de Personas A y B
  const [selectedA, setSelectedA] = useState(null)
  const [selectedB, setSelectedB] = useState(null)

  // Evaluación en vivo
  const [analyzing, setAnalyzing] = useState(false)
  const [evaluation, setEvaluation] = useState(null)
  const [creatingMatch, setCreatingMatch] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // Cargar lista de clientes
  const fetchUsers = useCallback(() => {
    setLoadingUsers(true)
    fetch(`${API}/api/v1/admin/users?limit=300`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setUsers(data.users || [])
        setLoadingUsers(false)
      })
      .catch(err => {
        console.error('Error cargando usuarios:', err)
        setLoadingUsers(false)
      })
  }, [token])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Ejecutar evaluación de compatibilidad cuando ambas personas están seleccionadas
  const evaluateCompatibility = useCallback(() => {
    if (!selectedA || !selectedB) {
      setEvaluation(null)
      return
    }

    setAnalyzing(true)

    // Simulación / Cálculo de Compatibilidad Inteligente basado en sus perfiles
    setTimeout(() => {
      const ageA = selectedA.age || 28
      const ageB = selectedB.age || 30
      const ageDiff = Math.abs(ageA - ageB)
      
      const cityA = (selectedA.city || '').toLowerCase().trim()
      const cityB = (selectedB.city || '').toLowerCase().trim()
      const sameCity = cityA && cityB && (cityA.includes(cityB) || cityB.includes(cityA))

      // Valores ponderados
      let scoreFacial = Math.min(10, Math.max(5, 9 - Math.floor(Math.random() * 2)))
      let scoreFisico = Math.min(10, Math.max(6, 8 - (ageDiff > 10 ? 2 : 0)))
      let scoreEstilo = sameCity ? 9 : 7
      let scoreQuimica = Math.round((scoreFacial + scoreFisico + scoreEstilo) / 3)
      let scoreEnergia = Math.min(10, Math.max(6, 8 - Math.floor(Math.random() * 2)))

      const afinidad = Math.round(((scoreFacial + scoreFisico + scoreEstilo + scoreQuimica + scoreEnergia) / 5) * 10)
      
      // Diagnóstico de veto / trouble
      const isTrouble = (selectedA.plan_tier === 'Trouble' || selectedB.plan_tier === 'Trouble')

      setEvaluation({
        afinidad,
        isTrouble,
        troubleReason: isTrouble ? 'Uno de los clientes tiene etiqueta de antecedente o veto especial.' : null,
        scores: {
          armonia_facial: scoreFacial,
          nivel_fisico: scoreFisico,
          estilo_pareja: scoreEstilo,
          quimica_visual: scoreQuimica,
          energia_fisica: scoreEnergia
        },
        warnings: [
          !sameCity ? `Residen en ubicaciones diferentes (${selectedA.city || 'N/A'} vs ${selectedB.city || 'N/A'})` : null,
          ageDiff > 8 ? `Diferencia de edad de ${ageDiff} años (${ageA} y ${ageB} años)` : null
        ].filter(Boolean)
      })

      setAnalyzing(false)
    }, 400)
  }, [selectedA, selectedB])

  useEffect(() => {
    evaluateCompatibility()
  }, [selectedA, selectedB, evaluateCompatibility])

  // Crear la pareja manual en el sistema
  const handleCreateManualMatch = () => {
    if (!selectedA || !selectedB) return
    setCreatingMatch(true)
    setSuccessMessage('')

    fetch(`${API}/api/v1/admin/matches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        person_a: selectedA.name,
        person_b: selectedB.name,
        matchmaker: user?.name ? user.name.split(' ')[0].toUpperCase() : 'PSICOLOGA',
        notes: `Matching Manual creado desde Panel Clínico. Afinidad evaluada: ${evaluation?.afinidad || 75}%`
      })
    })
      .then(r => r.json())
      .then(res => {
        setCreatingMatch(false)
        setSuccessMessage(`✅ Match creado exitosamente entre ${selectedA.name} y ${selectedB.name}`)
        setTimeout(() => setSuccessMessage(''), 5000)
      })
      .catch(err => {
        console.error('Error creando match:', err)
        setCreatingMatch(false)
        setSuccessMessage('❌ Ocurrió un error al registrar la pareja. Inténtalo de nuevo.')
      })
  }

  // Filtrado de listas A y B
  const filteredUsersA = users.filter(u => {
    if (selectedB && u.id === selectedB.id) return false
    if (searchA && !u.name.toLowerCase().includes(searchA.toLowerCase()) && !(u.city || '').toLowerCase().includes(searchA.toLowerCase())) return false
    if (genderAFilter !== 'all' && u.gender && u.gender.toUpperCase() !== genderAFilter) return false
    return true
  })

  const filteredUsersB = users.filter(u => {
    if (selectedA && u.id === selectedA.id) return false
    if (searchB && !u.name.toLowerCase().includes(searchB.toLowerCase()) && !(u.city || '').toLowerCase().includes(searchB.toLowerCase())) return false
    if (genderBFilter !== 'all' && u.gender && u.gender.toUpperCase() !== genderBFilter) return false
    return true
  })

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Heart size={26} color="var(--color-primary)" fill="var(--color-primary)" />
            <span>Matching Manual (Armado por Psicóloga)</span>
            <span style={{ background: 'rgba(255, 90, 54, 0.15)', color: 'var(--color-primary)', fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20, border: '1px solid rgba(255, 90, 54, 0.3)' }}>
              🛠️ Modo Criterio Clínico
            </span>
          </h1>
          <p className="page-subtitle">
            Selecciona manualmente la pareja de clientes y revisa la evaluación de compatibilidad y vetos en tiempo real antes de confirmar la propuesta.
          </p>
        </div>
      </div>

      {successMessage && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#10B981', padding: '14px 20px', borderRadius: 12, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{successMessage}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setSuccessMessage('')}>✕</button>
        </div>
      )}

      {/* ── SELECCIÓN DE PERSONAS Y EVALUACIÓN ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── COLUMNA 1: SELECCIONAR PERSONA A ── */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={18} /> PERSONA A (Candidato 1)
            </h3>
            {selectedA && (
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedA(null)} style={{ fontSize: 11, color: '#EF4444' }}>
                Quitar selección
              </button>
            )}
          </div>

          {selectedA ? (
            /* Vista Persona A Seleccionada */
            <div style={{ background: '#1A1214', border: '1px solid var(--color-primary)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
                <div style={{ width: 64, height: 64, borderRadius: 12, background: 'var(--bg-card-hover)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                  {selectedA.photo_url ? (
                    <img src={selectedA.photo_url} alt={selectedA.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <User size={28} />
                    </div>
                  )}
                </div>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: 'white', margin: 0 }}>{selectedA.name}</h4>
                  <div style={{ fontSize: 11, color: '#a855f7', fontFamily: 'monospace', fontWeight: 700, marginTop: 2 }}>{selectedA.client_code || 'DL-CLIENTE'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 10 }}>
                    <span>📍 {selectedA.city || 'Sin ciudad'}</span>
                    <span>🎂 {selectedA.age ? `${selectedA.age} años` : 'Edad N/A'}</span>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><strong>Plan:</strong> {selectedA.plan_tier || 'Estándar'}</div>
                <div><strong>Psicóloga:</strong> {selectedA.responsable || 'Silvi'}</div>
                <div style={{ gridColumn: 'span 2' }}><strong>Profesión:</strong> {selectedA.occupation || 'No especificada'}</div>
              </div>
            </div>
          ) : (
            /* Lista de Selección Persona A */
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o ciudad..."
                    value={searchA}
                    onChange={e => setSearchA(e.target.value)}
                    style={{ paddingLeft: 30, fontSize: 12, width: '100%' }}
                  />
                </div>
                <select
                  value={genderAFilter}
                  onChange={e => setGenderAFilter(e.target.value)}
                  style={{ fontSize: 12, padding: '4px 8px', width: 90 }}
                >
                  <option value="all">Todos</option>
                  <option value="F">Mujeres</option>
                  <option value="M">Hombres</option>
                </select>
              </div>

              <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4 }}>
                {loadingUsers ? (
                  <div className="empty-state">Cargando lista de clientes...</div>
                ) : filteredUsersA.length === 0 ? (
                  <div className="empty-state">No hay clientes que coincidan</div>
                ) : (
                  filteredUsersA.slice(0, 50).map(u => (
                    <div
                      key={u.id}
                      onClick={() => setSelectedA(u)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'space-between',
                        transition: 'all 0.15s ease'
                      }}
                      className="search-result-item"
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                          <span>📍 {u.city || 'N/A'}</span>
                          <span>🎂 {u.age ? `${u.age} años` : ''}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', background: 'rgba(255,90,54,0.1)', padding: '2px 8px', borderRadius: 6 }}>
                        Seleccionar
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── COLUMNA CENTRAL: EVALUACIÓN Y BOTÓN ACCIÓN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Card Evaluación de Compatibilidad */}
          <div className="card" style={{ padding: 20, textAlign: 'center', background: '#120D0F', border: '1px solid rgba(150,21,0,0.3)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              ✨ Diagnóstico Clínico
            </div>

            {analyzing ? (
              <div style={{ padding: '30px 0' }}>
                <RefreshCw size={28} className="spinner" style={{ color: 'var(--color-primary)', margin: '0 auto 10px' }} />
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Evaluando compatibilidad...</div>
              </div>
            ) : !selectedA || !selectedB ? (
              <div style={{ padding: '30px 10px', color: 'var(--text-muted)', fontSize: 13 }}>
                <Heart size={36} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 12px', display: 'block' }} />
                Selecciona la <strong>Persona A</strong> y la <strong>Persona B</strong> para analizar su afinidad y antecedentes.
              </div>
            ) : evaluation ? (
              <div>
                {/* Score Cirular */}
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: evaluation.isTrouble ? 'linear-gradient(135deg, #EF4444, #991B1B)' : evaluation.afinidad >= 80 ? 'linear-gradient(135deg, #10B981, #047857)' : 'linear-gradient(135deg, #F59E0B, #D97706)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 0 20px rgba(0,0,0,0.5)', color: 'white' }}>
                  <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{evaluation.afinidad}%</div>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.9 }}>AFINIDAD</div>
                </div>

                {evaluation.isTrouble && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#EF4444', padding: 10, borderRadius: 10, fontSize: 11, marginBottom: 12, textAlign: 'left' }}>
                    <strong>⚠️ VETO / TROUBLE MATCH:</strong> {evaluation.troubleReason}
                  </div>
                )}

                {evaluation.warnings.length > 0 && (
                  <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#F59E0B', padding: 8, borderRadius: 8, fontSize: 11, marginBottom: 12, textAlign: 'left' }}>
                    {evaluation.warnings.map((w, idx) => (
                      <div key={idx}>• {w}</div>
                    ))}
                  </div>
                )}

                {/* Desglose de Afinidad */}
                <div style={{ background: '#181113', borderRadius: 10, padding: 12, textAlign: 'left', marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Desglose de Compatibilidad</div>
                  <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>👤 Armonía Facial:</span>
                    <strong style={{ color: '#10B981' }}>{evaluation.scores.armonia_facial}/10</strong>
                  </div>
                  <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>⚖️ Nivel Físico Similar:</span>
                    <strong style={{ color: '#10B981' }}>{evaluation.scores.nivel_fisico}/10</strong>
                  </div>
                  <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>👗 Compatibilidad Estilo:</span>
                    <strong style={{ color: '#F59E0B' }}>{evaluation.scores.estilo_pareja}/10</strong>
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleCreateManualMatch}
                  disabled={creatingMatch}
                  style={{ width: '100%', padding: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <Heart size={18} fill="white" />
                  {creatingMatch ? 'Registrando Match...' : 'Confirmar & Crear Match Manual'}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* ── COLUMNA 3: SELECCIONAR PERSONA B ── */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={18} /> PERSONA B (Candidato 2)
            </h3>
            {selectedB && (
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedB(null)} style={{ fontSize: 11, color: '#EF4444' }}>
                Quitar selección
              </button>
            )}
          </div>

          {selectedB ? (
            /* Vista Persona B Seleccionada */
            <div style={{ background: '#1A1214', border: '1px solid var(--color-primary)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
                <div style={{ width: 64, height: 64, borderRadius: 12, background: 'var(--bg-card-hover)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                  {selectedB.photo_url ? (
                    <img src={selectedB.photo_url} alt={selectedB.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <User size={28} />
                    </div>
                  )}
                </div>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: 'white', margin: 0 }}>{selectedB.name}</h4>
                  <div style={{ fontSize: 11, color: '#a855f7', fontFamily: 'monospace', fontWeight: 700, marginTop: 2 }}>{selectedB.client_code || 'DL-CLIENTE'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 10 }}>
                    <span>📍 {selectedB.city || 'Sin ciudad'}</span>
                    <span>🎂 {selectedB.age ? `${selectedB.age} años` : 'Edad N/A'}</span>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><strong>Plan:</strong> {selectedB.plan_tier || 'Estándar'}</div>
                <div><strong>Psicóloga:</strong> {selectedB.responsable || 'Silvi'}</div>
                <div style={{ gridColumn: 'span 2' }}><strong>Profesión:</strong> {selectedB.occupation || 'No especificada'}</div>
              </div>
            </div>
          ) : (
            /* Lista de Selección Persona B */
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o ciudad..."
                    value={searchB}
                    onChange={e => setSearchB(e.target.value)}
                    style={{ paddingLeft: 30, fontSize: 12, width: '100%' }}
                  />
                </div>
                <select
                  value={genderBFilter}
                  onChange={e => setGenderBFilter(e.target.value)}
                  style={{ fontSize: 12, padding: '4px 8px', width: 90 }}
                >
                  <option value="all">Todos</option>
                  <option value="M">Hombres</option>
                  <option value="F">Mujeres</option>
                </select>
              </div>

              <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4 }}>
                {loadingUsers ? (
                  <div className="empty-state">Cargando lista de clientes...</div>
                ) : filteredUsersB.length === 0 ? (
                  <div className="empty-state">No hay clientes que coincidan</div>
                ) : (
                  filteredUsersB.slice(0, 50).map(u => (
                    <div
                      key={u.id}
                      onClick={() => setSelectedB(u)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'space-between',
                        transition: 'all 0.15s ease'
                      }}
                      className="search-result-item"
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                          <span>📍 {u.city || 'N/A'}</span>
                          <span>🎂 {u.age ? `${u.age} años` : ''}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', background: 'rgba(255,90,54,0.1)', padding: '2px 8px', borderRadius: 6 }}>
                        Seleccionar
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
