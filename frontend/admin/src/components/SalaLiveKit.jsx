import React, { useEffect, useRef, useState } from 'react'
import { Room, RoomEvent, Track } from 'livekit-client'

// Sala de video real (LiveKit). Cada persona graba SOLO el audio de su propio micrófono (si hay consentimiento)
// y lo sube en fragmentos de 10 s. Las dos pistas separadas permiten saber quién habla sin adivinar.
const CHUNK_MS = 10000

export default function SalaLiveKit({ join, uploadChunk, onLeave, labelLocal = 'Tú', labelRemote = 'La otra persona' }) {
  const localRef = useRef(null)
  const remoteRef = useRef(null)
  const audioRef = useRef(null)
  const roomRef = useRef(null)
  const recRef = useRef(null)
  const queueRef = useRef(Promise.resolve())
  const [estado, setEstado] = useState('Conectando…')
  const [remoto, setRemoto] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [grabando, setGrabando] = useState(false)
  const [subidos, setSubidos] = useState(0)
  const [errSubida, setErrSubida] = useState('')

  useEffect(() => {
    let cancel = false
    const room = new Room({ adaptiveStream: true, dynacast: true })
    roomRef.current = room

    const attachRemote = (track) => {
      if (track.kind === Track.Kind.Video && remoteRef.current) { track.attach(remoteRef.current); setRemoto(true) }
      if (track.kind === Track.Kind.Audio && audioRef.current) track.attach(audioRef.current)
    }
    room.on(RoomEvent.TrackSubscribed, (track) => attachRemote(track))
    room.on(RoomEvent.ParticipantConnected, () => setRemoto(true))
    room.on(RoomEvent.ParticipantDisconnected, () => { setRemoto(false); if (remoteRef.current) remoteRef.current.srcObject = null })
    room.on(RoomEvent.Disconnected, () => setEstado('Desconectado'))

    ;(async () => {
      try {
        await room.connect(join.livekit_url, join.token)
      } catch (e) {
        setEstado('No se pudo conectar a la sala. Revisa tu internet y vuelve a abrir el enlace.')
        return
      }
      if (cancel) return
      room.remoteParticipants.forEach((p) => p.trackPublications.forEach((pub) => pub.track && attachRemote(pub.track)))
      let medios = true
      try { await room.localParticipant.setMicrophoneEnabled(true) } catch (e) { medios = false; setMicOn(false) }
      try {
        await room.localParticipant.setCameraEnabled(true)
        const cam = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track
        if (cam && localRef.current) cam.attach(localRef.current)
      } catch (e) { setCamOn(false) }
      setEstado(medios ? 'En llamada' : 'En llamada, pero el navegador no dio permiso al micrófono: actívalo en el candado de la barra de direcciones y vuelve a entrar.')
      if (join.recording_enabled && medios) startRecording(room)
    })()
    return () => { cancel = true; stopRecording(); room.disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startRecording(room) {
    const mic = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track
    if (!mic || typeof MediaRecorder === 'undefined') return
    const stream = new MediaStream([mic.mediaStreamTrack])
    const type = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : ''
    const rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined)
    const startMs = Date.now()
    let seq = 0
    rec.ondataavailable = (ev) => {
      if (!ev.data || ev.data.size === 0) return
      const n = seq++
      const blob = ev.data
      queueRef.current = queueRef.current.then(async () => {
        for (let intento = 0; intento < 3; intento++) {
          try { await uploadChunk(n, startMs, blob); setSubidos((x) => x + 1); setErrSubida(''); return } catch (e) {
            setErrSubida('Reintentando subir audio…'); await new Promise((r) => setTimeout(r, 1500 * (intento + 1)))
          }
        }
        setErrSubida('No se pudo subir un fragmento de audio.')
      })
    }
    rec.start(CHUNK_MS)
    recRef.current = rec
    setGrabando(true)
  }

  function stopRecording() {
    const rec = recRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
    recRef.current = null
    setGrabando(false)
  }

  async function salir() {
    stopRecording()
    await queueRef.current   // termina de subir lo pendiente
    roomRef.current?.disconnect()
    onLeave && onLeave()
  }

  const toggleMic = async () => { const v = !micOn; await roomRef.current?.localParticipant.setMicrophoneEnabled(v); setMicOn(v) }
  const toggleCam = async () => { const v = !camOn; await roomRef.current?.localParticipant.setCameraEnabled(v); setCamOn(v) }

  const box = { position: 'relative', background: '#0f172a', borderRadius: 14, overflow: 'hidden', aspectRatio: '16 / 9', width: '100%' }
  const tag = { position: 'absolute', left: 10, bottom: 10, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 12, padding: '4px 8px', borderRadius: 6 }
  const btn = (bg) => ({ border: 'none', background: bg, color: '#fff', borderRadius: 999, padding: '10px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 14 })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
        <span style={{ fontWeight: 700 }}>{estado}</span>
        {grabando
          ? <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>● Grabando solo audio · {subidos} fragmentos guardados</span>
          : <span style={{ background: '#e2e8f0', color: '#334155', padding: '3px 8px', borderRadius: 6 }}>Sin grabación</span>}
        {errSubida && <span style={{ color: '#b45309' }}>{errSubida}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <div style={box}>
          <video ref={remoteRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {!remoto && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#cbd5e1', fontSize: 14 }}>Esperando a {labelRemote.toLowerCase()}…</div>}
          <span style={tag}>{labelRemote}</span>
        </div>
        <div style={box}>
          <video ref={localRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          <span style={tag}>{labelLocal}</span>
        </div>
      </div>
      <audio ref={audioRef} autoPlay />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button style={btn(micOn ? '#334155' : '#b91c1c')} onClick={toggleMic}>{micOn ? 'Silenciar micrófono' : 'Activar micrófono'}</button>
        <button style={btn(camOn ? '#334155' : '#b91c1c')} onClick={toggleCam}>{camOn ? 'Apagar cámara' : 'Encender cámara'}</button>
        <button style={btn('#dc2626')} onClick={salir}>Salir de la llamada</button>
      </div>
    </div>
  )
}
