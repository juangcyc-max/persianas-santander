import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase/client'

function Header() {
  const [user, setUser] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    navigate('/')
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 w-full">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center" onClick={() => setMobileMenuOpen(false)}>
            <img
              src="/persianassantanderlogo.svg"
              alt="Persianas Santander"
              className="h-10 w-auto"
              onError={(e) => {
                e.target.src = '/persianassantanderlogo.png'
              }}
            />
          </Link>

          {/* Navegación Desktop */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              to="/"
              className="text-sm font-medium text-gray-700 hover:text-santander-red transition-colors"
            >
              Inicio
            </Link>

            <Link
              to="/configurador"
              className="text-sm font-medium text-gray-700 hover:text-santander-red transition-colors"
            >
              Configurador
            </Link>

            {user && (
              <Link
                to="/mis-configuraciones"
                className="text-sm font-medium text-gray-700 hover:text-santander-red transition-colors"
              >
                Mis Configuraciones
              </Link>
            )}

            <Link
              to="/carrito"
              className="text-sm font-medium text-gray-700 hover:text-santander-red transition-colors"
            >
              Carrito
            </Link>
          </nav>

          {/* Botones Usuario Desktop */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <span className="text-gray-500 text-sm">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium bg-santander-red text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="text-sm font-medium text-gray-700 hover:text-santander-red transition-colors"
                >
                  Iniciar sesión
                </Link>
                <Link
                  to="/registro"
                  className="text-sm font-medium bg-santander-red text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                >
                  Registrarse
                </Link>
              </div>
            )}
          </div>

          {/* Botón menú móvil */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

        </div>

        {/* Menú móvil */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <nav className="flex flex-col space-y-2">

              <Link
                to="/"
                className="text-base font-medium text-gray-700 hover:text-santander-red hover:bg-gray-50 px-3 py-2 rounded transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Inicio
              </Link>

              <Link
                to="/configurador"
                className="text-base font-medium text-gray-700 hover:text-santander-red hover:bg-gray-50 px-3 py-2 rounded transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Configurador
              </Link>

              {user && (
                <Link
                  to="/mis-configuraciones"
                  className="text-base font-medium text-gray-700 hover:text-santander-red hover:bg-gray-50 px-3 py-2 rounded transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Mis Configuraciones
                </Link>
              )}

              <Link
                to="/carrito"
                className="text-base font-medium text-gray-700 hover:text-santander-red hover:bg-gray-50 px-3 py-2 rounded transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Carrito
              </Link>

              <div className="border-t border-gray-200 pt-3 mt-3">
                {user ? (
                  <div className="space-y-2">
                    <p className="text-gray-500 text-sm px-3">{user.email}</p>
                    <button
                      onClick={() => {
                        handleLogout()
                        setMobileMenuOpen(false)
                      }}
                      className="w-full text-sm font-medium bg-santander-red text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                    >
                      Cerrar sesión
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Link
                      to="/login"
                      className="block text-base font-medium text-gray-700 hover:text-santander-red hover:bg-gray-50 px-3 py-2 rounded transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Iniciar sesión
                    </Link>
                    <Link
                      to="/registro"
                      className="block text-base font-medium bg-santander-red text-white px-4 py-2 rounded hover:bg-red-700 transition-colors text-center"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Registrarse
                    </Link>
                  </div>
                )}
              </div>

            </nav>
          </div>
        )}

      </div>
    </header>
  )
}

export default Header