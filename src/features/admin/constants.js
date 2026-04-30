export const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
export const fmtDate = (d) => d ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—'

export const STATUS_MAP = {
  pending:   { label: 'Pendiente',   cls: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500'  },
  confirmed: { label: 'Confirmado',  cls: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500'   },
  completed: { label: 'Completado',  cls: 'bg-green-100 text-green-700',  dot: 'bg-green-500'  },
  cancelled: { label: 'Cancelado',   cls: 'bg-red-100 text-red-700',      dot: 'bg-red-500'    },
}

export const BUDGET_STATUS_MAP = {
  pending:  { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700'  },
  reviewed: { label: 'Revisado',   cls: 'bg-blue-100 text-blue-700'    },
  sent:     { label: 'Enviado',    cls: 'bg-purple-100 text-purple-700' },
  accepted: { label: 'Aceptado',   cls: 'bg-green-100 text-green-700'  },
  rejected: { label: 'Rechazado',  cls: 'bg-red-100 text-red-700'      },
}

export const PRO_QUOTE_STATUS = {
  pending:  { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700'  },
  accepted: { label: 'Aceptado',   cls: 'bg-green-100 text-green-700'  },
  modified: { label: 'Modificado', cls: 'bg-blue-100 text-blue-700'    },
  rejected: { label: 'Rechazado',  cls: 'bg-red-100 text-red-700'      },
}

export const BLIND_LABELS_ADMIN = {
  laminada:                    'Paño Laminado',
  autoblocante:                'Paño Autoblocante',
  blocking:                    'Bloqueante',
  sistema_mini_cajon_pvc:      'Mini Cajón PVC',
  sistema_mini_cajon_aluminio: 'Mini Cajón Aluminio',
  sistema_mini_autoblocante:   'Mini Autoblocante',
  solo_motor:                  'Solo Motor',
  solo_guias:                  'Solo Guías',
  mosquitera_enrollable:       'Mosquitera',
  normal:                      'Estándar',
  sistema_mini_pvc:            'Sistema Mini PVC',
  sistema_mini_aluminio:       'Sistema Mini Aluminio',
  motor_mas_guias:             'Motor + Guías',
  pano_mas_guias:              'Paño + Guías',
}

export const BUDGET_TYPE_LABELS = {
  laminada:                    'Paño Laminado',
  autoblocante:                'Autoblocante',
  blocking:                    'Bloqueante',
  sistema_mini_cajon_pvc:      'Mini Cajón PVC',
  sistema_mini_cajon_aluminio: 'Mini Cajón Aluminio',
  sistema_mini_autoblocante:   'Mini Autoblocante',
  solo_motor:                  'Solo Motor',
  solo_guias:                  'Solo Guías',
  mosquitera_enrollable:       'Mosquitera',
  sistema_mini_pvc:            'Mini PVC',
  sistema_mini_aluminio:       'Mini Aluminio',
  motor_mas_guias:             'Motor + Guías',
  normal:                      'Estándar',
}

export const ADMIN_BUDGET_BLIND_TYPES = [
  { value: 'laminada',                    label: 'Paño Laminado' },
  { value: 'autoblocante',                label: 'Paño Autoblocante' },
  { value: 'blocking',                    label: 'Bloqueante' },
  { value: 'sistema_mini_cajon_pvc',      label: 'Sistema Mini Cajón PVC' },
  { value: 'sistema_mini_cajon_aluminio', label: 'Sistema Mini Cajón Aluminio' },
  { value: 'sistema_mini_autoblocante',   label: 'Sistema Mini Autoblocante' },
  { value: 'mosquitera_enrollable',       label: 'Mosquitera Enrollable' },
  { value: 'solo_guias',                  label: 'Solo Guías' },
  { value: 'solo_motor',                  label: 'Solo Motor' },
]

export const ADMIN_BUDGET_COLOR_GROUPS = ['Grupo Base', 'Grupo 1', 'Grupo 2', 'Grupo 3']
export const ADMIN_MIN_SQM    = 1.5
export const ADMIN_MOTOR_ONLY = ['autoblocante', 'blocking', 'sistema_mini_autoblocante']
export const ADMIN_NO_MOTOR   = ['mosquitera_enrollable']
export const ADMIN_PANO_TYPES = ['laminada', 'autoblocante', 'blocking', 'mosquitera_enrollable']
export const ADMIN_SISTEMAS   = ['sistema_mini_cajon_pvc', 'sistema_mini_cajon_aluminio', 'sistema_mini_autoblocante']

export const PRODUCT_LABELS = {
  laminada:                    'Paño Laminado',
  autoblocante:                'Paño Autoblocante',
  blocking:                    'Bloqueante',
  sistema_mini_cajon_pvc:      'Sistema Mini Cajón PVC',
  sistema_mini_cajon_aluminio: 'Sistema Mini Cajón Aluminio',
  sistema_mini_autoblocante:   'Sistema Mini Autoblocante',
  mosquitera_enrollable:       'Mosquitera Enrollable',
}
export const ALL_GROUPS = ['Grupo Base', 'Grupo 1', 'Grupo 2', 'Grupo 3']

export const ADMIN_TABS = [
  { id: 'overview',      label: 'Resumen',        icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
  { id: 'pedidos',       label: 'Pedidos',         icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'presupuestos',  label: 'Presupuestos',    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'facturas',      label: 'Facturas',        icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'profesionales', label: 'Profesionales',   icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'clientes',      label: 'Clientes',        icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { id: 'configuracion', label: 'Configuración',   icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

export function buildCalendarUrl(order, confirmedDate, confirmedTime) {
  if (!confirmedDate || !confirmedTime) return null
  const [year, month, day] = confirmedDate.split('-')
  const [hour, minute] = confirmedTime.split(':')
  const start   = `${year}${month}${day}T${hour}${minute}00`
  const endHour = String(parseInt(hour) + 2).padStart(2, '0')
  const end     = `${year}${month}${day}T${endHour}${minute}00`
  const title   = encodeURIComponent(`Instalación persiana - ${order.address || 'Sin dirección'}`)
  const details = encodeURIComponent(
    `Cliente: ${order.profiles?.email || 'Sin email'}\n` +
    `Teléfono: ${order.phone || 'Sin teléfono'}\n` +
    `Dirección: ${order.address || 'Sin dirección'}\n` +
    `Pedido ID: ${order.id}\n` +
    `Total: ${fmt(order.total_with_iva)}`
  )
  const location = encodeURIComponent(order.address || '')
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`
}

export function calcAdminBudgetPrice({ prices, motorPrices, guidePricePerMl, instalacionPrice, instalacionFija,
  blindType, width, height, mechanism, motorType, guideType, colorGroup, installacion }) {
  if (!prices) return null

  if (blindType === 'solo_motor') {
    const motorCost        = motorPrices[motorType] ?? 0
    const installacionCost = installacion ? instalacionFija : 0
    const subtotalSinIva   = motorCost + installacionCost
    return { subtotalSinIva, iva: subtotalSinIva * 0.21, totalConIva: subtotalSinIva * 1.21 }
  }

  if (blindType === 'solo_guias') {
    const pricePerMl       = guidePricePerMl[guideType] ?? guidePricePerMl.v25
    const guidesCost       = 2 * (height / 1000) * pricePerMl
    const installacionCost = installacion ? instalacionFija : 0
    const subtotalSinIva   = guidesCost + installacionCost
    return { subtotalSinIva, iva: subtotalSinIva * 0.21, totalConIva: subtotalSinIva * 1.21 }
  }

  const areaSqm      = (width / 1000) * (height / 1000)
  const billableSqm  = Math.max(areaSqm, ADMIN_MIN_SQM)
  const productTable = prices[blindType]
  const pricePerSqm  = productTable?.[colorGroup] ?? productTable?.['Grupo Base'] ?? 0
  let guidesCost = 0
  if (guideType !== 'none' && blindType !== 'mosquitera_enrollable') {
    guidesCost = 2 * (height / 1000) * (guidePricePerMl[guideType] ?? 0)
  }
  const isPano           = ADMIN_PANO_TYPES.includes(blindType)
  const motorCost        = !isPano && mechanism === 'motor' ? (motorPrices[motorType] ?? 0) : 0
  const installacionCost = installacion ? instalacionPrice * billableSqm : 0
  const subtotalSinIva   = pricePerSqm * billableSqm + guidesCost + motorCost + installacionCost
  return { billableSqm, pricePerSqm, guidesCost, motorCost, installacionCost, subtotalSinIva, iva: subtotalSinIva * 0.21, totalConIva: subtotalSinIva * 1.21 }
}
