import { useState } from 'react'
import { supabase } from '../../../services/supabase/client'
import SectionHeader from '../components/SectionHeader'
import ProjectModal from '../components/ProjectModal'

// ── Colores del borde izquierdo según estado ─────────────────────────────
const STATUS_BORDER = {
  draft:    'border-l-gray-300',
  sent:     'border-l-blue-400',
  accepted: 'border-l-green-500',
  rejected: 'border-l-red-400',
}

import { fmt, fmtDate, blindLabel } from '../constants'
import Badge from '../components/Badge'

// ── Tarjeta de presupuesto colapsable ─────────────────────────────────────
function ProyectoCard({ p, pitems, total, onEdit }) {
  const [expanded, setExpanded] = useState(false)
  const borderColor = STATUS_BORDER[p.status] ?? STATUS_BORDER.draft

  return (
    <div className={`bg-white border border-gray-200 border-l-4 ${borderColor} rounded-2xl overflow-hidden transition-all hover:shadow-md`}>

      {/* ── Cabecera: siempre visible ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-5 py-4 flex items-center justify-between text-left gap-4"
      >
        {/* Izquierda: nombre + resumen */}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900 truncate leading-tight">
            {p.name || 'Presupuesto sin nombre'}
          </p>
          <p className="text-sm text-gray-500 mt-0.5 truncate">
            {[
              p.client_name,
              pitems.length > 0 ? `${pitems.length} persiana${pitems.length > 1 ? 's' : ''}` : null,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* Derecha: total + badge + flecha */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-base font-black text-gray-900">{fmt(total)}</span>
          <Badge status={p.status} />
          <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Detalle expandido ── */}
      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-100 space-y-4">

          {/* Datos de contacto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4 text-sm">
            {p.client_phone   && <p className="text-gray-600"><span className="font-semibold text-gray-400 text-xs uppercase tracking-wide mr-1">Tel</span>{p.client_phone}</p>}
            {p.client_email   && <p className="text-gray-600"><span className="font-semibold text-gray-400 text-xs uppercase tracking-wide mr-1">Email</span>{p.client_email}</p>}
            {p.client_address && <p className="text-gray-600 sm:col-span-2"><span className="font-semibold text-gray-400 text-xs uppercase tracking-wide mr-1">Dir</span>{p.client_address}</p>}
            {p.budget_number  && <p className="text-gray-400 text-xs font-mono sm:col-span-2">{p.budget_number}</p>}
          </div>

          {/* Persianas incluidas */}
          {pitems.length > 0 && (
            <div className="space-y-1.5">
              {pitems.map((it, i) => (
                <div key={it.item_id ?? i} className="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-3 py-2">
                  <span className="text-gray-700">
                    <span className="font-bold text-gray-400 mr-2">{i + 1}.</span>
                    {it.description || blindLabel(it.blind_type)}
                  </span>
                  {it.client_price ? <span className="font-bold text-gray-800 flex-shrink-0 ml-2">{fmt(it.client_price)}</span> : null}
                </div>
              ))}
            </div>
          )}

          {/* Notas */}
          {p.notes && (
            <p className="text-sm text-gray-400 italic border-l-2 border-gray-200 pl-3">{p.notes}</p>
          )}

          {/* Botón editar */}
          <button onClick={onEdit}
            className="w-full py-2.5 rounded-xl text-sm font-bold bg-gray-900 hover:bg-gray-800 text-white transition-colors">
            Abrir y editar presupuesto →
          </button>
        </div>
      )}
    </div>
  )
}

// ── Tab Proyectos ─────────────────────────────────────────────────────────
export default function ProyectosTab({ proyectos, setProyectos, empresa, logoUrl, user, onConfigSaved }) {
  const [modal,  setModal]  = useState(null)
  const [search, setSearch] = useState('')

  const EMPTY_PROJECT = {
    user_id:        user?.id,
    name:           '',
    client_name:    '',
    client_phone:   '',
    client_email:   '',
    client_address: '',
    client_nif:     '',
    notes:          '',
    status:         'draft',
    items:          [],
    budget_number:  null,
  }

  async function saveProject(updated) {
    if (!updated.id) {
      // Crear
      const { data, error } = await supabase.from('pro_projects').insert({ ...updated, user_id: user.id }).select().single()
      if (!error && data) setProyectos(prev => [data, ...prev])
      return data ?? null
    } else {
      // Actualizar
      const { data, error } = await supabase.from('pro_projects').update(updated).eq('id', updated.id).select().single()
      if (!error && data) setProyectos(prev => prev.map(p => p.id === data.id ? data : p))
      return data ?? null
    }
  }

  async function deleteProject(id) {
    await supabase.from('pro_projects').delete().eq('id', id)
    setProyectos(prev => prev.filter(p => p.id !== id))
  }

  const filtered = proyectos.filter(p => {
    const q = search.toLowerCase()
    return !q || p.name?.toLowerCase().includes(q) || p.client_name?.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Presupuestos"
        action={
          <button onClick={() => setModal(EMPTY_PROJECT)}
            className="flex items-center gap-2 text-sm font-bold bg-red-700 text-white px-4 py-2 rounded-xl hover:bg-red-800 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo presupuesto
          </button>
        }
      />

      {/* Buscador */}
      <div className="relative">
        <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre de obra o cliente…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 bg-white" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <p className="font-semibold text-gray-700 mb-1">{search ? 'Sin resultados' : 'Todavía no hay presupuestos'}</p>
          <p className="text-sm text-gray-400 mb-5">
            {search ? 'Prueba con otro nombre o cliente' : 'Crea tu primer presupuesto para agrupar persianas de un cliente.'}
          </p>
          {!search && (
            <button onClick={() => setModal(EMPTY_PROJECT)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-700 text-white text-sm font-bold rounded-xl hover:bg-red-800 transition-colors">
              + Nuevo presupuesto
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const pitems = p.items ?? []
            const total  = pitems.reduce((s, it) => s + (Number(it.client_price) || 0), 0)
            return (
              <ProyectoCard
                key={p.id}
                p={p}
                pitems={pitems}
                total={total}
                onEdit={() => setModal(p)}
              />
            )
          })}
        </div>
      )}

      {modal && (
        <ProjectModal
          project={modal}
          userId={user.id}
          empresa={empresa}
          logoUrl={logoUrl}
          onSave={saveProject}
          onDelete={deleteProject}
          onClose={() => setModal(null)}
          onConfigSaved={onConfigSaved}
        />
      )}
    </div>
  )
}
