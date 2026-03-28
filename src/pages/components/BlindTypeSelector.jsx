function BlindTypeSelector({ blindType, onTypeChange }) {
  const types = [
    {
      id: 'normal',
      title: 'Estándar',
      subtitle: 'Muelle, cinta o motor',
      desc: 'Uso residencial y comercial. La opción más versátil.',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      ),
    },
    {
      id: 'blocking',
      title: 'Bloqueante',
      subtitle: 'Solo con motor',
      desc: 'Anti-levantamiento certificado. Ideal para plantas bajas.',
      badge: 'Alta seguridad',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
  ]

  return (
    <div>
      <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">
        Tipo de persiana
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {types.map(({ id, title, subtitle, desc, badge, icon }) => {
          const active = blindType === id
          return (
            <button
              key={id}
              onClick={() => onTypeChange(id)}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                active
                  ? 'border-red-600 bg-red-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {badge && (
                <span className="absolute top-2.5 right-2.5 text-xs font-bold bg-gray-900 text-white px-1.5 py-0.5 rounded-full">
                  {badge}
                </span>
              )}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                active ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {icon}
              </div>
              <p className={`font-bold text-sm mb-0.5 ${active ? 'text-red-700' : 'text-gray-900'}`}>
                {title}
              </p>
              <p className="text-xs text-gray-400 mb-1">{subtitle}</p>
              <p className="text-xs text-gray-500 leading-snug hidden sm:block">{desc}</p>

              {active && (
                <div className="absolute top-2.5 right-2.5">
                  {!badge && (
                    <div className="w-4 h-4 rounded-full bg-red-600 flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {blindType === 'blocking' && (
        <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-amber-700">
            Las persianas bloqueantes requieren motor. El mecanismo se ajustará automáticamente.
          </p>
        </div>
      )}
    </div>
  )
}

export default BlindTypeSelector
