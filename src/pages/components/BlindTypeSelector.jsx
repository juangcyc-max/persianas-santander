function BlindTypeSelector({ blindType, onTypeChange }) {
  // blindType aquí es productType: 'laminada' | 'autoblocante' | 'sistema_mini'
  const types = [
    {
      id: 'laminada',
      title: 'Paño Laminada',
      subtitle: 'Con o sin cajón',
      desc: 'Persiana laminada de aluminio. Configurable con cajón mini aluminio, PVC o sin cajón.',
      sizes: '300 – 3.000 mm',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      ),
    },
    {
      id: 'autoblocante',
      title: 'Paño Autoblocante',
      subtitle: 'Solo con motor',
      desc: 'Alta seguridad anti-levantamiento certificado. Ideal para plantas bajas y accesos.',
      sizes: '300 – 3.000 mm',
      badge: 'Alta seguridad',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
    {
      id: 'sistema_mini',
      title: 'Sistema Mini Autoblocante',
      subtitle: 'Cajón mini + lamas autoblocantes',
      desc: 'Sistema completo con cajón mini integrado y lamas autoblocantes de alta resistencia.',
      sizes: '700 – 5.000 mm',
      badge: 'Alta seguridad',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
  ]

  return (
    <div>
      <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">
        Tipo de persiana
      </h2>

      <div className="grid grid-cols-1 gap-3">
        {types.map(({ id, title, subtitle, desc, sizes, badge, icon }) => {
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
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                  active ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0 pr-8">
                  <p className={`font-bold text-sm mb-0.5 ${active ? 'text-red-700' : 'text-gray-900'}`}>
                    {title}
                  </p>
                  <p className="text-xs text-gray-400 mb-1">{subtitle}</p>
                  <p className="text-xs text-gray-500 leading-snug">{desc}</p>
                  <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    {sizes}
                  </p>
                </div>
              </div>
              {active && !badge && (
                <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-red-600 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {(blindType === 'autoblocante' || blindType === 'sistema_mini') && (
        <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-amber-700">
            Este tipo de persiana requiere motor. El mecanismo se ajustará automáticamente.
          </p>
        </div>
      )}
    </div>
  )
}

export default BlindTypeSelector
