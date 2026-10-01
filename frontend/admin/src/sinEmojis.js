// María pidió que el sistema no muestre emojis. Este limpiador quita los emojis de todo el texto visible
// (incluido lo que llega de la base de datos) cada vez que la pantalla cambia. No toca campos que se están escribiendo.
const EMO_TEST = /[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{26FF}\u{2700}-\u{2712}\u{2714}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/u
const EMO_ALL = /[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{26FF}\u{2700}-\u{2712}\u{2714}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]+ ?/gu
const ATTRS = ['placeholder', 'title', 'aria-label']

function limpiarTexto(s) {
  return s.replace(EMO_ALL, '')
}

function limpiarNodo(n) {
  if (!n) return
  if (n.nodeType === 3) {
    if (EMO_TEST.test(n.data)) n.data = limpiarTexto(n.data)
    return
  }
  if (n.nodeType !== 1) return
  const tag = n.tagName
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return
  for (const a of ATTRS) {
    const v = n.getAttribute && n.getAttribute(a)
    if (v && EMO_TEST.test(v)) n.setAttribute(a, limpiarTexto(v))
  }
  if (tag === 'OPTION' && EMO_TEST.test(n.textContent || '')) { /* los hijos de texto se limpian abajo */ }
  for (let c = n.firstChild; c; c = c.nextSibling) limpiarNodo(c)
}

export function iniciarSinEmojis() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
  let pendiente = false
  const cola = new Set()
  const procesar = () => {
    pendiente = false
    cola.forEach((n) => { try { limpiarNodo(n) } catch (e) { /* nunca debe romper la pantalla */ } })
    cola.clear()
  }
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') cola.add(m.target)
      else if (m.type === 'attributes') cola.add(m.target)
      else m.addedNodes.forEach((n) => cola.add(n))
    }
    if (!pendiente) { pendiente = true; requestAnimationFrame(procesar) }
  })
  const arrancar = () => {
    limpiarNodo(document.body)
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS })
  }
  if (document.body) arrancar()
  else document.addEventListener('DOMContentLoaded', arrancar)
}
