function BlindPreview({ boxColor, slatColor, width, blindType }) {
  return (
    <div className="bg-white p-8 rounded-xl shadow-lg">
      <h2 className="text-xl font-semibold mb-4">Vista Previa</h2>
      
      {/* CAJA de la persiana */}
      <div 
        className="h-16 rounded-lg mb-2 transition-colors duration-300 flex items-center justify-center text-sm font-medium"
        style={{ 
          backgroundColor: boxColor,
          color: boxColor === '#FFFFFF' ? '#000000' : '#FFFFFF',
          width: `${Math.min(width / 10, 400)}px`
        }}
      >
        📦 Caja ({blindType === 'normal' ? 'Normal' : 'Bloqueante'})
      </div>

      {/* LAMAS de la persiana */}
      <div className="border-2 rounded-lg overflow-hidden" 
        style={{ 
          borderColor: boxColor,
          width: `${Math.min(width / 10, 400)}px`
        }}>
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="h-8 transition-colors duration-300"
            style={{ backgroundColor: slatColor }}
          />
        ))}
      </div>
    </div>
  )
}

export default BlindPreview