import { fmt, fmtDate } from '../constants'
import SectionHeader from '../components/SectionHeader'

export default function FacturasTab({ facturas }) {
  return (
    <div className="space-y-4">
      <SectionHeader title="Facturas" />
      {facturas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <p className="font-semibold text-gray-700">No hay facturas todavía</p>
          <p className="text-sm text-gray-400 mt-1">Las facturas aparecen cuando completas un pedido.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Nº Factura', 'Fecha', 'Estado pago', 'Total'].map((h, i) => (
                    <th key={h} className={`px-2 py-2 sm:px-5 sm:py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i === 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {facturas.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-2 py-2 sm:px-5 sm:py-3 font-mono text-xs text-gray-600">{f.invoice_number}</td>
                    <td className="px-2 py-2 sm:px-5 sm:py-3 text-gray-400">{fmtDate(f.created_at)}</td>
                    <td className="px-2 py-2 sm:px-5 sm:py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${f.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {f.payment_status === 'paid' ? 'Pagada' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-2 py-2 sm:px-5 sm:py-3 text-right font-bold text-gray-900">{fmt(f.total_with_iva)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
