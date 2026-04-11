// Diagrama SVG perfil V25
function DiagramV25() {
  return (
    <svg width="54" height="44" viewBox="0 0 54 44" className="text-current">
      <rect x="2" y="2" width="50" height="30" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <polyline points="8,8 27,26 46,8" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="2" y1="38" x2="52" y2="38" stroke="currentColor" strokeWidth="1"/>
      <line x1="2" y1="35" x2="2" y2="41" stroke="currentColor" strokeWidth="1"/>
      <line x1="52" y1="35" x2="52" y2="41" stroke="currentColor" strokeWidth="1"/>
      <text x="27" y="43" textAnchor="middle" fontSize="8" fill="currentColor">25 mm</text>
    </svg>
  )
}

// Diagrama SVG perfil H25
function DiagramH25() {
  return (
    <svg width="54" height="44" viewBox="0 0 54 44" className="text-current">
      <line x1="14" y1="3" x2="14" y2="33" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/>
      <line x1="40" y1="3" x2="40" y2="33" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/>
      <line x1="14" y1="18" x2="40" y2="18" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="2" y1="38" x2="52" y2="38" stroke="currentColor" strokeWidth="1"/>
      <line x1="2" y1="35" x2="2" y2="41" stroke="currentColor" strokeWidth="1"/>
      <line x1="52" y1="35" x2="52" y2="41" stroke="currentColor" strokeWidth="1"/>
      <text x="27" y="43" textAnchor="middle" fontSize="8" fill="currentColor">25 mm</text>
    </svg>
  )
}

// mode: 'optional'  → paños, puede elegir sin guías / V25 / H25 (con coste)
// mode: 'included'  → sistemas, elige V25 o H25 (incluidas, sin coste extra)
// mode: 'product'   → solo guías, elige tipo (es el producto en sí)
function GuideSelector({ mode = 'optional', guideType, onGuideTypeChange, installacion, onInstallacionChange, height, showInstallation = true }) {
  const h = parseFloat(height) || 0
  const guideMeters = (2 * h / 1000).toFixed(2)
  const v25Total = (2 * (h / 1000) * 5).toFixed(2)
  const h25Total = (2 * (h / 1000) * 7).toFixed(2)

  const isIncluded = mode === 'included'
  const isProduct  = mode === 'product'
  const showCost   = !isIncluded && !isProduct

  const guides = [
    {
      id: 'v25',
      title: 'Guía modelo V25',
      subtitle: showCost ? '5 €/ml' : (isIncluded ? 'Incluida' : '5 €/ml'),
      desc: showCost
        ? `Perfil en V, 25 mm. ${guideMeters} ml × 2 guías × 5 €/ml = ${v25Total} €`
        : `Perfil en V, 25 mm. ${guideMeters} ml total (2 guías).`,
      diagram: <DiagramV25 />,
    },
    {
      id: 'h25',
      title: 'Guía modelo H25',
      subtitle: showCost ? '7 €/ml' : (isIncluded ? 'Incluida' : '7 €/ml'),
      desc: showCost
        ? `Perfil en H, 25 mm. Mayor sujeción lateral. ${guideMeters} ml × 2 guías × 7 €/ml = ${h25Total} €`
        : `Perfil en H, 25 mm. Mayor sujeción lateral. ${guideMeters} ml total (2 guías).`,
      diagram: <DiagramH25 />,
    },
  ]

  const sectionTitle = isProduct
    ? 'Tipo de guía'
    : isIncluded
    ? 'Guías incluidas — elige tipo'
    : 'Guías laterales'

  return (
    <div>
      <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-1">
        {sectionTitle}
      </h2>

      {isIncluded && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 mb-3">
          Las guías están incluidas en el precio del sistema. Elige el tipo que prefieres.
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 mt-2">
        {/* Opción sin guías — solo en modo opcional */}
        {mode === 'optional' && (
          <button
            onClick={() => onGuideTypeChange('none')}
            className={`p-3 rounded-xl border-2 text-left transition-all ${
              guideType === 'none'
                ? 'border-red-600 bg-red-50'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-14 h-11 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                guideType === 'none' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'
              }`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-bold text-sm ${guideType === 'none' ? 'text-red-700' : 'text-gray-900'}`}>
                    Sin guías
                  </p>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                    guideType === 'none' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    —
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Solo el paño, sin guías laterales</p>
              </div>
              {guideType === 'none' && (
                <div className="w-4 h-4 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        )}

        {guides.map(({ id, title, subtitle, desc, diagram }) => {
          const active = guideType === id
          return (
            <button
              key={id}
              onClick={() => onGuideTypeChange(id)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                active
                  ? 'border-red-600 bg-red-50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-1 flex-shrink-0 transition-colors ${
                  active ? 'text-red-600 bg-red-100' : 'text-gray-400 bg-gray-100'
                }`}>
                  {diagram}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-bold text-sm ${active ? 'text-red-700' : 'text-gray-900'}`}>
                      {title}
                    </p>
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                      active ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {subtitle}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{desc}</p>
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

      {/* Instalación */}
      {showInstallation && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">
            Instalación
          </h2>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onInstallacionChange(true)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                installacion
                  ? 'border-red-600 bg-red-50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-colors ${
                installacion ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className={`text-xs font-bold ${installacion ? 'text-red-700' : 'text-gray-900'}`}>
                Con instalación
              </p>
              <p className="text-xs text-gray-400 mt-0.5">+100 €/m²</p>
            </button>

            <button
              onClick={() => onInstallacionChange(false)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                !installacion
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-colors ${
                !installacion ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className={`text-xs font-bold ${!installacion ? 'text-amber-700' : 'text-gray-900'}`}>
                Sin instalación
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Solo material</p>
            </button>
          </div>

          {!installacion && (
            <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2.5">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-amber-800 font-medium leading-snug">
                AVISO: Sin instalación no nos hacemos responsables si se toman mal las medidas. Asegúrese de medir correctamente antes de confirmar el pedido.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default GuideSelector
