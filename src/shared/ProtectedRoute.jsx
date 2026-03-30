import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../services/supabase/client'

// ── Spinner de carga ──────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ── Ruta protegida genérica (requiere sesión) ─────────────────────────────
export function ProtectedRoute({ children }) {
  const [state, setState] = useState('loading') // loading | ok | redirect

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(session ? 'ok' : 'redirect')
    })
  }, [])

  if (state === 'loading')  return <LoadingScreen />
  if (state === 'redirect') return <Navigate to="/login" replace />
  return children
}

// ── Ruta solo para admin ──────────────────────────────────────────────────
export function AdminRoute({ children }) {
  const [state, setState] = useState('loading')

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setState('no_session'); return }

      const user = session.user
      // Comprobar en profiles Y en user_metadata
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const isAdmin = profile?.role === 'admin' || user.user_metadata?.user_type === 'admin'
      setState(isAdmin ? 'ok' : 'no_permission')
    }
    check()
  }, [])

  if (state === 'loading')       return <LoadingScreen />
  if (state === 'no_session')    return <Navigate to="/login" replace />
  if (state === 'no_permission') return <Navigate to="/" replace />
  return children
}

// ── Ruta solo para profesionales ──────────────────────────────────────────
export function ProfessionalRoute({ children }) {
  const [state, setState] = useState('loading')

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setState('no_session'); return }

      const user     = session.user
      const userType = user.user_metadata?.user_type

      if (userType === 'professional' || userType === 'admin') {
        setState('ok')
      } else {
        // Fallback: comprobar en profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_type, role')
          .eq('id', user.id)
          .single()

        const ok = profile?.user_type === 'professional' || profile?.role === 'admin'
        setState(ok ? 'ok' : 'no_permission')
      }
    }
    check()
  }, [])

  if (state === 'loading')       return <LoadingScreen />
  if (state === 'no_session')    return <Navigate to="/login" replace />
  if (state === 'no_permission') return <Navigate to="/" replace />
  return children
}
