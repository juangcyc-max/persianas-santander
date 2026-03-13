function MeasurementsForm({ width, height, depth, onWidthChange, onHeightChange, onDepthChange }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Medidas (mm)</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-gray-700 mb-2">Ancho (mm)</label>
          <input
            type="number"
            value={width}
            onChange={(e) => onWidthChange(Number(e.target.value))}
            className="input-field"
            min="500"
            max="3000"
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Alto (mm)</label>
          <input
            type="number"
            value={height}
            onChange={(e) => onHeightChange(Number(e.target.value))}
            className="input-field"
            min="500"
            max="3000"
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Fondo (mm)</label>
          <input
            type="number"
            value={depth}
            onChange={(e) => onDepthChange(Number(e.target.value))}
            className="input-field"
            min="100"
            max="300"
          />
        </div>
      </div>
    </div>
  )
}

export default MeasurementsForm