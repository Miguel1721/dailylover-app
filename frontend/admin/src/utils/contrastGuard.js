/**
 * Guardián de contraste para el modo claro.
 *
 * Muchas pantallas escriben colores a mano pensando en el tema oscuro (letras claras, verdes/amarillos/rosados
 * pastel, fondos oscuros fijos). En modo claro esas letras quedan casi invisibles. En vez de tocar cientos de
 * estilos, este módulo revisa el texto visible y, SOLO si el contraste es insuficiente, ajusta el color de la
 * letra (conservando su tono) hasta que se lea. No cambia fondos, no toca imágenes ni degradados y se apaga
 * solo al volver al modo oscuro.
 */

const MIN_RATIO = 3.5      // por debajo de esto se corrige
const TARGET_RATIO = 4.5   // valor al que se lleva el texto corregido
const ATTR = 'data-cg'

let observer = null
let timer = null
let running = false
let applying = false
let queue = new Set()

const parseColor = (c) => {
  const m = (c || '').match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number)
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
}

const channel = (v) => {
  v /= 255
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}
const luminance = (c) => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b)
const ratioOf = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
const over = (top, bot) => ({
  r: top.r * top.a + bot.r * (1 - top.a),
  g: top.g * top.a + bot.g * (1 - top.a),
  b: top.b * top.a + bot.b * (1 - top.a),
  a: 1
})

// Fondo efectivo detrás de un elemento. Devuelve null si hay degradado/imagen (no se puede calcular).
const effectiveBackground = (el) => {
  const layers = []
  let e = el
  while (e && e.nodeType === 1) {
    const cs = getComputedStyle(e)
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return null
    const c = parseColor(cs.backgroundColor)
    if (c && c.a > 0) {
      layers.push(c)
      if (c.a >= 1) break
    }
    e = e.parentElement
  }
  let base = { r: 255, g: 255, b: 255, a: 1 }
  if (!layers.length || layers[layers.length - 1].a < 1) {
    const bc = parseColor(getComputedStyle(document.body).backgroundColor)
    if (bc && bc.a > 0) base = bc
  }
  let acc = base
  for (let i = layers.length - 1; i >= 0; i--) acc = over(layers[i], acc)
  return acc
}

const rgbToHsl = ({ r, g, b }) => {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  return { h, s, l }
}

const hslToRgb = ({ h, s, l }) => {
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v } }
  const hue = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return {
    r: Math.round(hue(p, q, h + 1 / 3) * 255),
    g: Math.round(hue(p, q, h) * 255),
    b: Math.round(hue(p, q, h - 1 / 3) * 255)
  }
}

// Color con el mismo tono que `fg` pero con contraste suficiente sobre `bg`.
const fixColor = (fg, bg) => {
  const bgL = luminance(bg)
  const hsl = rgbToHsl(fg)
  const darker = bgL > 0.4          // fondo claro -> se oscurece la letra; fondo oscuro -> se aclara
  for (let i = 0; i < 30; i++) {
    hsl.l = darker ? Math.max(0, hsl.l - 0.03) : Math.min(1, hsl.l + 0.03)
    const c = hslToRgb(hsl)
    if (ratioOf(luminance(c), bgL) >= TARGET_RATIO) return c
  }
  return darker ? { r: 31, g: 16, b: 18 } : { r: 245, g: 240, b: 241 }
}

const hasOwnText = (el) => {
  for (const n of el.childNodes) {
    if (n.nodeType === 3 && n.textContent.trim()) return true
  }
  return false
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH', 'IFRAME', 'CANVAS', 'OPTION'])
const FIELD_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

const checkElement = (el) => {
  if (!el || el.nodeType !== 1 || SKIP_TAGS.has(el.tagName.toUpperCase())) return
  const isField = FIELD_TAGS.has(el.tagName.toUpperCase())
  if (isField ? (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file' || el.type === 'hidden') : !hasOwnText(el)) return
  const rect = el.getBoundingClientRect()
  if (rect.width < 2 || rect.height < 2) return
  const cs = getComputedStyle(el)
  if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) return
  // texto con degradado (background-clip: text) o transparente: no se toca
  if ((cs.webkitTextFillColor || '').includes('rgba(0, 0, 0, 0)') || cs.color === 'transparent') return
  const fg = parseColor(cs.color)
  if (!fg) return
  const bg = effectiveBackground(el)
  if (!bg) return
  const eff = over(fg, bg)
  if (ratioOf(luminance(eff), luminance(bg)) >= MIN_RATIO) return
  const fixed = fixColor(fg, bg)
  el.style.setProperty('color', `rgb(${fixed.r}, ${fixed.g}, ${fixed.b})`, 'important')
  el.setAttribute(ATTR, '1')
}

const flush = () => {
  timer = null
  if (!running) return
  const batch = Array.from(queue)
  queue = new Set()
  applying = true
  const step = (i) => {
    if (!running) { applying = false; return }
    const end = Math.min(i + 400, batch.length)
    for (let k = i; k < end; k++) {
      const root = batch[k]
      if (!root || !root.isConnected) continue
      checkElement(root)
      root.querySelectorAll && root.querySelectorAll('*').forEach(checkElement)
    }
    if (end < batch.length) {
      requestAnimationFrame(() => step(end))
    } else {
      // deja pasar los eventos que generaron nuestros propios cambios
      setTimeout(() => { applying = false }, 50)
    }
  }
  step(0)
}

const schedule = (node) => {
  queue.add(node || document.body)
  if (!timer) timer = setTimeout(flush, 250)
}

export function startContrastGuard() {
  if (running || typeof document === 'undefined') return
  running = true
  schedule(document.body)
  observer = new MutationObserver((mutations) => {
    if (applying) return
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((n) => { if (n.nodeType === 1) schedule(n) })
      } else if (m.type === 'attributes' && m.target.nodeType === 1 && m.target.getAttribute(ATTR) !== '1') {
        schedule(m.target)
      } else if (m.type === 'characterData' && m.target.parentElement) {
        schedule(m.target.parentElement)
      }
    }
  })
  observer.observe(document.body, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'], characterData: true
  })
}

export function stopContrastGuard() {
  running = false
  if (observer) { observer.disconnect(); observer = null }
  if (timer) { clearTimeout(timer); timer = null }
  queue = new Set()
  document.querySelectorAll(`[${ATTR}]`).forEach((el) => {
    el.style.removeProperty('color')
    el.removeAttribute(ATTR)
  })
}
