import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase/client'
import { useCart } from '../../context/CartContext'

function SaveConfigurationButton({ configuration, onSuccess, proDiscount = 0 }) {
  const [loading,      setLoading]      = useState(false)
  const [status,       setStatus]       = useState(null) // null | 'success' | 'error' | 'auth'
  const [message,      setMessage]      = useState('')
  const [savedId,      setSavedId]      = useState(null)
  const [isPro,        setIsPro]        = useState(false)
  const [addingCart,   setAddingCart]   = useState(false)
  const [addedToCart,  setAddedToCart]  = useState(false)
  const [destUrl,      setDestUrl]      = useState(null)
  const navigate = useNavigate()
  const { addToCart } = useCart()

  useEffect(() => {
    if (!destUrl) return
    window.scrollTo({ top: 0, behavior: 'instant' })
    navigate(destUrl, { replace: true })
  }, [destUrl])

  async function handleSave() {
    setLoading(true)
    setStatus(null)
    setAddedToCart(false)
    setSavedId(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setStatus('auth')
        return
      }

      const configNumber = `CONF-${Date.now()}-${Math.random().toString(36).substring(2,8).toUpperCase()}`
      const basePrice    = configuration.estimatedPrice / 1.21
      const blindType    = configuration.productType ?? configuration.blindType ?? 'laminada'

      const { data, error } = await supabase
        .from('blind_configurations')
        .insert([{
          user_id:              user.id,
          configuration_number: configNumber,
          blind_type:           blindType,
          mechanism:            configuration.mechanism,
          orientation:          configuration.orientation,
          motor_type:           configuration.motorType,
          width:                configuration.width,
          height:               configuration.height,
          box_color:            configuration.boxColor,
          slat_color:           configuration.slatColor,
          box_color_name:       configuration.boxColorName,
          slat_color_name:      configuration.slatColorName,
          price_public:         basePrice,
          price_professional:   basePrice * (1 - proDiscount / 100),
          estimated_price:      configuration.estimatedPrice,
          guide_type:           configuration.guideType ?? null,
          installacion:         configuration.installacion !== false,
        }])
        .select()

      if (error) throw error

      const saved = data?.[0] ?? null
      setSavedId(saved?.id ?? null)
      setStatus('success')
      setMessage(configNumber)
      onSuccess?.(saved)

      const userIsPro = user.user_metadata?.user_type === 'professional'
      setIsPro(userIsPro)

      // Auto-cotización para profesionales
      if (userIsPro && saved) {
        const proPrice = basePrice * (1 - proDiscount / 100)
        await supabase.from('pro_purchase_quotes').insert({
          user_id:       user.id,
          items:         [{
            config_id:          saved.id,
            blind_type:         blindType,
            mechanism:          configuration.mechanism ?? null,
            motor_type:         configuration.motorType ?? null,
            guide_type:         configuration.guideType ?? null,
            width:              configuration.width ?? null,
            height:             configuration.height ?? null,
            box_color_name:     configuration.boxColorName  ?? null,
            slat_color_name:    configuration.slatColorName ?? null,
            installacion:       configuration.installacion !== false,
            price_public:       basePrice,
            price_professional: proPrice,
          }],
          discount_pct:  proDiscount,
          total_sin_iva: proPrice,
          total_con_iva: proPrice * 1.21,
          status:        'pending',
        })
      }

      if (userIsPro) sessionStorage.setItem('proActiveTab', 'cotizaciones')
      const dest = userIsPro ? '/panel-profesional' : '/mis-configuraciones'
      setTimeout(() => setDestUrl(dest), 800)

    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddToCart() {
    if (!savedId) return
    setAddingCart(true)
    const { error } = await addToCart(savedId)
    setAddingCart(false)
    if (!error) setAddedToCart(true)
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

      {/* Estado: éxito — muestra acciones inline */}
      {status === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-green-700">
              Guardada como <span className="font-mono font-bold">{message}</span>
            </p>
            <button
              onClick={() => onSuccess?.()}
              className="text-xs text-green-700 font-semibold hover:underline flex-shrink-0"
            >
              Ver todas →
            </button>
          </div>
          {savedId && (
            isPro ? (
              <div className="flex items-center gap-2 text-xs text-green-700">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
                Cotización de compra generada — visible en <button onClick={() => navigate('/panel-profesional')} className="font-semibold underline ml-1">Mis compras →</button>
              </div>
            ) : (
              <button
                onClick={handleAddToCart}
                disabled={addingCart || addedToCart}
                className={`w-full py-2.5 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
                  addedToCart
                    ? 'bg-green-200 text-green-800 cursor-default'
                    : 'bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-60'
                }`}
              >
                {addingCart ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : addedToCart ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Añadido a la cesta
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Añadir a la cesta
                  </>
                )}
              </button>
            )
          )}
        </div>
      )}

      {/* Estado: requiere login */}
      {status === 'auth' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <div>
            <p className="text-sm text-blue-800 font-medium">Inicia sesión para guardar</p>
            <button onClick={() => navigate('/login')} className="text-xs text-blue-600 hover:underline mt-0.5">
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
    </div>
  )
}

export default SaveConfigurationButton
