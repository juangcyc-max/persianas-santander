import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent')
    if (!consent) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem('cookie_consent', 'accepted')
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { analytics_storage: 'granted' })
    }
    setVisible(false)
  }

  function reject() {
    localStorage.setItem('cookie_consent', 'rejected')
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage:  'denied',
        ad_storage:         'denied',
        ad_user_data:       'denied',
        ad_personalization: 'denied',
      })
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[200] p-4 sm:p-6">
      <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 mb-1">Usamos cookies</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Utilizamos cookies propias para el funcionamiento del sitio. Puedes aceptarlas o rechazarlas.{' '}
            <Link to="/cookies" className="text-red-700 hover:underline font-medium">
              Más información
            </Link>
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={reject}
            className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Rechazar
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 text-sm font-bold text-white bg-red-700 hover:bg-red-800 rounded-xl transition-colors"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}
