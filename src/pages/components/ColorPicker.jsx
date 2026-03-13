function ColorPicker({ label, selectedColor, onColorChange, colors }) {
  return (
    <div>
      <label className="block text-gray-700 mb-3 font-medium">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <button
            key={color.name}
            onClick={() => onColorChange(color.hex)}
            className={`w-10 h-10 rounded-lg border-2 transition-all ${
              selectedColor === color.hex 
                ? 'border-santander-red scale-110' 
                : 'border-gray-300'
            }`}
            style={{ backgroundColor: color.hex }}
            title={color.name}
          />
        ))}
      </div>
      <p className="text-sm text-gray-500 mt-2">
        Seleccionado: {colors.find(c => c.hex === selectedColor)?.name}
      </p>
    </div>
  )
}

export default ColorPicker