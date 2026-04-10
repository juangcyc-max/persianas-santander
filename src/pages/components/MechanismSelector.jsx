function MechanismSelector({ productType, mechanism, onMechanismChange, orientation, onOrientationChange }) {
  const requiresMotor = productType === 'autoblocante' || productType === 'sistema_mini'

  const mechanisms = [
    {
      id: 'muelle',
      label: 'Muelle',
      detail: 'Retorno automático',
      disabled: requiresMotor,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
    },
    {
      id: 'cinta',
      label: 'Cinta',
      detail: 'Manual con tirador',
      disabled: requiresMotor,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      ),
    },
    {
      id: 'motor',
      label: 'Motor',
      detail: 'Automatizado',
      badge: requiresMotor ? 'Requerido' : null,
      showBadge: requiresMotor,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
  ]

  return (
    <div>
      <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">
        Mecanismo
      </h2>

      <div className="grid grid-cols-3 gap-2">
        {mechanisms.map(({ id, label, detail, disabled, showBadge, icon }) => {
          const active = mechanism === id
          return (
            <button
              key={id}
              onClick={() => !disabled && onMechanismChange(id)}
              disabled={disabled}
              className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                active
                  ? 'border-red-600 bg-red-50'
                  : disabled
                  ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-colors ${
                active ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {icon}
              </div>
              <p className={`text-xs font-bold ${active ? 'text-red-700' : 'text-gray-800'}`}>{label}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-tight">{detail}</p>
              {showBadge && (
                <span className="absolute -top-1.5 -right-1.5 text-xs bg-gray-900 text-white px-1 py-0.5 rounded-full font-bold leading-none">
                  ✓
                </span>
              )}
            </button>
          )
        })}
      </div>

      {requiresMotor && (
        <div className="mt-2 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-xs text-blue-700">Motor obligatorio para este tipo de persiana.</p>
        </div>
      )}

      {/* Orientación (solo si cinta) */}
      {mechanism === 'cinta' && (
        <div className="mt-4">
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
            Lado de la cinta
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'izquierda', label: 'Izquierda', arrow: '←' },
              { id: 'derecha',   label: 'Derecha',   arrow: '→' },
            ].map(({ id, label, arrow }) => (
              <button
                key={id}
                onClick={() => onOrientationChange(id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                  orientation === id
                    ? 'border-red-600 bg-red-50 text-red-700'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="text-base">{arrow}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default MechanismSelector
