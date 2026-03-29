import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../../context/CartContext'

export default function AddToCartButton({ configurationId }) {
  const { addToCart, user } = useCart()
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle') // idle | loading | success | error

  async function handleClick() {
    if (!user) { navigate('/login'); return }
    if (!configurationId) { setStatus('error'); return }
    setStatus('loading')
    const { error } = await addToCart(configurationId)
    if (error) { setStatus('error'); return }
    setStatus('success')
    setTimeout(() => setStatus('idle'), 2500)
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === 'loading'}
      className={`w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
        status === 'success'
          ? 'bg-green-600 text-white'
          : status === 'error'
          ? 'bg-red-100 text-red-700 border border-red-300'
          : 'bg-gray-900 hover:bg-gray-800 text-white'
      }`}
    >
      {status === 'loading' && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
      {status === 'success' && (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {status === 'idle' && (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )}
      {status === 'idle'    && 'Añadir a la cesta'}
      {status === 'loading' && 'Añadiendo...'}
      {status === 'success' && '¡Añadido a la cesta!'}
      {status === 'error'   && 'Error — inténtalo de nuevo'}
    </button>
  )
}