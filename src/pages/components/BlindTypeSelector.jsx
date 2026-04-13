const GROUPS = [
  {
    label: 'Paños de persiana',
    types: [
      {
        id: 'laminada',
        title: 'Paño Laminado',
        subtitle: 'Mecanismo libre · Guías opcionales',
        desc: 'Paño de persiana laminada de aluminio. Guías V25/H25 opcionales.',
        sizes: '301 – 3.000 mm',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        ),
      },
      {
        id: 'autoblocante',
        title: 'Paño Autoblocante',
        subtitle: 'Solo motor · Alta seguridad · Guías opcionales',
        desc: 'Paño autoblocante anti-levantamiento certificado. Requiere motor. Guías opcionales.',
        sizes: '301 – 3.000 mm',
        badge: 'Alta seguridad',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        ),
      },
      {
        id: 'blocking',
        title: 'Bloqueante',
        subtitle: 'Solo motor · Máxima seguridad · Guías opcionales',
        desc: 'Persiana bloqueante de máxima seguridad. Requiere motor. Guías opcionales.',
        sizes: '301 – 3.000 mm',
        badge: 'Máx. seguridad',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Sistemas completos',
    types: [
      {
        id: 'sistema_mini_cajon_pvc',
        title: 'Sistema Mini Cajón PVC',
        subtitle: 'Cajón PVC · Muelle, cinta o motor · Guías opcionales',
        desc: 'Sistema completo con cajón mini de PVC integrado. Guías V25/H25 opcionales.',
        sizes: '301 – 3.000 mm',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M5 3h14a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm0 10h14a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4a2 2 0 012-2z" />
          </svg>
        ),
      },
      {
        id: 'sistema_mini_cajon_aluminio',
        title: 'Sistema Mini Cajón Aluminio',
        subtitle: 'Cajón aluminio · Muelle, cinta o motor · Guías opcionales',
        desc: 'Sistema completo con cajón mini de aluminio extrusionado. Guías V25/H25 opcionales.',
        sizes: '301 – 3.000 mm',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
      },
      {
        id: 'sistema_mini_autoblocante',
        title: 'Sistema Mini Autoblocante',
        subtitle: 'Solo motor · Alta seguridad · Guías opcionales',
        desc: 'Sistema completo con cajón mini y lamas autoblocantes de alta seguridad.',
        sizes: '700 – 5.000 mm',
        badge: 'Alta seguridad',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Productos individuales',
    types: [
      {
        id: 'mosquitera_enrollable',
        title: 'Mosquitera Enrollable',
        subtitle: 'Muelle o cinta · Sin motor',
        desc: 'Mosquitera enrollable de aluminio. Colores Grupo Base. Sin motor.',
        sizes: '301 – 3.000 mm',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        ),
      },
      {
        id: 'solo_motor',
        title: 'Solo Motor',
        subtitle: 'Mecánico o mando a distancia',
        desc: 'Compra únicamente el motor, sin persiana.',
        sizes: null,
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ),
      },
      {
        id: 'solo_guias',
        title: 'Solo Guías',
        subtitle: 'V25 o H25 · Precio por metro lineal',
        desc: 'Compra únicamente las guías laterales para tu persiana.',
        sizes: null,
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        ),
      },
    ],
  },
]

function BlindTypeSelector({ blindType, onTypeChange }) {
  return (
    <div>
      <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">
        Tipo de producto
      </h2>

      <div className="space-y-4">
        {GROUPS.map(({ label, types }) => (
          <div key={label}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
            <div className="grid grid-cols-1 gap-2">
              {types.map(({ id, title, subtitle, desc, sizes, badge, icon }) => {
                const active = blindType === id
                return (
                  <button
                    key={id}
                    onClick={() => onTypeChange(id)}
                    className={`relative p-3 rounded-xl border-2 text-left transition-all ${
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
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                        active ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <p className={`font-bold text-sm mb-0.5 ${active ? 'text-red-700' : 'text-gray-900'}`}>
                          {title}
                        </p>
                        <p className="text-xs text-gray-400 mb-0.5">{subtitle}</p>
                        <p className="text-xs text-gray-500 leading-snug">{desc}</p>
                        {sizes && (
                          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                            {sizes}
                          </p>
                        )}
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
          </div>
        ))}
      </div>

      {/* Banner motor obligatorio para bloqueantes */}
      {['autoblocante', 'blocking', 'sistema_mini_autoblocante'].includes(blindType) && (
        <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-xs text-blue-700">
            Motor obligatorio para este tipo de persiana.
          </p>
        </div>
      )}

      {/* Banner sistemas cajón (muelle/cinta/motor) */}
      {['sistema_mini_cajon_pvc', 'sistema_mini_cajon_aluminio'].includes(blindType) && (
        <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-amber-700">
            Sistema completo con cajón. Mecanismo libre (muelle, cinta o motor). Guías V25/H25 opcionales con precio por metro lineal.
          </p>
        </div>
      )}

      {/* Banner sistema autoblocante (motor obligatorio) */}
      {blindType === 'sistema_mini_autoblocante' && (
        <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-amber-700">
            Sistema completo con cajón. Motor obligatorio. Guías V25/H25 opcionales con precio por metro lineal.
          </p>
        </div>
      )}

      {/* Banner mosquitera: sin motor */}
      {blindType === 'mosquitera_enrollable' && (
        <div className="mt-3 flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
          <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-green-700">
            Disponible en colores Grupo Base. Mecanismo muelle o cinta (sin motor). Sin guías.
          </p>
        </div>
      )}
    </div>
  )
}

export default BlindTypeSelector
