import React, { useState, useEffect } from 'react'
import { Plus, Edit2, MapPin, Globe, Phone, DollarSign, Image as ImageIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function CmsCiudades() {
  const { token } = useAuth()
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCity, setEditingCity] = useState(null)

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    tagline: '',
    hero_badge: '',
    hero_title: '',
    hero_subtitle: '',
    hero_image_url: '',
    cta_text: 'Aplica Hoy',
    cta_url: '/blind-date',
    currency: 'COP',
    whatsapp_number: '',
    whatsapp_message: '',
    is_active: true,
    sort_order: 0
  })

  const API_BASE = 'https://prueba-daily.agentesia.cloud/api/v1/admin'

  const fetchCities = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/cities`, { headers: { 'Authorization': `Bearer ${token}` } })
      const data = await res.json()
      setCities(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCities()
  }, [token])

  const handleOpenModal = (city = null) => {
    if (city) {
      setEditingCity(city)
      setFormData({ ...city })
    } else {
      setEditingCity(null)
      setFormData({
        id: '',
        name: '',
        tagline: '',
        hero_badge: '',
        hero_title: '',
        hero_subtitle: '',
        hero_image_url: '',
        cta_text: 'Aplica Hoy',
        cta_url: '/blind-date',
        currency: 'COP',
        whatsapp_number: '',
        whatsapp_message: '',
        is_active: true,
        sort_order: 0
      })
    }
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const url = editingCity ? `${API_BASE}/cities/${editingCity.id}` : `${API_BASE}/cities`
    const method = editingCity ? 'PATCH' : 'POST'
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setShowModal(false)
        fetchCities()
      } else {
        alert('Error guardando ciudad')
      }
    } catch (err) {
      alert('Error de conexión')
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>CMS de Ciudades</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Administra los copys del Hero, imágenes, monedas y teléfonos de WhatsApp por ciudad</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          style={{
            background: 'var(--color-primary)', color: '#FFF', border: 'none', borderRadius: 8,
            padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
          }}
        >
          <Plus size={16} /> Nueva Ciudad
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando ciudades...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 24 }}>
          {cities.map(c => (
            <div
              key={c.id}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12,
                overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{ height: 140, position: 'relative', background: '#111' }}>
                <img src={c.hero_image_url || '/images/hero_colombia.png'} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', top: 12, right: 12 }}>
                  <span style={{
                    background: c.is_active ? '#10B981' : '#6B7280', color: '#FFF',
                    padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700
                  }}>
                    {c.is_active ? 'ACTIVA' : 'INACTIVA'}
                  </span>
                </div>
              </div>

              <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{c.name}</h3>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', background: 'rgba(230,57,70,0.1)', padding: '2px 8px', borderRadius: 6 }}>
                    {c.currency}
                  </span>
                </div>

                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{c.tagline}</div>

                <div style={{ background: 'var(--bg-base)', padding: 12, borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-primary)', marginBottom: 4 }}>{c.hero_badge}</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{c.hero_title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.hero_subtitle}</div>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Phone size={14} /> +{c.whatsapp_number || 'N/A'}
                  </div>
                  <button onClick={() => handleOpenModal(c)} style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 13 }}>
                    <Edit2 size={14} /> Editar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16,
            width: '100%', maxWidth: 650, padding: 24, maxHeight: '90vh', overflowY: 'auto'
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>
              {editingCity ? `Editar Ciudad: ${editingCity.name}` : 'Nueva Ciudad'}
            </h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>ID Slug *</label>
                  <input
                    type="text" required disabled={!!editingCity} value={formData.id} placeholder="madrid"
                    onChange={e => setFormData({ ...formData, id: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Nombre *</label>
                  <input
                    type="text" required value={formData.name} placeholder="Madrid"
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Moneda</label>
                  <select
                    value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  >
                    <option value="COP">COP ($)</option>
                    <option value="MXN">MXN ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Tagline de Ciudad</label>
                <input
                  type="text" value={formData.tagline} placeholder="España"
                  onChange={e => setFormData({ ...formData, tagline: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Hero Badge Text</label>
                  <input
                    type="text" value={formData.hero_badge} placeholder="MADRID, ESPAÑA"
                    onChange={e => setFormData({ ...formData, hero_badge: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Hero Title</label>
                  <input
                    type="text" value={formData.hero_title}
                    onChange={e => setFormData({ ...formData, hero_title: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Hero Subtitle</label>
                <textarea
                  rows={2} value={formData.hero_subtitle}
                  onChange={e => setFormData({ ...formData, hero_subtitle: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>WhatsApp Number</label>
                  <input
                    type="text" value={formData.whatsapp_number} placeholder="34600000000"
                    onChange={e => setFormData({ ...formData, whatsapp_number: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>WhatsApp Default Message</label>
                  <input
                    type="text" value={formData.whatsapp_message}
                    onChange={e => setFormData({ ...formData, whatsapp_message: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox" id="is_active" checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <label htmlFor="is_active" style={{ fontSize: 13, color: 'var(--text-primary)' }}>Ciudad Activa en Landings</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 20px', background: 'var(--color-primary)', border: 'none', borderRadius: 6, color: '#FFF', fontWeight: 600, cursor: 'pointer' }}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
