import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase/client'
import { useCart } from '../context/CartContext'
import { generateInvoicePDF } from '../services/invoicePDF'
import { redownloadBudgetPDF, generateClientBudgetPDF, generateClientInvoicePDF } from '../services/pdf'

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
const fmtDate = (d) => d ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—'

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className={`rounded-xl p-5 border ${accent ? 'bg-red-700 border-red-600 text-white' : 'bg-white border-gray-200'}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${accent ? 'bg-red-600' : 'bg-gray-50'}`}>
        <svg className={`w-5 h-5 ${accent ? 'text-red-200' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">{icon}</svg>
      </div>
      <p className={`text-2xl font-black mb-0.5 ${accent ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      <p className={`text-sm font-medium ${accent ? 'text-red-200' : 'text-gray-700'}`}>{label}</p>
      {sub && <p className={`text-xs mt-0.5 ${accent ? 'text-red-300' : 'text-gray-400'}`}>{sub}</p>}
    </div>
  )
}

function EditField({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 transition-colors" />
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    pending:   { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700' },
    confirmed: { label: 'Confirmado', cls: 'bg-blue-100 text-blue-700'   },
    completed: { label: 'Completado', cls: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelado',  cls: 'bg-red-100 text-red-700'     },
  }
  const { label, cls } = map[status] ?? { label: status ?? '—', cls: 'bg-gray-100 text-gray-600' }
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
}

function EmptyState({ label, action, to }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      <Link to={to} className="inline-block mt-4 px-5 py-2.5 bg-red-700 text-white text-sm font-bold rounded-xl hover:bg-red-800 transition-colors">
        {action}
      </Link>
    </div>
  )
}

function AddToCartFromDashboard({ configId }) {
  const { addToCart } = useCart()
  const [status, setStatus] = useState('idle')

  async function handleAdd() {
    setStatus('loading')
    const { error } = await addToCart(configId)
    setStatus(error ? 'error' : 'done')
    setTimeout(() => setStatus('idle'), 2500)
  }

  return (
    <button onClick={handleAdd} disabled={status === 'loading'}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
        status === 'done'  ? 'bg-green-100 text-green-700' :
        status === 'error' ? 'bg-red-100 text-red-700' :
        'bg-gray-100 hover:bg-gray-200 text-gray-700'
      }`}>
      {status === 'loading' && <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />}
      {status === 'done'    && '✓ Añadido'}
      {status === 'error'   && 'Error'}
      {status === 'idle'    && <>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        Añadir
      </>}
    </button>
  )
}

const TABS = [
  { id: 'overview',        label: 'Resumen',         icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /> },
  { id: 'configuraciones', label: 'Configuraciones', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /> },
  { id: 'pedidos',         label: 'Pedidos',         icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /> },
  { id: 'presupuestos',    label: 'Presupuestos',    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
  { id: 'facturas',        label: 'Facturas',        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /> },
  { id: 'empresa',         label: 'Mi empresa',      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /> },
]

function ClientBudgetModal({ config, logoUrl, onGenerate, onClose }) {
  const [clientName,    setClientName]    = useState('')
  const [clientPhone,   setClientPhone]   = useState('')
  const [clientEmail,   setClientEmail]   = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientPrice,   setClientPrice]   = useState('')
  const [generating,    setGenerating]    = useState(false)
  const [errors,        setErrors]        = useState({})

  const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n ?? 0)

  async function handleGenerate() {
    const e = {}
    if (!clientName.trim())  e.name  = 'Obligatorio'
    if (!clientPrice || isNaN(parseFloat(clientPrice)) || parseFloat(clientPrice) <= 0) e.price = 'Introduce un precio válido'
    if (Object.keys(e).length) { setErrors(e); return }

    setGenerating(true)
    await onGenerate(
      { ...config, productType: config.blind_type, blindType: config.blind_type },
      parseFloat(clientPrice),
      { name: clientName, phone: clientPhone, email: clientEmail, address: clientAddress }
    )
    setGenerating(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Presupuesto para tu cliente</h2>
            <p className="text-xs text-gray-400 mt-0.5">Se generará con tu logo y datos de empresa</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Resumen configuración */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm">
            <p className="font-semibold text-gray-700">{config.blind_type === 'blocking' ? 'Autoblocante' : config.blind_type ?? 'Persiana'}</p>
            <p className="text-gray-400 text-xs">{config.width} × {config.height} mm · {config.mechanism} · {config.box_color_name}</p>
          </div>

          {/* Precio que cobra al cliente */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Precio para el cliente (con IVA) *
            </label>
            <div className="relative">
              <input
                type="number" min="0" step="0.01"
                value={clientPrice}
                onChange={e => { setClientPrice(e.target.value); setErrors(p => ({...p, price: ''})) }}
                placeholder="0,00"
                className={`w-full px-3.5 py-2.5 pr-8 rounded-xl border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${errors.price ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
            </div>
            {errors.price && <p className="text-xs text-red-600 mt-1">{errors.price}</p>}
            {clientPrice && !isNaN(parseFloat(clientPrice)) && (
              <p className="text-xs text-gray-400 mt-1">
                Base imponible: {fmt(parseFloat(clientPrice) / 1.21)} · IVA: {fmt(parseFloat(clientPrice) - parseFloat(clientPrice) / 1.21)}
              </p>
            )}
          </div>

          <hr className="border-gray-100" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos del cliente</p>

          {[
            { label: 'Nombre *', value: clientName,    set: setClientName,    err: errors.name,  placeholder: 'Juan García' },
            { label: 'Teléfono', value: clientPhone,   set: setClientPhone,   placeholder: '600 123 456' },
            { label: 'Email',    value: clientEmail,   set: setClientEmail,   placeholder: 'cliente@email.com' },
            { label: 'Dirección',value: clientAddress, set: setClientAddress, placeholder: 'Calle Mayor 1' },
          ].map(({ label, value, set, err, placeholder }) => (
            <div key={label}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
              <input
                type="text" value={value} placeholder={placeholder}
                onChange={e => { set(e.target.value); if (err) setErrors(p => ({...p, name: ''})) }}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${err ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
              />
              {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
            </div>
          ))}

          {!logoUrl && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
              No tienes logo subido. Ve a "Mi empresa" para añadirlo.
            </div>
          )}

          <button onClick={handleGenerate} disabled={generating}
            className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {generating
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generando…</>
              : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> Descargar PDF</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

function ClientInvoiceModal({ config, logoUrl, onGenerate, onClose }) {
  const [clientName,     setClientName]     = useState('')
  const [clientPhone,    setClientPhone]    = useState('')
  const [clientEmail,    setClientEmail]    = useState('')
  const [clientAddress,  setClientAddress]  = useState('')
  const [clientNif,      setClientNif]      = useState('')
  const [clientPrice,    setClientPrice]    = useState('')
  const [invoiceNumber,  setInvoiceNumber]  = useState(`F-${Date.now().toString().slice(-6)}`)
  const [generating,     setGenerating]     = useState(false)
  const [errors,         setErrors]         = useState({})

  const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n ?? 0)

  async function handleGenerate() {
    const e = {}
    if (!clientName.trim()) e.name = 'Obligatorio'
    if (!clientPrice || isNaN(parseFloat(clientPrice)) || parseFloat(clientPrice) <= 0) e.price = 'Introduce un precio válido'
    if (Object.keys(e).length) { setErrors(e); return }
    setGenerating(true)
    await onGenerate(
      { ...config, productType: config.blind_type, blindType: config.blind_type },
      parseFloat(clientPrice),
      { name: clientName, phone: clientPhone, email: clientEmail, address: clientAddress, nif: clientNif },
      invoiceNumber
    )
    setGenerating(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Factura para tu cliente</h2>
            <p className="text-xs text-gray-400 mt-0.5">Se generará con tu logo y datos de empresa</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm">
            <p className="font-semibold text-gray-700">{config.blind_type ?? 'Persiana'}</p>
            <p className="text-gray-400 text-xs">{config.width} × {config.height} mm · {config.mechanism}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Nº de factura</label>
            <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Importe total (con IVA) *</label>
            <div className="relative">
              <input type="number" min="0" step="0.01" value={clientPrice}
                onChange={e => { setClientPrice(e.target.value); setErrors(p => ({...p, price: ''})) }}
                placeholder="0,00"
                className={`w-full px-3.5 py-2.5 pr-8 rounded-xl border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${errors.price ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
            </div>
            {errors.price && <p className="text-xs text-red-600 mt-1">{errors.price}</p>}
            {clientPrice && !isNaN(parseFloat(clientPrice)) && (
              <p className="text-xs text-gray-400 mt-1">
                Base: {fmt(parseFloat(clientPrice) / 1.21)} · IVA: {fmt(parseFloat(clientPrice) - parseFloat(clientPrice) / 1.21)}
              </p>
            )}
          </div>

          <hr className="border-gray-100" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos del cliente / receptor</p>

          {[
            { label: 'Nombre *',   value: clientName,    set: setClientName,    err: errors.name, placeholder: 'Juan García' },
            { label: 'NIF / DNI',  value: clientNif,     set: setClientNif,     placeholder: '12345678A' },
            { label: 'Teléfono',   value: clientPhone,   set: setClientPhone,   placeholder: '600 123 456' },
            { label: 'Email',      value: clientEmail,   set: setClientEmail,   placeholder: 'cliente@email.com' },
            { label: 'Dirección',  value: clientAddress, set: setClientAddress, placeholder: 'Calle Mayor 1' },
          ].map(({ label, value, set, err, placeholder }) => (
            <div key={label}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
              <input type="text" value={value} placeholder={placeholder}
                onChange={e => { set(e.target.value); if (err) setErrors(p => ({...p, name: ''})) }}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${err ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
              {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
            </div>
          ))}

          {!logoUrl && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
              No tienes logo subido. Ve a "Mi empresa" para añadirlo.
            </div>
          )}

          <button onClick={handleGenerate} disabled={generating}
            className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {generating
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generando…</>
              : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> Descargar factura PDF</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProfessionalDashboard() {
  const navigate = useNavigate()
  const { itemCount } = useCart()
  const [activeTab,       setActiveTab]       = useState('overview')
  const [user,            setUser]            = useState(null)
  const [empresa,         setEmpresa]         = useState(null)
  const [configuraciones, setConfiguraciones] = useState([])
  const [pedidos,         setPedidos]         = useState([])
  const [presupuestos,    setPresupuestos]    = useState([])
  const [facturas,        setFacturas]        = useState([])
  const [loading,         setLoading]         = useState(true)
  const [savingEmpresa,   setSavingEmpresa]   = useState(false)
  const [empresaEdit,     setEmpresaEdit]     = useState({})
  const [saveMsg,         setSaveMsg]         = useState('')
  const [showEmpresaModal, setShowEmpresaModal] = useState(false)
  const [empresaErrors,    setEmpresaErrors]    = useState({})
  const [logoUrl,          setLogoUrl]          = useState(null)
  const [uploadingLogo,    setUploadingLogo]    = useState(false)
  const [clientBudgetModal,  setClientBudgetModal]  = useState(null)
  const [clientInvoiceModal, setClientInvoiceModal] = useState(null)

  const REQUIRED_FIELDS = ['razon_social', 'cif_nif', 'telefono', 'direccion_fiscal', 'codigo_postal', 'ciudad', 'provincia', 'email_facturacion']

  function empresaCompleta(data) {
    return data && REQUIRED_FIELDS.every(f => data[f]?.toString().trim())
  }

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }
      setUser(user)
      const [empresaRes, configRes, pedidosRes, presupuestosRes, facturasRes] = await Promise.all([
        supabase.from('professional_data').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('blind_configurations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('budgets').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ])
      const emp = empresaRes.data ?? null
      setEmpresa(emp)
      setEmpresaEdit(emp ?? {})
      setConfiguraciones(configRes.data ?? [])
      setPedidos(pedidosRes.data ?? [])
      setPresupuestos(presupuestosRes.data ?? [])
      setFacturas(facturasRes.data ?? [])
      // Cargar logo si existe
      if (user.id) {
        const { data: logoData } = supabase.storage
          .from('professional-logos')
          .getPublicUrl(`${user.id}/logo`)
        if (logoData?.publicUrl) setLogoUrl(logoData.publicUrl + `?t=${Date.now()}`)
      }
      // Si no tiene datos completos, mostrar modal obligatorio
      if (!empresaCompleta(emp)) setShowEmpresaModal(true)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveEmpresa(fromModal = false) {
    // Validar campos obligatorios
    const errors = {}
    REQUIRED_FIELDS.forEach(f => {
      if (!empresaEdit[f]?.toString().trim()) errors[f] = 'Campo obligatorio'
    })
    if (Object.keys(errors).length) { setEmpresaErrors(errors); return }
    setEmpresaErrors({})

    setSavingEmpresa(true)
    const { error } = await supabase.from('professional_data').upsert({ ...empresaEdit, user_id: user.id })
    setSavingEmpresa(false)
    if (error) {
      setSaveMsg('Error al guardar')
    } else {
      setEmpresa(empresaEdit)
      setSaveMsg('Guardado correctamente')
      if (fromModal) setShowEmpresaModal(false)
    }
    setTimeout(() => setSaveMsg(''), 3000)
  }

  async function handleDeleteBudget(id) {
    await supabase.from('budgets').delete().eq('id', id)
    setPresupuestos(prev => prev.filter(p => p.id !== id))
  }

  async function handleDeleteConfig(id) {
    await supabase.from('blind_configurations').delete().eq('id', id)
    setConfiguraciones(prev => prev.filter(c => c.id !== id))
  }

  async function handleUploadLogo(file) {
    if (!file || !user) return
    setUploadingLogo(true)
    try {
      const { error } = await supabase.storage
        .from('professional-logos')
        .upload(`${user.id}/logo`, file, { upsert: true, contentType: file.type })
      if (!error) {
        const { data } = supabase.storage
          .from('professional-logos')
          .getPublicUrl(`${user.id}/logo`)
        setLogoUrl(data.publicUrl + `?t=${Date.now()}`)
      }
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleGenerateClientBudget(config, clientPrice, clientData) {
    await generateClientBudgetPDF({
      customerData: clientData,
      configuration: config,
      empresa: empresa ?? {},
      logoUrl,
      clientPrice,
    })
  }

  async function handleGenerateClientInvoice(config, clientPrice, clientData, invoiceNumber) {
    await generateClientInvoicePDF({
      customerData: clientData,
      configuration: config,
      empresa: empresa ?? {},
      logoUrl,
      clientPrice,
      invoiceNumber,
    })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  const totalFacturado = pedidos.filter(p => p.status === 'completed').reduce((a, p) => a + (p.total_with_iva ?? 0), 0)

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src="/persianassantanderlogo.png" alt="Persianas Santander" className="h-9 w-auto" onError={e => { e.target.src = '/persianassantanderlogo.svg' }} />
              <div className="hidden sm:block h-6 w-px bg-gray-200" />
              <span className="hidden sm:block text-sm font-semibold text-gray-700">Panel profesional</span>
              <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">−{empresa?.discount_percent ?? 20}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/cesta" className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-700 text-white text-xs font-bold rounded-full flex items-center justify-center">{itemCount}</span>
                )}
              </Link>
              <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <div className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">
                  {empresa?.razon_social?.[0] ?? user?.email?.[0]?.toUpperCase() ?? 'P'}
                </div>
                <span className="text-sm text-gray-600 max-w-[160px] truncate">{empresa?.razon_social ?? user?.email}</span>
              </div>
              <Link to="/configurador" className="text-sm font-bold bg-red-700 text-white px-4 py-2 rounded-xl hover:bg-red-800 transition-colors">+ Nueva</Link>
              <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">Salir</button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-56 flex-shrink-0">
            <nav className="bg-white rounded-xl border border-gray-200 overflow-hidden flex lg:flex-col overflow-x-auto">
              {TABS.map(({ id, label, icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left border-b border-gray-100 last:border-0 whitespace-nowrap lg:whitespace-normal flex-shrink-0 lg:flex-shrink ${
                    activeTab === id ? 'bg-red-50 text-red-700 border-l-2 border-l-red-700' : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">{icon}</svg>
                  <span className="hidden sm:block">{label}</span>
                </button>
              ))}
            </nav>
          </aside>

          <main className="flex-1 min-w-0">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Bienvenido{empresa?.razon_social ? `, ${empresa.razon_social}` : ''}</h1>
                  <p className="text-gray-500 text-sm mt-1">Resumen de tu actividad profesional.</p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard accent value={`−${empresa?.discount_percent ?? 20}%`} label="Descuento activo" sub="Tarifa profesional" icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />} />
                  <StatCard value={configuraciones.length} label="Configuraciones" sub="guardadas" icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />} />
                  <StatCard value={pedidos.length} label="Pedidos" sub="realizados" icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />} />
                  <StatCard value={fmt(totalFacturado)} label="Total facturado" sub="con IVA" icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />} />
                </div>
                {itemCount > 0 && (
                  <Link to="/cesta" className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-5 py-4 hover:bg-red-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-700 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-bold text-red-900 text-sm">Tienes {itemCount} producto{itemCount > 1 ? 's' : ''} en la cesta</p>
                        <p className="text-xs text-red-600">Finaliza tu pedido</p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
                {configuraciones.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="font-bold text-gray-900 text-sm">Últimas configuraciones</h3>
                      <button onClick={() => setActiveTab('configuraciones')} className="text-xs text-red-700 hover:underline">Ver todas</button>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {configuraciones.slice(0, 4).map(c => (
                        <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{c.blind_type === 'blocking' ? 'Bloqueante' : 'Estándar'} — {c.mechanism}</p>
                            <p className="text-xs text-gray-400">{c.width} × {c.height} mm · {fmtDate(c.created_at)}</p>
                          </div>
                          <span className="text-sm font-bold text-red-700 flex-shrink-0">{fmt(c.estimated_price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'configuraciones' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Mis configuraciones</h2>
                  <Link to="/configurador" className="text-sm font-bold bg-red-700 text-white px-4 py-2 rounded-xl hover:bg-red-800 transition-colors">+ Nueva</Link>
                </div>
                {configuraciones.length === 0 ? (
                  <EmptyState label="No tienes configuraciones guardadas" action="Crear configuración" to="/configurador" />
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Medidas</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Fecha</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Precio</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {configuraciones.map(c => (
                          <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3">
                              <p className="font-semibold text-gray-900">{c.blind_type === 'blocking' ? 'Bloqueante' : 'Estándar'}</p>
                              <p className="text-xs text-gray-400">{c.mechanism}</p>
                            </td>
                            <td className="px-5 py-3 text-gray-600 hidden md:table-cell">{c.width} × {c.height} mm</td>
                            <td className="px-5 py-3 text-gray-400 hidden lg:table-cell">{fmtDate(c.created_at)}</td>
                            <td className="px-5 py-3 text-right font-bold text-red-700">{fmt(c.estimated_price)}</td>
                            <td className="px-5 py-3 text-right">
                              <div className="inline-flex items-center gap-2">
                                <button onClick={() => setClientBudgetModal(c)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Presupuesto
                                </button>
                                <button onClick={() => setClientInvoiceModal(c)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg transition-colors">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                  Factura
                                </button>
                                <AddToCartFromDashboard configId={c.id} />
                                <button onClick={() => handleDeleteConfig(c.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'pedidos' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Mis pedidos</h2>
                  <Link to="/cesta" className="flex items-center gap-2 text-sm font-bold bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Ver cesta {itemCount > 0 && `(${itemCount})`}
                  </Link>
                </div>
                {pedidos.length === 0 ? (
                  <EmptyState label="No tienes pedidos todavía" action="Ir al configurador" to="/configurador" />
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Fecha</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {pedidos.map(p => (
                          <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3 font-mono text-xs text-gray-600">#{p.id.slice(0,8).toUpperCase()}</td>
                            <td className="px-5 py-3 text-gray-400 hidden md:table-cell">{fmtDate(p.created_at)}</td>
                            <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                            <td className="px-5 py-3 text-right font-bold text-gray-900">{fmt(p.total_with_iva)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'presupuestos' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900">Mis presupuestos</h2>
                {presupuestos.length === 0 ? (
                  <EmptyState label="No tienes presupuestos todavía" action="Ir al configurador" to="/configurador" />
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nº Presupuesto</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Fecha</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {presupuestos.map(p => (
                          <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3 font-mono text-xs text-gray-600">{p.budget_number ?? `#${p.id.slice(0,8).toUpperCase()}`}</td>
                            <td className="px-5 py-3 text-gray-400 hidden md:table-cell">{fmtDate(p.created_at)}</td>
                            <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                            <td className="px-5 py-3 text-right font-bold text-gray-900">{fmt(p.total_with_iva)}</td>
                            <td className="px-5 py-3 text-right">
                              <div className="inline-flex items-center gap-2">
                                <button onClick={() => redownloadBudgetPDF(p)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                  PDF
                                </button>
                                <button onClick={() => handleDeleteBudget(p.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'facturas' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900">Mis facturas</h2>
                {facturas.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <p className="font-semibold text-gray-900 mb-1">No hay facturas todavía</p>
                    <p className="text-gray-400 text-sm">Aparecerán aquí cuando la fábrica las genere.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nº Factura</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Fecha</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pago</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">PDF</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {facturas.map(f => (
                          <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3 font-mono text-xs text-gray-600">{f.invoice_number}</td>
                            <td className="px-5 py-3 text-gray-400 hidden md:table-cell">{fmtDate(f.created_at)}</td>
                            <td className="px-5 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                f.payment_status === 'paid'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {f.payment_status === 'paid' ? 'Pagada' : 'Pendiente de pago'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right font-bold text-gray-900">{fmt(f.total_with_iva)}</td>
                            <td className="px-5 py-3 text-right">
                              <DownloadInvoiceButton invoice={f} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'empresa' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Datos de empresa</h2>
                  {saveMsg && (
                    <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${saveMsg.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{saveMsg}</span>
                  )}
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <EditField label="Razón social" value={empresaEdit.razon_social ?? ''} onChange={v => setEmpresaEdit(p => ({...p, razon_social: v}))} />
                    </div>
                    <EditField label="CIF / NIF" value={empresaEdit.cif_nif ?? ''} onChange={v => setEmpresaEdit(p => ({...p, cif_nif: v}))} />
                    <EditField label="Teléfono" value={empresaEdit.telefono ?? ''} onChange={v => setEmpresaEdit(p => ({...p, telefono: v}))} />
                    <div className="sm:col-span-2">
                      <EditField label="Dirección fiscal" value={empresaEdit.direccion_fiscal ?? ''} onChange={v => setEmpresaEdit(p => ({...p, direccion_fiscal: v}))} />
                    </div>
                    <EditField label="Código postal" value={empresaEdit.codigo_postal ?? ''} onChange={v => setEmpresaEdit(p => ({...p, codigo_postal: v}))} />
                    <EditField label="Ciudad" value={empresaEdit.ciudad ?? ''} onChange={v => setEmpresaEdit(p => ({...p, ciudad: v}))} />
                    <div className="sm:col-span-2">
                      <EditField label="Provincia" value={empresaEdit.provincia ?? ''} onChange={v => setEmpresaEdit(p => ({...p, provincia: v}))} />
                    </div>
                    <div className="sm:col-span-2">
                      <EditField label="Email de facturación" type="email" value={empresaEdit.email_facturacion ?? ''} onChange={v => setEmpresaEdit(p => ({...p, email_facturacion: v}))} />
                    </div>
                  </div>
                  <div className="mt-6 pt-5 border-t border-gray-100 flex justify-end">
                    <button onClick={handleSaveEmpresa} disabled={savingEmpresa}
                      className="px-6 py-2.5 bg-red-700 text-white rounded-xl text-sm font-bold hover:bg-red-800 transition-colors disabled:opacity-60 flex items-center gap-2">
                      {savingEmpresa && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      Guardar cambios
                    </button>
                  </div>
                </div>
                {/* Logo de empresa */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Logo de empresa</p>
                  <p className="text-xs text-gray-400 mb-4">Aparecerá en los presupuestos que generes para tus clientes.</p>
                  <div className="flex items-center gap-4">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo empresa" className="h-16 w-auto max-w-[160px] object-contain border border-gray-200 rounded-lg p-1" />
                    ) : (
                      <div className="h-16 w-32 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-300">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div>
                      <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${uploadingLogo ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-400' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                        {uploadingLogo
                          ? <><span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> Subiendo…</>
                          : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> {logoUrl ? 'Cambiar logo' : 'Subir logo'}</>
                        }
                        <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo}
                          onChange={e => e.target.files?.[0] && handleUploadLogo(e.target.files[0])} />
                      </label>
                      <p className="text-xs text-gray-400 mt-1.5">PNG, JPG o SVG · Máx. 2 MB</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cuenta</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-sm">{user?.email?.[0]?.toUpperCase()}</div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{user?.email}</p>
                      <p className="text-xs text-gray-400">Cuenta profesional · Descuento {empresa?.discount_percent ?? 20}% activo</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ── MODAL PRESUPUESTO PARA CLIENTE ── */}
      {clientBudgetModal && (
        <ClientBudgetModal
          config={clientBudgetModal}
          logoUrl={logoUrl}
          onGenerate={handleGenerateClientBudget}
          onClose={() => setClientBudgetModal(null)}
        />
      )}

      {/* ── MODAL FACTURA PARA CLIENTE ── */}
      {clientInvoiceModal && (
        <ClientInvoiceModal
          config={clientInvoiceModal}
          logoUrl={logoUrl}
          onGenerate={handleGenerateClientInvoice}
          onClose={() => setClientInvoiceModal(null)}
        />
      )}

      {/* ── MODAL OBLIGATORIO DATOS EMPRESA ── */}
      {showEmpresaModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">Completa los datos de tu empresa</h2>
                  <p className="text-xs text-gray-500">Necesarios para emitir facturas y presupuestos</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {saveMsg && (
                <div className={`text-xs font-semibold px-3 py-2 rounded-xl ${saveMsg.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                  {saveMsg}
                </div>
              )}
              {[
                { label: 'Razón social *',        field: 'razon_social',       colSpan: 2 },
                { label: 'CIF / NIF *',            field: 'cif_nif',            colSpan: 1 },
                { label: 'Teléfono *',             field: 'telefono',           colSpan: 1 },
                { label: 'Dirección fiscal *',     field: 'direccion_fiscal',   colSpan: 2 },
                { label: 'Código postal *',        field: 'codigo_postal',      colSpan: 1 },
                { label: 'Ciudad *',               field: 'ciudad',             colSpan: 1 },
                { label: 'Provincia *',            field: 'provincia',          colSpan: 2 },
                { label: 'Email de facturación *', field: 'email_facturacion',  colSpan: 2, type: 'email' },
              ].map(({ label, field, colSpan, type = 'text' }) => (
                <div key={field} className={colSpan === 2 ? '' : 'inline-block w-[calc(50%-0.5rem)]'}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  <input
                    type={type}
                    value={empresaEdit[field] ?? ''}
                    onChange={e => { setEmpresaEdit(p => ({...p, [field]: e.target.value})); setEmpresaErrors(p => ({...p, [field]: ''})) }}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition-colors ${
                      empresaErrors[field] ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  {empresaErrors[field] && <p className="text-xs text-red-600 mt-0.5">{empresaErrors[field]}</p>}
                </div>
              ))}
              <button onClick={() => handleSaveEmpresa(true)} disabled={savingEmpresa}
                className="w-full py-3.5 bg-red-700 hover:bg-red-800 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
                {savingEmpresa && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Guardar y acceder al panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DownloadInvoiceButton({ invoice }) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    const [orderRes, empresaRes] = await Promise.all([
      supabase.from('orders').select('*').eq('id', invoice.order_id).maybeSingle(),
      supabase.from('professional_data').select('*').eq('user_id', invoice.user_id).maybeSingle(),
    ])
    generateInvoicePDF(invoice, orderRes.data ?? {}, empresaRes.data ?? null)
    setLoading(false)
  }

  return (
    <button onClick={handleDownload} disabled={loading}
      className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800 transition-colors">
      {loading
        ? <span className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
        : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
      }
      PDF
    </button>
  )
}