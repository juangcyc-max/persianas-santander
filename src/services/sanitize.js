// ── Elimina caracteres peligrosos de strings ──────────────────────────────
export function sanitizeText(value) {
  if (typeof value !== 'string') return value
  return value
    .replace(/<[^>]*>/g, '')           // elimina tags HTML
    .replace(/javascript:/gi, '')      // elimina javascript:
    .replace(/on\w+\s*=/gi, '')        // elimina event handlers (onclick=, etc.)
    .replace(/[<>]/g, '')              // elimina < y >
    .trim()
}

// ── Sanitiza un objeto completo (solo los valores string) ─────────────────
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = typeof value === 'string' ? sanitizeText(value) : value
  }
  return result
}

// ── Sanitiza un número — devuelve 0 si no es válido ──────────────────────
export function sanitizeNumber(value, min = 0, max = Infinity) {
  const n = parseFloat(value)
  if (isNaN(n)) return min
  return Math.min(max, Math.max(min, n))
}
