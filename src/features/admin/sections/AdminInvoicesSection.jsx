import { useState, useEffect } from 'react'
import { supabase } from '../../../services/supabase/client'
import { generateInvoicePDF } from '../../../services/invoicePDF'
import { sendInvoiceEmail } from '../../../services/email'
import { fmt, fmtDate } from '../constants'

// ── helpers PDF (exported for SendInvoiceRowButton) ────────────────────────
export function resolveInvForPDF(inv) {
  const empresa   = inv._empresa ?? null
  const orderBase = inv.orders ?? {}
  if (empresa) return { empresa, order: orderBase }
  if (orderBase.billing_data) return { empresa: null, order: orderBase }
  const cd = inv._clientData ?? null
  if (!cd) return { empresa: null, order: orderBase }
  return {
    empresa: null,
    order: {
      ...orderBase,
      billing_data: { nombre: cd.nombre, apellidos: cd.apellidos, dni_nif: cd.dni_nif, direccion: cd.direccion, codigo_postal: cd.codigo_postal, ciudad: cd.ciudad, email: orderBase.profiles?.email },
    },
  }
}

function SendInvoiceRowButton({ inv }) {
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [err,     setErr]     = useState(false)
  const clientEmail = inv.orders?.profiles?.email

  async function handleSend() {
    if (!clientEmail) return
    setSending(true); setErr(false)
    try {
      const { empresa, order: orderData } = resolveInvForPDF(inv)
      const pdfBase64 = await generateInvoicePDF(inv, orderData, empresa, { returnBase64: true })
      await sendInvoiceEmail({ userEmail: clientEmail, invoice: inv, orderId: inv.order_id, items: inv.orders?.items ?? [], pdfBase64 })
      setSent(true); setTimeout(() => setSent(false), 3000)
    } catch { setErr(true); setTimeout(() => setErr(false), 3000) }
    finally { setSending(false) }
  }

  if (!clientEmail) return <span className="text-xs text-gray-300">Sin email</span>
  return (
    <button onClick={handleSend} disabled={sending || sent}
      className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors ${sent ? 'text-green-600' : err ? 'text-red-500' : 'text-blue-600 hover:text-blue-800'}`}>
      {sending ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> :
       sent ? '✓ Enviada' : err ? 'Error' : (
        <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>Enviar</>
      )}
    </button>
  )
}

export default function AdminInvoicesSection() {
  const [invoices,       setInvoices]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [invDateFrom,    setInvDateFrom]    = useState('')
  const [invDateTo,      setInvDateTo]      = useState('')
  const [editDiscount,   setEditDiscount]   = useState({})
  const [savingDiscount, setSavingDiscount] = useState({})
  const [savedDiscount,  setSavedDiscount]  = useState({})

  useEffect(() => { loadInvoices() }, [])

  async function loadInvoices() {
    setLoading(true)
    const { data } = await supabase.from('invoices')
      .select('*, orders(user_id, items, address, phone, billing_data, profiles(email))')
      .order('created_at', { ascending: false })
    const rows = data ?? []
    const userIds = [...new Set(rows.map(i => i.orders?.user_id ?? i.user_id).filter(Boolean))]
    const [proRes, clientRes] = await Promise.all([
      userIds.length ? supabase.from('professional_data').select('*').in('user_id', userIds) : { data: [] },
      userIds.length ? supabase.from('client_data').select('*').in('user_id', userIds)       : { data: [] },
    ])
    const proMap = {}; (proRes.data ?? []).forEach(p => { proMap[p.user_id] = p })
    const clientMap = {}; (clientRes.data ?? []).forEach(c => { clientMap[c.user_id] = c })
    setInvoices(rows.map(inv => {
      const uid = inv.orders?.user_id ?? inv.user_id
      return { ...inv, _empresa: proMap[uid] ?? null, _clientData: clientMap[uid] ?? null }
    }))
    setLoading(false)
  }

  async function handleDiscountSave(inv) {
    const raw      = editDiscount[inv.id]
    const discount = raw !== undefined ? parseFloat(raw) : (inv.pro_discount ?? 0)
    if (isNaN(discount) || discount < 0 || discount > 100) return
    setSavingDiscount(prev => ({ ...prev, [inv.id]: true }))
    const prevDiscount  = inv.pro_discount ?? 0
    const originalBase  = prevDiscount < 100 ? (inv.total_without_iva ?? 0) / (1 - prevDiscount / 100) : inv.total_without_iva ?? 0
    const newBase  = originalBase * (1 - discount / 100)
    const newIva   = newBase * 0.21
    const newTotal = newBase + newIva
    const { error } = await supabase.from('invoices').update({
      pro_discount: discount, total_without_iva: Math.round(newBase * 100) / 100,
      iva: Math.round(newIva * 100) / 100, total_with_iva: Math.round(newTotal * 100) / 100,
    }).eq('id', inv.id)
    setSavingDiscount(prev => ({ ...prev, [inv.id]: false }))
    if (!error) {
      setInvoices(prev => prev.map(i => i.id === inv.id
        ? { ...i, pro_discount: discount, total_without_iva: Math.round(newBase * 100) / 100, iva: Math.round(newIva * 100) / 100, total_with_iva: Math.round(newTotal * 100) / 100 } : i))
      setSavedDiscount(prev => ({ ...prev, [inv.id]: true }))
      setTimeout(() => setSavedDiscount(prev => ({ ...prev, [inv.id]: false })), 2000)
    }
  }

  async function handlePaymentStatus(invoiceId, newStatus) {
    await supabase.from('invoices').update({ payment_status: newStatus }).eq('id', invoiceId)
    setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, payment_status: newStatus } : i))
  }

  const filteredInvoices = invoices.filter(inv => {
    const d = inv.created_at ? inv.created_at.slice(0, 10) : ''
    return (!invDateFrom || d >= invDateFrom) && (!invDateTo || d <= invDateTo)
  })

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
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url
    a.download = `facturas_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const DiscountCell = ({ inv }) => (
    <div className="flex items-center gap-1">
      <div className="relative">
        <input type="number" min="0" max="100" step="1"
          value={editDiscount[inv.id] !== undefined ? editDiscount[inv.id] : (inv.pro_discount ?? 0)}
          onChange={e => setEditDiscount(prev => ({ ...prev, [inv.id]: e.target.value }))}
          className="w-14 px-2 py-1 pr-4 rounded-lg border border-gray-300 text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-red-200" />
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
      </div>
      <button onClick={() => handleDiscountSave(inv)} disabled={savingDiscount[inv.id]}
        className={`px-2 py-1 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 ${savedDiscount[inv.id] ? 'bg-green-600 text-white' : 'bg-red-700 hover:bg-red-800 text-white'}`}>
        {savingDiscount[inv.id] ? '…' : savedDiscount[inv.id] ? '✓' : 'OK'}
      </button>
    </div>
  )

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
                  className="px-2.5 py-1.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Hasta</label>
                <input type="date" value={invDateTo} onChange={e => setInvDateTo(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white" />
              </div>
              {(invDateFrom || invDateTo) && (
                <button onClick={() => { setInvDateFrom(''); setInvDateTo('') }} className="text-xs text-gray-400 hover:text-red-600 transition-colors pb-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {filteredInvoices.length > 0 && (
                <button onClick={exportCSV} className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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
          <>
            {/* Móvil */}
            <div className="sm:hidden divide-y divide-gray-100">
              {filteredInvoices.map(inv => (
                <div key={inv.id} className="px-4 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs font-semibold text-gray-700">{inv.invoice_number}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{fmtDate(inv.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{fmt(inv.total_with_iva)}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${inv.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {inv.payment_status === 'paid' ? 'Pagada' : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-medium">Descuento:</span>
                    <DiscountCell inv={inv} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => handlePaymentStatus(inv.id, 'pending_payment')} disabled={inv.payment_status === 'pending_payment'}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${inv.payment_status === 'pending_payment' ? 'bg-amber-100 text-amber-700 cursor-default' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                      Pendiente
                    </button>
                    <button onClick={() => handlePaymentStatus(inv.id, 'paid')} disabled={inv.payment_status === 'paid'}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${inv.payment_status === 'paid' ? 'bg-green-100 text-green-700 cursor-default' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                      Pagada
                    </button>
                    <button onClick={() => { const { empresa, order: orderData } = resolveInvForPDF(inv); generateInvoicePDF(inv, orderData, empresa) }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      PDF
                    </button>
                    <SendInvoiceRowButton inv={inv} />
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
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
                      <td className="px-2 py-2 sm:px-4 sm:py-3"><DiscountCell inv={inv} /></td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${inv.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {inv.payment_status === 'paid' ? 'Pagada' : 'Pendiente de pago'}
                        </span>
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3">
                        <div className="flex flex-wrap gap-1">
                          <button onClick={() => handlePaymentStatus(inv.id, 'pending_payment')} disabled={inv.payment_status === 'pending_payment'}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${inv.payment_status === 'pending_payment' ? 'bg-amber-100 text-amber-700 cursor-default' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                            Pendiente
                          </button>
                          <button onClick={() => handlePaymentStatus(inv.id, 'paid')} disabled={inv.payment_status === 'paid'}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${inv.payment_status === 'paid' ? 'bg-green-100 text-green-700 cursor-default' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                            Pagada
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3">
                        <button onClick={() => { const { empresa, order: orderData } = resolveInvForPDF(inv); generateInvoicePDF(inv, orderData, empresa) }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          PDF
                        </button>
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3"><SendInvoiceRowButton inv={inv} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
