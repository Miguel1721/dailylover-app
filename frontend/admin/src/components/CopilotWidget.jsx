import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Bot, User, Send, X, MessageSquare, ArrowRight, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react'
import RegistrarNovedadModal from './RegistrarNovedadModal'

const API = (typeof window !== 'undefined' && (window.location.origin.includes('daily') || window.location.origin.includes('agentesia'))) ? window.location.origin : 'https://daily-lover.agentesia.cloud'

export default function CopilotWidget() {
  const { token, user, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      text: '¡Hola! Soy tu Copiloto IA de Daily Lover. Conozco todos los manuales y procesos operativos de la plataforma, y puedo ayudarte a resolver dudas o ejecutar acciones directamente.',
      suggestions: [
        '¿Cómo funciona la entrevista clínica y el radar?',
        '¿Cuál es el protocolo de CS para agendar citas?',
        '¿Cómo aprueba María Paula los matches?',
        '¿Cómo se gestionan reembolsos y finanzas?',
        'Crear un nuevo evento',
        'Agregar un nuevo empleado',
        'Registrar novedad de cliente'
      ],
      actions: [
        { target: '/cs-dashboard', label: '🎧 Mesa de Control CS' },
        { target: '/matchmaking/entrevista', label: '🎙️ Entrevista Clínica' },
        { target: '/matchmaking/mis-matches', label: '💖 Mis Matches' }
      ]
    }
  ])
  const [loading, setLoading] = useState(false)
  
  // Guided flow state
  // 'idle', 'create_event_name', 'create_event_date', 'create_event_capacity', 'create_event_price', 'create_event_confirm',
  // 'create_emp_name', 'create_emp_role', 'create_emp_salary', 'create_emp_email', 'create_emp_phone', 'create_emp_confirm'
  const [flow, setFlow] = useState('idle')
  const [eventData, setEventData] = useState({ name: '', date: '', location: 'Sede Principal', format: 'Social Mixer', capacity: '', price: '' })
  const [empData, setEmpData] = useState({ full_name: '', role: '', base_salary: '', email: '', phone: '', contract_type: 'nomina' })

  // Modal para novedad
  const [modalNovedadOpen, setModalNovedadOpen] = useState(false)

  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading])

  const addMessage = (sender, text, suggestions = null, actions = null) => {
    setMessages(prev => [...prev, { id: Date.now(), sender, text, suggestions, actions }])
  }

  // Ejecución de acciones interactivas del chatbot
  const handleActionClick = (target) => {
    if (!target) return

    if (target === 'action:open_novedad_modal') {
      setModalNovedadOpen(true)
      addMessage('assistant', 'Abriendo el modal para registrar novedad de cliente...')
      return
    }

    if (target === 'action:create_event') {
      if (!hasPermission('eventos', 'create')) {
        addMessage('assistant', 'Tu rol no cuenta con permisos para crear eventos.')
        return
      }
      setFlow('create_event_name')
      addMessage('assistant', 'Iniciando creación de evento. ¿Cuál es el NOMBRE del nuevo evento?')
      return
    }

    if (target === 'action:create_employee') {
      if (!hasPermission('empleados', 'create')) {
        addMessage('assistant', 'Tu rol no cuenta con permisos para agregar empleados.')
        return
      }
      setFlow('create_emp_name')
      addMessage('assistant', 'Iniciando registro de personal. ¿Cuál es el NOMBRE completo del nuevo empleado?')
      return
    }

    // Si es una ruta interna del panel
    if (target.startsWith('/')) {
      navigate(target)
      addMessage('assistant', `Navegando a: ${target}`)
    }
  }

  const handleSend = async (textToSend) => {
    const text = textToSend || input
    if (!text.trim()) return
    
    if (!textToSend) {
      setInput('')
    }
    
    addMessage('user', text)
    setLoading(true)

    try {
      // 1. Check if we are in a guided flow
      if (flow !== 'idle') {
        await handleGuidedFlow(text)
        return
      }

      // 2. Comandos directos locales
      const lower = text.toLowerCase().trim()
      
      if (lower === 'crear un nuevo evento' || lower === 'crear evento' || lower === 'nuevo evento') {
        if (!hasPermission('eventos', 'create')) {
          addMessage('assistant', 'Lo siento, tu rol no tiene permisos para crear eventos en el sistema.')
          setLoading(false)
          return
        }
        setFlow('create_event_name')
        addMessage('assistant', 'Excelente. Iniciemos el flujo guiado. ¿Cuál es el NOMBRE del nuevo evento?')
        setLoading(false)
        return
      }

      if (lower === 'agregar un nuevo empleado' || lower === 'agregar empleado' || lower === 'nuevo empleado' || lower === 'crear empleado') {
        if (!hasPermission('empleados', 'create')) {
          addMessage('assistant', 'Lo siento, tu rol no tiene permisos para agregar personal o crear empleados en el sistema.')
          setLoading(false)
          return
        }
        setFlow('create_emp_name')
        addMessage('assistant', 'Excelente. Iniciemos el flujo guiado. ¿Cuál es el NOMBRE completo del nuevo empleado?')
        setLoading(false)
        return
      }

      if (lower.includes('registrar novedad') || lower.includes('nueva novedad')) {
        setModalNovedadOpen(true)
        addMessage('assistant', 'He abierto el formulario para registrar la novedad de cliente.', null, [
          { target: '/cs-dashboard', label: '🎧 Ir a Mesa de Control CS' }
        ])
        setLoading(false)
        return
      }

      // 3. Consultar al Copiloto Inteligente con todo el Manual y Capacitación
      const res = await fetch(`${API}/api/v1/admin/copilot-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: text,
          role: user?.role_name || user?.role || 'Personal',
          history: messages.slice(-6).map(m => ({ sender: m.sender, text: m.text }))
        })
      })

      if (res.ok) {
        const data = await res.json()
        addMessage('assistant', data.reply || 'Aquí tienes la información solicitada.', null, data.actions || [])
      } else {
        // Fallback local en caso de error de red
        addMessage(
          'assistant',
          'Puedo ayudarte con cualquier proceso de Daily Lover: entrevistas clínicas, asignación de mesas con restaurantes aliados, aprobación de matches y finanzas. ¿Hacia dónde deseas dirigirte?',
          null,
          [
            { target: '/cs-dashboard', label: '🎧 Mesa de Control CS' },
            { target: '/matchmaking/entrevista', label: '🎙️ Entrevista Clínica' },
            { target: '/matchmaking/mis-matches', label: '💖 Mis Matches' },
            { target: '/matchmaking/supervision-maria', label: '🔒 Supervisión María' }
          ]
        )
      }

    } catch (err) {
      console.error(err)
      addMessage('assistant', 'Ocurrió un error al procesar tu mensaje. Por favor intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleGuidedFlow = async (text) => {
    try {
      // ─── EVENT FLOW ───
      if (flow === 'create_event_name') {
        setEventData(prev => ({ ...prev, name: text }))
        setFlow('create_event_date')
        addMessage('assistant', `Nombre del evento: "${text}".\n¿Cuál es la FECHA y HORA? (Por favor usa el formato AAAA-MM-DDTHH:MM, ej: 2026-08-15T19:00)`)
      }
      else if (flow === 'create_event_date') {
        setEventData(prev => ({ ...prev, date: text }))
        setFlow('create_event_capacity')
        addMessage('assistant', `Fecha del evento: "${text}".\n¿Cuál es la CAPACIDAD máxima de asistentes? (Ej: 20)`)
      }
      else if (flow === 'create_event_capacity') {
        const capacity = parseInt(text)
        if (isNaN(capacity) || capacity <= 0) {
          addMessage('assistant', 'La capacidad debe ser un número entero positivo. Ingresa la capacidad nuevamente:')
          return
        }
        setEventData(prev => ({ ...prev, capacity }))
        setFlow('create_event_price')
        addMessage('assistant', `Capacidad: ${capacity} personas.\n¿Cuál es el PRECIO del ticket en COP? (Ej: 150000)`)
      }
      else if (flow === 'create_event_price') {
        const price = parseFloat(text)
        if (isNaN(price) || price < 0) {
          addMessage('assistant', 'El precio debe ser un número positivo. Ingresa el precio nuevamente:')
          return
        }
        const updatedData = { ...eventData, price }
        setEventData(updatedData)
        setFlow('create_event_confirm')
        addMessage('assistant', `Resumen del nuevo evento:\n- Nombre: ${updatedData.name}\n- Fecha: ${updatedData.date}\n- Capacidad: ${updatedData.capacity} personas\n- Precio: COP ${updatedData.price.toLocaleString('es-CO')}\n\n¿Deseas CREAR el evento? Escribe "si" para confirmar o "no" para cancelar.`)
      }
      else if (flow === 'create_event_confirm') {
        if (text.toLowerCase().includes('si') || text.toLowerCase().includes('confirmar')) {
          addMessage('assistant', 'Procesando creación del evento con el API de Daily Lover...')
          
          const res = await fetch(`${API}/api/v1/admin/events`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              name: eventData.name,
              date: eventData.date,
              location: eventData.location,
              format: eventData.format,
              capacity: Number(eventData.capacity),
              price: Number(eventData.price)
            })
          })
          
          if (res.ok) {
            addMessage('assistant', `🎉 ¡Éxito! El evento "${eventData.name}" ha sido creado con éxito.`, null, [
              { target: '/eventos', label: '🎟️ Ver en Módulo Eventos' }
            ])
          } else {
            const errData = await res.json().catch(() => ({}))
            addMessage('assistant', `❌ Error al crear evento: ${errData.detail || 'Error de parámetros.'}`)
          }
        } else {
          addMessage('assistant', 'Creación de evento cancelada.')
        }
        setFlow('idle')
      }
      
      // ─── EMPLOYEE FLOW ───
      else if (flow === 'create_emp_name') {
        setEmpData(prev => ({ ...prev, full_name: text }))
        setFlow('create_emp_role')
        addMessage('assistant', `Nombre del empleado: "${text}".\n¿Cuál es su CARGO o ROL de trabajo? (Ej: Diseñador, Coordinador)`)
      }
      else if (flow === 'create_emp_role') {
        setEmpData(prev => ({ ...prev, role: text }))
        setFlow('create_emp_salary')
        addMessage('assistant', `Cargo: "${text}".\n¿Cuál es su SALARIO BASE mensual en COP? (Ej: 2200000)`)
      }
      else if (flow === 'create_emp_salary') {
        const salary = parseFloat(text)
        if (isNaN(salary) || salary <= 0) {
          addMessage('assistant', 'El salario debe ser un número positivo. Ingresa el salario nuevamente:')
          return
        }
        setEmpData(prev => ({ ...prev, base_salary: salary }))
        setFlow('create_emp_email')
        addMessage('assistant', `Salario base: COP ${salary.toLocaleString('es-CO')}.\n¿Cuál es su CORREO electrónico corporativo?`)
      }
      else if (flow === 'create_emp_email') {
        if (!text.includes('@')) {
          addMessage('assistant', 'Ingresa un correo electrónico válido (debe contener "@"):')
          return
        }
        setEmpData(prev => ({ ...prev, email: text }))
        setFlow('create_emp_phone')
        addMessage('assistant', `Correo: "${text}".\n¿Cuál es su número de TELÉFONO de contacto?`)
      }
      else if (flow === 'create_emp_phone') {
        const updatedEmp = { ...empData, phone: text }
        setEmpData(updatedEmp)
        setFlow('create_emp_confirm')
        addMessage('assistant', `Resumen del nuevo empleado:\n- Nombre: ${updatedEmp.full_name}\n- Cargo: ${updatedEmp.role}\n- Salario: COP ${updatedEmp.base_salary.toLocaleString('es-CO')}\n- Correo: ${updatedEmp.email}\n- Teléfono: ${updatedEmp.phone}\n\n¿Deseas REGISTRAR al empleado? Escribe "si" para confirmar o "no" para cancelar.`)
      }
      else if (flow === 'create_emp_confirm') {
        if (text.toLowerCase().includes('si') || text.toLowerCase().includes('confirmar')) {
          addMessage('assistant', 'Procesando registro en el libro de personal de trabajo...')
          
          const res = await fetch(`${API}/api/v1/admin/employees`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              full_name: empData.full_name,
              role: empData.role,
              phone: empData.phone,
              email: empData.email,
              base_salary: Number(empData.base_salary),
              contract_type: empData.contract_type
            })
          })
          
          if (res.ok) {
            addMessage('assistant', `🎉 ¡Éxito! El empleado "${empData.full_name}" ha sido agregado con éxito al sistema.`, null, [
              { target: '/empleados', label: '👥 Ver Lista de Empleados' }
            ])
          } else {
            const errData = await res.json().catch(() => ({}))
            addMessage('assistant', `❌ Error al registrar empleado: ${errData.detail || 'Falta de permisos o correo duplicado.'}`)
          }
        } else {
          addMessage('assistant', 'Registro de empleado cancelado.')
        }
        setFlow('idle')
      }
    } catch (err) {
      console.error(err)
      addMessage('assistant', 'Ocurrió un error durante la ejecución del comando guiado.')
      setFlow('idle')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Botón flotante para abrir chat */}
      <button className="copilot-trigger" aria-label="Abrir Copiloto IA" onClick={() => setIsOpen(!isOpen)} title="Copiloto IA">
        <Bot size={24} />
      </button>

      {/* Ventana del chat */}
      {isOpen && (
        <div className="copilot-window" style={{ width: '420px', maxWidth: '95vw', height: '540px' }}>
          <div className="copilot-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bot size={20} />
              <div>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Copiloto IA</span>
                <span className="copilot-badge">{user?.role_name || user?.role || 'Personal'}</span>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'white', border: 'none' }} onClick={() => setIsOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <div className="copilot-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`copilot-msg ${msg.sender}`} style={{ whiteSpace: 'pre-line' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  {msg.sender === 'assistant' ? (
                    <Bot size={15} style={{ marginTop: 2, color: 'var(--color-primary-light)', flexShrink: 0 }} />
                  ) : (
                    <User size={15} style={{ marginTop: 2, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1 }}>{msg.text}</div>
                </div>

                {/* Botones de Acción Interactiva */}
                {msg.actions && msg.actions.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    {msg.actions.map((act, aIdx) => (
                      <button
                        key={aIdx}
                        onClick={() => handleActionClick(act.target)}
                        style={{
                          background: 'rgba(150, 21, 0, 0.25)',
                          border: '1px solid rgba(150, 21, 0, 0.4)',
                          borderRadius: 6,
                          color: '#fff',
                          padding: '5px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(150, 21, 0, 0.45)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(150, 21, 0, 0.25)'}
                      >
                        <span>{act.label}</span>
                        <ArrowRight size={11} />
                      </button>
                    ))}
                  </div>
                )}

                {/* Sugerencias de preguntas */}
                {msg.suggestions && (
                  <div className="copilot-suggestions">
                    {msg.suggestions.map((sug, sIdx) => (
                      <button key={sIdx} className="copilot-sug-btn" onClick={() => handleSend(sug)}>
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="copilot-msg assistant" style={{ fontStyle: 'italic', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Bot size={14} style={{ color: 'var(--color-primary-light)' }} />
                <span>Consultando manuales y preparando respuesta...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            className="copilot-input-area"
            onSubmit={e => {
              e.preventDefault()
              handleSend()
            }}
          >
            <input
              type="text"
              className="copilot-input"
              placeholder="Pregúntame sobre el manual o ejecuta una acción..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="copilot-send" disabled={loading || !input.trim()}>
              <Send size={15} />
            </button>
          </form>
        </div>
      )}

      {/* Modal para registrar novedad desde el copiloto */}
      {modalNovedadOpen && (
        <RegistrarNovedadModal
          onClose={() => setModalNovedadOpen(false)}
          onSuccess={(msg) => {
            setModalNovedadOpen(false)
            addMessage('assistant', `✅ Novedad registrada con éxito: ${msg || 'Operación completada'}.`)
          }}
        />
      )}
    </>
  )
}
