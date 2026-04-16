function BlindPreview({ boxColor, slatColor, width, blindType }) {
  const maskStyle = (src) => ({
    maskImage:          `url(${src})`,
    maskSize:           'contain',
    maskRepeat:         'no-repeat',
    maskPosition:       'center',
    WebkitMaskImage:    `url(${src})`,
    WebkitMaskSize:     'contain',
    WebkitMaskRepeat:   'no-repeat',
    WebkitMaskPosition: 'center',
  })

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">

      {/* Cabecera */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Vista previa</h2>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            ['blocking', 'autoblocante', 'sistema_mini_autoblocante'].includes(blindType)
              ? 'bg-gray-900 text-white'
              : ['sistema_mini_cajon_pvc','sistema_mini_cajon_aluminio'].includes(blindType)
              ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {({'laminada':'Paño laminado','autoblocante':'Autoblocante','blocking':'Bloqueante','sistema_mini_cajon_pvc':'Sistema Mini Cajón PVC','sistema_mini_cajon_aluminio':'Sistema Mini Cajón Aluminio','sistema_mini_autoblocante':'Sistema Mini Autoblocante','solo_guias':'Solo guías','solo_motor':'Solo motor','mosquitera_enrollable':'Mosquitera Enrollable'})[blindType] ?? blindType ?? 'Estándar'}
          </span>
          <span className="text-xs text-gray-400">{width} mm</span>
        </div>
      </div>

      {/* Imagen real con color */}
      <div className="relative w-full rounded-lg overflow-hidden" style={{ aspectRatio: '2000 / 1090', background: '#f8f8f6' }}>

        {/* Capa 1: color lamas — recortado a la forma de la persiana completa */}
        <div
          className="absolute inset-0 transition-colors duration-500"
          style={{ backgroundColor: slatColor, ...maskStyle('/persianacompleta.png') }}
        />

        {/* Capa 2: color caja — recortado a la forma de la caja */}
        <div
          className="absolute inset-0 transition-colors duration-500"
          style={{ backgroundColor: boxColor, ...maskStyle('/caja.png') }}
        />

        {/* Capa 3: imagen persiana con multiply para texturas y sombras */}
        <img
          src="/persianacompleta.png"
          alt="Vista previa persiana"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          draggable={false}
          style={{ mixBlendMode: 'multiply' }}
        />

        {/* Capa 4: guías con multiply para texturas — encima de la persiana */}
        <img
          src="/guias.png"
          alt=""
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          draggable={false}
          style={{ mixBlendMode: 'multiply' }}
        />

        {/* Capa 5: color guías — encima de todas las imágenes */}
        <div
          className="absolute inset-0 transition-colors duration-500"
          style={{ backgroundColor: boxColor, ...maskStyle('/guias.png') }}
        />
      </div>

      {/* Chips de color */}
      <div className="flex gap-2 mt-4">
        <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
          <div className="w-4 h-4 rounded border border-gray-200 flex-shrink-0" style={{ backgroundColor: boxColor }} />
          <span className="text-xs text-gray-500 truncate">Caja</span>
        </div>
        <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
          <div className="w-4 h-4 rounded border border-gray-200 flex-shrink-0" style={{ backgroundColor: slatColor }} />
          <span className="text-xs text-gray-500 truncate">Lamas</span>
        </div>
      </div>
    </div>
  )
}

export default BlindPreview