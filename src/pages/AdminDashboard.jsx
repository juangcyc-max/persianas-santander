import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase/client'
import { ADMIN_TABS } from '../features/admin/constants'
import AdminOverviewSection    from '../features/admin/sections/AdminOverviewSection'
import AdminPedidosSection     from '../features/admin/sections/AdminPedidosSection'
import AdminBudgetsSection     from '../features/admin/sections/AdminBudgetsSection'
import AdminInvoicesSection    from '../features/admin/sections/AdminInvoicesSection'
import AdminProfesionalesSection from '../features/admin/sections/AdminProfesionalesSection'
import AdminClientsSection     from '../features/admin/sections/AdminClientsSection'
import AdminConfigSection      from '../features/admin/sections/AdminConfigSection'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [user,         setUser]         = useState(null)
  const [orders,       setOrders]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)
  const [activeTab,    setActiveTab]    = useState('pedidos')
  const [menuOpen,     setMenuOpen]     = useState(false)
  const [proNotif,     setProNotif]     = useState(0)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => { checkAdmin() }, [])
  useEffect(() => { loadProNotif() }, [activeTab])

  async function loadProNotif() {
    const [{ count: pendingQuotes }, { count: unreadMsgs }] = await Promise.all([
      supabase.from('pro_purchase_quotes').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('pro_messages').select('id', { count: 'exact', head: true }).eq('sender_role', 'professional').eq('read_by_admin', false),
    ])
    setProNotif((pendingQuotes ?? 0) + (unreadMsgs ?? 0))
  }

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()

    const isAdmin = profile?.role === 'admin' || user.user_metadata?.user_type === 'admin'
    if (!isAdmin) { setUnauthorized(true); setLoading(false); return }

    setUser(user)
    await cleanupCancelledInvoices()
    await loadOrders()

    supabase.channel('admin-pro-notif')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pro_purchase_quotes' }, loadProNotif)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pro_messages' }, loadProNotif)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pro_purchase_quotes' }, loadProNotif)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pro_messages' }, loadProNotif)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pro_purchase_quotes' }, loadProNotif)
      .subscribe()
  }

  async function cleanupCancelledInvoices() {
    try {
      const { data: cancelledOrders } = await supabase.from('orders').select('id').eq('status', 'cancelled')
      if (!cancelledOrders?.length) return
      await supabase.from('invoices').delete().in('order_id', cancelledOrders.map(o => o.id))
    } catch (err) {
      console.error('Error limpiando facturas canceladas:', err)
    }
  }

  async function loadOrders() {
    setLoading(true)
    try {
      const { data: ordersData, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
      if (error) throw error
      const userIds = [...new Set((ordersData ?? []).map(o => o.user_id).filter(Boolean))]
      let profilesMap = {}
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('id, email, role').in('id', userIds)
        ;(profilesData ?? []).forEach(p => { profilesMap[p.id] = p })
      }
      setOrders((ordersData ?? []).map(o => ({ ...o, profiles: profilesMap[o.user_id] ?? { email: '—', role: 'user' } })))
    } catch (err) {
      console.error('Error cargando pedidos:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (unauthorized) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Acceso denegado</h2>
        <p className="text-gray-500 text-sm">No tienes permisos de administrador.</p>
      </div>
    </div>
  )

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src="/persianassantanderlogo.png" alt="Persianas Santander" className="h-9 w-auto cursor-pointer"
                onClick={() => window.location.href = '/'} onError={e => { e.target.src = '/persianassantanderlogo.svg' }} />
              <div className="hidden sm:block h-6 w-px bg-gray-200" />
              <span className="hidden sm:flex items-center gap-2 text-sm font-bold text-gray-700">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Admin
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 hidden md:block">{user?.email}</span>
              <a href="/manual-admin.html" target="_blank" rel="noopener noreferrer"
                className="hidden sm:flex text-xs font-semibold text-gray-500 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors">
                Manual
              </a>
              <button onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors font-medium">
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={ADMIN_TABS.find(t => t.id === activeTab)?.icon} />
                  </svg>
                  {ADMIN_TABS.find(t => t.id === activeTab)?.label}
                </span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuOpen && (
                <nav className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden">
                  {ADMIN_TABS.map(({ id, label, icon }) => (
                    <button key={id} onClick={() => { setActiveTab(id); setMenuOpen(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-left border-b border-gray-100 last:border-0 transition-colors ${activeTab === id ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
                      </svg>
                      {label}
                      {id === 'pedidos' && pendingCount > 0 && (
                        <span className="ml-auto text-xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                      )}
                      {id === 'profesionales' && proNotif > 0 && (
                        <span className="ml-auto text-xs font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{proNotif}</span>
                      )}
                    </button>
                  ))}
                </nav>
              )}
            </div>
            {/* Desktop sidebar */}
            <nav className="hidden lg:flex lg:flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {ADMIN_TABS.map(({ id, label, icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-left border-b border-gray-100 last:border-0 transition-colors ${
                    activeTab === id ? 'bg-red-50 text-red-700 border-l-2 border-l-red-700 pl-3.5' : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
                  </svg>
                  {label}
                  {id === 'pedidos' && pendingCount > 0 && (
                    <span className="ml-auto text-xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                  )}
                  {id === 'profesionales' && proNotif > 0 && (
                    <span className="ml-auto text-xs font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{proNotif}</span>
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {activeTab === 'overview'      && <AdminOverviewSection orders={orders} />}
            {activeTab === 'pedidos'       && <AdminPedidosSection onPendingCountChange={setPendingCount} />}
            {activeTab === 'presupuestos'  && <AdminBudgetsSection />}
            {activeTab === 'facturas'      && <AdminInvoicesSection adminUser={user} />}
            {activeTab === 'profesionales' && <AdminProfesionalesSection adminUser={user} />}
            {activeTab === 'clientes'      && <AdminClientsSection onUserDeleted={loadOrders} />}
            {activeTab === 'configuracion' && <AdminConfigSection />}
          </main>
        </div>
      </div>
    </div>
  )
}
