function SlatTypeSelector({ slatType, onSlatTypeChange, blindType }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Tipo de Lamas</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onSlatTypeChange('normal')}
          className={`p-4 rounded-lg border-2 transition-all ${
            slatType === 'normal' 
              ? 'border-santander-red bg-red-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <p className="font-semibold text-lg">🟦 Normal</p>
          <p className="text-sm text-gray-500 mt-1">Estándar para hogar</p>
        </button>

        <button
          onClick={() => onSlatTypeChange('seguridad')}
          className={`p-4 rounded-lg border-2 transition-all ${
            slatType === 'seguridad' 
              ? 'border-santander-red bg-red-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <p className="font-semibold text-lg">🔒 Seguridad</p>
          <p className="text-sm text-gray-500 mt-1">Protección extra</p>
        </button>
      </div>
    </div>
  )
}

export default SlatTypeSelector