import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase/client'
import { generateInvoicePDF } from '../services/invoicePDF'
import { setProfessionalDiscountForUser } from '../services/settings'
import { notifyStatusChange, confirmAppointment, sendInvoiceEmail } from '../services/email'

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
  const [generatingInvoice, setGeneratingInvoice] = useState(false)
  const [existingInvoice,   setExistingInvoice]   = useState(null)

  useEffect(() => { loadInvoice() }, [])

  async function loadInvoice() {
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('order_id', order.id)
      .maybeSingle()
    setExistingInvoice(data ?? null)
  }

  // Crea el registro de factura en BD (sin descargar PDF)
  async function createInvoiceRecord() {
    const totalSinIva = (order.total_with_iva ?? 0) / 1.21
    const iva         = (order.total_with_iva ?? 0) - totalSinIva
    const invoiceNum  = `FAC-${Date.now().toString().slice(-8)}`

    const { data: inv, error } = await supabase
      .from('invoices')
      .insert({
        order_id:           order.id,
        user_id:            order.user_id,
        invoice_number:     invoiceNum,
        payment_status:     'pending_payment',
        total_without_iva:  totalSinIva,
        iva:                iva,
        total_with_iva:     order.total_with_iva,
        items:              order.items,
      })
      .select()
      .single()

    if (error) throw error
    setExistingInvoice(inv)
    return inv
  }

  // Botón manual: crea registro (si no existe) y descarga el PDF
  async function handleGenerateInvoice() {
    setGeneratingInvoice(true)
    try {
      let inv = existingInvoice
      if (!inv) inv = await createInvoiceRecord()

      const { data: empresaData } = await supabase
        .from('professional_data')
        .select('*')
        .eq('user_id', order.user_id)
        .maybeSingle()

      generateInvoicePDF(inv, order, empresaData)
    } catch (e) {
      console.error('Error generando factura:', e)
    } finally {
      setGeneratingInvoice(false)
    }
  }

  async function handlePaymentStatus(newStatus) {
    if (!existingInvoice) return
    const { data } = await supabase
      .from('invoices')
      .update({ payment_status: newStatus })
      .eq('id', existingInvoice.id)
      .select()
      .single()
    if (data) setExistingInvoice(data)
  }

  const calendarUrl = buildCalendarUrl(order, confirmedDate, confirmedTime)
  const isParticular    = order.user_type === 'public'
  const tieneInstalacion = order.installacion !== false

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
      // Si se cancela el pedido, eliminar la factura asociada automáticamente
      if (status === 'cancelled' && existingInvoice) {
        await supabase.from('invoices').delete().eq('id', existingInvoice.id)
        setExistingInvoice(null)
      }
      // Auto-generar factura cuando se confirma el pedido (si no existe aún)
      if (status === 'confirmed' && !existingInvoice) {
        try { await createInvoiceRecord() } catch (e) { console.error('Auto-factura:', e) }
      }

      // Email automático al cliente si cambió el estado
      const clientEmail = order.profiles?.email
      if (clientEmail) {
        const statusLabels = { pending: 'Pendiente', confirmed: 'Confirmado', completed: 'Completado', cancelled: 'Cancelado' }
        notifyStatusChange({
          userEmail:     clientEmail,
          orderId:       order.id,
          status,
          statusLabel:   statusLabels[status] ?? status,
          confirmedDate,
          confirmedTime,
        })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      onUpdate()
    }
  }

  async function handleDeleteOrder() {
    if (!window.confirm('¿Eliminar definitivamente este pedido cancelado? Esta acción no se puede deshacer.')) return
    if (existingInvoice) {
      await supabase.from('invoices').delete().eq('id', existingInvoice.id)
    }
    const { error } = await supabase.from('orders').delete().eq('id', order.id)
    if (!error) {
      onUpdate()
      onClose()
    }
  }

  async function handleSendEmail() {
    setSendingEmail(true)
    try {
      const clientEmail = order.profiles?.email
      if (clientEmail) {
        if (existingInvoice) {
          // Enviar factura al cliente
          await sendInvoiceEmail({
            userEmail: clientEmail,
            invoice:   existingInvoice,
            orderId:   order.id,
            items:     order.items,
          })
        } else {
          // Sin factura: enviar confirmación de cita
          await confirmAppointment({
            userEmail:     clientEmail,
            confirmedDate,
            confirmedTime,
            address:       order.address,
          })
        }
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
                      {({'laminada':'Paño laminado','autoblocante':'Paño autoblocante','blocking':'Bloqueante','sistema_mini_pvc':'Sistema Mini PVC','sistema_mini_aluminio':'Sistema Mini Aluminio','sistema_mini_autoblocante':'Sistema Mini Autoblocante','solo_guias':'Solo guías','solo_motor':'Solo motor','motor_mas_guias':'Motor + Guías'})[item.blind_type] ?? item.blind_type ?? '—'}
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

            {/* Aviso pago si sin instalación */}
            {!tieneInstalacion && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-amber-700 mb-1">Pedido sin instalación — Solo material</p>
                <p className="text-xs text-amber-600">El cliente debe pagar en 24-48h. Formas de pago: Bizum, transferencia o efectivo. Marca el estado como "Completado" cuando se confirme el pago.</p>
              </div>
            )}

            {/* Fecha y hora confirmada (solo particulares con instalación) */}
            {isParticular && tieneInstalacion && (
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

              {/* Eliminar pedido (solo cancelados) */}
              {status === 'cancelled' && (
                <button onClick={handleDeleteOrder}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-semibold text-sm rounded-xl transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Eliminar pedido
                </button>
              )}

              {/* Email al cliente */}
              <button onClick={handleSendEmail} disabled={sendingEmail}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm rounded-xl transition-colors disabled:opacity-60">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {emailSent ? '✓ Enviado' : existingInvoice ? 'Enviar factura' : 'Email cliente'}
              </button>

              {/* Google Calendar */}
              {isParticular && tieneInstalacion && calendarUrl && (
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
            {isParticular && tieneInstalacion && !calendarUrl && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Asigna fecha y hora confirmada para generar el enlace de Google Calendar
              </p>
            )}

            {/* ── SECCIÓN FACTURA ── */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Facturación</p>

              {!existingInvoice ? (
                <button onClick={handleGenerateInvoice} disabled={generatingInvoice}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-60">
                  {generatingInvoice
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                  }
                  {generatingInvoice ? 'Generando...' : 'Generar factura'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{existingInvoice.invoice_number}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        existingInvoice.payment_status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {existingInvoice.payment_status === 'paid' ? 'Pagada' : 'Pendiente de pago'}
                      </span>
                    </div>
                    <button onClick={() => generateInvoicePDF(existingInvoice, order)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Descargar PDF
                    </button>
                  </div>

                  {/* Cambiar estado de pago */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePaymentStatus('pending_payment')}
                      disabled={existingInvoice.payment_status === 'pending_payment'}
                      className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
                        existingInvoice.payment_status === 'pending_payment'
                          ? 'bg-amber-100 text-amber-700 cursor-default'
                          : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}>
                      Pendiente de pago
                    </button>
                    <button
                      onClick={() => handlePaymentStatus('paid')}
                      disabled={existingInvoice.payment_status === 'paid'}
                      className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
                        existingInvoice.payment_status === 'paid'
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}>
                      Marcar como pagada
                    </button>
                  </div>
                </div>
              )}
            </div>
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
  const [page,         setPage]         = useState(1)
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const PAGE_SIZE = 15

  useEffect(() => { checkAdmin() }, [])

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()

    const isAdmin = profile?.role === 'admin' || user.user_metadata?.user_type === 'admin'
    if (!isAdmin) { setUnauthorized(true); setLoading(false); return }

    setUser(user)
    await cleanupCancelledInvoices()
    await loadOrders()
  }

  async function cleanupCancelledInvoices() {
    try {
      // Obtener IDs de pedidos cancelados
      const { data: cancelledOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('status', 'cancelled')

      if (!cancelledOrders?.length) return

      const cancelledIds = cancelledOrders.map(o => o.id)

      // Eliminar todas las facturas vinculadas a pedidos cancelados
      await supabase
        .from('invoices')
        .delete()
        .in('order_id', cancelledIds)
    } catch (err) {
      console.error('Error limpiando facturas canceladas:', err)
    }
  }

  async function loadOrders() {
    setLoading(true)
    try {
      // 1. Cargar pedidos
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // 2. Cargar perfiles por separado
      const userIds = [...new Set((ordersData ?? []).map(o => o.user_id).filter(Boolean))]
      let profilesMap = {}
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, role')
          .in('id', userIds)
        ;(profilesData ?? []).forEach(p => { profilesMap[p.id] = p })
      }

      // 3. Combinar
      const enriched = (ordersData ?? []).map(o => ({
        ...o,
        profiles: profilesMap[o.user_id] ?? { email: '—', role: 'user' }
      }))

      setOrders(enriched)
    } catch (err) {
      console.error('Error cargando pedidos:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteOrderDirect(order) {
    if (!window.confirm(`¿Eliminar definitivamente el pedido #${order.id.slice(0,8).toUpperCase()}? Esta acción no se puede deshacer.`)) return
    const { data: inv } = await supabase.from('invoices').select('id').eq('order_id', order.id).maybeSingle()
    if (inv) await supabase.from('invoices').delete().eq('id', inv.id)
    const { error } = await supabase.from('orders').delete().eq('id', order.id)
    if (!error) loadOrders()
  }

  const filtered = orders.filter(o => {
    const matchFilter = filter === 'all' || o.status === filter
    const matchSearch = !search ||
      o.profiles?.email?.toLowerCase().includes(search.toLowerCase()) ||
      o.address?.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase())
    const d = o.created_at ? o.created_at.slice(0, 10) : ''
    const matchFrom = !dateFrom || d >= dateFrom
    const matchTo   = !dateTo   || d <= dateTo
    return matchFilter && matchSearch && matchFrom && matchTo
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

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

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

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
              <a href="/manual-admin.html" target="_blank" rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Manual
              </a>
              <button onClick={handleLogout}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Cerrar sesión
              </button>
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
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Buscar por email, dirección o ID..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Desde</label>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
                className="px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white" />
              <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Hasta</label>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
                className="px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white" />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }}
                  className="text-xs text-gray-400 hover:text-red-600 transition-colors"
                  title="Limpiar fechas">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all',       label: 'Todos'      },
              { key: 'pending',   label: 'Pendientes' },
              { key: 'confirmed', label: 'Confirmados'},
              { key: 'completed', label: 'Completados'},
              { key: 'cancelled', label: 'Cancelados' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => { setFilter(key); setPage(1) }}
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
                  {paginated.map(order => (
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
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSelectedOrder(order)}
                            className="text-xs font-semibold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                            Gestionar →
                          </button>
                          {order.status === 'cancelled' && (
                            <button onClick={() => handleDeleteOrderDirect(order)}
                              title="Eliminar pedido cancelado"
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Paginación ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2 pt-2 pb-1">
            <p className="text-xs text-gray-400">
              Página {safePage} de {totalPages} · {filtered.length} pedido{filtered.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Primera página"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Página anterior"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(safePage - 2, totalPages - 4))
                const p = start + i
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                      p === safePage
                        ? 'bg-red-700 text-white'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Página siguiente"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Última página"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-center text-gray-400">
          {filtered.length} pedido{filtered.length !== 1 ? 's' : ''} · Última actualización: {new Date().toLocaleTimeString('es-ES')}
          <button onClick={loadOrders} className="ml-2 text-red-600 hover:underline">Actualizar</button>
        </p>

        {/* ── ANALYTICS ── */}
        <AdminAnalyticsSection />

        {/* ── SECCIÓN FACTURAS ADMIN ── */}
        <AdminInvoicesSection />

        {/* ── SECCIÓN PROFESIONALES ADMIN ── */}
        <AdminProfessionalsSection />

        {/* ── SECCIÓN CLIENTES ADMIN ── */}
        <AdminClientsSection />

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

// ── SECCIÓN FACTURAS ADMIN ────────────────────────────────────────────────
function AdminInvoicesSection() {
  const [invoices,    setInvoices]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [invDateFrom, setInvDateFrom] = useState('')
  const [invDateTo,   setInvDateTo]   = useState('')

  useEffect(() => { loadInvoices() }, [])

  async function loadInvoices() {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('*, orders(user_id, items, address, phone)')
      .order('created_at', { ascending: false })
    setInvoices(data ?? [])
    setLoading(false)
  }

  const filteredInvoices = invoices.filter(inv => {
    const d = inv.created_at ? inv.created_at.slice(0, 10) : ''
    return (!invDateFrom || d >= invDateFrom) && (!invDateTo || d <= invDateTo)
  })

  async function handlePaymentStatus(invoiceId, newStatus) {
    await supabase.from('invoices').update({ payment_status: newStatus }).eq('id', invoiceId)
    setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, payment_status: newStatus } : i))
  }

  const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
  const fmtDate = (d) => d ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—'

  function exportCSV() {
    const headers = ['Nº Factura', 'Fecha', 'Base imponible', 'IVA', 'Total con IVA', 'Estado pago']
    const rows = filteredInvoices.map(inv => [
      inv.invoice_number,
      inv.created_at ? new Date(inv.created_at).toLocaleDateString('es-ES') : '—',
      (inv.total_without_iva ?? 0).toFixed(2).replace('.', ','),
      (inv.iva ?? 0).toFixed(2).replace('.', ','),
      (inv.total_with_iva ?? 0).toFixed(2).replace('.', ','),
      inv.payment_status === 'paid' ? 'Pagada' : 'Pendiente de pago',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `facturas_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">Facturas</h2>
        <div className="flex flex-wrap items-center gap-2">
          {invoices.length > 0 && (
            <>
              <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Desde</label>
              <input type="date" value={invDateFrom} onChange={e => setInvDateFrom(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white" />
              <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Hasta</label>
              <input type="date" value={invDateTo} onChange={e => setInvDateTo(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white" />
              {(invDateFrom || invDateTo) && (
                <button onClick={() => { setInvDateFrom(''); setInvDateTo('') }}
                  className="text-xs text-gray-400 hover:text-red-600 transition-colors" title="Limpiar fechas">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {filteredInvoices.length > 0 && (
                <button onClick={exportCSV}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Exportar CSV {(invDateFrom || invDateTo) ? `(${filteredInvoices.length})` : ''}
                </button>
              )}
            </>
          )}
          <button onClick={loadInvoices} className="text-xs text-red-600 hover:underline">Actualizar</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            {invoices.length === 0 ? 'No hay facturas generadas todavía' : 'No hay facturas en ese rango de fechas'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Nº Factura', 'Fecha', 'Total', 'Estado pago', 'Cambiar estado', 'PDF'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(inv.created_at)}</td>
                    <td className="px-4 py-3 font-bold text-gray-900">{fmt(inv.total_with_iva)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        inv.payment_status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {inv.payment_status === 'paid' ? 'Pagada' : 'Pendiente de pago'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePaymentStatus(inv.id, 'pending_payment')}
                          disabled={inv.payment_status === 'pending_payment'}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                            inv.payment_status === 'pending_payment'
                              ? 'bg-amber-100 text-amber-700 cursor-default'
                              : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}>
                          Pendiente
                        </button>
                        <button
                          onClick={() => handlePaymentStatus(inv.id, 'paid')}
                          disabled={inv.payment_status === 'paid'}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                            inv.payment_status === 'paid'
                              ? 'bg-green-100 text-green-700 cursor-default'
                              : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}>
                          Pagada
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { import('../services/invoicePDF').then(m => m.generateInvoicePDF(inv, inv.orders ?? {})) }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── ANALYTICS SECTION ────────────────────────────────────────────────────
function AdminAnalyticsSection() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    setLoading(true)
    const [
      { data: ordersData },
      { data: budgetsData },
      { data: invoicesData },
      { data: profilesData },
    ] = await Promise.all([
      supabase.from('orders').select('status, total_with_iva, user_type, user_id, created_at'),
      supabase.from('budgets').select('user_id, user_type'),
      supabase.from('invoices').select('total_with_iva, payment_status'),
      supabase.from('profiles').select('id, user_type, role'),
    ])

    const orders   = ordersData   ?? []
    const budgets  = budgetsData  ?? []
    const invoices = invoicesData ?? []
    const profiles = profilesData ?? []

    // Contactos únicos: union de user_ids en orders + budgets
    const contactIds = new Set([
      ...orders.map(o => o.user_id).filter(Boolean),
      ...budgets.map(b => b.user_id).filter(Boolean),
    ])

    // Desglose por tipo usando orders (fuente fiable) + profiles
    const proIds  = new Set([
      ...orders.filter(o => o.user_type === 'professional').map(o => o.user_id),
      ...budgets.filter(b => b.user_type === 'professional').map(b => b.user_id),
      ...profiles.filter(p => p.user_type === 'professional').map(p => p.id),
    ])
    const totalContacts  = contactIds.size
    const proContacts    = [...contactIds].filter(id => proIds.has(id)).length
    const partContacts   = totalContacts - proContacts

    const active     = orders.filter(o => o.status !== 'cancelled')
    const completed  = orders.filter(o => o.status === 'completed')
    const cancelled  = orders.filter(o => o.status === 'cancelled')
    const totalRev   = active.reduce((a, o) => a + (o.total_with_iva ?? 0), 0)
    const paidRev    = invoices.filter(i => i.payment_status === 'paid').reduce((a, i) => a + (i.total_with_iva ?? 0), 0)
    const pendingRev = invoices.filter(i => i.payment_status !== 'paid').reduce((a, i) => a + (i.total_with_iva ?? 0), 0)

    // Pedidos por mes (últimos 6 meses)
    const now    = new Date()
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return { label: d.toLocaleString('es-ES', { month: 'short' }), year: d.getFullYear(), month: d.getMonth() }
    })
    const byMonth = months.map(m => ({
      label:  m.label,
      orders: orders.filter(o => {
        const d = new Date(o.created_at)
        return d.getFullYear() === m.year && d.getMonth() === m.month
      }).length,
    }))
    const maxOrders = Math.max(...byMonth.map(m => m.orders), 1)

    setStats({
      totalContacts, proContacts, partContacts,
      totalBudgets:    budgets.length,
      totalOrders:     orders.length,
      completedOrders: completed.length,
      cancelledOrders: cancelled.length,
      proOrders:       orders.filter(o => o.user_type === 'professional').length,
      partOrders:      orders.filter(o => o.user_type !== 'professional').length,
      totalRev, paidRev, pendingRev,
      conversion: budgets.length > 0 ? ((orders.length / budgets.length) * 100).toFixed(1) : '0.0',
      byMonth, maxOrders,
    })
    setLoading(false)
  }

  const fmt  = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
  const fmtN = (n) => new Intl.NumberFormat('es-ES').format(n ?? 0)

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!stats) return null

  const kpis = [
    { label: 'Contactos activos',     value: fmtN(stats.totalContacts),  sub: `${stats.proContacts} pro · ${stats.partContacts} particular`, color: 'text-gray-900',  bg: 'bg-gray-50'   },
    { label: 'Presupuestos generados',value: fmtN(stats.totalBudgets),   sub: 'desde el inicio',            color: 'text-blue-700',  bg: 'bg-blue-50'   },
    { label: 'Pedidos realizados',    value: fmtN(stats.totalOrders),    sub: `${stats.cancelledOrders} cancelados`, color: 'text-amber-700', bg: 'bg-amber-50'  },
    { label: 'Pedidos completados',   value: fmtN(stats.completedOrders),sub: 'instalaciones finalizadas',  color: 'text-green-700', bg: 'bg-green-50'  },
    { label: 'Tasa de conversión',    value: `${stats.conversion}%`,     sub: 'presupuesto → pedido',       color: 'text-purple-700',bg: 'bg-purple-50' },
    { label: 'Facturación cobrada',   value: fmt(stats.paidRev),         sub: `${fmt(stats.pendingRev)} pendiente`, color: 'text-red-700', bg: 'bg-red-50' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Análisis del negocio</h2>
        <button onClick={loadStats} className="text-xs text-red-600 hover:underline">Actualizar</button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(({ label, value, sub, color, bg }) => (
          <div key={label} className={`rounded-xl border border-gray-200 p-4 ${bg}`}>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-sm font-semibold text-gray-700 mt-0.5">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Desglose tipo cliente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-bold text-gray-700 mb-3">Pedidos por tipo de cliente</p>
          <div className="space-y-3">
            {[
              { label: 'Profesionales', value: stats.proOrders,  total: stats.totalOrders, color: 'bg-blue-500'  },
              { label: 'Particulares',  value: stats.partOrders, total: stats.totalOrders, color: 'bg-gray-400'  },
            ].map(({ label, value, total, color }) => {
              const pct = total > 0 ? Math.round((value / total) * 100) : 0
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{label}</span>
                    <span className="text-gray-500">{value} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Mini gráfico de barras — pedidos por mes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-bold text-gray-700 mb-3">Pedidos últimos 6 meses</p>
          <div className="flex items-end gap-2 h-20">
            {stats.byMonth.map(({ label, orders }) => (
              <div key={label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-gray-700">{orders || ''}</span>
                <div
                  className="w-full bg-red-600 rounded-t transition-all"
                  style={{ height: `${Math.max((orders / stats.maxOrders) * 64, orders > 0 ? 4 : 0)}px` }}
                />
                <span className="text-xs text-gray-400 capitalize">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CELDA DE DESCUENTO INDIVIDUAL ────────────────────────────────────────
function DiscountCell({ userId, initial }) {
  const [value,  setValue]  = useState(String(initial))
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  async function save() {
    const n = parseFloat(value)
    if (isNaN(n) || n < 0 || n > 100) return
    setSaving(true)
    const ok = await setProfessionalDiscountForUser(userId, n)
    setSaving(false)
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  return (
    <div className="flex items-center gap-1">
      <div className="relative">
        <input
          type="number" min="0" max="100" step="1"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="w-16 px-2 py-1 pr-5 rounded-lg border border-gray-300 text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-red-200"
        />
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
      </div>
      <button onClick={save} disabled={saving}
        className={`px-2 py-1 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 ${saved ? 'bg-green-600 text-white' : 'bg-red-700 hover:bg-red-800 text-white'}`}>
        {saving ? '…' : saved ? '✓' : 'OK'}
      </button>
    </div>
  )
}

// ── SECCIÓN PROFESIONALES ADMIN ───────────────────────────────────────────
function AdminClientsSection() {
  const [clients,   setClients]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [deleting,  setDeleting]  = useState(null)
  const [confirm,   setConfirm]   = useState(null)
  const [deleteErr, setDeleteErr] = useState('')

  useEffect(() => { loadClients() }, [])

  async function loadClients() {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_get_all_users')
    if (error) console.error('Error cargando usuarios:', error)
    setClients(data ?? [])
    setLoading(false)
  }

  async function handleDelete(userId) {
    setDeleting(userId)
    setDeleteErr('')
    const { error } = await supabase.rpc('admin_delete_user', { target_user_id: userId })
    if (error) {
      console.error('Error eliminando usuario:', error)
      setDeleteErr(error.message)
    } else {
      setClients(prev => prev.filter(c => c.id !== userId))
      setConfirm(null)
    }
    setDeleting(null)
  }

  const filtered = clients.filter(c =>
    !search ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.user_type?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-bold text-gray-900">Todos los clientes</h2>
        <input
          type="text" placeholder="Buscar por email o tipo…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 w-64"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No hay clientes registrados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Email', 'Tipo', 'Registro', 'Acciones'].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${h === 'Acciones' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-900 font-medium">{c.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        c.user_type === 'professional' ? 'bg-blue-100 text-blue-700' :
                        c.user_type === 'admin' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {c.user_type === 'admin' ? 'Admin' : c.user_type === 'professional' ? 'Profesional' : 'Cliente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(c.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {c.user_type === 'admin' ? (
                        <span className="text-xs text-gray-300">—</span>
                      ) : confirm === c.id ? (
                        <div className="inline-flex items-center gap-2">
                          <span className="text-xs text-red-600 font-semibold">¿Eliminar definitivamente?</span>
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={deleting === c.id}
                            className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg transition-colors disabled:opacity-60">
                            {deleting === c.id ? '…' : 'Sí, eliminar'}
                          </button>
                          <button onClick={() => setConfirm(null)}
                            className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirm(c.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {deleteErr && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          Error al eliminar: {deleteErr}
        </div>
      )}
      <p className="text-xs text-gray-400">{filtered.length} usuario{filtered.length !== 1 ? 's' : ''} · Los admins no se pueden eliminar desde aquí</p>
    </div>
  )
}

function AdminProfessionalsSection() {
  const [professionals, setProfessionals] = useState([])
  const [loading,       setLoading]       = useState(true)

  useEffect(() => { loadProfessionals() }, [])

  async function loadProfessionals() {
    setLoading(true)
    const { data } = await supabase
      .from('professional_data')
      .select('*, profiles(email)')
      .order('created_at', { ascending: false })
    setProfessionals(data ?? [])
    setLoading(false)
  }

  function exportToExcel() {
    const headers = ['Razón social', 'CIF/NIF', 'Teléfono', 'Dirección fiscal', 'CP', 'Ciudad', 'Provincia', 'Email facturación', 'Email cuenta']
    const rows = professionals.map(p => [
      p.razon_social ?? '',
      p.cif_nif ?? '',
      p.telefono ?? '',
      p.direccion_fiscal ?? '',
      p.codigo_postal ?? '',
      p.ciudad ?? '',
      p.provincia ?? '',
      p.email_facturacion ?? '',
      p.profiles?.email ?? '',
    ])

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `profesionales_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Clientes profesionales</h2>
        <button onClick={exportToExcel}
          className="flex items-center gap-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : professionals.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No hay profesionales registrados todavía</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Razón social', 'CIF/NIF', 'Teléfono', 'Ciudad', 'Email cuenta', 'Email facturación', 'Descuento'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {professionals.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900">{p.razon_social ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.cif_nif ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.telefono ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.ciudad ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.profiles?.email ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.email_facturacion ?? '—'}</td>
                    <td className="px-4 py-3"><DiscountCell userId={p.user_id} initial={p.discount_percent ?? ''} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}