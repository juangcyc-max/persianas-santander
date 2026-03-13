function PriceDisplay({ blindType, mechanism, width, height, depth, userType }) {
  const getBasePricePerSqm = () => {
    if (blindType === 'blocking') return 180
    return 120
  }

  const getMechanismMultiplier = () => {
    switch (mechanism) {
      case 'muelle': return 1.0
      case 'cinta': return 1.1
      case 'motor': return 1.5
      default: return 1.0
    }
  }

  const areaSqm = (width / 1000) * (height / 1000)
  const basePrice = areaSqm * getBasePricePerSqm()
  const priceWithMechanism = basePrice * getMechanismMultiplier()
  const depthCost = depth > 200 ? (depth - 200) * 0.5 : 0
  const totalPrice = priceWithMechanism + depthCost
  const professionalPrice = totalPrice * 0.8

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(price)
  }

  const iva = totalPrice * 0.21
  const totalWithIva = totalPrice + iva

  return (
    <div className="bg-gradient-to-r from-santander-red to-red-700 text-white p-6 rounded-xl shadow-lg">
      <h2 className="text-xl font-semibold mb-4">💰 Presupuesto Estimado</h2>
      
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-red-100">Precio base:</span>
          <span className="font-semibold">{formatPrice(totalPrice)}</span>
        </div>

        {userType === 'professional' && (
          <div className="flex justify-between text-green-300">
            <span>Descuento profesional (20%):</span>
            <span className="font-semibold">-{formatPrice(totalPrice * 0.2)}</span>
          </div>
        )}

        <div className="flex justify-between text-red-100">
          <span>IVA (21%):</span>
          <span>{formatPrice(iva)}</span>
        </div>

        <div className="border-t border-red-400 pt-3 mt-3">
          <div className="flex justify-between text-xl">
            <span className="font-bold">TOTAL:</span>
            <span className="font-bold">
              {formatPrice(userType === 'professional' ? totalWithIva * 0.8 : totalWithIva)}
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs text-red-200 mt-4">
        ⚠️ Precio orientativo. El precio final se confirmará tras validar las medidas.
      </p>
    </div>
  )
}

export default PriceDisplay