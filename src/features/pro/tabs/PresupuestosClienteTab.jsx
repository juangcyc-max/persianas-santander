import { useState, useMemo } from 'react'
import { supabase } from '../../../services/supabase/client'
import { fmt, fmtDate, TEMPLATE_OPTS } from '../constants'
import { generateClientBudgetFromQuotePDF, generateClientInvoiceFromQuotePDF } from '../../../services/pdf'
import SectionHeader from '../components/SectionHeader'

const BUDGET_STATUS_OPTS = [
  { value: 'borrador',   label: 'Borrador',   cls: 'bg-gray-100 text-gray-600'     },
  { value: 'enviado',    label: 'Enviado',    cls: 'bg-blue-100 text-blue-700'     },
  { value: 'aceptado',   label: 'Aceptado',   cls: 'bg-green-100 text-green-700'   },
  { value: 'facturado',  label: 'Facturado',  cls: 'bg-purple-100 text-purple-700' },
]

function autoNum(q) {
  return `PRES-${(q.id ?? '').slice(0, 8).toUpperCase()}`
}

export default function PresupuestosClienteTab({ cotizaciones, onUpdate, proInfo, logoUrl }) {
  const [expandedId,  setExpandedId]  = useState(null)
  const [editingId,   setEditingId]   = useState(null)
  const [edits,       setEdits]       = useState({})
  const [saving,      setSaving]      = useState({})
  const [saved,       setSaved]       = useState({})
  const [downloading, setDownloading] = useState({})
  const [sortDir,     setSortDir]     = useState('desc')
  const [statusFilter,setStatusFilter]= useState('all')

  function get(q, key) {
    if (edits[q.id]?.[key] !== undefined) return edits[q.id][key]
    const defaults = {
      margin:       q.client_margin_pct ?? 0,
      extras:       q.extras_amount     ?? 0,
      iva:          q.iva_pct           ?? 21,
      clientInfo:   q.client_info       ?? {},
      comments:     q.client_comments   ?? '',
      template:     'azul',
      budgetNumber: q.budget_number     ?? autoNum(q),
      budgetStatus: q.budget_status     ?? 'borrador',
    }
    return defaults[key]
  }

  function set(qId, key, value) {
    setEdits(p => ({ ...p, [qId]: { ...(p[qId] ?? {}), [key]: value } }))
  }

  function clientTotal(q) {
    const admin  = parseFloat(q.admin_total_con_iva ?? q.total_con_iva ?? 0)
    const margin = parseFloat(get(q, 'margin')) || 0
    const extras = parseFloat(get(q, 'extras')) || 0
    return admin * (1 + margin / 100) + extras
  }

  async function handleSave(q) {
    setSaving(p => ({ ...p, [q.id]: true }))
    const margin       = parseFloat(get(q, 'margin')) || 0
    const extras       = parseFloat(get(q, 'extras')) || 0
    const iva          = parseFloat(get(q, 'iva'))    || 21
    const ci           = get(q, 'clientInfo')
    const adminTotal   = parseFloat(q.admin_total_con_iva ?? q.total_con_iva ?? 0)
    const updates = {
      client_margin_pct: margin,
      client_total:      adminTotal * (1 + margin / 100) + extras,
      extras_amount:     extras,
      iva_pct:           iva,
      client_comments:   get(q, 'comments') || null,
      client_info:       Object.values(ci).some(v => v?.trim?.()) ? ci : null,
      budget_number:     get(q, 'budgetNumber') || autoNum(q),
      budget_status:     get(q, 'budgetStatus'),
    }
    const { error } = await supabase.from('pro_purchase_quotes').update(updates).eq('id', q.id)
    if (!error) {
      onUpdate?.(q.id, updates)
      setSaved(p => ({ ...p, [q.id]: true }))
      setTimeout(() => setSaved(p => ({ ...p, [q.id]: false })), 2500)
    }
    setSaving(p => ({ ...p, [q.id]: false }))
  }

  async function handleDownload(q, type) {
    const key = `${q.id}-${type}`
    setDownloading(p => ({ ...p, [key]: true }))
    try {
      const margin      = parseFloat(get(q, 'margin')) || 0
      const extras      = parseFloat(get(q, 'extras')) || 0
      const iva         = parseFloat(get(q, 'iva'))    || 21
      const ci          = get(q, 'clientInfo')
      const comments    = get(q, 'comments')
      const template    = get(q, 'template')
      const budgetNum   = get(q, 'budgetNumber')
      const quoteForPDF = { ...q, client_info: ci }
      if (type === 'invoice') {
        const invNum = budgetNum.replace(/^PRES-/i, 'FAC-')
        const doc = await generateClientInvoiceFromQuotePDF({
          quote: quoteForPDF, proInfo: proInfo ?? {}, marginPct: margin, extrasAmount: extras,
          clientComments: comments, ivaPct: iva, logoUrl, invoiceNumber: invNum, templateId: template,
        })
        doc?.save(`Factura_${invNum}.pdf`)
        if (get(q, 'budgetStatus') !== 'facturado') {
          const { supabase } = await import('../../../services/supabase/client')
          await supabase.from('pro_purchase_quotes').update({ budget_status: 'facturado' }).eq('id', q.id)
          onUpdate?.(q.id, { budget_status: 'facturado' })
          set(q.id, 'budgetStatus', 'facturado')
        }
      } else {
        const doc = await generateClientBudgetFromQuotePDF({
          quote: quoteForPDF, proInfo: proInfo ?? {}, marginPct: margin, extrasAmount: extras,
          clientComments: comments, ivaPct: iva, logoUrl, templateId: template,
        })
        doc?.save(`Presupuesto_${budgetNum}.pdf`)
      }
    } catch {}
    setDownloading(p => ({ ...p, [key]: false }))
  }

  const displayed = useMemo(() => {
    let list = [...cotizaciones]
    if (statusFilter !== 'all') list = list.filter(q => (q.budget_status ?? 'borrador') === statusFilter)
    list.sort((a, b) => {
      const diff = new Date(a.created_at) - new Date(b.created_at)
      return sortDir === 'desc' ? -diff : diff
    })
    return list
  }, [cotizaciones, statusFilter, sortDir])

  if (cotizaciones.length === 0) return (
    <div className="space-y-4">
      <SectionHeader title="Mis presupuestos" />
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
        <p className="font-semibold text-gray-700 mb-1">Sin presupuestos todavía</p>
        <p className="text-sm text-gray-400">Crea configuraciones de persianas para generar cotizaciones y presupuestos para tus clientes.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <SectionHeader title="Mis presupuestos" />

      {cotizaciones.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { value: 'all',       label: 'Todos' },
            { value: 'borrador',  label: 'Borrador' },
            { value: 'enviado',   label: 'Enviado' },
            { value: 'aceptado',  label: 'Aceptado' },
            { value: 'facturado', label: 'Facturado' },
          ].map(opt => (
            <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                statusFilter === opt.value
                  ? 'bg-red-700 text-white border-red-700'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}>
              {opt.label}
            </button>
          ))}
          <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="ml-auto px-3 py-1.5 text-xs font-semibold rounded-xl border bg-white text-gray-600 border-gray-300 hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            {sortDir === 'desc' ? 'Recientes' : 'Antiguas'}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {displayed.length === 0 && cotizaciones.length > 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-400">No hay presupuestos con ese estado.</p>
          </div>
        ) : displayed.map(q => {
          const isEditing  = editingId === q.id
          const total      = clientTotal(q)
          const ci         = get(q, 'clientInfo')
          const budgetNum  = get(q, 'budgetNumber')
          const budgetSt   = get(q, 'budgetStatus')
          const stObj      = BUDGET_STATUS_OPTS.find(s => s.value === budgetSt) ?? BUDGET_STATUS_OPTS[0]
          const clientName = ci?.nombre || '—'
          const canInvoice = budgetSt === 'aceptado' || budgetSt === 'facturado'

          const isExpanded = expandedId === q.id

          return (
            <div key={q.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">

              {/* Cabecera colapsable */}
              <button
                onClick={() => {
                  setExpandedId(prev => prev === q.id ? null : q.id)
                  if (expandedId !== q.id) setEditingId(null)
                }}
                className="w-full px-4 py-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${stObj.cls}`}>{stObj.label}</span>
                  <span className="text-sm font-semibold text-gray-800 truncate">{clientName}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-sm font-black text-blue-700">{fmt(total)}</span>
                  <span className="text-xs text-gray-400">{fmtDate(q.created_at)}</span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Detalle expandido */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
                  <p className="text-xs text-gray-400 font-mono">{budgetNum}</p>

                  {/* Acciones */}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => handleDownload(q, 'budget')} disabled={downloading[`${q.id}-budget`]}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors">
                      {downloading[`${q.id}-budget`]
                        ? <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
                      Presupuesto PDF
                    </button>
                    {canInvoice && (
                      <button onClick={() => handleDownload(q, 'invoice')} disabled={downloading[`${q.id}-invoice`]}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition-colors">
                        {downloading[`${q.id}-invoice`]
                          ? <span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                          : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                        Factura PDF
                      </button>
                    )}
                    <button onClick={() => setEditingId(isEditing ? null : q.id)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${isEditing ? 'bg-gray-100 text-gray-700 border-gray-300' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                      {isEditing ? 'Cerrar edición' : 'Editar'}
                    </button>
                  </div>

                  {/* Formulario de edición */}
                  {isEditing && (
                  <div className="space-y-4 pt-2 border-t border-gray-100">

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Nº presupuesto</label>
                      <input type="text" value={budgetNum}
                        onChange={e => set(q.id, 'budgetNumber', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-200 font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Estado</label>
                      <select value={budgetSt} onChange={e => set(q.id, 'budgetStatus', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-200 bg-white">
                        {BUDGET_STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600 block">Datos del cliente</label>
                    {[
                      { key: 'nombre',    placeholder: 'Nombre o razón social' },
                      { key: 'nif',       placeholder: 'NIF / DNI' },
                      { key: 'direccion', placeholder: 'Dirección completa' },
                      { key: 'email',     placeholder: 'Email' },
                    ].map(({ key, placeholder }) => (
                      <input key={key} type="text" placeholder={placeholder}
                        value={ci[key] ?? ''}
                        onChange={e => set(q.id, 'clientInfo', { ...ci, [key]: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-200 bg-white"
                      />
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500 w-16">Margen:</span>
                      <div className="relative">
                        <input type="number" min="0" max="500" step="1"
                          value={get(q, 'margin')}
                          onChange={e => set(q.id, 'margin', e.target.value)}
                          className="w-16 px-2 py-1 pr-4 text-xs rounded-lg border border-gray-200 text-center focus:outline-none focus:ring-1 focus:ring-blue-200 bg-white"
                        />
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                      </div>
                      <span className="text-xs text-gray-400">→ {fmt(parseFloat(q.admin_total_con_iva ?? q.total_con_iva ?? 0) * (1 + (parseFloat(get(q, 'margin')) || 0) / 100))}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500 w-16">Extras:</span>
                      <div className="relative">
                        <input type="number" min="0" step="0.01"
                          value={get(q, 'extras')}
                          onChange={e => set(q.id, 'extras', e.target.value)}
                          className="w-24 px-2 py-1 pr-4 text-xs rounded-lg border border-gray-200 text-center focus:outline-none focus:ring-1 focus:ring-blue-200 bg-white"
                        />
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500 w-16">IVA:</span>
                      {[21, 10, 4, 0].map(pct => (
                        <button key={pct} onClick={() => set(q.id, 'iva', pct)}
                          className={`px-2 py-0.5 text-xs font-bold rounded-lg border transition-colors ${get(q, 'iva') === pct ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                          {pct}%
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-end pt-1">
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Total cliente</p>
                        <p className="text-xl font-black text-blue-700">{fmt(total)}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">
                      Observaciones <span className="font-normal text-gray-400">(aparecen en el PDF)</span>
                    </label>
                    <textarea value={get(q, 'comments')}
                      onChange={e => set(q.id, 'comments', e.target.value)}
                      placeholder="Condiciones, materiales, plazos de entrega…"
                      rows={3}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-200 resize-y bg-white"
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400">Plantilla:</span>
                    {TEMPLATE_OPTS.map(t => {
                      const sel = get(q, 'template') === t.id
                      return (
                        <button key={t.id} onClick={() => set(q.id, 'template', t.id)}
                          style={sel ? { backgroundColor: t.color, borderColor: t.color } : {}}
                          className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-all ${sel ? 'text-white' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sel ? 'rgba(255,255,255,0.5)' : t.color }} />
                          {t.label}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <button onClick={() => handleSave(q)} disabled={saving[q.id] || saved[q.id]}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 ${saved[q.id] ? 'bg-green-600 text-white' : 'bg-blue-700 hover:bg-blue-800 text-white'}`}>
                      {saving[q.id] ? '…' : saved[q.id] ? '✓ Guardado' : 'Guardar cambios'}
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                      Cancelar
                    </button>
                  </div>
                  </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
