function BoxTypeSelector({ boxType, onBoxTypeChange }) {
  const types = [
    {
      id: 'aluminio',
      title: 'Cajón mini aluminio',
      subtitle: 'Desde 105 €/m²',
      desc: 'Cajón de aluminio extrusionado. Alta durabilidad y acabado premium.',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      id: 'pvc',
      title: 'Cajón mini PVC',
      subtitle: 'Desde 100 €/m²',
      desc: 'Cajón de PVC resistente. Ligero y económico.',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M5 3h14a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm0 10h14a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4a2 2 0 012-2z" />
        </svg>
      ),
    },
    {
      id: 'sin_cajon',
      title: 'Sin cajón',
      subtitle: 'Solo el paño',
      desc: 'Únicamente el paño laminado, sin caja enrolladora.',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 6h18M3 10h18M3 14h18M3 18h18" />
        </svg>
      ),
    },
  ]

  return (
    <div>
      <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">
        Tipo de cajón
      </h2>

      <div className="grid grid-cols-1 gap-2">
        {types.map(({ id, title, subtitle, desc, icon }) => {
          const active = boxType === id
          return (
            <button
              key={id}
              onClick={() => onBoxTypeChange(id)}
              className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                active
                  ? 'border-red-600 bg-red-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                  active ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm ${active ? 'text-red-700' : 'text-gray-900'}`}>
                    {title}
                  </p>
                  <p className="text-xs text-gray-400">{subtitle}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
                {active && (
                  <div className="w-4 h-4 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default BoxTypeSelector
