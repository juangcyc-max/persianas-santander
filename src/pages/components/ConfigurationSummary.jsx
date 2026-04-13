const SISTEMAS = ['sistema_mini_pvc', 'sistema_mini_aluminio', 'sistema_mini_autoblocante']
const isSistema = (type) => SISTEMAS.includes(type)

function ConfigurationSummary({
  productType, guideType, installacion,
  mechanism, orientation, motorType,
  width, height,
  boxColor, slatColor,
  winchesterColors,
}) {
  const getColor = (hex) => winchesterColors.find(c => c.hex === hex) ?? { name: hex, gama: null }

  const productLabels = {
    laminada:                  'Paño Laminado',
    autoblocante:              'Paño Autoblocante',
    blocking:                  'Bloqueante',
    sistema_mini_pvc:          'Sistema Mini PVC',
    sistema_mini_aluminio:     'Sistema Mini Aluminio',
    sistema_mini_autoblocante: 'Sistema Mini Autoblocante',
    solo_motor:                'Solo Motor',
    solo_guias:                'Solo Guías',
    motor_mas_guias:           'Motor + Guías',
    pano_mas_guias:            'Paño + Guías',
    normal:                    'Estándar',
  }
  const guideLabels = {
    none: 'Sin guías',
    v25:  'Guía V25 (5 €/ml)',
    h25:  'Guía H25 (7 €/ml)',
  }
  const guideLabelsIncluded = {
    v25: 'Guía V25 (incluida)',
    h25: 'Guía H25 (incluida)',
  }
  const mechanismLabels = {
    muelle: 'Muelle',
    cinta:  'Cinta manual',
    motor:  'Motor',
  }
  const motorLabels = {
    mecanico:        'Mecánico (120 €)',
    mando_distancia: 'Mando a distancia (260 €)',
  }

  const INDIVIDUAL = ['solo_motor', 'solo_guias', 'motor_mas_guias', 'pano_mas_guias']
  const isSolo     = INDIVIDUAL.includes(productType)
  const isSoloMoto = productType === 'solo_motor'
  const isSoloGuia = productType === 'solo_guias' || productType === 'motor_mas_guias' || productType === 'pano_mas_guias'
  const sistema    = isSistema(productType)

  const guideValue = sistema
    ? (guideLabelsIncluded[guideType] ?? guideType)
    : (guideLabels[guideType] ?? 'Sin guías')

  const rows = [
    {
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12h18M3 6h18M3 18h18" />,
      label: 'Tipo producto',
      value: productLabels[productType] ?? productType,
    },
    !isSolo && {
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />,
      label: 'Mecanismo',
      value: mechanismLabels[mechanism] ?? mechanism,
    },
    !isSolo && mechanism === 'cinta' && {
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />,
      label: 'Lado cinta',
      value: orientation === 'izquierda' ? 'Izquierda' : 'Derecha',
    },
    (mechanism === 'motor' || isSoloMoto) && {
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />,
      label: 'Motor',
      value: motorLabels[motorType] ?? motorType,
    },
    !isSoloMoto && {
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />,
      label: 'Guías',
      value: guideValue,
    },
    !isSolo && {
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />,
      label: 'Instalación',
      value: installacion ? 'Con instalación (+100 €/m²)' : 'Sin instalación',
    },
    !isSoloMoto && {
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />,
      label: isSoloGuia ? 'Altura' : 'Medidas',
      value: isSoloGuia ? `${height} mm` : `${width} × ${height} mm`,
    },
  ].filter(Boolean)

  // Colores a mostrar
  const showBoxColor  = isSistema(productType)
  const showSlatColor = productType !== 'solo_motor'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Resumen</h2>
      </div>

      <div className="divide-y divide-gray-100">
        {rows.map(({ icon, label, value }) => (
          <div key={label} className="flex items-center gap-3 px-5 py-3">
            <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {icon}
              </svg>
            </div>
            <span className="text-sm text-gray-500 flex-1">{label}</span>
            <span className="text-sm font-semibold text-gray-900 text-right">{value}</span>
          </div>
        ))}

        {/* Colores */}
        {(showBoxColor || showSlatColor) && (
          <div className="flex items-center gap-3 px-5 py-3">
            <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
            <span className="text-sm text-gray-500 flex-1">
              {showBoxColor && showSlatColor ? 'Colores' : 'Color'}
            </span>
            <div className="flex items-center gap-1.5">
              {showBoxColor && (() => {
                const c = getColor(boxColor)
                return (
                  <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-md px-2 py-1">
                    <div className="w-3 h-3 rounded-sm border border-gray-200 flex-shrink-0" style={{ backgroundColor: boxColor }} />
                    <span className="text-xs font-medium text-gray-700 max-w-[55px] truncate">{c.name}</span>
                    {c.gama && <span className="text-xs text-gray-400 border-l border-gray-200 pl-1 flex-shrink-0">{c.gama.replace('Grupo ', 'G').replace('Base', 'B')}</span>}
                  </div>
                )
              })()}
              {showSlatColor && (() => {
                const c = getColor(slatColor)
                return (
                  <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-md px-2 py-1">
                    <div className="w-3 h-3 rounded-sm border border-gray-200 flex-shrink-0" style={{ backgroundColor: slatColor }} />
                    <span className="text-xs font-medium text-gray-700 max-w-[55px] truncate">{c.name}</span>
                    {c.gama && <span className="text-xs text-gray-400 border-l border-gray-200 pl-1 flex-shrink-0">{c.gama.replace('Grupo ', 'G').replace('Base', 'B')}</span>}
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConfigurationSummary
