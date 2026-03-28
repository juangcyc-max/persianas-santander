function ColorPicker({ label, selectedColor, onColorChange, colors }) {
  const selectedName = colors.find(c => c.hex === selectedColor)?.name ?? '—'

  const hexToLuma = (hex) => {
    try {
      const r = parseInt(hex.slice(1,3),16)
      const g = parseInt(hex.slice(3,5),16)
      const b = parseInt(hex.slice(5,7),16)
      return (r*299 + g*587 + b*114) / 1000
    } catch { return 128 }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <label className="text-sm font-bold text-gray-900 uppercase tracking-wide">
          {label}
        </label>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
          <div
            className="w-4 h-4 rounded border border-gray-200 shadow-sm flex-shrink-0"
            style={{ backgroundColor: selectedColor }}
          />
          <span className="text-xs font-medium text-gray-600 max-w-[120px] truncate">
            {selectedName}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-1.5">
        {colors.map((color) => {
          const isSelected = selectedColor === color.hex
          const isLight    = hexToLuma(color.hex) > 220

          return (
            <button
              key={color.name}
              onClick={() => onColorChange(color.hex)}
              title={color.name}
              className={`
                relative aspect-square w-full rounded-lg transition-all duration-150
                ${isSelected
                  ? 'ring-2 ring-offset-1 ring-red-600 scale-110 shadow-md'
                  : 'hover:scale-105 hover:shadow-sm'
                }
                ${isLight ? 'border border-gray-200' : ''}
              `}
              style={{ backgroundColor: color.hex }}
            >
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg">
                  <div
                    className="w-3 h-3 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: hexToLuma(color.hex) > 128 ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.9)' }}
                  >
                    <svg
                      className="w-2 h-2"
                      fill="none"
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

      <p className="text-xs text-gray-400 mt-2">
        {colors.length} colores disponibles · Colección Winchester
      </p>
    </div>
  )
}

export default ColorPicker
