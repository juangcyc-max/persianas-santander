import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { supabase } from './services/supabase/client'
import { CartProvider } from './context/CartContext'
import { ToastProvider } from './context/ToastContext'
import Header from './shared/Header'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Configurator from './pages/Configurator'
import MisConfiguraciones from './pages/components/MisConfiguraciones'
import MisPedidos from './pages/MisPedidos'
import ProfessionalDashboard from './pages/ProfessionalDashboard'
import AdminDashboard from './pages/AdminDashboard'
import Cart from './pages/Cart'
import NotFound from './pages/NotFound'
import { ProtectedRoute, AdminRoute, ProfessionalRoute } from './shared/ProtectedRoute'
import { PoliticaPrivacidad, PoliticaCookies, TerminosCondiciones } from './pages/LegalPages'
import { ForgotPassword, ResetPassword } from './pages/PasswordPages'
import CookieBanner from './shared/CookieBanner'
import WAButton from './shared/WAButton'

// ── Google Analytics: registra cada cambio de página ─────────────────────
function GATracker() {
  const location = useLocation()
  useEffect(() => {
    if (typeof window.gtag !== 'function') return
    window.gtag('event', 'page_view', { page_path: location.pathname + location.search })
  }, [location])
  return null
}

// ── Detecta PASSWORD_RECOVERY y redirige a /reset-password ───────────────
function AuthEventHandler() {
  const navigate = useNavigate()
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password')
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])
  return null
}

// ── Ruta protegida que redirige según tipo de usuario ─────────────────────
function SmartRedirect() {
  const [loading,  setLoading]  = useState(true)
  const [redirect, setRedirect] = useState(null)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setRedirect('/login'); setLoading(false); return }

      // Intentar leer de profiles primero
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type, role')
        .eq('id', user.id)
        .single()

      // Fallback: leer de user_metadata si profiles no tiene datos
      const userType = profile?.user_type ?? user.user_metadata?.user_type ?? 'public'
      const role     = profile?.role ?? user.user_metadata?.user_type

      if (!profile) {
        await supabase.from('profiles').upsert({
          id:        user.id,
          email:     user.email,
          user_type: userType,
        })
      }

      if (role === 'admin' || userType === 'admin')    setRedirect('/admin')
      else if (userType === 'professional')             setRedirect('/panel-profesional')
      else                                              setRedirect('/')
      setLoading(false)
    }
    check()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  return <Navigate to={redirect} replace />
}

function App() {
  return (
    <HelmetProvider>
      <Router>
        <GATracker />
        <AuthEventHandler />
        <ToastProvider>
          <CartProvider>
          <CookieBanner />
          <Routes>
            <Route path="/panel-profesional" element={<ProfessionalRoute><ProfessionalDashboard /></ProfessionalRoute>} />
            <Route path="/admin"             element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/inicio"            element={<SmartRedirect />} />
            <Route path="/reset-password"    element={<ResetPassword />} />
            <Route path="/*" element={
              <div className="min-h-screen bg-gray-50 w-full">
                <Header />
                <WAButton />
                <main className="w-full">
                  <Routes>
                    <Route path="/"                    element={<Home />} />
                    <Route path="/login"               element={<Login />} />
                    <Route path="/registro"            element={<Register />} />
                    <Route path="/configurador"        element={<Configurator />} />
                    <Route path="/mis-configuraciones" element={<ProtectedRoute><MisConfiguraciones /></ProtectedRoute>} />
                    <Route path="/mis-pedidos"         element={<ProtectedRoute><MisPedidos /></ProtectedRoute>} />
                    <Route path="/cesta"               element={<ProtectedRoute><Cart /></ProtectedRoute>} />
                    <Route path="/privacidad"          element={<PoliticaPrivacidad />} />
                    <Route path="/cookies"             element={<PoliticaCookies />} />
                    <Route path="/terminos"            element={<TerminosCondiciones />} />
                    <Route path="/recuperar"           element={<ForgotPassword />} />
                    <Route path="*"                    element={<NotFound />} />
                  </Routes>
                </main>
              </div>
            } />
          </Routes>
        </CartProvider>
        </ToastProvider>
      </Router>
    </HelmetProvider>
  )
}

export default App