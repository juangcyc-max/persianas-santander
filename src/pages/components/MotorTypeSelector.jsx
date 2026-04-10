function MotorTypeSelector({ motorType, onMotorTypeChange }) {
  const motors = [
    {
      id: 'mecanico',
      label: 'Mecánico',
      detail: 'Con cable',
      price: '120 €',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      ),
    },
    {
      id: 'mando_distancia',
      label: 'Mando / Radio',
      detail: 'A distancia',
      price: '260 €',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
        </svg>
      ),
    },
  ]

  return (
    <div>
      <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">
        Tipo de motor
      </h2>

      <div className="grid grid-cols-2 gap-2">
        {motors.map(({ id, label, detail, price, icon }) => {
          const active = motorType === id
          return (
            <button
              key={id}
              onClick={() => onMotorTypeChange(id)}
              className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                active
                  ? 'border-red-600 bg-red-50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-colors ${
                active ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {icon}
              </div>
              <p className={`text-xs font-bold ${active ? 'text-red-700' : 'text-gray-800'}`}>{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{detail}</p>
              <p className={`text-xs font-semibold mt-1 ${active ? 'text-red-600' : 'text-gray-500'}`}>{price}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MotorTypeSelector
