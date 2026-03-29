import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase/client'

function Header() {
  const [user,           setUser]           = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate  = useNavigate()
  const location  = useLocation()

  const [isProfessional, setIsProfessional] = useState(false)

  useEffect(() => {
    checkUser()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      const type = session?.user?.user_metadata?.user_type
      setIsProfessional(type === 'professional')
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    setIsProfessional(user?.user_metadata?.user_type === 'professional')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    navigate('/')
  }

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  const navLinks = [
    { to: '/',             label: 'Inicio' },
    { to: '/configurador', label: 'Configurador' },
    ...(user && isProfessional
      ? [{ to: '/panel-profesional', label: 'Mi panel' }]
      : user
      ? [{ to: '/mis-configuraciones', label: 'Mis configuraciones' }]
      : []
    ),
  ]

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 w-full">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-8">

          {/* ── Logo ── */}
          <Link
            to="/"
            className="flex-shrink-0 flex items-center"
            onClick={() => setMobileMenuOpen(false)}
          >
            <img
              src="/persianassantanderlogo.png"
              alt="Persianas Santander"
              style={{ height: '52px', width: 'auto' }}
              onError={e => { e.target.src = '/persianassantanderlogo.svg' }}
            />
          </Link>

          {/* ── Navegación Desktop ── */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(to)
                    ? 'bg-red-50 text-red-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* ── Acciones Desktop ── */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            {user ? (
              <>
                <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {user.email?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <span className="text-sm text-gray-600 max-w-[160px] truncate">{user.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm font-semibold text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-semibold text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                  Iniciar sesión
                </Link>
                <Link to="/registro" className="text-sm font-bold bg-red-700 text-white px-5 py-2.5 rounded-xl hover:bg-red-800 transition-colors">
                  Registrarse
                </Link>
              </>
            )}
          </div>

          {/* ── Botón menú móvil ── */}
          <button
            onClick={() => setMobileMenuOpen(o => !o)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>

        {/* ── Menú móvil ── */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-5 border-t border-gray-100 pt-3">
            <nav className="flex flex-col gap-1">
              {navLinks.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive(to)
                      ? 'bg-red-50 text-red-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>

            <div className="mt-4 pt-4 border-t border-gray-100">
              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-4">
                    <div className="w-9 h-9 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {user.email?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <span className="text-sm text-gray-600 truncate">{user.email}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-sm font-semibold text-gray-700 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
                  >
                    Cerrar sesión
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    to="/login"
                    className="block text-sm font-semibold text-gray-700 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Iniciar sesión
                  </Link>
                  <Link
                    to="/registro"
                    className="block text-sm font-bold bg-red-700 text-white px-4 py-3 rounded-xl hover:bg-red-800 transition-colors text-center"
                  >
                    Registrarse
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header