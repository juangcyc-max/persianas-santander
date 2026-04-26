// PriceDisplay recibe el desglose de precios ya calculado desde Configurator
function PriceDisplay({ priceBreakdown, userType, proDiscount = 0 }) {
  const fmt = (n) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)

  const {
    productLabel = '',
    productPricePerSqm = 0,
    boxLabel = '',
    boxPricePerSqm = 0,
    guidesCost = 0,
    motorCost = 0,
    installacionCost = 0,
    billableSqm = 0,
    subtotalSinIva = 0,
    iva = 0,
    totalConIva = 0,
    finalPrice = 0,
    discount = 0,
  } = priceBreakdown || {}

  const lines = [
    productLabel && productPricePerSqm > 0 && {
      label: `${productLabel} (${billableSqm.toFixed(2)} m² × ${fmt(productPricePerSqm)}/m²)`,
      value: productPricePerSqm * billableSqm,
    },
    boxLabel && boxPricePerSqm > 0 && {
      label: `${boxLabel} (${billableSqm.toFixed(2)} m² × ${fmt(boxPricePerSqm)}/m²)`,
      value: boxPricePerSqm * billableSqm,
    },
    guidesCost > 0 && {
      label: 'Guías laterales',
      value: guidesCost,
    },
    motorCost > 0 && {
      label: 'Motor',
      value: motorCost,
    },
    installacionCost > 0 && {
      label: 'Instalación',
      value: installacionCost,
    },
  ].filter(Boolean)

  return (
    <div className="bg-gradient-to-br from-red-700 to-red-800 text-white p-6 rounded-xl shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-base font-semibold">Presupuesto estimado</h2>
      </div>

      {/* Desglose de líneas */}
      {lines.length > 0 && (
        <div className="space-y-1.5 mb-3 pb-3 border-b border-red-500/60">
          {lines.map(({ label, value }) => (
            <div key={label} className="flex justify-between text-xs text-red-100">
              <span className="flex-1 pr-2">{label}</span>
              <span className="flex-shrink-0">{fmt(value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Totales */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-red-100">
          <span>Subtotal (sin IVA)</span>
          <span>{fmt(subtotalSinIva)}</span>
        </div>
        <div className="flex justify-between text-red-100">
          <span>IVA (21%)</span>
          <span>{fmt(iva)}</span>
        </div>
        <div className="flex justify-between text-red-100">
          <span>Total con IVA</span>
          <span>{fmt(totalConIva)}</span>
        </div>
        {userType === 'professional' && discount > 0 && (
          <div className="flex justify-between text-green-300 font-medium">
            <span>Descuento profesional (−{proDiscount}%)</span>
            <span>−{fmt(discount)}</span>
          </div>
        )}
        <div className="border-t border-red-500/60 pt-3 mt-1">
          <div className="flex justify-between items-baseline">
            <span className="text-lg font-bold">TOTAL</span>
            <span className="text-3xl font-black">{fmt(finalPrice)}</span>
          </div>
          <p className="text-xs text-red-200 mt-1 text-right">
            {userType === 'professional' ? 'IVA incluido · Tarifa profesional aplicada' : 'IVA incluido'}
          </p>
        </div>
      </div>

      {billableSqm > 0 && (
        <p className="text-xs text-red-200/70 mt-4 pt-3 border-t border-red-600/40">
          Pedido mínimo 1,5 m². Precio por m² según color y tipo seleccionados.
        </p>
      )}

      <p className="text-xs text-red-200/70 mt-2">
        ⚠ Precio orientativo. Se confirmará tras validar las medidas en visita técnica.
      </p>
    </div>
  )
}

export default PriceDisplay
