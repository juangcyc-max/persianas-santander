import { useState, useEffect } from 'react'

function MeasurementsForm({ productType, width, height, onWidthChange, onHeightChange, heightOnly = false }) {
  // sistema_mini_autoblocante: 700–5000; todos los demás: 300–3000
  const isBigSistema = productType === 'sistema_mini_autoblocante'
  const minSize = isBigSistema ? 701 : 301
  const maxSize = isBigSistema ? 5001 : 3001

  const clamp = (n) => Math.min(maxSize, Math.max(minSize, n))

  // Estado local de texto para permitir escritura libre
  const [widthText,  setWidthText]  = useState(String(width))
  const [heightText, setHeightText] = useState(String(height))

  // Sincronizar texto cuando el valor externo cambia (ej. slider)
  useEffect(() => { setWidthText(String(width))  }, [width])
  useEffect(() => { setHeightText(String(height)) }, [height])

  const handleBlur = (text, onChange) => {
    const n = Number(text)
    const final = isNaN(n) ? minSize : clamp(n)
    onChange(final)
  }

  const areaSqm        = (width / 1000) * (height / 1000)
  const areaSqmDisplay = areaSqm.toFixed(2)
  const MIN_SQM        = 1.5
  const billableSqm    = Math.max(areaSqm, MIN_SQM).toFixed(2)
  const belowMin       = areaSqm < MIN_SQM

  const measures = [
    {
      label:    'Ancho',
      unit:     'mm',
      value:    width,
      text:     widthText,
      setText:  setWidthText,
      onChange: onWidthChange,
      hint:     'Medida horizontal del hueco',
      hidden:   heightOnly,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12M8 12h4m0 0h4m-4 0v5m0-5V7" />
        </svg>
      ),
    },
    {
      label:    'Alto',
      unit:     'mm',
      value:    height,
      text:     heightText,
      setText:  setHeightText,
      onChange: onHeightChange,
      hint:     'Medida vertical del hueco',
      hidden:   false,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m-4-4l4 4 4-4M8 8l4-4 4 4" />
        </svg>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
          Medidas
        </h2>
        <a
          href="/tutorial-medidas.pdf"
          download="guia-medidas-persianas-santander.pdf"
          className="flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          Guía de medidas
        </a>
      </div>

      <div className="space-y-4">
        {measures.filter(m => !m.hidden).map(({ label, unit, value, text, setText, onChange, hint, icon }) => {
          const pct = Math.min(100, Math.max(0, ((value - minSize) / (maxSize - minSize)) * 100))
          return (
            <div key={label}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-gray-500">
                    {icon}
                  </div>
                  <label className="text-sm font-medium text-gray-700">{label}</label>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={text}
                    min={minSize}
                    max={maxSize}
                    step={1}
                    onChange={e => setText(e.target.value)}
                    onBlur={e => handleBlur(e.target.value, onChange)}
                    className="w-20 text-right px-2 py-1 rounded-lg border border-gray-300 text-sm font-bold text-gray-900
                               focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white"
                  />
                  <span className="text-xs text-gray-400 w-5">{unit}</span>
                </div>
              </div>

              <div className="relative">
                <input
                  type="range"
                  min={minSize}
                  max={maxSize}
                  step={1}
                  value={value}
                  onChange={e => onChange(clamp(Number(e.target.value)))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-gray-200
                             [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                             [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-600
                             [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer
                             [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
                  style={{
                    background: `linear-gradient(to right, #dc2626 0%, #dc2626 ${pct}%, #e5e7eb ${pct}%, #e5e7eb 100%)`
                  }}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-300">{minSize}</span>
                  <span className="text-xs text-gray-400">{hint}</span>
                  <span className="text-xs text-gray-300">{maxSize}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!heightOnly && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              Superficie introducida
            </div>
            <span className="font-bold text-gray-900 text-sm">{areaSqmDisplay} m²</span>
          </div>

          {belowMin && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Pedido mínimo 1,5 m²
              </div>
              <span className="font-bold text-amber-800 text-sm">{billableSqm} m²</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default MeasurementsForm
