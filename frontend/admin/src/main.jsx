import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { iniciarSinEmojis } from './sinEmojis'

iniciarSinEmojis()

// Envia la sesion en todas las llamadas a la API (varias pantallas viejas no la enviaban y ahora el servidor la exige)
const _fetchOriginal = window.fetch.bind(window)
window.fetch = (input, init) => {
  try {
    const url = typeof input === 'string' ? input : ((input && input.url) || '')
    if (url.includes('/api/v1/')) {
      const tk = localStorage.getItem('dl_token')
      if (tk) {
        const h = new Headers((init && init.headers) || (typeof input !== 'string' && input && input.headers) || undefined)
        if (!h.has('Authorization')) {
          h.set('Authorization', `Bearer ${tk}`)
          init = { ...(init || {}), headers: h }
        }
      }
    }
  } catch (e) { /* si algo falla, la llamada sigue igual */ }
  return _fetchOriginal(input, init)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Registrar Service Worker para Notificaciones PWA Móviles
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' })
      .then(reg => console.log('PWA Service Worker registrado con éxito:', reg.scope))
      .catch(err => console.warn('PWA Service Worker error de registro:', err))
  })
}

