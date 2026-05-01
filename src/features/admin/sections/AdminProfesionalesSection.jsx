import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../services/supabase/client'
import { fmt, fmtDate, PRO_QUOTE_STATUS, BLIND_LABELS_ADMIN } from '../constants'
import AdminChatConversation from '../components/AdminChatConversation'
import AdminProQuoteModal from '../modals/AdminProQuoteModal'

export default function AdminProfesionalesSection({ adminUser }) {
  const [quotes,       setQuotes]       = useState([])
  const [proData,      setProData]      = useState({})
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search,       setSearch]       = useState('')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('all')
  const [sortCol,      setSortCol]      = useState('date')
  const [sortDir,      setSortDir]      = useState('desc')
  const [chatPro,      setChatPro]      = useState(null)
  const [unreadMap,    setUnreadMap]    = useState({})

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data: qs } = await supabase.from('pro_purchase_quotes').select('*').order('created_at', { ascending: false })
    const quotes = qs ?? []
    setQuotes(quotes)

    const userIds = [...new Set(quotes.map(q => q.user_id).filter(Boolean))]
    if (userIds.length > 0) {
      const pdResults = await Promise.all(userIds.map(id =>
        supabase.rpc('get_professional_data', { p_user_id: id }).then(r => r.data?.[0] ? { ...r.data[0], user_id: id } : null)
      ))
      const pds = pdResults.filter(Boolean)
      const { data: prs } = await supabase.from('profiles').select('id,email').in('id', userIds)
      const map = {}
      userIds.forEach(id => {
        const pd = pds?.find(p => p.user_id === id)
        const pr = prs?.find(p => p.id === id)
        map[id] = {
          razon_social:     pd?.razon_social     ?? null,
          cif_nif:          pd?.cif_nif          ?? null,
          direccion_fiscal: pd?.direccion_fiscal ?? null,
          codigo_postal:    pd?.codigo_postal    ?? null,
          ciudad:           pd?.ciudad           ?? null,
          provincia:        pd?.provincia        ?? null,
          telefono:         pd?.telefono         ?? null,
          email:            pd?.email_facturacion ?? pr?.email ?? id.slice(0, 8),
        }
      })
      setProData(map)

      const unread = {}
      await Promise.all(userIds.map(async id => {
        const { count } = await supabase.from('pro_messages')
          .select('id', { count: 'exact', head: true })
          .eq('professional_user_id', id).eq('sender_role', 'professional').eq('read_by_admin', false)
        unread[id] = count ?? 0
      }))
      setUnreadMap(unread)
    }
    setLoading(false)
  }

  function getProName(userId) {
    const d = proData[userId]
    return d?.razon_social ?? d?.email ?? userId.slice(0, 8).toUpperCase()
  }

  const allTypes = useMemo(() => {
    const types = new Set()
    quotes.forEach(q => (q.items ?? []).forEach(it => { if (it.blind_type) types.add(it.blind_type) }))
    return [...types].sort()
  }, [quotes])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  function SortIcon({ col }) {
    if (sortCol !== col) return <svg className="w-3 h-3 text-gray-300 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
    return sortDir === 'asc'
      ? <svg className="w-3 h-3 text-red-600 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
      : <svg className="w-3 h-3 text-red-600 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
  }

  const STATUS_ORDER = { pending: 0, modified: 1, accepted: 2, rejected: 3 }
  const filtered = useMemo(() => {
    const base = quotes.filter(q => {
      const name = getProName(q.user_id).toLowerCase()
      const matchStatus = statusFilter === 'all' || q.status === statusFilter
      const matchSearch = !search || name.includes(search.toLowerCase()) || (proData[q.user_id]?.email ?? '').toLowerCase().includes(search.toLowerCase())
      const d = q.created_at ? q.created_at.slice(0, 10) : ''
      const matchDate = (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo)
      const matchType = typeFilter === 'all' || (q.items ?? []).some(it => it.blind_type === typeFilter)
      return matchStatus && matchSearch && matchDate && matchType
    })
    return [...base].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'date')   cmp = (a.created_at ?? '') < (b.created_at ?? '') ? -1 : 1
      if (sortCol === 'status') cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
      if (sortCol === 'total')  cmp = ((a.admin_total_con_iva ?? a.total_con_iva ?? 0) - (b.admin_total_con_iva ?? b.total_con_iva ?? 0))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [quotes, statusFilter, search, dateFrom, dateTo, typeFilter, sortCol, sortDir, proData])

  const proIds   = [...new Set(quotes.map(q => q.user_id).filter(Boolean))]

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900">Profesionales</h2>

      {/* Cotizaciones de compra */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-semibold text-gray-700">Cotizaciones de compra</p>
          <button onClick={loadAll} className="text-xs text-red-600 hover:underline">Actualizar</button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por profesional o email..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white" />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Desde</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="px-2.5 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Hasta</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="px-2.5 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white" />
              </div>
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo('') }} className="text-gray-400 hover:text-red-600 pb-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400">
              <option value="all">Todos los estados</option>
              {Object.entries(PRO_QUOTE_STATUS).map(([k, { label }]) => <option key={k} value={k}>{label}</option>)}
            </select>
            {allTypes.length > 0 && (
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400">
                <option value="all">Todos los productos</option>
                {allTypes.map(t => <option key={t} value={t}>{BLIND_LABELS_ADMIN[t] ?? t}</option>)}
              </select>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-400">
            No hay cotizaciones {statusFilter !== 'all' ? 'con este estado' : 'todavía'}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Móvil */}
            <div className="sm:hidden divide-y divide-gray-100">
              {filtered.map(q => {
                const st    = PRO_QUOTE_STATUS[q.status] ?? PRO_QUOTE_STATUS.pending
                const total = q.admin_total_con_iva ?? q.total_con_iva ?? 0
                const name  = getProName(q.user_id)
                return (
                  <div key={q.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                        {q.client_status === 'accepted'
                          ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Cliente ✓</span>
                          : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">🔒 Cliente pendiente</span>
                        }
                        <span className="text-xs text-gray-400">{fmtDate(q.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="font-bold text-red-700 text-sm">{fmt(total)}</span>
                      <button onClick={() => setSelected({ quote: q, proInfo: proData[q.user_id] })}
                        className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                        Gestionar →
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Profesional', 'Persianas', 'Descuento'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('total')}>
                      Total<SortIcon col="total" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('status')}>
                      Estado<SortIcon col="status" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('date')}>
                      Fecha<SortIcon col="date" />
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(q => {
                    const st    = PRO_QUOTE_STATUS[q.status] ?? PRO_QUOTE_STATUS.pending
                    const total = q.admin_total_con_iva ?? q.total_con_iva ?? 0
                    const name  = getProName(q.user_id)
                    return (
                      <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{name}</td>
                        <td className="px-4 py-3 text-gray-500">{(q.items ?? []).length}</td>
                        <td className="px-4 py-3 text-gray-500">−{q.discount_pct}%</td>
                        <td className="px-4 py-3 font-bold text-red-700">{fmt(total)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls} w-fit`}>{st.label}</span>
                            {q.client_status === 'accepted'
                              ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 w-fit">Cliente ✓</span>
                              : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 w-fit">🔒 Pendiente</span>
                            }
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(q.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setSelected({ quote: q, proInfo: proData[q.user_id] })}
                            className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                            Gestionar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">Mensajes</p>
        {chatPro ? (
          <AdminChatConversation proUserId={chatPro.userId} proName={chatPro.name} adminUserId={adminUser?.id} onBack={() => { setChatPro(null); loadAll() }} />
        ) : proIds.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-400">Sin conversaciones todavía</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {proIds.map(id => {
              const name   = getProName(id)
              const unread = unreadMap[id] ?? 0
              return (
                <button key={id} onClick={() => setChatPro({ userId: id, name })}
                  className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-gray-600">
                      {name[0]?.toUpperCase() ?? 'P'}
                    </div>
                    <p className="font-semibold text-gray-800 text-sm">{name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {unread > 0 && (
                      <span className="w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">{unread}</span>
                    )}
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selected && (
        <AdminProQuoteModal
          quote={selected.quote}
          proData={selected.proInfo ?? {}}
          onClose={() => setSelected(null)}
          onUpdated={() => { setSelected(null); loadAll() }}
        />
      )}
    </div>
  )
}
