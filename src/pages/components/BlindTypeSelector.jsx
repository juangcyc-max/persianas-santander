const PANO_ICON = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12h18M3 6h18M3 18h18" />
  </svg>
)

const SISTEMA_ICON = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M5 3h14a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm0 10h14a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4a2 2 0 012-2z" />
  </svg>
)

const SISTEMA_TYPES = ['sistema_mini_cajon_pvc', 'sistema_mini_cajon_aluminio', 'sistema_mini_autoblocante']
const PANO_TYPES   = ['laminada', 'autoblocante']

const PRODUCTOS_INDIVIDUALES = [
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
]

function BlindTypeSelector({ blindType, onTypeChange }) {
  const isPano    = PANO_TYPES.includes(blindType)
  const isSistema = SISTEMA_TYPES.includes(blindType)

  return (
    <div>
      <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">
        Tipo de producto
      </h2>

      <div className="space-y-4">

        {/* ── Paños de persiana — botón combinado ── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Paños de persiana</p>
          <button
            onClick={() => { if (!isPano) onTypeChange('laminada') }}
            className={`relative w-full p-3 rounded-xl border-2 text-left transition-all ${
              isPano ? 'border-red-600 bg-red-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                isPano ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {PANO_ICON}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm mb-0.5 ${isPano ? 'text-red-700' : 'text-gray-900'}`}>
                  Paño de Persiana
                </p>
                {!isPano && <p className="text-xs text-gray-400">Laminado o autoblocante · Guías opcionales</p>}
                {isPano && (
                  <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => onTypeChange('laminada')}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                        blindType === 'laminada' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-300 hover:border-red-300'
                      }`}
                    >Laminado</button>
                    <button
                      onClick={() => onTypeChange('autoblocante')}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                        blindType === 'autoblocante' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-300 hover:border-red-300'
                      }`}
                    >Autoblocante</button>
                  </div>
                )}
              </div>
              {isPano && (
                <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-red-600 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        </div>

        {/* ── Sistemas completos — botón combinado ── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sistemas completos</p>
          <button
            onClick={() => { if (!isSistema) onTypeChange('sistema_mini_cajon_pvc') }}
            className={`relative w-full p-3 rounded-xl border-2 text-left transition-all ${
              isSistema ? 'border-red-600 bg-red-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                isSistema ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {SISTEMA_ICON}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm mb-0.5 ${isSistema ? 'text-red-700' : 'text-gray-900'}`}>
                  Sistema Mini Cajón
                </p>
                {!isSistema && <p className="text-xs text-gray-400">Cajón PVC, Aluminio o Autoblocante · Guías opcionales</p>}
                {isSistema && (
                  <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => onTypeChange('sistema_mini_cajon_pvc')}
                      className={`flex-1 py-1.5 px-1 rounded-lg text-xs font-semibold border transition-all ${
                        blindType === 'sistema_mini_cajon_pvc' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-300 hover:border-red-300'
                      }`}
                    >PVC</button>
                    <button
                      onClick={() => onTypeChange('sistema_mini_cajon_aluminio')}
                      className={`flex-1 py-1.5 px-1 rounded-lg text-xs font-semibold border transition-all ${
                        blindType === 'sistema_mini_cajon_aluminio' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-300 hover:border-red-300'
                      }`}
                    >Aluminio</button>
                    <button
                      onClick={() => onTypeChange('sistema_mini_autoblocante')}
                      className={`flex-1 py-1.5 px-1 rounded-lg text-xs font-semibold border transition-all ${
                        blindType === 'sistema_mini_autoblocante' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-300 hover:border-red-300'
                      }`}
                    >Autoblocante</button>
                  </div>
                )}
              </div>
              {isSistema && (
                <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-red-600 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        </div>

        {/* ── Productos individuales ── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Productos individuales</p>
          <div className="grid grid-cols-1 gap-2">
            {PRODUCTOS_INDIVIDUALES.map(({ id, title, subtitle, desc, sizes, icon }) => {
              const active = blindType === id
              return (
                <button
                  key={id}
                  onClick={() => onTypeChange(id)}
                  className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                    active ? 'border-red-600 bg-red-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                      active ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <p className={`font-bold text-sm mb-0.5 ${active ? 'text-red-700' : 'text-gray-900'}`}>{title}</p>
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
                  {active && (
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
      </div>

      {/* Banners informativos */}
      {blindType === 'autoblocante' && (
        <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-xs text-blue-700">Motor obligatorio para el paño autoblocante.</p>
        </div>
      )}
      {['sistema_mini_cajon_pvc', 'sistema_mini_cajon_aluminio'].includes(blindType) && (
        <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-amber-700">Sistema completo con cajón. Mecanismo libre (muelle, cinta o motor). Guías V25/H25 opcionales con precio por metro lineal.</p>
        </div>
      )}
      {blindType === 'sistema_mini_autoblocante' && (
        <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-amber-700">Sistema completo con cajón. Motor obligatorio. Guías V25/H25 opcionales con precio por metro lineal.</p>
        </div>
      )}
      {blindType === 'mosquitera_enrollable' && (
        <div className="mt-3 flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
          <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-green-700">Disponible en colores Grupo Base. Mecanismo muelle o cinta (sin motor). Sin guías.</p>
        </div>
      )}
    </div>
  )
}

export default BlindTypeSelector
