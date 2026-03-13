import { useState } from 'react'
import { supabase } from '../../services/supabase/client'

function SaveConfigurationButton({ configuration, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSave() {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Obtener usuario actual
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      console.log('Auth error:', authError)
      console.log('User:', user)

      if (authError || !user) {
        setError('Debes iniciar sesión para guardar configuraciones. Por favor, inicia sesión primero.')
        setLoading(false)
        return
      }

      console.log('User ID:', user.id)

      // Generar número de configuración único
      const configNumber = `CONF-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

      // Calcular ambos precios (sin IVA para guardar en BD)
      const basePrice = configuration.estimatedPrice / 1.21
      const pricePublic = basePrice
      const priceProfessional = basePrice * 0.8

      console.log('Saving configuration:', {
        user_id: user.id,
        configuration_number: configNumber,
        blind_type: configuration.blindType,
        width: configuration.width,
        height: configuration.height,
        depth: configuration.depth,
      })

      // Guardar en la base de datos y devolver los datos insertados
      const { data, error: insertError } = await supabase
        .from('blind_configurations')
        .insert([
          {
            user_id: user.id,
            configuration_number: configNumber,
            blind_type: configuration.blindType,
            mechanism: configuration.mechanism,
            orientation: configuration.orientation,
            motor_type: configuration.motorType,
            width: configuration.width,
            height: configuration.height,
            depth: configuration.depth,
            box_color: configuration.boxColor,
            slat_color: configuration.slatColor,
            box_color_name: configuration.boxColorName,
            slat_color_name: configuration.slatColorName,
            price_public: pricePublic,
            price_professional: priceProfessional,
            estimated_price: configuration.estimatedPrice,
          }
        ])
        .select()

      console.log('Insert result:', { data, error: insertError })

      if (insertError) throw insertError

      setSuccess('✅ Configuración guardada correctamente')
      onSuccess?.(data?.[0] || null)
    } catch (err) {
      console.error('Save error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleSave}
        disabled={loading}
        className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all ${
          loading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-santander-red hover:bg-red-700 text-white'
        }`}
      >
        {loading ? '⏳ Guardando...' : '💾 Guardar Configuración'}
      </button>

      {error && (
        <div className="mt-3 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-3 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}
    </div>
  )
}

export default SaveConfigurationButton