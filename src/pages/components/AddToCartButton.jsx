import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { useToast } from '../../context/ToastContext'

export default function AddToCartButton({ configurationId }) {
  const { addToCart, user } = useCart()
  const { success, error }  = useToast()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (!user) { navigate('/login'); return }
    if (!configurationId) { error('Error', 'Guarda la configuración primero'); return }
    setLoading(true)
    const { error: err } = await addToCart(configurationId)
    if (err) {
      error('Error', 'No se pudo añadir a la cesta')
    } else {
      success('¡Añadido a la cesta!', 'Puedes seguir configurando o ir a la cesta')
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-60"
    >
      {loading
        ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
      }
      {loading ? 'Añadiendo...' : 'Añadir a la cesta'}
    </button>
  )
}