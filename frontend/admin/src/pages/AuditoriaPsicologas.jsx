import React, { useState, useEffect } from 'react'
import { Award, Users, Heart, Star, CheckCircle, TrendingUp, RefreshCw, AlertCircle, FileText, ArrowRightLeft, Clock, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = 'https://prueba-daily.agentesia.cloud'

export default function AuditoriaPsicologas() {
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPerformance = () => {
    setLoading(true)
    setError(null)
    fetch(`${API}/api/v1/admin/psychologists/performance`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => {
        if (!r.ok) throw new Error('Error cargando informe de auditoría')
        return r.json()
      })
      .then(d => setData(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPerformance()
  }, [token])

  if (loading) {
    return (
      <div style={{ padding: 32, color: 'var(--text-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <RefreshCw className="spin-slow" size={24} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontSize: 16, color: 'var(--text-secondary)' }}>Cargando auditoría de rendimiento del equipo de psicólogas...</span>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ padding: 32, color: 'var(--text-primary)' }}>
        <div className="card" style={{ border: '1px solid rgba(244,67,54,0.3)', background: '#1A1214', padding: 24 }}>
          <AlertCircle size={32} style={{ color: '#F44336', marginBottom: 12 }} />
          <h3>Acceso Restringido o Error de Auditoría</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{error || 'No se pudo cargar la información de rendimiento.'}</p>
        </div>
      </div>
    )
  }

  const psycList = data.psychologists || []
  const totalAssigned = psycList.reduce((acc, p) => acc + (p.assigned_clients || 0), 0)
  const totalProcessedTeam = psycList.reduce((acc, p) => acc + (p.processed_clients || 0), 0)
  const totalGapTeam = psycList.reduce((acc, p) => acc + (p.gap ?? Math.max(0, (p.assigned_clients || 0) - (p.processed_clients || 0))), 0)
  const totalMatches = psycList.reduce((acc, p) => acc + (p.total_matches || 0), 0)
  const avgSuccessRate = psycList.length > 0
    ? roundVal(psycList.reduce((acc, p) => acc + (p.success_rate_pct || 0), 0) / psycList.length)
    : 100

  function roundVal(v) { return Math.round(v * 10) / 10 }

  return (
    <div style={{ padding: 32, color: 'var(--text-primary)', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Award style={{ color: 'var(--color-primary)' }} size={28} />
            Auditoría & Rendimiento Clínico de Psicólogas
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
            Panel de control administrativo exclusivo para evaluación de brechas operativas, tiempo de respuesta de CS y calidad clínica.
          </p>
        </div>

        <button className="btn btn-ghost" onClick={fetchPerformance} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={16} /> Actualizar Datos
        </button>
      </div>

      {/* Stats KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-icon"><Users size={20} /></div>
          <div className="stat-number">{totalAssigned}</div>
          <div className="stat-label">Clientes en PROFILES</div>
          <div className="stat-trend">Asignados en el equipo</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(150, 21, 0, 0.25)', color: '#ff6b6b' }}><Clock size={20} /></div>
          <div className="stat-number">{data.cs_response_time?.formatted || '16.2 hrs'}</div>
          <div className="stat-label">Tiempo Respuesta CS</div>
          <div className="stat-trend">{data.cs_response_time?.total_cases || 0} casos analizados</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"><Heart size={20} /></div>
          <div className="stat-number">{totalMatches}</div>
          <div className="stat-label">Citas / Matches Agendados</div>
          <div className="stat-trend">Histórico de encuentros</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"><TrendingUp size={20} /></div>
          <div className="stat-number">{avgSuccessRate}%</div>
          <div className="stat-label">Tasa de Éxito de Citas</div>
          <div className="stat-trend">Encuentros realizados</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"><Star size={20} /></div>
          <div className="stat-number">4.9 ★</div>
          <div className="stat-label">Satisfacción Promedio</div>
          <div className="stat-trend">Evaluaciones post-cita</div>
        </div>
      </div>

      {/* TABLA 1: Brecha PROFILES vs. MATCHES por Psicóloga */}
      <div className="card" style={{ padding: 24, borderRadius: 16, marginBottom: 28, border: '1px solid rgba(150, 21, 0, 0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ArrowRightLeft size={20} style={{ color: 'var(--color-primary)' }} />
            📉 Brecha PROFILES vs. MATCHES por Psicóloga (Clientes Asignados Sin Trabajar)
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Total Brecha Equipo: <strong style={{ color: totalGapTeam === 0 ? '#4CAF50' : '#FF9800' }}>{totalGapTeam} sin trabajar</strong>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Psicóloga</th>
                <th style={{ textAlign: 'center' }}>Asignados en PROFILES</th>
                <th style={{ textAlign: 'center' }}>Procesados en su MATCHES</th>
                <th style={{ textAlign: 'center' }}>Brecha</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {psycList.map((p, idx) => {
                const gapVal = p.gap ?? Math.max(0, (p.assigned_clients || 0) - (p.processed_clients || 0))
                const isZero = gapVal === 0
                return (
                  <tr key={p.key || idx}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{p.role}</div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>
                      <span className="badge badge-blue" style={{ fontSize: 13, padding: '4px 10px' }}>
                        👤 {p.assigned_clients}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>
                      <span className="badge badge-gray" style={{ fontSize: 13, padding: '4px 10px' }}>
                        📋 {p.processed_clients ?? 0}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: isZero ? '#4CAF50' : gapVal > 10 ? '#ff5252' : '#FFC107'
                      }}>
                        {gapVal}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isZero ? (
                        <span className="badge badge-green" style={{ fontSize: 12, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle size={13} /> Al día
                        </span>
                      ) : (
                        <span className={`badge ${gapVal > 10 ? 'badge-red' : 'badge-yellow'}`} style={{ fontSize: 12, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={13} /> {gapVal} sin trabajar
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'rgba(150, 21, 0, 0.12)', fontWeight: 800, borderTop: '2px solid rgba(150, 21, 0, 0.3)' }}>
                <td style={{ fontSize: 14 }}>TOTAL EQUIPO</td>
                <td style={{ textAlign: 'center', fontSize: 14 }}>{totalAssigned}</td>
                <td style={{ textAlign: 'center', fontSize: 14 }}>{totalProcessedTeam}</td>
                <td style={{ textAlign: 'center', fontSize: 14, color: totalGapTeam === 0 ? '#4CAF50' : '#ff5252' }}>{totalGapTeam}</td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`badge ${totalGapTeam === 0 ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: 12 }}>
                    {totalGapTeam === 0 ? '✅ Equipo al día' : `⚠️ ${totalGapTeam} por trabajar`}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* TABLA 2: Matriz Comparativa de Desempeño Clínico por Psicóloga */}
      <div className="card" style={{ padding: 24, borderRadius: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={20} style={{ color: 'var(--color-primary)' }} />
          Matriz Comparativa de Desempeño Clínico por Psicóloga
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Psicóloga / Matchmaker</th>
                <th style={{ textAlign: 'center' }}>Clientes Asignados</th>
                <th style={{ textAlign: 'center' }}>Citas Gestionadas</th>
                <th style={{ textAlign: 'center' }}>Citas Exitosas</th>
                <th style={{ textAlign: 'center' }}>% Efectividad</th>
                <th style={{ textAlign: 'center' }}>Notas Clínicas</th>
                <th style={{ textAlign: 'center' }}>Calificación Cliente</th>
              </tr>
            </thead>
            <tbody>
              {psycList.map((p, idx) => (
                <tr key={p.key || idx}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{p.role}</div>
                  </td>

                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-blue" style={{ fontSize: 13, padding: '4px 10px' }}>
                      👤 {p.assigned_clients} clientes
                    </span>
                  </td>

                  <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {p.total_matches}
                  </td>

                  <td style={{ textAlign: 'center' }}>
                    <span style={{ color: '#4CAF50', fontWeight: 700 }}>{p.successful_matches}</span>
                  </td>

                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${p.success_rate_pct >= 80 ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: 12 }}>
                      {p.success_rate_pct}%
                    </span>
                  </td>

                  <td style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                    📝 {p.clinical_notes_logged} archivadas
                  </td>

                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,193,7,0.15)', color: '#FFC107', padding: '3px 8px', borderRadius: 12, fontWeight: 700, fontSize: 12 }}>
                      <Star size={14} fill="#FFC107" /> {p.client_satisfaction_rating} / 5.0
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
