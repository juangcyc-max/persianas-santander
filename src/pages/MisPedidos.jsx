import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../services/supabase/client'
import SEO from '../shared/SEO'

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
const fmtDate = (d) => d ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d)) : '—'

const STATUS = {
  pending:   { label: 'Pendiente de revisión', cls: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500',  desc: 'Hemos recibido tu solicitud. Nos pondremos en contacto contigo pronto.' },
  confirmed: { label: 'Cita confirmada',        cls: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500',   desc: 'Tu cita de medición ha sido confirmada. Te esperamos en la fecha indicada.' },
  completed: { label: 'Completado',             cls: 'bg-green-100 text-green-700',  dot: 'bg-green-500',  desc: 'Tu pedido ha sido completado. ¡Gracias por confiar en nosotros!' },
  cancelled: { label: 'Cancelado',              cls: 'bg-red-100 text-red-700',      dot: 'bg-red-500',    desc: 'Este pedido ha sido cancelado. Contacta con nosotros si tienes alguna duda.' },
}

// ── Timeline de estado ────────────────────────────────────────────────────
function StatusTimeline({ status, userType }) {
  const steps = userType === 'professional'
    ? ['pending', 'confirmed', 'completed']
    : ['pending', 'confirmed', 'completed']

  const statusIndex = steps.indexOf(status)

  const labels = userType === 'professional'
    ? ['Pedido recibido', 'Confirmado', 'Entregado']
    : ['Solicitud recibida', 'Cita confirmada', 'Instalación completada']

  return (
    <div className="flex items-center gap-2 mt-4">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2 flex-1">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              i < statusIndex
                ? 'bg-green-500 text-white'
                : i === statusIndex
                ? `${STATUS[status]?.dot.replace('bg-', 'bg-')} bg-blue-500 text-white ring-4 ring-blue-100`
                : 'bg-gray-100 text-gray-400'
            }`}>
              {i < statusIndex
                ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                : i + 1
              }
            </div>
            <span className={`text-xs text-center leading-tight ${i <= statusIndex ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
              {labels[i]}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mb-4 ${i < statusIndex ? 'bg-green-400' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Tarjeta de pedido ─────────────────────────────────────────────────────
function OrderCard({ order }) {
  const [expanded, setExpanded] = useState(false)
  const s = STATUS[order.status] ?? STATUS.pending
  const isParticular = order.user_type === 'public'

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {s.label}
              </span>
              <span className="text-xs text-gray-400 font-mono">#{order.id.slice(0,8).toUpperCase()}</span>
            </div>
            <p className="text-xs text-gray-500">Solicitado el {fmtDate(order.created_at)}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-black text-gray-900">{fmt(order.total_with_iva)}</p>
            <p className="text-xs text-gray-400">IVA incluido</p>
          </div>
        </div>

        {/* Descripción del estado */}
        <div className={`mt-3 px-3 py-2 rounded-lg text-xs ${s.cls} bg-opacity-50`}>
          {s.desc}
        </div>

        {/* Cita confirmada */}
        {order.confirmed_date && order.confirmed_time && (
          <div className="mt-3 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div>
              <p className="text-xs font-bold text-blue-900">Cita confirmada</p>
              <p className="text-xs text-blue-700">{fmtDate(order.confirmed_date)} a las {order.confirmed_time}</p>
              {order.address && <p className="text-xs text-blue-600">{order.address}</p>}
            </div>
          </div>
        )}

        {/* Notas del admin */}
        {order.admin_notes && (
          <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <p className="text-xs font-semibold text-gray-600 mb-0.5">Nota de nuestro equipo:</p>
            <p className="text-xs text-gray-700">{order.admin_notes}</p>
          </div>
        )}

        {/* Timeline */}
        {order.status !== 'cancelled' && (
          <StatusTimeline status={order.status} userType={order.user_type} />
        )}
      </div>

      {/* Detalle productos */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <span className="font-medium">
            {(order.items ?? []).length} producto{(order.items ?? []).length !== 1 ? 's' : ''}
          </span>
          <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expanded && (
          <div className="px-5 pb-5 space-y-2">
            {(order.items ?? []).map((item, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-gray-900">
                    Persiana {item.blind_type === 'blocking' ? 'bloqueante' : 'estándar'}
                    {item.quantity > 1 && ` ×${item.quantity}`}
                  </p>
                  <p className="text-xs text-gray-500">{item.width}×{item.height}mm · {item.mechanism}</p>
                  <p className="text-xs text-gray-400">Caja: {item.box_color_name} · Lamas: {item.slat_color_name}</p>
                </div>
                <span className="font-bold text-gray-900">{fmt(item.estimated_price * item.quantity)}</span>
              </div>
            ))}

            {/* Datos cita particular */}
            {isParticular && order.preferred_date && (
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs text-gray-600 space-y-1">
                <p className="font-semibold text-gray-700">Datos de la solicitud</p>
                <p>📍 {order.address}</p>
                <p>📞 {order.phone}</p>
                <p>📅 Fecha preferida: {fmtDate(order.preferred_date)} a las {order.preferred_time}</p>
                {order.notes && <p>💬 {order.notes}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────
export default function MisPedidos() {
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setOrders(data ?? [])
    setLoading(false)
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <SEO title="Mis pedidos" canonical="/mis-pedidos" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mis pedidos</h1>
            <p className="text-gray-500 text-sm mt-0.5">{orders.length} solicitud{orders.length !== 1 ? 'es' : ''} en total</p>
          </div>
          <Link to="/configurador"
            className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors">
            + Nueva configuración
          </Link>
        </div>

        {/* Filtros */}
        {orders.length > 0 && (
          <div className="flex gap-2 mb-5 flex-wrap">
            {[
              { key: 'all',       label: 'Todos' },
              { key: 'pending',   label: 'Pendientes' },
              { key: 'confirmed', label: 'Confirmados' },
              { key: 'completed', label: 'Completados' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  filter === key ? 'bg-red-700 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Contenido */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center bg-white rounded-2xl border border-gray-200 p-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">No tienes pedidos todavía</h3>
            <p className="text-gray-500 text-sm mb-6">Configura tu primera persiana y solicita un presupuesto</p>
            <Link to="/configurador"
              className="inline-block bg-red-700 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-red-800 transition-colors">
              Ir al configurador
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No hay pedidos con ese estado
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(order => <OrderCard key={order.id} order={order} />)}
          </div>
        )}
      </div>
    </div>
  )
}
