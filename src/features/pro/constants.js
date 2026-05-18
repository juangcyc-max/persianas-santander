// ── Helpers ───────────────────────────────────────────────────────────────
export const fmt     = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
export const fmtDate = (d) => d ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—'
export const uid     = () => Math.random().toString(36).slice(2, 10)

export const BLIND_LABELS = {
  laminada:                    'Paño laminado',
  autoblocante:                'Paño autoblocante',
  blocking:                    'Bloqueante',
  sistema_mini_cajon_pvc:      'Mini Cajón PVC',
  sistema_mini_cajon_aluminio: 'Mini Cajón Aluminio',
  sistema_mini_autoblocante:   'Mini Autoblocante',
  solo_guias:                  'Solo guías',
  solo_motor:                  'Solo motor',
  mosquitera_enrollable:       'Mosquitera',
  sistema_mini_pvc:            'Mini PVC',
  sistema_mini_aluminio:       'Mini Aluminio',
  motor_mas_guias:             'Motor + Guías',
  pano_mas_guias:              'Paño + Guías',
}
export const blindLabel = (t) => BLIND_LABELS[t] ?? t ?? '—'

export const TEMPLATE_OPTS = [
  { id: 'azul',    label: 'Azul',    color: '#1e50a0' },
  { id: 'verde',   label: 'Verde',   color: '#146e41' },
  { id: 'grafito', label: 'Grafito', color: '#323744' },
  { id: 'ciruela', label: 'Ciruela', color: '#5f2882' },
]

// ── Lógica de precios para presupuestos profesionales ─────────────────────
export const PRO_BLIND_TYPES = [
  { value: 'laminada',                    label: 'Paño Laminado'               },
  { value: 'autoblocante',                label: 'Paño Autoblocante'           },
  { value: 'blocking',                    label: 'Bloqueante'                  },
  { value: 'sistema_mini_cajon_pvc',      label: 'Sistema Mini Cajón PVC'      },
  { value: 'sistema_mini_cajon_aluminio', label: 'Sistema Mini Cajón Aluminio' },
  { value: 'sistema_mini_autoblocante',   label: 'Sistema Mini Autoblocante'   },
  { value: 'solo_motor',                  label: 'Solo Motor'                  },
  { value: 'solo_guias',                  label: 'Solo Guías'                  },
  { value: 'mosquitera_enrollable',       label: 'Mosquitera Enrollable'       },
]
export const PRO_MOTOR_ONLY = ['autoblocante', 'blocking', 'sistema_mini_autoblocante']
export const PRO_NO_MOTOR   = ['mosquitera_enrollable', 'laminada']
export const PRO_PANO_TYPES = ['laminada', 'autoblocante', 'blocking', 'mosquitera_enrollable']
export const PRO_MIN_SQM    = 1.5

export const PROJECT_STATUS = {
  draft:    { label: 'Borrador',  cls: 'bg-gray-100 text-gray-600'    },
  sent:     { label: 'Enviado',   cls: 'bg-blue-100 text-blue-700'    },
  accepted: { label: 'Aceptado',  cls: 'bg-green-100 text-green-700'  },
  rejected: { label: 'Rechazado', cls: 'bg-red-100 text-red-700'      },
}

export const ORDER_STATUS = {
  pending:   { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700'  },
  confirmed: { label: 'Confirmado', cls: 'bg-blue-100 text-blue-700'    },
  completed: { label: 'Completado', cls: 'bg-green-100 text-green-700'  },
  cancelled: { label: 'Cancelado',  cls: 'bg-red-100 text-red-700'      },
}

export const TABS = [
  { id: 'overview',         label: 'Resumen',            icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
  { id: 'cotizaciones',     label: 'Cotiz. y clientes',  icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
  { id: 'mensajes',         label: 'Mensajes',           icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { id: 'pedidos',          label: 'Pedidos',            icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'empresa',          label: 'Mi empresa',         icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { id: 'presupuestos',     label: 'Mis presupuestos',   icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'facturas',         label: 'Mis facturas',       icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
]

export const QUOTE_STATUS = {
  pending:  { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700'  },
  accepted: { label: 'Aceptado',   cls: 'bg-green-100 text-green-700'  },
  modified: { label: 'Modificado', cls: 'bg-blue-100 text-blue-700'    },
  rejected: { label: 'Rechazado',  cls: 'bg-red-100 text-red-700'      },
}

export const STATUS_BORDER = {
  draft:    'border-l-gray-300',
  sent:     'border-l-blue-400',
  accepted: 'border-l-green-500',
  rejected: 'border-l-red-400',
}

export const REQUIRED_EMPRESA = ['razon_social', 'cif_nif', 'telefono', 'direccion_fiscal', 'codigo_postal', 'ciudad', 'provincia', 'email_facturacion']

// Total del cliente final: la base imponible se re-tasa al IVA del cliente
// (que puede ser != 21% en obras de reforma). Misma fórmula que usa el PDF.
export function computeClientTotal(adminTotalConIva, marginPct, extrasAmount, ivaPct = 21) {
  const admin   = parseFloat(adminTotalConIva) || 0
  const margin  = parseFloat(marginPct)        || 0
  const extras  = parseFloat(extrasAmount)     || 0
  const iva     = parseFloat(ivaPct ?? 21)     || 21
  const sinIva  = (admin * (1 + margin / 100)) / 1.21
  return sinIva * (1 + iva / 100) + extras
}

// ── Función de cálculo de precio pro ─────────────────────────────────────
import { DEFAULT_MOTOR_PRICES, DEFAULT_GUIDE_PRICE_PER_ML, DEFAULT_INSTALACION_PRICE, DEFAULT_INSTALACION_FIJA, DEFAULT_PRICES } from '../../services/prices'

export function calcProItemPrice({ prices, motorPrices, guidePricePerMl, instalacionPrice, instalacionFija, blindType, width, height, mechanism, motorType, guideType, colorGroup, installacion }) {
  const isPano      = PRO_PANO_TYPES.includes(blindType)
  const isMotorOnly = PRO_MOTOR_ONLY.includes(blindType)
  const isSoloMot   = blindType === 'solo_motor'
  const isSoloGuia  = blindType === 'solo_guias'
  if (isSoloMot) {
    const mp = (motorPrices ?? DEFAULT_MOTOR_PRICES)[motorType ?? 'mecanico'] ?? 120
    return (mp + (installacion ? (instalacionFija ?? DEFAULT_INSTALACION_FIJA) : 0)) * 1.21
  }
  if (isSoloGuia) {
    const pml = (guidePricePerMl ?? DEFAULT_GUIDE_PRICE_PER_ML)[guideType] ?? 0
    return pml * (height / 1000) * 2 * 1.21
  }
  const typePrices = (prices ?? DEFAULT_PRICES)[blindType] ?? {}
  const basePerSqm = typePrices[colorGroup] ?? Object.values(typePrices)[0] ?? 0
  const sqm        = Math.max(PRO_MIN_SQM, (width / 1000) * (height / 1000))
  let total        = basePerSqm * sqm
  if (!isPano && (mechanism === 'motor' || isMotorOnly)) {
    total += (motorPrices ?? DEFAULT_MOTOR_PRICES)[motorType ?? 'mecanico'] ?? 120
  }
  if (guideType && guideType !== 'none') {
    total += (guidePricePerMl ?? DEFAULT_GUIDE_PRICE_PER_ML)[guideType] * (height / 1000) * 2
  }
  if (installacion) {
    total += (instalacionPrice ?? DEFAULT_INSTALACION_PRICE) * sqm
  }
  return total * 1.21
}

// ── processConfigurations ─────────────────────────────────────────────────
export function processConfigurations(configs) {
  const groupMap = new Map()
  const singles  = []
  for (const config of configs) {
    const match = config.configuration_number?.match(/^GRUPO-(.+)-(\d+)$/)
    if (match) {
      const groupId = match[1]
      if (!groupMap.has(groupId)) groupMap.set(groupId, [])
      groupMap.get(groupId).push(config)
    } else {
      singles.push({ type: 'single', id: config.id, item: config, sortDate: config.created_at })
    }
  }
  const result = []
  for (const [groupId, items] of groupMap) {
    const sorted = [...items].sort((a, b) => {
      const na = parseInt(a.configuration_number?.match(/-(\d+)$/)?.[1] ?? '0')
      const nb = parseInt(b.configuration_number?.match(/-(\d+)$/)?.[1] ?? '0')
      return na - nb
    })
    result.push({ type: 'group', id: `group-${groupId}`, items: sorted, sortDate: sorted[0].created_at })
  }
  for (const s of singles) result.push(s)
  result.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate))
  return result
}
