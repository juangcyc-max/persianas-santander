import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase/client'
import { generateInvoicePDF } from '../services/invoicePDF'
import { generateBudgetPDF, generateAdminMultiBudgetPDF, generateProQuotePDF } from '../services/pdf'
import { notifyStatusChange, confirmAppointment, sendInvoiceEmail, sendBudgetResend } from '../services/email'
import { getProfessionalDiscount, setProfessionalDiscount } from '../services/settings'
import { getProductPrices, setProductPrices, DEFAULT_PRICES, DEFAULT_MOTOR_PRICES, DEFAULT_GUIDE_PRICE_PER_ML, DEFAULT_INSTALACION_PRICE, DEFAULT_INSTALACION_FIJA } from '../services/prices'

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
          // Generar PDF en base64 y enviarlo adjunto
          const pdfBase64 = await generateInvoicePDF(existingInvoice, order, null, { returnBase64: true })
          await sendInvoiceEmail({
            userEmail: clientEmail,
            invoice:   existingInvoice,
            orderId:   order.id,
            items:     order.items,
            pdfBase64,
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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
                      {({'laminada':'Paño laminado','autoblocante':'Paño autoblocante','blocking':'Bloqueante','sistema_mini_cajon_pvc':'Sistema Mini Cajón PVC','sistema_mini_cajon_aluminio':'Sistema Mini Cajón Aluminio','sistema_mini_autoblocante':'Sistema Mini Autoblocante','solo_guias':'Solo guías','solo_motor':'Solo motor','mosquitera_enrollable':'Mosquitera Enrollable','sistema_mini_pvc':'Sistema Mini PVC','sistema_mini_aluminio':'Sistema Mini Aluminio','motor_mas_guias':'Motor + Guías','pano_mas_guias':'Paño + Guías','normal':'Estándar'})[item.blind_type] ?? item.blind_type ?? '—'}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

// ── TABS SIDEBAR ─────────────────────────────────────────────────────────
const ADMIN_TABS = [
  { id: 'overview',     label: 'Resumen',       icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
  { id: 'pedidos',      label: 'Pedidos',        icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'presupuestos', label: 'Presupuestos',   icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'facturas',     label: 'Facturas',       icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'profesionales', label: 'Profesionales',  icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'clientes',     label: 'Clientes',       icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { id: 'configuracion', label: 'Configuración', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

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
  const [activeTab,    setActiveTab]    = useState('pedidos')
  const [menuOpen,     setMenuOpen]     = useState(false)
  const [proNotif,     setProNotif]     = useState(0)
  const PAGE_SIZE = 15

  useEffect(() => { checkAdmin() }, [])
  useEffect(() => { loadProNotif() }, [activeTab])

  async function loadProNotif() {
    const [{ count: pendingQuotes }, { count: unreadMsgs }] = await Promise.all([
      supabase.from('pro_purchase_quotes').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('pro_messages').select('id', { count: 'exact', head: true }).eq('sender_role', 'professional').eq('read_by_admin', false),
    ])
    setProNotif((pendingQuotes ?? 0) + (unreadMsgs ?? 0))
  }

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
    loadProNotif()

    // Realtime: actualizar badge cuando llegan nuevas cotizaciones o mensajes
    supabase.channel('admin-pro-notif')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pro_purchase_quotes' }, loadProNotif)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pro_messages' }, loadProNotif)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pro_purchase_quotes' }, loadProNotif)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pro_messages' }, loadProNotif)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pro_purchase_quotes' }, loadProNotif)
      .subscribe()
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

  const pendingCount = orders.filter(o => o.status === 'pending').length

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src="/persianassantanderlogo.png" alt="Persianas Santander" className="h-9 w-auto"
                onError={e => { e.target.src = '/persianassantanderlogo.svg' }} />
              <div className="hidden sm:block h-6 w-px bg-gray-200" />
              <span className="hidden sm:flex items-center gap-2 text-sm font-bold text-gray-700">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Admin
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 hidden md:block">{user?.email}</span>
              <a href="/manual-admin.html" target="_blank" rel="noopener noreferrer"
                className="hidden sm:flex text-xs font-semibold text-gray-500 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors">
                Manual
              </a>
              <button onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors font-medium">
                Salir
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Sidebar ── */}
          <aside className="lg:w-52 flex-shrink-0">
            {/* Mobile dropdown */}
            <div className="lg:hidden relative mb-4">
              <button onClick={() => setMenuOpen(v => !v)}
                className="w-full bg-white rounded-xl border border-gray-200 flex items-center justify-between px-4 py-3 text-sm font-medium shadow-sm">
                <span className="flex items-center gap-3 text-red-700 font-semibold">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={ADMIN_TABS.find(t => t.id === activeTab)?.icon} />
                  </svg>
                  {ADMIN_TABS.find(t => t.id === activeTab)?.label}
                </span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuOpen && (
                <nav className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden">
                  {ADMIN_TABS.map(({ id, label, icon }) => (
                    <button key={id} onClick={() => { setActiveTab(id); setMenuOpen(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-left border-b border-gray-100 last:border-0 transition-colors ${activeTab === id ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
                      </svg>
                      {label}
                      {id === 'pedidos' && pendingCount > 0 && (
                        <span className="ml-auto text-xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                      )}
                      {id === 'profesionales' && proNotif > 0 && (
                        <span className="ml-auto text-xs font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{proNotif}</span>
                      )}
                    </button>
                  ))}
                </nav>
              )}
            </div>
            {/* Desktop sidebar */}
            <nav className="hidden lg:flex lg:flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {ADMIN_TABS.map(({ id, label, icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-left border-b border-gray-100 last:border-0 transition-colors ${
                    activeTab === id ? 'bg-red-50 text-red-700 border-l-2 border-l-red-700 pl-3.5' : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
                  </svg>
                  {label}
                  {id === 'pedidos' && pendingCount > 0 && (
                    <span className="ml-auto text-xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                  )}
                  {id === 'profesionales' && proNotif > 0 && (
                    <span className="ml-auto text-xs font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{proNotif}</span>
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {/* ── Contenido ── */}
          <main className="flex-1 min-w-0">

            {/* ── RESUMEN ── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Resumen</h1>
                  <p className="text-sm text-gray-500 mt-1">Vista general del negocio.</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Total pedidos',   value: stats.total,        color: 'text-gray-900',  bg: 'bg-white'     },
                    { label: 'Pendientes',       value: stats.pending,      color: 'text-amber-600', bg: 'bg-amber-50'  },
                    { label: 'Confirmados',      value: stats.confirmed,    color: 'text-blue-600',  bg: 'bg-blue-50'   },
                    { label: 'Completados',      value: stats.completed,    color: 'text-green-600', bg: 'bg-green-50'  },
                    { label: 'Cancelados',       value: orders.filter(o => o.status === 'cancelled').length, color: 'text-red-500', bg: 'bg-red-50' },
                    { label: 'Facturación est.', value: fmt(stats.revenue), color: 'text-red-700',   bg: 'bg-white'     },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} className={bg + ' rounded-2xl border border-gray-200 p-5'}>
                      <p className={'text-2xl font-black ' + color}>{value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <AdminAnalyticsSection />
              </div>
            )}

            {/* ── PEDIDOS ── */}
            {activeTab === 'pedidos' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h1 className="text-xl font-bold text-gray-900">Pedidos</h1>
                  <div className="flex items-center gap-2">
                    {filtered.length > 0 && (
                      <button onClick={() => {
                        const headers = ['ID', 'Email', 'Tipo', 'Fecha', 'Total', 'Estado']
                        const rows = filtered.map(o => [
                          o.id.slice(0,8).toUpperCase(),
                          o.profiles?.email ?? '',
                          o.user_type === 'professional' ? 'Profesional' : 'Particular',
                          o.created_at ? new Date(o.created_at).toLocaleDateString('es-ES') : '',
                          (o.total_with_iva ?? 0).toFixed(2).replace('.', ','),
                          STATUS_MAP[o.status]?.label ?? o.status,
                        ])
                        const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(';')).join('\n')
                        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a'); a.href = url
                        a.download = `pedidos_${new Date().toISOString().slice(0,10)}.csv`; a.click()
                        URL.revokeObjectURL(url)
                      }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Exportar CSV
                      </button>
                    )}
                    <button onClick={loadOrders} className="text-xs text-red-600 hover:underline">Actualizar</button>
                  </div>
                </div>
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
                    <div className="flex items-end gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-500">Desde</label>
                        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
                          className="px-2.5 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white w-full" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-500">Hasta</label>
                        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
                          className="px-2.5 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white w-full" />
                      </div>
                      {(dateFrom || dateTo) && (
                        <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }} className="text-gray-400 hover:text-red-600 pb-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { key: 'all',       label: 'Todos'       },
                      { key: 'pending',   label: 'Pendientes'  },
                      { key: 'confirmed', label: 'Confirmados' },
                      { key: 'completed', label: 'Completados' },
                      { key: 'cancelled', label: 'Cancelados'  },
                    ].map(({ key, label }) => (
                      <button key={key} onClick={() => { setFilter(key); setPage(1) }}
                        className={'px-4 py-2 rounded-xl text-sm font-semibold transition-colors ' + (filter === key ? 'bg-red-700 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50')}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {loading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="w-8 h-8 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-gray-500 text-sm">No hay pedidos que mostrar</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            {['ID','Cliente','Tipo','Fecha','Cita','Total','Estado',''].map(h => (
                              <th key={h} className="text-left px-2 py-2 sm:px-4 sm:py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {paginated.map(order => (
                            <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-2 py-2 sm:px-4 sm:py-3 font-mono text-xs text-gray-500">#{order.id.slice(0,8).toUpperCase()}</td>
                              <td className="px-2 py-2 sm:px-4 sm:py-3 font-medium text-gray-900 max-w-[100px] sm:max-w-[160px] truncate">{order.profiles?.email ?? '—'}</td>
                              <td className="px-2 py-2 sm:px-4 sm:py-3">
                                <span className={'text-xs font-bold px-2 py-0.5 rounded-full ' + (order.user_type === 'professional' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                                  {order.user_type === 'professional' ? 'Pro' : 'Particular'}
                                </span>
                              </td>
                              <td className="px-2 py-2 sm:px-4 sm:py-3 text-gray-500 whitespace-nowrap">{fmtDate(order.created_at)}</td>
                              <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">
                                {order.preferred_date
                                  ? <span className="text-gray-900">{fmtDate(order.preferred_date)} {order.preferred_time}</span>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-2 py-2 sm:px-4 sm:py-3 font-bold text-gray-900 whitespace-nowrap">{fmt(order.total_with_iva)}</td>
                              <td className="px-2 py-2 sm:px-4 sm:py-3"><StatusBadge status={order.status} /></td>
                              <td className="px-2 py-2 sm:px-4 sm:py-3">
                                <div className="flex items-center gap-2">
                                  <button onClick={() => setSelectedOrder(order)}
                                    className="text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                                    Gestionar →
                                  </button>
                                  {order.status === 'cancelled' && (
                                    <button onClick={() => handleDeleteOrderDirect(order)} title="Eliminar"
                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-2">
                    <p className="text-xs text-gray-400">Página {safePage} de {totalPages} · {filtered.length} pedidos</p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPage(1)} disabled={safePage === 1} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                      </button>
                      <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={safePage === 1} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const start = Math.max(1, Math.min(safePage - 2, totalPages - 4))
                        const p = start + i
                        return (
                          <button key={p} onClick={() => setPage(p)}
                            className={'w-7 h-7 rounded-lg text-xs font-semibold transition-colors ' + (p === safePage ? 'bg-red-700 text-white' : 'text-gray-500 hover:bg-gray-100')}>
                            {p}
                          </button>
                        )
                      })}
                      <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={safePage === totalPages} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                      <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PRESUPUESTOS ── */}
            {activeTab === 'presupuestos' && <AdminBudgetsSection />}

            {/* ── FACTURAS ── */}
            {activeTab === 'facturas' && <AdminInvoicesSection />}

            {/* ── PROFESIONALES ── */}
            {activeTab === 'profesionales' && <AdminProfesionalesSection adminUser={user} />}

            {/* ── CLIENTES ── */}
            {activeTab === 'clientes' && <AdminClientsSection />}

            {/* ── CONFIGURACIÓN ── */}
            {activeTab === 'configuracion' && <AdminConfigSection />}

          </main>
        </div>
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


// ── SECCIÓN PRESUPUESTOS ADMIN ───────────────────────────────────────────
const BUDGET_STATUS_MAP = {
  pending:  { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700'  },
  reviewed: { label: 'Revisado',   cls: 'bg-blue-100 text-blue-700'    },
  sent:     { label: 'Enviado',    cls: 'bg-purple-100 text-purple-700' },
  accepted: { label: 'Aceptado',   cls: 'bg-green-100 text-green-700'  },
  rejected: { label: 'Rechazado',  cls: 'bg-red-100 text-red-700'      },
}

const BUDGET_TYPE_LABELS = {
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

function BudgetModal({ budget, onClose, onSaved }) {
  const [status,       setStatus]       = useState(budget.budget_status ?? 'pending')
  const [adminNotes,   setAdminNotes]   = useState(budget.admin_notes ?? '')
  const [adminPrice,   setAdminPrice]   = useState(budget.admin_price != null ? String(budget.admin_price) : '')
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [downloading,  setDownloading]  = useState(false)
  const [sending,      setSending]      = useState(false)
  const [sendFeedback, setSendFeedback] = useState('')

  async function handleSave() {
    setSaving(true)
    const updates = {
      budget_status: status,
      admin_notes:   adminNotes || null,
      admin_price:   adminPrice !== '' ? parseFloat(adminPrice) : null,
    }
    const { error } = await supabase.from('budgets').update(updates).eq('id', budget.id)
    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => { setSaved(false); onSaved() }, 1500)
    }
  }

  function getBudgetParams() {
    const effectivePrice = adminPrice !== '' ? parseFloat(adminPrice) : (budget.admin_price ?? budget.total_with_iva)
    const customerData = {
      name:    budget.customer_name ?? '',
      phone:   budget.customer_phone ?? '',
      email:   budget.customer_email ?? '',
      address: budget.customer_address ?? '',
    }
    const configuration = {
      blindType:      budget.blind_type,
      mechanism:      budget.mechanism,
      width:          budget.width,
      height:         budget.height,
      estimatedPrice: effectivePrice,
      motorType:      budget.motor_type ?? null,
      guideType:      budget.guide_type ?? null,
      installacion:   budget.installacion !== false,
      clientNotes:    budget.client_notes ?? '',
    }
    return { customerData, configuration }
  }

  async function handleDownloadPDF() {
    setDownloading(true)
    try {
      const { customerData, configuration } = getBudgetParams()
      await generateBudgetPDF(customerData, configuration, {
        skipSave: true,
        budgetNumberOverride: budget.budget_number ?? null,
      })
    } finally {
      setDownloading(false)
    }
  }

  async function handleSendEmail() {
    setSending(true)
    setSendFeedback('')
    try {
      // Mark as accepted first
      const effectivePrice = adminPrice !== '' ? parseFloat(adminPrice) : (budget.admin_price ?? budget.total_with_iva)
      const updates = {
        budget_status: 'accepted',
        admin_notes:   adminNotes || null,
        admin_price:   effectivePrice,
      }
      await supabase.from('budgets').update(updates).eq('id', budget.id)
      setStatus('accepted')

      const { customerData, configuration } = getBudgetParams()
      const pdfBase64 = await generateBudgetPDF(customerData, configuration, {
        skipSave: true,
        budgetNumberOverride: budget.budget_number ?? null,
        returnBase64: true,
      })
      await sendBudgetResend(customerData, configuration, pdfBase64 ?? null)
      setSendFeedback('ok')
      setTimeout(() => { setSendFeedback(''); onSaved() }, 2000)
    } catch {
      setSendFeedback('error')
    } finally {
      setSending(false)
    }
  }

  const typeLabel = BUDGET_TYPE_LABELS[budget.blind_type] ?? budget.blind_type ?? '—'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs font-mono text-gray-400">{budget.budget_number ?? `#${budget.id?.slice(0,8).toUpperCase()}`}</p>
            <h2 className="text-lg font-bold text-gray-900 mt-0.5">Presupuesto</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Cliente */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Cliente</p>
            <p className="font-semibold text-gray-900">{budget.customer_name ?? '—'}</p>
            <p className="text-sm text-gray-500">{budget.customer_phone ?? ''}{budget.customer_phone && budget.customer_email ? '  ·  ' : ''}{budget.customer_email ?? ''}</p>
            {budget.customer_address && <p className="text-sm text-gray-500">{budget.customer_address}</p>}
          </div>

          {/* Configuración */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Tipo</p>
              <p className="font-medium text-gray-800">{typeLabel}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Medidas</p>
              <p className="font-medium text-gray-800">{budget.width ? `${budget.width} × ${budget.height} mm` : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Mecanismo</p>
              <p className="font-medium text-gray-800 capitalize">{budget.mechanism ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Precio original</p>
              <p className="font-bold text-red-700">{fmtDate ? fmt(budget.total_with_iva) : `${budget.total_with_iva ?? 0} €`}</p>
            </div>
          </div>

          {/* Comentarios del cliente */}
          {budget.client_notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Comentarios del cliente</p>
              <p className="text-sm text-amber-800 whitespace-pre-wrap">{budget.client_notes}</p>
            </div>
          )}

          {/* Estado */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Estado</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {Object.entries(BUDGET_STATUS_MAP).map(([key, { label, cls }]) => (
                <button
                  key={key}
                  onClick={() => setStatus(key)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                    status === key ? `${cls} border-current` : 'border-transparent bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Precio modificado */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Precio ajustado (€ con IVA)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={adminPrice}
              onChange={e => setAdminPrice(e.target.value)}
              placeholder={`Original: ${fmt(budget.total_with_iva)}`}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400"
            />
            <p className="text-xs text-gray-400 mt-1">Deja vacío para mantener el precio original calculado automáticamente.</p>
          </div>

          {/* Notas del admin */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notas internas</label>
            <textarea
              rows={3}
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              placeholder="Notas visibles solo para el administrador…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 resize-none"
            />
          </div>

          {/* Acciones secundarias: PDF + Email */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {downloading ? 'Generando…' : 'Descargar PDF'}
            </button>
            <button
              onClick={handleSendEmail}
              disabled={sending || sendFeedback === 'ok'}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
                sendFeedback === 'ok'    ? 'bg-green-600 text-white' :
                sendFeedback === 'error' ? 'bg-red-200 text-red-800' :
                'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {sending ? 'Enviando…' : sendFeedback === 'ok' ? '✓ Enviado' : sendFeedback === 'error' ? 'Error al enviar' : 'Enviar al cliente'}
            </button>
          </div>

          {/* Acciones principales: Cancelar + Guardar */}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-red-700 hover:bg-red-800 text-white disabled:opacity-60'}`}
            >
              {saving ? '…' : saved ? '✓ Guardado' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MODAL NUEVO PRESUPUESTO (ADMIN) ──────────────────────────────────────
const ADMIN_BUDGET_BLIND_TYPES = [
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

const ADMIN_BUDGET_COLOR_GROUPS = ['Grupo Base', 'Grupo 1', 'Grupo 2', 'Grupo 3']
const ADMIN_MIN_SQM = 1.5
const ADMIN_MOTOR_ONLY = ['autoblocante', 'blocking', 'sistema_mini_autoblocante']
const ADMIN_NO_MOTOR   = ['mosquitera_enrollable']
const ADMIN_PANO_TYPES = ['laminada', 'autoblocante', 'blocking', 'mosquitera_enrollable']
const ADMIN_SISTEMAS   = ['sistema_mini_cajon_pvc', 'sistema_mini_cajon_aluminio', 'sistema_mini_autoblocante']

function calcAdminBudgetPrice({ prices, motorPrices, guidePricePerMl, instalacionPrice, instalacionFija,
  blindType, width, height, mechanism, motorType, guideType, colorGroup, installacion }) {
  if (!prices) return null

  if (blindType === 'solo_motor') {
    const motorCost       = motorPrices[motorType] ?? 0
    const installacionCost = installacion ? instalacionFija : 0
    const subtotalSinIva  = motorCost + installacionCost
    return { subtotalSinIva, iva: subtotalSinIva * 0.21, totalConIva: subtotalSinIva * 1.21 }
  }

  if (blindType === 'solo_guias') {
    const pricePerMl      = guidePricePerMl[guideType] ?? guidePricePerMl.v25
    const guidesCost      = 2 * (height / 1000) * pricePerMl
    const installacionCost = installacion ? instalacionFija : 0
    const subtotalSinIva  = guidesCost + installacionCost
    return { subtotalSinIva, iva: subtotalSinIva * 0.21, totalConIva: subtotalSinIva * 1.21 }
  }

  const areaSqm         = (width / 1000) * (height / 1000)
  const billableSqm     = Math.max(areaSqm, ADMIN_MIN_SQM)
  const productTable    = prices[blindType]
  const pricePerSqm     = productTable?.[colorGroup] ?? productTable?.['Grupo Base'] ?? 0
  let guidesCost = 0
  if (guideType !== 'none' && blindType !== 'mosquitera_enrollable') {
    guidesCost = 2 * (height / 1000) * (guidePricePerMl[guideType] ?? 0)
  }
  const isPano = ADMIN_PANO_TYPES.includes(blindType)
  const motorCost = !isPano && mechanism === 'motor' ? (motorPrices[motorType] ?? 0) : 0
  const installacionCost = installacion ? instalacionPrice * billableSqm : 0
  const subtotalSinIva = pricePerSqm * billableSqm + guidesCost + motorCost + installacionCost
  return { billableSqm, pricePerSqm, guidesCost, motorCost, installacionCost, subtotalSinIva, iva: subtotalSinIva * 0.21, totalConIva: subtotalSinIva * 1.21 }
}

function AdminNewBudgetModal({ onClose, onSaved }) {
  const [cfgPrices,       setCfgPrices]       = useState(null)
  const [motorPrices,     setMotorPrices]     = useState(DEFAULT_MOTOR_PRICES)
  const [guidePricePerMl, setGuidePricePerMl] = useState(DEFAULT_GUIDE_PRICE_PER_ML)
  const [instalacionPrice, setInstalacionPrice] = useState(DEFAULT_INSTALACION_PRICE)
  const [instalacionFija,  setInstalacionFija]  = useState(DEFAULT_INSTALACION_FIJA)

  // Datos del cliente
  const [customerName,    setCustomerName]    = useState('')
  const [customerPhone,   setCustomerPhone]   = useState('')
  const [customerEmail,   setCustomerEmail]   = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [clientNotes,     setClientNotes]     = useState('')

  // Configurador actual
  const [blindType,    setBlindType]    = useState('laminada')
  const [width,        setWidth]        = useState(1000)
  const [height,       setHeight]       = useState(1200)
  const [mechanism,    setMechanism]    = useState('muelle')
  const [motorType,    setMotorType]    = useState('mecanico')
  const [guideType,    setGuideType]    = useState('none')
  const [colorGroup,   setColorGroup]   = useState('Grupo Base')
  const [installacion, setInstallacion] = useState(false)

  // Lista de ítems añadidos al presupuesto
  const [items, setItems] = useState([])

  // Estados de guardado / PDF / email
  const [saving,        setSaving]        = useState(false)
  const [saveFeedback,  setSaveFeedback]  = useState(null)
  const [pdfLoading,    setPdfLoading]    = useState(false)
  const [emailLoading,  setEmailLoading]  = useState(false)
  const [emailFeedback, setEmailFeedback] = useState(null)

  useEffect(() => {
    getProductPrices().then(cfg => {
      setCfgPrices(cfg.prices)
      setMotorPrices(cfg.motorPrices)
      setGuidePricePerMl(cfg.guidePricePerMl)
      setInstalacionPrice(cfg.instalacionPrice)
      setInstalacionFija(cfg.instalacionFija)
    })
  }, [])

  // Ajustes automáticos al cambiar tipo
  useEffect(() => {
    if (ADMIN_MOTOR_ONLY.includes(blindType)) setMechanism('motor')
    if (ADMIN_NO_MOTOR.includes(blindType) && mechanism === 'motor') setMechanism('muelle')
    if (blindType === 'solo_motor') setMechanism('motor')
    if (ADMIN_SISTEMAS.includes(blindType) && guideType === 'none') setGuideType('h25')
    if (blindType === 'mosquitera_enrollable') { setGuideType('none'); setColorGroup('Grupo Base') }
    if (blindType === 'solo_guias' && guideType === 'none') setGuideType('v25')
  }, [blindType]) // eslint-disable-line react-hooks/exhaustive-deps

  const priceBreakdown = calcAdminBudgetPrice({
    prices: cfgPrices, motorPrices, guidePricePerMl, instalacionPrice, instalacionFija,
    blindType, width: Number(width), height: Number(height), mechanism, motorType, guideType, colorGroup, installacion,
  })

  const grandTotal = items.reduce((sum, i) => sum + (i.priceBreakdown?.totalConIva ?? 0), 0)

  function handleAddItem() {
    if (!priceBreakdown) return
    const label = ADMIN_BUDGET_BLIND_TYPES.find(t => t.value === blindType)?.label ?? blindType
    setItems(prev => [...prev, {
      id: Date.now(),
      label,
      blindType, width: Number(width), height: Number(height),
      mechanism, motorType, guideType, colorGroup, installacion,
      priceBreakdown,
    }])
  }

  function buildCustomer() {
    return { name: customerName, phone: customerPhone, email: customerEmail, address: customerAddress }
  }

  async function handleSave() {
    if (items.length === 0) return
    setSaving(true)
    const budgetNumber = `PRE-${Date.now().toString().slice(-8)}`
    const rows = items.map(item => ({
      budget_number:    budgetNumber,
      customer_name:    customerName    || null,
      customer_phone:   customerPhone   || null,
      customer_email:   customerEmail   || null,
      customer_address: customerAddress || null,
      client_notes:     clientNotes     || null,
      blind_type:       item.blindType,
      width:            item.width,
      height:           item.height,
      mechanism:        item.mechanism,
      motor_type:       item.motorType,
      guide_type:       item.guideType,
      installacion:     item.installacion,
      total_with_iva:   item.priceBreakdown?.totalConIva ?? 0,
      budget_status:    'pending',
      user_type:        'public',
      user_id:          null,
    }))
    const { error } = await supabase.from('budgets').insert(rows)
    setSaving(false)
    if (!error) {
      setSaveFeedback('ok')
      setTimeout(() => onSaved(), 1200)
    } else {
      setSaveFeedback('error')
      setTimeout(() => setSaveFeedback(null), 3000)
    }
  }

  async function handleDownloadPDF() {
    if (items.length === 0) return
    setPdfLoading(true)
    try { await generateAdminMultiBudgetPDF(buildCustomer(), items) } catch { }
    setPdfLoading(false)
  }

  async function handleSendEmail() {
    if (items.length === 0 || !customerEmail) return
    setEmailLoading(true)
    setEmailFeedback(null)
    try {
      const pdfBase64 = await generateAdminMultiBudgetPDF(buildCustomer(), items, { returnBase64: true })
      const syntheticConfig = { estimatedPrice: grandTotal, userType: 'public', proDiscount: 0 }
      await sendBudgetResend(buildCustomer(), syntheticConfig, pdfBase64)
      setEmailFeedback('ok')
      setTimeout(() => setEmailFeedback(null), 3000)
    } catch {
      setEmailFeedback('error')
      setTimeout(() => setEmailFeedback(null), 3000)
    }
    setEmailLoading(false)
  }

  const isSoloMotor = blindType === 'solo_motor'
  const isSoloGuias = blindType === 'solo_guias'
  const isSistema   = ADMIN_SISTEMAS.includes(blindType)
  const isPano      = ADMIN_PANO_TYPES.includes(blindType)
  const isMotorOnly = ADMIN_MOTOR_ONLY.includes(blindType)
  const showMotor   = mechanism === 'motor' && !isPano
  const showGuides  = !isSoloMotor && blindType !== 'mosquitera_enrollable'
  const showColorGroup  = !isSoloMotor && !isSoloGuias
  const showDimensions  = !isSoloMotor
  const showMechanism   = !isMotorOnly && !isSoloMotor && !isSoloGuias

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Nuevo presupuesto manual</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* ── Datos del cliente ── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Datos del cliente</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Nombre</label>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nombre completo" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Teléfono</label>
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="600 000 000" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Email</label>
                <input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="cliente@email.com" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Dirección</label>
                <input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Calle, número, ciudad" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs text-gray-500">Comentarios</label>
                <textarea value={clientNotes} onChange={e => setClientNotes(e.target.value)} placeholder="Notas adicionales…" rows={2} className={`${inputCls} resize-none`} />
              </div>
            </div>
          </div>

          {/* ── Configurador de ítem ── */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Añadir persiana al presupuesto</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs text-gray-500">Tipo de persiana</label>
                <select value={blindType} onChange={e => setBlindType(e.target.value)} className={inputCls}>
                  {ADMIN_BUDGET_BLIND_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {showDimensions && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">Ancho (mm)</label>
                    <input type="number" min="200" max="6000" step="10" value={width} onChange={e => setWidth(e.target.value)} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">Alto (mm)</label>
                    <input type="number" min="200" max="6000" step="10" value={height} onChange={e => setHeight(e.target.value)} className={inputCls} />
                  </div>
                </>
              )}

              {showMechanism && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Mecanismo</label>
                  <select value={mechanism} onChange={e => setMechanism(e.target.value)} className={inputCls}>
                    <option value="muelle">Muelle</option>
                    <option value="cinta">Cinta</option>
                    <option value="motor">Motor</option>
                  </select>
                </div>
              )}

              {(showMotor || isSoloMotor || isMotorOnly) && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Tipo de motor</label>
                  <select value={motorType} onChange={e => setMotorType(e.target.value)} className={inputCls}>
                    <option value="mecanico">Mecánico</option>
                    <option value="mando_distancia">Mando a distancia</option>
                  </select>
                </div>
              )}

              {showGuides && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Guías</label>
                  <select value={guideType} onChange={e => setGuideType(e.target.value)} className={inputCls}>
                    {!isSistema && <option value="none">Sin guías</option>}
                    <option value="v25">Guías V25</option>
                    <option value="h25">Guías H25</option>
                  </select>
                </div>
              )}

              {showColorGroup && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Grupo de color</label>
                  <select value={colorGroup} onChange={e => setColorGroup(e.target.value)} className={inputCls} disabled={blindType === 'mosquitera_enrollable'}>
                    {ADMIN_BUDGET_COLOR_GROUPS.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-3 py-2">
                <input type="checkbox" id="adm_inst" checked={installacion} onChange={e => setInstallacion(e.target.checked)}
                  className="w-4 h-4 text-red-700 rounded border-gray-300 focus:ring-red-500" />
                <label htmlFor="adm_inst" className="text-sm text-gray-700 cursor-pointer">Incluir instalación</label>
              </div>
            </div>

            {/* Precio del ítem actual */}
            {cfgPrices && priceBreakdown && (
              <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between">
                <div className="text-xs text-gray-500 space-y-0.5">
                  {priceBreakdown.pricePerSqm !== undefined && (
                    <p>{fmt(priceBreakdown.pricePerSqm)}/m² × {priceBreakdown.billableSqm?.toFixed(2)} m²
                      {priceBreakdown.guidesCost > 0 && ` + guías ${fmt(priceBreakdown.guidesCost)}`}
                      {priceBreakdown.motorCost > 0 && ` + motor ${fmt(priceBreakdown.motorCost)}`}
                      {priceBreakdown.installacionCost > 0 && ` + inst. ${fmt(priceBreakdown.installacionCost)}`}
                    </p>
                  )}
                  <p className="text-gray-400">Subtotal s/IVA {fmt(priceBreakdown.subtotalSinIva)} · IVA {fmt(priceBreakdown.iva)}</p>
                </div>
                <p className="text-base font-bold text-red-700 ml-4 shrink-0">{fmt(priceBreakdown.totalConIva)}</p>
              </div>
            )}
            {!cfgPrices && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                Cargando precios…
              </div>
            )}

            {/* Botón añadir */}
            <button
              onClick={handleAddItem}
              disabled={!cfgPrices || !priceBreakdown}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Añadir al presupuesto
            </button>
          </div>

          {/* ── Lista de ítems ── */}
          {items.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Ítems del presupuesto ({items.length})
              </p>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                    <span className="text-xs font-bold text-gray-400 w-5 shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.label}</p>
                      <p className="text-xs text-gray-400">
                        {item.blindType !== 'solo_motor' && `${item.width} × ${item.height} mm · `}
                        {item.colorGroup}
                        {item.guideType !== 'none' && ` · ${item.guideType.toUpperCase()}`}
                        {item.installacion && ' · con inst.'}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-red-700 shrink-0">{fmt(item.priceBreakdown?.totalConIva ?? 0)}</span>
                    <button
                      onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}
                      className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                <span className="text-sm font-semibold text-gray-700">Total presupuesto</span>
                <span className="text-lg font-bold text-red-700">{fmt(grandTotal)}</span>
              </div>
            </div>
          )}

          {/* ── Acciones finales ── */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            {items.length === 0 && (
              <p className="text-xs text-center text-gray-400">Añade al menos una persiana para poder guardar o descargar el presupuesto.</p>
            )}
            <div className="flex gap-3">
              <button onClick={handleDownloadPDF} disabled={pdfLoading || items.length === 0}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                {pdfLoading ? 'Generando…' : 'Descargar PDF'}
              </button>
              <button onClick={handleSendEmail} disabled={emailLoading || items.length === 0 || !customerEmail}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40
                  ${emailFeedback === 'ok' ? 'bg-green-600 text-white' : emailFeedback === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {emailLoading ? 'Enviando…' : emailFeedback === 'ok' ? '✓ Enviado' : emailFeedback === 'error' ? 'Error' : 'Enviar al cliente'}
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || saveFeedback === 'ok' || items.length === 0}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40
                  ${saveFeedback === 'ok' ? 'bg-green-600 text-white' : saveFeedback === 'error' ? 'bg-red-100 text-red-800' : 'bg-red-700 hover:bg-red-800 text-white'}`}>
                {saving ? 'Guardando…' : saveFeedback === 'ok' ? '✓ Guardado' : saveFeedback === 'error' ? 'Error al guardar' : `Guardar presupuesto${items.length > 1 ? ` (${items.length})` : ''}`}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── SECCIÓN PROFESIONALES (cotizaciones + chat) ───────────────────────────
const PRO_QUOTE_STATUS = {
  pending:  { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700'  },
  accepted: { label: 'Aceptado',   cls: 'bg-green-100 text-green-700'  },
  modified: { label: 'Modificado', cls: 'bg-blue-100 text-blue-700'    },
  rejected: { label: 'Rechazado',  cls: 'bg-red-100 text-red-700'      },
}
const BLIND_LABELS_ADMIN = {
  laminada: 'Paño Laminado', autoblocante: 'Paño Autoblocante', blocking: 'Bloqueante',
  sistema_mini_cajon_pvc: 'Mini Cajón PVC', sistema_mini_cajon_aluminio: 'Mini Cajón Aluminio',
  sistema_mini_autoblocante: 'Mini Autoblocante', solo_motor: 'Solo Motor',
  solo_guias: 'Solo Guías', mosquitera_enrollable: 'Mosquitera',
}

function AdminProQuoteModal({ quote, proData, onClose, onUpdated }) {
  const [status,      setStatus]      = useState(quote.status)
  const [adminPrice,  setAdminPrice]  = useState(quote.admin_total_con_iva ?? quote.total_con_iva ?? 0)
  const [notes,       setNotes]       = useState(quote.admin_notes ?? '')
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [confirmDel,  setConfirmDel]  = useState(false)
  const [downloading, setDownloading] = useState(false)

  const isModified = parseFloat(adminPrice) !== parseFloat(quote.total_con_iva)

  async function handleSave() {
    setSaving(true)
    const updates = {
      status,
      admin_notes:         notes.trim() || null,
      admin_total_con_iva: (status === 'accepted' || status === 'modified') ? parseFloat(adminPrice) : null,
      updated_at:          new Date().toISOString(),
    }
    await supabase.from('pro_purchase_quotes').update(updates).eq('id', quote.id)

    if ((status === 'accepted' || status === 'modified') && isModified) {
      const items    = quote.items ?? []
      const newTotal = parseFloat(adminPrice) / 1.21
      const oldTotal = quote.total_sin_iva || 1
      for (const it of items) {
        if (!it.config_id) continue
        const newPrice = (it.price_professional / oldTotal) * newTotal
        await supabase.from('blind_configurations')
          .update({ estimated_price: newPrice * 1.21, price_professional: newPrice })
          .eq('id', it.config_id)
      }
    }

    if ((status === 'accepted' || status === 'modified') && proData?.email) {
      let pdfBase64 = null
      try {
        const updatedQuote = { ...quote, status, admin_notes: notes.trim() || null, admin_total_con_iva: parseFloat(adminPrice) }
        pdfBase64 = await generateProQuotePDF(updatedQuote, proData, { returnBase64: true })
      } catch {}
      const { sendProQuoteAccepted } = await import('../services/email')
      await sendProQuoteAccepted({
        proEmail:    proData.email,
        proName:     proData.razon_social || proData.email,
        quoteId:     quote.id,
        totalConIva: parseFloat(adminPrice),
        adminNotes:  notes.trim(),
        isModified,
        pdfBase64,
      })
    }

    setSaving(false)
    onUpdated()
    onClose()
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      const updatedQuote = { ...quote, status, admin_notes: notes.trim() || null, admin_total_con_iva: parseFloat(adminPrice) }
      const doc = await generateProQuotePDF(updatedQuote, proData)
      doc?.save(`Cotizacion_${(quote.id ?? '').slice(0, 8).toUpperCase()}.pdf`)
    } catch {}
    setDownloading(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('pro_purchase_quotes').delete().eq('id', quote.id)
    setDeleting(false)
    onUpdated()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-mono">{quote.id?.slice(0,8).toUpperCase()}</p>
            <h3 className="font-bold text-gray-900 mt-0.5">{proData?.razon_social ?? proData?.email ?? 'Profesional'}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Persianas solicitadas</p>
            <div className="space-y-2">
              {(quote.items ?? []).map((it, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-gray-800">{BLIND_LABELS_ADMIN[it.blind_type] ?? it.blind_type}</p>
                    <p className="text-xs text-gray-400">
                      {it.width && it.height ? `${it.width}×${it.height} mm` : ''}
                      {it.mechanism ? ` · ${it.mechanism}` : ''}
                      {it.guide_type && it.guide_type !== 'none' ? ` · guía ${it.guide_type}` : ''}
                      {it.slat_color_name ? ` · ${it.slat_color_name}` : ''}
                    </p>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="text-xs text-gray-400">Público: {fmt(it.price_public * 1.21)}</p>
                    <p className="font-bold text-red-700">{fmt(it.price_professional * 1.21)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-4 text-sm pt-3 border-t border-gray-100 mt-2">
              <div className="text-right">
                <p className="text-xs text-gray-400">Dto. {quote.discount_pct}% aplicado</p>
                <p className="font-black text-gray-900">Total original: {fmt(quote.total_con_iva)}</p>
              </div>
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Estado</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PRO_QUOTE_STATUS).map(([k, { label, cls }]) => (
                <button key={k} type="button" onClick={() => setStatus(k)}
                  className={`py-2 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    status === k ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Precio modificado */}
          {(status === 'accepted' || status === 'modified') && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Total con IVA para el profesional (€)
                {isModified && <span className="ml-2 text-blue-600 normal-case font-normal">precio modificado</span>}
              </label>
              <div className="relative">
                <input type="number" min="0" step="0.01" value={adminPrice}
                  onChange={e => setAdminPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-8 rounded-xl border border-gray-300 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Sin IVA: {fmt(parseFloat(adminPrice || 0) / 1.21)}</p>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notas para el profesional</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Se ha ajustado el precio por volumen de compra…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 resize-none" />
          </div>

          {/* Acciones secundarias */}
          <div className="flex items-center justify-between pt-1">
            <button onClick={handleDownload} disabled={downloading}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors">
              {downloading
                ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              }
              Descargar PDF
            </button>
            {confirmDel ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">¿Eliminar?</span>
                <button onClick={handleDelete} disabled={deleting}
                  className="text-xs font-bold text-red-600 hover:text-red-800 disabled:opacity-50">
                  {deleting ? '…' : 'Sí'}
                </button>
                <button onClick={() => setConfirmDel(false)} className="text-xs text-gray-500 hover:text-gray-700">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(true)}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Eliminar
              </button>
            )}
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-sm font-bold disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
              {saving ? 'Guardando…' : 'Guardar y notificar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminChatConversation({ proUserId, proName, adminUserId, onBack }) {
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(true)
  const [sending,  setSending]  = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    loadMessages()
    const channel = supabase
      .channel(`admin-chat-${proUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pro_messages',
        filter: `professional_user_id=eq.${proUserId}` },
        (payload) => setMessages(prev => [...prev, payload.new])
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [proUserId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadMessages() {
    const { data } = await supabase.from('pro_messages').select('*')
      .eq('professional_user_id', proUserId).order('created_at', { ascending: true })
    setMessages(data ?? [])
    setLoading(false)
    await supabase.from('pro_messages').update({ read_by_admin: true })
      .eq('professional_user_id', proUserId).eq('sender_role', 'professional')
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || sending) return
    setSending(true)
    const text = input.trim()
    setInput('')
    await supabase.from('pro_messages').insert({
      professional_user_id: proUserId,
      sender_id:            adminUserId,
      sender_role:          'admin',
      message:              text,
      read_by_professional: false,
      read_by_admin:        true,
    })
    setSending(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 flex flex-col" style={{ height: '65vh' }}>
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="font-bold text-gray-900 text-sm">{proName}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">Sin mensajes todavía.</div>
        ) : messages.map(m => {
          const isAdmin = m.sender_role === 'admin'
          return (
            <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                isAdmin ? 'bg-red-700 text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'
              }`}>
                <p className="leading-relaxed">{m.message}</p>
                <p className={`text-xs mt-1 ${isAdmin ? 'text-red-200' : 'text-gray-400'}`}>
                  {new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="px-4 py-3 border-t border-gray-100 flex items-center gap-3">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Escribe un mensaje…"
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400" />
        <button type="submit" disabled={!input.trim() || sending}
          className="w-10 h-10 bg-red-700 hover:bg-red-800 text-white rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  )
}

function AdminProfesionalesSection({ adminUser }) {
  const [quotes,      setQuotes]      = useState([])
  const [proData,     setProData]     = useState({}) // userId → {razon_social, email}
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState(null)
  const [statusFilter,setStatusFilter]= useState('all')
  const [chatPro,     setChatPro]     = useState(null) // { userId, name }
  const [unreadMap,   setUnreadMap]   = useState({})   // userId → count

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data: qs } = await supabase.from('pro_purchase_quotes').select('*').order('created_at', { ascending: false })
    const quotes = qs ?? []
    setQuotes(quotes)

    // Cargar datos de los profesionales
    const userIds = [...new Set(quotes.map(q => q.user_id).filter(Boolean))]
    if (userIds.length > 0) {
      const { data: pds } = await supabase.from('professional_data').select('user_id,razon_social').in('user_id', userIds)
      const { data: prs } = await supabase.from('profiles').select('id,email').in('id', userIds)
      const map = {}
      userIds.forEach(id => {
        const pd = pds?.find(p => p.user_id === id)
        const pr = prs?.find(p => p.id === id)
        map[id] = { razon_social: pd?.razon_social ?? null, email: pr?.email ?? id.slice(0, 8) }
      })
      setProData(map)

      // Contar mensajes no leídos por profesional
      const unread = {}
      await Promise.all(userIds.map(async id => {
        const { count } = await supabase.from('pro_messages')
          .select('id', { count: 'exact', head: true })
          .eq('professional_user_id', id)
          .eq('sender_role', 'professional')
          .eq('read_by_admin', false)
        unread[id] = count ?? 0
      }))
      setUnreadMap(unread)
    }
    setLoading(false)
  }

  function getProName(userId) {
    const d = proData[userId]
    return d?.razon_social ?? d?.email ?? userId.slice(0, 8).toUpperCase()
  }

  const filtered = quotes.filter(q => statusFilter === 'all' || q.status === statusFilter)

  // Profesionales únicos con al menos un mensaje
  const proIds = [...new Set(quotes.map(q => q.user_id).filter(Boolean))]

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900">Profesionales</h2>

      {/* ── Cotizaciones de compra ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-semibold text-gray-700">Cotizaciones de compra</p>
          <div className="flex items-center gap-2">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400">
              <option value="all">Todos</option>
              {Object.entries(PRO_QUOTE_STATUS).map(([k, { label }]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <button onClick={loadAll} className="text-xs text-red-600 hover:underline">Actualizar</button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-400">
            No hay cotizaciones {statusFilter !== 'all' ? 'con este estado' : 'todavía'}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Profesional', 'Persianas', 'Descuento', 'Total', 'Estado', 'Fecha', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(q => {
                    const st    = PRO_QUOTE_STATUS[q.status] ?? PRO_QUOTE_STATUS.pending
                    const total = q.admin_total_con_iva ?? q.total_con_iva ?? 0
                    const name  = getProName(q.user_id)
                    return (
                      <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{name}</td>
                        <td className="px-4 py-3 text-gray-500">{(q.items ?? []).length}</td>
                        <td className="px-4 py-3 text-gray-500">−{q.discount_pct}%</td>
                        <td className="px-4 py-3 font-bold text-red-700">{fmt(total)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(q.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setSelected({ quote: q, proInfo: proData[q.user_id] })}
                            className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                            Gestionar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Chat con profesionales ── */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">Mensajes</p>
        {chatPro ? (
          <AdminChatConversation
            proUserId={chatPro.userId}
            proName={chatPro.name}
            adminUserId={adminUser?.id}
            onBack={() => { setChatPro(null); loadAll() }}
          />
        ) : proIds.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            Sin conversaciones todavía
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {proIds.map(id => {
              const name   = getProName(id)
              const unread = unreadMap[id] ?? 0
              return (
                <button key={id} onClick={() => setChatPro({ userId: id, name })}
                  className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-gray-600">
                      {name[0]?.toUpperCase() ?? 'P'}
                    </div>
                    <p className="font-semibold text-gray-800 text-sm">{name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {unread > 0 && (
                      <span className="w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">{unread}</span>
                    )}
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal gestión cotización */}
      {selected && (
        <AdminProQuoteModal
          quote={selected.quote}
          proData={selected.proInfo ?? {}}
          onClose={() => setSelected(null)}
          onUpdated={() => { setSelected(null); loadAll() }}
        />
      )}
    </div>
  )
}

function AdminBudgetsSection() {
  const [budgets,  setBudgets]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showNewModal, setShowNewModal] = useState(false)

  useEffect(() => { loadBudgets() }, [])

  async function loadBudgets() {
    setLoading(true)
    const { data } = await supabase
      .from('budgets')
      .select('*')
      .order('created_at', { ascending: false })
    setBudgets(data ?? [])
    setLoading(false)
  }

  const filtered = budgets.filter(b => {
    const matchSearch = !search ||
      b.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.customer_email?.toLowerCase().includes(search.toLowerCase()) ||
      b.budget_number?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || (b.budget_status ?? 'pending') === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-gray-900">Presupuestos</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo presupuesto
          </button>
          {filtered.length > 0 && (
            <button onClick={() => {
              const headers = ['Número', 'Cliente', 'Email', 'Tipo', 'Precio', 'Estado', 'Fecha']
              const rows = filtered.map(b => [
                b.budget_number ?? b.id?.slice(0,8).toUpperCase(),
                b.customer_name ?? '',
                b.customer_email ?? '',
                BUDGET_TYPE_LABELS[b.blind_type] ?? b.blind_type ?? '',
                ((b.admin_price != null ? b.admin_price : b.total_with_iva) ?? 0).toFixed(2).replace('.', ','),
                BUDGET_STATUS_MAP[b.budget_status ?? 'pending']?.label ?? '',
                b.created_at ? new Date(b.created_at).toLocaleDateString('es-ES') : '',
              ])
              const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(';')).join('\n')
              const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a'); a.href = url
              a.download = `presupuestos_${new Date().toISOString().slice(0,10)}.csv`; a.click()
              URL.revokeObjectURL(url)
            }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exportar CSV
            </button>
          )}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 bg-white"
          >
            <option value="all">Todos</option>
            {Object.entries(BUDGET_STATUS_MAP).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Buscar cliente o número…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 w-full sm:w-56"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No hay presupuestos</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Número', 'Cliente', 'Tipo', 'Precio', 'Estado', 'Comentarios', 'Fecha', ''].map(h => (
                    <th key={h} className="px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(b => {
                  const st = BUDGET_STATUS_MAP[b.budget_status ?? 'pending'] ?? BUDGET_STATUS_MAP.pending
                  const effectivePrice = b.admin_price != null ? b.admin_price : b.total_with_iva
                  return (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-2 py-2 sm:px-4 sm:py-3 font-mono text-xs text-gray-500">{b.budget_number ?? `#${b.id?.slice(0,8).toUpperCase()}`}</td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3">
                        <p className="font-medium text-gray-900">{b.customer_name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{b.customer_email ?? ''}</p>
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3 text-gray-600 text-xs">{BUDGET_TYPE_LABELS[b.blind_type] ?? b.blind_type ?? '—'}</td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3 font-bold text-red-700">
                        {fmt(effectivePrice)}
                        {b.admin_price != null && <span className="ml-1 text-xs font-normal text-blue-600">(ajust.)</span>}
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3 max-w-[120px] sm:max-w-[180px]">
                        {b.client_notes
                          ? <p className="text-xs text-gray-500 truncate" title={b.client_notes}>{b.client_notes}</p>
                          : <span className="text-xs text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3 text-xs text-gray-400">{fmtDate(b.created_at)}</td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3 text-right">
                        <button
                          onClick={() => setSelected(b)}
                          className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          Gestionar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <BudgetModal
          budget={selected}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); loadBudgets() }}
        />
      )}

      {showNewModal && (
        <AdminNewBudgetModal
          onClose={() => setShowNewModal(false)}
          onSaved={() => { setShowNewModal(false); loadBudgets() }}
        />
      )}
    </div>
  )
}

// ── SECCIÓN FACTURAS ADMIN ────────────────────────────────────────────────
function SendInvoiceRowButton({ inv }) {
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [err,     setErr]     = useState(false)

  const clientEmail = inv.orders?.profiles?.email

  async function handleSend() {
    if (!clientEmail) return
    setSending(true); setErr(false)
    try {
      const empresa   = await fetchEmpresa(inv)
      const pdfBase64 = await generateInvoicePDF(inv, inv.orders ?? {}, empresa, { returnBase64: true })
      await sendInvoiceEmail({
        userEmail: clientEmail,
        invoice:   inv,
        orderId:   inv.order_id,
        items:     inv.orders?.items ?? [],
        pdfBase64,
      })
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    } catch {
      setErr(true)
      setTimeout(() => setErr(false), 3000)
    } finally {
      setSending(false)
    }
  }

  if (!clientEmail) return <span className="text-xs text-gray-300">Sin email</span>

  return (
    <button
      onClick={handleSend}
      disabled={sending || sent}
      className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors ${
        sent ? 'text-green-600' : err ? 'text-red-500' : 'text-blue-600 hover:text-blue-800'
      }`}
    >
      {sending ? (
        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : sent ? '✓ Enviada' : err ? 'Error' : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Enviar
        </>
      )}
    </button>
  )
}

function AdminInvoicesSection() {
  const [invoices,        setInvoices]        = useState([])
  const [loading,         setLoading]         = useState(true)
  const [invDateFrom,     setInvDateFrom]     = useState('')
  const [invDateTo,       setInvDateTo]       = useState('')
  const [editDiscount,    setEditDiscount]    = useState({}) // id → string value
  const [savingDiscount,  setSavingDiscount]  = useState({}) // id → bool
  const [savedDiscount,   setSavedDiscount]   = useState({}) // id → bool

  useEffect(() => { loadInvoices() }, [])

  async function loadInvoices() {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('*, orders(user_id, items, address, phone, profiles(email))')
      .order('created_at', { ascending: false })
    setInvoices(data ?? [])
    setLoading(false)
  }

  async function handleDiscountSave(inv) {
    const raw = editDiscount[inv.id]
    const discount = raw !== undefined ? parseFloat(raw) : (inv.pro_discount ?? 0)
    if (isNaN(discount) || discount < 0 || discount > 100) return
    setSavingDiscount(prev => ({ ...prev, [inv.id]: true }))

    // total_without_iva is already post-discount; recover pre-discount base
    const prevDiscount = inv.pro_discount ?? 0
    const originalBase = prevDiscount < 100
      ? (inv.total_without_iva ?? 0) / (1 - prevDiscount / 100)
      : inv.total_without_iva ?? 0
    const newBase = originalBase * (1 - discount / 100)
    const newIva  = newBase * 0.21
    const newTotal = newBase + newIva

    const { error } = await supabase.from('invoices').update({
      pro_discount:      discount,
      total_without_iva: Math.round(newBase  * 100) / 100,
      iva:               Math.round(newIva   * 100) / 100,
      total_with_iva:    Math.round(newTotal * 100) / 100,
    }).eq('id', inv.id)

    setSavingDiscount(prev => ({ ...prev, [inv.id]: false }))
    if (!error) {
      setInvoices(prev => prev.map(i => i.id === inv.id
        ? { ...i, pro_discount: discount, total_without_iva: Math.round(newBase * 100) / 100, iva: Math.round(newIva * 100) / 100, total_with_iva: Math.round(newTotal * 100) / 100 }
        : i
      ))
      setSavedDiscount(prev => ({ ...prev, [inv.id]: true }))
      setTimeout(() => setSavedDiscount(prev => ({ ...prev, [inv.id]: false })), 2000)
    }
  }

  const filteredInvoices = invoices.filter(inv => {
    const d = inv.created_at ? inv.created_at.slice(0, 10) : ''
    return (!invDateFrom || d >= invDateFrom) && (!invDateTo || d <= invDateTo)
  })

  async function handlePaymentStatus(invoiceId, newStatus) {
    await supabase.from('invoices').update({ payment_status: newStatus }).eq('id', invoiceId)
    setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, payment_status: newStatus } : i))
  }

  async function fetchEmpresa(inv) {
    const userId = inv.orders?.user_id ?? inv.user_id
    if (!userId) return null
    const { data } = await supabase.from('professional_data').select('*').eq('user_id', userId).maybeSingle()
    return data ?? null
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
        <div className="flex flex-wrap items-end gap-2">
          {invoices.length > 0 && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Desde</label>
                <input type="date" value={invDateFrom} onChange={e => setInvDateFrom(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Hasta</label>
                <input type="date" value={invDateTo} onChange={e => setInvDateTo(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white" />
              </div>
              {(invDateFrom || invDateTo) && (
                <button onClick={() => { setInvDateFrom(''); setInvDateTo('') }}
                  className="text-xs text-gray-400 hover:text-red-600 transition-colors pb-1" title="Limpiar fechas">
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
                  {['Nº Factura', 'Fecha', 'Total', 'Descuento', 'Estado pago', 'Cambiar estado', 'PDF', 'Email'].map(h => (
                    <th key={h} className="text-left px-2 py-2 sm:px-4 sm:py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-2 py-2 sm:px-4 sm:py-3 font-mono text-xs text-gray-600">{inv.invoice_number}</td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 text-gray-500 whitespace-nowrap">{fmtDate(inv.created_at)}</td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 font-bold text-gray-900">{fmt(inv.total_with_iva)}</td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3">
                      <div className="flex items-center gap-1">
                        <div className="relative">
                          <input
                            type="number" min="0" max="100" step="1"
                            value={editDiscount[inv.id] !== undefined ? editDiscount[inv.id] : (inv.pro_discount ?? 0)}
                            onChange={e => setEditDiscount(prev => ({ ...prev, [inv.id]: e.target.value }))}
                            className="w-14 px-2 py-1 pr-4 rounded-lg border border-gray-300 text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-red-200"
                          />
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                        </div>
                        <button
                          onClick={() => handleDiscountSave(inv)}
                          disabled={savingDiscount[inv.id]}
                          className={`px-2 py-1 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 ${savedDiscount[inv.id] ? 'bg-green-600 text-white' : 'bg-red-700 hover:bg-red-800 text-white'}`}>
                          {savingDiscount[inv.id] ? '…' : savedDiscount[inv.id] ? '✓' : 'OK'}
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        inv.payment_status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {inv.payment_status === 'paid' ? 'Pagada' : 'Pendiente de pago'}
                      </span>
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3">
                      <div className="flex flex-wrap gap-1">
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
                    <td className="px-2 py-2 sm:px-4 sm:py-3">
                      <button
                        onClick={async () => { const empresa = await fetchEmpresa(inv); generateInvoicePDF(inv, inv.orders ?? {}, empresa) }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        PDF
                      </button>
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3">
                      <SendInvoiceRowButton inv={inv} />
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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

      {/* Web analytics GA4 */}
      <GAWebAnalytics />
    </div>
  )
}

function GAWebAnalytics() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => { fetchGA() }, [])

  async function fetchGA() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics')
      if (!res.ok) throw new Error(`Error ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const fmtSec = (s) => {
    const m = Math.floor(s / 60), sec = Math.round(s % 60)
    return `${m}:${String(sec).padStart(2, '0')} min`
  }

  const channelLabel = (c) => ({
    'Organic Search': 'Búsqueda orgánica', 'Direct': 'Directo',
    'Referral': 'Referencia', 'Organic Social': 'Redes sociales',
    'Email': 'Email', 'Paid Search': 'Búsqueda de pago',
    'Unassigned': 'Sin asignar',
  })[c] ?? c

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Tráfico web <span className="text-xs font-normal text-gray-400 ml-1">(últimos 30 días)</span></h2>
        <button onClick={fetchGA} className="text-xs text-red-600 hover:underline">Actualizar</button>
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          No se pudieron cargar los datos de Analytics: {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* KPIs web */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Usuarios activos',   value: data.overview.activeUsers.toLocaleString('es-ES'),      color: 'text-blue-700',   bg: 'bg-blue-50'   },
              { label: 'Sesiones',           value: data.overview.sessions.toLocaleString('es-ES'),         color: 'text-purple-700', bg: 'bg-purple-50' },
              { label: 'Páginas vistas',     value: data.overview.pageViews.toLocaleString('es-ES'),        color: 'text-green-700',  bg: 'bg-green-50'  },
              { label: 'Duración media',     value: fmtSec(data.overview.avgSessionDuration),              color: 'text-amber-700',  bg: 'bg-amber-50'  },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`rounded-xl border border-gray-200 p-4 ${bg}`}>
                <p className={`text-2xl font-black ${color}`}>{value}</p>
                <p className="text-xs font-semibold text-gray-600 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Fuentes de tráfico */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-bold text-gray-700 mb-3">Fuentes de tráfico</p>
              <div className="space-y-2">
                {data.sources.slice(0, 6).map(({ channel, sessions }) => {
                  const total = data.sources.reduce((a, s) => a + s.sessions, 0)
                  const pct   = total > 0 ? Math.round((sessions / total) * 100) : 0
                  return (
                    <div key={channel}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700">{channelLabel(channel)}</span>
                        <span className="text-gray-500">{sessions.toLocaleString('es-ES')} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top páginas */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-bold text-gray-700 mb-3">Páginas más visitadas</p>
              <div className="space-y-1.5">
                {data.topPages.slice(0, 8).map(({ path, views }) => (
                  <div key={path} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-gray-600 truncate font-mono">{path}</span>
                    <span className="font-bold text-gray-800 flex-shrink-0">{views.toLocaleString('es-ES')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dispositivos */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-bold text-gray-700 mb-3">Dispositivos</p>
            <div className="flex gap-4 flex-wrap">
              {data.devices.map(({ device, sessions }) => {
                const total = data.devices.reduce((a, d) => a + d.sessions, 0)
                const pct   = total > 0 ? Math.round((sessions / total) * 100) : 0
                const label = { mobile: 'Móvil', desktop: 'Escritorio', tablet: 'Tablet' }[device] ?? device
                return (
                  <div key={device} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
                    <span className="text-sm font-semibold text-gray-700">{label}</span>
                    <span className="text-xs text-gray-400">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SECCIÓN CLIENTES ADMIN (particulares + profesionales unificados) ──────
function AdminClientsSection() {
  const [clients,   setClients]   = useState([])
  const [proData,   setProData]   = useState({}) // user_id → professional_data
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [typeFilter,setTypeFilter]= useState('all')
  const [expanded,  setExpanded]  = useState(null)
  const [deleting,  setDeleting]  = useState(null)
  const [confirm,   setConfirm]   = useState(null)
  const [deleteErr, setDeleteErr] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: users, error }, { data: pros }] = await Promise.all([
      supabase.rpc('admin_get_all_users'),
      supabase.from('professional_data').select('*, profiles(email)').order('created_at', { ascending: false }),
    ])
    if (error) console.error('Error cargando usuarios:', error)
    setClients(users ?? [])
    const map = {}
    ;(pros ?? []).forEach(p => { map[p.user_id] = p })
    setProData(map)
    setLoading(false)
  }

  async function handleDelete(userId) {
    setDeleting(userId)
    setDeleteErr('')
    const { error } = await supabase.rpc('admin_delete_user', { target_user_id: userId })
    if (error) { setDeleteErr(error.message) }
    else { setClients(prev => prev.filter(c => c.id !== userId)); setConfirm(null) }
    setDeleting(null)
  }

  function exportCSV() {
    const headers = ['Email', 'Tipo', 'Registro', 'Razón social', 'CIF/NIF', 'Teléfono', 'Ciudad', 'Email facturación', 'Descuento %']
    const rows = filtered.map(c => {
      const p = proData[c.id] ?? {}
      return [
        c.email ?? '',
        c.user_type === 'professional' ? 'Profesional' : c.user_type === 'admin' ? 'Admin' : 'Particular',
        c.created_at ? new Date(c.created_at).toLocaleDateString('es-ES') : '',
        p.razon_social ?? '',
        p.cif_nif ?? '',
        p.telefono ?? '',
        p.ciudad ?? '',
        p.email_facturacion ?? '',
        p.discount_percent ?? '',
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `clientes_${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = clients.filter(c => {
    const matchSearch = !search ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      (proData[c.id]?.razon_social ?? '').toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || c.user_type === typeFilter
    return matchSearch && matchType
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-gray-900">Clientes</h2>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {filtered.length > 0 && (
            <button onClick={exportCSV}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exportar CSV
            </button>
          )}
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 bg-white">
            <option value="all">Todos</option>
            <option value="user">Particulares</option>
            <option value="professional">Profesionales</option>
          </select>
          <input type="text" placeholder="Buscar por email o empresa…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 w-full sm:w-56" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No hay clientes registrados</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(c => {
              const p   = proData[c.id]
              const isPro = c.user_type === 'professional'
              const isExpanded = expanded === c.id
              return (
                <div key={c.id}>
                  {/* Fila principal */}
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <button onClick={() => setExpanded(isExpanded ? null : c.id)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                        isPro ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {(c.email?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.email ?? '—'}</p>
                        {isPro && p?.razon_social && (
                          <p className="text-xs text-gray-400 truncate">{p.razon_social}</p>
                        )}
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        isPro ? 'bg-blue-100 text-blue-700' :
                        c.user_type === 'admin' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {c.user_type === 'admin' ? 'Admin' : isPro ? 'Profesional' : 'Particular'}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:inline">{fmtDate(c.created_at)}</span>
                      {(isPro || c.user_type === 'user') && (
                        <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                    {c.user_type !== 'admin' && (
                      confirm === c.id ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id}
                            className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg disabled:opacity-60">
                            {deleting === c.id ? '…' : 'Confirmar'}
                          </button>
                          <button onClick={() => setConfirm(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirm(c.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )
                    )}
                  </div>

                  {/* Detalle expandido */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100">
                      {isPro && p ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 sm:gap-x-6 gap-y-2 text-sm">
                          {p.cif_nif       && <div><span className="text-xs text-gray-400 block">CIF/NIF</span><span className="font-mono font-semibold">{p.cif_nif}</span></div>}
                          {p.telefono      && <div><span className="text-xs text-gray-400 block">Teléfono</span>{p.telefono}</div>}
                          {p.ciudad        && <div><span className="text-xs text-gray-400 block">Ciudad</span>{p.ciudad}</div>}
                          {p.direccion_fiscal && <div className="sm:col-span-2"><span className="text-xs text-gray-400 block">Dirección fiscal</span>{p.direccion_fiscal}</div>}
                          {p.email_facturacion && <div><span className="text-xs text-gray-400 block">Email facturación</span>{p.email_facturacion}</div>}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">Registro: {fmtDate(c.created_at)}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {deleteErr && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">Error al eliminar: {deleteErr}</div>
      )}
      <p className="text-xs text-gray-400">{filtered.length} usuario{filtered.length !== 1 ? 's' : ''} · Los admins no se pueden eliminar</p>
    </div>
  )
}

// ── SECCIÓN CONFIGURACIÓN ADMIN ───────────────────────────────────────────
const PRODUCT_LABELS = {
  laminada:                    'Paño Laminado',
  autoblocante:                'Paño Autoblocante',
  blocking:                    'Bloqueante',
  sistema_mini_cajon_pvc:      'Sistema Mini Cajón PVC',
  sistema_mini_cajon_aluminio: 'Sistema Mini Cajón Aluminio',
  sistema_mini_autoblocante:   'Sistema Mini Autoblocante',
  mosquitera_enrollable:       'Mosquitera Enrollable',
}
const ALL_GROUPS = ['Grupo Base', 'Grupo 1', 'Grupo 2', 'Grupo 3']

function AdminConfigSection() {
  const [discount,      setDiscount]      = useState('')
  const [savingDisc,    setSavingDisc]    = useState(false)
  const [savedDisc,     setSavedDisc]     = useState(false)
  const [discError,     setDiscError]     = useState('')

  const [prices,        setPrices]        = useState(null) // null = cargando
  const [motorPrices,   setMotorPrices]   = useState(DEFAULT_MOTOR_PRICES)
  const [guidePrices,   setGuidePrices]   = useState(DEFAULT_GUIDE_PRICE_PER_ML)
  const [instPrice,     setInstPrice]     = useState(DEFAULT_INSTALACION_PRICE)
  const [instFija,      setInstFija]      = useState(DEFAULT_INSTALACION_FIJA)
  const [savingPrices,  setSavingPrices]  = useState(false)
  const [savedPrices,   setSavedPrices]   = useState(false)
  const [priceError,    setPriceError]    = useState('')

  useEffect(() => {
    getProfessionalDiscount().then(v => setDiscount(String(v)))
    getProductPrices().then(cfg => {
      setPrices(cfg.prices)
      setMotorPrices(cfg.motorPrices)
      setGuidePrices(cfg.guidePricePerMl)
      setInstPrice(cfg.instalacionPrice)
      setInstFija(cfg.instalacionFija)
    })
  }, [])

  async function handleSaveDiscount() {
    const n = parseFloat(discount)
    if (isNaN(n) || n < 0 || n > 100) { setDiscError('Introduce un valor entre 0 y 100'); return }
    setDiscError('')
    setSavingDisc(true)
    const ok = await setProfessionalDiscount(n)
    setSavingDisc(false)
    if (ok) { setSavedDisc(true); setTimeout(() => setSavedDisc(false), 2500) }
    else setDiscError('Error al guardar.')
  }

  function updatePrice(type, group, val) {
    setPrices(prev => ({ ...prev, [type]: { ...prev[type], [group]: val } }))
    setSavedPrices(false)
  }

  async function handleSavePrices() {
    setPriceError('')
    setSavingPrices(true)
    const parsedPrices = {}
    for (const [type, groups] of Object.entries(prices)) {
      parsedPrices[type] = {}
      for (const [g, v] of Object.entries(groups)) {
        const n = parseFloat(v)
        if (isNaN(n) || n < 0) { setPriceError('Hay valores no válidos en la tabla'); setSavingPrices(false); return }
        parsedPrices[type][g] = n
      }
    }
    const ok = await setProductPrices({
      prices:           parsedPrices,
      motorPrices:      { mecanico: parseFloat(motorPrices.mecanico), mando_distancia: parseFloat(motorPrices.mando_distancia) },
      guidePricePerMl:  { v25: parseFloat(guidePrices.v25), h25: parseFloat(guidePrices.h25) },
      instalacionPrice: parseFloat(instPrice),
      instalacionFija:  parseFloat(instFija),
    })
    setSavingPrices(false)
    if (ok) { setSavedPrices(true); setTimeout(() => setSavedPrices(false), 2500) }
    else setPriceError('Error al guardar.')
  }

  const inputCls = 'w-24 px-2 py-1.5 rounded-lg border border-gray-300 text-sm text-right focus:outline-none focus:ring-1 focus:ring-red-200 focus:border-red-400'

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-lg font-bold text-gray-900">Configuración</h2>

      {/* Descuento profesional */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Descuento para profesionales</h3>
          <p className="text-xs text-gray-400">Se aplica a todos los profesionales. Se puede sobrescribir por factura.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input type="number" min="0" max="100" step="1" value={discount}
              onChange={e => { setDiscount(e.target.value); setSavedDisc(false); setDiscError('') }}
              className="w-24 px-3 py-2 pr-7 rounded-xl border border-gray-300 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
          </div>
          <button onClick={handleSaveDiscount} disabled={savingDisc}
            className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors disabled:opacity-50 ${savedDisc ? 'bg-green-600 text-white' : 'bg-red-700 hover:bg-red-800 text-white'}`}>
            {savingDisc ? 'Guardando…' : savedDisc ? '✓ Guardado' : 'Guardar'}
          </button>
        </div>
        {discError && <p className="text-xs text-red-600">{discError}</p>}
      </div>

      {/* Tabla de precios */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Precios por m² (sin IVA)</h3>
          <p className="text-xs text-gray-400">Precio base por m² según tipo de persiana y grupo de color. Los valores actuales se muestran como referencia.</p>
        </div>

        {prices === null ? (
          <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
            <div className="w-4 h-4 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
            Cargando precios…
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(prices).map(([type, groups]) => {
              const availableGroups = ALL_GROUPS.filter(g => g in groups)
              return (
                <div key={type}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{PRODUCT_LABELS[type] ?? type}</p>
                  <div className="flex flex-wrap gap-3">
                    {availableGroups.map(g => (
                      <div key={g} className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400">{g}</label>
                        <div className="relative">
                          <input type="number" min="0" step="0.01" value={groups[g]}
                            onChange={e => updatePrice(type, g, e.target.value)}
                            className={inputCls}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Motor, guías, instalación */}
            <div className="border-t border-gray-100 pt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Motor</p>
                <div className="space-y-2">
                  {[['mecanico', 'Mecánico'], ['mando_distancia', 'Mando a distancia']].map(([k, label]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <label className="text-xs text-gray-400">{label}</label>
                      <div className="relative">
                        <input type="number" min="0" step="1" value={motorPrices[k]}
                          onChange={e => { setMotorPrices(p => ({ ...p, [k]: e.target.value })); setSavedPrices(false) }}
                          className={inputCls}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Guías (€/ml)</p>
                <div className="space-y-2">
                  {[['v25', 'V25'], ['h25', 'H25']].map(([k, label]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <label className="text-xs text-gray-400">{label}</label>
                      <div className="relative">
                        <input type="number" min="0" step="0.5" value={guidePrices[k]}
                          onChange={e => { setGuidePrices(p => ({ ...p, [k]: e.target.value })); setSavedPrices(false) }}
                          className={inputCls}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Instalación</p>
                <div className="space-y-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400">€/m² (paños y sistemas)</label>
                    <div className="relative">
                      <input type="number" min="0" step="1" value={instPrice}
                        onChange={e => { setInstPrice(e.target.value); setSavedPrices(false) }}
                        className={inputCls}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400">Precio fijo (motor/guías)</label>
                    <div className="relative">
                      <input type="number" min="0" step="1" value={instFija}
                        onChange={e => { setInstFija(e.target.value); setSavedPrices(false) }}
                        className={inputCls}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSavePrices} disabled={savingPrices || prices === null}
            className={`px-5 py-2 text-sm font-bold rounded-xl transition-colors disabled:opacity-50 ${savedPrices ? 'bg-green-600 text-white' : 'bg-red-700 hover:bg-red-800 text-white'}`}>
            {savingPrices ? 'Guardando…' : savedPrices ? '✓ Guardado' : 'Guardar precios'}
          </button>
          {priceError && <p className="text-xs text-red-600">{priceError}</p>}
        </div>
      </div>
    </div>
  )
}