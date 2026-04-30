import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { supabase } from '../services/supabase/client'
import { useCart } from '../context/CartContext'
import { generateGroupBudgetPDF, generateGroupInvoicePDF, generateProQuotePDF, generateClientBudgetFromQuotePDF, generateClientInvoiceFromQuotePDF } from '../services/pdf'
import { generateInvoicePDF } from '../services/invoicePDF'
import { getProfessionalDiscountForUser } from '../services/settings'
import { getProductPrices, DEFAULT_MOTOR_PRICES, DEFAULT_GUIDE_PRICE_PER_ML, DEFAULT_INSTALACION_PRICE, DEFAULT_INSTALACION_FIJA, DEFAULT_PRICES } from '../services/prices'
import WAButton from '../shared/WAButton'

// ── Helpers ───────────────────────────────────────────────────────────────
const fmt     = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
const fmtDate = (d) => d ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—'
const uid     = () => Math.random().toString(36).slice(2, 10)

const BLIND_LABELS = {
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
const blindLabel = (t) => BLIND_LABELS[t] ?? t ?? '—'

const TEMPLATE_OPTS = [
  { id: 'azul',    label: 'Azul',    color: '#1e50a0' },
  { id: 'verde',   label: 'Verde',   color: '#146e41' },
  { id: 'grafito', label: 'Grafito', color: '#323744' },
  { id: 'ciruela', label: 'Ciruela', color: '#5f2882' },
]

// ── Lógica de precios para presupuestos profesionales ─────────────────────
const PRO_BLIND_TYPES = [
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
const PRO_MOTOR_ONLY = ['autoblocante', 'blocking', 'sistema_mini_autoblocante']
const PRO_NO_MOTOR   = ['mosquitera_enrollable', 'laminada']
const PRO_PANO_TYPES = ['laminada', 'autoblocante', 'blocking', 'mosquitera_enrollable']
const PRO_MIN_SQM    = 1.5

function calcProItemPrice({ prices, motorPrices, guidePricePerMl, instalacionPrice, instalacionFija, blindType, width, height, mechanism, motorType, guideType, colorGroup, installacion }) {
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

function processConfigurations(configs) {
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

const PROJECT_STATUS = {
  draft:    { label: 'Borrador',  cls: 'bg-gray-100 text-gray-600'    },
  sent:     { label: 'Enviado',   cls: 'bg-blue-100 text-blue-700'    },
  accepted: { label: 'Aceptado',  cls: 'bg-green-100 text-green-700'  },
  rejected: { label: 'Rechazado', cls: 'bg-red-100 text-red-700'      },
}

const ORDER_STATUS = {
  pending:   { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700'  },
  confirmed: { label: 'Confirmado', cls: 'bg-blue-100 text-blue-700'    },
  completed: { label: 'Completado', cls: 'bg-green-100 text-green-700'  },
  cancelled: { label: 'Cancelado',  cls: 'bg-red-100 text-red-700'      },
}

const TABS = [
  { id: 'overview',         label: 'Resumen',            icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
  { id: 'cotizaciones',     label: 'Cotiz. y clientes',  icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
  { id: 'mensajes',         label: 'Mensajes',           icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { id: 'pedidos',          label: 'Pedidos',            icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'empresa',          label: 'Mi empresa',         icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
]

// ── Componentes base ──────────────────────────────────────────────────────
function Badge({ status, map = PROJECT_STATUS }) {
  const s = map[status] ?? { label: status ?? '—', cls: 'bg-gray-100 text-gray-600' }
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
}

function Spinner({ small }) {
  return <span className={`inline-block border-2 border-current border-t-transparent rounded-full animate-spin ${small ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
}

function Field({ label, value, onChange, type = 'text', placeholder = '', required }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}{required && ' *'}
      </label>
      <input type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 transition-colors" />
    </div>
  )
}

function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      {action}
    </div>
  )
}

// ── Modal: Configurar y añadir persiana directamente ─────────────────────
function AddItemModal({ userId, onAdd, onClose, onConfigSaved }) {
  const [blindType,    setBlindType]    = useState('laminada')
  const [width,        setWidth]        = useState('')
  const [height,       setHeight]       = useState('')
  const [mechanism,    setMechanism]    = useState('muelle')
  const [motorType,    setMotorType]    = useState('mecanico')
  const [orientation,  setOrientation]  = useState('derecha')
  const [guideType,    setGuideType]    = useState('none')
  const [colorGroup,   setColorGroup]   = useState('Grupo Base')
  const [installacion, setInstallacion] = useState(false)
  const [desc,         setDesc]         = useState('')
  const [price,        setPrice]        = useState('')
  const [pricesData,   setPricesData]   = useState(null)
  const [priceEdited,  setPriceEdited]  = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [err,          setErr]          = useState('')

  useEffect(() => { getProductPrices().then(setPricesData) }, [])

  const requiresMotor = PRO_MOTOR_ONLY.includes(blindType)
  const noMotor       = PRO_NO_MOTOR.includes(blindType)
  const isSoloMot     = blindType === 'solo_motor'
  const isSoloGuia    = blindType === 'solo_guias'

  useEffect(() => {
    if (requiresMotor) setMechanism('motor')
    else if (noMotor && mechanism === 'motor') setMechanism('muelle')
  }, [blindType])

  useEffect(() => {
    if (priceEdited || !pricesData) return
    const w = parseFloat(width)
    const h = parseFloat(height)
    if (!isSoloMot && !isSoloGuia && (!w || !h || isNaN(w) || isNaN(h))) return
    if (isSoloGuia && (!h || isNaN(h))) return
    const calc = calcProItemPrice({ ...pricesData, blindType, width: w || 0, height: h || 0, mechanism, motorType, guideType, colorGroup, installacion })
    if (!isNaN(calc) && calc > 0) setPrice(calc.toFixed(2))
  }, [pricesData, blindType, width, height, mechanism, motorType, guideType, colorGroup, installacion, priceEdited])

  async function handleConfirm() {
    if (!isSoloMot && (!height || isNaN(parseFloat(height)))) { setErr('Introduce la altura'); return }
    if (!isSoloMot && !isSoloGuia && (!width || isNaN(parseFloat(width)))) { setErr('Introduce el ancho'); return }
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) { setErr('Precio inválido'); return }
    setSaving(true)
    const w = parseFloat(width) || null
    const h = parseFloat(height) || null
    const mechFinal        = isSoloMot ? 'motor' : mechanism
    const motorFinal       = (mechanism === 'motor' || requiresMotor || isSoloMot) ? motorType : null
    const orientationFinal = mechFinal === 'cinta' ? orientation : null
    const guideFinal       = guideType !== 'none' ? guideType : null
    const colorFinal     = (!isSoloMot && !isSoloGuia) ? colorGroup : null
    const costPrice      = parseFloat(price) / 1.21

    const { data: savedConfig } = await supabase.from('blind_configurations').insert({
      user_id:         userId,
      blind_type:      blindType,
      mechanism:       mechFinal,
      motor_type:      motorFinal,
      orientation:     orientationFinal,
      guide_type:      guideFinal,
      width:           isSoloMot ? null : w,
      height:          h,
      slat_color_name: colorFinal,
      estimated_price: costPrice,
    }).select().single()

    if (savedConfig) onConfigSaved?.(savedConfig)

    onAdd({
      item_id:         uid(),
      config_id:       savedConfig?.id ?? null,
      description:     desc.trim() || blindLabel(blindType),
      blind_type:      blindType,
      mechanism:       mechFinal,
      motor_type:      motorFinal,
      orientation:     orientationFinal,
      guide_type:      guideFinal,
      width:           isSoloMot ? null : w,
      height:          h,
      box_color_name:  null,
      slat_color_name: colorFinal,
      cost_price:      costPrice,
      client_price:    parseFloat(price),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Añadir persiana al presupuesto</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">

          {/* Tipo */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tipo de persiana</label>
            <select value={blindType} onChange={e => { setBlindType(e.target.value); setPriceEdited(false); setErr('') }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400">
              {PRO_BLIND_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          {/* Medidas */}
          {!isSoloMot && (
            <div className={`grid gap-3 ${isSoloGuia ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {!isSoloGuia && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Ancho (mm)</label>
                  <input type="number" min="1" value={width} onChange={e => { setWidth(e.target.value); setPriceEdited(false); setErr('') }} placeholder="1200"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Alto (mm)</label>
                <input type="number" min="1" value={height} onChange={e => { setHeight(e.target.value); setPriceEdited(false); setErr('') }} placeholder="1500"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400" />
              </div>
            </div>
          )}

          {/* Mecanismo */}
          {!isSoloMot && !isSoloGuia && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Mecanismo</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'muelle', label: 'Muelle', disabled: requiresMotor },
                  { id: 'cinta',  label: 'Cinta',  disabled: requiresMotor || noMotor },
                  { id: 'motor',  label: 'Motor',  disabled: noMotor },
                ].map(({ id, label, disabled }) => (
                  <button key={id} type="button" disabled={disabled}
                    onClick={() => { if (!disabled) { setMechanism(id); setPriceEdited(false) } }}
                    className={`py-2 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      mechanism === id ? 'border-red-600 bg-red-50 text-red-700'
                      : disabled ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Orientación cinta */}
          {mechanism === 'cinta' && !isSoloMot && !isSoloGuia && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Orientación de cinta</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'derecha',   label: 'Derecha' },
                  { id: 'izquierda', label: 'Izquierda' },
                ].map(({ id, label }) => (
                  <button key={id} type="button" onClick={() => setOrientation(id)}
                    className={`py-2 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      orientation === id ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Motor type */}
          {(mechanism === 'motor' || requiresMotor || isSoloMot) && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tipo de motor</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'mecanico',        label: 'Mecánico' },
                  { id: 'mando_distancia', label: 'Mando distancia' },
                ].map(({ id, label }) => (
                  <button key={id} type="button" onClick={() => { setMotorType(id); setPriceEdited(false) }}
                    className={`py-2 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      motorType === id ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Guías */}
          {!isSoloMot && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Guías</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'none', label: 'Sin guías' },
                  { id: 'v25',  label: 'Guía V25'  },
                  { id: 'h25',  label: 'Guía H25'  },
                ].map(({ id, label }) => (
                  <button key={id} type="button" onClick={() => { setGuideType(id); setPriceEdited(false) }}
                    className={`py-2 px-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                      guideType === id ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color group */}
          {!isSoloMot && !isSoloGuia && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Grupo de color</label>
              <select value={colorGroup} onChange={e => { setColorGroup(e.target.value); setPriceEdited(false) }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400">
                {['Grupo Base', 'Grupo 1', 'Grupo 2', 'Grupo 3'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}

          {/* Instalación */}
          <button type="button" onClick={() => { setInstallacion(v => !v); setPriceEdited(false) }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${installacion ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${installacion ? 'border-red-600 bg-red-600' : 'border-gray-300'}`}>
                {installacion && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className="text-sm font-medium text-gray-700">Con instalación</span>
            </div>
            <span className="text-xs text-gray-400">{isSoloMot ? '+150 €' : '+100 €/m²'}</span>
          </button>

          {/* Precio */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Precio para el cliente (€ con IVA)</label>
            <div className="relative">
              <input type="number" min="0" step="0.01" value={price}
                onChange={e => { setPrice(e.target.value); setPriceEdited(true); setErr('') }}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 pr-8 rounded-xl border border-gray-300 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
            </div>
            {price && !isNaN(parseFloat(price)) && parseFloat(price) > 0 && (
              <p className="text-xs text-gray-400 mt-1">Sin IVA: {fmt(parseFloat(price) / 1.21)}</p>
            )}
            {priceEdited && (
              <button type="button" onClick={() => setPriceEdited(false)} className="text-xs text-red-600 hover:underline mt-1 block">
                Recalcular automáticamente
              </button>
            )}
          </div>

          {/* Descripción */}
          <Field label="Descripción (opcional)" value={desc} onChange={setDesc} placeholder="Ej: Ventana salón, Puerta garaje…" />

          {err && <p className="text-xs text-red-600 font-medium">{err}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="button" onClick={handleConfirm} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-sm font-bold disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {saving ? <Spinner small /> : 'Añadir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal: Editar / ver proyecto ──────────────────────────────────────────
function ProjectModal({ project: initial, userId, empresa, logoUrl, onSave, onDelete, onClose, onConfigSaved }) {
  const [project,      setProject]      = useState({ ...initial })
  const [saving,       setSaving]       = useState(false)
  const [generating,   setGenerating]   = useState(null) // 'budget' | 'invoice'
  const [showAddItem,  setShowAddItem]  = useState(false)
  const [invoiceNumber,setInvoiceNumber]= useState(`F-${Date.now().toString().slice(-6)}`)
  const [showInvNum,   setShowInvNum]   = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [ivaPct,       setIvaPct]       = useState(initial.iva_pct ?? 21)

  const items    = project.items ?? []
  const total    = items.reduce((s, it) => s + (Number(it.client_price) || 0), 0)
  const isNew    = !initial.id

  function updateField(field, value) { setProject(p => ({ ...p, [field]: value })) }

  function updateItem(item_id, field, value) {
    setProject(p => ({
      ...p,
      items: (p.items ?? []).map(it => it.item_id === item_id ? { ...it, [field]: field === 'client_price' ? parseFloat(value) || 0 : value } : it),
    }))
  }

  function removeItem(item_id) {
    setProject(p => ({ ...p, items: (p.items ?? []).filter(it => it.item_id !== item_id) }))
  }

  function addItem(item) { setProject(p => ({ ...p, items: [...(p.items ?? []), item] })) }

  async function handleSave() {
    setSaving(true)
    const updated = { ...project, updated_at: new Date().toISOString() }
    const saved = await onSave(updated)
    // Si era nuevo, actualizar el id local para que handleBudget no inserte un duplicado
    if (saved?.id && !project.id) setProject(p => ({ ...p, id: saved.id }))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleBudget() {
    setGenerating('budget')
    const bNum = `PRO-${Date.now().toString().slice(-6)}`
    const updated = { ...project, budget_number: bNum, iva_pct: ivaPct }
    await generateGroupBudgetPDF({ project: updated, empresa, logoUrl, ivaPct })
    await onSave({ ...updated, status: project.status === 'draft' ? 'sent' : project.status })
    setProject(updated)
    setGenerating(null)
  }

  async function handleInvoice() {
    setGenerating('invoice')
    await generateGroupInvoicePDF({ project: { ...project, iva_pct: ivaPct }, empresa, logoUrl, invoiceNumber, ivaPct })
    await onSave({ ...project, iva_pct: ivaPct })
    setGenerating(null)
    setShowInvNum(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-mono">{project.budget_number ?? (isNew ? 'Nuevo presupuesto' : `#${project.id?.slice(0,8).toUpperCase()}`)}</p>
            <h2 className="text-lg font-bold text-gray-900 mt-0.5">{isNew ? 'Crear presupuesto' : (project.name || 'Presupuesto sin nombre')}</h2>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && <Badge status={project.status} />}
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Info básica */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre del proyecto" value={project.name ?? ''} onChange={v => updateField('name', v)} placeholder="Ej: Casa García - Calle Mayor" />
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Estado</label>
              <select value={project.status ?? 'draft'} onChange={e => updateField('status', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400">
                {Object.entries(PROJECT_STATUS).map(([k, { label }]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
          </div>

          {/* Datos del cliente */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Datos del cliente</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nombre *" value={project.client_name ?? ''} onChange={v => updateField('client_name', v)} placeholder="Juan García" />
              <Field label="NIF / DNI" value={project.client_nif ?? ''} onChange={v => updateField('client_nif', v)} placeholder="12345678A" />
              <Field label="Teléfono" value={project.client_phone ?? ''} onChange={v => updateField('client_phone', v)} placeholder="600 123 456" type="tel" />
              <Field label="Email" value={project.client_email ?? ''} onChange={v => updateField('client_email', v)} placeholder="cliente@email.com" type="email" />
              <div className="sm:col-span-2">
                <Field label="Dirección" value={project.client_address ?? ''} onChange={v => updateField('client_address', v)} placeholder="Calle Mayor 1, Santander" />
              </div>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notas internas</label>
            <textarea rows={2} value={project.notes ?? ''} onChange={e => updateField('notes', e.target.value)}
              placeholder="Observaciones, condiciones especiales…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 resize-none" />
          </div>

          {/* Ítems */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Persianas ({items.length})
              </p>
              <button onClick={() => setShowAddItem(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Añadir persiana
              </button>
            </div>

            {items.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                <p className="text-sm text-gray-400">Sin persianas. Pulsa "Añadir persiana" para empezar.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.item_id} className="bg-gray-50 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 bg-red-700 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                        <input
                          value={item.description ?? ''}
                          onChange={e => updateItem(item.item_id, 'description', e.target.value)}
                          placeholder="Descripción (opcional)"
                          className="flex-1 text-sm font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:bg-white focus:px-2 rounded-lg transition-all"
                        />
                      </div>
                      <p className="text-xs text-gray-400 ml-7">
                        {blindLabel(item.blind_type)} · {item.width}×{item.height} mm · {item.mechanism}
                        {item.box_color_name && ` · ${item.box_color_name}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="relative">
                        <input
                          type="number" min="0" step="0.01"
                          value={item.client_price ?? ''}
                          onChange={e => updateItem(item.item_id, 'client_price', e.target.value)}
                          className="w-24 px-2.5 py-1.5 pr-5 rounded-lg border border-gray-300 text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-red-100"
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                      </div>
                      <button onClick={() => removeItem(item.item_id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}

                {/* Total */}
                <div className="flex justify-end pt-2 border-t border-gray-200">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Sin IVA: {fmt(total / 1.21)}</p>
                    <p className="text-lg font-black text-red-700">Total: {fmt(total)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tipo IVA */}
          {items.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-gray-500">Tipo IVA para PDF:</span>
              {[21, 10, 4, 0].map(pct => (
                <button key={pct} onClick={() => setIvaPct(pct)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${ivaPct === pct ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                  {pct}%
                </button>
              ))}
            </div>
          )}

          {/* Acciones */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100">
            {/* Eliminar */}
            {!isNew && (
              <button onClick={() => { if (window.confirm('¿Eliminar este presupuesto?')) { onDelete(project.id); onClose() } }}
                className="sm:mr-auto px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">
                Eliminar
              </button>
            )}

            {/* Guardar */}
            <button onClick={handleSave} disabled={saving || !project.client_name?.trim()}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-40'}`}>
              {saving ? <Spinner small /> : saved ? '✓ Guardado' : 'Guardar presupuesto'}
            </button>

            {/* Presupuesto PDF */}
            {items.length > 0 && (
              <button onClick={handleBudget} disabled={!!generating || !project.client_name?.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold disabled:opacity-40 transition-colors">
                {generating === 'budget' ? <Spinner small /> : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                Presupuesto PDF
              </button>
            )}

            {/* Factura PDF */}
            {items.length > 0 && !showInvNum && (
              <button onClick={() => setShowInvNum(true)} disabled={!!generating || !project.client_name?.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-bold disabled:opacity-40 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Factura PDF
              </button>
            )}
          </div>

          {/* Campo nº factura inline */}
          {showInvNum && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-green-700 mb-1">Nº de factura</label>
                <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-green-300 text-sm focus:outline-none" />
              </div>
              <button onClick={handleInvoice} disabled={generating === 'invoice'}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-700 hover:bg-green-800 text-white text-sm font-bold transition-colors">
                {generating === 'invoice' ? <Spinner small /> : 'Generar'}
              </button>
              <button onClick={() => setShowInvNum(false)} className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {showAddItem && (
        <AddItemModal userId={userId} onAdd={addItem} onClose={() => setShowAddItem(false)} onConfigSaved={onConfigSaved} />
      )}
    </div>
  )
}

// ── Colores del borde izquierdo según estado ─────────────────────────────
const STATUS_BORDER = {
  draft:    'border-l-gray-300',
  sent:     'border-l-blue-400',
  accepted: 'border-l-green-500',
  rejected: 'border-l-red-400',
}

// ── Tarjeta de presupuesto colapsable ─────────────────────────────────────
function ProyectoCard({ p, pitems, total, onEdit }) {
  const [expanded, setExpanded] = useState(false)
  const borderColor = STATUS_BORDER[p.status] ?? STATUS_BORDER.draft

  return (
    <div className={`bg-white border border-gray-200 border-l-4 ${borderColor} rounded-2xl overflow-hidden transition-all hover:shadow-md`}>

      {/* ── Cabecera: siempre visible ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-5 py-4 flex items-center justify-between text-left gap-4"
      >
        {/* Izquierda: nombre + resumen */}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900 truncate leading-tight">
            {p.name || 'Presupuesto sin nombre'}
          </p>
          <p className="text-sm text-gray-500 mt-0.5 truncate">
            {[
              p.client_name,
              pitems.length > 0 ? `${pitems.length} persiana${pitems.length > 1 ? 's' : ''}` : null,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* Derecha: total + badge + flecha */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-base font-black text-gray-900">{fmt(total)}</span>
          <Badge status={p.status} />
          <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Detalle expandido ── */}
      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-100 space-y-4">

          {/* Datos de contacto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4 text-sm">
            {p.client_phone   && <p className="text-gray-600"><span className="font-semibold text-gray-400 text-xs uppercase tracking-wide mr-1">Tel</span>{p.client_phone}</p>}
            {p.client_email   && <p className="text-gray-600"><span className="font-semibold text-gray-400 text-xs uppercase tracking-wide mr-1">Email</span>{p.client_email}</p>}
            {p.client_address && <p className="text-gray-600 sm:col-span-2"><span className="font-semibold text-gray-400 text-xs uppercase tracking-wide mr-1">Dir</span>{p.client_address}</p>}
            {p.budget_number  && <p className="text-gray-400 text-xs font-mono sm:col-span-2">{p.budget_number}</p>}
          </div>

          {/* Persianas incluidas */}
          {pitems.length > 0 && (
            <div className="space-y-1.5">
              {pitems.map((it, i) => (
                <div key={it.item_id ?? i} className="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-3 py-2">
                  <span className="text-gray-700">
                    <span className="font-bold text-gray-400 mr-2">{i + 1}.</span>
                    {it.description || blindLabel(it.blind_type)}
                  </span>
                  {it.client_price ? <span className="font-bold text-gray-800 flex-shrink-0 ml-2">{fmt(it.client_price)}</span> : null}
                </div>
              ))}
            </div>
          )}

          {/* Notas */}
          {p.notes && (
            <p className="text-sm text-gray-400 italic border-l-2 border-gray-200 pl-3">{p.notes}</p>
          )}

          {/* Botón editar */}
          <button onClick={onEdit}
            className="w-full py-2.5 rounded-xl text-sm font-bold bg-gray-900 hover:bg-gray-800 text-white transition-colors">
            Abrir y editar presupuesto →
          </button>
        </div>
      )}
    </div>
  )
}

// ── Tab Mis Compras (cotizaciones de Persianas Santander) ─────────────────
const QUOTE_STATUS = {
  pending:  { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700'  },
  accepted: { label: 'Aceptado',   cls: 'bg-green-100 text-green-700'  },
  modified: { label: 'Modificado', cls: 'bg-blue-100 text-blue-700'    },
  rejected: { label: 'Rechazado',  cls: 'bg-red-100 text-red-700'      },
}

function CotizacionesTab({ cotizaciones, configuraciones, setConfiguraciones, onDelete, onUpdate, proInfo, logoUrl, globalDiscount = 0 }) {
  const [expandedId,       setExpandedId]       = useState(null)
  const [deletingId,       setDeletingId]        = useState(null)
  const [confirmId,        setConfirmId]         = useState(null)
  const [downloadingId,    setDownloadingId]     = useState(null)
  const [editMargin,         setEditMargin]         = useState({})
  const [editWorkNotes,      setEditWorkNotes]      = useState({})
  const [editExtras,         setEditExtras]         = useState({})
  const [editClientComments, setEditClientComments] = useState({})
  const [editIvaPct,         setEditIvaPct]         = useState({})
  const [savingClient,       setSavingClient]       = useState({})
  const [savedClient,        setSavedClient]        = useState({})
  const [downloadingClient,  setDownloadingClient]  = useState({})
  const [acceptingClient,    setAcceptingClient]    = useState({})
  const [invoiceNums,        setInvoiceNums]        = useState({})
  const [generatingInv,      setGeneratingInv]      = useState({})
  const [editTemplate,       setEditTemplate]       = useState({})
  const [editClientInfo,     setEditClientInfo]     = useState({})

  async function handleDelete(id) {
    setDeletingId(id)
    await supabase.from('pro_purchase_quotes').delete().eq('id', id)
    setDeletingId(null); setConfirmId(null)
    onDelete?.(id)
  }

  async function handleDownload(q) {
    setDownloadingId(q.id)
    try {
      const doc = await generateProQuotePDF(q, proInfo ?? {})
      doc?.save(`Cotizacion_${(q.id ?? '').slice(0, 8).toUpperCase()}.pdf`)
    } catch {}
    setDownloadingId(null)
  }

  async function handleGenerateInvoice(q) {
    setGeneratingInv(p => ({ ...p, [q.id]: true }))
    try {
      const margin   = parseFloat(q.client_margin_pct ?? editMargin[q.id] ?? 0)
      const extras   = parseFloat(editExtras[q.id] !== undefined ? editExtras[q.id] : (q.extras_amount ?? 0)) || 0
      const comments = editClientComments[q.id] !== undefined ? editClientComments[q.id] : (q.client_comments ?? null)
      const ivaPct   = parseFloat(editIvaPct[q.id] !== undefined ? editIvaPct[q.id] : (q.iva_pct ?? 21))
      const invNum   = invoiceNums[q.id] || `FAC-${(q.id ?? '').slice(0, 8).toUpperCase()}`
      const tpl = editTemplate[q.id] ?? 'azul'
      const doc = await generateClientInvoiceFromQuotePDF({
        quote: q, proInfo: proInfo ?? {}, marginPct: margin, extrasAmount: extras, clientComments: comments, ivaPct, logoUrl, invoiceNumber: invNum, templateId: tpl,
      })
      doc?.save(`Factura_cliente_${invNum}.pdf`)
    } catch {}
    setGeneratingInv(p => ({ ...p, [q.id]: false }))
  }

  async function handleSaveClientData(id, adminTotal, currentMarginPct, currentWorkNotes, currentClientInfo, currentExtras, currentClientComments, currentIvaPct) {
    setSavingClient(p => ({ ...p, [id]: true }))
    const margin      = parseFloat(editMargin[id] !== undefined ? editMargin[id] : (currentMarginPct ?? 0))
    const extras      = parseFloat(editExtras[id] !== undefined ? editExtras[id] : (currentExtras ?? 0)) || 0
    const ivaPct      = parseFloat(editIvaPct[id] !== undefined ? editIvaPct[id] : (currentIvaPct ?? 21))
    const clientTotal = parseFloat(adminTotal) * (1 + margin / 100) + extras
    const notes       = editWorkNotes[id] !== undefined ? editWorkNotes[id] : (currentWorkNotes ?? null)
    const comments    = editClientComments[id] !== undefined ? editClientComments[id] : (currentClientComments ?? null)
    const ci          = editClientInfo[id] !== undefined ? editClientInfo[id] : (currentClientInfo ?? null)
    const updates     = { client_margin_pct: margin, client_total: clientTotal, extras_amount: extras, iva_pct: ivaPct }
    if (notes !== null) updates.work_notes = notes.trim() || null
    if (comments !== null) updates.client_comments = comments.trim() || null
    if (ci !== null) updates.client_info = Object.values(ci).some(v => v?.trim()) ? ci : null
    const { error } = await supabase.from('pro_purchase_quotes').update(updates).eq('id', id)
    if (!error) {
      onUpdate?.(id, updates)
      setSavedClient(p => ({ ...p, [id]: true }))
      setTimeout(() => setSavedClient(p => ({ ...p, [id]: false })), 2000)
    }
    setSavingClient(p => ({ ...p, [id]: false }))
  }

  async function handleClientAccepted(id) {
    setAcceptingClient(p => ({ ...p, [id]: true }))
    const now = new Date().toISOString()
    await supabase.from('pro_purchase_quotes').update({ client_status: 'accepted', client_accepted_at: now }).eq('id', id)
    onUpdate?.(id, { client_status: 'accepted', client_accepted_at: now })
    setAcceptingClient(p => ({ ...p, [id]: false }))
  }

  async function handleDownloadClientPDF(q) {
    setDownloadingClient(p => ({ ...p, [q.id]: true }))
    const margin   = parseFloat(editMargin[q.id] !== undefined ? editMargin[q.id] : (q.client_margin_pct ?? 0))
    const extras   = parseFloat(editExtras[q.id] !== undefined ? editExtras[q.id] : (q.extras_amount ?? 0)) || 0
    const comments = editClientComments[q.id] !== undefined ? editClientComments[q.id] : (q.client_comments ?? null)
    const ivaPct   = parseFloat(editIvaPct[q.id] !== undefined ? editIvaPct[q.id] : (q.iva_pct ?? 21))
    try {
      const tpl = editTemplate[q.id] ?? 'azul'
      const doc = await generateClientBudgetFromQuotePDF({ quote: q, proInfo: proInfo ?? {}, marginPct: margin, extrasAmount: extras, clientComments: comments, ivaPct, logoUrl, templateId: tpl })
      doc?.save(`Presupuesto_${(q.id ?? '').slice(0, 8).toUpperCase()}.pdf`)
    } catch {}
    setDownloadingClient(p => ({ ...p, [q.id]: false }))
  }

  if (cotizaciones.length === 0) return (
    <div className="space-y-4">
      <SectionHeader title="Cotizaciones y presupuestos" />
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
        <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
          </svg>
        </div>
        <p className="font-semibold text-gray-700 mb-1">Sin cotizaciones todavía</p>
        <p className="text-sm text-gray-400">Cuando guardes una configuración se generará tu cotización de compra y el presupuesto para tu cliente.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <SectionHeader title="Cotizaciones y presupuestos" />
      <div className="space-y-3">
        {cotizaciones.map(q => {
          const st         = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.pending
          const adminTotal = q.admin_total_con_iva ?? q.total_con_iva ?? 0
          const isOpen     = expandedId === q.id
          const isAccepted = q.status === 'accepted' || q.status === 'modified'
          const clientMargin = parseFloat(editMargin[q.id] !== undefined ? editMargin[q.id] : (q.client_margin_pct ?? 0))
          const extras       = parseFloat(editExtras[q.id] !== undefined ? editExtras[q.id] : (q.extras_amount ?? 0)) || 0
          const clientTotal  = adminTotal * (1 + clientMargin / 100) + extras
          const clientAccepted = q.client_status === 'accepted'
          return (
            <div key={q.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {/* Cabecera colapsable */}
              <button onClick={() => setExpandedId(isOpen ? null : q.id)}
                className="w-full px-4 py-4 flex items-center justify-between gap-3 text-left">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    {clientAccepted && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Cliente ✓</span>
                    )}
                    <span className="text-xs text-gray-400">{fmtDate(q.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-600">{(q.items ?? []).length} persiana{(q.items ?? []).length !== 1 ? 's' : ''} · Dto. {q.discount_pct}%</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-base font-black text-red-700">{fmt(adminTotal)}</span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-5 pt-1 border-t border-gray-100 space-y-3">

                  {/* ── SECCIÓN 1: Tu compra a Santander ── */}
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide pt-1">Tu compra a Persianas Santander</p>
                  <div className="space-y-2">
                    {(q.items ?? []).map((it, i) => (
                      <div key={i} className="flex items-start justify-between bg-gray-50 rounded-xl px-3 py-2 text-sm gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800">{blindLabel(it.blind_type)}</p>
                          <p className="text-xs text-gray-400">
                            {it.width && it.height ? `${it.width}×${it.height} mm` : ''}
                            {it.mechanism ? ` · ${it.mechanism}` : ''}
                            {it.mechanism === 'cinta' && it.orientation ? ` (${it.orientation})` : ''}
                            {it.mechanism === 'motor' && it.motor_type ? ` · ${it.motor_type}` : ''}
                            {it.guide_type && it.guide_type !== 'none' ? ` · guía ${it.guide_type}` : ''}
                          </p>
                          <p className="text-xs text-gray-400">
                            {['sistema_mini_cajon_pvc','sistema_mini_cajon_aluminio','sistema_mini_autoblocante'].includes(it.blind_type)
                              ? [it.box_color_name ? `Cajón: ${it.box_color_name}` : '', it.slat_color_name ? `Lamas: ${it.slat_color_name}` : ''].filter(Boolean).join(' · ')
                              : it.blind_type !== 'solo_motor' && it.slat_color_name ? `Color: ${it.slat_color_name}` : ''}
                            {it.installacion ? ' · Con instalación' : ''}
                          </p>
                        </div>
                        <span className="font-bold text-gray-700 flex-shrink-0">{fmt(it.price_professional * 1.21)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-4 text-sm border-t border-gray-100 pt-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Sin IVA</p>
                      <p className="font-semibold text-gray-700">{fmt(adminTotal / 1.21)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Total con IVA</p>
                      <p className="font-black text-red-700 text-base">{fmt(adminTotal)}</p>
                    </div>
                  </div>

                  {q.admin_notes && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                      <p className="text-xs font-semibold text-blue-700 mb-1">Nota de Persianas Santander</p>
                      <p className="text-sm text-blue-800">{q.admin_notes}</p>
                    </div>
                  )}

                  {isAccepted ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-sm text-green-700 font-medium">Cotización aceptada por Persianas Santander.</p>
                    </div>
                  ) : q.status === 'rejected' ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      <p className="text-sm text-red-700">Cotización rechazada. Contacta con nosotros.</p>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <p className="text-sm text-amber-700">En revisión por Persianas Santander. Te notificaremos.</p>
                    </div>
                  )}

                  {/* ── SECCIÓN 2: Presupuesto para tu cliente ── */}
                  <div className="mt-1 pt-3 border-t border-blue-100 bg-blue-50/40 rounded-xl px-3 py-3 space-y-3">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Presupuesto para tu cliente</p>

                    {/* Margen */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-600">Tu margen:</span>
                        <div className="relative">
                          <input
                            type="number" min="0" max="500" step="1"
                            value={editMargin[q.id] !== undefined ? editMargin[q.id] : (q.client_margin_pct ?? 0)}
                            onChange={e => setEditMargin(p => ({ ...p, [q.id]: e.target.value }))}
                            className="w-16 px-2 py-1 pr-4 rounded-lg border border-gray-300 text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-300"
                          />
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                        </div>
                        <span className="text-xs text-gray-400">o</span>
                        <div className="relative">
                          <input
                            type="number" min="0" step="0.01"
                            value={adminTotal > 0 ? (adminTotal * (parseFloat(editMargin[q.id] !== undefined ? editMargin[q.id] : (q.client_margin_pct ?? 0)) / 100)).toFixed(2) : '0.00'}
                            onChange={e => {
                              const eur = parseFloat(e.target.value) || 0
                              const pct = adminTotal > 0 ? (eur / adminTotal) * 100 : 0
                              setEditMargin(p => ({ ...p, [q.id]: pct.toFixed(4) }))
                            }}
                            className="w-20 px-2 py-1 pr-4 rounded-lg border border-gray-300 text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-300"
                          />
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                        </div>
                      </div>

                      {/* Extras */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-600">Trabajos extra:</span>
                        <div className="relative">
                          <input
                            type="number" min="0" step="0.01"
                            value={editExtras[q.id] !== undefined ? editExtras[q.id] : (q.extras_amount ?? 0)}
                            onChange={e => setEditExtras(p => ({ ...p, [q.id]: e.target.value }))}
                            className="w-24 px-2 py-1 pr-4 rounded-lg border border-gray-300 text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-300"
                          />
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                        </div>
                        <span className="text-xs text-gray-400">→ Total cliente:</span>
                        <span className="text-sm font-black text-blue-700">{fmt(clientTotal)}</span>
                      </div>

                      {/* IVA */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-600">IVA:</span>
                        {[21, 10, 4, 0].map(pct => (
                          <button key={pct}
                            onClick={() => setEditIvaPct(p => ({ ...p, [q.id]: pct }))}
                            className={`px-2 py-0.5 rounded-lg text-xs font-bold border transition-colors ${(editIvaPct[q.id] !== undefined ? editIvaPct[q.id] : (q.iva_pct ?? 21)) === pct ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                            {pct}%
                          </button>
                        ))}
                        <button onClick={() => handleSaveClientData(q.id, adminTotal, q.client_margin_pct, q.work_notes, q.client_info, q.extras_amount, q.client_comments, q.iva_pct)} disabled={savingClient[q.id] || savedClient[q.id]}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 ${savedClient[q.id] ? 'bg-green-600 text-white' : 'bg-blue-700 hover:bg-blue-800 text-white'}`}>
                          {savingClient[q.id] ? '…' : savedClient[q.id] ? '✓ Guardado' : 'Guardar'}
                        </button>
                      </div>
                    </div>

                    {/* Datos del cliente final */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600 block">Datos del cliente final</label>
                      {[
                        { key: 'nombre',    placeholder: 'Nombre o razón social' },
                        { key: 'nif',       placeholder: 'NIF / DNI' },
                        { key: 'direccion', placeholder: 'Dirección completa' },
                        { key: 'email',     placeholder: 'Email' },
                      ].map(({ key, placeholder }) => {
                        const ci = editClientInfo[q.id] ?? q.client_info ?? {}
                        return (
                          <input key={key} type="text" placeholder={placeholder}
                            value={ci[key] ?? ''}
                            onChange={e => setEditClientInfo(p => ({
                              ...p,
                              [q.id]: { ...(p[q.id] ?? q.client_info ?? {}), [key]: e.target.value }
                            }))}
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-200 bg-white"
                          />
                        )
                      })}
                    </div>

                    {/* Comentarios para el cliente — aparecen en el PDF */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">
                        Comentarios para el cliente <span className="text-gray-400 font-normal">(aparecen en el presupuesto)</span>
                      </label>
                      <textarea
                        value={editClientComments[q.id] !== undefined ? editClientComments[q.id] : (q.client_comments ?? '')}
                        onChange={e => setEditClientComments(p => ({ ...p, [q.id]: e.target.value }))}
                        placeholder="Descripción de los trabajos, condiciones, materiales, plazos de entrega…"
                        rows={4}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 resize-y bg-white"
                      />
                    </div>

                    {/* Notas de trabajo — solo visibles internamente para el admin */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">
                        Notas de trabajo <span className="text-gray-400 font-normal">(internas — solo las ve Persianas Santander)</span>
                      </label>
                      <textarea
                        value={editWorkNotes[q.id] !== undefined ? editWorkNotes[q.id] : (q.work_notes ?? '')}
                        onChange={e => setEditWorkNotes(p => ({ ...p, [q.id]: e.target.value }))}
                        placeholder="Instalación en 2ª planta, requiere desmontaje previo, características especiales…"
                        rows={2}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 resize-none bg-white"
                      />
                    </div>

                    {/* Selector de plantilla PDF */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-400 shrink-0">Plantilla:</span>
                      {TEMPLATE_OPTS.map(t => {
                        const sel = (editTemplate[q.id] ?? 'azul') === t.id
                        return (
                          <button key={t.id}
                            onClick={() => setEditTemplate(p => ({ ...p, [q.id]: t.id }))}
                            title={t.label}
                            style={sel ? { backgroundColor: t.color, borderColor: t.color } : {}}
                            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-all ${sel ? 'text-white' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sel ? 'rgba(255,255,255,0.5)' : t.color }} />
                            {t.label}
                          </button>
                        )
                      })}
                    </div>

                    {/* Acciones cliente */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => handleDownloadClientPDF(q)} disabled={downloadingClient[q.id]}
                        className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                        {downloadingClient[q.id]
                          ? <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        }
                        PDF para cliente
                      </button>

                      {clientAccepted ? (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Cliente aceptó · {fmtDate(q.client_accepted_at)}
                        </div>
                      ) : (
                        <button onClick={() => handleClientAccepted(q.id)} disabled={acceptingClient[q.id]}
                          className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                          {acceptingClient[q.id]
                            ? <span className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          }
                          Mi cliente ha aceptado
                        </button>
                      )}
                    </div>

                    {/* Factura para cliente — solo cuando ambos han aceptado */}
                    {clientAccepted && isAccepted && (
                      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-blue-100 mt-1">
                        <span className="text-xs text-blue-600 font-medium">Factura cliente:</span>
                        <input
                          type="text"
                          value={invoiceNums[q.id] ?? `FAC-${(q.id ?? '').slice(0, 8).toUpperCase()}`}
                          onChange={e => setInvoiceNums(p => ({ ...p, [q.id]: e.target.value }))}
                          className="w-36 border border-blue-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
                          placeholder="Nº factura"
                        />
                        <button onClick={() => handleGenerateInvoice(q)} disabled={generatingInv[q.id]}
                          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                          {generatingInv[q.id]
                            ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          }
                          Generar factura
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Acciones generales */}
                  <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                    {isAccepted && (
                      <button onClick={() => handleDownload(q)} disabled={downloadingId === q.id}
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
                        {downloadingId === q.id
                          ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        }
                        PDF cotización Santander
                      </button>
                    )}
                    <div className="ml-auto">
                      {confirmId === q.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-600 font-medium">¿Eliminar?</span>
                          <button onClick={() => handleDelete(q.id)} disabled={deletingId === q.id}
                            className="text-xs font-bold text-red-600 hover:text-red-800 disabled:opacity-50">
                            {deletingId === q.id ? '…' : 'Sí'}
                          </button>
                          <button onClick={() => setConfirmId(null)} className="text-xs text-gray-500">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmId(q.id)}
                          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Configuraciones guardadas ── */}
      <div className="pt-2">
        <ConfiguracionesTab configuraciones={configuraciones ?? []} setConfiguraciones={setConfiguraciones} globalDiscount={globalDiscount} />
      </div>
    </div>
  )
}

// ── Tab Mensajes (chat en tiempo real con Santander) ──────────────────────
function MensajesTab({ userId, onRead }) {
  const [messages,  setMessages]  = useState([])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(true)
  const [sending,   setSending]   = useState(false)
  const [hoverId,   setHoverId]   = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    loadMessages()
    const channel = supabase
      .channel(`pro-chat-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pro_messages',
        filter: `professional_user_id=eq.${userId}` },
        (payload) => setMessages(prev => [...prev, payload.new])
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pro_messages',
        filter: `professional_user_id=eq.${userId}` },
        (payload) => setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    const { data } = await supabase
      .from('pro_messages')
      .select('*')
      .eq('professional_user_id', userId)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setLoading(false)
    await supabase.from('pro_messages')
      .update({ read_by_professional: true })
      .eq('professional_user_id', userId)
      .eq('sender_role', 'admin')
    onRead?.()
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || sending) return
    setSending(true)
    const text = input.trim()
    setInput('')
    await supabase.from('pro_messages').insert({
      professional_user_id: userId,
      sender_id:            userId,
      sender_role:          'professional',
      message:              text,
      read_by_admin:        false,
      read_by_professional: true,
    })
    setSending(false)
  }

  async function handleDelete(id) {
    setMessages(prev => prev.filter(m => m.id !== id))
    await supabase.from('pro_messages').delete().eq('id', id)
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Mensajes" />
      <div className="bg-white rounded-2xl border border-gray-200 flex flex-col h-[60vh] sm:h-[65vh]">
        {/* Cabecera */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-red-700 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Persianas Santander</p>
            <p className="text-xs text-gray-400">Chat directo con el equipo</p>
          </div>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-sm text-gray-400">Ningún mensaje todavía.</p>
              <p className="text-xs text-gray-300 mt-1">Escríbenos cualquier consulta sobre tu cotización o pedido.</p>
            </div>
          ) : (
            messages.map(m => {
              const isMe = m.sender_role === 'professional'
              return (
                <div
                  key={m.id}
                  className={`flex items-end gap-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}
                  onMouseEnter={() => setHoverId(m.id)}
                  onMouseLeave={() => setHoverId(null)}
                >
                  {/* Botón eliminar — solo mis mensajes, visible al hover */}
                  {isMe && hoverId === m.id && (
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="p-1 rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0 mb-1"
                      title="Eliminar mensaje"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                    isMe ? 'bg-red-700 text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}>
                    <p className="leading-relaxed">{m.message}</p>
                    <p className={`text-xs mt-1 ${isMe ? 'text-red-200' : 'text-gray-400'}`}>
                      {new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="px-4 py-3 border-t border-gray-100 flex items-center gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Escribe un mensaje…"
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400"
          />
          <button type="submit" disabled={!input.trim() || sending}
            className="w-10 h-10 bg-red-700 hover:bg-red-800 text-white rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Tab Proyectos ─────────────────────────────────────────────────────────
function ProyectosTab({ proyectos, setProyectos, empresa, logoUrl, user, onConfigSaved }) {
  const [modal,  setModal]  = useState(null)
  const [search, setSearch] = useState('')

  const EMPTY_PROJECT = {
    user_id:        user?.id,
    name:           '',
    client_name:    '',
    client_phone:   '',
    client_email:   '',
    client_address: '',
    client_nif:     '',
    notes:          '',
    status:         'draft',
    items:          [],
    budget_number:  null,
  }

  async function saveProject(updated) {
    if (!updated.id) {
      // Crear
      const { data, error } = await supabase.from('pro_projects').insert({ ...updated, user_id: user.id }).select().single()
      if (!error && data) setProyectos(prev => [data, ...prev])
      return data ?? null
    } else {
      // Actualizar
      const { data, error } = await supabase.from('pro_projects').update(updated).eq('id', updated.id).select().single()
      if (!error && data) setProyectos(prev => prev.map(p => p.id === data.id ? data : p))
      return data ?? null
    }
  }

  async function deleteProject(id) {
    await supabase.from('pro_projects').delete().eq('id', id)
    setProyectos(prev => prev.filter(p => p.id !== id))
  }

  const filtered = proyectos.filter(p => {
    const q = search.toLowerCase()
    return !q || p.name?.toLowerCase().includes(q) || p.client_name?.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Presupuestos"
        action={
          <button onClick={() => setModal(EMPTY_PROJECT)}
            className="flex items-center gap-2 text-sm font-bold bg-red-700 text-white px-4 py-2 rounded-xl hover:bg-red-800 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo presupuesto
          </button>
        }
      />

      {/* Buscador */}
      <div className="relative">
        <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre de obra o cliente…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 bg-white" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <p className="font-semibold text-gray-700 mb-1">{search ? 'Sin resultados' : 'Todavía no hay presupuestos'}</p>
          <p className="text-sm text-gray-400 mb-5">
            {search ? 'Prueba con otro nombre o cliente' : 'Crea tu primer presupuesto para agrupar persianas de un cliente.'}
          </p>
          {!search && (
            <button onClick={() => setModal(EMPTY_PROJECT)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-700 text-white text-sm font-bold rounded-xl hover:bg-red-800 transition-colors">
              + Nuevo presupuesto
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const pitems = p.items ?? []
            const total  = pitems.reduce((s, it) => s + (Number(it.client_price) || 0), 0)
            return (
              <ProyectoCard
                key={p.id}
                p={p}
                pitems={pitems}
                total={total}
                onEdit={() => setModal(p)}
              />
            )
          })}
        </div>
      )}

      {modal && (
        <ProjectModal
          project={modal}
          userId={user.id}
          empresa={empresa}
          logoUrl={logoUrl}
          onSave={saveProject}
          onDelete={deleteProject}
          onClose={() => setModal(null)}
          onConfigSaved={onConfigSaved}
        />
      )}
    </div>
  )
}

// ── Tarjeta de configuración con carrito ──────────────────────────────────
function ProConfigCard({ c, onDelete, deleting, isExpanded, onToggle, globalDiscount = 0 }) {
  const navigate               = useNavigate()
  const { addToCart, items: cartItems, orderedConfigIds } = useCart()
  const [adding,     setAdding]    = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const inCart    = cartItems.some(ci => ci.configuration_id === c.id)
  const isOrdered = !inCart && orderedConfigIds.has(c.id)
  const added     = inCart || isOrdered

  async function handleAddToCart() {
    setAdding(true)
    const { error } = await addToCart(c.id)
    setAdding(false)
    if (!error) setTimeout(() => navigate('/cesta'), 600)
  }

  const borderCls = added
    ? 'bg-green-50 border-green-200'
    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${borderCls}`}>
      {/* ── Cabecera colapsable ── */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {added ? (
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          )}
          <span className={`text-xs font-bold truncate ${added ? 'text-green-700' : 'text-gray-800'}`}>
            {added ? 'En cesta · ' : ''}{blindLabel(c.blind_type)}
          </span>
          {!added && c.width && c.height && (
            <span className="text-xs text-gray-400">· {c.width}×{c.height}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className={`text-sm font-black ${added ? 'text-green-700' : 'text-red-700'}`}>{fmt((c.estimated_price ?? 0) * (1 - globalDiscount / 100))}</span>
          <span className="text-xs text-gray-400">{fmtDate(c.created_at)}</span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Detalle expandido ── */}
      {isExpanded && (
        <div className={`px-4 pb-4 pt-3 border-t space-y-3 ${added ? 'border-green-100' : 'border-gray-100'}`}>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {c.width && c.height && <span>{c.width} × {c.height} mm</span>}
            {c.mechanism && <span>
              {c.mechanism}
              {c.mechanism === 'cinta' && c.orientation ? ` (${c.orientation})` : ''}
              {c.mechanism === 'motor' && c.motor_type ? ` · ${c.motor_type}` : ''}
            </span>}
            {c.guide_type && c.guide_type !== 'none' && <span>guía {c.guide_type}</span>}
            {c.slat_color_name && <span>{c.slat_color_name}</span>}
          </div>

          {isOrdered ? (
            <button disabled className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-green-100 text-green-700 cursor-default flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Ya pedida
            </button>
          ) : added ? (
            <button onClick={() => navigate('/cesta')}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-green-600 text-white hover:bg-green-700 transition-colors">
              Ir a la cesta →
            </button>
          ) : (
            <button onClick={handleAddToCart} disabled={adding}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-60 transition-colors">
              {adding ? <Spinner small /> : (
                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>Añadir a la cesta</>
              )}
            </button>
          )}

          <div className="flex gap-2">
            <button onClick={() => navigate('/configurador')}
              className="flex-1 text-xs font-semibold py-2 px-3 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
              Nueva similar
            </button>
            {confirmDel ? (
              <div className="flex gap-1.5">
                <button onClick={() => setConfirmDel(false)}
                  className="text-xs font-semibold py-2 px-3 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={() => onDelete(c.id)} disabled={deleting === c.id}
                  className="text-xs font-bold py-2 px-3 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center gap-1.5">
                  {deleting === c.id ? <Spinner small /> : null}Eliminar
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(true)}
                className="text-xs font-semibold py-2 px-3 rounded-lg border border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de grupo (varias persianas de una sesión) ────────────────────
function ProGroupCard({ items, onDeleteGroup, deleting, isExpanded, onToggle, globalDiscount = 0 }) {
  const { addToCart, items: cartItems, orderedConfigIds } = useCart()
  const navigate = useNavigate()
  const [adding,  setAdding] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const total      = items.reduce((s, c) => s + (c.estimated_price ?? 0) * (1 - globalDiscount / 100), 0)
  const inCart     = cartItems.length > 0 && items.every(c => cartItems.some(ci => ci.configuration_id === c.id))
  const isOrdered  = !inCart && items.every(c => orderedConfigIds.has(c.id))
  const allInCart  = inCart || isOrdered

  async function handleAddAllToCart() {
    setAdding(true)
    for (const c of items) await addToCart(c.id)
    setAdding(false)
    setTimeout(() => navigate('/cesta'), 600)
  }

  const borderCls = allInCart
    ? 'bg-green-50 border-green-200'
    : 'bg-white border-red-100 hover:border-red-200 hover:shadow-sm'

  return (
    <div className={`border-2 rounded-2xl overflow-hidden transition-all ${borderCls}`}>
      {/* ── Cabecera siempre visible (toggle) ── */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {allInCart ? (
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          )}
          <span className={`text-xs font-bold truncate ${allInCart ? 'text-green-700' : 'text-red-700'}`}>
            {allInCart ? 'En cesta · ' : ''}Grupo · {items.length} persianas
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className={`text-sm font-black ${allInCart ? 'text-green-700' : 'text-red-700'}`}>{fmt(total)}</span>
          <span className="text-xs text-gray-400">{fmtDate(items[0].created_at)}</span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Detalle expandido ── */}
      {isExpanded && (
        <div className={`px-4 pb-4 pt-3 border-t space-y-3 ${allInCart ? 'border-green-100' : 'border-gray-100'}`}>
          {/* Lista */}
          <div className="space-y-2">
            {items.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold flex-shrink-0 text-[10px] ${allInCart ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{blindLabel(c.blind_type)}</p>
                  {c.width && c.height && <p className="text-gray-400">
                    {c.width} × {c.height} mm
                    {c.mechanism ? ` · ${c.mechanism}` : ''}
                    {c.mechanism === 'cinta' && c.orientation ? ` (${c.orientation})` : ''}
                    {c.mechanism === 'motor' && c.motor_type ? ` · ${c.motor_type}` : ''}
                    {c.guide_type && c.guide_type !== 'none' ? ` · guía ${c.guide_type}` : ''}
                  </p>}
                </div>
                <span className="font-bold text-gray-700 flex-shrink-0">{fmt((c.estimated_price ?? 0) * (1 - globalDiscount / 100))}</span>
              </div>
            ))}
          </div>

          {/* Acciones */}
          {isOrdered ? (
            <button disabled className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-green-100 text-green-700 cursor-default flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Ya pedido
            </button>
          ) : allInCart ? (
            <button onClick={() => navigate('/cesta')}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-green-600 text-white hover:bg-green-700 transition-colors">
              Ir a la cesta →
            </button>
          ) : (
            <>
              <button onClick={handleAddAllToCart} disabled={adding}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-60"
              >
                {adding ? <Spinner small /> : (
                  <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>Añadir todo a la cesta</>
                )}
              </button>
              <div className="flex justify-end">
                {confirm ? (
                  <div className="flex gap-1.5">
                    <button onClick={() => setConfirm(false)}
                      className="text-xs font-semibold py-2 px-3 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
                      Cancelar
                    </button>
                    <button onClick={onDeleteGroup} disabled={!!deleting}
                      className="text-xs font-bold py-2 px-3 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center gap-1.5">
                      {deleting ? <Spinner small /> : null}
                      Eliminar grupo
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirm(true)}
                    className="text-xs font-semibold py-2 px-3 rounded-lg border border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Eliminar grupo
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab Configuraciones ───────────────────────────────────────────────────
function ConfiguracionesTab({ configuraciones, setConfiguraciones, globalDiscount = 0 }) {
  const [search,     setSearch]    = useState('')
  const [deleting,   setDeleting]  = useState(null)
  const [sortOrder,  setSortOrder] = useState('desc')
  const [expandedId, setExpandedId] = useState(null)

  function toggleExpanded(id) {
    setExpandedId(prev => prev === id ? null : id)
  }

  const filtered = configuraciones.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      blindLabel(c.blind_type).toLowerCase().includes(q) ||
      (c.configuration_number ?? '').toLowerCase().includes(q) ||
      (c.mechanism ?? '').toLowerCase().includes(q) ||
      (c.slat_color_name ?? '').toLowerCase().includes(q)
    )
  })

  const displayEntries = (() => {
    const entries = processConfigurations(filtered)
    return sortOrder === 'asc' ? [...entries].reverse() : entries
  })()

  async function handleDelete(id) {
    setDeleting(id)
    await supabase.from('cart_items').delete().eq('configuration_id', id)
    await supabase.from('budgets').delete().eq('configuration_id', id)
    const { data, error } = await supabase.from('blind_configurations').delete().eq('id', id).select('id')
    if (!error && data?.length > 0) {
      setConfiguraciones(prev => prev.filter(c => c.id !== id))
    } else {
      alert('No se pudo eliminar. Ejecuta esta política en Supabase:\nCREATE POLICY "del_own_configs" ON blind_configurations FOR DELETE USING (auth.uid() = user_id);')
    }
    setDeleting(null)
  }

  async function handleDeleteGroup(entryId, ids) {
    setDeleting(entryId)
    await supabase.from('cart_items').delete().in('configuration_id', ids)
    await supabase.from('budgets').delete().in('configuration_id', ids)
    const { data, error } = await supabase.from('blind_configurations').delete().in('id', ids).select('id')
    if (!error && data?.length > 0) {
      setConfiguraciones(prev => prev.filter(c => !ids.includes(c.id)))
    } else {
      alert('No se pudo eliminar. Ejecuta esta política en Supabase:\nCREATE POLICY "del_own_configs" ON blind_configurations FOR DELETE USING (auth.uid() = user_id);')
    }
    setDeleting(null)
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Configuraciones guardadas" action={
        <Link to="/configurador"
          className="flex items-center gap-2 text-sm font-bold bg-red-700 text-white px-4 py-2 rounded-xl hover:bg-red-800 transition-colors">
          + Nueva configuración
        </Link>
      } />

      {configuraciones.length > 0 && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por tipo, mecanismo…"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400" />
          </div>
          <button
            onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
            className="px-3 py-2.5 text-sm font-semibold rounded-xl border bg-white text-gray-600 border-gray-300 hover:bg-gray-50 flex items-center gap-1.5 flex-shrink-0 transition-colors"
            title={sortOrder === 'desc' ? 'Más recientes primero' : 'Más antiguas primero'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            {sortOrder === 'desc' ? 'Recientes' : 'Antiguas'}
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="font-semibold text-gray-700 mb-1">{search ? 'Sin resultados' : 'Todavía no hay configuraciones'}</p>
          <p className="text-sm text-gray-400 mb-5">
            {search ? 'Prueba con otro término' : 'Guarda una persiana desde el configurador para verla aquí.'}
          </p>
          {!search && (
            <Link to="/configurador"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-700 text-white text-sm font-bold rounded-xl hover:bg-red-800 transition-colors">
              Ir al configurador
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
          {displayEntries.map((entry, idx) => {
            const cardKey = entry.type === 'group' ? (entry.id ?? `group-${idx}`) : (entry.item?.id ?? `single-${idx}`)
            return entry.type === 'group' ? (
              <ProGroupCard
                key={cardKey}
                items={entry.items}
                onDeleteGroup={() => handleDeleteGroup(entry.id, entry.items.map(c => c.id))}
                deleting={deleting === entry.id ? entry.id : null}
                isExpanded={expandedId === cardKey}
                onToggle={() => setExpandedId(prev => prev === cardKey ? null : cardKey)}
                globalDiscount={globalDiscount}
              />
            ) : (
              <ProConfigCard
                key={cardKey}
                c={entry.item}
                onDelete={handleDelete}
                deleting={deleting}
                isExpanded={expandedId === cardKey}
                onToggle={() => setExpandedId(prev => prev === cardKey ? null : cardKey)}
                globalDiscount={globalDiscount}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tab Pedidos (unifica pedidos + facturas) ──────────────────────────────
function PedidosTab({ pedidos, facturas, newOrderId, proData }) {
  const navigate = useNavigate()
  const [downloadingId, setDownloadingId] = useState(null)
  const [expandedId,    setExpandedId]    = useState(null)
  const [autoDownloaded,setAutoDownloaded]= useState(false)
  const [newBanner,     setNewBanner]     = useState(!!newOrderId)

  // Auto-descarga factura del pedido recién confirmado
  useEffect(() => {
    if (!newOrderId || autoDownloaded || pedidos.length === 0) return
    const order   = pedidos.find(p => p.id === newOrderId)
    const invoice = facturas.find(f => f.order_id === newOrderId)
    if (!order) return
    setAutoDownloaded(true)
    setExpandedId(newOrderId)
    if (invoice) handleDownload(order, invoice)
    navigate(window.location.pathname + '?tab=pedidos', { replace: true })
  }, [newOrderId, pedidos, facturas, autoDownloaded])

  async function handleDownload(order, invoice) {
    setDownloadingId(order.id)
    await generateInvoicePDF(invoice, order, proData ?? null)
    setDownloadingId(null)
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Pedidos" action={
        <Link to="/cesta" className="flex items-center gap-2 text-sm font-bold bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Ver cesta
        </Link>
      } />

      {newBanner && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-green-700 font-medium">Pedido confirmado. La factura se está descargando…</p>
          </div>
          <button onClick={() => setNewBanner(false)} className="text-green-500 hover:text-green-700 text-lg leading-none">×</button>
        </div>
      )}

      {pedidos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <p className="font-semibold text-gray-700 mb-4">No hay pedidos todavía</p>
          <Link to="/configurador" className="inline-block px-5 py-2.5 bg-red-700 text-white text-sm font-bold rounded-xl hover:bg-red-800 transition-colors">
            Ir al configurador
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map(p => {
            const invoice    = facturas.find(f => f.order_id === p.id)
            const isExpanded = expandedId === p.id
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Cabecera colapsable */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="w-full px-4 py-3 text-left space-y-1.5"
                >
                  {/* Fila 1: ID (izq) + importe + iconos (der) */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-gray-500">#{p.id.slice(0,8).toUpperCase()}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold text-gray-900">{fmt(p.total_with_iva)}</span>
                      {invoice && (
                        <button
                          onClick={e => { e.stopPropagation(); handleDownload(p, invoice) }}
                          disabled={downloadingId === p.id}
                          title="Descargar factura"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-60"
                        >
                          {downloadingId === p.id ? <Spinner small /> : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          )}
                        </button>
                      )}
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {/* Fila 2: badges (izq) + fecha (der) */}
                  <div className="flex items-center gap-2">
                    <Badge status={p.status} map={ORDER_STATUS} />
                    {invoice && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${invoice.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {invoice.payment_status === 'paid' ? 'Pagada' : 'Pago pendiente'}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">{fmtDate(p.created_at)}</span>
                  </div>
                </button>

                {/* Detalle expandido */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
                    <div className="space-y-1.5">
                      {(p.items ?? []).map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-gray-700 font-medium">{BLIND_LABELS[item.blind_type] ?? item.blind_type ?? '—'}</span>
                          {item.width && item.height && <span className="text-gray-400">{item.width}×{item.height} mm</span>}
                          <span className="font-bold text-gray-900">{fmt(item.estimated_price ?? 0)}</span>
                        </div>
                      ))}
                    </div>
                    {invoice && (
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                        <div>
                          <p className="text-xs font-semibold text-gray-700">Factura: {invoice.invoice_number}</p>
                        </div>
                        <button
                          onClick={() => handleDownload(p, invoice)}
                          disabled={downloadingId === p.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 text-white text-xs font-bold rounded-lg hover:bg-red-800 disabled:opacity-60 transition-colors"
                        >
                          {downloadingId === p.id ? <Spinner small /> : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Descargar factura
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tab Facturas ──────────────────────────────────────────────────────────
function FacturasTab({ facturas }) {
  return (
    <div className="space-y-4">
      <SectionHeader title="Facturas" />
      {facturas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <p className="font-semibold text-gray-700">No hay facturas todavía</p>
          <p className="text-sm text-gray-400 mt-1">Las facturas aparecen cuando completas un pedido.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Nº Factura', 'Fecha', 'Estado pago', 'Total'].map((h, i) => (
                    <th key={h} className={`px-2 py-2 sm:px-5 sm:py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i === 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {facturas.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-2 py-2 sm:px-5 sm:py-3 font-mono text-xs text-gray-600">{f.invoice_number}</td>
                    <td className="px-2 py-2 sm:px-5 sm:py-3 text-gray-400">{fmtDate(f.created_at)}</td>
                    <td className="px-2 py-2 sm:px-5 sm:py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${f.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {f.payment_status === 'paid' ? 'Pagada' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-2 py-2 sm:px-5 sm:py-3 text-right font-bold text-gray-900">{fmt(f.total_with_iva)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab Mi empresa ────────────────────────────────────────────────────────
const REQUIRED_EMPRESA = ['razon_social', 'cif_nif', 'telefono', 'direccion_fiscal', 'codigo_postal', 'ciudad', 'provincia', 'email_facturacion']

function EmpresaTab({ empresa, setEmpresa, user, logoUrl, setLogoUrl }) {
  const [edit,    setEdit]    = useState(empresa ?? {})
  const [errors,  setErrors]  = useState({})
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [uploading, setUploading] = useState(false)

  const FIELDS = [
    { key: 'razon_social',       label: 'Razón social *' },
    { key: 'cif_nif',            label: 'CIF / NIF *' },
    { key: 'telefono',           label: 'Teléfono *' },
    { key: 'email_facturacion',  label: 'Email de facturación *' },
    { key: 'direccion_fiscal',   label: 'Dirección fiscal *' },
    { key: 'codigo_postal',      label: 'Código postal *' },
    { key: 'ciudad',             label: 'Ciudad *' },
    { key: 'provincia',          label: 'Provincia *' },
    { key: 'web',                label: 'Página web' },
  ]

  async function handleSave() {
    const errs = {}
    REQUIRED_EMPRESA.forEach(f => { if (!edit[f]?.toString().trim()) errs[f] = 'Obligatorio' })
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setSaving(true)
    const { error } = await supabase.from('professional_data').upsert({ ...edit, user_id: user.id })
    setSaving(false)
    if (!error) { setEmpresa(edit); setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  async function handleLogo(file) {
    if (!file) return
    setUploading(true)
    const { error } = await supabase.storage.from('professional-logos').upload(`${user.id}/logo`, file, { upsert: true, contentType: file.type })
    if (!error) {
      const { data } = supabase.storage.from('professional-logos').getPublicUrl(`${user.id}/logo`)
      setLogoUrl(data.publicUrl + `?t=${Date.now()}`)
    }
    setUploading(false)
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Mi empresa" />

      {/* Logo */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-sm font-bold text-gray-900 mb-4">Logo de empresa</p>
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 overflow-hidden flex items-center justify-center bg-gray-50">
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" onError={e => e.target.style.display = 'none'} />
              : <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            }
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">PNG o JPG recomendado. Aparecerá en presupuestos y facturas.</p>
            <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors ${uploading ? 'opacity-60' : ''}`}>
              {uploading ? <><Spinner small /> Subiendo…</> : 'Cambiar logo'}
              <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => handleLogo(e.target.files[0])} />
            </label>
          </div>
        </div>
      </div>

      {/* Campos */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-sm font-bold text-gray-900 mb-4">Datos fiscales</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
              <input type="text" value={edit[key] ?? ''} onChange={e => { setEdit(p => ({ ...p, [key]: e.target.value })); setErrors(p => ({ ...p, [key]: '' })) }}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 transition-colors ${errors[key] ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
              {errors[key] && <p className="text-xs text-red-600 mt-1">{errors[key]}</p>}
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-red-700 hover:bg-red-800 text-white disabled:opacity-60'}`}>
            {saving ? <Spinner small /> : saved ? '✓ Guardado' : 'Guardar datos'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────
export default function ProfessionalDashboard() {
  const navigate        = useNavigate()
  const location        = useLocation()
  const [searchParams]  = useSearchParams()
  const { itemCount }   = useCart()
  const tabParam    = searchParams.get('tab')
  const newOrderId  = searchParams.get('new')
  const VALID_TABS  = TABS.map(t => t.id)
  const resolveTab  = (p) => p === 'facturas' ? 'pedidos' : (VALID_TABS.includes(p) ? p : 'cotizaciones')
  const [activeTab,      setActiveTab]      = useState(() => {
    const stateTab = location.state?.tab
    if (stateTab && VALID_TABS.includes(stateTab)) return stateTab
    return resolveTab(tabParam)
  })

  useEffect(() => {
    if (!tabParam) return
    const valid = VALID_TABS.includes(tabParam) ? tabParam : 'overview'
    setActiveTab(tabParam === 'facturas' ? 'pedidos' : valid)
  }, [tabParam])
  const [menuOpen,       setMenuOpen]       = useState(false)
  const [user,           setUser]           = useState(null)
  const [empresa,        setEmpresa]        = useState(null)
  const [configuraciones,setConfiguraciones]= useState([])
  const [cotizaciones,   setCotizaciones]   = useState([])
  const [pedidos,        setPedidos]        = useState([])
  const [facturas,       setFacturas]       = useState([])
  const [unreadMsgs,     setUnreadMsgs]     = useState(0)
  const [logoUrl,        setLogoUrl]        = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [globalDiscount, setGlobalDiscount] = useState(0)
  const [showEmpresaModal, setShowEmpresaModal] = useState(false)

  const empresaCompleta = useCallback((e) => e && REQUIRED_EMPRESA.every(f => e[f]?.toString().trim()), [])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }
      setUser(user)

      const [empR, configR, pedR, facR, disc, cotR, unreadR] = await Promise.all([
        supabase.rpc('get_professional_data', { p_user_id: user.id }).then(r => ({ data: r.data?.[0] ?? null, error: r.error })),
        supabase.from('blind_configurations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        getProfessionalDiscountForUser(user.id),
        supabase.from('pro_purchase_quotes').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('pro_messages').select('id', { count: 'exact', head: true }).eq('professional_user_id', user.id).eq('sender_role', 'admin').eq('read_by_professional', false),
      ])

      setGlobalDiscount(disc)
      const emp = empR.data ?? null
      setEmpresa(emp)
      setConfiguraciones(configR.data ?? [])
      setCotizaciones(cotR.data ?? [])
      setUnreadMsgs(unreadR.count ?? 0)
      setPedidos(pedR.data ?? [])
      setFacturas(facR.data ?? [])

      if (user.id) {
        const { data: logoData } = supabase.storage.from('professional-logos').getPublicUrl(`${user.id}/logo`)
        if (logoData?.publicUrl) setLogoUrl(logoData.publicUrl + `?t=${Date.now()}`)
      }
      if (!empresaCompleta(emp)) setShowEmpresaModal(true)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() { await supabase.auth.signOut(); navigate('/') }

  const totalFacturado = pedidos.filter(p => p.status === 'completed').reduce((a, p) => a + (p.total_with_iva ?? 0), 0)

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src="/persianassantanderlogo.png" alt="Persianas Santander" className="h-9 w-auto cursor-pointer" onClick={() => navigate('/')} onError={e => { e.target.src = '/persianassantanderlogo.svg' }} />
              <div className="hidden sm:block h-6 w-px bg-gray-200" />
              <span className="hidden sm:block text-sm font-semibold text-gray-700">Panel profesional</span>
              {globalDiscount > 0 && (
                <span className="inline-flex bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  −{globalDiscount}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link to="/cesta" className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-700 text-white text-xs font-bold rounded-full flex items-center justify-center">{itemCount}</span>
                )}
              </Link>
              <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <div className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">
                  {empresa?.razon_social?.[0] ?? user?.email?.[0]?.toUpperCase() ?? 'P'}
                </div>
                <span className="text-sm text-gray-600 max-w-[120px] sm:max-w-[160px] truncate">{empresa?.razon_social ?? user?.email}</span>
              </div>
              <Link to="/configurador" className="text-sm font-bold bg-red-700 text-white px-4 py-2 rounded-xl hover:bg-red-800 transition-colors">
                <span className="hidden sm:inline">+ Nueva</span>
                <span className="sm:hidden">+</span>
              </Link>
              <button onClick={handleLogout} className="hidden sm:block p-2 text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors text-sm font-medium px-3">
                Salir
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <aside className="lg:w-52 flex-shrink-0">
            {/* Mobile dropdown */}
            <div className="lg:hidden relative mb-4">
              <button onClick={() => setMenuOpen(v => !v)}
                className="w-full bg-white rounded-xl border border-gray-200 flex items-center justify-between px-4 py-3 text-sm font-medium shadow-sm">
                <span className="flex items-center gap-3 text-red-700 font-semibold">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={TABS.find(t => t.id === activeTab)?.icon} />
                  </svg>
                  {TABS.find(t => t.id === activeTab)?.label}
                </span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuOpen && (
                <nav className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden">
                  {TABS.map(({ id, label, icon }) => (
                    <button key={id} onClick={() => { setActiveTab(id); setMenuOpen(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-left border-b border-gray-100 transition-colors ${activeTab === id ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
                      </svg>
                      {label}
                      {id === 'cotizaciones' && cotizaciones.filter(c => c.status === 'pending').length > 0 && (
                        <span className="ml-auto text-xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{cotizaciones.filter(c => c.status === 'pending').length}</span>
                      )}
                      {id === 'mensajes' && unreadMsgs > 0 && (
                        <span className="ml-auto text-xs font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-full">{unreadMsgs}</span>
                      )}
                    </button>
                  ))}
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-left text-red-600 hover:bg-red-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Salir
                  </button>
                </nav>
              )}
            </div>

            {/* Desktop sidebar */}
            <nav className="hidden lg:flex lg:flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {TABS.map(({ id, label, icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-left border-b border-gray-100 last:border-0 transition-colors ${
                    activeTab === id
                      ? 'bg-red-50 text-red-700 border-l-2 border-l-red-700 pl-3.5'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
                  </svg>
                  {label}
                  {id === 'cotizaciones' && cotizaciones.filter(c => c.status === 'pending').length > 0 && (
                    <span className="ml-auto text-xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{cotizaciones.filter(c => c.status === 'pending').length}</span>
                  )}
                  {id === 'mensajes' && unreadMsgs > 0 && (
                    <span className="ml-auto text-xs font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-full">{unreadMsgs}</span>
                  )}
                  {id === 'configuraciones' && configuraciones.length > 0 && (
                    <span className="ml-auto text-xs font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{configuraciones.length}</span>
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {/* Contenido */}
          <main className="flex-1 min-w-0">
            {/* ── RESUMEN ── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {empresa?.razon_social ? `Hola, ${empresa.razon_social}` : 'Panel profesional'}
                  </h1>
                  <p className="text-gray-500 text-sm mt-1">Resumen de tu actividad.</p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    globalDiscount > 0 ? { label: 'Descuento activo', value: `−${globalDiscount}%`, sub: 'Tarifa profesional', accent: true } : null,
                    { label: 'Cotizaciones', value: cotizaciones.length, sub: `${cotizaciones.filter(c => c.client_status === 'accepted').length} aceptadas por cliente`, tab: 'cotizaciones' },
                    { label: 'Pedidos', value: pedidos.length, sub: `${pedidos.filter(p => p.status === 'completed').length} completados`, tab: 'pedidos' },
                    { label: 'Total facturado', value: fmt(totalFacturado), sub: 'pedidos completados' },
                  ].filter(Boolean).map(({ label, value, sub, accent, tab }) => (
                    <div key={label} onClick={() => tab && setActiveTab(tab)}
                      className={`rounded-2xl p-5 border ${accent ? 'bg-red-700 border-red-600' : 'bg-white border-gray-200'} ${tab ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
                      <p className={`text-2xl font-black mb-0.5 ${accent ? 'text-white' : 'text-gray-900'}`}>{value}</p>
                      <p className={`text-sm font-medium ${accent ? 'text-red-200' : 'text-gray-700'}`}>{label}</p>
                      {sub && <p className={`text-xs mt-0.5 ${accent ? 'text-red-300' : 'text-gray-400'}`}>{sub}</p>}
                    </div>
                  ))}
                </div>

                {!empresaCompleta(empresa) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-amber-800">Completa los datos de tu empresa</p>
                      <p className="text-sm text-amber-600 mt-0.5">Necesarios para que aparezcan en facturas y presupuestos.</p>
                    </div>
                    <button onClick={() => setActiveTab('empresa')}
                      className="flex-shrink-0 px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 transition-colors">
                      Completar →
                    </button>
                  </div>
                )}

                {itemCount > 0 && (
                  <Link to="/cesta" className="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl px-5 py-4 hover:bg-red-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-700 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-bold text-red-900 text-sm">{itemCount} producto{itemCount > 1 ? 's' : ''} en la cesta</p>
                        <p className="text-xs text-red-600">Finaliza tu pedido</p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}

                {/* Últimas cotizaciones */}
                {cotizaciones.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900 text-sm">Últimas cotizaciones</h3>
                      <button onClick={() => setActiveTab('cotizaciones')} className="text-xs font-semibold text-red-700 hover:underline">Ver todas</button>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {cotizaciones.slice(0, 4).map(q => {
                        const st = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.pending
                        return (
                          <div key={q.id} className="px-5 py-3 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900">{(q.items ?? []).length} persiana{(q.items ?? []).length !== 1 ? 's' : ''}</p>
                              <p className="text-xs text-gray-400">{fmtDate(q.created_at)}</p>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                              <span className="font-bold text-red-700 text-sm">{fmt(q.admin_total_con_iva ?? q.total_con_iva ?? 0)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── COTIZACIONES Y CLIENTES ── */}
            {activeTab === 'cotizaciones' && (
              <CotizacionesTab
                cotizaciones={cotizaciones}
                configuraciones={configuraciones}
                setConfiguraciones={setConfiguraciones}
                onDelete={id => setCotizaciones(prev => prev.filter(q => q.id !== id))}
                onUpdate={(id, updates) => setCotizaciones(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q))}
                logoUrl={logoUrl}
                globalDiscount={globalDiscount}
                proInfo={{
                  razon_social:     empresa?.razon_social     ?? null,
                  cif_nif:          empresa?.cif_nif          ?? null,
                  direccion_fiscal: empresa?.direccion_fiscal ?? null,
                  codigo_postal:    empresa?.codigo_postal    ?? null,
                  ciudad:           empresa?.ciudad           ?? null,
                  provincia:        empresa?.provincia        ?? null,
                  telefono:         empresa?.telefono         ?? null,
                  email:            empresa?.email_facturacion ?? user?.email ?? null,
                }}
              />
            )}

            {/* ── MENSAJES ── */}
            {activeTab === 'mensajes' && (
              <MensajesTab
                userId={user.id}
                onRead={() => setUnreadMsgs(0)}
              />
            )}

            {/* ── PEDIDOS ── */}
            {activeTab === 'pedidos' && <PedidosTab pedidos={pedidos} facturas={facturas} newOrderId={newOrderId} proData={empresa} />}

            {/* ── EMPRESA ── */}
            {activeTab === 'empresa' && (
              <EmpresaTab empresa={empresa} setEmpresa={setEmpresa} user={user} logoUrl={logoUrl} setLogoUrl={setLogoUrl} />
            )}
          </main>
        </div>
      </div>

      {/* Modal obligatorio datos empresa */}
      {showEmpresaModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Completa tu empresa</h2>
            <p className="text-sm text-gray-500 mb-6">Necesitamos los datos fiscales de tu empresa para generar presupuestos y facturas correctamente.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowEmpresaModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Más tarde
              </button>
              <button onClick={() => { setShowEmpresaModal(false); setActiveTab('empresa') }}
                className="flex-1 py-2.5 rounded-xl bg-red-700 text-white text-sm font-bold hover:bg-red-800 transition-colors">
                Completar ahora
              </button>
            </div>
          </div>
        </div>
      )}

      <WAButton />
    </div>
  )
}
