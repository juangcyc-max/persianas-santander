import { useState } from 'react'
import { supabase } from '../../../services/supabase/client'
import { generateProQuotePDF } from '../../../services/pdf'
import { fmt, fmtDate, PRO_QUOTE_STATUS, BLIND_LABELS_ADMIN } from '../constants'

export default function AdminProQuoteModal({ quote, proData, onClose, onUpdated }) {
  const [status,      setStatus]      = useState(quote.status)
  const [adminPrice,  setAdminPrice]  = useState(quote.admin_total_con_iva ?? quote.total_con_iva ?? 0)
  const [notes,       setNotes]       = useState(quote.admin_notes ?? '')
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [confirmDel,  setConfirmDel]  = useState(false)
  const [downloading, setDownloading] = useState(false)

  const isModified      = parseFloat(adminPrice) !== parseFloat(quote.total_con_iva)
  const clientAccepted  = quote.client_status === 'accepted'
  const hasInstallacion = (quote.items ?? []).some(it => it.installacion)

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
      const { sendProQuoteAccepted } = await import('../../../services/email')
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

    // Auto-generar pedido + factura en la primera aceptación (ambas partes OK)
    if ((status === 'accepted' || status === 'modified') && quote.status === 'pending') {
      const finalPrice  = parseFloat(adminPrice)
      const totalSinIva = finalPrice / 1.21
      const origTotal   = quote.total_con_iva || finalPrice
      const ratio       = origTotal > 0 ? finalPrice / origTotal : 1

      const orderItems = (quote.items ?? []).map(it => ({
        configuration_id: it.config_id       ?? null,
        quantity:         1,
        blind_type:       it.blind_type,
        width:            it.width            ?? null,
        height:           it.height           ?? null,
        mechanism:        it.mechanism        ?? null,
        motor_type:       it.motor_type       ?? null,
        guide_type:       it.guide_type       ?? null,
        estimated_price:  (it.price_professional * 1.21) * ratio,
        box_color_name:   it.box_color_name   ?? null,
        slat_color_name:  it.slat_color_name  ?? null,
      }))

      const billingData = proData?.razon_social ? {
        nombre:        proData.razon_social    ?? '',
        apellidos:     '',
        dni_nif:       proData.cif_nif         ?? '',
        direccion:     proData.direccion_fiscal ?? '',
        codigo_postal: proData.codigo_postal   ?? '',
        ciudad:        proData.ciudad          ?? '',
        email:         proData.email           ?? '',
        es_empresa:    true,
      } : null

      const { data: newOrder } = await supabase.from('orders').insert({
        user_id:        quote.user_id,
        user_type:      'professional',
        items:          orderItems,
        total_price:    totalSinIva,
        total_with_iva: finalPrice,
        status:         'pending',
        installacion:   hasInstallacion,
        address:        quote.install_address ?? null,
        phone:          quote.install_phone   ?? null,
        preferred_date: quote.install_date    ?? null,
        preferred_time: quote.install_time    ?? null,
        notes:          quote.install_notes   ?? null,
        billing_data:   billingData,
      }).select('id').single()

      if (newOrder?.id) {
        await supabase.from('invoices').insert({
          order_id:          newOrder.id,
          user_id:           quote.user_id,
          invoice_number:    `FAC-${Date.now().toString().slice(-8)}`,
          payment_status:    'pending_payment',
          total_without_iva: totalSinIva,
          iva:               finalPrice - totalSinIva,
          total_with_iva:    finalPrice,
          items:             orderItems,
          pro_discount:      quote.discount_pct ?? null,
        })
      }
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
          {!clientAccepted && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-amber-700">En espera de aceptación del cliente</p>
                <p className="text-xs text-amber-600 mt-0.5">El profesional aún no ha confirmado que su cliente ha aceptado el presupuesto.</p>
              </div>
            </div>
          )}

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

          {(quote.client_total || quote.work_notes) && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Solo visible para el administrador</p>
              {quote.client_total > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">El profesional cobra a su cliente:</span>
                  <span className="font-bold text-gray-900">{fmt(quote.client_total)}</span>
                </div>
              )}
              {quote.work_notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-0.5">Notas de trabajo:</p>
                  <p className="text-sm text-gray-700 italic">{quote.work_notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Estado */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Estado</label>
            <div className={`grid grid-cols-2 gap-2 ${!clientAccepted ? 'opacity-50 pointer-events-none' : ''}`}>
              {Object.entries(PRO_QUOTE_STATUS).map(([k, { label }]) => (
                <button key={k} type="button" onClick={() => setStatus(k)}
                  className={`py-2 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    status === k ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {(status === 'accepted' || status === 'modified') && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Total con IVA para el profesional (€)
                {isModified && <span className="ml-2 text-blue-600 normal-case font-normal">precio modificado</span>}
              </label>
              <div className="relative">
                <input type="number" min="0" step="0.01" value={adminPrice} onChange={e => setAdminPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-8 rounded-xl border border-gray-300 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Sin IVA: {fmt(parseFloat(adminPrice || 0) / 1.21)}</p>
            </div>
          )}

          {hasInstallacion && clientAccepted && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-1">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">Datos de instalación</p>
              {quote.install_address && <p className="text-sm text-gray-700"><span className="text-xs text-gray-400">Dirección:</span> {quote.install_address}</p>}
              {quote.install_phone   && <p className="text-sm text-gray-700"><span className="text-xs text-gray-400">Teléfono:</span> {quote.install_phone}</p>}
              {quote.install_date    && <p className="text-sm text-gray-700"><span className="text-xs text-gray-400">Fecha:</span> {quote.install_date}</p>}
              {quote.install_time    && <p className="text-sm text-gray-700"><span className="text-xs text-gray-400">Hora:</span> {quote.install_time}</p>}
              {quote.install_notes   && <p className="text-sm text-gray-700"><span className="text-xs text-gray-400">Notas:</span> {quote.install_notes}</p>}
              {!quote.install_address && !quote.install_date && (
                <p className="text-xs text-blue-500 italic">El profesional aún no ha proporcionado los datos de instalación.</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notas para el profesional</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Se ha ajustado el precio por volumen de compra…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 resize-none" />
          </div>

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
                <button onClick={handleDelete} disabled={deleting} className="text-xs font-bold text-red-600 hover:text-red-800 disabled:opacity-50">
                  {deleting ? '…' : 'Sí'}
                </button>
                <button onClick={() => setConfirmDel(false)} className="text-xs text-gray-500 hover:text-gray-700">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(true)} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Eliminar
              </button>
            )}
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || !clientAccepted}
              className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-sm font-bold disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              title={!clientAccepted ? 'Esperando que el cliente del profesional acepte el presupuesto' : ''}>
              {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
              {saving ? 'Guardando…' : 'Guardar y notificar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
