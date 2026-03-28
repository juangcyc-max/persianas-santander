import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase/client'

// ── Indicador de pasos ────────────────────────────────────────────────────
function StepBar({ current, steps }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2 flex-1">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i < current
                ? 'bg-red-700 text-white'
                : i === current
                ? 'bg-red-700 text-white ring-4 ring-red-100'
                : 'bg-gray-100 text-gray-400'
            }`}>
              {i < current
                ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                : i + 1
              }
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i <= current ? 'text-gray-900' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-px ${i < current ? 'bg-red-700' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Campo de formulario ───────────────────────────────────────────────────
function Field({ label, type = 'text', value, onChange, placeholder, error, required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-900 bg-white
                    placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors
                    ${error
                      ? 'border-red-300 focus:ring-red-100 focus:border-red-400'
                      : 'border-gray-300 focus:ring-red-100 focus:border-red-400'
                    }`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ── REGISTER ─────────────────────────────────────────────────────────────
export default function Register() {
  const navigate = useNavigate()

  // Pasos: 0 = tipo cuenta, 1 = email/password, 2 = datos empresa (solo profesional)
  const [step,     setStep]     = useState(0)
  const [accType,  setAccType]  = useState(null) // 'particular' | 'professional'
  const [loading,  setLoading]  = useState(false)
  const [errors,   setErrors]   = useState({})
  const [success,  setSuccess]  = useState(false)

  // Paso 1
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPass, setShowPass] = useState(false)

  // Paso 2 — datos empresa
  const [empresa, setEmpresa] = useState({
    razon_social:      '',
    cif_nif:           '',
    direccion_fiscal:  '',
    codigo_postal:     '',
    ciudad:            '',
    provincia:         '',
    telefono:          '',
    email_facturacion: '',
  })

  const setEmpresaField = (field, value) => {
    setEmpresa(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const steps = accType === 'professional'
    ? ['Tipo de cuenta', 'Acceso', 'Datos de empresa']
    : ['Tipo de cuenta', 'Acceso']

  // ── Validaciones ─────────────────────────────────────────────────────
  const validateStep1 = () => {
    const e = {}
    if (!email.trim())                                      e.email    = 'El email es obligatorio'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))    e.email    = 'Email no válido'
    if (!password)                                          e.password = 'La contraseña es obligatoria'
    else if (password.length < 6)                           e.password = 'Mínimo 6 caracteres'
    if (password !== confirm)                               e.confirm  = 'Las contraseñas no coinciden'
    return e
  }

  const validateStep2 = () => {
    const e = {}
    const required = ['razon_social','cif_nif','direccion_fiscal','codigo_postal','ciudad','provincia','telefono','email_facturacion']
    required.forEach(f => { if (!empresa[f]?.trim()) e[f] = 'Campo obligatorio' })
    if (empresa.email_facturacion && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(empresa.email_facturacion))
      e.email_facturacion = 'Email no válido'
    return e
  }

  // ── Paso 0 → 1 ────────────────────────────────────────────────────────
  const handleSelectType = (type) => {
    setAccType(type)
    setStep(1)
  }

  // ── Paso 1 → siguiente ────────────────────────────────────────────────
  const handleStep1 = () => {
    const e = validateStep1()
    if (Object.keys(e).length) { setErrors(e); return }
    setErrors({})
    if (accType === 'professional') setStep(2)
    else handleSubmit()
  }

  // ── Submit final ──────────────────────────────────────────────────────
  const handleSubmit = async (e2Data = null) => {
    setLoading(true)
    setErrors({})
    try {
      // 1. Crear usuario en Supabase Auth con metadata
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            user_type: accType === 'professional' ? 'professional' : 'public',
          }
        }
      })
      if (authError) throw authError

      const userId = data.user?.id
      if (!userId) throw new Error('No se pudo obtener el ID de usuario')

      // 2. Crear perfil (puede fallar si RLS no permite insert antes de confirmar — en ese caso el trigger lo hará)
      await supabase.from('profiles').upsert({
        id:        userId,
        email:     email,
        user_type: accType === 'professional' ? 'professional' : 'public',
      }).then(() => {}) // ignorar error si RLS lo bloquea hasta confirmar

      // 3. Si es profesional, guardar datos de empresa
      if (accType === 'professional' && e2Data) {
        await supabase.from('professional_data').upsert({
          user_id: userId,
          ...e2Data,
        }).then(() => {})
      }

      setSuccess(true)
    } catch (err) {
      setErrors({ _global: err.message })
    } finally {
      setLoading(false)
    }
  }

  const handleStep2 = () => {
    const e = validateStep2()
    if (Object.keys(e).length) { setErrors(e); return }
    setErrors({})
    handleSubmit(empresa)
  }

  // ── Éxito ─────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">¡Cuenta creada!</h2>
            <p className="text-gray-500 text-sm mb-2">
              Revisa tu bandeja de entrada en <strong>{email}</strong> para confirmar tu cuenta.
            </p>
            {accType === 'professional' && (
              <p className="text-sm text-red-700 font-medium mb-6">
                Tu cuenta profesional con 20% de descuento está lista.
              </p>
            )}
            <Link to="/login"
              className="inline-block w-full py-3 bg-red-700 text-white rounded-xl font-semibold text-sm hover:bg-red-800 transition-colors">
              Ir a iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/persianassantanderlogo.svg" alt="Persianas Santander"
            className="h-12 w-auto mx-auto mb-4"
            onError={e => { e.target.src = '/persianassantanderlogo.png' }} />
          <h1 className="text-2xl font-bold text-gray-900">Crear cuenta</h1>
          <p className="text-gray-500 text-sm mt-1">
            {step === 0 && 'Elige el tipo de cuenta que necesitas'}
            {step === 1 && 'Configura tu acceso'}
            {step === 2 && 'Datos de tu empresa'}
          </p>
        </div>

        {/* Stepper — solo si ya eligió tipo */}
        {accType && (
          <StepBar current={step} steps={steps} />
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">

          {/* Error global */}
          {errors._global && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {errors._global}
            </div>
          )}

          {/* ── PASO 0: Elegir tipo de cuenta ── */}
          {step === 0 && (
            <div className="space-y-4">
              <button
                onClick={() => handleSelectType('particular')}
                className="w-full flex items-start gap-4 p-5 rounded-xl border-2 border-gray-200 hover:border-red-300 hover:bg-red-50 transition-all text-left group"
              >
                <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-red-100 flex items-center justify-center flex-shrink-0 transition-colors">
                  <svg className="w-6 h-6 text-gray-500 group-hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-gray-900 mb-1">Cuenta particular</p>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Para uso personal o del hogar. Configura y solicita presupuestos sin datos de empresa.
                  </p>
                </div>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-red-400 flex-shrink-0 mt-0.5 ml-auto transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => handleSelectType('professional')}
                className="w-full flex items-start gap-4 p-5 rounded-xl border-2 border-gray-200 hover:border-red-300 hover:bg-red-50 transition-all text-left group relative overflow-hidden"
              >
                {/* Badge descuento */}
                <div className="absolute top-3 right-3 bg-red-700 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  −20%
                </div>
                <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-red-100 flex items-center justify-center flex-shrink-0 transition-colors">
                  <svg className="w-6 h-6 text-gray-500 group-hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="pr-8">
                  <p className="font-bold text-gray-900 mb-1">Cuenta profesional</p>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Para instaladores, arquitectos y empresas. Incluye 20% de descuento y facturación automática.
                  </p>
                </div>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-red-400 flex-shrink-0 mt-0.5 ml-auto transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* ── PASO 1: Email y contraseña ── */}
          {step === 1 && (
            <div className="space-y-4">
              {accType === 'professional' && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-2">
                  <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-700 font-medium">Cuenta profesional — 20% de descuento activado</p>
                </div>
              )}

              <Field label="Email" type="email" value={email} onChange={setEmail}
                placeholder="tu@email.com" error={errors.email} required />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Contraseña <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({...p, password: ''})) }}
                    placeholder="Mínimo 6 caracteres"
                    className={`w-full px-3.5 py-2.5 pr-10 rounded-xl border text-sm text-gray-900 bg-white
                                placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors
                                ${errors.password ? 'border-red-300 focus:ring-red-100' : 'border-gray-300 focus:ring-red-100 focus:border-red-400'}`}
                  />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
                {password.length > 0 && (
                  <div className="mt-1.5 h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${
                      password.length < 6 ? 'w-1/4 bg-red-400' : password.length < 10 ? 'w-1/2 bg-amber-400' : 'w-full bg-green-500'
                    }`} />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirmar contraseña <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); if (errors.confirm) setErrors(p => ({...p, confirm: ''})) }}
                  placeholder="Repite la contraseña"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-900 bg-white
                              placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors
                              ${errors.confirm ? 'border-red-300 focus:ring-red-100' : 'border-gray-300 focus:ring-red-100 focus:border-red-400'}`}
                />
                {errors.confirm && <p className="mt-1 text-xs text-red-600">{errors.confirm}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(0)}
                  className="px-4 py-3 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">
                  ← Atrás
                </button>
                <button onClick={handleStep1} disabled={loading}
                  className="flex-1 py-3 bg-red-700 text-white rounded-xl font-bold text-sm hover:bg-red-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                  {accType === 'professional' ? 'Siguiente →' : loading ? 'Creando cuenta…' : 'Crear cuenta'}
                </button>
              </div>
            </div>
          )}

          {/* ── PASO 2: Datos de empresa ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Razón social" value={empresa.razon_social}
                    onChange={v => setEmpresaField('razon_social', v)}
                    placeholder="Empresa S.L." error={errors.razon_social} required />
                </div>
                <Field label="CIF / NIF" value={empresa.cif_nif}
                  onChange={v => setEmpresaField('cif_nif', v)}
                  placeholder="B12345678" error={errors.cif_nif} required />
                <Field label="Teléfono" type="tel" value={empresa.telefono}
                  onChange={v => setEmpresaField('telefono', v)}
                  placeholder="942 000 000" error={errors.telefono} required />
                <div className="col-span-2">
                  <Field label="Dirección fiscal" value={empresa.direccion_fiscal}
                    onChange={v => setEmpresaField('direccion_fiscal', v)}
                    placeholder="Calle Mayor 1" error={errors.direccion_fiscal} required />
                </div>
                <Field label="Código postal" value={empresa.codigo_postal}
                  onChange={v => setEmpresaField('codigo_postal', v)}
                  placeholder="39001" error={errors.codigo_postal} required />
                <Field label="Ciudad" value={empresa.ciudad}
                  onChange={v => setEmpresaField('ciudad', v)}
                  placeholder="Santander" error={errors.ciudad} required />
                <div className="col-span-2">
                  <Field label="Provincia" value={empresa.provincia}
                    onChange={v => setEmpresaField('provincia', v)}
                    placeholder="Cantabria" error={errors.provincia} required />
                </div>
                <div className="col-span-2">
                  <Field label="Email de facturación" type="email" value={empresa.email_facturacion}
                    onChange={v => setEmpresaField('email_facturacion', v)}
                    placeholder="facturas@empresa.com" error={errors.email_facturacion} required />
                </div>
              </div>

              <p className="text-xs text-gray-400">
                Estos datos se usarán para generar facturas automáticamente en cada pedido.
              </p>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)}
                  className="px-4 py-3 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">
                  ← Atrás
                </button>
                <button onClick={handleStep2} disabled={loading}
                  className="flex-1 py-3 bg-red-700 text-white rounded-xl font-bold text-sm hover:bg-red-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {loading ? 'Creando cuenta…' : 'Crear cuenta profesional'}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-red-700 font-semibold hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}