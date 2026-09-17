import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ClipboardList, Brain, Sparkles, User, CheckCircle2, ArrowRight, ShieldCheck, Calendar, Clock, Video, Play, Phone, MapPin, ExternalLink } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import ClientSelectorBar from '../../components/ClientSelectorBar'
import DatosObjetivos from './DatosObjetivos'
import PercepcionPsicologa from './PercepcionPsicologa'
import EntrevistaResultados from './EntrevistaResultados'
import ColaAtrasadosView from './ColaAtrasadosView'

const API = 'https://prueba-daily.agentesia.cloud'

export default function EntrevistaHub({ initialTab }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const isAtrasadosOnly = user?.role === 'atrasados_only'

  const urlUserId = searchParams.get('user_id') || searchParams.get('id')
  const defaultTab = isAtrasadosOnly ? 'cola_atrasados' : (initialTab || searchParams.get('tab') || 'objetivos')
  const urlTab = searchParams.get('tab') || defaultTab

  const [selectedClient, setSelectedClient] = useState(null)
  const [activeTab, setActiveTab] = useState(urlTab)
  const [recentClients, setRecentClients] = useState([])
  const [scheduledAppointments, setScheduledAppointments] = useState([])
  const [loadingAppts, setLoadingAppts] = useState(true)

  // Cargar citas agendadas desde el calendario / scheduling
  useEffect(() => {
    fetch(`${API}/api/v1/scheduling/appointments`)
      .then(r => r.json())
      .then(data => {
        if (data && data.appointments) {
          setScheduledAppointments(data.appointments)
        }
      })
      .catch(e => console.error('Error fetching scheduled appointments:', e))
      .finally(() => setLoadingAppts(false))
  }, [])

  // Sincronizar tab desde URL o prop
  useEffect(() => {
    if (urlTab && ['objetivos', 'percepcion', 'resultados', 'cola_atrasados'].includes(urlTab)) {
      setActiveTab(urlTab)
    }
  }, [urlTab])

  // Cargar clientes con perfil guardado recientemente (dinámico, sin atajo a Samuel)
  useEffect(() => {
    fetch(`${API}/api/v1/matchmaking/recent-extended-clients`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data && data.clients) {
          setRecentClients(data.clients)
        }
      })
      .catch(() => {})
  }, [token])

  const urlClientName = searchParams.get('name') || searchParams.get('search')

  // Cargar cliente por URL si viene en query (id o user_id)
  useEffect(() => {
    if (urlUserId && (!selectedClient || selectedClient.id !== Number(urlUserId))) {
      fetch(`${API}/api/v1/matchmaking/extended-profile/${urlUserId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
        .then(r => r.json())
        .then(data => {
          if (data && data.client) {
            setSelectedClient({
              id: data.client.user_id,
              name: data.client.name,
              phone: data.client.phone,
              client_code: data.client.client_code,
              crm_id: data.client.crm_id
            })
          }
        })
        .catch(e => console.error('Error fetching client by URL:', e))
    }
  }, [urlUserId, token])

  // Cargar cliente por nombre o búsqueda si viene en URL
  useEffect(() => {
    if (!urlUserId && urlClientName && (!selectedClient || selectedClient.name !== urlClientName)) {
      fetch(`${API}/api/v1/matchmaking/extended-profile/${encodeURIComponent(urlClientName)}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
        .then(r => r.json())
        .then(data => {
          if (data && data.client) {
            setSelectedClient({
              id: data.client.user_id,
              name: data.client.name,
              phone: data.client.phone,
              client_code: data.client.client_code,
              crm_id: data.client.crm_id
            })
          }
        })
        .catch(e => console.error('Error fetching client by name query:', e))
    }
  }, [urlUserId, urlClientName, token])

  const handleSelectClient = (client) => {
    setSelectedClient(client)
    setSearchParams({ user_id: client.id, tab: activeTab })
  }

  const handleClearClient = () => {
    setSelectedClient(null)
    setSearchParams({ tab: activeTab })
  }

  const switchTab = (tab) => {
    setActiveTab(tab)
    if (selectedClient) {
      setSearchParams({ user_id: selectedClient.id, tab })
    } else {
      setSearchParams({ tab })
    }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1600, margin: '0 auto' }}>
      {/* Header General del Módulo */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #961500, #c41a00)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff'
          }}>
            <Sparkles size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              🎙️ Entrevista Clínica & Matching
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Flujo clínico integral: Entrevista Individual (3 Fases) o Cola de Revisión Rápida de los 419 Clientes Atrasados.
            </p>
          </div>
        </div>
      </div>

      {/* Selector de Modo: Entrevista Individual vs Cola de Atrasados */}
      {!isAtrasadosOnly && (
        <div style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: 10,
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => switchTab('objetivos')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 8,
              border: 'none',
              background: activeTab !== 'cola_atrasados' ? 'rgba(150, 21, 0, 0.15)' : 'transparent',
              color: activeTab !== 'cola_atrasados' ? 'var(--color-primary-light)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            <ClipboardList size={16} />
            <span>🎙️ Entrevista Individual (3 Fases)</span>
          </button>

          <button
            onClick={() => switchTab('cola_atrasados')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'cola_atrasados' ? 'rgba(150, 21, 0, 0.15)' : 'transparent',
              color: activeTab === 'cola_atrasados' ? 'var(--color-primary-light)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            <Sparkles size={16} color="var(--color-primary-light)" />
            <span>📦 Cola de Atrasados (419 Clientes)</span>
            <span style={{
              fontSize: 10,
              background: 'var(--color-primary)',
              color: '#fff',
              padding: '1px 6px',
              borderRadius: 10,
              fontWeight: 800
            }}>
              Agosto 27
            </span>
          </button>
        </div>
      )}

      {/* Si la pestaña activa es Cola de Atrasados: Renderizar ColaAtrasadosView */}
      {activeTab === 'cola_atrasados' ? (
        <ColaAtrasadosView />
      ) : (
        <>
          {/* Barra de Selección de Cliente Común para todo el proceso */}
          <ClientSelectorBar
            selectedClient={selectedClient}
            onSelectClient={handleSelectClient}
            onClearClient={handleClearClient}
            exists={Boolean(selectedClient)}
          />

          {/* Si NO hay cliente seleccionado: Pantalla Guía con Accesos Rápidos & Citas de Calendario */}
          {!selectedClient ? (
            <div>
          {/* BANDEJA: CITAS DE ENTREVISTA AGENDADAS (CALENDARIO & TURNOS) */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 14,
            padding: '24px 28px',
            marginBottom: 24,
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'rgba(150, 21, 0, 0.18)',
                  border: '1px solid rgba(150, 21, 0, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary-light)'
                }}>
                  <Calendar size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    📅 Citas de Entrevista Agendadas (Sincronizado con Calendario & Turnos)
                  </h2>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    Candidatos con turno programado en el calendario. Haz clic en <strong>Iniciar Entrevista</strong> para cargar sus formularios en vivo.
                  </p>
                </div>
              </div>

              <button
                onClick={() => navigate('/matchmaking/calendario')}
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: 8,
                  padding: '7px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s'
                }}
              >
                <span>Ver Calendario de Turnos</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {loadingAppts ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Cargando citas del calendario...
              </div>
            ) : scheduledAppointments.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-base)', borderRadius: 10 }}>
                No hay citas agendadas registradas aún en el calendario. Puedes buscar un cliente manualmente arriba.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
                {scheduledAppointments.map(appt => (
                  <div
                    key={appt.id}
                    style={{
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 12,
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 12,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                    }}
                  >
                    <div>
                      {/* Fila Superior: Horario y Estado */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--color-primary-light)',
                          background: 'rgba(150, 21, 0, 0.12)',
                          padding: '3px 10px',
                          borderRadius: 6
                        }}>
                          <Clock size={13} />
                          {appt.time_slot || '08:00'} • {appt.date || 'Hoy'}
                        </span>

                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: appt.has_extended ? '#4CAF50' : '#F59E0B',
                          background: appt.has_extended ? 'rgba(76, 175, 80, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          padding: '3px 8px',
                          borderRadius: 10
                        }}>
                          {appt.has_extended ? '✓ Con Evaluación' : '🟡 Pendiente Llenar'}
                        </span>
                      </div>

                      {/* Nombre y Contacto */}
                      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>
                        {appt.client_name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span>📍 {appt.client_city || 'Bogotá'}</span>
                        <span>📞 {appt.client_phone || 'Sin teléfono'}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                        Psicóloga asignada: <strong style={{ color: 'var(--text-primary)' }}>{appt.psychologist_name}</strong>
                      </div>
                    </div>

                    {/* Botones de Acción */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, borderTop: '1px solid rgba(150, 21, 0, 0.12)', paddingTop: 12 }}>
                      <button
                        onClick={() => handleSelectClient({ id: appt.user_id, name: appt.client_name, phone: appt.client_phone })}
                        style={{
                          flex: 1,
                          padding: '9px 12px',
                          background: 'var(--color-primary)',
                          border: 'none',
                          borderRadius: 8,
                          color: '#ffffff',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          boxShadow: '0 2px 6px rgba(150,21,0,0.3)'
                        }}
                      >
                        <Play size={12} fill="#ffffff" />
                        <span>Iniciar Entrevista</span>
                      </button>

                      <button
                        onClick={() => navigate('/matchmaking/sala/' + (appt.videocall_token || appt.id))}
                        style={{
                          padding: '9px 14px',
                          background: 'rgba(150, 21, 0, 0.15)',
                          border: '1px solid var(--color-primary)',
                          borderRadius: 8,
                          color: 'var(--color-primary-light)',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6
                        }}
                        title="Entrar a Sala de Videollamada con Evaluación en Vivo"
                      >
                        <Video size={14} />
                        <span>Videollamada</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 14,
            padding: '32px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
          }}>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 32px' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Selecciona una Persona para Iniciar la Entrevista
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Usa el buscador superior escribiendo el nombre o teléfono del cliente. Los datos se guardan de forma única en su expediente y alimentan las sugerencias de match.
            </p>
          </div>

          {/* Pasos del Flujo */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
            marginBottom: 36
          }}>
            <div style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              padding: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgba(150, 21, 0, 0.15)',
                  color: 'var(--color-primary-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 13
                }}>1</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                  📋 Datos Objetivos
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Puntaje Social Group (1-10), nivel educativo, hábitos de vida, actividad física y valores núcleo.
              </p>
            </div>

            <div style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              padding: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgba(150, 21, 0, 0.15)',
                  color: 'var(--color-primary-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 13
                }}>2</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                  🧠 Percepción Psicóloga
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Evaluación en videollamada: soltura, estilo de apego, lenguajes del amor, dealbreakers y síntesis clínica en 3 líneas.
              </p>
            </div>

            <div style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              padding: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgba(76, 175, 80, 0.15)',
                  color: '#4CAF50',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 13
                }}>3</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                  🎯 Resultados & Matching
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Visualización de 3 a 4 candidatos sugeridos. Al hacer clic en Aprobar, pasa formalmente a la mesa de <b>MATCHES</b>.
              </p>
            </div>
          </div>

          {/* Clientes guardados recientemente */}
          {recentClients.length > 0 && (
            <div style={{
              borderTop: '1px solid var(--border-color)',
              paddingTop: 24
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
                Clientes con Perfil Guardado Recientemente:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {recentClients.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectClient(c)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      padding: '8px 14px',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)'
                      e.currentTarget.style.background = 'rgba(150, 21, 0, 0.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)'
                      e.currentTarget.style.background = 'var(--bg-base)'
                    }}
                  >
                    <User size={14} color="var(--color-primary-light)" />
                    <span>{c.name}</span>
                    <span style={{
                      fontSize: 10,
                      background: 'rgba(76, 175, 80, 0.15)',
                      color: '#4CAF50',
                      padding: '2px 6px',
                      borderRadius: 4
                    }}>
                      ✓ Con datos
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
      ) : (
        /* Si HAY cliente seleccionado: Tabs de Navegación del Proceso */
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color)',
            marginBottom: 24,
            overflowX: 'auto',
            paddingBottom: 2
          }}>
            <div style={{ display: 'flex', gap: 10, flex: 1 }}>
            <button
              onClick={() => switchTab('objetivos')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 20px',
                border: 'none',
                borderBottom: activeTab === 'objetivos' ? '3px solid var(--color-primary)' : '3px solid transparent',
                background: activeTab === 'objetivos' ? 'rgba(150, 21, 0, 0.1)' : 'transparent',
                color: activeTab === 'objetivos' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                borderRadius: '8px 8px 0 0',
                transition: 'all 0.15s'
              }}
            >
              <ClipboardList size={16} color={activeTab === 'objetivos' ? 'var(--color-primary-light)' : 'var(--text-muted)'} />
              1. Datos Objetivos
            </button>

            <button
              onClick={() => switchTab('percepcion')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 20px',
                border: 'none',
                borderBottom: activeTab === 'percepcion' ? '3px solid var(--color-primary)' : '3px solid transparent',
                background: activeTab === 'percepcion' ? 'rgba(150, 21, 0, 0.1)' : 'transparent',
                color: activeTab === 'percepcion' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                borderRadius: '8px 8px 0 0',
                transition: 'all 0.15s'
              }}
            >
              <Brain size={16} color={activeTab === 'percepcion' ? 'var(--color-primary-light)' : 'var(--text-muted)'} />
              2. Percepción Psicóloga
            </button>

            <button
              onClick={() => switchTab('resultados')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 20px',
                border: 'none',
                borderBottom: activeTab === 'resultados' ? '3px solid #4CAF50' : '3px solid transparent',
                background: activeTab === 'resultados' ? 'rgba(76, 175, 80, 0.12)' : 'transparent',
                color: activeTab === 'resultados' ? '#A5D6A7' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                borderRadius: '8px 8px 0 0',
                transition: 'all 0.15s'
              }}
            >
              <Sparkles size={16} color={activeTab === 'resultados' ? '#4CAF50' : 'var(--text-muted)'} />
              3. Resultados & Sugerencias de Match
              <span style={{
                fontSize: 10,
                background: '#4CAF50',
                color: '#fff',
                padding: '1px 6px',
                borderRadius: 10,
                fontWeight: 800
              }}>
                Nuevo
              </span>
            </button>
            </div>

            {/* Botón directo a Videollamada durante la Entrevista */}
            <button
              onClick={() => navigate('/matchmaking/sala/' + (selectedClient.id || 1))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                background: '#961500',
                border: 'none',
                borderRadius: 8,
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(150, 21, 0, 0.4)',
                flexShrink: 0,
                marginLeft: 12
              }}
              title="Abrir Sala de Videollamada con este candidato"
            >
              <Video size={16} />
              <span>🎥 Sala de Videollamada</span>
            </button>
          </div>

          {/* Renderizado de la pestaña activa */}
          {activeTab === 'objetivos' && (
            <div>
              <DatosObjetivos standalone={false} client={selectedClient} onContinue={() => switchTab('percepcion')} />
            </div>
          )}

          {activeTab === 'percepcion' && (
            <div>
              <PercepcionPsicologa standalone={false} client={selectedClient} onContinue={() => switchTab('resultados')} />
            </div>
          )}

          {activeTab === 'resultados' && (
            <div>
              <EntrevistaResultados
                clientId={selectedClient.id}
                clientName={selectedClient.name}
                onGoToTab={switchTab}
              />
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  )
}
