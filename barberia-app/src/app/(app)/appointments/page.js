'use client'
import { useState, useEffect } from 'react'
import { CalendarDays, Plus, Search, Filter, ChevronLeft, ChevronRight, Clock, User, Scissors } from 'lucide-react'
import { format, addDays, startOfWeek, parseISO, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import Link from 'next/link'

const STATUS_LABEL = {
  PENDING: 'Pendiente', CONFIRMED: 'Confirmada', IN_PROGRESS: 'En curso',
  COMPLETED: 'Completada', CANCELLED: 'Cancelada', NO_SHOW: 'No asistió',
}
const STATUS_CLASS = {
  PENDING: 'status-pending', CONFIRMED: 'status-confirmed', IN_PROGRESS: 'status-inprogress',
  COMPLETED: 'status-completed', CANCELLED: 'status-cancelled', NO_SHOW: 'status-noshow',
}

export default function AppointmentsPage() {
  const [barbers, setBarbers] = useState([])
  const [appointments, setAppointments] = useState([])
  const [selectedBarber, setSelectedBarber] = useState('all')
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [viewMode, setViewMode] = useState('day') // 'day' | 'list'
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)

  useEffect(() => {
    fetch('/api/barbers').then(r => r.json()).then(setBarbers)
    const params = new URLSearchParams(window.location.search)
    if (params.get('new') === 'true') {
      setShowNewModal(true)
    }
  }, [])

  useEffect(() => {
    loadAppointments()
  }, [selectedBarber, selectedDate])

  const loadAppointments = async () => {
    setLoading(true)
    const params = new URLSearchParams({ date: selectedDate })
    if (selectedBarber !== 'all') params.append('barberId', selectedBarber)
    const data = await fetch(`/api/appointments?${params}`).then(r => r.json())
    setAppointments(Array.isArray(data) ? data : data?.data || [])
    setLoading(false)
  }

  const changeStatus = async (id, status) => {
    await fetch(`/api/appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    toast.success('Estado actualizado')
    loadAppointments()
  }

  const dateDisplay = format(parseISO(selectedDate), "EEEE d 'de' MMMM", { locale: es })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <CalendarDays className="text-gold-400" size={28} />
            Agendamiento
          </h1>
          <p className="page-subtitle">Gestión de citas y calendario de barberos</p>
        </div>
        <button id="btn-new-appointment" onClick={() => setShowNewModal(true)} className="btn-primary">
          <Plus size={16} />
          Nueva Cita
        </button>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-4 items-center">
        {/* Date navigator */}
        <div className="flex items-center gap-2">
          <button className="btn-secondary p-2"
                  onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), -1), 'yyyy-MM-dd'))}>
            <ChevronLeft size={16} />
          </button>
          <input type="date" value={selectedDate}
                 onChange={e => setSelectedDate(e.target.value)}
                 className="input w-40 text-center" />
          <button className="btn-secondary p-2"
                  onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}>
            <ChevronRight size={16} />
          </button>
          <button className="btn-ghost text-xs px-3 py-2 border border-dark-600 rounded-lg"
                  onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}>
            Hoy
          </button>
        </div>

        {/* Barber filter */}
        <select value={selectedBarber} onChange={e => setSelectedBarber(e.target.value)}
                className="select w-48" id="filter-barber">
          <option value="all">Todos los barberos</option>
          {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <div className="ml-auto flex gap-2">
          <button onClick={() => setViewMode('day')}
                  className={`btn-sm ${viewMode === 'day' ? 'btn-primary' : 'btn-secondary'}`}>
            Por barbero
          </button>
          <button onClick={() => setViewMode('list')}
                  className={`btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}>
            Lista
          </button>
        </div>
      </div>

      {/* Day View: per barber columns */}
      {viewMode === 'day' && (
        <div className="card">
          <h2 className="section-title mb-4 capitalize">{dateDisplay}</h2>
          <div className="overflow-x-auto">
            <div className="flex gap-4 min-w-max">
              {(selectedBarber === 'all' ? barbers : barbers.filter(b => b.id === selectedBarber)).map(barber => {
                const barberApts = appointments.filter(a => a.barberId === barber.id)
                return (
                  <div key={barber.id} className="w-52 flex-shrink-0">
                    {/* Barber header */}
                    <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-dark-700/50">
                      <div className="w-8 h-8 rounded-full bg-gold-600 flex items-center justify-center text-black font-bold text-sm">
                        {barber.name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{barber.name.split(' ')[0]}</div>
                        <div className="text-xs text-dark-500">{barberApts.length} cita{barberApts.length !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    {/* Appointments */}
                    <div className="space-y-2">
                      {barberApts.length === 0 ? (
                        <div className="p-3 rounded-lg border border-dashed border-dark-600 text-center text-xs text-dark-600">
                          Sin citas
                        </div>
                      ) : (
                        barberApts.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot)).map(apt => (
                          <div key={apt.id} className="p-3 rounded-lg bg-dark-700/70 border border-dark-600 hover:border-gold-800/50 transition-colors group">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-gold-400 font-bold text-xs">{apt.timeSlot}</span>
                              <span className={STATUS_CLASS[apt.status]}>{STATUS_LABEL[apt.status]}</span>
                            </div>
                            <div className="text-sm text-white font-medium truncate">{apt.clientName}</div>
                            <div className="text-xs text-dark-500 mt-0.5 truncate">
                              {apt.services?.map(s => s.service?.name).join(', ')}
                            </div>
                            {/* Quick status change */}
                            {apt.status === 'PENDING' && (
                              <div className="mt-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => changeStatus(apt.id, 'CONFIRMED')}
                                        className="btn-sm bg-blue-900/50 text-blue-400 border border-blue-800 flex-1 text-xs py-1">
                                  Confirmar
                                </button>
                                <button onClick={() => changeStatus(apt.id, 'CANCELLED')}
                                        className="btn-sm bg-red-900/30 text-red-500 border border-red-800 flex-1 text-xs py-1">
                                  Cancelar
                                </button>
                              </div>
                            )}
                            {apt.status === 'CONFIRMED' && (
                              <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => changeStatus(apt.id, 'IN_PROGRESS')}
                                        className="btn-sm bg-purple-900/50 text-purple-400 border border-purple-800 w-full text-xs py-1">
                                  Iniciar
                                </button>
                              </div>
                            )}
                            {apt.status === 'IN_PROGRESS' && (
                              <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Link href={`/pos?appointmentId=${apt.id}`}
                                      className="btn-primary w-full text-xs py-1 block text-center">
                                  Cobrar
                                </Link>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Cliente</th>
                <th>Barbero</th>
                <th>Servicio(s)</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-dark-500">Cargando...</td></tr>
              ) : appointments.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-dark-500">Sin citas para este día</td></tr>
              ) : (
                appointments.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot)).map(apt => (
                  <tr key={apt.id}>
                    <td className="text-gold-400 font-bold">{apt.timeSlot}</td>
                    <td>
                      <div className="font-medium text-white">{apt.clientName}</div>
                      <div className="text-xs text-dark-500">{apt.clientPhone}</div>
                    </td>
                    <td>{apt.barber?.name}</td>
                    <td className="max-w-xs truncate">{apt.services?.map(s => s.service?.name).join(', ')}</td>
                    <td><span className={STATUS_CLASS[apt.status]}>{STATUS_LABEL[apt.status]}</span></td>
                    <td>
                      <div className="flex gap-2">
                        {apt.status === 'IN_PROGRESS' && (
                          <Link href={`/pos?appointmentId=${apt.id}`} className="btn-primary btn-sm">
                            Cobrar
                          </Link>
                        )}
                        {apt.status === 'PENDING' && (
                          <>
                            <button onClick={() => changeStatus(apt.id, 'CONFIRMED')}
                                    className="btn-secondary btn-sm">Confirmar</button>
                            <button onClick={() => changeStatus(apt.id, 'CANCELLED')}
                                    className="btn-danger btn-sm">Cancelar</button>
                          </>
                        )}
                        {apt.status === 'CONFIRMED' && (
                          <button onClick={() => changeStatus(apt.id, 'IN_PROGRESS')}
                                  className="btn-secondary btn-sm">Iniciar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* New Appointment Modal */}
      {showNewModal && <NewAppointmentModal barbers={barbers} onClose={() => setShowNewModal(false)} onSave={() => { setShowNewModal(false); loadAppointments() }} />}
    </div>
  )
}

function NewAppointmentModal({ barbers, onClose, onSave }) {
  const [form, setForm] = useState({ clientName: '', clientPhone: '', barberId: '', date: format(new Date(), 'yyyy-MM-dd'), timeSlot: '', serviceIds: [], notes: '' })
  const [services, setServices] = useState([])
  const [availableSlots, setAvailableSlots] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetch('/api/services').then(r => r.json()).then(setServices) }, [])

  useEffect(() => {
    if (form.barberId && form.date) {
      fetch(`/api/appointments/available-slots?barberId=${form.barberId}&date=${form.date}`)
        .then(r => r.json()).then(d => setAvailableSlots(d.slots || []))
    }
  }, [form.barberId, form.date])

  const toggleService = (id) => {
    setForm(f => ({ ...f, serviceIds: f.serviceIds.includes(id) ? f.serviceIds.filter(s => s !== id) : [...f.serviceIds, id] }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.serviceIds.length) return toast.error('Selecciona al menos un servicio')
    if (!form.timeSlot) return toast.error('Selecciona una hora')
    setLoading(true)
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) { toast.success('Cita creada exitosamente'); onSave() }
    else { const d = await res.json(); toast.error(d.error || 'Error al crear cita') }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="modal-header">
          <h3 className="section-title">Nueva Cita</h3>
          <button onClick={onClose} className="btn-ghost p-2">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Nombre del cliente *</label>
                <input className="input" value={form.clientName} onChange={e => setForm(f => ({...f, clientName: e.target.value}))} required placeholder="Nombre completo" />
              </div>
              <div>
                <label className="input-label">Teléfono</label>
                <input className="input" value={form.clientPhone} onChange={e => setForm(f => ({...f, clientPhone: e.target.value}))} placeholder="3001234567" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Barbero *</label>
                <select className="select" value={form.barberId} onChange={e => setForm(f => ({...f, barberId: e.target.value, timeSlot: ''}))} required>
                  <option value="">Seleccionar barbero</option>
                  {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Fecha *</label>
                <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value, timeSlot: ''}))} required />
              </div>
            </div>

            {/* Servicios */}
            <div>
              <label className="input-label">Servicios *</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto no-scrollbar">
                {services.map(s => (
                  <button key={s.id} type="button" onClick={() => toggleService(s.id)}
                          className={`text-left p-2.5 rounded-lg border text-sm transition-all ${form.serviceIds.includes(s.id) ? 'border-gold-600 bg-gold-900/20 text-gold-400' : 'border-dark-600 bg-dark-700/50 text-dark-400 hover:border-dark-500'}`}>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs mt-0.5">${s.price.toLocaleString('es-CO')}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Slots */}
            {form.barberId && form.date && (
              <div>
                <label className="input-label">Hora disponible *</label>
                {availableSlots.length === 0 ? (
                  <p className="text-dark-500 text-sm">Sin horarios disponibles para este día</p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {availableSlots.map(slot => (
                      <button key={slot} type="button" onClick={() => setForm(f => ({...f, timeSlot: slot}))}
                              className={form.timeSlot === slot ? 'slot-selected' : 'slot-available'}>
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="input-label">Notas</label>
              <textarea className="input resize-none" rows={2} value={form.notes}
                        onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Observaciones opcionales" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : 'Crear Cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
