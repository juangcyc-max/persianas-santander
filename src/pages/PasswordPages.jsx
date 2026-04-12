import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../services/supabase/client'

// ══════════════════════════════════════════════════════════════════════════
// OLVIDÉ MI CONTRASEÑA — envía el email de recuperación
// ══════════════════════════════════════════════════════════════════════════
export function ForgotPassword() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) { setError('Introduce tu email'); return }
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://persianassantander.es/reset-password',
    })

    setLoading(false)
    if (err) {
      setError('No se pudo enviar el email. Comprueba la dirección.')
    } else {
      setSent(true)
    }
  }

  if (sent) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Email enviado</h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          Hemos enviado un enlace de recuperación a <strong>{email}</strong>. Revisa tu bandeja de entrada y sigue las instrucciones.
        </p>
        <p className="text-xs text-gray-400 mb-6">
          Si no lo ves, revisa la carpeta de spam.
        </p>
        <Link to="/login"
          className="block w-full py-3 bg-red-700 text-white rounded-xl font-bold text-sm hover:bg-red-800 transition-colors text-center">
          Volver al login
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Recuperar contraseña</h1>
          <p className="text-gray-500 text-sm mt-1">Te enviaremos un enlace a tu email</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email de tu cuenta
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-900
                           placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition-colors"
              />
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-red-700 text-white rounded-xl font-semibold text-sm
                         hover:bg-red-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          ¿Recuerdas tu contraseña?{' '}
          <Link to="/login" className="text-red-700 font-semibold hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// RESTABLECER CONTRASEÑA — nueva contraseña tras el enlace del email
// ══════════════════════════════════════════════════════════════════════════
export function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)
  const [error,    setError]    = useState('')
  const [showPass, setShowPass] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 6) { setError('Mínimo 6 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.updateUser({ password })

    setLoading(false)
    if (err) {
      setError('No se pudo actualizar la contraseña. El enlace puede haber expirado.')
    } else {
      setDone(true)
    }
  }

  if (done) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">¡Contraseña actualizada!</h2>
        <p className="text-gray-500 text-sm mb-6">
          Tu contraseña ha sido cambiada correctamente. Ya puedes iniciar sesión.
        </p>
        <Link to="/login"
          className="block w-full py-3 bg-red-700 text-white rounded-xl font-bold text-sm hover:bg-red-800 transition-colors text-center">
          Ir a iniciar sesión
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Nueva contraseña</h1>
          <p className="text-gray-500 text-sm mt-1">Elige una contraseña segura</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nueva contraseña</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-gray-300 text-sm
                             focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition-colors"
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-1.5 h-1 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${
                    password.length < 6 ? 'w-1/4 bg-red-400' : password.length < 10 ? 'w-1/2 bg-amber-400' : 'w-full bg-green-500'
                  }`} />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repite la contraseña"
                required
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm
                            focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition-colors
                            ${confirm && confirm !== password ? 'border-red-300' : 'border-gray-300'}`}
              />
              {confirm && confirm !== password && (
                <p className="mt-1 text-xs text-red-600">Las contraseñas no coinciden</p>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-red-700 text-white rounded-xl font-semibold text-sm
                         hover:bg-red-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
              {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}