import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import WAButton from '../shared/WAButton'

import { useProData } from '../features/pro/hooks/useProData'
import { TABS, QUOTE_STATUS, fmt, fmtDate, REQUIRED_EMPRESA } from '../features/pro/constants'

import CotizacionesTab from '../features/pro/tabs/CotizacionesTab'
import MensajesTab from '../features/pro/tabs/MensajesTab'
import PedidosTab from '../features/pro/tabs/PedidosTab'
import FacturasTab from '../features/pro/tabs/FacturasTab'
import ProyectosTab from '../features/pro/tabs/ProyectosTab'
import EmpresaTab from '../features/pro/tabs/EmpresaTab'
import ConfiguracionesTab from '../features/pro/tabs/ConfiguracionesTab'
import PresupuestosClienteTab from '../features/pro/tabs/PresupuestosClienteTab'

// ── Página principal ──────────────────────────────────────────────────────
export default function ProfessionalDashboard() {
  const navigate        = useNavigate()
  const location        = useLocation()
  const [searchParams]  = useSearchParams()
  const { itemCount }   = useCart()
  const tabParam    = searchParams.get('tab')
  const newOrderId  = searchParams.get('new')
  const VALID_TABS  = TABS.map(t => t.id)
  const resolveTab  = (p) => p === 'facturas' ? 'pedidos' : (VALID_TABS.includes(p) ? p : 'cotizaciones')
  const [activeTab,      setActiveTab]      = useState(() => {
    const stateTab = location.state?.tab
    if (stateTab && VALID_TABS.includes(stateTab)) return stateTab
    return resolveTab(tabParam)
  })

  useEffect(() => {
    if (!tabParam) return
    const valid = VALID_TABS.includes(tabParam) ? tabParam : 'overview'
    setActiveTab(tabParam === 'facturas' ? 'pedidos' : valid)
  }, [tabParam])

  const [menuOpen, setMenuOpen] = useState(false)

  const {
    user, empresa, setEmpresa,
    configuraciones, setConfiguraciones,
    cotizaciones, setCotizaciones,
    pedidos, facturas,
    unreadMsgs, setUnreadMsgs,
    logoUrl, setLogoUrl,
    loading,
    globalDiscount,
    showEmpresaModal, setShowEmpresaModal,
    empresaCompleta,
    loadData,
    handleLogout,
  } = useProData()

  useEffect(() => { loadData() }, [])

  const totalFacturado = pedidos.filter(p => p.status === 'completed').reduce((a, p) => a + (p.total_with_iva ?? 0), 0)

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src="/persianassantanderlogo.png" alt="Persianas Santander" className="h-9 w-auto cursor-pointer" onClick={() => navigate('/')} onError={e => { e.target.src = '/persianassantanderlogo.svg' }} />
              <div className="hidden sm:block h-6 w-px bg-gray-200" />
              <span className="hidden sm:block text-sm font-semibold text-gray-700">Panel profesional</span>
              {globalDiscount > 0 && (
                <span className="inline-flex bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  −{globalDiscount}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link to="/cesta" className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
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
                <span className="text-sm text-gray-600 max-w-[120px] sm:max-w-[160px] truncate">{empresa?.razon_social ?? user?.email}</span>
              </div>
              <Link to="/configurador" className="text-sm font-bold bg-red-700 text-white px-4 py-2 rounded-xl hover:bg-red-800 transition-colors">
                <span className="hidden sm:inline">+ Nueva</span>
                <span className="sm:hidden">+</span>
              </Link>
              <button onClick={handleLogout} className="hidden sm:block p-2 text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors text-sm font-medium px-3">
                Salir
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <aside className="lg:w-52 flex-shrink-0">
            {/* Mobile dropdown */}
            <div className="lg:hidden relative mb-4">
              <button onClick={() => setMenuOpen(v => !v)}
                className="w-full bg-white rounded-xl border border-gray-200 flex items-center justify-between px-4 py-3 text-sm font-medium shadow-sm">
                <span className="flex items-center gap-3 text-red-700 font-semibold">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={TABS.find(t => t.id === activeTab)?.icon} />
                  </svg>
                  {TABS.find(t => t.id === activeTab)?.label}
                </span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuOpen && (
                <nav className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden">
                  {TABS.map(({ id, label, icon }) => (
                    <button key={id} onClick={() => { setActiveTab(id); setMenuOpen(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-left border-b border-gray-100 transition-colors ${activeTab === id ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
                      </svg>
                      {label}
                      {id === 'cotizaciones' && cotizaciones.filter(c => c.status === 'pending').length > 0 && (
                        <span className="ml-auto text-xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{cotizaciones.filter(c => c.status === 'pending').length}</span>
                      )}
                      {id === 'mensajes' && unreadMsgs > 0 && (
                        <span className="ml-auto text-xs font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-full">{unreadMsgs}</span>
                      )}
                    </button>
                  ))}
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-left text-red-600 hover:bg-red-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Salir
                  </button>
                </nav>
              )}
            </div>

            {/* Desktop sidebar */}
            <nav className="hidden lg:flex lg:flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {TABS.map(({ id, label, icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-left border-b border-gray-100 last:border-0 transition-colors ${
                    activeTab === id
                      ? 'bg-red-50 text-red-700 border-l-2 border-l-red-700 pl-3.5'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
                  </svg>
                  {label}
                  {id === 'cotizaciones' && cotizaciones.filter(c => c.status === 'pending').length > 0 && (
                    <span className="ml-auto text-xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{cotizaciones.filter(c => c.status === 'pending').length}</span>
                  )}
                  {id === 'mensajes' && unreadMsgs > 0 && (
                    <span className="ml-auto text-xs font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-full">{unreadMsgs}</span>
                  )}
                  {id === 'configuraciones' && configuraciones.length > 0 && (
                    <span className="ml-auto text-xs font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{configuraciones.length}</span>
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {/* Contenido */}
          <main className="flex-1 min-w-0">
            {/* ── RESUMEN ── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {empresa?.razon_social ? `Hola, ${empresa.razon_social}` : 'Panel profesional'}
                  </h1>
                  <p className="text-gray-500 text-sm mt-1">Resumen de tu actividad.</p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    globalDiscount > 0 ? { label: 'Descuento activo', value: `−${globalDiscount}%`, sub: 'Tarifa profesional', accent: true } : null,
                    { label: 'Cotizaciones', value: cotizaciones.length, sub: `${cotizaciones.filter(c => c.client_status === 'accepted').length} aceptadas por cliente`, tab: 'cotizaciones' },
                    { label: 'Pedidos', value: pedidos.length, sub: `${pedidos.filter(p => p.status === 'completed').length} completados`, tab: 'pedidos' },
                    { label: 'Total facturado', value: fmt(totalFacturado), sub: 'pedidos completados' },
                  ].filter(Boolean).map(({ label, value, sub, accent, tab }) => (
                    <div key={label} onClick={() => tab && setActiveTab(tab)}
                      className={`rounded-2xl p-5 border ${accent ? 'bg-red-700 border-red-600' : 'bg-white border-gray-200'} ${tab ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
                      <p className={`text-2xl font-black mb-0.5 ${accent ? 'text-white' : 'text-gray-900'}`}>{value}</p>
                      <p className={`text-sm font-medium ${accent ? 'text-red-200' : 'text-gray-700'}`}>{label}</p>
                      {sub && <p className={`text-xs mt-0.5 ${accent ? 'text-red-300' : 'text-gray-400'}`}>{sub}</p>}
                    </div>
                  ))}
                </div>

                {!empresaCompleta(empresa) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-amber-800">Completa los datos de tu empresa</p>
                      <p className="text-sm text-amber-600 mt-0.5">Necesarios para que aparezcan en facturas y presupuestos.</p>
                    </div>
                    <button onClick={() => setActiveTab('empresa')}
                      className="flex-shrink-0 px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 transition-colors">
                      Completar →
                    </button>
                  </div>
                )}

                {itemCount > 0 && (
                  <Link to="/cesta" className="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl px-5 py-4 hover:bg-red-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-700 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-bold text-red-900 text-sm">{itemCount} producto{itemCount > 1 ? 's' : ''} en la cesta</p>
                        <p className="text-xs text-red-600">Finaliza tu pedido</p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}

                {/* Últimas cotizaciones */}
                {cotizaciones.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900 text-sm">Últimas cotizaciones</h3>
                      <button onClick={() => setActiveTab('cotizaciones')} className="text-xs font-semibold text-red-700 hover:underline">Ver todas</button>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {cotizaciones.slice(0, 4).map(q => {
                        const st = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.pending
                        return (
                          <div key={q.id} className="px-5 py-3 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900">{(q.items ?? []).length} persiana{(q.items ?? []).length !== 1 ? 's' : ''}</p>
                              <p className="text-xs text-gray-400">{fmtDate(q.created_at)}</p>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                              <span className="font-bold text-red-700 text-sm">{fmt(q.admin_total_con_iva ?? q.total_con_iva ?? 0)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── COTIZACIONES Y CLIENTES ── */}
            {activeTab === 'cotizaciones' && (
              <CotizacionesTab
                cotizaciones={cotizaciones}
                configuraciones={configuraciones}
                setConfiguraciones={setConfiguraciones}
                onDelete={id => setCotizaciones(prev => prev.filter(q => q.id !== id))}
                onUpdate={(id, updates) => setCotizaciones(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q))}
                logoUrl={logoUrl}
                globalDiscount={globalDiscount}
                proInfo={{
                  razon_social:     empresa?.razon_social     ?? null,
                  cif_nif:          empresa?.cif_nif          ?? null,
                  direccion_fiscal: empresa?.direccion_fiscal ?? null,
                  codigo_postal:    empresa?.codigo_postal    ?? null,
                  ciudad:           empresa?.ciudad           ?? null,
                  provincia:        empresa?.provincia        ?? null,
                  telefono:         empresa?.telefono         ?? null,
                  email:            empresa?.email_facturacion ?? user?.email ?? null,
                }}
              />
            )}

            {/* ── MENSAJES ── */}
            {activeTab === 'mensajes' && (
              <MensajesTab
                userId={user.id}
                onRead={() => setUnreadMsgs(0)}
              />
            )}

            {/* ── PEDIDOS ── */}
            {activeTab === 'pedidos' && <PedidosTab pedidos={pedidos} facturas={facturas} newOrderId={newOrderId} proData={empresa} />}

            {/* ── EMPRESA ── */}
            {activeTab === 'empresa' && (
              <EmpresaTab empresa={empresa} setEmpresa={setEmpresa} user={user} logoUrl={logoUrl} setLogoUrl={setLogoUrl} />
            )}

            {/* ── MIS PRESUPUESTOS ── */}
            {activeTab === 'presupuestos' && (
              <PresupuestosClienteTab
                cotizaciones={cotizaciones}
                onUpdate={(id, updates) => setCotizaciones(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q))}
                logoUrl={logoUrl}
                proInfo={{
                  razon_social:     empresa?.razon_social     ?? null,
                  cif_nif:          empresa?.cif_nif          ?? null,
                  direccion_fiscal: empresa?.direccion_fiscal ?? null,
                  codigo_postal:    empresa?.codigo_postal    ?? null,
                  ciudad:           empresa?.ciudad           ?? null,
                  provincia:        empresa?.provincia        ?? null,
                  telefono:         empresa?.telefono         ?? null,
                  email:            empresa?.email_facturacion ?? user?.email ?? null,
                }}
              />
            )}

            {/* ── CONFIGURACIONES ── */}
            {activeTab === 'configuraciones' && (
              <ConfiguracionesTab userId={user.id} />
            )}
          </main>
        </div>
      </div>

      {/* Modal obligatorio datos empresa */}
      {showEmpresaModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Completa tu empresa</h2>
            <p className="text-sm text-gray-500 mb-6">Necesitamos los datos fiscales de tu empresa para generar presupuestos y facturas correctamente.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowEmpresaModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Más tarde
              </button>
              <button onClick={() => { setShowEmpresaModal(false); setActiveTab('empresa') }}
                className="flex-1 py-2.5 rounded-xl bg-red-700 text-white text-sm font-bold hover:bg-red-800 transition-colors">
                Completar ahora
              </button>
            </div>
          </div>
        </div>
      )}

      <WAButton />
    </div>
  )
}
