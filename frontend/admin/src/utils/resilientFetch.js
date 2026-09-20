/**
 * resilientFetch
 * Envoltorio inteligente de fetch con reintentos automáticos para mitigar micro-cortes
 * y tolerar recargas transparentes del backend (Zero-Downtime) sin romper la sesión de la psicóloga.
 * 
 * @param {string} url - URL del endpoint
 * @param {RequestInit} options - Opciones de la petición fetch
 * @param {number} maxRetries - Número máximo de reintentos (por defecto 2)
 * @param {number} baseDelayMs - Tiempo base entre reintentos en ms (por defecto 750ms)
 * @returns {Promise<Response>}
 */
export async function resilientFetch(url, options = {}, maxRetries = 2, baseDelayMs = 750) {
  let attempt = 0

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(url, options)

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
