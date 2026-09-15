import React, { useState, useEffect, useCallback } from 'react'
import { 
  Sparkles, CheckCircle, XCircle, ExternalLink, Search, RefreshCw, 
  User, Calendar, ChevronLeft, ChevronRight, AlertTriangle, Heart, 
  PhoneCall, Filter, Clock, Check
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import CrmPersonLink from '../../components/CrmPersonLink'

const API = 'https://prueba-daily.agentesia.cloud'

export default function ColaAtrasadosView() {
  const { token, user } = useAuth()

  // Filtros y paginación
  const [responsable, setResponsable] = useState('Todas')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)

  // Datos
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState(null)
  const [notification, setNotification] = useState('')

  const fetchQueue = useCallback(() => {
    setLoading(true)
    let url = `${API}/api/v1/matchmaking/agosto27-queue?page=${page}&page_size=20&status_filter=${statusFilter}&`
    if (responsable && responsable !== 'Todas') url += `responsable=${encodeURIComponent(responsable)}&`
    if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error cargando cola de atrasados:', err)
        setLoading(false)
      })
  }, [page, statusFilter, responsable, searchTerm, token])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  // Aprobar propuesta
  const handleApprove = async (client, proposal) => {
    if (!client.client_user_id || !proposal.candidate_user_id) {
      alert('Error: Datos de usuario incompletos para procesar el match.')
      return
    }

    if (!window.confirm(`¿Aprobar match entre ${client.client_name} y ${proposal.candidate_name}?`)) {
      return
    }

    setActionLoadingId(proposal.id)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/approve-interview-match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          person_a_id: client.client_user_id || client.client_crm_id || client.client_name,
          person_b_id: proposal.candidate_user_id || proposal.candidate_crm_id || proposal.candidate_name,
          psychologist_name: client.responsable || user?.name || 'María Paula',
          batch_tag: 'agosto27_backlog',
          proposal_id: proposal.id,
          notes: `Match aprobado desde Cola de Atrasados por ${user?.name || 'María'}.`
        })
      })

      const resData = await res.json()
      if (!res.ok) throw new Error(resData.detail || 'Error al aprobar match')

      setNotification(`✓ Match entre ${client.client_name} y ${proposal.candidate_name} aprobado y trasladado a Matches Atrasados.`)
      setTimeout(() => setNotification(''), 5000)
      fetchQueue()
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setActionLoadingId(null)
    }
  }

  // Descartar propuesta
  const handleDiscard = async (client, proposal) => {
    if (!window.confirm(`¿Descartar a ${proposal.candidate_name} como opción para ${client.client_name}?`)) {
      return
    }

    setActionLoadingId(proposal.id)
    try {
      const res = await fetch(`${API}/api/v1/matchmaking/agosto27-discard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          proposal_id: proposal.id,
          user_name: user?.name || 'María'
        })
      })

      const resData = await res.json()
      if (!res.ok) throw new Error(resData.detail || 'Error al descartar propuesta')

      setNotification(`Candidato descartado para ${client.client_name}.`)
      setTimeout(() => setNotification(''), 4000)
      fetchQueue()
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setActionLoadingId(null)
    }
  }

  const totalClients = data?.total_clients || 419
  const reviewedClients = data?.reviewed_clients || 0
  const pendingClients = data?.pending_clients || (totalClients - reviewedClients)
  const percentReviewed = totalClients > 0 ? Math.round((reviewedClients / totalClients) * 100) : 0
  const responsableList = ['Todas', ...(data?.responsable_list || [])]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Banner de Notificación */}
      {notification && (
        <div style={{
          background: 'rgba(76, 175, 80, 0.15)',
          border: '1px solid #4CAF50',
          borderRadius: 10,
          padding: '12px 18px',
          color: '#81C784',
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <CheckCircle size={16} />
          <span>{notification}</span>
        </div>
      )}

      {/* Tarjeta de Métricas y Progreso */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 14,
        padding: '24px 28px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={20} color="var(--color-primary-light)" />
              Cola de Clientes Atrasados (Agosto 27)
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Revisión y aprobación rápida: examina las propuestas generadas por la IA y aprueba o descarta directamente.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              padding: '8px 16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Clientes</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{totalClients}</div>
            </div>

            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 10,
              padding: '8px 16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase' }}>Pendientes</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#F59E0B' }}>{pendingClients}</div>
            </div>

            <div style={{
              background: 'rgba(76, 175, 80, 0.1)',
              border: '1px solid rgba(76, 175, 80, 0.3)',
              borderRadius: 10,
              padding: '8px 16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#4CAF50', textTransform: 'uppercase' }}>Revisados</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#4CAF50' }}>{reviewedClients}</div>
            </div>

            <div style={{
              background: 'rgba(150, 21, 0, 0.1)',
              border: '1px solid rgba(150, 21, 0, 0.3)',
              borderRadius: 10,
              padding: '8px 16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary-light)', textTransform: 'uppercase' }}>Aprobados</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-primary-light)' }}>{data?.approved_proposals || 0}</div>
            </div>
          </div>
        </div>

        {/* Barra de Progreso */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
            <span>Progreso de Revisión</span>
            <span>{reviewedClients} de {totalClients} clientes revisados ({percentReviewed}%)</span>
          </div>
          <div style={{
            width: '100%',
            height: 8,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 4,
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${percentReviewed}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #961500, #4CAF50)',
              borderRadius: 4,
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        padding: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        alignItems: 'end'
      }}>
        {/* Buscador */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
            Buscar Cliente o Candidato
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Nombre o CRM ID..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                borderRadius: 8,
                background: 'var(--bg-base)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Filtro Responsable */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
            Psicóloga Responsable
          </label>
          <select
            value={responsable}
            onChange={e => { setResponsable(e.target.value); setPage(1); }}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--bg-base)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none'
            }}
          >
            {responsableList.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Filtro Estado */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
            Estado de Revisión
          </label>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--bg-base)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none'
            }}
          >
            <option value="pending">🟡 Pendientes de Revisar</option>
            <option value="reviewed">✅ Ya Revisados</option>
            <option value="approved">🟢 Con Match Aprobado</option>
            <option value="discarded">⚪ Descartados</option>
            <option value="all">📋 Todos los Clientes</option>
          </select>
        </div>

        {/* Botón Refrescar */}
        <div>
          <button
            onClick={fetchQueue}
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px 14px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refrescar Cola</span>
          </button>
        </div>
      </div>

      {/* Lista de Clientes */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block', color: 'var(--color-primary)' }} />
          Cargando clientes de la cola de atrasados...
        </div>
      ) : !data?.clients || data.clients.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 14,
          padding: '60px 20px',
          textAlign: 'center'
        }}>
          <CheckCircle size={40} style={{ color: '#4CAF50', margin: '0 auto 12px', display: 'block' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
            No hay clientes con este filtro
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            {statusFilter === 'pending'
              ? '¡Excelente! No hay clientes pendientes con los filtros seleccionados.'
              : 'Prueba cambiando los filtros de búsqueda o psicóloga.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {data.clients.map((c, cIdx) => (
            <div
              key={c.client_key}
              style={{
                background: 'var(--bg-card)',
                border: c.client_status === 'approved' ? '1px solid rgba(76, 175, 80, 0.4)' : '1px solid var(--border-color)',
                borderRadius: 14,
                padding: 24,
                boxShadow: '0 4px 18px rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: 18
              }}
            >
              {/* Header del Cliente */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: 14
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #961500, #c41a00)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 16
                  }}>
                    {c.client_name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <a
                        href={c.client_crm_id ? `https://dailylover.smartmatchapp.com/#!/client/${c.client_crm_id}/` : `https://dailylover.smartmatchapp.com/#!/clients?search=${encodeURIComponent(c.client_name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 17,
                          fontWeight: 800,
                          color: 'var(--text-primary)',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        {c.client_name}
                        <ExternalLink size={14} style={{ color: 'var(--color-primary-light)' }} />
                      </a>
                      <span style={{
                        fontSize: 11,
                        background: 'rgba(255,255,255,0.06)',
                        padding: '2px 8px',
                        borderRadius: 6,
                        color: 'var(--text-muted)'
                      }}>
                        Fila Excel #{c.sheet_row}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>🎟️ Citas Pendientes: <strong>{c.dates_pend || '1'}</strong></span>
                      <span>•</span>
                      <span>Psicóloga: <strong style={{ color: 'var(--text-primary)' }}>{c.responsable || 'Sin asignar'}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Badge de Estado del Cliente */}
                <div>
                  {c.client_status === 'approved' ? (
                    <span style={{
                      background: 'rgba(76, 175, 80, 0.15)',
                      border: '1px solid #4CAF50',
                      color: '#81C784',
                      padding: '4px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      <Check size={14} /> Match Aprobado
                    </span>
                  ) : c.client_status === 'discarded' ? (
                    <span style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-muted)',
                      padding: '4px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600
                    }}>
                      Opciones Descartadas
                    </span>
                  ) : (
                    <span style={{
                      background: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      color: '#F59E0B',
                      padding: '4px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 700
                    }}>
                      🟡 Pendiente de Aprobación
                    </span>
                  )}
                </div>
              </div>

              {/* Grid de Propuestas (1 o 2 candidatos) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                {c.proposals.map((p, pIdx) => {
                  const isApproved = p.decision === 'approved'
                  const isDiscarded = p.decision === 'discarded'
                  const isPending = !isApproved && !isDiscarded

                  return (
                    <div
                      key={p.id}
                      style={{
                        background: isApproved
                          ? 'rgba(76, 175, 80, 0.06)'
                          : isDiscarded
                            ? 'rgba(255,255,255,0.02)'
                            : 'var(--bg-base)',
                        border: isApproved
                          ? '1.5px solid #4CAF50'
                          : isDiscarded
                            ? '1px solid rgba(255,255,255,0.08)'
                            : '1px solid var(--border-color)',
                        borderRadius: 12,
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 14,
                        opacity: isDiscarded ? 0.6 : 1,
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div>
                        {/* Top Candidato: Nombre, Puntuación, CRM */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #1976d2, #0288d1)',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 14
                            }}>
                              {p.candidate_name.charAt(0)}
                            </div>
                            <div>
                              <a
                                href={p.candidate_crm_id ? `https://dailylover.smartmatchapp.com/#!/client/${p.candidate_crm_id}/` : `https://dailylover.smartmatchapp.com/#!/clients?search=${encodeURIComponent(p.candidate_name)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: 15,
                                  fontWeight: 700,
                                  color: 'var(--text-primary)',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5
                                }}
                              >
                                {p.candidate_name}
                                <ExternalLink size={12} color="#2196F3" />
                              </a>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                📍 {p.candidate_city} {p.candidate_occupation ? `• ${p.candidate_occupation}` : ''}
                              </div>
                            </div>
                          </div>

                          {/* Badge Score */}
                          <div style={{ textAlign: 'right' }}>
                            <span style={{
                              fontSize: 12,
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: p.punctuation?.includes('9') || p.punctuation?.includes('8.5')
                                ? 'rgba(76, 175, 80, 0.18)'
                                : 'rgba(255, 193, 7, 0.18)',
                              color: p.punctuation?.includes('9') || p.punctuation?.includes('8.5')
                                ? '#81C784'
                                : '#FFE082',
                              border: p.punctuation?.includes('9') || p.punctuation?.includes('8.5')
                                ? '1px solid rgba(76, 175, 80, 0.3)'
                                : '1px solid rgba(255, 193, 7, 0.3)'
                            }}>
                              Score: {p.punctuation || '8.5/10'}
                            </span>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                              {p.status || 'PROPUESTO'}
                            </div>
                          </div>
                        </div>

                        {/* Puntos Fuertes */}
                        {p.strong_points && p.strong_points.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                              Fortalezas del Match
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                              {p.strong_points.map((pt, idx) => (
                                <li key={idx}>{pt}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Dealbreakers / Puntos a Considerar */}
                        {p.points_to_consider && (
                          <div style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 6,
                            padding: '8px 10px',
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                            lineHeight: 1.4
                          }}>
                            <span style={{ fontWeight: 700, color: '#F59E0B' }}>⚠️ Consideraciones: </span>
                            {p.points_to_consider}
                          </div>
                        )}
                      </div>

                      {/* Botones de Acción */}
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                        {isApproved ? (
                          <div style={{
                            background: 'rgba(76, 175, 80, 0.15)',
                            border: '1px solid #4CAF50',
                            borderRadius: 8,
                            padding: '8px 12px',
                            color: '#81C784',
                            fontSize: 12,
                            fontWeight: 700,
                            textAlign: 'center',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6
                          }}>
                            <CheckCircle size={14} />
                            <span>Match Aprobado</span>
                          </div>
                        ) : isDiscarded ? (
                          <div style={{
                            background: 'rgba(255,255,255,0.04)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            color: 'var(--text-muted)',
                            fontSize: 12,
                            textAlign: 'center'
                          }}>
                            ✕ Candidato Descartado
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => handleApprove(c, p)}
                              disabled={actionLoadingId === p.id}
                              style={{
                                flex: 2,
                                padding: '9px 12px',
                                background: 'var(--color-primary)',
                                border: 'none',
                                borderRadius: 8,
                                color: '#fff',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                boxShadow: '0 2px 8px rgba(150,21,0,0.3)'
                              }}
                            >
                              <CheckCircle size={14} />
                              <span>{actionLoadingId === p.id ? 'Aprobando...' : 'Aprobar Match'}</span>
                            </button>

                            <button
                              onClick={() => handleDiscard(c, p)}
                              disabled={actionLoadingId === p.id}
                              style={{
                                flex: 1,
                                padding: '9px 10px',
                                background: 'transparent',
                                border: '1px solid var(--border-color)',
                                borderRadius: 8,
                                color: 'var(--text-secondary)',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 4
                              }}
                              title="Descartar esta propuesta"
                            >
                              <XCircle size={14} />
                              <span>Descartar</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Paginación */}
          {data.total_pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '6px 14px',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: page <= 1 ? 0.5 : 1
                }}
              >
                <ChevronLeft size={14} style={{ verticalAlign: 'middle' }} /> Anterior
              </button>

              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Página {page} de {data.total_pages} ({data.total_items} clientes)
              </span>

              <button
                onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                disabled={page >= data.total_pages}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '6px 14px',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  cursor: page >= data.total_pages ? 'not-allowed' : 'pointer',
                  opacity: page >= data.total_pages ? 0.5 : 1
                }}
              >
                Siguiente <ChevronRight size={14} style={{ verticalAlign: 'middle' }} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
