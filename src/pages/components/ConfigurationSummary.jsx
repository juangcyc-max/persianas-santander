function ConfigurationSummary({ 
  blindType, 
  mechanism, 
  orientation, 
  motorType, 
  width, 
  height, 
  depth, 
  boxColor, 
  slatColor,
  winchesterColors 
}) {
  // Helper para obtener nombre del color
  const getColorName = (hex) => {
    return winchesterColors.find(c => c.hex === hex)?.name || hex
  }

  // Helper para capitalizar
  const capitalize = (text) => {
    return text.charAt(0).toUpperCase() + text.slice(1).replace('_', ' ')
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-santander-red">
      <h2 className="text-xl font-bold text-santander-red mb-4">📋 Resumen de Configuración</h2>
      
      <div className="space-y-3">
        {/* Tipo de Persiana */}
        <div className="flex justify-between py-2 border-b border-gray-200">
          <span className="text-gray-600">Tipo:</span>
          <span className="font-semibold">{capitalize(blindType)}</span>
        </div>

        {/* Mecanismo */}
        <div className="flex justify-between py-2 border-b border-gray-200">
          <span className="text-gray-600">Mecanismo:</span>
          <span className="font-semibold">{capitalize(mechanism)}</span>
        </div>

        {/* Orientación (solo si es cinta) */}
        {mechanism === 'cinta' && (
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="text-gray-600">Orientación:</span>
            <span className="font-semibold">{capitalize(orientation)}</span>
          </div>
        )}

        {/* Tipo de Motor (solo si es motor) */}
        {mechanism === 'motor' && (
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="text-gray-600">Tipo de Motor:</span>
            <span className="font-semibold">{capitalize(motorType)}</span>
          </div>
        )}

        {/* Medidas */}
        <div className="flex justify-between py-2 border-b border-gray-200">
          <span className="text-gray-600">Medidas:</span>
          <span className="font-semibold">{width} × {height} × {depth} mm</span>
        </div>

        {/* Colores */}
        <div className="flex justify-between py-2 border-b border-gray-200">
          <span className="text-gray-600">Color Caja:</span>
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded border" 
              style={{ backgroundColor: boxColor }}
            />
            <span className="font-semibold">{getColorName(boxColor)}</span>
          </div>
        </div>

        <div className="flex justify-between py-2">
          <span className="text-gray-600">Color Lamas:</span>
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded border" 
              style={{ backgroundColor: slatColor }}
            />
            <span className="font-semibold">{getColorName(slatColor)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfigurationSummary