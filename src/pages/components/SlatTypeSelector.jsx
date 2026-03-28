function SlatTypeSelector({ slatType, onSlatTypeChange }) {
  const types = [
    {
      id: 'normal',
      label: 'Normal',
      subtitle: 'Uso residencial',
      features: ['Aluminio extrusionado', 'Aislamiento térmico básico', 'Ancho de lama 52 mm'],
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 10h18M3 14h18M3 6h18M3 18h18" />
        </svg>
      ),
    },
    {
      id: 'seguridad',
      label: 'Seguridad',
      subtitle: 'Alta protección',
      badge: '+30% precio',
      features: ['Acero + aluminio', 'Anti-palanca certificado', 'Ancho de lama 62 mm'],
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
        Tipo de lamas
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {types.map(({ id, label, subtitle, badge, features, icon }) => {
          const active = slatType === id
          return (
            <button
              key={id}
              onClick={() => onSlatTypeChange(id)}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                active
                  ? 'border-red-600 bg-red-50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {badge && (
                <span className="absolute top-2.5 right-2.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                  {badge}
                </span>
              )}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                active ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {icon}
              </div>
              <p className={`font-bold text-sm mb-0.5 ${active ? 'text-red-700' : 'text-gray-900'}`}>
                {label}
              </p>
              <p className="text-xs text-gray-400 mb-2">{subtitle}</p>
              <ul className="space-y-1">
                {features.map(f => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? 'bg-red-400' : 'bg-gray-300'}`} />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default SlatTypeSelector
