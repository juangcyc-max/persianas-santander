import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { generateInvoicePDF } from '../../../services/invoicePDF'
import { fmt, fmtDate, BLIND_LABELS, ORDER_STATUS } from '../constants'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import SectionHeader from '../components/SectionHeader'

export default function PedidosTab({ pedidos, facturas, newOrderId, proData }) {
  const navigate = useNavigate()
  const [downloadingId, setDownloadingId] = useState(null)
  const [expandedId,    setExpandedId]    = useState(null)
  const [autoDownloaded,setAutoDownloaded]= useState(false)
  const [newBanner,     setNewBanner]     = useState(!!newOrderId)

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
    await generateInvoicePDF(invoice, order, proData ?? null)
    setDownloadingId(null)
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Pedidos" action={
        <Link to="/cesta" className="flex items-center gap-2 text-sm font-bold bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Ver cesta
        </Link>
      } />

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
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <p className="font-semibold text-gray-700 mb-4">No hay pedidos todavía</p>
          <Link to="/configurador" className="inline-block px-5 py-2.5 bg-red-700 text-white text-sm font-bold rounded-xl hover:bg-red-800 transition-colors">
            Ir al configurador
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map(p => {
            const invoice    = facturas.find(f => f.order_id === p.id)
            const isExpanded = expandedId === p.id
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Cabecera colapsable */}
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
                          {downloadingId === p.id ? <Spinner small /> : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          )}
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
                    <Badge status={p.status} map={ORDER_STATUS} />
                    {invoice && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${invoice.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {invoice.payment_status === 'paid' ? 'Pagada' : 'Pago pendiente'}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">{fmtDate(p.created_at)}</span>
                  </div>
                </button>

                {/* Detalle expandido */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
                    <div className="space-y-1.5">
                      {(p.items ?? []).map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-gray-700 font-medium">{BLIND_LABELS[item.blind_type] ?? item.blind_type ?? '—'}</span>
                          {item.width && item.height && <span className="text-gray-400">{item.width}×{item.height} mm</span>}
                          <span className="font-bold text-gray-900">{fmt(item.estimated_price ?? 0)}</span>
                        </div>
                      ))}
                    </div>
                    {invoice && (
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                        <div>
                          <p className="text-xs font-semibold text-gray-700">Factura: {invoice.invoice_number}</p>
                        </div>
                        <button
                          onClick={() => handleDownload(p, invoice)}
                          disabled={downloadingId === p.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 text-white text-xs font-bold rounded-lg hover:bg-red-800 disabled:opacity-60 transition-colors"
                        >
                          {downloadingId === p.id ? <Spinner small /> : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Descargar factura
                            </>
                          )}
                        </button>
                      </div>
                    )}
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
