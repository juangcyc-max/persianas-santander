function MechanismSelector({ blindType, mechanism, onMechanismChange, orientation, onOrientationChange }) {
  const isBlocking = blindType === 'blocking'

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Mecanismo</h2>
      
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Muelle */}
        <button
          onClick={() => onMechanismChange('muelle')}
          disabled={isBlocking}
          className={`p-3 rounded-lg border-2 transition-all ${
            mechanism === 'muelle' 
              ? 'border-santander-red bg-red-50' 
              : 'border-gray-300 hover:border-gray-400'
          } ${isBlocking ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <p className="font-semibold text-sm">Muelle</p>
        </button>

        {/* Cinta */}
        <button
          onClick={() => onMechanismChange('cinta')}
          disabled={isBlocking}
          className={`p-3 rounded-lg border-2 transition-all ${
            mechanism === 'cinta' 
              ? 'border-santander-red bg-red-50' 
              : 'border-gray-300 hover:border-gray-400'
          } ${isBlocking ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <p className="font-semibold text-sm">Cinta</p>
        </button>

        {/* Motor */}
        <button
          onClick={() => onMechanismChange('motor')}
          className={`p-3 rounded-lg border-2 transition-all ${
            mechanism === 'motor' 
              ? 'border-santander-red bg-red-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <p className="font-semibold text-sm">Motor</p>
        </button>
      </div>

      {/* Orientación (solo si es Cinta) */}
      {mechanism === 'cinta' && (
        <div className="mt-4">
          <label className="block text-gray-700 mb-2 font-medium">Orientación de la cinta</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onOrientationChange('izquierda')}
              className={`p-3 rounded-lg border-2 transition-all ${
                orientation === 'izquierda' 
                  ? 'border-santander-red bg-red-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <p className="font-semibold text-sm">⬅️ Izquierda</p>
            </button>

            <button
              onClick={() => onOrientationChange('derecha')}
              className={`p-3 rounded-lg border-2 transition-all ${
                orientation === 'derecha' 
                  ? 'border-santander-red bg-red-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <p className="font-semibold text-sm">➡️ Derecha</p>
            </button>
          </div>
        </div>
      )}

      {/* Aviso para bloqueante */}
      {isBlocking && mechanism !== 'motor' && (
        <p className="mt-2 text-sm text-orange-600">
          ⚠️ Las persianas bloqueantes requieren motor
        </p>
      )}
    </div>
  )
}

export default MechanismSelector