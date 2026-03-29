import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase/client'

// ── Helpers ───────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
const fmtDate = (d) => d ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—'

const STATUS_MAP = {
  pending:   { label: 'Pendiente',   cls: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500'  },
  confirmed: { label: 'Confirmado',  cls: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500'   },
  completed: { label: 'Completado',  cls: 'bg-green-100 text-green-700',  dot: 'bg-green-500'  },
  cancelled: { label: 'Cancelado',   cls: 'bg-red-100 text-red-700',      dot: 'bg-red-500'    },
}

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

// ── Generar enlace Google Calendar ────────────────────────────────────────
function buildCalendarUrl(order, confirmedDate, confirmedTime) {
  if (!confirmedDate || !confirmedTime) return null
  const [year, month, day] = confirmedDate.split('-')
  const [hour, minute] = confirmedTime.split(':')
  const start = `${year}${month}${day}T${hour}${minute}00`
  const endHour = String(parseInt(hour) + 2).padStart(2, '0')
  const end   = `${year}${month}${day}T${endHour}${minute}00`
  const title = encodeURIComponent(`Instalación persiana - ${order.address || 'Sin dirección'}`)
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

// ── Modal detalle de pedido ───────────────────────────────────────────────
function OrderModal({ order, onClose, onUpdate }) {
  const [status,        setStatus]        = useState(order.status)
  const [confirmedDate, setConfirmedDate] = useState(order.confirmed_date ?? order.preferred_date ?? '')
  const [confirmedTime, setConfirmedTime] = useState(order.confirmed_time ?? order.preferred_time ?? '')
  const [adminNotes,    setAdminNotes]    = useState(order.admin_notes ?? '')
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [emailSent,     setEmailSent]     = useState(false)
  const [sendingEmail,  setSendingEmail]  = useState(false)

  const calendarUrl = buildCalendarUrl(order, confirmedDate, confirmedTime)
  const isParticular = order.user_type === 'public'

  const HORAS = ['08:00','09:00','10:00','11:00','12:00','13:00','16:00','17:00','18:00','19:00']

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('orders').update({
      status,
      confirmed_date: confirmedDate || null,
      confirmed_time: confirmedTime || null,
      admin_notes: adminNotes,
    }).eq('id', order.id)
    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      onUpdate()
    }
  }

  async function handleSendEmail() {
    setSendingEmail(true)
    try {
      // Usar EmailJS para enviar confirmación al cliente
      if (window.emailjs) {
        await window.emailjs.send('service_id', 'template_confirm_client', {
          to_email:       order.profiles?.email,
          client_name:    order.profiles?.email?.split('@')[0],
          order_id:       order.id,
          confirmed_date: confirmedDate,
          confirmed_time: confirmedTime,
          address:        order.address,
          admin_notes:    adminNotes,
          status:         STATUS_MAP[status]?.label,
        })
      }
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 3000)
    } catch (e) {
      console.error('Email error:', e)
    }
    setSendingEmail(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header modal */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Pedido #{order.id.slice(0,8).toUpperCase()}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{fmtDate(order.created_at)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Datos cliente */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Datos del cliente</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">Email:</span> <span className="text-gray-900 font-medium">{order.profiles?.email ?? '—'}</span></div>
              <div><span className="text-gray-400">Tipo:</span> <span className={`font-bold ${order.user_type === 'professional' ? 'text-blue-600' : 'text-gray-900'}`}>{order.user_type === 'professional' ? 'Profesional' : 'Particular'}</span></div>
              {isParticular && <>
                <div><span className="text-gray-400">Teléfono:</span> <span className="text-gray-900 font-medium">{order.phone ?? '—'}</span></div>
                <div><span className="text-gray-400">Dirección:</span> <span className="text-gray-900 font-medium">{order.address ?? '—'}</span></div>
                <div><span className="text-gray-400">Día preferido:</span> <span className="text-gray-900 font-medium">{fmtDate(order.preferred_date)}</span></div>
                <div><span className="text-gray-400">Hora preferida:</span> <span className="text-gray-900 font-medium">{order.preferred_time ?? '—'}</span></div>
              </>}
              {order.notes && <div className="col-span-2"><span className="text-gray-400">Notas cliente:</span> <span className="text-gray-900">{order.notes}</span></div>}
            </div>
          </div>

          {/* Productos */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Productos</p>
            <div className="space-y-2">
              {(order.items ?? []).map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 text-sm">
                  <div>
                    <span className="font-semibold text-gray-900">
                      Persiana {item.blind_type === 'blocking' ? 'bloqueante' : 'estándar'}
                      {item.quantity > 1 && ` ×${item.quantity}`}
                    </span>
                    <span className="text-gray-500 ml-2">{item.width}×{item.height}mm · {item.mechanism}</span>
                    <br />
                    <span className="text-xs text-gray-400">Caja: {item.box_color_name} · Lamas: {item.slat_color_name}</span>
                  </div>
                  <span className="font-bold text-gray-900">{fmt(item.estimated_price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-3 px-4 py-3 bg-red-50 rounded-xl border border-red-100">
              <span className="font-bold text-gray-900">Total con IVA</span>
              <span className="font-black text-red-700 text-lg">{fmt(order.total_with_iva)}</span>
            </div>
          </div>

          {/* Gestión admin */}
          <div className="border-t border-gray-100 pt-6 space-y-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Gestión del pedido</p>

            {/* Estado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white">
                {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Fecha y hora confirmada (solo particulares) */}
            {isParticular && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha confirmada</label>
                  <input type="date" value={confirmedDate} onChange={e => setConfirmedDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Hora confirmada</label>
                  <select value={confirmedTime} onChange={e => setConfirmedTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white">
                    <option value="">Selecciona hora</option>
                    {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Notas admin */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas internas</label>
              <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={3}
                placeholder="Notas solo visibles para el admin..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none" />
            </div>

            {/* Acciones */}
            <div className="flex flex-wrap gap-3 pt-2">
              {/* Guardar */}
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-red-700 hover:bg-red-800 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saved ? '✓ Guardado' : saving ? 'Guardando...' : 'Guardar cambios'}
              </button>

              {/* Email al cliente */}
              <button onClick={handleSendEmail} disabled={sendingEmail}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm rounded-xl transition-colors disabled:opacity-60">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {emailSent ? '✓ Enviado' : 'Email cliente'}
              </button>

              {/* Google Calendar */}
              {isParticular && calendarUrl && (
                <a href={calendarUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-sm rounded-xl transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="18" rx="2" stroke="#4285F4" strokeWidth="1.5"/>
                    <path d="M3 9h18" stroke="#4285F4" strokeWidth="1.5"/>
                    <path d="M8 4V2M16 4V2" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
                    <rect x="8" y="13" width="3" height="3" rx="0.5" fill="#EA4335"/>
                  </svg>
                  Añadir al calendario
                </a>
              )}
            </div>

            {/* Aviso si no hay fecha para el calendar */}
            {isParticular && !calendarUrl && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Asigna fecha y hora confirmada para generar el enlace de Google Calendar
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── PANEL ADMIN ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate()
  const [user,         setUser]         = useState(null)
  const [orders,       setOrders]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [selectedOrder,setSelectedOrder]= useState(null)
  const [filter,       setFilter]       = useState('all')
  const [search,       setSearch]       = useState('')
  const [unauthorized, setUnauthorized] = useState(false)

  useEffect(() => { checkAdmin() }, [])

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()

    const isAdmin = profile?.role === 'admin' || user.user_metadata?.user_type === 'admin'
    if (!isAdmin) { setUnauthorized(true); setLoading(false); return }

    setUser(user)
    await loadOrders()
  }

  async function loadOrders() {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        profiles (email, role)
      `)
      .order('created_at', { ascending: false })

    if (error) console.error('Error cargando pedidos:', error)

    // Si profiles es null, intentar obtener el email de auth directamente
    const enriched = (data ?? []).map(o => ({
      ...o,
      profiles: o.profiles ?? { email: o.user_id, role: 'user' }
    }))

    setOrders(enriched)
    setLoading(false)
  }

  const filtered = orders.filter(o => {
    const matchFilter = filter === 'all' || o.status === filter
    const matchSearch = !search ||
      o.profiles?.email?.toLowerCase().includes(search.toLowerCase()) ||
      o.address?.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const stats = {
    total:     orders.length,
    pending:   orders.filter(o => o.status === 'pending').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    completed: orders.filter(o => o.status === 'completed').length,
    revenue:   orders.filter(o => o.status !== 'cancelled').reduce((a, o) => a + (o.total_with_iva ?? 0), 0),
  }

  if (unauthorized) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Acceso denegado</h2>
        <p className="text-gray-500 text-sm">No tienes permisos de administrador.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <img src="/persianassantanderlogo.png" alt="Persianas Santander" className="h-9 w-auto"
                onError={e => { e.target.src = '/persianassantanderlogo.svg' }} />
              <div className="hidden sm:block h-6 w-px bg-gray-200" />
              <span className="hidden sm:flex items-center gap-2 text-sm font-bold text-gray-700">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                Panel de administración
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 hidden md:block">{user?.email}</span>
              <a href="/" className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                Ver web
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total pedidos',  value: stats.total,                    color: 'text-gray-900' },
            { label: 'Pendientes',     value: stats.pending,                  color: 'text-amber-600' },
            { label: 'Confirmados',    value: stats.confirmed,                color: 'text-blue-600'  },
            { label: 'Completados',    value: stats.completed,                color: 'text-green-600' },
            { label: 'Facturación est.',value: fmt(stats.revenue),            color: 'text-red-700'   },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className={`text-2xl font-black ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Filtros y búsqueda */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por email, dirección o ID..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all',       label: 'Todos'      },
              { key: 'pending',   label: 'Pendientes' },
              { key: 'confirmed', label: 'Confirmados'},
              { key: 'completed', label: 'Completados'},
              { key: 'cancelled', label: 'Cancelados' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  filter === key ? 'bg-red-700 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla de pedidos */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 text-sm">No hay pedidos que mostrar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['ID','Cliente','Tipo','Fecha','Cita solicitada','Total','Estado',''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        #{order.id.slice(0,8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-900 font-medium truncate max-w-[160px] block">
                          {order.profiles?.email ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          order.user_type === 'professional' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {order.user_type === 'professional' ? 'Pro' : 'Particular'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(order.created_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {order.preferred_date
                          ? <span className="text-gray-900">{fmtDate(order.preferred_date)} {order.preferred_time}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{fmt(order.total_with_iva)}</td>
                      <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedOrder(order)}
                          className="text-xs font-semibold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                          Gestionar →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-center text-gray-400">
          {filtered.length} pedido{filtered.length !== 1 ? 's' : ''} · Última actualización: {new Date().toLocaleTimeString('es-ES')}
          <button onClick={loadOrders} className="ml-2 text-red-600 hover:underline">Actualizar</button>
        </p>
      </div>

      {/* Modal pedido */}
      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={() => { loadOrders(); setSelectedOrder(null) }}
        />
      )}
    </div>
  )
}