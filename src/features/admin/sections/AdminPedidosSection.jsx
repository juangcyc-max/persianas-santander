import { useState, useEffect } from 'react'
import { supabase } from '../../../services/supabase/client'
import { fmt, fmtDate, STATUS_MAP } from '../constants'
import StatusBadge from '../components/StatusBadge'
import OrderModal from '../modals/OrderModal'

const PAGE_SIZE = 15

export default function AdminPedidosSection({ onPendingCountChange }) {
  const [orders,       setOrders]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [selectedOrder,setSelectedOrder]= useState(null)
  const [filter,       setFilter]       = useState('all')
  const [search,       setSearch]       = useState('')
  const [page,         setPage]         = useState(1)
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [sortCol,      setSortCol]      = useState('date')
  const [sortDir,      setSortDir]      = useState('desc')

  useEffect(() => { loadOrders() }, [])

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
      const enriched = (ordersData ?? []).map(o => ({ ...o, profiles: profilesMap[o.user_id] ?? { email: '—', role: 'user' } }))
      setOrders(enriched)
      onPendingCountChange?.(enriched.filter(o => o.status === 'pending').length)
    } catch (err) {
      console.error('Error cargando pedidos:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteOrderDirect(order) {
    if (!window.confirm(`¿Eliminar definitivamente el pedido #${order.id.slice(0,8).toUpperCase()}? Esta acción no se puede deshacer.`)) return
    const { data: inv } = await supabase.from('invoices').select('id').eq('order_id', order.id).maybeSingle()
    if (inv) await supabase.from('invoices').delete().eq('id', inv.id)
    const { error } = await supabase.from('orders').delete().eq('id', order.id)
    if (!error) loadOrders()
  }

  const filtered = orders.filter(o => {
    const matchFilter = filter === 'all' || o.status === filter
    const matchSearch = !search ||
      o.profiles?.email?.toLowerCase().includes(search.toLowerCase()) ||
      o.address?.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase())
    const d = o.created_at ? o.created_at.slice(0, 10) : ''
    return matchFilter && matchSearch && (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo)
  })

  const STATUS_ORDER = { pending: 0, confirmed: 1, completed: 2, cancelled: 3 }
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortCol === 'date')   cmp = (a.created_at ?? '') < (b.created_at ?? '') ? -1 : 1
    if (sortCol === 'status') cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
    if (sortCol === 'total')  cmp = (a.total_with_iva ?? 0) - (b.total_with_iva ?? 0)
    return sortDir === 'asc' ? cmp : -cmp
  })

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
    setPage(1)
  }

  function SortIcon({ col }) {
    if (sortCol !== col) return <svg className="w-3 h-3 text-gray-300 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
    return sortDir === 'asc'
      ? <svg className="w-3 h-3 text-red-600 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
      : <svg className="w-3 h-3 text-red-600 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
  }

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function exportCSV() {
    const headers = ['ID', 'Email', 'Tipo', 'Fecha', 'Total', 'Estado']
    const rows = sorted.map(o => [
      o.id.slice(0,8).toUpperCase(),
      o.profiles?.email ?? '',
      o.user_type === 'professional' ? 'Profesional' : 'Particular',
      o.created_at ? new Date(o.created_at).toLocaleDateString('es-ES') : '',
      (o.total_with_iva ?? 0).toFixed(2).replace('.', ','),
      STATUS_MAP[o.status]?.label ?? o.status,
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `pedidos_${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-900">Pedidos</h1>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <button onClick={exportCSV} className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exportar CSV
            </button>
          )}
          <button onClick={loadOrders} className="text-xs text-red-600 hover:underline">Actualizar</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Buscar por email, dirección o ID..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white" />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Desde</label>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
                className="px-2.5 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Hasta</label>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
                className="px-2.5 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white" />
            </div>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }} className="text-gray-400 hover:text-red-600 pb-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[{ key: 'all', label: 'Todos' }, { key: 'pending', label: 'Pendientes' }, { key: 'confirmed', label: 'Confirmados' }, { key: 'completed', label: 'Completados' }, { key: 'cancelled', label: 'Cancelados' }].map(({ key, label }) => (
            <button key={key} onClick={() => { setFilter(key); setPage(1) }}
              className={'px-4 py-2 rounded-xl text-sm font-semibold transition-colors ' + (filter === key ? 'bg-red-700 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-sm">No hay pedidos que mostrar</div>
        ) : (
          <>
            {/* Móvil */}
            <div className="sm:hidden divide-y divide-gray-100">
              {paginated.map(order => (
                <div key={order.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-mono text-xs text-gray-400">#{order.id.slice(0,8).toUpperCase()}</span>
                      <span className={'text-xs font-bold px-1.5 py-0.5 rounded-full ' + (order.user_type === 'professional' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                        {order.user_type === 'professional' ? 'Pro' : 'Part.'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">{order.profiles?.email ?? '—'}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <StatusBadge status={order.status} />
                      <span className="text-xs text-gray-400">{fmtDate(order.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="font-bold text-gray-900 text-sm">{fmt(order.total_with_iva)}</span>
                    <button onClick={() => setSelectedOrder(order)} className="text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
                      Gestionar →
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['ID','Cliente','Tipo'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('date')}>
                      Fecha<SortIcon col="date" />
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Cita</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('total')}>
                      Total<SortIcon col="total" />
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('status')}>
                      Estado<SortIcon col="status" />
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">#{order.id.slice(0,8).toUpperCase()}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[160px] truncate">{order.profiles?.email ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={'text-xs font-bold px-2 py-0.5 rounded-full ' + (order.user_type === 'professional' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                          {order.user_type === 'professional' ? 'Pro' : 'Particular'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(order.created_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {order.preferred_date
                          ? <span className="text-gray-900">{fmtDate(order.preferred_date)} {order.preferred_time}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{fmt(order.total_with_iva)}</td>
                      <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSelectedOrder(order)} className="text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                            Gestionar →
                          </button>
                          {order.status === 'cancelled' && (
                            <button onClick={() => handleDeleteOrderDirect(order)} title="Eliminar"
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-xs text-gray-400">Página {safePage} de {totalPages} · {sorted.length} pedidos</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={safePage === 1} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
            </button>
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={safePage === 1} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(safePage - 2, totalPages - 4))
              const p = start + i
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={'w-7 h-7 rounded-lg text-xs font-semibold transition-colors ' + (p === safePage ? 'bg-red-700 text-white' : 'text-gray-500 hover:bg-gray-100')}>
                  {p}
                </button>
              )
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={safePage === totalPages} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}

      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={() => { loadOrders(); setSelectedOrder(null) }}
        />
      )}
    </div>
  )
}
