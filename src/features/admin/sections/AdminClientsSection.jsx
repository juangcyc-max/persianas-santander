import { useState, useEffect } from 'react'
import { supabase } from '../../../services/supabase/client'
import { fmtDate } from '../constants'
import { setProfessionalDiscountForUser } from '../../../services/settings'

export default function AdminClientsSection({ onUserDeleted }) {
  const [clients,        setClients]        = useState([])
  const [proData,        setProData]        = useState({})
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [typeFilter,     setTypeFilter]     = useState('all')
  const [expanded,       setExpanded]       = useState(null)
  const [deleting,       setDeleting]       = useState(null)
  const [confirm,        setConfirm]        = useState(null)
  const [deleteErr,      setDeleteErr]      = useState('')
  const [proDiscountEdit,setProDiscountEdit]= useState({})
  const [savingProDisc,  setSavingProDisc]  = useState(null)
  const [savedProDisc,   setSavedProDisc]   = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: users, error }, { data: pros }] = await Promise.all([
      supabase.rpc('admin_get_all_users'),
      supabase.from('professional_data').select('*, profiles(email)').order('created_at', { ascending: false }),
    ])
    if (error) console.error('Error cargando usuarios:', error)
    setClients(users ?? [])
    const map = {}
    ;(pros ?? []).forEach(p => { map[p.user_id] = p })
    setProData(map)
    setLoading(false)
  }

  async function handleSaveProDiscount(userId, currentDbValue) {
    setSavingProDisc(userId); setSavedProDisc(null)
    const raw     = proDiscountEdit[userId] !== undefined ? proDiscountEdit[userId] : String(currentDbValue ?? '')
    const percent = raw === '' ? null : parseFloat(raw)
    const ok = await setProfessionalDiscountForUser(userId, isNaN(percent) ? null : percent)
    if (ok) {
      setProData(prev => ({ ...prev, [userId]: { ...prev[userId], discount_percent: isNaN(percent) ? null : percent } }))
      setProDiscountEdit(prev => { const n = { ...prev }; delete n[userId]; return n })
      setSavedProDisc(userId)
      setTimeout(() => setSavedProDisc(s => s === userId ? null : s), 2500)
    }
    setSavingProDisc(null)
  }

  async function handleDelete(userId) {
    setDeleting(userId); setDeleteErr('')
    const { error } = await supabase.rpc('admin_delete_user', { target_user_id: userId })
    if (error) { setDeleteErr(error.message) }
    else { setClients(prev => prev.filter(c => c.id !== userId)); setConfirm(null); onUserDeleted?.() }
    setDeleting(null)
  }

  function exportCSV() {
    const headers = ['Email', 'Tipo', 'Registro', 'Razón social', 'CIF/NIF', 'Teléfono', 'Ciudad', 'Email facturación', 'Descuento %']
    const rows = filtered.map(c => {
      const p = proData[c.id] ?? {}
      return [c.email ?? '', c.user_type === 'professional' ? 'Profesional' : c.user_type === 'admin' ? 'Admin' : 'Particular',
        c.created_at ? new Date(c.created_at).toLocaleDateString('es-ES') : '',
        p.razon_social ?? '', p.cif_nif ?? '', p.telefono ?? '', p.ciudad ?? '', p.email_facturacion ?? '', p.discount_percent ?? '']
    })
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `clientes_${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = clients.filter(c => {
    const matchSearch = !search ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      (proData[c.id]?.razon_social ?? '').toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || c.user_type === typeFilter
    return matchSearch && matchType
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-gray-900">Clientes</h2>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {filtered.length > 0 && (
            <button onClick={exportCSV} className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exportar CSV
            </button>
          )}
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 bg-white">
            <option value="all">Todos</option>
            <option value="user">Particulares</option>
            <option value="professional">Profesionales</option>
          </select>
          <input type="text" placeholder="Buscar por email o empresa…" value={search} onChange={e => setSearch(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 w-full sm:w-56" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No hay clientes registrados</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(c => {
              const p          = proData[c.id]
              const isPro      = c.user_type === 'professional'
              const isExpanded = expanded === c.id
              return (
                <div key={c.id}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <button onClick={() => setExpanded(isExpanded ? null : c.id)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${isPro ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {(c.email?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.email ?? '—'}</p>
                        {isPro && p?.razon_social && <p className="text-xs text-gray-400 truncate">{p.razon_social}</p>}
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${isPro ? 'bg-blue-100 text-blue-700' : c.user_type === 'admin' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {c.user_type === 'admin' ? 'Admin' : isPro ? 'Profesional' : 'Particular'}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:inline">{fmtDate(c.created_at)}</span>
                      {(isPro || c.user_type === 'user') && (
                        <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                    {c.user_type !== 'admin' && (
                      confirm === c.id ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id}
                            className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg disabled:opacity-60">
                            {deleting === c.id ? '…' : 'Confirmar'}
                          </button>
                          <button onClick={() => setConfirm(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100">Cancelar</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirm(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )
                    )}
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100">
                      {isPro && p ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 sm:gap-x-6 gap-y-2 text-sm">
                            {p.cif_nif          && <div><span className="text-xs text-gray-400 block">CIF/NIF</span><span className="font-mono font-semibold">{p.cif_nif}</span></div>}
                            {p.telefono         && <div><span className="text-xs text-gray-400 block">Teléfono</span>{p.telefono}</div>}
                            {p.ciudad           && <div><span className="text-xs text-gray-400 block">Ciudad</span>{p.ciudad}</div>}
                            {p.direccion_fiscal  && <div className="sm:col-span-2"><span className="text-xs text-gray-400 block">Dirección fiscal</span>{p.direccion_fiscal}</div>}
                            {p.email_facturacion && <div><span className="text-xs text-gray-400 block">Email facturación</span>{p.email_facturacion}</div>}
                          </div>
                          <div className="flex items-center gap-2 pt-1 border-t border-gray-200">
                            <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Descuento individual:</span>
                            <input type="number" min="0" max="100" step="1" placeholder="Global"
                              value={proDiscountEdit[c.id] !== undefined ? proDiscountEdit[c.id] : (p.discount_percent ?? '')}
                              onChange={e => setProDiscountEdit(prev => ({ ...prev, [c.id]: e.target.value }))}
                              className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-red-300" />
                            <span className="text-xs text-gray-400">%</span>
                            <button onClick={() => handleSaveProDiscount(c.id, p.discount_percent)} disabled={savingProDisc === c.id}
                              className="text-xs font-semibold px-3 py-1 rounded-lg bg-red-700 text-white hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                              {savingProDisc === c.id ? '…' : 'Guardar'}
                            </button>
                            {savedProDisc === c.id && <span className="text-xs text-green-600 font-semibold">✓ Guardado</span>}
                            <button onClick={() => { setProDiscountEdit(prev => ({ ...prev, [c.id]: '' })); handleSaveProDiscount(c.id, null) }}
                              disabled={savingProDisc === c.id} className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40">
                              Usar global
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">Registro: {fmtDate(c.created_at)}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {deleteErr && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">Error al eliminar: {deleteErr}</div>}
      <p className="text-xs text-gray-400">{filtered.length} usuario{filtered.length !== 1 ? 's' : ''} · Los admins no se pueden eliminar</p>
    </div>
  )
}
