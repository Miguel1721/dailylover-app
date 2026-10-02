import React from 'react'
import { Navigate, useParams } from 'react-router-dom'

// La sala antigua ya no existe: hay una sola videollamada (la de Videollamadas, con consentimiento y grabación de audio).
export default function SalaRedirect() {
  const { sessionId } = useParams()
  return <Navigate to={`/matchmaking/videollamadas?cita=${encodeURIComponent(sessionId || '')}`} replace />
}
