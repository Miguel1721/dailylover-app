import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Calendar, MapPin, ExternalLink, Image as ImageIcon, CheckCircle, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function CmsEventos() {
  const { token } = useAuth()
  const [events, setEvents] = useState([])
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCity, setSelectedCity] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)

  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    description: '',
    city_id: 'colombia',
    event_date: '',
    event_time: '',
    venue: '',
    cta_label: 'Reservar Cupo',
    cta_url: '',
    provider: 'stripe',
    status: 'published',
    image_url: ''
  })
  const [uploadingImage, setUploadingImage] = useState(false)

  const API_BASE = 'https://prueba-daily.agentesia.cloud/api/v1/admin'

  const fetchData = async () => {
    setLoading(true)
    try {
      const [resEvt, resCit] = await Promise.all([
        fetch(`${API_BASE}/events`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/cities`, { headers: { 'Authorization': `Bearer ${token}` } })
      ])
      const dataEvt = await resEvt.json()
      const dataCit = await resCit.json()
      setEvents(Array.isArray(dataEvt) ? dataEvt : [])
      setCities(Array.isArray(dataCit) ? dataCit : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [token])

  const handleOpenModal = (event = null) => {
    if (event) {
      setEditingEvent(event)
      setFormData({
        title: event.title || '',
        subtitle: event.subtitle || '',
        description: event.description || '',
        city_id: event.city_id || 'colombia',
        event_date: event.event_date || '',
        event_time: event.event_time || '',
        venue: event.venue || '',
        cta_label: event.cta_label || 'Reservar Cupo',
        cta_url: event.cta_url || '',
        provider: event.provider || 'stripe',
        status: event.status || 'published',
        image_url: event.image_url || ''
      })
    } else {
      setEditingEvent(null)
      setFormData({
        title: '',
        subtitle: '',
        description: '',
        city_id: selectedCity !== 'all' ? selectedCity : 'colombia',
        event_date: '',
        event_time: '',
        venue: '',
        cta_label: 'Reservar Cupo',
        cta_url: '',
        provider: 'stripe',
        status: 'published',
        image_url: ''
      })
    }
    setShowModal(true)
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingImage(true)
    const body = new FormData()
    body.append('file', file)
    try {
      const res = await fetch(`${API_BASE}/media/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body
      })
      const data = await res.json()
      if (data.url) {
        setFormData(prev => ({ ...prev, image_url: data.url }))
      }
    } catch (err) {
      alert('Error al subir imagen')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const url = editingEvent ? `${API_BASE}/events/${editingEvent.id}` : `${API_BASE}/events`
    const method = editingEvent ? 'PATCH' : 'POST'
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
        fetchData()
      } else {
        alert('Error guardando evento')
      }
    } catch (err) {
      alert('Error de conexión')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar este evento?')) return
    try {
      await fetch(`${API_BASE}/events/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      fetchData()
    } catch (e) {
      alert('Error eliminando evento')
    }
  }

  const filteredEvents = events.filter(e => selectedCity === 'all' || e.city_id === selectedCity)

  const getProviderBadge = (provider) => {
    const colors = {
      stripe: '#635BFF',
      ticketmaster: '#026CDF',
      fourvenues: '#FF385C',
      tally: '#000000',
      other: '#6B7280'
    }
    return (
      <span style={{
        background: colors[provider] || colors.other,
        color: '#FFF',
        padding: '3px 8px',
        borderRadius: 12,
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase'
      }}>
        {provider}
      </span>
    )
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>CMS de Eventos (María Paula)</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Administra todos los eventos publicados en las landings por ciudad</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          style={{
            background: 'var(--color-primary)',
            color: '#FFF',
            border: 'none',
            borderRadius: 8,
            padding: '10px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <Plus size={16} /> Nuevo Evento
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
        <button
          onClick={() => setSelectedCity('all')}
          style={{
            background: selectedCity === 'all' ? 'var(--color-primary)' : 'transparent',
            color: selectedCity === 'all' ? '#FFF' : 'var(--text-secondary)',
            border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}
        >
          Todas las Ciudades
        </button>
        {cities.map(c => (
          <button
            key={c.id}
            onClick={() => setSelectedCity(c.id)}
            style={{
              background: selectedCity === c.id ? 'var(--color-primary)' : 'transparent',
              color: selectedCity === c.id ? '#FFF' : 'var(--text-secondary)',
              border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando eventos...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
          {filteredEvents.map(evt => (
            <div
              key={evt.id}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{ height: 160, position: 'relative', background: '#111' }}>
                <img
                  src={evt.image_url || '/images/hero_colombia.png'}
                  alt={evt.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6 }}>
                  {getProviderBadge(evt.provider)}
                  <span style={{
                    background: evt.status === 'published' ? '#10B981' : '#F59E0B',
                    color: '#FFF', padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700
                  }}>
                    {evt.status}
                  </span>
                </div>
              </div>

              <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 4 }}>
                  {cities.find(c => c.id === evt.city_id)?.name || evt.city_id}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>{evt.title}</h3>
                {evt.subtitle && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>{evt.subtitle}</p>}

                <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {evt.venue && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={14} /> {evt.venue}</div>}
                  {evt.event_date && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={14} /> {evt.event_date} {evt.event_time && `· ${evt.event_time}`}</div>}
                </div>

                <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <a
                    href={evt.cta_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 12, color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}
                  >
                    {evt.cta_label} <ExternalLink size={12} />
                  </a>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleOpenModal(evt)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(evt.id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                  </div>
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
            width: '100%', maxWidth: 600, padding: 24, maxHeight: '90vh', overflowY: 'auto'
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>
              {editingEvent ? 'Editar Evento' : 'Nuevo Evento'}
            </h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Título del Evento *</label>
                  <input
                    type="text" required value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Ciudad *</label>
                  <select
                    value={formData.city_id} onChange={e => setFormData({ ...formData, city_id: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  >
                    {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Subtítulo / Tagline</label>
                <input
                  type="text" value={formData.subtitle}
                  onChange={e => setFormData({ ...formData, subtitle: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Fecha</label>
                  <input
                    type="date" value={formData.event_date}
                    onChange={e => setFormData({ ...formData, event_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Hora</label>
                  <input
                    type="text" placeholder="Ej: 8:00 PM" value={formData.event_time}
                    onChange={e => setFormData({ ...formData, event_time: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Lugar / Venue</label>
                  <input
                    type="text" value={formData.venue}
                    onChange={e => setFormData({ ...formData, venue: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Texto Botón CTA *</label>
                  <input
                    type="text" required value={formData.cta_label}
                    onChange={e => setFormData({ ...formData, cta_label: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>URL Botón CTA *</label>
                  <input
                    type="url" required value={formData.cta_url}
                    onChange={e => setFormData({ ...formData, cta_url: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Proveedor de Ticket</label>
                  <select
                    value={formData.provider} onChange={e => setFormData({ ...formData, provider: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  >
                    <option value="stripe">Stripe</option>
                    <option value="ticketmaster">Ticketmaster</option>
                    <option value="fourvenues">Fourvenues</option>
                    <option value="tally">Tally</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Estado</label>
                  <select
                    value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  >
                    <option value="published">Publicado</option>
                    <option value="draft">Borrador</option>
                    <option value="past">Pasado</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Imagen del Evento (URL o Subida)</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <input
                    type="text" value={formData.image_url} placeholder="/images/event_polo.jpeg"
                    onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                    style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 6, color: '#FFF' }}
                  />
                  <label style={{
                    padding: '8px 14px', background: '#374151', color: '#FFF', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4
                  }}>
                    <ImageIcon size={14} /> {uploadingImage ? 'Subiendo...' : 'Subir'}
                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                  </label>
                </div>
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
