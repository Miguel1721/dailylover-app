import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  Wallet, CheckCircle, Search, RefreshCw, AlertCircle, Clock, ExternalLink, MapPin
} from 'lucide-react'
import CrmPersonLink from '../../components/CrmPersonLink'

export default function RefundsQueue() {
  const { token } = useAuth()
  const [refunds, setRefunds] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('REFUND') // 'REFUND' (Pendientes) o 'REFUND DONE' (Procesados)
  const [processingId, setProcessingId] = useState(null)

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
                    {r.plan_tier || 'Estándar 65k'}
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
                      <button
                        onClick={() => handleProcessRefund(r.id)}
                        disabled={processingId === r.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: '#274E13',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <CheckCircle size={14} /> {processingId === r.id ? 'Procesando...' : 'Aprobar Refund'}
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: '#274E13', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle size={13} /> Reembolsado
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
