import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../services/supabase/client'
import { useCart } from '../../context/CartContext'
import { generateOrderInvoicePDF } from '../../services/pdf'

// ─── Preview SVG generado dinámicamente (sin imágenes rotas) ────────────────
function BlindSVGPreview({ boxColor = '#dc2626', slatColor = '#ffffff' }) {
  const slats = Array.from({ length: 7 })

  return (
    <svg
      viewBox="0 0 200 140"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      {/* Fondo cielo */}
      <defs>
        <linearGradient id={`sky-${boxColor}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfdbfe" />
          <stop offset="100%" stopColor="#e0f2fe" />
        </linearGradient>
      </defs>
      <rect width="200" height="140" fill={`url(#sky-${boxColor})`} />

      {/* Caja superior */}
      <rect x="10" y="10" width="180" height="24" rx="3" fill={boxColor} />
      {/* Brillo caja */}
      <rect x="10" y="10" width="180" height="6" rx="3" fill="rgba(255,255,255,0.15)" />

      {/* Lamas */}
      {slats.map((_, i) => (
        <g key={i}>
          <rect
            x="10"
            y={34 + i * 14}
            width="180"
            height="12"
            fill={slatColor}
          />
          {/* Línea de separación */}
          <rect
            x="10"
            y={34 + i * 14 + 12}
            width="180"
            height="2"
            fill="rgba(0,0,0,0.12)"
          />
        </g>
      ))}

      {/* Borde lateral cinta */}
      <rect x="183" y="34" width="7" height="98" rx="1" fill="#e5e7eb" />

      {/* Marco ventana */}
      <rect x="10" y="10" width="180" height="122" rx="3" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
    </svg>
  )
}

// ─── Etiquetas de tipo ────────────────────────────────────────────────────────
const BLIND_LABELS = {
  laminada:                    'Paño laminado',
  autoblocante:                'Paño autoblocante',
  blocking:                    'Bloqueante',
  sistema_mini_cajon_pvc:      'Sistema Mini Cajón PVC',
  sistema_mini_cajon_aluminio: 'Sistema Mini Cajón Aluminio',
  sistema_mini_autoblocante:   'Sistema Mini Autoblocante',
  solo_guias:                  'Solo guías',
  solo_motor:                  'Solo motor',
  mosquitera_enrollable:       'Mosquitera Enrollable',
  // legacy
  sistema_mini_pvc:            'Sistema Mini PVC',
  sistema_mini_aluminio:       'Sistema Mini Aluminio',
  motor_mas_guias:             'Motor + Guías',
  pano_mas_guias:              'Paño + Guías',
}
const blindLabel = (t) => BLIND_LABELS[t] ?? t ?? '—'
const isProductoIndividual = (t) => ['solo_motor', 'solo_guias'].includes(t)
const isSistema = (t) => ['sistema_mini_cajon_pvc', 'sistema_mini_cajon_aluminio', 'sistema_mini_autoblocante', 'sistema_mini_pvc', 'sistema_mini_aluminio'].includes(t)
const fmtEUR = (v) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(v)

// ─── Agrupar configuraciones por GRUPO-{groupId}-{n} ─────────────────────────
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

// ─── Custom hook ─────────────────────────────────────────────────────────────
const useConfigurations = () => {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetchConfigs = async () => {
    try {
      setLoading(true)
      const authResponse = await supabase.auth.getUser()
      const user = authResponse.data.user
      if (!user) throw new Error('No session')

      const response = await supabase
        .from('blind_configurations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (response.error) throw response.error
      setData(response.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchConfigs() }, [])
  return { data, setData, loading, error, refresh: fetchConfigs }
}

// ─── Botón de acción ─────────────────────────────────────────────────────────
const ActionButton = ({ onClick, label, variant = 'default', disabled, children }) => {
  const base = 'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors focus:outline-none'
  const variants = {
    default: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
    primary: 'bg-red-700 text-white hover:bg-red-800',
    danger:  'text-red-600 hover:text-red-800 hover:bg-red-50',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {disabled
        ? <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        : children || label}
    </button>
  )
}

// ─── Tarjeta de configuración ────────────────────────────────────────────────
const ConfigCard = ({ config, onDelete, onView, onDuplicate, isProcessing }) => {
  const { addToCart, items: cartItems, orderedConfigIds } = useCart()
  const navigate = useNavigate()
  const [addingCart, setAddingCart] = useState(false)
  const [expanded,   setExpanded]   = useState(false)

  const inCart    = cartItems.some(ci => ci.configuration_id === config.id)
  const isOrdered = !inCart && orderedConfigIds.has(config.id)
  const allInCart = inCart || isOrdered

  async function handleAddToCart() {
    setAddingCart(true)
    const { error } = await addToCart(config.id)
    setAddingCart(false)
    if (!error) setTimeout(() => navigate('/cesta'), 600)
  }

  const price    = fmtEUR(config.estimated_price || 0)
  const date     = new Intl.DateTimeFormat('es-ES', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(config.created_at))
  const tipo      = config.blind_type
  const label     = blindLabel(tipo)
  const mechLabel = { muelle: 'Muelle', cinta: 'Cinta', motor: 'Motor' }[config.mechanism] ?? config.mechanism ?? '—'

  const borderCls = allInCart
    ? 'bg-green-50 border-green-200'
    : 'bg-white border-gray-200 hover:border-red-200 hover:shadow-md'

  return (
    <article className={`border rounded-xl overflow-hidden transition-all ${borderCls}`}>
      {/* ── Cabecera colapsable ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {allInCart ? (
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          )}
          <span className={`text-xs font-bold truncate ${allInCart ? 'text-green-700' : 'text-gray-800'}`}>
            {allInCart ? 'En cesta · ' : ''}{label}
          </span>
          {!allInCart && (
            <span className="text-xs text-gray-400 truncate hidden sm:inline">
              · {config.width && config.height ? `${config.width}×${config.height}` : mechLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className={`text-sm font-black ${allInCart ? 'text-green-700' : 'text-red-700'}`}>{price}</span>
          <span className="text-xs text-gray-400">{date}</span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Detalle expandido ── */}
      {expanded && (
        <div className={`px-4 pb-4 pt-3 border-t space-y-3 ${allInCart ? 'border-green-100' : 'border-gray-100'}`}>
          {/* Detalles */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {config.width && config.height && <span>{config.width} × {config.height} mm</span>}
            {config.mechanism && <span>{mechLabel}</span>}
            {config.slat_color_name && (
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: config.slat_color || '#ccc' }} />
                {config.slat_color_name}
              </span>
            )}
          </div>

          {/* Acciones */}
          {isOrdered ? (
            <button disabled className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-green-100 text-green-700 cursor-default flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Ya pedida
            </button>
          ) : allInCart ? (
            <button onClick={() => navigate('/cesta')}
              className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors">
              Ir a la cesta →
            </button>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={addingCart}
              className="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-60 transition-colors"
            >
              {addingCart ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Añadir a la cesta
                </>
              )}
            </button>
          )}
          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-1">
              <ActionButton onClick={() => onView(config)} label="Ver" />
              <ActionButton onClick={() => onDuplicate(config)} label="Duplicar" />
            </div>
            <ActionButton onClick={() => onDelete(config.id)} label="Eliminar" variant="danger" disabled={isProcessing} />
          </div>
        </div>
      )}
    </article>
  )
}

// ─── Tarjeta de grupo ────────────────────────────────────────────────────────
const GroupCard = ({ items, onDeleteGroup, isProcessing }) => {
  const { addToCart, items: cartItems, orderedConfigIds } = useCart()
  const navigate = useNavigate()
  const [addingCart, setAddingCart] = useState(false)
  const [expanded,   setExpanded]   = useState(false)

  const total       = items.reduce((sum, c) => sum + (c.estimated_price || 0), 0)
  const date        = new Intl.DateTimeFormat('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
    .format(new Date(items[0].created_at))
  const inCart      = cartItems.length > 0 && items.every(c => cartItems.some(ci => ci.configuration_id === c.id))
  const isOrdered   = !inCart && items.every(c => orderedConfigIds.has(c.id))
  const allInCart   = inCart || isOrdered

  async function handleAddAllToCart() {
    setAddingCart(true)
    for (const config of items) await addToCart(config.id)
    setAddingCart(false)
    setTimeout(() => navigate('/cesta'), 600)
  }

  const borderCls = allInCart
    ? 'bg-green-50 border-green-200'
    : 'bg-white border-red-100 hover:border-red-300 hover:shadow-md'

  return (
    <article className={`border-2 rounded-xl overflow-hidden transition-all ${borderCls}`}>
      {/* ── Cabecera siempre visible (toggle) ── */}
      <button
        onClick={() => setExpanded(e => !e)}
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
          <span className={`text-sm font-black ${allInCart ? 'text-green-700' : 'text-red-700'}`}>{fmtEUR(total)}</span>
          <span className="text-xs text-gray-400">{date}</span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Detalle expandido ── */}
      {expanded && (
        <div className={`px-4 pb-4 pt-3 border-t space-y-3 ${allInCart ? 'border-green-100' : 'border-gray-100'}`}>
          {/* Lista */}
          <div className="space-y-2.5">
            {items.map((config, i) => (
              <div key={config.id} className="flex items-center gap-2.5 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold flex-shrink-0 text-[10px] ${allInCart ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{blindLabel(config.blind_type)}</p>
                  {config.width && config.height
                    ? <p className="text-gray-400">{config.width} × {config.height} mm</p>
                    : config.height
                    ? <p className="text-gray-400">{config.height} mm</p>
                    : null}
                </div>
                <span className="font-bold text-gray-700 flex-shrink-0">{fmtEUR(config.estimated_price || 0)}</span>
              </div>
            ))}
          </div>

          {/* Acciones */}
          {isOrdered ? (
            <button disabled className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-green-100 text-green-700 cursor-default flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Ya pedido
            </button>
          ) : allInCart ? (
            <button onClick={() => navigate('/cesta')}
              className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors">
              Ir a la cesta →
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={handleAddAllToCart}
                disabled={addingCart}
                className="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-60"
              >
                {addingCart ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Añadir todo a la cesta
                  </>
                )}
              </button>
              <div className="flex justify-end">
                <ActionButton onClick={onDeleteGroup} variant="danger" disabled={isProcessing} label="Eliminar grupo" />
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

// ─── Sección de pedidos ──────────────────────────────────────────────────────
function PedidosSection({ newOrderId }) {
  const navigate = useNavigate()
  const [pedidos,        setPedidos]        = useState([])
  const [facturas,       setFacturas]       = useState([])
  const [loadingPedidos, setLoadingPedidos] = useState(true)
  const [expandedId,     setExpandedId]     = useState(null)
  const [downloadingId,  setDownloadingId]  = useState(null)
  const [autoDownloaded, setAutoDownloaded] = useState(false)
  const [newBanner,      setNewBanner]      = useState(!!newOrderId)

  const fmt     = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
  const fmtDate = (d) => d ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—'

  const ORDER_STATUS = {
    pending:   { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700'  },
    confirmed: { label: 'Confirmado', cls: 'bg-blue-100 text-blue-700'    },
    completed: { label: 'Completado', cls: 'bg-green-100 text-green-700'  },
    cancelled: { label: 'Cancelado',  cls: 'bg-red-100 text-red-700'      },
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [ordersRes, invoicesRes] = await Promise.all([
        supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ])
      setPedidos(ordersRes.data ?? [])
      setFacturas(invoicesRes.data ?? [])
      setLoadingPedidos(false)
    }
    load()
  }, [])

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
    await generateOrderInvoicePDF({ order, invoice })
    setDownloadingId(null)
  }

  if (loadingPedidos) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4">
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
        <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="font-semibold text-gray-900 mb-1">No hay pedidos todavía</p>
          <p className="text-gray-400 text-sm mb-6">Confirma un pedido desde la cesta para verlo aquí.</p>
          <button onClick={() => navigate('/configurador')}
            className="px-5 py-2.5 bg-red-700 text-white text-sm font-semibold rounded-xl hover:bg-red-800 transition-colors">
            Ir al configurador
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map(p => {
            const invoice    = facturas.find(f => f.order_id === p.id)
            const isExpanded = expandedId === p.id
            const st         = ORDER_STATUS[p.status] ?? ORDER_STATUS.pending
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
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
                          {downloadingId === p.id
                            ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          }
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
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    {invoice && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${invoice.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {invoice.payment_status === 'paid' ? 'Pagada' : 'Pago pendiente'}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">{fmtDate(p.created_at)}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
                    <div className="space-y-1.5">
                      {(p.items ?? []).map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-gray-700 font-medium">{blindLabel(item.blind_type)}</span>
                          {item.width && item.height && <span className="text-gray-400">{item.width}×{item.height} mm</span>}
                          <span className="font-bold text-gray-900">{fmt(item.estimated_price ?? 0)}</span>
                        </div>
                      ))}
                    </div>
                    {invoice && (
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                        <p className="text-xs font-semibold text-gray-700">Factura: {invoice.invoice_number}</p>
                        <button
                          onClick={() => handleDownload(p, invoice)}
                          disabled={downloadingId === p.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 text-white text-xs font-bold rounded-lg hover:bg-red-800 disabled:opacity-60 transition-colors"
                        >
                          {downloadingId === p.id
                            ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                            : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Descargar factura</>
                          }
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 text-right">{fmtDate(p.created_at)}</p>
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

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export default function MisConfiguraciones() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tabParam    = searchParams.get('tab') ?? 'configuraciones'
  const newOrderId  = searchParams.get('new')
  const { data: configs, setData, loading, error, refresh } = useConfigurations()

  const [activeTab,     setActiveTab]     = useState(tabParam)
  const [processingId,  setProcessingId]  = useState(null)
  const [search,        setSearch]        = useState('')
  const [activeFilter,  setActiveFilter]  = useState('all')
  const [sortOrder,     setSortOrder]     = useState('desc')
  useEffect(() => {
    async function checkAndRedirect() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const tab      = tabParam
      const newParam = newOrderId ? `&new=${newOrderId}` : ''
      if (user?.user_metadata?.user_type === 'professional') {
        navigate(`/panel-profesional?tab=${tab}${newParam}`, { replace: true })
        return
      }
      const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
      if (profile?.user_type === 'professional') {
        navigate(`/panel-profesional?tab=${tab}${newParam}`, { replace: true })
      }
    }
    checkAndRedirect()
  }, [])

  const filteredConfigs = useMemo(() => configs.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = c.blind_type?.toLowerCase().includes(q) ||
                        c.mechanism?.toLowerCase().includes(q)  ||
                        c.box_color_name?.toLowerCase().includes(q) ||
                        c.slat_color_name?.toLowerCase().includes(q)
    const matchFilter = activeFilter === 'all' ||
      (activeFilter === 'panos'      && ['laminada', 'autoblocante', 'blocking', 'mosquitera_enrollable'].includes(c.blind_type)) ||
      (activeFilter === 'sistemas'   && ['sistema_mini_cajon_pvc', 'sistema_mini_cajon_aluminio', 'sistema_mini_autoblocante', 'sistema_mini_pvc', 'sistema_mini_aluminio'].includes(c.blind_type)) ||
      (activeFilter === 'individual' && ['solo_motor', 'solo_guias'].includes(c.blind_type))
    return matchSearch && matchFilter
  }), [configs, search, activeFilter])

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta configuración?')) return
    setProcessingId(id)
    try {
      const res = await supabase.from('blind_configurations').delete().eq('id', id)
      if (res.error) throw res.error
      setData(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      console.error(err)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDuplicate = async (config) => {
    setProcessingId('dup-' + config.id)
    const { id, created_at, ...copyData } = config
    const res = await supabase.from('blind_configurations').insert([copyData])
    if (!res.error) refresh()
    setProcessingId(null)
  }

  const handleDeleteGroup = async (entryId, ids) => {
    if (!confirm(`¿Eliminar este grupo de ${ids.length} configuraciones?`)) return
    setProcessingId(entryId)
    try {
      const res = await supabase.from('blind_configurations').delete().in('id', ids)
      if (res.error) throw res.error
      setData(prev => prev.filter(c => !ids.includes(c.id)))
    } catch (err) {
      console.error(err)
    } finally {
      setProcessingId(null)
    }
  }

  const displayEntries = useMemo(() => {
    const entries = processConfigurations(filteredConfigs)
    return sortOrder === 'asc' ? [...entries].reverse() : entries
  }, [filteredConfigs, sortOrder])

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-red-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Cargando configuraciones…</p>
        </div>
      </div>
    )
  }

  // ── Error ──
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-red-200 p-8 max-w-sm text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <p className="text-gray-900 font-semibold mb-1">No se pudieron cargar las configuraciones</p>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-8 px-4">
      <div className="max-w-7xl mx-auto">

        {/* Cabecera */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mi panel</h1>
          <button
            onClick={() => navigate('/configurador')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-700 text-white text-sm font-semibold rounded-xl hover:bg-red-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva configuración
          </button>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
          {[
            { key: 'configuraciones', label: 'Configuraciones' },
            { key: 'pedidos',         label: 'Pedidos' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                activeTab === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab: Pedidos */}
        {activeTab === 'pedidos' && <PedidosSection newOrderId={newOrderId} />}

        {/* Tab: Configuraciones — filtros */}
        {activeTab === 'configuraciones' && <>
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por tipo, mecanismo, color…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white"
            />
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            {[
              { key: 'all',       label: 'Todos' },
              { key: 'panos',     label: 'Paños' },
              { key: 'sistemas',  label: 'Sistemas' },
              { key: 'individual',label: 'Individuales' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`px-4 py-2.5 text-sm font-semibold rounded-xl border transition-colors ${
                  activeFilter === key
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
              className="px-3 py-2.5 text-sm font-semibold rounded-xl border transition-colors bg-white text-gray-600 border-gray-300 hover:bg-gray-50 flex items-center gap-1.5"
              title={sortOrder === 'desc' ? 'Mostrando más recientes primero' : 'Mostrando más antiguas primero'}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
              {sortOrder === 'desc' ? 'Recientes' : 'Antiguas'}
            </button>
          </div>
        </div>

        {/* Grid o vacío */}
        {filteredConfigs.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900 mb-1">
              {search || activeFilter !== 'all' ? 'Sin resultados' : 'Sin configuraciones guardadas'}
            </p>
            <p className="text-gray-400 text-sm mb-6">
              {search || activeFilter !== 'all'
                ? 'Prueba ajustando los filtros.'
                : 'Crea tu primera configuración en el configurador.'}
            </p>
            {!search && activeFilter === 'all' && (
              <button
                onClick={() => navigate('/configurador')}
                className="px-5 py-2.5 bg-red-700 text-white text-sm font-semibold rounded-xl hover:bg-red-800 transition-colors"
              >
                Ir al configurador
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayEntries.map(entry =>
              entry.type === 'group' ? (
                <GroupCard
                  key={entry.id}
                  items={entry.items}
                  onDeleteGroup={() => handleDeleteGroup(entry.id, entry.items.map(c => c.id))}
                  isProcessing={processingId === entry.id}
                />
              ) : (
                <ConfigCard
                  key={entry.item.id}
                  config={entry.item}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                  onView={c => navigate('/configurador', { state: { loadConfig: c } })}
                  isProcessing={processingId === entry.item.id || processingId === 'dup-' + entry.item.id}
                />
              )
            )}
          </div>
        )}
        </>}
      </div>
      </div>
    </div>
  )
}