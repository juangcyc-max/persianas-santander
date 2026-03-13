function BlindTypeSelector({ blindType, onTypeChange }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Tipo de Persiana</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onTypeChange('normal')}
          className={`p-4 rounded-lg border-2 transition-all ${
            blindType === 'normal' 
              ? 'border-santander-red bg-red-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <p className="font-semibold text-lg">Normal</p>
          <p className="text-sm text-gray-500">Muelle, cinta o motor</p>
        </button>

        <button
          onClick={() => onTypeChange('blocking')}
          className={`p-4 rounded-lg border-2 transition-all ${
            blindType === 'blocking' 
              ? 'border-santander-red bg-red-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <p className="font-semibold text-lg">Bloqueante</p>
          <p className="text-sm text-gray-500">Solo con motor</p>
        </button>
      </div>

      {blindType === 'blocking' && (
        <p className="mt-2 text-sm text-orange-600">
          ⚠️ Las persianas bloqueantes solo están disponibles con motor
        </p>
      )}
    </div>
  )
}

export default BlindTypeSelector