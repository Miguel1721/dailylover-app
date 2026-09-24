import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  Wallet, CheckCircle, Search, RefreshCw, AlertCircle, Clock, ExternalLink, MapPin, Zap, CreditCard
} from 'lucide-react'
import CrmPersonLink from '../../components/CrmPersonLink'

export const OFFICIAL_REFUND_CATEGORIES = [
  'Descalificación Clínica / Protocolo de Seguridad',
  'Pool Insuficiente por Edad (>50 años)',
  'Sin Cobertura Geográfica',
  'Se encuentra actualmente en una relación',
  'Insatisfacción con el Servicio / Troublemakers',
  'Desistimiento voluntario por demora',
  'Desistimiento voluntario por otras razones'
]

export default function RefundsQueue() {
  const { token } = useAuth()
  const [refunds, setRefunds] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('REFUND') // 'REFUND' (Pendientes) o 'REFUND DONE' (Procesados)
  const [processingId, setProcessingId] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newRefund, setNewRefund] = useState({
    person_name: '',
    psychologist_name: 'General',
    plan_tier: '',
    category: 'Descalificación Clínica / Protocolo de Seguridad',
    reason: ''
  })
  const [submittingManual, setSubmittingManual] = useState(false)
  const [stripeRefundTarget, setStripeRefundTarget] = useState(null)
  const [stripeAmount, setStripeAmount] = useState('')
  const [stripeReason, setStripeReason] = useState('requested_by_customer')
  const [stripeNotes, setStripeNotes] = useState('')
  const [stripeProcessing, setStripeProcessing] = useState(false)
  const [refundType, setRefundType] = useState('full') // 'full' | 'partial'
  const [partialPercentage, setPartialPercentage] = useState(50)

  const handleOpenStripeModal = (item) => {
    setStripeRefundTarget(item)
    setRefundType('full')
    setPartialPercentage(50)
    setStripeAmount(item.stripe_amount ? String(item.stripe_amount) : '')
    setStripeReason('requested_by_customer')
    setStripeNotes('')
  }

  const handleExecuteStripeRefund = async (e) => {
    e.preventDefault()
    if (!stripeRefundTarget) return

    setStripeProcessing(true)
    try {
      const res = await fetch(`/api/v1/matchmaking/refunds/${stripeRefundTarget.id}/process-stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          payment_intent_id: stripeRefundTarget.stripe_payment_intent_id || undefined,
          refund_type: refundType,
          percentage: refundType === 'partial' ? partialPercentage : undefined,
          amount: stripeAmount ? parseFloat(stripeAmount) : undefined,
          reason: stripeReason,
          notes: stripeNotes || undefined
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al procesar el reembolso en Stripe')
      
      alert(data.message || '✓ Reembolso procesado exitosamente en Stripe.')
      setStripeRefundTarget(null)
      fetchRefunds()
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setStripeProcessing(false)
    }
  }

  const handleCreateManualRefund = async (e) => {
    e.preventDefault()
    if (!newRefund.person_name.trim()) {
      alert('Por favor ingrese el nombre de la persona.')
      return
    }
    setSubmittingManual(true)
    try {
      const res = await fetch('/api/v1/matchmaking/refunds/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newRefund)
      })
      if (!res.ok) throw new Error('Error al registrar refund manual')
      setShowAddModal(false)
      setNewRefund({ person_name: '', psychologist_name: 'General', plan_tier: '', category: OFFICIAL_REFUND_CATEGORIES[0], reason: '' })
      fetchRefunds()
      alert('✓ Solicitud de refund registrada exitosamente en la cola de Lina.')
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmittingManual(false)
    }
  }

  const fetchRefunds = async () => {
    setLoading(true)
    setError(null)
    try {
      const url = `/api/v1/matchmaking/refunds?status=${statusFilter}&search=${encodeURIComponent(searchTerm)}`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Error al cargar la cola de refunds')
      const data = await res.json()
      setRefunds(data.refunds || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRefunds()
  }, [statusFilter])

  const handleProcessRefund = async (matchId) => {
    if (!window.confirm(`¿Confirmas que el reembolso para el match #${matchId} ya fue procesado en Stripe/Nequi?`)) {
      return
    }

    setProcessingId(matchId)
    try {
      const res = await fetch(`/api/v1/matchmaking/refunds/${matchId}/process`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      })
      if (!res.ok) throw new Error('Error al procesar el reembolso')
      fetchRefunds()
    } catch (err) {
      alert(err.message)
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Wallet size={26} color="#B8324F" /> Cola de Refunds (Lina - Servicio al Cliente)
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Equivalente a Revisión María para Servicio al Cliente. Revisa los reembolsos solicitados y márcalos como completados tras procesar en pasarela/banco.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 6,
              border: 'none',
              background: '#961500',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            + Registrar Refund (Servicio al Cliente)
          </button>

          <button
            onClick={fetchRefunds}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refrescar
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        padding: '12px 16px',
        background: 'var(--bg-card)',
        borderRadius: 8,
        border: '1px solid var(--border-color)',
        marginBottom: 20
      }}>
        {/* Toggle Estado */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setStatusFilter('REFUND')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              border: statusFilter === 'REFUND' ? '1px solid #B8324F' : '1px solid var(--border-color)',
              background: statusFilter === 'REFUND' ? 'rgba(184,50,79,0.12)' : 'var(--bg-base)',
              color: statusFilter === 'REFUND' ? '#B8324F' : 'var(--text-secondary)'
            }}
          >
            Pendientes por Procesar
          </button>
          <button
            onClick={() => setStatusFilter('REFUND DONE')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              border: statusFilter === 'REFUND DONE' ? '1px solid #274E13' : '1px solid var(--border-color)',
              background: statusFilter === 'REFUND DONE' ? 'rgba(106,168,79,0.12)' : 'var(--bg-base)',
              color: statusFilter === 'REFUND DONE' ? '#274E13' : 'var(--text-secondary)'
            }}
          >
            Reembolsos Procesados (REFUND DONE)
          </button>
        </div>

        {/* Buscador */}
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por cliente, psicóloga o motivo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') fetchRefunds() }}
            style={{
              width: '100%',
              padding: '6px 10px 6px 32px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {error && (
        <div style={{ padding: 14, background: '#F4CCCC', color: '#660000', borderRadius: 6, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Tabla de Refunds */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 8,
        border: '1px solid var(--border-color)',
        overflowX: 'auto'
      }}>
        <table style={{ width: '100%', minWidth: 1000, borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              <th style={{ padding: '12px 14px', width: 80, fontWeight: 600 }}>MATCH #</th>
              <th style={{ padding: '12px 14px', minWidth: 180, fontWeight: 600 }}>PERSONA A (CLIENTE)</th>
              <th style={{ padding: '12px 12px', width: 140, fontWeight: 600 }}>PLAN / MONTO</th>
              <th style={{ padding: '12px 12px', width: 120, fontWeight: 600 }}>PSICÓLOGA</th>
              <th style={{ padding: '12px 12px', width: 100, fontWeight: 600 }}>CIUDAD</th>
              <th style={{ padding: '12px 14px', minWidth: 240, fontWeight: 600 }}>MOTIVO / OBSERVACIONES</th>
              <th style={{ padding: '12px 14px', width: 140, fontWeight: 600 }}>ESTADO</th>
              <th style={{ padding: '12px 14px', width: 160, textAlign: 'center', fontWeight: 600 }}>ACCIÓN LINA</th>
            </tr>
          </thead>
          <tbody>
            {loading && refunds.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Cargando cola de refunds...
                </td>
              </tr>
            ) : refunds.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  {statusFilter === 'REFUND' ? '🎉 No hay reembolsos pendientes por procesar.' : 'No hay registros de reembolsos completados.'}
                </td>
              </tr>
            ) : (
              refunds.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-muted)' }}>
                    #{r.id}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <CrmPersonLink name={r.person_a} crmId={r.person_a_crm_id} />
                  </td>
                  <td style={{ padding: '12px 12px', fontWeight: 600 }}>
                    <div>{r.plan_tier || 'Estándar 65k'}</div>
                    {r.stripe_amount ? (
                      <div style={{ fontSize: 11, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <CreditCard size={11} /> ${r.stripe_amount.toLocaleString()} {r.stripe_currency}
                      </div>
                    ) : r.stripe_payment_intent_id ? (
                      <div style={{ fontSize: 10, color: '#38bdf8', marginTop: 2 }}>
                        💳 Stripe {r.stripe_payment_intent_id.slice(0, 8)}...
                      </div>
                    ) : null}
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    <span style={{ padding: '2px 6px', background: 'var(--bg-base)', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                      {r.psychologist_name}
                    </span>
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    {r.city || 'Bogotá'}
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>
                    {r.observations || 'Solicitud de reembolso'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      background: r.status === 'REFUND' ? '#EA9999' : '#D9EAD3',
                      color: r.status === 'REFUND' ? '#660000' : '#274E13'
                    }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    {r.status === 'REFUND' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', minWidth: 140 }}>
                        <button
                          onClick={() => handleOpenStripeModal(r)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            background: '#7c3aed',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: 6,
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)',
                            width: '100%',
                            justifyContent: 'center'
                          }}
                        >
                          <Zap size={13} fill="#FFFFFF" /> Reembolsar Stripe
                        </button>

                        <button
                          onClick={() => handleProcessRefund(r.id)}
                          disabled={processingId === r.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            width: '100%',
                            justifyContent: 'center'
                          }}
                          title="Marcar como procesado si el reembolso fue por Nequi o transferencia manual"
                        >
                          <CheckCircle size={12} /> {processingId === r.id ? '...' : 'Manual (Nequi)'}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <span style={{ fontSize: 11, color: '#274E13', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle size={13} /> Reembolsado
                        </span>
                        {r.stripe_refund_id && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            ID: {r.stripe_refund_id.slice(0, 12)}...
                          </span>
                        )}
                        {r.refund_amount && (
                          <span style={{ fontSize: 10, color: '#38bdf8', fontWeight: 600 }}>
                            ${r.refund_amount.toLocaleString()} COP
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Registrar Refund Manual */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 12,
            border: '1px solid var(--border-color)',
            width: '100%',
            maxWidth: 500,
            padding: 24,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wallet size={20} color="#B8324F" /> Registrar Solicitud de Refund
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Ingresa los datos del cliente para enrutar el reembolso directamente a la cola de revisión de Lina.
            </p>

            <form onSubmit={handleCreateManualRefund} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                  Nombre Completo del Cliente *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Laura Gómez"
                  value={newRefund.person_name}
                  onChange={e => setNewRefund({ ...newRefund, person_name: e.target.value })}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)', fontSize: 13
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                    Psicóloga Responsable
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: SILVI, JENN..."
                    value={newRefund.psychologist_name}
                    onChange={e => setNewRefund({ ...newRefund, psychologist_name: e.target.value })}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 6,
                      background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)', fontSize: 13
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                    Plan / Tier
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: VIP, 65k, 40k"
                    value={newRefund.plan_tier}
                    onChange={e => setNewRefund({ ...newRefund, plan_tier: e.target.value })}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 6,
                      background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)', fontSize: 13
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                  Categoría Clínica Oficial *
                </label>
                <select
                  value={newRefund.category || OFFICIAL_REFUND_CATEGORIES[0]}
                  onChange={e => setNewRefund({ ...newRefund, category: e.target.value })}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)', fontSize: 13, fontWeight: 600
                  }}
                >
                  {OFFICIAL_REFUND_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                  Motivo / Observación de Servicio al Cliente *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ej: Solicitud vía WhatsApp por inconformidad o problemas personales."
                  value={newRefund.reason}
                  onChange={e => setNewRefund({ ...newRefund, reason: e.target.value })}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)', fontSize: 13, resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '8px 14px', borderRadius: 6, border: '1px solid var(--border-color)',
                    background: 'var(--bg-base)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingManual}
                  style={{
                    padding: '8px 16px', borderRadius: 6, border: 'none',
                    background: '#961500', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  {submittingManual ? 'Enviando...' : 'Enviar a Cola de Lina'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reembolso Automático en Stripe */}
      {stripeRefundTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 12,
            border: '1px solid #7c3aed',
            width: '100%',
            maxWidth: 520,
            padding: 24,
            boxShadow: '0 8px 32px rgba(124, 58, 237, 0.3)'
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={20} color="#a855f7" fill="#a855f7" /> Reembolso Automático en Stripe
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Esta acción ordenará a <strong>Stripe</strong> devolver los fondos a la tarjeta del cliente de forma inmediata.
            </p>

            <form onSubmit={handleExecuteStripeRefund} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '12px 14px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cliente / Solicitante</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                  {stripeRefundTarget.person_a}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Plan: <strong>{stripeRefundTarget.plan_tier}</strong> • Match #{stripeRefundTarget.id}
                </div>
                {stripeRefundTarget.stripe_payment_intent_id && (
                  <div style={{ fontSize: 11, color: '#38bdf8', marginTop: 4, fontFamily: 'monospace' }}>
                    Payment Intent: {stripeRefundTarget.stripe_payment_intent_id}
                  </div>
                )}
              </div>

              {/* Selector de Tipo de Reembolso: Total vs Parcial */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                  Modalidad de Reembolso *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setRefundType('full')
                      setStripeAmount(stripeRefundTarget.stripe_amount ? String(stripeRefundTarget.stripe_amount) : '')
                    }}
                    style={{
                      padding: '10px', borderRadius: 8,
                      border: refundType === 'full' ? '2px solid #7c3aed' : '1px solid var(--border-color)',
                      background: refundType === 'full' ? 'rgba(124, 58, 237, 0.15)' : 'var(--bg-base)',
                      color: refundType === 'full' ? '#c084fc' : 'var(--text-secondary)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center'
                    }}
                  >
                    <div>Reembolso Total (100%)</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Devolver todo el pago</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRefundType('partial')
                      const base = stripeRefundTarget.stripe_amount || 65000
                      setStripeAmount(String(Math.round((base * partialPercentage) / 100)))
                    }}
                    style={{
                      padding: '10px', borderRadius: 8,
                      border: refundType === 'partial' ? '2px solid #7c3aed' : '1px solid var(--border-color)',
                      background: refundType === 'partial' ? 'rgba(124, 58, 237, 0.15)' : 'var(--bg-base)',
                      color: refundType === 'partial' ? '#c084fc' : 'var(--text-secondary)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center'
                    }}
                  >
                    <div>Reembolso Parcial</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Devolución proporcional</div>
                  </button>
                </div>

                {refundType === 'partial' && (
                  <div style={{ background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.25)', borderRadius: 8, padding: 12, marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#c084fc', marginBottom: 8 }}>
                      Atajos rápidos de porcentaje:
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      {[
                        { pct: 50, label: '50% (1 cita usada)' },
                        { pct: 30, label: '30%' },
                        { pct: 20, label: '20%' },
                        { pct: 75, label: '75%' }
                      ].map(item => (
                        <button
                          key={item.pct}
                          type="button"
                          onClick={() => {
                            setPartialPercentage(item.pct)
                            const base = stripeRefundTarget.stripe_amount || 65000
                            setStripeAmount(String(Math.round((base * item.pct) / 100)))
                          }}
                          style={{
                            padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: partialPercentage === item.pct ? '#7c3aed' : 'var(--bg-base)',
                            color: partialPercentage === item.pct ? '#fff' : 'var(--text-secondary)',
                            border: '1px solid var(--border-color)', cursor: 'pointer'
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                  Monto a Reembolsar (COP) *
                </label>
                <input
                  type="number"
                  required
                  placeholder={stripeRefundTarget.stripe_amount ? String(stripeRefundTarget.stripe_amount) : "Ej: 65000"}
                  value={stripeAmount}
                  onChange={e => {
                    const val = e.target.value
                    setStripeAmount(val)
                    if (stripeRefundTarget.stripe_amount && parseFloat(val) > 0) {
                      const computedPct = Math.round((parseFloat(val) / stripeRefundTarget.stripe_amount) * 100)
                      setPartialPercentage(computedPct)
                    }
                  }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 6,
                    background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)', fontSize: 14, fontWeight: 600
                  }}
                />
                
                {/* Desglose financiero en vivo */}
                {stripeRefundTarget.stripe_amount && (
                  <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border-color)', fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Monto cobrado originalmente:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>${stripeRefundTarget.stripe_amount.toLocaleString()} COP</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#f87171' }}>Monto a devolver al cliente:</span>
                      <strong style={{ color: '#f87171' }}>
                        -${(parseFloat(stripeAmount) || 0).toLocaleString()} COP 
                        {stripeAmount && stripeRefundTarget.stripe_amount ? ` (${Math.round((parseFloat(stripeAmount) / stripeRefundTarget.stripe_amount) * 100)}%)` : ''}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: 4 }}>
                      <span style={{ color: '#4ade80' }}>Saldo retenido en Daily Lover:</span>
                      <strong style={{ color: '#4ade80' }}>
                        ${Math.max(0, stripeRefundTarget.stripe_amount - (parseFloat(stripeAmount) || 0)).toLocaleString()} COP
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                  Motivo del Reembolso (Stripe)
                </label>
                <select
                  value={stripeReason}
                  onChange={e => setStripeReason(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)', fontSize: 13
                  }}
                >
                  <option value="requested_by_customer">Solicitado por el cliente (requested_by_customer)</option>
                  <option value="duplicate">Cobro duplicado (duplicate)</option>
                  <option value="fraudulent">Sospecha de fraude (fraudulent)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                  Nota interna de auditoría (Lina / Servicio al Cliente)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Cliente solicitó cancelación por cambio de ciudad."
                  value={stripeNotes}
                  onChange={e => setStripeNotes(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)', fontSize: 13, resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setStripeRefundTarget(null)}
                  disabled={stripeProcessing}
                  style={{
                    padding: '9px 16px', borderRadius: 6, border: '1px solid var(--border-color)',
                    background: 'var(--bg-base)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={stripeProcessing}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '9px 18px', borderRadius: 6, border: 'none',
                    background: '#7c3aed', color: '#fff', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.4)'
                  }}
                >
                  <Zap size={14} fill="#fff" />
                  {stripeProcessing ? 'Procesando en Stripe...' : 'Confirmar Reembolso Automático'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
