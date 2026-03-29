import { Link, useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">

        {/* Número 404 grande */}
        <div className="relative mb-8">
          <p className="text-[10rem] font-black text-gray-100 leading-none select-none">404</p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-red-50 rounded-2xl flex items-center justify-center border-2 border-red-100">
              <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Página no encontrada
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          Lo sentimos, la página que buscas no existe o ha sido movida. 
          Puede que la URL esté mal escrita o el contenido ya no esté disponible.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold text-sm rounded-xl hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver atrás
          </button>
          <Link to="/"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-red-700 hover:bg-red-800 text-white font-bold text-sm rounded-xl transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Ir al inicio
          </Link>
          <Link to="/configurador"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm rounded-xl transition-colors">
            Configurador →
          </Link>
        </div>

        {/* Links útiles */}
        <div className="mt-10 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400 mb-3">Páginas más visitadas</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              { label: 'Inicio',          to: '/'               },
              { label: 'Configurador',    to: '/configurador'   },
              { label: 'Iniciar sesión',  to: '/login'          },
              { label: 'Registrarse',     to: '/registro'       },
            ].map(({ label, to }) => (
              <Link key={to} to={to}
                className="text-xs text-gray-500 hover:text-red-700 bg-white border border-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                {label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
