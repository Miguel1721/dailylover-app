import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { Bot, User, Send, X, MessageSquare } from 'lucide-react'

const API = 'https://prueba-daily.agentesia.cloud'

export default function CopilotWidget() {
  const { token, user, hasPermission } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      text: '¡Hola! Soy tu Copiloto IA de Daily Lover. ¿En qué puedo ayudarte hoy?',
      suggestions: [
        '¿Cuántos clientes hay en el CRM?',
        '¿Cuál es el saldo de caja actual?',
        '¿Qué alertas operativas tenemos hoy?',
        'Crear un nuevo evento',
        'Agregar un nuevo empleado'
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

  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading])

  const addMessage = (sender, text, suggestions = null) => {
    setMessages(prev => [...prev, { id: Date.now(), sender, text, suggestions }])
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

      // 2. Parse general intents
      const lower = text.toLowerCase()
      
      if (lower.includes('crear un nuevo evento') || lower.includes('crear evento') || lower.includes('nuevo evento')) {
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

      if (lower.includes('agregar un nuevo empleado') || lower.includes('agregar empleado') || lower.includes('nuevo empleado') || lower.includes('crear empleado')) {
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

      if (lower.includes('clientes') || lower.includes('crm') || lower.includes('cuantos clientes')) {
        if (!hasPermission('clientes', 'view')) {
          addMessage('assistant', 'Lo siento, no tienes permisos para visualizar los datos de los clientes.')
          setLoading(false)
          return
        }
        const res = await fetch(`${API}/api/v1/admin/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const stats = await res.json()
          addMessage('assistant', `Actualmente hay ${stats.total_users} clientes registrados en el CRM con perfiles psicológicos OCEAN completos.`)
        } else {
          addMessage('assistant', 'Hubo un error al consultar las estadísticas de los clientes.')
        }
        setLoading(false)
        return
      }

      if (lower.includes('caja') || lower.includes('flujo') || lower.includes('saldo') || lower.includes('finanzas')) {
        if (!hasPermission('flujo_caja', 'view')) {
          addMessage('assistant', 'Lo siento, tu rol no cuenta con permisos para ver el flujo de caja o el libro de finanzas.')
          setLoading(false)
          return
        }
        const res = await fetch(`${API}/api/v1/admin/finance/cashflow`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const cf = await res.json()
          addMessage('assistant', `El saldo disponible en caja actualmente es de COP ${cf.current_balance.toLocaleString('es-CO')}.\n\nIngresos totales registrados: COP ${cf.monthly_summary.reduce((a,b)=>a+b.income, 0).toLocaleString('es-CO')}.\nGastos totales registrados: COP ${cf.monthly_summary.reduce((a,b)=>a+b.expenses, 0).toLocaleString('es-CO')}.`)
        } else {
          addMessage('assistant', 'Hubo un error al consultar el flujo de caja.')
        }
        setLoading(false)
        return
      }

      if (lower.includes('alertas') || lower.includes('pendiente') || lower.includes('vencidos')) {
        const res = await fetch(`${API}/api/v1/admin/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const stats = await res.json()
          let responseText = 'Alertas Operativas de hoy:\n'
          if (stats.active_debts > 0) responseText += `⚠️ Hay ${stats.active_debts} cobros vencidos pendientes de renovación cartera.\n`
          if (stats.pending_payrolls > 0) responseText += `💵 Hay ${stats.pending_payrolls} nómina pendiente de liquidación.\n`
          if (stats.critical_events > 0) responseText += `🚨 Hay ${stats.critical_events} evento(s) con aforo crítico (>85% de capacidad).\n`
          if (stats.active_debts === 0 && stats.pending_payrolls === 0 && stats.critical_events === 0) {
            responseText = 'No se registran alertas operativas el día de hoy. ¡Todo al día!'
          }
          addMessage('assistant', responseText)
        } else {
          addMessage('assistant', 'Hubo un error al consultar las alertas operativas.')
        }
        setLoading(false)
        return
      }

      // Default response
      setTimeout(() => {
        addMessage('assistant', 'No logré entender tu instrucción. Recuerda que puedo ayudarte a consultar estadísticas de clientes, finanzas, alertas operativas o a crear eventos y empleados de forma guiada.')
        setLoading(false)
      }, 500)

    } catch (err) {
      console.error(err)
      addMessage('assistant', 'Ocurrió un error inesperado al procesar tu solicitud.')
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
        // Simple regex validation
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
            addMessage('assistant', `🎉 ¡Éxito! El evento "${eventData.name}" ha sido creado con éxito. Puedes verificarlo en el módulo de Eventos.`)
          } else {
            const errData = await res.json().catch(() => ({}))
            addMessage('assistant', `❌ Error al crear evento: ${errData.detail || 'Error de permisos o parámetros inválidos.'}`)
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
            addMessage('assistant', `🎉 ¡Éxito! El empleado "${empData.full_name}" ha sido agregado con éxito al sistema en estado Activo.`)
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
        <div className="copilot-window">
          <div className="copilot-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bot size={20} />
              <div>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Copiloto IA</span>
                <span className="copilot-badge">{user?.role_name || 'Personal'}</span>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'white', border: 'none' }} onClick={() => setIsOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <div className="copilot-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`copilot-msg ${msg.sender}`} style={{ whiteSpace: 'pre-line' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  {msg.sender === 'assistant' ? <Bot size={13} style={{ marginTop: 2, color: 'var(--color-primary)' }} /> : <User size={13} style={{ marginTop: 2 }} />}
                  <div>{msg.text}</div>
                </div>
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
                <Bot size={13} style={{ color: 'var(--color-primary)' }} />
                <span>Pensando...</span>
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
              placeholder="Pregúntame algo o escribe un comando..."
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
    </>
  )
}
