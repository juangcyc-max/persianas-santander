function MeasurementsForm({ width, height, depth, onWidthChange, onHeightChange, onDepthChange }) {
  const measures = [
    {
      label: 'Ancho',
      unit: 'mm',
      value: width,
      onChange: onWidthChange,
      min: 500,
      max: 3000,
      step: 10,
      hint: 'Medida horizontal del hueco',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12M8 12h4m0 0h4m-4 0v5m0-5V7" />
        </svg>
      ),
    },
    {
      label: 'Alto',
      unit: 'mm',
      value: height,
      onChange: onHeightChange,
      min: 500,
      max: 3000,
      step: 10,
      hint: 'Medida vertical del hueco',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m-4-4l4 4 4-4M8 8l4-4 4 4" />
        </svg>
      ),
    },
    {
      label: 'Fondo de caja',
      unit: 'mm',
      value: depth,
      onChange: onDepthChange,
      min: 100,
      max: 300,
      step: 5,
      hint: 'Profundidad de la caja enrolladora',
      surcharge: depth > 200,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      ),
    },
  ]

  const handleInput = (val, min, max, onChange) => {
    const n = Number(val)
    if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
  }

  // Cálculo del área en m²
  const areaSqm = ((width / 1000) * (height / 1000)).toFixed(2)

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
        {measures.map(({ label, unit, value, onChange, min, max, step, hint, surcharge, icon }) => {
          const pct = ((value - min) / (max - min)) * 100
          return (
            <div key={label}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-gray-500">
                    {icon}
                  </div>
                  <label className="text-sm font-medium text-gray-700">{label}</label>
                  {surcharge && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                      +coste
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={value}
                    onChange={e => handleInput(e.target.value, min, max, onChange)}
                    min={min}
                    max={max}
                    step={step}
                    className="w-20 text-right px-2 py-1 rounded-lg border border-gray-300 text-sm font-bold text-gray-900
                               focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white"
                  />
                  <span className="text-xs text-gray-400 w-5">{unit}</span>
                </div>
              </div>

              {/* Slider */}
              <div className="relative">
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={value}
                  onChange={e => onChange(Number(e.target.value))}
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
                  <span className="text-xs text-gray-300">{min}</span>
                  <span className="text-xs text-gray-400">{hint}</span>
                  <span className="text-xs text-gray-300">{max}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Resumen de área */}
      <div className="mt-4 flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          Superficie total
        </div>
        <span className="font-bold text-gray-900 text-sm">{areaSqm} m²</span>
      </div>

      {depth > 200 && (
        <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-amber-700">
            Fondo mayor de 200 mm. Se aplica un suplemento de <strong>0,50 €</strong> por cada mm adicional.
          </p>
        </div>
      )}
    </div>
  )
}

export default MeasurementsForm