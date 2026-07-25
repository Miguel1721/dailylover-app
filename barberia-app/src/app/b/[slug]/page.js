'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Scissors, CalendarDays, Clock, User, Phone, CheckCircle2,
  ChevronRight, ArrowRight, Sparkles, LogIn, MapPin, Check, AlertCircle,
  Heart, Sparkle, Flame
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

export default function TenantPublicBookingPage({ params }) {
  const slug = params.slug

  // Configuración del negocio
  const [biz, setBiz] = useState({
    businessName: 'Cargando...',
    businessSubtitle: 'Gestión Barbería',
    logoUrl: null,
    businessPhone: '',
    businessAddress: '',
  })

  // Modo activo: 'BARBERIA' (Hombres) o 'PELUQUERIA' (Mujeres)
  const [activeCategory, setActiveCategory] = useState('BARBERIA')

  // Catálogos
  const [services, setServices] = useState([])
  const [barbers, setBarbers] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Selección del cliente
  const [selectedServices, setSelectedServices] = useState([])
  const [selectedBarber, setSelectedBarber] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [availableSlots, setAvailableSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Datos personales del cliente
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [notes, setNotes] = useState('')

  // Estado del flujo
  const [step, setStep] = useState(1) // 1: servicios, 2: profesional, 3: fecha/hora, 4: datos, 5: éxito
  const [submitting, setSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)

  const isWomen = activeCategory === 'PELUQUERIA'

  const getServiceImage = (id, name = '') => {
    const nid = (id + ' ' + name).toLowerCase()
    if (nid.includes('keratina')) return 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=400&q=80'
    if (nid.includes('planchado') || nid.includes('cepillado')) return 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=400&q=80'
    if (nid.includes('grafilado') || nid.includes('recto') || nid.includes('corte en v') || nid.includes('otros cortes')) return 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=400&q=80'
    if (nid.includes('premium')) return 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=400&q=80'
    if (nid.includes('barba')) return 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=400&q=80'
    if (nid.includes('cejas')) return 'https://images.unsplash.com/photo-1512864084360-7c0c4d0a0845?auto=format&fit=crop&w=400&q=80'
    return 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=400&q=80'
  }

  // Cargar datos del tenant
  useEffect(() => {
    setMounted(true)
    Promise.all([
      fetch(`/api/public/tenant?slug=${slug}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/public/services?slug=${slug}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/public/barbers?slug=${slug}`).then(r => r.ok ? r.json() : []),
    ]).then(([tenantData, servicesData, barbersData]) => {
      if (!tenantData) {
        setNotFound(true)
      } else {
        setBiz({
          businessName: tenantData.settings?.businessName || tenantData.name,
          businessSubtitle: tenantData.settings?.businessSubtitle || 'Gestión Barbería',
          logoUrl: tenantData.settings?.logoUrl || null,
          businessPhone: tenantData.settings?.businessPhone || '',
          businessAddress: tenantData.settings?.businessAddress || '',
        })
        setServices(Array.isArray(servicesData) ? servicesData : [])
        setBarbers(Array.isArray(barbersData) ? barbersData : [])
      }
      setLoading(false)
    }).catch(() => {
      setNotFound(true)
      setLoading(false)
    })
  }, [slug])

  // Buscar slots cuando cambia el profesional o la fecha
  useEffect(() => {
    if (selectedBarber && selectedDate) {
      setLoadingSlots(true)
      setSelectedSlot('')
      fetch(`/api/public/available-slots?slug=${slug}&barberId=${selectedBarber.id}&date=${selectedDate}`)
        .then(r => r.json())
        .then(res => {
          if (res.success && res.data) {
            const sched = res.data.scheduledSlots || []
            const booked = res.data.bookedSlots || []
            const mapped = sched.map(slot => ({
              time: slot,
              available: !booked.includes(slot)
            }))
            setAvailableSlots(mapped)
          } else {
            setAvailableSlots([])
          }
          setLoadingSlots(false)
        })
        .catch(() => {
          setAvailableSlots([])
          setLoadingSlots(false)
        })
    }
  }, [slug, selectedBarber, selectedDate])

  const toggleCategoryMode = (cat) => {
    setActiveCategory(cat)
    setSelectedServices([])
    setSelectedBarber(null)
    setSelectedDate('')
    setSelectedSlot('')
  }

  const toggleService = (svc) => {
    if (selectedServices.find(s => s.id === svc.id)) {
      setSelectedServices(selectedServices.filter(s => s.id !== svc.id))
    } else {
      setSelectedServices([...selectedServices, svc])
    }
  }

  const handleNextStep = () => {
    if (step === 1 && selectedServices.length === 0) {
      toast.error('Selecciona al menos un servicio')
      return
    }
    if (step === 2 && !selectedBarber) {
      toast.error(isWomen ? 'Selecciona una estilista' : 'Selecciona un barbero')
      return
    }
    if (step === 3 && !selectedSlot) {
      toast.error('Selecciona una hora disponible')
      return
    }
    setStep(s => s + 1)
  }

  const handleBooking = async (e) => {
    e.preventDefault()
    if (!clientName.trim() || !clientPhone.trim()) {
      toast.error('Por favor completa tu nombre y celular')
      return
    }
    setSubmitting(true)

    const payload = {
      slug,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      barberId: selectedBarber.id,
      serviceIds: selectedServices.map(s => s.id),
      date: selectedDate,
      timeSlot: selectedSlot,
      notes: notes.trim(),
    }

    try {
      const res = await fetch('/api/public/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setStep(5)
      } else {
        toast.error(data.error || 'No se pudo reservar el turno')
      }
    } catch {
      toast.error('Ocurrió un error en la conexión')
    } finally {
      setSubmitting(false)
    }
  }

  const totalAmount = selectedServices.reduce((acc, s) => acc + s.price, 0)
  const totalDuration = selectedServices.reduce((acc, s) => acc + s.durationMinutes, 0)
  const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

  const getNextDays = () => {
    const list = []
    const today = new Date()
    const options = { weekday: 'short', day: 'numeric', month: 'short' }
    for (let i = 0; i < 14; i++) {
      const d = new Date()
      d.setDate(today.getDate() + i)
      const dayOfWeek = d.getDay()
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const key = `${yyyy}-${mm}-${dd}`
      list.push({
        key,
        label: d.toLocaleDateString('es-CO', options),
        active: dayOfWeek !== 0,
      })
    }
    return list
  }

  // Filtrado por categoría
  const filteredServices = services.filter(s => {
    const cat = s.category || 'BARBERIA'
    return cat === activeCategory
  })

  const filteredBarbers = barbers.filter(b => {
    const cat = b.category || 'BARBERIA'
    return cat === activeCategory || cat === 'TODOS'
  })

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center gap-4">
        <div className={`w-12 h-12 rounded-full border-4 border-t-transparent animate-spin ${isWomen ? 'border-purple-500' : 'border-gold-500'}`} />
        <p className="text-dark-500 text-sm font-medium">Cargando portal de reservas...</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Barbería no encontrada</h1>
        <p className="text-dark-400 max-w-md mb-6">
          La barbería que estás buscando no existe o se encuentra inactiva. Verifica la dirección introducida.
        </p>
        <Link href="/login" className="btn bg-gold-500 text-black font-semibold hover:bg-gold-400 px-6 py-2.5 rounded-xl">
          Ir al Panel Principal
        </Link>
      </div>
    )
  }

  return (
    <div className={`min-h-screen text-white flex flex-col justify-between transition-colors duration-500 ${isWomen ? 'bg-[#0f0a17] selection:bg-purple-500 selection:text-white' : 'bg-dark-950 selection:bg-gold-500 selection:text-black'}`}>
      <Toaster position="top-right" reverseOrder={false} />

      {/* ── HEADER ── */}
      <header className={`h-16 border-b sticky top-0 z-40 px-4 sm:px-6 backdrop-blur-md transition-colors duration-500 ${isWomen ? 'border-purple-900/40 bg-[#160d24]/80' : 'border-dark-700 bg-dark-900/60'}`}>
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            {biz.logoUrl ? (
              <img src={biz.logoUrl} alt="Logo" className="w-9 h-9 rounded-lg object-contain bg-white p-0.5" />
            ) : (
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-500 ${isWomen ? 'bg-gradient-to-tr from-purple-600 via-pink-500 to-purple-400' : 'bg-gradient-gold'}`}>
                {isWomen ? <Sparkles size={16} className="text-white" /> : <Scissors size={16} className="text-black" />}
              </div>
            )}
            <div>
              <div className="font-bold text-white text-sm sm:text-base leading-tight">{biz.businessName}</div>
              <div className={`text-xs ${isWomen ? 'text-purple-300' : 'text-dark-500'}`}>{isWomen ? 'Peluquería & Estética Femenina' : biz.businessSubtitle}</div>
            </div>
          </div>

          <Link href="/login" id="btn-portal-login" className={`btn btn-sm gap-1.5 rounded-xl font-semibold transition-colors duration-300 ${isWomen ? 'bg-purple-950/80 text-purple-200 hover:bg-purple-900 border border-purple-800/60' : 'bg-dark-800 text-white hover:bg-dark-700 border border-dark-700'}`}>
            <LogIn size={14} />
            Ingresar
          </Link>
        </div>
      </header>

      {/* ── CONMUTADOR DE CATEGORÍA (BARBERÍA VS PELUQUERÍA MUJERES) ── */}
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 pt-6">
        <div className="flex items-center justify-center gap-2 p-1.5 rounded-2xl bg-dark-900/90 border border-dark-800 shadow-xl max-w-md mx-auto">
          <button
            onClick={() => toggleCategoryMode('BARBERIA')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-300 ${!isWomen ? 'bg-gradient-gold text-black shadow-lg shadow-gold-500/20' : 'text-dark-400 hover:text-white'}`}
          >
            <Scissors size={16} /> Barbería (Hombres)
          </button>
          <button
            onClick={() => toggleCategoryMode('PELUQUERIA')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-300 ${isWomen ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-purple-500 text-white shadow-lg shadow-purple-600/30' : 'text-dark-400 hover:text-white'}`}
          >
            <Sparkles size={16} /> Peluquería (Mujeres)
          </button>
        </div>
      </div>

      {/* ── HERO BANNER PRINCIPAL ── */}
      {step === 1 && (
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 pt-6">
          <div className={`relative overflow-hidden rounded-3xl border p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl transition-all duration-500 ${isWomen ? 'border-purple-800/40 bg-gradient-to-br from-[#1e1035] via-[#140b24] to-[#25103a]' : 'border-dark-800 bg-gradient-to-br from-dark-900 via-dark-950 to-dark-900'}`}>
            <div className={`absolute right-0 top-0 -z-10 h-80 w-80 rounded-full blur-3xl transition-colors duration-500 ${isWomen ? 'bg-purple-500/15' : 'bg-gold-500/5'}`} />

            <div className="flex-1 space-y-4 text-center md:text-left">
              <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors duration-500 ${isWomen ? 'bg-purple-500/15 border border-purple-500/30 text-purple-300' : 'bg-gold-500/10 border border-gold-500/20 text-gold-400'}`}>
                <Sparkles size={13} /> {isWomen ? 'Peluquería & Belleza Femenina' : 'Tradición & Estilo'}
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                {biz.businessName}
              </h1>
              <p className="text-dark-300 text-sm sm:text-base max-w-lg leading-relaxed">
                {isWomen
                  ? 'Reserva tus servicios de peluquería, cepillado, cortes estilizados, planchado y keratinas en línea. Atención personalizada de alta gama.'
                  : 'Agenda tu turno en línea en minutos. Selecciona a tu barbero de confianza y prepárate para una experiencia de cuidado masculino excepcional.'
                }
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs text-dark-400 pt-2">
                {biz.businessPhone && (
                  <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${isWomen ? 'bg-purple-950/40 border-purple-800/40 text-purple-200' : 'bg-dark-800/40 border-dark-700/40'}`}>
                    <Phone size={13} className={isWomen ? 'text-purple-400' : 'text-gold-400'} /> +57 {biz.businessPhone}
                  </span>
                )}
                {biz.businessAddress && (
                  <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${isWomen ? 'bg-purple-950/40 border-purple-800/40 text-purple-200' : 'bg-dark-800/40 border-dark-700/40'}`}>
                    <MapPin size={13} className={isWomen ? 'text-purple-400' : 'text-gold-400'} /> {biz.businessAddress}
                  </span>
                )}
              </div>
            </div>

            <div className="relative">
              <div className={`w-32 h-32 sm:w-44 sm:h-44 rounded-full p-1 shadow-2xl animate-pulse transition-colors duration-500 ${isWomen ? 'bg-gradient-to-tr from-purple-500 via-pink-500 to-purple-400' : 'bg-gradient-gold'}`}>
                <div className={`w-full h-full rounded-full flex items-center justify-center transition-colors duration-500 ${isWomen ? 'bg-[#180e2b]' : 'bg-dark-900'}`}>
                  {isWomen ? <Sparkles size={56} className="text-purple-300" /> : <Scissors size={56} className="text-gold-400" />}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PASOS DE RESERVA ── */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 flex-1">
        {step < 5 && (
          <div className="mb-8 overflow-x-auto no-scrollbar">
            <div className={`flex items-center justify-between min-w-[500px] border-b pb-4 transition-colors duration-500 ${isWomen ? 'border-purple-900/40' : 'border-dark-800'}`}>
              {[
                { n: 1, title: 'Servicios', icon: isWomen ? Sparkles : Scissors },
                { n: 2, title: isWomen ? 'Estilista' : 'Barbero', icon: User },
                { n: 3, title: 'Fecha & Hora', icon: CalendarDays },
                { n: 4, title: 'Confirmar', icon: CheckCircle2 },
              ].map((s) => {
                const isActive = step === s.n
                const isDone = step > s.n
                return (
                  <div key={s.n} className={`flex items-center gap-2 ${isActive ? isWomen ? 'text-purple-300 font-bold' : 'text-gold-400 font-bold' : isDone ? 'text-white' : 'text-dark-500'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors ${isActive ? isWomen ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white font-extrabold shadow-lg shadow-purple-500/20' : 'bg-gold-500 text-black font-extrabold shadow-lg shadow-gold-500/20' : isDone ? isWomen ? 'bg-purple-950 text-purple-400' : 'bg-dark-700 text-gold-400' : 'bg-dark-800 text-dark-500'}`}>
                      {isDone ? <Check size={14} /> : s.n}
                    </div>
                    <span className="text-sm">{s.title}</span>
                    {s.n < 4 && <ChevronRight size={14} className="text-dark-700 mx-2" />}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* PASO 1: SERVICIOS */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {isWomen ? 'Servicios de Peluquería & Estética' : 'Servicios de Barbería'}
              </h2>
              <p className="text-dark-400 text-sm">Puedes seleccionar varios servicios para una sola cita.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredServices.map((svc) => {
                const isSelected = selectedServices.some(s => s.id === svc.id)
                const img = getServiceImage(svc.id, svc.name)
                return (
                  <div
                    key={svc.id}
                    onClick={() => toggleService(svc)}
                    className={`group cursor-pointer rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col justify-between ${
                      isSelected
                        ? isWomen
                          ? 'border-purple-400 bg-purple-950/40 ring-2 ring-purple-400/80 shadow-xl shadow-purple-950/50'
                          : 'border-gold-500 bg-gold-500/10 ring-1 ring-gold-500 shadow-xl'
                        : isWomen
                          ? 'border-purple-900/30 bg-[#160d24]/90 hover:border-purple-700/50'
                          : 'border-dark-800 bg-dark-900 hover:border-dark-700'
                    }`}
                  >
                    <div className="h-40 w-full relative overflow-hidden bg-dark-800">
                      <img src={img} alt={svc.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#160d24] via-transparent to-transparent" />
                      <div className="absolute top-3 right-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          isSelected
                            ? isWomen ? 'bg-purple-500 text-white' : 'bg-gold-500 text-black'
                            : 'bg-dark-900/80 text-dark-400 border border-dark-700'
                        }`}>
                          {isSelected ? <Check size={14} /> : isWomen ? <Sparkles size={12} /> : <Scissors size={12} />}
                        </div>
                      </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className={`font-bold text-lg text-white transition-colors ${isWomen ? 'group-hover:text-purple-300' : 'group-hover:text-gold-400'}`}>
                          {svc.name}
                        </div>
                        <p className="text-xs text-dark-400 mt-1 line-clamp-2">{svc.description || 'Atención personalizada con productos de alta gama.'}</p>
                      </div>
                      <div className={`mt-4 pt-3 border-t flex items-center justify-between ${isWomen ? 'border-purple-900/40' : 'border-dark-800'}`}>
                        <div className={`font-extrabold text-lg ${isWomen ? 'text-purple-300' : 'text-gold-400'}`}>{fmt(svc.price)}</div>
                        <div className="text-xs text-dark-400 flex items-center gap-1">
                          <Clock size={12} /> {svc.durationMinutes} min
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {filteredServices.length === 0 && (
                <div className="col-span-full py-12 text-center text-dark-500 border border-dashed border-dark-800 rounded-2xl">
                  <Sparkles size={36} className="mx-auto mb-2 opacity-40 text-purple-400" />
                  <p className="text-sm">No hay servicios disponibles en esta categoría.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PASO 2: BARBERO / ESTILISTA */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {isWomen ? 'Elige a tu Estilista' : 'Elige a tu Barbero'}
              </h2>
              <p className="text-dark-400 text-sm">Selecciona al profesional de tu preferencia.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredBarbers.map((b) => {
                const isSelected = selectedBarber?.id === b.id
                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBarber(b)}
                    className={`cursor-pointer rounded-2xl border p-5 transition-all flex items-center gap-4 ${
                      isSelected
                        ? isWomen
                          ? 'border-purple-400 bg-purple-950/40 ring-2 ring-purple-400/80 shadow-xl'
                          : 'border-gold-500 bg-gold-500/10 ring-1 ring-gold-500 shadow-xl'
                        : isWomen
                          ? 'border-purple-900/30 bg-[#160d24] hover:border-purple-700/50'
                          : 'border-dark-800 bg-dark-900 hover:border-dark-700'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-xl border flex items-center justify-center font-bold text-xl overflow-hidden shrink-0 ${
                      isWomen ? 'bg-purple-950 border-purple-800/60 text-purple-300' : 'bg-dark-800 border-dark-700 text-gold-400'
                    }`}>
                      {b.photoUrl ? (
                        <img src={b.photoUrl} alt={b.name} className="w-full h-full object-cover" />
                      ) : (
                        b.name.charAt(0)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-base truncate">{b.name}</div>
                      <div className={`text-xs font-medium truncate ${isWomen ? 'text-purple-300' : 'text-gold-400/80'}`}>{b.specialty}</div>
                    </div>
                  </div>
                )
              })}
              {filteredBarbers.length === 0 && (
                <div className="col-span-full py-12 text-center text-dark-500 border border-dashed border-dark-800 rounded-2xl">
                  <User size={36} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No hay profesionales registrados en esta categoría.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PASO 3: FECHA Y HORA */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Selecciona Fecha y Hora</h2>
              <p className="text-dark-400 text-sm">Mostrando turnos disponibles para {selectedBarber?.name}.</p>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-dark-300">1. Selecciona el día</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {getNextDays().map((d) => {
                  const isSelected = selectedDate === d.key
                  return (
                    <button
                      key={d.key}
                      disabled={!d.active}
                      onClick={() => setSelectedDate(d.key)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        isSelected
                          ? isWomen ? 'border-purple-400 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold' : 'border-gold-500 bg-gold-500 text-black font-bold'
                          : d.active
                            ? isWomen ? 'border-purple-900/40 bg-[#160d24] text-white hover:border-purple-700' : 'border-dark-800 bg-dark-900 text-white hover:border-dark-700'
                            : 'border-dark-800/40 bg-dark-950 text-dark-600 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <div className="text-xs uppercase font-semibold">{d.label.split(',')[0]}</div>
                      <div className="text-sm font-bold mt-0.5">{d.label.split(',')[1]}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedDate && (
              <div className={`space-y-4 pt-4 border-t ${isWomen ? 'border-purple-900/40' : 'border-dark-800'}`}>
                <label className="block text-sm font-medium text-dark-300">2. Selecciona la hora</label>
                {loadingSlots ? (
                  <div className="p-8 text-center text-dark-500 flex items-center justify-center gap-2">
                    <div className={`w-5 h-5 rounded-full border-2 border-t-transparent animate-spin ${isWomen ? 'border-purple-400' : 'border-gold-500'}`} />
                    Buscando horarios disponibles...
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className={`p-6 rounded-xl border text-center text-dark-400 ${isWomen ? 'border-purple-900/40 bg-[#160d24]' : 'border-dark-800 bg-dark-900'}`}>
                    No hay horarios disponibles para esta fecha. Intenta con otro día.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {availableSlots.map((slot) => {
                      const isSelected = selectedSlot === slot.time
                      return (
                        <button
                          key={slot.time}
                          disabled={!slot.available}
                          onClick={() => setSelectedSlot(slot.time)}
                          className={`py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all ${
                            isSelected
                              ? isWomen ? 'border-purple-400 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold shadow-lg shadow-purple-500/20' : 'border-gold-500 bg-gold-500 text-black font-bold shadow-lg shadow-gold-500/20'
                              : slot.available
                                ? isWomen ? 'border-purple-900/40 bg-[#160d24] text-white hover:border-purple-700 hover:text-purple-300' : 'border-dark-800 bg-dark-900 text-white hover:border-dark-700 hover:text-gold-400'
                                : 'border-dark-800/40 bg-dark-950 text-dark-600 cursor-not-allowed line-through opacity-40'
                          }`}
                        >
                          {slot.time}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PASO 4: DATOS PERSONALES */}
        {step === 4 && (
          <form onSubmit={handleBooking} className={`max-w-xl mx-auto space-y-6 p-6 sm:p-8 rounded-2xl border shadow-2xl transition-colors duration-500 ${isWomen ? 'bg-[#160d24] border-purple-900/60' : 'bg-dark-900 border-dark-800'}`}>
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Completa tus datos</h2>
              <p className="text-dark-400 text-sm">Enviaremos la confirmación a tu número de WhatsApp.</p>
            </div>

            <div className={`p-4 rounded-xl border space-y-2 text-xs sm:text-sm ${isWomen ? 'bg-[#0f0a17] border-purple-900/40' : 'bg-dark-950 border-dark-800'}`}>
              <div className="flex justify-between text-dark-400">
                <span>{isWomen ? 'Estilista:' : 'Barbero:'}</span>
                <span className="text-white font-semibold">{selectedBarber?.name}</span>
              </div>
              <div className="flex justify-between text-dark-400">
                <span>Fecha & Hora:</span>
                <span className={`font-semibold ${isWomen ? 'text-purple-300' : 'text-gold-400'}`}>{selectedDate} a las {selectedSlot}</span>
              </div>
              <div className="flex justify-between text-dark-400">
                <span>Servicios:</span>
                <span className="text-white font-semibold text-right max-w-[200px] truncate">{selectedServices.map(s => s.name).join(', ')}</span>
              </div>
              <div className={`border-t pt-2 flex justify-between font-bold text-base text-white ${isWomen ? 'border-purple-900/40' : 'border-dark-800'}`}>
                <span>Total a pagar:</span>
                <span className={isWomen ? 'text-purple-300' : 'text-gold-400'}>{fmt(totalAmount)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-dark-400 mb-1.5">Nombre Completo *</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-3.5 text-dark-500" />
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ej. María Gómez"
                    className={`w-full border rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none transition-colors ${
                      isWomen ? 'bg-[#0f0a17] border-purple-900/60 focus:border-purple-400' : 'bg-dark-950 border-dark-700 focus:border-gold-500'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-dark-400 mb-1.5">Teléfono Celular (WhatsApp) *</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-3.5 text-dark-500" />
                  <input
                    type="tel"
                    required
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="Ej. 3001234567"
                    className={`w-full border rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none transition-colors ${
                      isWomen ? 'bg-[#0f0a17] border-purple-900/60 focus:border-purple-400' : 'bg-dark-950 border-dark-700 focus:border-gold-500'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-dark-400 mb-1.5">Notas adicionales (opcional)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="¿Alguna especificación para tu servicio?"
                  className={`w-full border rounded-xl p-3 text-white text-sm focus:outline-none transition-colors ${
                    isWomen ? 'bg-[#0f0a17] border-purple-900/60 focus:border-purple-400' : 'bg-dark-950 border-dark-700 focus:border-gold-500'
                  }`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-3.5 px-4 font-bold rounded-xl shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-2 ${
                isWomen
                  ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-purple-500 text-white shadow-purple-600/30'
                  : 'bg-gradient-gold text-black'
              }`}
            >
              {submitting ? (
                <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>
                  Confirmar Reserva <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* PASO 5: ÉXITO */}
        {step === 5 && (
          <div className={`max-w-md mx-auto text-center space-y-6 p-8 rounded-3xl border shadow-2xl my-8 transition-colors duration-500 ${isWomen ? 'bg-[#160d24] border-purple-500/40' : 'bg-dark-900 border-gold-500/30'}`}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto border ${isWomen ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' : 'bg-gold-500/10 text-gold-400 border-gold-500/20'}`}>
              <CheckCircle2 size={48} />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-extrabold text-white">¡Cita Reservada!</h2>
              <p className="text-dark-400 text-sm">
                Gracias <span className="text-white font-semibold">{clientName}</span>, tu turno ha sido agendado exitosamente.
              </p>
            </div>

            <div className={`p-4 rounded-2xl border text-left space-y-2 text-xs sm:text-sm ${isWomen ? 'bg-[#0f0a17] border-purple-900/40' : 'bg-dark-950 border-dark-800'}`}>
              <div className="flex justify-between text-dark-400">
                <span>Establecimiento:</span>
                <span className="text-white font-semibold">{biz.businessName}</span>
              </div>
              <div className="flex justify-between text-dark-400">
                <span>{isWomen ? 'Estilista:' : 'Barbero:'}</span>
                <span className="text-white font-semibold">{selectedBarber?.name}</span>
              </div>
              <div className="flex justify-between text-dark-400">
                <span>Fecha:</span>
                <span className={`font-semibold ${isWomen ? 'text-purple-300' : 'text-gold-400'}`}>{selectedDate}</span>
              </div>
              <div className="flex justify-between text-dark-400">
                <span>Hora:</span>
                <span className={`font-semibold ${isWomen ? 'text-purple-300' : 'text-gold-400'}`}>{selectedSlot}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setStep(1)
                setSelectedServices([])
                setSelectedBarber(null)
                setSelectedDate('')
                setSelectedSlot('')
                setClientName('')
                setClientPhone('')
                setNotes('')
              }}
              className="w-full py-3 bg-dark-800 hover:bg-dark-700 text-white font-semibold rounded-xl transition-colors border border-dark-700 text-sm"
            >
              Reservar otra cita
            </button>
          </div>
        )}
      </main>

      {/* ── BARRA INFERIOR DE NAVEGACIÓN Y TOTAL ── */}
      {step < 4 && (
        <div className={`sticky bottom-0 z-30 backdrop-blur-md border-t p-4 transition-colors duration-500 ${isWomen ? 'bg-[#160d24]/95 border-purple-900/40' : 'bg-dark-900/90 border-dark-800'}`}>
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {step > 1 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-700 text-white text-sm font-semibold transition-colors border border-dark-700"
                >
                  Atrás
                </button>
              )}
              {selectedServices.length > 0 && (
                <div className="hidden sm:block text-xs text-dark-400">
                  Total seleccionados: <span className={`font-bold text-sm ${isWomen ? 'text-purple-300' : 'text-gold-400'}`}>{fmt(totalAmount)}</span> ({totalDuration} min)
                </div>
              )}
            </div>

            <button
              onClick={handleNextStep}
              className={`px-6 py-3 font-extrabold rounded-xl shadow-lg hover:brightness-110 transition-all flex items-center gap-2 text-sm ${
                isWomen
                  ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-purple-500 text-white shadow-purple-600/30'
                  : 'bg-gradient-gold text-black shadow-gold-500/20'
              }`}
            >
              Siguiente <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <footer className={`border-t py-6 text-center text-xs text-dark-500 transition-colors duration-500 ${isWomen ? 'border-purple-900/40 bg-[#0c0814]' : 'border-dark-800 bg-dark-950'}`}>
        <p>© {new Date().getFullYear()} {biz.businessName}. Todos los derechos reservados.</p>
      </footer>
    </div>
  )
}
