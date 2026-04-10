import { useState } from 'react'
import { sendBudgetResend } from '../../services/email'
import { generateBudgetPDF } from '../../services/pdf'

function CustomerForm({ customerData = {}, onCustomerDataChange, configuration = {}, onSubmit }) {
  const [sending,   setSending]   = useState(false)
  const [pdfLoading,setPdfLoading]= useState(false)
  const [errors,    setErrors]    = useState({})
  const [sent,      setSent]      = useState(false)

  const handleChange = (field, value) => {
    onCustomerDataChange({ ...customerData, [field]: value })
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!customerData.name?.trim())  e.name  = 'El nombre es obligatorio'
    if (!customerData.phone?.trim()) e.phone = 'El teléfono es obligatorio'
    else if (!/^[0-9]{9}$/.test(customerData.phone.replace(/\s/g,''))) e.phone = 'Introduce 9 dígitos'
    if (!customerData.email?.trim()) e.email = 'El email es obligatorio'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerData.email)) e.email = 'Email no válido'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSending(true)
    try {
      const result = await sendBudgetResend(customerData, configuration)
      if (result.success) {
        setSent(true)
        onSubmit?.()
      } else {
        setErrors({ _global: 'No se pudo enviar el email. Inténtalo de nuevo.' })
      }
    } catch {
      setErrors({ _global: 'Error inesperado. Inténtalo de nuevo.' })
    } finally {
      setSending(false)
    }
  }

  const handleDownloadPDF = async () => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setPdfLoading(true)
    try {
      await generateBudgetPDF(customerData, configuration)
    } catch {
      setErrors({ _global: 'Error generando el PDF. Inténtalo de nuevo.' })
    } finally {
      setPdfLoading(false)
    }
  }

  // ── Pantalla de éxito ──
  if (sent) {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">¡Presupuesto enviado!</h3>
        <p className="text-sm text-gray-500 mb-5">
          Nos pondremos en contacto contigo en menos de 24 h en el email <strong>{customerData.email}</strong>.
        </p>
        <button
          onClick={() => setSent(false)}
          className="text-sm text-red-700 hover:underline font-medium"
        >
          Enviar otro presupuesto
        </button>
      </div>
    )
  }

  // ── Formulario ──
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Solicitar presupuesto</h2>
        <p className="text-sm text-gray-500 mt-0.5">Te contactamos en menos de 24 h.</p>
      </div>

      {errors._global && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {errors._global}
        </div>
      )}

      <div className="space-y-3">
        <Field
          label="Nombre completo *"
          type="text"
          value={customerData.name || ''}
          onChange={v => handleChange('name', v)}
          placeholder="Juan García"
          error={errors.name}
        />
        <Field
          label="Teléfono *"
          type="tel"
          value={customerData.phone || ''}
          onChange={v => handleChange('phone', v)}
          placeholder="600 123 456"
          error={errors.phone}
        />
        <Field
          label="Email *"
          type="email"
          value={customerData.email || ''}
          onChange={v => handleChange('email', v)}
          placeholder="tu@email.com"
          error={errors.email}
        />
        <Field
          label="Dirección de instalación"
          type="text"
          value={customerData.address || ''}
          onChange={v => handleChange('address', v)}
          placeholder="Calle Mayor 1, Santander"
        />
      </div>

      {/* Precio resumen */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-gray-500">Total estimado</span>
        <span className="text-lg font-black text-red-700">
          {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(configuration.estimatedPrice || 0)}
        </span>
      </div>

      <div className="space-y-2.5">
        {/* PDF */}
        <button
          type="button"
          onClick={handleDownloadPDF}
          disabled={pdfLoading}
          className="w-full py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {pdfLoading
            ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          }
          Descargar presupuesto PDF
        </button>

        {/* Email */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={sending}
          className="w-full py-3 rounded-xl bg-red-700 text-white font-bold text-sm hover:bg-red-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {sending
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          }
          Enviar presupuesto por email
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Tus datos solo se usarán para gestionar este presupuesto.
      </p>
    </div>
  )
}

// Componente de campo reutilizable
function Field({ label, type, value, onChange, placeholder, error }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-900 bg-white placeholder-gray-400
                    focus:outline-none focus:ring-2 transition-colors
                    ${error
                      ? 'border-red-300 focus:ring-red-100 focus:border-red-400'
                      : 'border-gray-300 focus:ring-red-100 focus:border-red-400'
                    }`}
      />
      {error && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}

export default CustomerForm
