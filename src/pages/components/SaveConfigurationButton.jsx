import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase/client'

function SaveConfigurationButton({ configuration, onSuccess, proDiscount = 20 }) {
  const [loading, setLoading] = useState(false)
  const [status,  setStatus]  = useState(null) // null | 'success' | 'error' | 'auth'
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  async function handleSave() {
    setLoading(true)
    setStatus(null)

    try {
      const authResponse = await supabase.auth.getUser()
      const user = authResponse.data.user

      if (!user) {
        setStatus('auth')
        setLoading(false)
        return
      }

      const configNumber   = `CONF-${Date.now()}-${Math.random().toString(36).substr(2,6).toUpperCase()}`
      const basePrice      = configuration.estimatedPrice / 1.21

      const { data, error } = await supabase
        .from('blind_configurations')
        .insert([{
          user_id:              user.id,
          configuration_number: configNumber,
          blind_type:           configuration.blindType,
          mechanism:            configuration.mechanism,
          orientation:          configuration.orientation,
          motor_type:           configuration.motorType,
          width:                configuration.width,
          height:               configuration.height,
          depth:                configuration.depth,
          box_color:            configuration.boxColor,
          slat_color:           configuration.slatColor,
          box_color_name:       configuration.boxColorName,
          slat_color_name:      configuration.slatColorName,
          price_public:         basePrice,
          price_professional:   basePrice * (1 - proDiscount / 100),
          estimated_price:      configuration.estimatedPrice,
        }])
        .select()

      if (error) throw error

      setStatus('success')
      setMessage(configNumber)
      onSuccess?.(data?.[0] ?? null)

      // Limpiar éxito tras 4 s
      setTimeout(() => setStatus(null), 4000)
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleSave}
        disabled={loading}
        className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
          loading
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : status === 'success'
            ? 'bg-green-600 text-white'
            : 'bg-red-700 hover:bg-red-800 text-white'
        }`}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            Guardando…
          </>
        ) : status === 'success' ? (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Configuración guardada
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Guardar configuración
          </>
        )}
      </button>

      {/* Estado: requiere login */}
      {status === 'auth' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <div>
            <p className="text-sm text-blue-800 font-medium">Inicia sesión para guardar</p>
            <button
              onClick={() => navigate('/login')}
              className="text-xs text-blue-600 hover:underline mt-0.5"
            >
              Ir a iniciar sesión →
            </button>
          </div>
        </div>
      )}

      {/* Estado: error */}
      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-700">{message || 'No se pudo guardar. Inténtalo de nuevo.'}</p>
        </div>
      )}

      {/* Estado: éxito */}
      {status === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-green-700">
            Guardada como <span className="font-mono font-bold">{message}</span>
          </p>
          <button
            onClick={() => navigate('/mis-configuraciones')}
            className="text-xs text-green-700 font-semibold hover:underline flex-shrink-0"
          >
            Ver todas →
          </button>
        </div>
      )}
    </div>
  )
}

export default SaveConfigurationButton
