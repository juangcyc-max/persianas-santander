import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './services/supabase/client'
import Header from './shared/Header'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Configurator from './pages/Configurator'
import MisConfiguraciones from './pages/components/MisConfiguraciones'
import ProfessionalDashboard from './pages/ProfessionalDashboard'

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
        .select('user_type')
        .eq('id', user.id)
        .single()

      // Fallback: leer de user_metadata si profiles no tiene datos
      const userType = profile?.user_type ?? user.user_metadata?.user_type ?? 'public'

      // Si es profesional y no tiene perfil creado aún, crearlo ahora
      if (!profile) {
        await supabase.from('profiles').upsert({
          id:        user.id,
          email:     user.email,
          user_type: userType,
        })
      }

      setRedirect(userType === 'professional' ? '/panel-profesional' : '/')
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
    <Router>
      <Routes>
        {/* Panel profesional — sin Header global (tiene su propio topbar) */}
        <Route path="/panel-profesional" element={<ProfessionalDashboard />} />

        {/* Redirección inteligente post-login */}
        <Route path="/inicio" element={<SmartRedirect />} />

        {/* Resto de rutas — con Header */}
        <Route path="/*" element={
          <div className="min-h-screen bg-gray-50 w-full">
            <Header />
            <main className="w-full">
              <Routes>
                <Route path="/"                    element={<Home />} />
                <Route path="/login"               element={<Login />} />
                <Route path="/registro"            element={<Register />} />
                <Route path="/configurador"        element={<Configurator />} />
                <Route path="/mis-configuraciones" element={<MisConfiguraciones />} />
              </Routes>
            </main>
          </div>
        } />
      </Routes>
    </Router>
  )
}

export default App