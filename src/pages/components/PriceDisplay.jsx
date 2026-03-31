// PriceDisplay recibe el precio ya calculado desde Configurator (única fuente de verdad)
function PriceDisplay({ estimatedPrice, userType, mechanism, blindType, proDiscount = 20 }) {
  const fmt = (n) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)

  const mult                = 1 - proDiscount / 100
  const priceBeforeDiscount = userType === 'professional' ? estimatedPrice / mult : estimatedPrice
  const priceWithoutIva     = priceBeforeDiscount / 1.21
  const iva                 = priceBeforeDiscount - priceWithoutIva
  const discount            = userType === 'professional' ? priceBeforeDiscount - estimatedPrice : 0

  const mechanismLabel = { muelle: 'Muelle', cinta: 'Cinta', motor: 'Motor' }[mechanism] ?? mechanism
  const typeLabel      = blindType === 'blocking' ? 'Bloqueante' : 'Estándar'

  return (
    <div className="bg-gradient-to-br from-red-700 to-red-800 text-white p-6 rounded-xl shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-base font-semibold">Presupuesto estimado</h2>
        <span className="ml-auto text-xs bg-red-600/60 px-2 py-0.5 rounded-full font-medium">
          {typeLabel} · {mechanismLabel}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-red-100">
          <span>Precio base (sin IVA)</span>
          <span>{fmt(priceWithoutIva)}</span>
        </div>
        <div className="flex justify-between text-red-100">
          <span>IVA (21%)</span>
          <span>{fmt(iva)}</span>
        </div>
        {userType === 'professional' && (
          <div className="flex justify-between text-green-300 font-medium">
            <span>Descuento profesional (−{proDiscount}%)</span>
            <span>−{fmt(discount)}</span>
          </div>
        )}
        <div className="border-t border-red-500/60 pt-3 mt-1">
          <div className="flex justify-between items-baseline">
            <span className="text-lg font-bold">TOTAL</span>
            <span className="text-3xl font-black">{fmt(estimatedPrice)}</span>
          </div>
          {userType === 'professional' && (
            <p className="text-xs text-green-300 mt-1 text-right">IVA incluido · Tarifa profesional aplicada</p>
          )}
          {userType !== 'professional' && (
            <p className="text-xs text-red-200 mt-1 text-right">IVA incluido</p>
          )}
        </div>
      </div>

      <p className="text-xs text-red-200/70 mt-4 pt-3 border-t border-red-600/40">
        ⚠ Precio orientativo. Se confirmará tras validar las medidas en visita técnica.
      </p>
    </div>
  )
}

export default PriceDisplay