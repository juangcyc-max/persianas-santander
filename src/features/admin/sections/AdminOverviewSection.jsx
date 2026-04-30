import { useState, useEffect } from 'react'
import { supabase } from '../../../services/supabase/client'
import { fmt } from '../constants'

function GAWebAnalytics() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => { fetchGA() }, [])

  async function fetchGA() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/analytics')
      if (!res.ok) throw new Error(`Error ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const fmtSec = (s) => {
    const m = Math.floor(s / 60), sec = Math.round(s % 60)
    return `${m}:${String(sec).padStart(2, '0')} min`
  }

  const channelLabel = (c) => ({
    'Organic Search': 'Búsqueda orgánica', 'Direct': 'Directo',
    'Referral': 'Referencia', 'Organic Social': 'Redes sociales',
    'Email': 'Email', 'Paid Search': 'Búsqueda de pago',
    'Unassigned': 'Sin asignar',
  })[c] ?? c

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Tráfico web <span className="text-xs font-normal text-gray-400 ml-1">(últimos 30 días)</span></h2>
        <button onClick={fetchGA} className="text-xs text-red-600 hover:underline">Actualizar</button>
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          No se pudieron cargar los datos de Analytics: {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Usuarios activos', value: data.overview.activeUsers.toLocaleString('es-ES'),   color: 'text-blue-700',   bg: 'bg-blue-50'   },
              { label: 'Sesiones',         value: data.overview.sessions.toLocaleString('es-ES'),      color: 'text-purple-700', bg: 'bg-purple-50' },
              { label: 'Páginas vistas',   value: data.overview.pageViews.toLocaleString('es-ES'),     color: 'text-green-700',  bg: 'bg-green-50'  },
              { label: 'Duración media',   value: fmtSec(data.overview.avgSessionDuration),            color: 'text-amber-700',  bg: 'bg-amber-50'  },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`rounded-xl border border-gray-200 p-4 ${bg}`}>
                <p className={`text-2xl font-black ${color}`}>{value}</p>
                <p className="text-xs font-semibold text-gray-600 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-bold text-gray-700 mb-3">Fuentes de tráfico</p>
              <div className="space-y-2">
                {data.sources.slice(0, 6).map(({ channel, sessions }) => {
                  const total = data.sources.reduce((a, s) => a + s.sessions, 0)
                  const pct   = total > 0 ? Math.round((sessions / total) * 100) : 0
                  return (
                    <div key={channel}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700">{channelLabel(channel)}</span>
                        <span className="text-gray-500">{sessions.toLocaleString('es-ES')} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-bold text-gray-700 mb-3">Páginas más visitadas</p>
              <div className="space-y-1.5">
                {data.topPages.slice(0, 8).map(({ path, views }) => (
                  <div key={path} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-gray-600 truncate font-mono">{path}</span>
                    <span className="font-bold text-gray-800 flex-shrink-0">{views.toLocaleString('es-ES')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-bold text-gray-700 mb-3">Dispositivos</p>
            <div className="flex gap-4 flex-wrap">
              {data.devices.map(({ device, sessions }) => {
                const total = data.devices.reduce((a, d) => a + d.sessions, 0)
                const pct   = total > 0 ? Math.round((sessions / total) * 100) : 0
                const label = { mobile: 'Móvil', desktop: 'Escritorio', tablet: 'Tablet' }[device] ?? device
                return (
                  <div key={device} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
                    <span className="text-sm font-semibold text-gray-700">{label}</span>
                    <span className="text-xs text-gray-400">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AdminAnalyticsSection() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    setLoading(true)
    const [
      { data: ordersData },
      { data: budgetsData },
      { data: invoicesData },
      { data: profilesData },
    ] = await Promise.all([
      supabase.from('orders').select('status, total_with_iva, user_type, user_id, created_at'),
      supabase.from('budgets').select('user_id, user_type'),
      supabase.from('invoices').select('total_with_iva, payment_status'),
      supabase.from('profiles').select('id, user_type, role'),
    ])

    const orders   = ordersData   ?? []
    const budgets  = budgetsData  ?? []
    const invoices = invoicesData ?? []
    const profiles = profilesData ?? []

    const contactIds = new Set([
      ...orders.map(o => o.user_id).filter(Boolean),
      ...budgets.map(b => b.user_id).filter(Boolean),
    ])
    const proIds = new Set([
      ...orders.filter(o => o.user_type === 'professional').map(o => o.user_id),
      ...budgets.filter(b => b.user_type === 'professional').map(b => b.user_id),
      ...profiles.filter(p => p.user_type === 'professional').map(p => p.id),
    ])
    const totalContacts = contactIds.size
    const proContacts   = [...contactIds].filter(id => proIds.has(id)).length
    const partContacts  = totalContacts - proContacts

    const active    = orders.filter(o => o.status !== 'cancelled')
    const completed = orders.filter(o => o.status === 'completed')
    const cancelled = orders.filter(o => o.status === 'cancelled')
    const totalRev  = active.reduce((a, o) => a + (o.total_with_iva ?? 0), 0)
    const paidRev   = invoices.filter(i => i.payment_status === 'paid').reduce((a, i) => a + (i.total_with_iva ?? 0), 0)
    const pendingRev= invoices.filter(i => i.payment_status !== 'paid').reduce((a, i) => a + (i.total_with_iva ?? 0), 0)

    const now    = new Date()
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return { label: d.toLocaleString('es-ES', { month: 'short' }), year: d.getFullYear(), month: d.getMonth() }
    })
    const byMonth  = months.map(m => ({
      label:  m.label,
      orders: orders.filter(o => {
        const d = new Date(o.created_at)
        return d.getFullYear() === m.year && d.getMonth() === m.month
      }).length,
    }))
    const maxOrders = Math.max(...byMonth.map(m => m.orders), 1)

    setStats({
      totalContacts, proContacts, partContacts,
      totalBudgets:    budgets.length,
      totalOrders:     orders.length,
      completedOrders: completed.length,
      cancelledOrders: cancelled.length,
      proOrders:       orders.filter(o => o.user_type === 'professional').length,
      partOrders:      orders.filter(o => o.user_type !== 'professional').length,
      totalRev, paidRev, pendingRev,
      conversion: budgets.length > 0 ? ((orders.length / budgets.length) * 100).toFixed(1) : '0.0',
      byMonth, maxOrders,
    })
    setLoading(false)
  }

  const fmtN = (n) => new Intl.NumberFormat('es-ES').format(n ?? 0)

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!stats) return null

  const kpis = [
    { label: 'Contactos activos',      value: fmtN(stats.totalContacts),   sub: `${stats.proContacts} pro · ${stats.partContacts} particular`, color: 'text-gray-900',   bg: 'bg-gray-50'   },
    { label: 'Presupuestos generados', value: fmtN(stats.totalBudgets),    sub: 'desde el inicio',            color: 'text-blue-700',   bg: 'bg-blue-50'   },
    { label: 'Pedidos realizados',     value: fmtN(stats.totalOrders),     sub: `${stats.cancelledOrders} cancelados`, color: 'text-amber-700', bg: 'bg-amber-50'  },
    { label: 'Pedidos completados',    value: fmtN(stats.completedOrders), sub: 'instalaciones finalizadas',  color: 'text-green-700',  bg: 'bg-green-50'  },
    { label: 'Tasa de conversión',     value: `${stats.conversion}%`,      sub: 'presupuesto → pedido',       color: 'text-purple-700', bg: 'bg-purple-50' },
    { label: 'Facturación cobrada',    value: fmt(stats.paidRev),          sub: `${fmt(stats.pendingRev)} pendiente`, color: 'text-red-700', bg: 'bg-red-50' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Análisis del negocio</h2>
        <button onClick={loadStats} className="text-xs text-red-600 hover:underline">Actualizar</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {kpis.map(({ label, value, sub, color, bg }) => (
          <div key={label} className={`rounded-xl border border-gray-200 p-4 ${bg}`}>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-sm font-semibold text-gray-700 mt-0.5">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-bold text-gray-700 mb-3">Pedidos por tipo de cliente</p>
          <div className="space-y-3">
            {[
              { label: 'Profesionales', value: stats.proOrders,  total: stats.totalOrders, color: 'bg-blue-500' },
              { label: 'Particulares',  value: stats.partOrders, total: stats.totalOrders, color: 'bg-gray-400' },
            ].map(({ label, value, total, color }) => {
              const pct = total > 0 ? Math.round((value / total) * 100) : 0
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{label}</span>
                    <span className="text-gray-500">{value} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-bold text-gray-700 mb-3">Pedidos últimos 6 meses</p>
          <div className="flex items-end gap-2 h-20">
            {stats.byMonth.map(({ label, orders }) => (
              <div key={label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-gray-700">{orders || ''}</span>
                <div
                  className="w-full bg-red-600 rounded-t transition-all"
                  style={{ height: `${Math.max((orders / stats.maxOrders) * 64, orders > 0 ? 4 : 0)}px` }}
                />
                <span className="text-xs text-gray-400 capitalize">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <GAWebAnalytics />
    </div>
  )
}

export default function AdminOverviewSection({ orders }) {
  const stats = {
    total:     orders.length,
    pending:   orders.filter(o => o.status === 'pending').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    completed: orders.filter(o => o.status === 'completed').length,
    revenue:   orders.filter(o => o.status !== 'cancelled').reduce((a, o) => a + (o.total_with_iva ?? 0), 0),
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Resumen</h1>
        <p className="text-sm text-gray-500 mt-1">Vista general del negocio.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total pedidos',   value: stats.total,        color: 'text-gray-900',  bg: 'bg-white'    },
          { label: 'Pendientes',      value: stats.pending,      color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Confirmados',     value: stats.confirmed,    color: 'text-blue-600',  bg: 'bg-blue-50'  },
          { label: 'Completados',     value: stats.completed,    color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Cancelados',      value: orders.filter(o => o.status === 'cancelled').length, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Facturación est.',value: fmt(stats.revenue), color: 'text-red-700',   bg: 'bg-white'    },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={bg + ' rounded-2xl border border-gray-200 p-5'}>
            <p className={'text-2xl font-black ' + color}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      <AdminAnalyticsSection />
    </div>
  )
}
