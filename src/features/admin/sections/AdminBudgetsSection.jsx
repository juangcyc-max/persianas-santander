import { useState, useEffect } from 'react'
import { supabase } from '../../../services/supabase/client'
import { fmt, fmtDate, BUDGET_STATUS_MAP, BUDGET_TYPE_LABELS } from '../constants'
import BudgetModal from '../modals/BudgetModal'
import AdminNewBudgetModal from '../modals/AdminNewBudgetModal'

export default function AdminBudgetsSection() {
  const [budgets,      setBudgets]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [selected,     setSelected]     = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showNewModal, setShowNewModal] = useState(false)

  useEffect(() => { loadBudgets() }, [])

  async function loadBudgets() {
    setLoading(true)
    const { data } = await supabase.from('budgets').select('*').order('created_at', { ascending: false })
    setBudgets(data ?? [])
    setLoading(false)
  }

  const filtered = budgets.filter(b => {
    const matchSearch = !search ||
      b.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.customer_email?.toLowerCase().includes(search.toLowerCase()) ||
      b.budget_number?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || (b.budget_status ?? 'pending') === statusFilter
    return matchSearch && matchStatus
  })

  function exportCSV() {
    const headers = ['Número', 'Cliente', 'Email', 'Tipo', 'Precio', 'Estado', 'Fecha']
    const rows = filtered.map(b => [
      b.budget_number ?? b.id?.slice(0,8).toUpperCase(),
      b.customer_name ?? '',
      b.customer_email ?? '',
      BUDGET_TYPE_LABELS[b.blind_type] ?? b.blind_type ?? '',
      ((b.admin_price != null ? b.admin_price : b.total_with_iva) ?? 0).toFixed(2).replace('.', ','),
      BUDGET_STATUS_MAP[b.budget_status ?? 'pending']?.label ?? '',
      b.created_at ? new Date(b.created_at).toLocaleDateString('es-ES') : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `presupuestos_${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-gray-900">Presupuestos</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 px-3 py-1.5 rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo presupuesto
          </button>
          {filtered.length > 0 && (
            <button onClick={exportCSV} className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exportar CSV
            </button>
          )}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 bg-white">
            <option value="all">Todos</option>
            {Object.entries(BUDGET_STATUS_MAP).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <input type="text" placeholder="Buscar cliente o número…" value={search} onChange={e => setSearch(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 w-full sm:w-56" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No hay presupuestos</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Número', 'Cliente', 'Tipo', 'Precio', 'Estado', 'Comentarios', 'Fecha', ''].map(h => (
                    <th key={h} className="px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(b => {
                  const st = BUDGET_STATUS_MAP[b.budget_status ?? 'pending'] ?? BUDGET_STATUS_MAP.pending
                  const effectivePrice = b.admin_price != null ? b.admin_price : b.total_with_iva
                  return (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-2 py-2 sm:px-4 sm:py-3 font-mono text-xs text-gray-500">{b.budget_number ?? `#${b.id?.slice(0,8).toUpperCase()}`}</td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3">
                        <p className="font-medium text-gray-900">{b.customer_name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{b.customer_email ?? ''}</p>
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3 text-gray-600 text-xs">{BUDGET_TYPE_LABELS[b.blind_type] ?? b.blind_type ?? '—'}</td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3 font-bold text-red-700">
                        {fmt(effectivePrice)}
                        {b.admin_price != null && <span className="ml-1 text-xs font-normal text-blue-600">(ajust.)</span>}
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3 max-w-[120px] sm:max-w-[180px]">
                        {b.client_notes
                          ? <p className="text-xs text-gray-500 truncate" title={b.client_notes}>{b.client_notes}</p>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3 text-xs text-gray-400">{fmtDate(b.created_at)}</td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3 text-right">
                        <button onClick={() => setSelected(b)} className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                          Gestionar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <BudgetModal budget={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); loadBudgets() }} />}
      {showNewModal && <AdminNewBudgetModal onClose={() => setShowNewModal(false)} onSaved={() => { setShowNewModal(false); loadBudgets() }} />}
    </div>
  )
}
