import { useState } from 'react'

const GAMA_ORDER = ['Grupo Base', 'Grupo 1', 'Grupo 2', 'Grupo 3']

const GAMA_STYLE = {
  'Grupo Base': { label: 'Base',    dot: '#D4C89A' },
  'Grupo 1':    { label: 'Grupo 1', dot: '#6B9E6B' },
  'Grupo 2':    { label: 'Grupo 2', dot: '#6B8DB5' },
  'Grupo 3':    { label: 'Grupo 3', dot: '#C4874A' },
}

function ColorPicker({ label, selectedColor, onColorChange, colors }) {
  const selectedColor_ = colors.find(c => c.hex === selectedColor)
  const selectedName   = selectedColor_?.name ?? '—'
  const selectedIsWood = selectedColor_?.wood ?? false
  const selectedGama   = selectedColor_?.gama ?? null

  // By default, only the group that contains the selected color is open
  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {}
    GAMA_ORDER.forEach(g => { initial[g] = false })
    if (selectedGama) initial[selectedGama] = true
    else initial['Grupo Base'] = true
    return initial
  })

  const toggleGroup = (gama) => setOpenGroups(prev => ({ ...prev, [gama]: !prev[gama] }))

  const hexToLuma = (hex) => {
    try {
      const r = parseInt(hex.slice(1,3),16)
      const g = parseInt(hex.slice(3,5),16)
      const b = parseInt(hex.slice(5,7),16)
      return (r*299 + g*587 + b*114) / 1000
    } catch { return 128 }
  }

  const woodGrain = (hex) => {
    const r = parseInt(hex.slice(1,3),16)
    const g = parseInt(hex.slice(3,5),16)
    const b = parseInt(hex.slice(5,7),16)
    const vd = `rgba(${Math.max(0,r-75)},${Math.max(0,g-60)},${Math.max(0,b-42)},0.95)`
    const dk = `rgba(${Math.max(0,r-50)},${Math.max(0,g-40)},${Math.max(0,b-28)},0.85)`
    const lt = `rgba(${Math.min(255,r+50)},${Math.min(255,g+40)},${Math.min(255,b+25)},0.75)`
    const vl = `rgba(${Math.min(255,r+70)},${Math.min(255,g+56)},${Math.min(255,b+35)},0.55)`
    return [
      `repeating-linear-gradient(96deg, transparent 0px, ${dk} 1px, transparent 2px, transparent 6px)`,
      `repeating-linear-gradient(98deg, transparent 0px, ${vd} 1px, ${dk} 2.5px, transparent 4px, transparent 13px)`,
      `repeating-linear-gradient(94deg, transparent 0px, transparent 5px, ${lt} 6px, ${vl} 7px, transparent 8.5px, transparent 20px)`,
      `linear-gradient(97deg, rgba(${Math.max(0,r-30)},${Math.max(0,g-24)},${Math.max(0,b-16)},1) 0%, ${hex} 40%, rgba(${Math.max(0,r-20)},${Math.max(0,g-16)},${Math.max(0,b-10)},1) 100%)`
    ].join(', ')
  }

  const groups = GAMA_ORDER
    .map(gama => ({ gama, items: colors.filter(c => c.gama === gama) }))
    .filter(g => g.items.length > 0)

  return (
    <div>
      {/* Header con color seleccionado */}
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-bold text-gray-900 uppercase tracking-wide">
          {label}
        </label>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
          <div
            className="w-4 h-4 rounded border border-gray-200 shadow-sm flex-shrink-0"
            style={selectedIsWood ? { background: woodGrain(selectedColor) } : { backgroundColor: selectedColor }}
          />
          <span className="text-xs font-semibold text-gray-700 max-w-[90px] truncate">
            {selectedName}
          </span>
          {selectedColor_?.gama && (
            <span className="text-xs text-gray-400 border-l border-gray-200 pl-2">
              {selectedColor_.gama}
            </span>
          )}
        </div>
      </div>

      {/* Grupos de colores — colapsables */}
      <div className="space-y-1.5">
        {groups.map(({ gama, items }) => {
          const style    = GAMA_STYLE[gama] ?? { label: gama, dot: '#999' }
          const isOpen   = openGroups[gama] ?? false
          const hasSelected = items.some(c => c.hex === selectedColor)

          return (
            <div key={gama} className={`rounded-xl border transition-colors ${hasSelected && !isOpen ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
              {/* Cabecera del grupo — clickable */}
              <button
                type="button"
                onClick={() => toggleGroup(gama)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left"
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: style.dot }} />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex-1">
                  {style.label}
                  <span className="ml-1.5 text-gray-400 font-normal normal-case tracking-normal">({items.length})</span>
                </span>
                {hasSelected && !isOpen && (() => {
                  const sel = items.find(c => c.hex === selectedColor)
                  return (
                    <div className="flex items-center gap-1 mr-2">
                      <div className="w-3 h-3 rounded-sm border border-gray-200" style={{ backgroundColor: selectedColor }} />
                      <span className="text-xs text-red-600 font-medium">{sel?.name}</span>
                    </div>
                  )
                })()}
                <svg
                  className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Chips de color */}
              {isOpen && (
                <div className="grid grid-cols-6 gap-1.5 px-3 pb-3">
                  {items.map((color) => {
                    const isSelected = selectedColor === color.hex
                    const isLight    = hexToLuma(color.hex) > 210

                    return (
                      <button
                        key={color.name}
                        onClick={() => onColorChange(color.hex)}
                        title={`${color.name} · ${color.gama}`}
                        className={`
                          relative aspect-square w-full rounded-lg transition-all duration-150
                          ${isSelected
                            ? 'ring-2 ring-offset-1 ring-red-600 scale-110 shadow-md'
                            : 'hover:scale-105 hover:shadow-sm'
                          }
                          ${isLight ? 'border border-gray-200' : ''}
                        `}
                        style={color.wood ? { background: woodGrain(color.hex) } : { backgroundColor: color.hex }}
                      >
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-lg">
                            <div
                              className="w-3 h-3 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: hexToLuma(color.hex) > 128 ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.9)' }}
                            >
                              <svg className="w-2 h-2" fill="none"
                                stroke={hexToLuma(color.hex) > 128 ? 'white' : '#374151'}
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 mt-2.5">
        {colors.length} colores · Colección ACEPER
      </p>
    </div>
  )
}

export default ColorPicker
