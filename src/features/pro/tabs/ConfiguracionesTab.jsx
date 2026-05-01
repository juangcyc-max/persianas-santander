import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../services/supabase/client'
import { processConfigurations } from '../constants'
import SectionHeader from '../components/SectionHeader'
import ProConfigCard from '../components/ProConfigCard'
import ProGroupCard from '../components/ProGroupCard'

export default function ConfiguracionesTab({ configuraciones, setConfiguraciones, globalDiscount = 0, hideHeader = false }) {
  const [search,     setSearch]    = useState('')
  const [deleting,   setDeleting]  = useState(null)
  const [sortOrder,  setSortOrder] = useState('desc')
  const [expandedId, setExpandedId] = useState(null)

  function toggleExpanded(id) {
    setExpandedId(prev => prev === id ? null : id)
  }

  const filtered = useMemo(() => configuraciones.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (c.blind_type ?? '').toLowerCase().includes(q) ||
      (c.configuration_number ?? '').toLowerCase().includes(q) ||
      (c.mechanism ?? '').toLowerCase().includes(q) ||
      (c.slat_color_name ?? '').toLowerCase().includes(q)
    )
  }), [configuraciones, search])

  const displayEntries = useMemo(() => {
    const entries = processConfigurations(filtered)
    return sortOrder === 'asc' ? [...entries].reverse() : entries
  }, [filtered, sortOrder])

  async function handleDelete(id) {
    setDeleting(id)
    await supabase.from('blind_configurations').delete().eq('id', id)
    setConfiguraciones(prev => prev.filter(c => c.id !== id))
    setDeleting(null)
  }

  async function handleDeleteGroup(entryId, ids) {
    setDeleting(entryId)
    await supabase.from('blind_configurations').delete().in('id', ids)
    setConfiguraciones(prev => prev.filter(c => !ids.includes(c.id)))
    setDeleting(null)
  }

  async function handleDeleteAll() {
    if (!window.confirm('¿Eliminar todas las configuraciones guardadas?')) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('blind_configurations').delete().eq('user_id', user.id)
    setConfiguraciones([])
  }

  return (
    <div className="space-y-4">
      {!hideHeader && <SectionHeader title="Configuraciones guardadas" action={
        <div className="flex items-center gap-2">
          {configuraciones.length > 0 && (
            <button onClick={handleDeleteAll}
              className="text-xs font-semibold text-gray-400 hover:text-red-600 transition-colors px-2 py-2">
              Eliminar todas
            </button>
          )}
          <Link to="/configurador"
            className="flex items-center gap-2 text-sm font-bold bg-red-700 text-white px-4 py-2 rounded-xl hover:bg-red-800 transition-colors">
            + Nueva configuración
          </Link>
        </div>
      } />}

      {configuraciones.length > 0 && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por tipo, mecanismo…"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400" />
          </div>
          <button
            onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
            className="px-3 py-2.5 text-sm font-semibold rounded-xl border bg-white text-gray-600 border-gray-300 hover:bg-gray-50 flex items-center gap-1.5 flex-shrink-0 transition-colors"
            title={sortOrder === 'desc' ? 'Más recientes primero' : 'Más antiguas primero'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            {sortOrder === 'desc' ? 'Recientes' : 'Antiguas'}
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="font-semibold text-gray-700 mb-1">{search ? 'Sin resultados' : 'Todavía no hay configuraciones'}</p>
          <p className="text-sm text-gray-400 mb-5">
            {search ? 'Prueba con otro término' : 'Guarda una persiana desde el configurador para verla aquí.'}
          </p>
          {!search && (
            <Link to="/configurador"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-700 text-white text-sm font-bold rounded-xl hover:bg-red-800 transition-colors">
              Ir al configurador
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
          {displayEntries.map((entry, idx) => {
            const cardKey = entry.type === 'group' ? (entry.id ?? `group-${idx}`) : (entry.item?.id ?? `single-${idx}`)
            return entry.type === 'group' ? (
              <ProGroupCard
                key={cardKey}
                items={entry.items}
                onDeleteGroup={() => handleDeleteGroup(entry.id, entry.items.map(c => c.id))}
                deleting={deleting === entry.id ? entry.id : null}
                isExpanded={expandedId === cardKey}
                onToggle={() => setExpandedId(prev => prev === cardKey ? null : cardKey)}
                globalDiscount={globalDiscount}
              />
            ) : (
              <ProConfigCard
                key={cardKey}
                c={entry.item}
                onDelete={handleDelete}
                deleting={deleting}
                isExpanded={expandedId === cardKey}
                onToggle={() => setExpandedId(prev => prev === cardKey ? null : cardKey)}
                globalDiscount={globalDiscount}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
