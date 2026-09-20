import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * useLocalDraft
 * Hook para auto-guardar borradores de texto (notas clínicas, justificaciones, observaciones)
 * en localStorage. Protege contra micro-cortes, recargas de página (F5) o reinicios de servidor.
 * 
 * @param {string} draftKey - Clave única del borrador (ej: `draft_notes_client_123`)
 * @param {string} initialValue - Valor por defecto si no hay borrador previo
 */
export function useLocalDraft(draftKey, initialValue = '') {
  const fullKey = `dl_draft_${draftKey}`
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return initialValue
    try {
      const saved = localStorage.getItem(fullKey)
      return saved !== null ? saved : initialValue
    } catch (e) {
      console.warn('Error reading from localStorage:', e)
      return initialValue
    }
  })

  const [hasDraft, setHasDraft] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(fullKey) !== null
    } catch {
      return false
    }
  })

  const timeoutRef = useRef(null)

  const updateValue = useCallback((newValue) => {
    setValue(newValue)

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      try {
        if (newValue && newValue.trim().length > 0) {
          localStorage.setItem(fullKey, newValue)
          setHasDraft(true)
        } else {
          localStorage.removeItem(fullKey)
          setHasDraft(false)
        }
      } catch (e) {
        console.warn('Error writing draft to localStorage:', e)
      }
    }, 250) // 250ms debounce
  }, [fullKey])

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(fullKey)
      setValue(initialValue)
      setHasDraft(false)
    } catch (e) {
      console.warn('Error clearing draft from localStorage:', e)
    }
  }, [fullKey, initialValue])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return [value, updateValue, clearDraft, hasDraft]
}

export default useLocalDraft
