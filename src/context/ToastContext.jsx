import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

// ── Icono por tipo ────────────────────────────────────────────────────────
function ToastIcon({ type }) {
  if (type === 'success') return (
    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    </div>
  )
  if (type === 'error') return (
    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  )
  if (type === 'warning') return (
    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    </div>
  )
  // info
  return (
    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  )
}

// ── Toast individual ──────────────────────────────────────────────────────
function Toast({ id, type, title, message, onRemove }) {
  return (
    <div
      className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 min-w-[280px] max-w-[360px] animate-slide-in"
      style={{ animation: 'slideIn 0.25s ease-out' }}
    >
      <ToastIcon type={type} />
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        {message && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{message}</p>}
      </div>
      <button
        onClick={() => onRemove(id)}
        className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0 mt-0.5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── Provider ──────────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback(({ type = 'info', title, message, duration = 3500 }) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, type, title, message }])
    setTimeout(() => remove(id), duration)
    return id
  }, [remove])

  // Atajos
  const success = useCallback((title, message) => toast({ type: 'success', title, message }), [toast])
  const error   = useCallback((title, message) => toast({ type: 'error',   title, message }), [toast])
  const warning = useCallback((title, message) => toast({ type: 'warning', title, message }), [toast])
  const info    = useCallback((title, message) => toast({ type: 'info',    title, message }), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}

      {/* Contenedor de toasts — esquina inferior derecha */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end">
        <style>{`
          @keyframes slideIn {
            from { opacity: 0; transform: translateX(100%); }
            to   { opacity: 1; transform: translateX(0); }
          }
        `}</style>
        {toasts.map(t => (
          <Toast key={t.id} {...t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
