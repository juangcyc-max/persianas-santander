function MotorTypeSelector({ motorType, onMotorTypeChange }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Tipo de Motor</h2>
      
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => onMotorTypeChange('mecanico')}
          className={`p-4 rounded-lg border-2 transition-all ${
            motorType === 'mecanico' 
              ? 'border-santander-red bg-red-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <p className="font-semibold text-sm">🔌 Mecánico</p>
          <p className="text-xs text-gray-500 mt-1">Con cable</p>
        </button>

        <button
          onClick={() => onMotorTypeChange('mando_distancia')}
          className={`p-4 rounded-lg border-2 transition-all ${
            motorType === 'mando_distancia' 
              ? 'border-santander-red bg-red-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <p className="font-semibold text-sm">📟 Mando</p>
          <p className="text-xs text-gray-500 mt-1">A distancia</p>
        </button>

        <button
          onClick={() => onMotorTypeChange('placa_solar')}
          className={`p-4 rounded-lg border-2 transition-all ${
            motorType === 'placa_solar' 
              ? 'border-santander-red bg-red-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <p className="font-semibold text-sm">☀️ Solar</p>
          <p className="text-xs text-gray-500 mt-1">Placa solar</p>
        </button>
      </div>
    </div>
  )
}

export default MotorTypeSelector