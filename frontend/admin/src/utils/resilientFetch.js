/**
 * resilientFetch
 * Envoltorio inteligente de fetch con reintentos automáticos para mitigar micro-cortes
 * y tolerar recargas transparentes del backend (Zero-Downtime) sin romper la sesión de la psicóloga.
 * Incluye timeout explícito con AbortController para prevenir spinners infinitos.
 * 
 * @param {string} url - URL del endpoint
 * @param {RequestInit & { timeoutMs?: number }} options - Opciones de la petición fetch
 * @param {number} maxRetries - Número máximo de reintentos (por defecto 1)
 * @param {number} baseDelayMs - Tiempo base entre reintentos en ms (por defecto 750ms)
 * @returns {Promise<Response>}
 */
export async function resilientFetch(url, options = {}, maxRetries = 1, baseDelayMs = 750) {
  let attempt = 0
  const timeoutMs = options.timeoutMs || 28000

  while (attempt <= maxRetries) {
    const controller = new AbortController()
    let isTimeout = false
    const timer = setTimeout(() => {
      isTimeout = true
      controller.abort()
    }, timeoutMs)

    const userSignal = options.signal
    const onUserAbort = () => controller.abort()
    if (userSignal) {
      if (userSignal.aborted) {
        clearTimeout(timer)
        throw new DOMException('Aborted', 'AbortError')
      }
      userSignal.addEventListener('abort', onUserAbort)
    }

    try {
      const fetchOpts = { ...options, signal: controller.signal }
      delete fetchOpts.timeoutMs

      const response = await fetch(url, fetchOpts)
      clearTimeout(timer)
      if (userSignal) userSignal.removeEventListener('abort', onUserAbort)

      // Si el backend está reiniciando sus workers o Traefik devuelve 502/503 temporal, reintentar
      if ((response.status === 502 || response.status === 503) && attempt < maxRetries) {
        attempt++
        const backoff = baseDelayMs * Math.pow(1.5, attempt - 1)
        console.warn(`[resilientFetch] Servidor temporalmente en recarga (${response.status}). Reintento ${attempt}/${maxRetries} en ${backoff}ms...`)
        await new Promise(resolve => setTimeout(resolve, backoff))
        continue
      }

      return response
    } catch (err) {
      clearTimeout(timer)
      if (userSignal) userSignal.removeEventListener('abort', onUserAbort)

      if (isTimeout) {
        if (attempt < maxRetries) {
          attempt++
          const backoff = baseDelayMs * Math.pow(1.5, attempt - 1)
          console.warn(`[resilientFetch] Timeout agotado (${timeoutMs}ms). Reintento ${attempt}/${maxRetries}...`)
          await new Promise(resolve => setTimeout(resolve, backoff))
          continue
        }
        throw new Error(`Tiempo de espera agotado (${Math.round(timeoutMs/1000)}s) al consultar el servidor. No se recibió respuesta a tiempo.`)
      }

      // Si fue cancelado intencionalmente por el usuario, propagar de inmediato
      if (err.name === 'AbortError' && !isTimeout) {
        throw err
      }

      // Fallo de red local o servidor inaccesible brevemente
      if (attempt < maxRetries) {
        attempt++
        const backoff = baseDelayMs * Math.pow(1.5, attempt - 1)
        console.warn(`[resilientFetch] Micro-corte de red detectado (${err.message}). Reintento ${attempt}/${maxRetries} en ${backoff}ms...`)
        await new Promise(resolve => setTimeout(resolve, backoff))
      } else {
        throw err
      }
    }
  }
}

export default resilientFetch
