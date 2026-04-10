import { useState, useEffect, useCallback } from 'react'

/**
 * Hook anti-spam: bloquea reenvíos durante `cooldownMs` milisegundos.
 * @param {number} cooldownMs  Tiempo de bloqueo en ms (defecto: 60 s)
 * @returns {{ blocked, secondsLeft, consume }}
 *   - blocked:    true si está en cooldown
 *   - secondsLeft: segundos restantes (se actualiza cada segundo)
 *   - consume():  llama antes de enviar — devuelve false si está bloqueado
 */
export function useRateLimit(cooldownMs = 60_000) {
  const [unlocksAt, setUnlocksAt] = useState(0)
  const [now,       setNow]       = useState(() => Date.now())

  // Actualiza `now` cada segundo mientras haya cooldown activo
  useEffect(() => {
    if (unlocksAt <= Date.now()) return
    const id = setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= unlocksAt) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [unlocksAt])

  const secondsLeft = Math.max(0, Math.ceil((unlocksAt - now) / 1000))
  const blocked     = secondsLeft > 0

  const consume = useCallback(() => {
    if (Date.now() < unlocksAt) return false
    const next = Date.now() + cooldownMs
    setUnlocksAt(next)
    setNow(Date.now())
    return true
  }, [unlocksAt, cooldownMs])

  return { blocked, secondsLeft, consume }
}
