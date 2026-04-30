import { useState, useEffect } from 'react'
import { supabase } from '../../../services/supabase/client'
import { generateInvoicePDF } from '../../../services/invoicePDF'
import { notifyStatusChange, confirmAppointment, sendInvoiceEmail } from '../../../services/email'
import { fmt, fmtDate, STATUS_MAP, buildCalendarUrl } from '../constants'

const HORAS = ['08:00','09:00','10:00','11:00','12:00','13:00','16:00','17:00','18:00','19:00']

const BLIND_TYPE_LABELS = {
  laminada:'Paño laminado', autoblocante:'Paño autoblocante', blocking:'Bloqueante',
  sistema_mini_cajon_pvc:'Sistema Mini Cajón PVC', sistema_mini_cajon_aluminio:'Sistema Mini Cajón Aluminio',
  sistema_mini_autoblocante:'Sistema Mini Autoblocante', solo_guias:'Solo guías', solo_motor:'Solo motor',
  mosquitera_enrollable:'Mosquitera Enrollable', sistema_mini_pvc:'Sistema Mini PVC',
  sistema_mini_aluminio:'Sistema Mini Aluminio', motor_mas_guias:'Motor + Guías',
  pano_mas_guias:'Paño + Guías', normal:'Estándar',
}

export default function OrderModal({ order, onClose, onUpdate }) {
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
  const [proformaTotal,     setProformaTotal]     = useState('')
  const [savingProforma,    setSavingProforma]    = useState(false)
  const [ivaPct,            setIvaPct]            = useState(21)

  useEffect(() => { loadInvoice() }, [])

  async function loadInvoice() {
    const { data } = await supabase.from('invoices').select('*').eq('order_id', order.id).maybeSingle()
    setExistingInvoice(data ?? null)
    if (data) setProformaTotal(String(data.total_with_iva ?? ''))
  }

  async function createInvoiceRecord() {
    const isProformaOrder = order.installacion !== false
    const totalSinIva     = (order.total_with_iva ?? 0) / 1.21
    const ivaAmount       = totalSinIva * ivaPct / 100
    const totalConIva     = totalSinIva * (1 + ivaPct / 100)
    const invoiceNum      = `${isProformaOrder ? 'PRO' : 'FAC'}-${Date.now().toString().slice(-8)}`

    const { data: inv, error } = await supabase.from('invoices').insert({
      order_id:           order.id,
      user_id:            order.user_id,
      invoice_number:     invoiceNum,
      payment_status:     'pending_payment',
      total_without_iva:  totalSinIva,
      iva:                ivaAmount,
      total_with_iva:     totalConIva,
      iva_pct:            ivaPct,
      items:              order.items,
    }).select().single()

    if (error) throw error
    setExistingInvoice(inv)
    setProformaTotal(String(inv.total_with_iva ?? ''))
    return inv
  }

  async function handleGenerateInvoice() {
    setGeneratingInvoice(true)
    try {
      let inv = existingInvoice
      if (!inv) inv = await createInvoiceRecord()
      const { data: empresaData } = await supabase.from('professional_data').select('*').eq('user_id', order.user_id).maybeSingle()
      generateInvoicePDF(inv, order, empresaData)
    } catch (e) {
      console.error('Error generando factura:', e)
    } finally {
      setGeneratingInvoice(false)
    }
  }

  async function handlePaymentStatus(newStatus) {
    if (!existingInvoice) return
    const { data } = await supabase.from('invoices').update({ payment_status: newStatus }).eq('id', existingInvoice.id).select().single()
    if (data) setExistingInvoice(data)
  }

  async function handleUpdateProformaTotal() {
    setSavingProforma(true)
    const newTotal = parseFloat(String(proformaTotal).replace(',', '.'))
    if (!isNaN(newTotal) && newTotal > 0) {
      const sinIva = newTotal / 1.21
      const iva    = newTotal - sinIva
      const { data } = await supabase.from('invoices')
        .update({ total_with_iva: newTotal, total_without_iva: sinIva, iva })
        .eq('id', existingInvoice.id).select().single()
      if (data) { setExistingInvoice(data); setProformaTotal(String(data.total_with_iva)) }
    }
    setSavingProforma(false)
  }

  async function handleConfirmDefinitiva() {
    if (!window.confirm('¿Convertir esta factura proforma en definitiva? Esta acción no se puede revertir.')) return
    const newNum = existingInvoice.invoice_number.replace(/^PRO-/, 'FAC-')
    const { data } = await supabase.from('invoices').update({ invoice_number: newNum }).eq('id', existingInvoice.id).select().single()
    if (data) setExistingInvoice(data)
  }

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
      if (status === 'cancelled' && existingInvoice) {
        await supabase.from('invoices').delete().eq('id', existingInvoice.id)
        setExistingInvoice(null)
      }
      if (status === 'confirmed' && !existingInvoice) {
        try { await createInvoiceRecord() } catch (e) { console.error('Auto-factura:', e) }
      }
      const clientEmail = order.profiles?.email
      if (clientEmail) {
        const statusLabels = { pending: 'Pendiente', confirmed: 'Confirmado', completed: 'Completado', cancelled: 'Cancelado' }
        notifyStatusChange({ userEmail: clientEmail, orderId: order.id, status, statusLabel: statusLabels[status] ?? status, confirmedDate, confirmedTime })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      onUpdate()
    }
  }

  async function handleDeleteOrder() {
    if (!window.confirm('¿Eliminar definitivamente este pedido cancelado? Esta acción no se puede deshacer.')) return
    if (existingInvoice) await supabase.from('invoices').delete().eq('id', existingInvoice.id)
    const { error } = await supabase.from('orders').delete().eq('id', order.id)
    if (!error) { onUpdate(); onClose() }
  }

  async function handleSendEmail() {
    setSendingEmail(true)
    try {
      const clientEmail = order.profiles?.email
      if (clientEmail) {
        if (existingInvoice) {
          const pdfBase64 = await generateInvoicePDF(existingInvoice, order, null, { returnBase64: true })
          await sendInvoiceEmail({ userEmail: clientEmail, invoice: existingInvoice, orderId: order.id, items: order.items, pdfBase64 })
        } else {
          await confirmAppointment({ userEmail: clientEmail, confirmedDate, confirmedTime, address: order.address })
        }
      }
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 3000)
    } catch (e) { console.error('Email error:', e) }
    setSendingEmail(false)
  }

  const calendarUrl      = buildCalendarUrl(order, confirmedDate, confirmedTime)
  const isParticular     = order.user_type === 'public'
  const tieneInstalacion = order.installacion !== false
  const isProformaInvoice = existingInvoice?.invoice_number?.startsWith('PRO-') ?? false

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

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
                      {BLIND_TYPE_LABELS[item.blind_type] ?? item.blind_type ?? '—'}
                      {item.quantity > 1 && ` ×${item.quantity}`}
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.width && item.height ? `${item.width}×${item.height} mm` : ''}
                      {item.mechanism ? ` · ${item.mechanism}` : ''}
                      {item.mechanism === 'cinta' && item.orientation ? ` (${item.orientation})` : ''}
                      {item.mechanism === 'motor' && item.motor_type ? ` · ${item.motor_type}` : ''}
                      {item.guide_type && item.guide_type !== 'none' ? ` · guía ${item.guide_type}` : ''}
                    </p>
                    <p className="text-xs text-gray-400">
                      {['sistema_mini_cajon_pvc','sistema_mini_cajon_aluminio','sistema_mini_autoblocante'].includes(item.blind_type)
                        ? [item.box_color_name ? `Cajón: ${item.box_color_name}` : '', item.slat_color_name ? `Lamas: ${item.slat_color_name}` : ''].filter(Boolean).join(' · ')
                        : item.blind_type !== 'solo_motor' && item.slat_color_name ? `Color: ${item.slat_color_name}` : ''}
                      {item.installacion ? ' · Con instalación' : ''}
                    </p>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white">
                {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {!tieneInstalacion && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-amber-700 mb-1">Pedido sin instalación — Solo material</p>
                <p className="text-xs text-amber-600">El cliente debe pagar en 24-48h. Formas de pago: Bizum, transferencia o efectivo. Marca el estado como "Completado" cuando se confirme el pago.</p>
              </div>
            )}

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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas internas</label>
              <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={3}
                placeholder="Notas solo visibles para el admin..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none" />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-red-700 hover:bg-red-800 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saved ? '✓ Guardado' : saving ? 'Guardando...' : 'Guardar cambios'}
              </button>

              {status === 'cancelled' && (
                <button onClick={handleDeleteOrder}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-semibold text-sm rounded-xl transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Eliminar pedido
                </button>
              )}

              <button onClick={handleSendEmail} disabled={sendingEmail}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm rounded-xl transition-colors disabled:opacity-60">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {emailSent ? '✓ Enviado' : existingInvoice ? 'Enviar factura' : 'Email cliente'}
              </button>

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

            {isParticular && tieneInstalacion && !calendarUrl && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Asigna fecha y hora confirmada para generar el enlace de Google Calendar
              </p>
            )}

            {/* Facturación */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Facturación</p>

              {!existingInvoice && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-gray-500">Tipo IVA:</span>
                  {[21, 10, 4, 0].map(pct => (
                    <button key={pct} onClick={() => setIvaPct(pct)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${ivaPct === pct ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'}`}>
                      {pct}%
                    </button>
                  ))}
                </div>
              )}

              {!existingInvoice ? (
                <button onClick={handleGenerateInvoice} disabled={generatingInvoice}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-60">
                  {generatingInvoice
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                  }
                  {generatingInvoice ? 'Generando...' : tieneInstalacion ? 'Generar factura proforma' : 'Generar factura'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-900">{existingInvoice.invoice_number}</p>
                        {isProformaInvoice && (
                          <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">PROFORMA</span>
                        )}
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        existingInvoice.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {existingInvoice.payment_status === 'paid' ? 'Pagada' : 'Pendiente de pago'}
                      </span>
                    </div>
                    <button onClick={() => generateInvoicePDF(existingInvoice, order)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Descargar PDF
                    </button>
                  </div>

                  {isProformaInvoice && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-bold text-blue-700">Proforma — actualizar importe tras medidas</p>
                      <div className="flex gap-2">
                        <input type="number" min="0" step="0.01" value={proformaTotal}
                          onChange={e => setProformaTotal(e.target.value)} placeholder="Total con IVA (€)"
                          className="flex-1 px-3 py-2 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white" />
                        <button onClick={handleUpdateProformaTotal} disabled={savingProforma}
                          className="px-3 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-60">
                          {savingProforma ? '...' : 'Actualizar'}
                        </button>
                      </div>
                      <button onClick={handleConfirmDefinitiva}
                        className="w-full py-2 text-xs font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors">
                        Confirmar como factura definitiva →
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => handlePaymentStatus('pending_payment')}
                      disabled={existingInvoice.payment_status === 'pending_payment'}
                      className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
                        existingInvoice.payment_status === 'pending_payment' ? 'bg-amber-100 text-amber-700 cursor-default' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}>
                      Pendiente de pago
                    </button>
                    <button onClick={() => handlePaymentStatus('paid')}
                      disabled={existingInvoice.payment_status === 'paid'}
                      className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
                        existingInvoice.payment_status === 'paid' ? 'bg-green-100 text-green-700 cursor-default' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
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
