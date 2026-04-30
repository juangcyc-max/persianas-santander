import { useState } from 'react'
import { supabase } from '../../../services/supabase/client'
import { generateBudgetPDF } from '../../../services/pdf'
import { sendBudgetResend } from '../../../services/email'
import { fmt, BUDGET_STATUS_MAP, BUDGET_TYPE_LABELS } from '../constants'

export default function BudgetModal({ budget, onClose, onSaved }) {
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
    const customerData   = { name: budget.customer_name ?? '', phone: budget.customer_phone ?? '', email: budget.customer_email ?? '', address: budget.customer_address ?? '' }
    const configuration  = {
      blindType:      budget.blind_type,
      mechanism:      budget.mechanism,
      width:          budget.width,
      height:         budget.height,
      estimatedPrice: effectivePrice,
      motorType:      budget.motor_type ?? null,
      guideType:      budget.guide_type ?? null,
      installacion:   budget.installacion !== false,
      clientNotes:    budget.client_notes ?? '',
      boxColorName:   budget.box_color_name  ?? null,
      boxColorGama:   budget.box_color_gama  ?? null,
      slatColorName:  budget.slat_color_name ?? null,
      slatColorGama:  budget.slat_color_gama ?? null,
    }
    return { customerData, configuration }
  }

  async function handleDownloadPDF() {
    setDownloading(true)
    try {
      const { customerData, configuration } = getBudgetParams()
      await generateBudgetPDF(customerData, configuration, { skipSave: true, budgetNumberOverride: budget.budget_number ?? null })
    } finally {
      setDownloading(false)
    }
  }

  async function handleSendEmail() {
    setSending(true); setSendFeedback('')
    try {
      const effectivePrice = adminPrice !== '' ? parseFloat(adminPrice) : (budget.admin_price ?? budget.total_with_iva)
      await supabase.from('budgets').update({ budget_status: 'accepted', admin_notes: adminNotes || null, admin_price: effectivePrice }).eq('id', budget.id)
      setStatus('accepted')
      const { customerData, configuration } = getBudgetParams()
      const pdfBase64 = await generateBudgetPDF(customerData, configuration, { skipSave: true, budgetNumberOverride: budget.budget_number ?? null, returnBase64: true })
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
          <div className="bg-gray-50 rounded-xl p-4 space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Cliente</p>
            <p className="font-semibold text-gray-900">{budget.customer_name ?? '—'}</p>
            <p className="text-sm text-gray-500">{budget.customer_phone ?? ''}{budget.customer_phone && budget.customer_email ? '  ·  ' : ''}{budget.customer_email ?? ''}</p>
            {budget.customer_address && <p className="text-sm text-gray-500">{budget.customer_address}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-gray-400 mb-0.5">Tipo</p><p className="font-medium text-gray-800">{typeLabel}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Medidas</p><p className="font-medium text-gray-800">{budget.width ? `${budget.width} × ${budget.height} mm` : '—'}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Mecanismo</p><p className="font-medium text-gray-800 capitalize">{budget.mechanism ?? '—'}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Precio original</p><p className="font-bold text-red-700">{fmt(budget.total_with_iva)}</p></div>
          </div>

          {budget.client_notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Comentarios del cliente</p>
              <p className="text-sm text-amber-800 whitespace-pre-wrap">{budget.client_notes}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Estado</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {Object.entries(BUDGET_STATUS_MAP).map(([key, { label, cls }]) => (
                <button key={key} onClick={() => setStatus(key)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                    status === key ? `${cls} border-current` : 'border-transparent bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Precio ajustado (€ con IVA)</label>
            <input type="number" step="0.01" min="0" value={adminPrice} onChange={e => setAdminPrice(e.target.value)}
              placeholder={`Original: ${fmt(budget.total_with_iva)}`}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400" />
            <p className="text-xs text-gray-400 mt-1">Deja vacío para mantener el precio original calculado automáticamente.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notas internas</label>
            <textarea rows={3} value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
              placeholder="Notas visibles solo para el administrador…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 resize-none" />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={handleDownloadPDF} disabled={downloading}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {downloading ? 'Generando…' : 'Descargar PDF'}
            </button>
            <button onClick={handleSendEmail} disabled={sending || sendFeedback === 'ok'}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
                sendFeedback === 'ok'    ? 'bg-green-600 text-white' :
                sendFeedback === 'error' ? 'bg-red-200 text-red-800' :
                'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60'
              }`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {sending ? 'Enviando…' : sendFeedback === 'ok' ? '✓ Enviado' : sendFeedback === 'error' ? 'Error al enviar' : 'Enviar al cliente'}
            </button>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || saved}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-red-700 hover:bg-red-800 text-white disabled:opacity-60'}`}>
              {saving ? '…' : saved ? '✓ Guardado' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
