import { useState, useEffect } from 'react'
import { supabase } from '../../../services/supabase/client'
import { fmt, fmtDate } from '../constants'
import { generateClientInvoiceFromQuotePDF } from '../../../services/pdf'
import SectionHeader from '../components/SectionHeader'

function autoNum(q) {
  const base = q.budget_number ?? `PRES-${(q.id ?? '').slice(0, 8).toUpperCase()}`
  return base.replace(/^PRES-/i, 'FAC-')
}

export default function FacturasClienteTab({ proInfo, logoUrl }) {
  const [facturas,    setFacturas]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [downloading, setDownloading] = useState({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('pro_purchase_quotes')
        .select('*')
        .eq('user_id', user.id)
        .eq('budget_status', 'facturado')
        .order('created_at', { ascending: false })
      setFacturas(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleDownload(q) {
    setDownloading(p => ({ ...p, [q.id]: true }))
    try {
      const invNum   = autoNum(q)
      const margin   = parseFloat(q.client_margin_pct ?? 0)
      const extras   = parseFloat(q.extras_amount ?? 0) || 0
      const iva      = parseFloat(q.iva_pct ?? 21)
      const template = 'azul'
      const doc = await generateClientInvoiceFromQuotePDF({
        quote:          { ...q, client_info: q.client_info ?? {} },
        proInfo:        proInfo ?? {},
        marginPct:      margin,
        extrasAmount:   extras,
        clientComments: q.client_comments ?? null,
        ivaPct:         iva,
        logoUrl,
        invoiceNumber:  invNum,
        templateId:     template,
      })
      doc?.save(`Factura_${invNum}.pdf`)
    } catch {}
    setDownloading(p => ({ ...p, [q.id]: false }))
  }

  if (loading) return (
    <div className="space-y-4">
      <SectionHeader title="Mis facturas" />
      <div className="bg-white rounded-2xl border border-gray-200 p-12 flex justify-center">
        <span className="w-6 h-6 border-2 border-red-300 border-t-red-700 rounded-full animate-spin" />
      </div>
    </div>
  )

  if (facturas.length === 0) return (
    <div className="space-y-4">
      <SectionHeader title="Mis facturas" />
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
        <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <p className="font-semibold text-gray-700 mb-1">Sin facturas todavía</p>
        <p className="text-sm text-gray-400">Aquí aparecerán las facturas que hayas emitido a tus clientes. Para generar una, ve a <strong>Mis presupuestos</strong>, marca el presupuesto como "Facturado" y descarga el PDF de factura.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <SectionHeader title="Mis facturas" />
      <div className="space-y-2">
        {facturas.map(q => {
          const invNum     = autoNum(q)
          const clientName = q.client_info?.nombre || '—'
          const adminTotal = parseFloat(q.admin_total_con_iva ?? q.total_con_iva ?? 0)
          const margin     = parseFloat(q.client_margin_pct ?? 0)
          const extras     = parseFloat(q.extras_amount ?? 0) || 0
          const total      = adminTotal * (1 + margin / 100) + extras

          return (
            <div key={q.id} className="bg-white border border-gray-200 rounded-2xl px-4 py-3.5 flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-gray-800 font-mono">{invNum}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Facturado</span>
                </div>
                <p className="text-sm font-medium text-gray-700 truncate mt-0.5">{clientName}</p>
                <p className="text-xs text-gray-400">{fmtDate(q.created_at)}</p>
              </div>

              <div className="text-right shrink-0">
                <p className="text-base font-black text-blue-700">{fmt(total)}</p>
                <button
                  onClick={() => handleDownload(q)}
                  disabled={downloading[q.id]}
                  className="mt-1 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors">
                  {downloading[q.id]
                    ? <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
                  PDF
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
