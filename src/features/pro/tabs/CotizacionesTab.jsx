import { useState } from 'react'
import { supabase } from '../../../services/supabase/client'
import { generateProQuotePDF, generateClientBudgetFromQuotePDF, generateClientInvoiceFromQuotePDF } from '../../../services/pdf'
import { fmt, fmtDate, blindLabel, QUOTE_STATUS, TEMPLATE_OPTS } from '../constants'
import SectionHeader from '../components/SectionHeader'
import ConfiguracionesTab from './ConfiguracionesTab'

export default function CotizacionesTab({ cotizaciones, configuraciones, setConfiguraciones, onDelete, onUpdate, proInfo, logoUrl, globalDiscount = 0 }) {
  const [expandedId,       setExpandedId]       = useState(null)
  const [deletingId,       setDeletingId]        = useState(null)
  const [confirmId,        setConfirmId]         = useState(null)
  const [downloadingId,    setDownloadingId]     = useState(null)
  const [editMargin,         setEditMargin]         = useState({})
  const [editWorkNotes,      setEditWorkNotes]      = useState({})
  const [editExtras,         setEditExtras]         = useState({})
  const [editClientComments, setEditClientComments] = useState({})
  const [editIvaPct,         setEditIvaPct]         = useState({})
  const [savingClient,       setSavingClient]       = useState({})
  const [savedClient,        setSavedClient]        = useState({})
  const [downloadingClient,  setDownloadingClient]  = useState({})
  const [acceptingClient,    setAcceptingClient]    = useState({})
  const [invoiceNums,        setInvoiceNums]        = useState({})
  const [generatingInv,      setGeneratingInv]      = useState({})
  const [editTemplate,       setEditTemplate]       = useState({})
  const [editClientInfo,     setEditClientInfo]     = useState({})

  async function handleDelete(id) {
    setDeletingId(id)
    const quote = cotizaciones.find(q => q.id === id)
    const configIds = (quote?.items ?? []).map(i => i.config_id).filter(Boolean)
    if (configIds.length > 0) {
      await supabase.from('blind_configurations').delete().in('id', configIds)
      setConfiguraciones(prev => prev.filter(c => !configIds.includes(c.id)))
    }
    await supabase.from('pro_purchase_quotes').delete().eq('id', id)
    setDeletingId(null); setConfirmId(null)
    onDelete?.(id)
  }

  async function handleDownload(q) {
    setDownloadingId(q.id)
    try {
      const doc = await generateProQuotePDF(q, proInfo ?? {})
      doc?.save(`Cotizacion_${(q.id ?? '').slice(0, 8).toUpperCase()}.pdf`)
    } catch {}
    setDownloadingId(null)
  }

  async function handleGenerateInvoice(q) {
    setGeneratingInv(p => ({ ...p, [q.id]: true }))
    try {
      const margin      = parseFloat(editMargin[q.id] !== undefined ? editMargin[q.id] : (q.client_margin_pct ?? 0))
      const extras      = parseFloat(editExtras[q.id] !== undefined ? editExtras[q.id] : (q.extras_amount ?? 0)) || 0
      const comments    = editClientComments[q.id] !== undefined ? editClientComments[q.id] : (q.client_comments ?? null)
      const ivaPct      = parseFloat(editIvaPct[q.id] !== undefined ? editIvaPct[q.id] : (q.iva_pct ?? 21))
      const invNum      = invoiceNums[q.id] || `FAC-${(q.id ?? '').slice(0, 8).toUpperCase()}`
      const tpl         = editTemplate[q.id] ?? 'azul'
      const clientInfo  = editClientInfo[q.id] !== undefined ? editClientInfo[q.id] : (q.client_info ?? null)
      const quoteForPDF = { ...q, client_info: clientInfo }
      const doc = await generateClientInvoiceFromQuotePDF({
        quote: quoteForPDF, proInfo: proInfo ?? {}, marginPct: margin, extrasAmount: extras, clientComments: comments, ivaPct, logoUrl, invoiceNumber: invNum, templateId: tpl,
      })
      doc?.save(`Factura_cliente_${invNum}.pdf`)
    } catch {}
    setGeneratingInv(p => ({ ...p, [q.id]: false }))
  }

  async function handleSaveClientData(id, adminTotal, currentMarginPct, currentWorkNotes, currentClientInfo, currentExtras, currentClientComments, currentIvaPct) {
    setSavingClient(p => ({ ...p, [id]: true }))
    const margin      = parseFloat(editMargin[id] !== undefined ? editMargin[id] : (currentMarginPct ?? 0))
    const extras      = parseFloat(editExtras[id] !== undefined ? editExtras[id] : (currentExtras ?? 0)) || 0
    const ivaPct      = parseFloat(editIvaPct[id] !== undefined ? editIvaPct[id] : (currentIvaPct ?? 21))
    const clientTotal = parseFloat(adminTotal) * (1 + margin / 100) + extras
    const notes       = editWorkNotes[id] !== undefined ? editWorkNotes[id] : (currentWorkNotes ?? null)
    const comments    = editClientComments[id] !== undefined ? editClientComments[id] : (currentClientComments ?? null)
    const ci          = editClientInfo[id] !== undefined ? editClientInfo[id] : (currentClientInfo ?? null)
    const updates     = { client_margin_pct: margin, client_total: clientTotal, extras_amount: extras, iva_pct: ivaPct }
    if (notes !== null) updates.work_notes = notes.trim() || null
    if (comments !== null) updates.client_comments = comments.trim() || null
    if (ci !== null) updates.client_info = Object.values(ci).some(v => v?.trim()) ? ci : null
    const { error } = await supabase.from('pro_purchase_quotes').update(updates).eq('id', id)
    if (!error) {
      onUpdate?.(id, updates)
      setSavedClient(p => ({ ...p, [id]: true }))
      setTimeout(() => setSavedClient(p => ({ ...p, [id]: false })), 2000)
    }
    setSavingClient(p => ({ ...p, [id]: false }))
  }

  async function handleClientAccepted(id) {
    setAcceptingClient(p => ({ ...p, [id]: true }))
    const now = new Date().toISOString()
    await supabase.from('pro_purchase_quotes').update({ client_status: 'accepted', client_accepted_at: now }).eq('id', id)
    onUpdate?.(id, { client_status: 'accepted', client_accepted_at: now })
    setAcceptingClient(p => ({ ...p, [id]: false }))
  }

  async function handleDownloadClientPDF(q) {
    setDownloadingClient(p => ({ ...p, [q.id]: true }))
    const margin      = parseFloat(editMargin[q.id] !== undefined ? editMargin[q.id] : (q.client_margin_pct ?? 0))
    const extras      = parseFloat(editExtras[q.id] !== undefined ? editExtras[q.id] : (q.extras_amount ?? 0)) || 0
    const comments    = editClientComments[q.id] !== undefined ? editClientComments[q.id] : (q.client_comments ?? null)
    const ivaPct      = parseFloat(editIvaPct[q.id] !== undefined ? editIvaPct[q.id] : (q.iva_pct ?? 21))
    const clientInfo  = editClientInfo[q.id] !== undefined ? editClientInfo[q.id] : (q.client_info ?? null)
    const quoteForPDF = { ...q, client_info: clientInfo }
    try {
      const tpl = editTemplate[q.id] ?? 'azul'
      const doc = await generateClientBudgetFromQuotePDF({ quote: quoteForPDF, proInfo: proInfo ?? {}, marginPct: margin, extrasAmount: extras, clientComments: comments, ivaPct, logoUrl, templateId: tpl })
      doc?.save(`Presupuesto_${(q.id ?? '').slice(0, 8).toUpperCase()}.pdf`)
    } catch {}
    setDownloadingClient(p => ({ ...p, [q.id]: false }))
  }

  if (cotizaciones.length === 0) return (
    <div className="space-y-4">
      <SectionHeader title="Cotizaciones y presupuestos" />
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
        <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
          </svg>
        </div>
        <p className="font-semibold text-gray-700 mb-1">Sin cotizaciones todavía</p>
        <p className="text-sm text-gray-400">Cuando guardes una configuración se generará tu cotización de compra y el presupuesto para tu cliente.</p>
      </div>
      <div className="pt-2">
        <ConfiguracionesTab configuraciones={configuraciones ?? []} setConfiguraciones={setConfiguraciones} globalDiscount={globalDiscount} hideHeader />
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <SectionHeader title="Cotizaciones y presupuestos" />
      <div className="space-y-3">
        {cotizaciones.map(q => {
          const st         = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.pending
          const adminTotal = q.admin_total_con_iva ?? q.total_con_iva ?? 0
          const isOpen     = expandedId === q.id
          const isAccepted = q.status === 'accepted' || q.status === 'modified'
          const clientMargin = parseFloat(editMargin[q.id] !== undefined ? editMargin[q.id] : (q.client_margin_pct ?? 0))
          const extras       = parseFloat(editExtras[q.id] !== undefined ? editExtras[q.id] : (q.extras_amount ?? 0)) || 0
          const clientTotal  = adminTotal * (1 + clientMargin / 100) + extras
          const clientAccepted = q.client_status === 'accepted'
          return (
            <div key={q.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {/* Cabecera colapsable */}
              <button onClick={() => setExpandedId(isOpen ? null : q.id)}
                className="w-full px-4 py-4 flex items-center justify-between gap-3 text-left">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    {clientAccepted && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Cliente ✓</span>
                    )}
                    <span className="text-xs text-gray-400">{fmtDate(q.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-600">{(q.items ?? []).length} persiana{(q.items ?? []).length !== 1 ? 's' : ''} · Dto. {q.discount_pct}%</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-base font-black text-red-700">{fmt(adminTotal)}</span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-5 pt-1 border-t border-gray-100 space-y-3">

                  {/* ── SECCIÓN 1: Tu compra a Santander ── */}
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide pt-1">Tu compra a Persianas Santander</p>
                  <div className="space-y-2">
                    {(q.items ?? []).map((it, i) => (
                      <div key={i} className="flex items-start justify-between bg-gray-50 rounded-xl px-3 py-2 text-sm gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800">{blindLabel(it.blind_type)}</p>
                          <p className="text-xs text-gray-400">
                            {it.width && it.height ? `${it.width}×${it.height} mm` : ''}
                            {it.mechanism ? ` · ${it.mechanism}` : ''}
                            {it.mechanism === 'cinta' && it.orientation ? ` (${it.orientation})` : ''}
                            {it.mechanism === 'motor' && it.motor_type ? ` · ${it.motor_type}` : ''}
                            {it.guide_type && it.guide_type !== 'none' ? ` · guía ${it.guide_type}` : ''}
                          </p>
                          <p className="text-xs text-gray-400">
                            {['sistema_mini_cajon_pvc','sistema_mini_cajon_aluminio','sistema_mini_autoblocante'].includes(it.blind_type)
                              ? [it.box_color_name ? `Cajón: ${it.box_color_name}` : '', it.slat_color_name ? `Lamas: ${it.slat_color_name}` : ''].filter(Boolean).join(' · ')
                              : it.blind_type !== 'solo_motor' && it.slat_color_name ? `Color: ${it.slat_color_name}` : ''}
                            {it.installacion ? ' · Con instalación' : ''}
                          </p>
                        </div>
                        <span className="font-bold text-gray-700 flex-shrink-0">{fmt(it.price_professional * 1.21)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-4 text-sm border-t border-gray-100 pt-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Sin IVA</p>
                      <p className="font-semibold text-gray-700">{fmt(adminTotal / 1.21)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Total con IVA</p>
                      <p className="font-black text-red-700 text-base">{fmt(adminTotal)}</p>
                    </div>
                  </div>

                  {q.admin_notes && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                      <p className="text-xs font-semibold text-blue-700 mb-1">Nota de Persianas Santander</p>
                      <p className="text-sm text-blue-800">{q.admin_notes}</p>
                    </div>
                  )}

                  {isAccepted ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-sm text-green-700 font-medium">Cotización aceptada por Persianas Santander.</p>
                    </div>
                  ) : q.status === 'rejected' ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      <p className="text-sm text-red-700">Cotización rechazada. Contacta con nosotros.</p>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <p className="text-sm text-amber-700">En revisión por Persianas Santander. Te notificaremos.</p>
                    </div>
                  )}

                  {/* ── SECCIÓN 2: Presupuesto para tu cliente ── */}
                  <div className="mt-1 pt-3 border-t border-blue-100 bg-blue-50/40 rounded-xl px-3 py-3 space-y-3">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Presupuesto para tu cliente</p>

                    {/* Margen */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-600">Tu margen:</span>
                        <div className="relative">
                          <input
                            type="number" min="0" max="500" step="1"
                            value={editMargin[q.id] !== undefined ? editMargin[q.id] : (q.client_margin_pct ?? 0)}
                            onChange={e => setEditMargin(p => ({ ...p, [q.id]: e.target.value }))}
                            className="w-16 px-2 py-1 pr-4 rounded-lg border border-gray-300 text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-300"
                          />
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                        </div>
                        <span className="text-xs text-gray-400">o</span>
                        <div className="relative">
                          <input
                            type="number" min="0" step="0.01"
                            value={adminTotal > 0 ? (adminTotal * (parseFloat(editMargin[q.id] !== undefined ? editMargin[q.id] : (q.client_margin_pct ?? 0)) / 100)).toFixed(2) : '0.00'}
                            onChange={e => {
                              const eur = parseFloat(e.target.value) || 0
                              const pct = adminTotal > 0 ? (eur / adminTotal) * 100 : 0
                              setEditMargin(p => ({ ...p, [q.id]: pct.toFixed(4) }))
                            }}
                            className="w-20 px-2 py-1 pr-4 rounded-lg border border-gray-300 text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-300"
                          />
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                        </div>
                      </div>

                      {/* Extras */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-600">Trabajos extra:</span>
                        <div className="relative">
                          <input
                            type="number" min="0" step="0.01"
                            value={editExtras[q.id] !== undefined ? editExtras[q.id] : (q.extras_amount ?? 0)}
                            onChange={e => setEditExtras(p => ({ ...p, [q.id]: e.target.value }))}
                            className="w-24 px-2 py-1 pr-4 rounded-lg border border-gray-300 text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-300"
                          />
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                        </div>
                        <span className="text-xs text-gray-400">→ Total cliente:</span>
                        <span className="text-sm font-black text-blue-700">{fmt(clientTotal)}</span>
                      </div>

                      {/* IVA */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-600">IVA:</span>
                        {[21, 10, 4, 0].map(pct => (
                          <button key={pct}
                            onClick={() => setEditIvaPct(p => ({ ...p, [q.id]: pct }))}
                            className={`px-2 py-0.5 rounded-lg text-xs font-bold border transition-colors ${(editIvaPct[q.id] !== undefined ? editIvaPct[q.id] : (q.iva_pct ?? 21)) === pct ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Datos del cliente final */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-gray-600">Datos del cliente final</label>
                        <button
                          onClick={() => handleSaveClientData(q.id, adminTotal, q.client_margin_pct, q.work_notes, q.client_info, q.extras_amount, q.client_comments, q.iva_pct)}
                          disabled={savingClient[q.id] || savedClient[q.id]}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 ${savedClient[q.id] ? 'bg-green-600 text-white' : 'bg-blue-700 hover:bg-blue-800 text-white'}`}>
                          {savingClient[q.id] ? '…' : savedClient[q.id] ? '✓ Guardado' : 'Guardar'}
                        </button>
                      </div>
                      {[
                        { key: 'nombre',    placeholder: 'Nombre o razón social' },
                        { key: 'nif',       placeholder: 'NIF / DNI' },
                        { key: 'direccion', placeholder: 'Dirección completa' },
                        { key: 'email',     placeholder: 'Email' },
                      ].map(({ key, placeholder }) => {
                        const ci = editClientInfo[q.id] ?? q.client_info ?? {}
                        return (
                          <input key={key} type="text" placeholder={placeholder}
                            value={ci[key] ?? ''}
                            onChange={e => setEditClientInfo(p => ({
                              ...p,
                              [q.id]: { ...(p[q.id] ?? q.client_info ?? {}), [key]: e.target.value }
                            }))}
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-200 bg-white"
                          />
                        )
                      })}
                    </div>

                    {/* Comentarios para el cliente — aparecen en el PDF */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">
                        Comentarios para el cliente <span className="text-gray-400 font-normal">(aparecen en el presupuesto)</span>
                      </label>
                      <textarea
                        value={editClientComments[q.id] !== undefined ? editClientComments[q.id] : (q.client_comments ?? '')}
                        onChange={e => setEditClientComments(p => ({ ...p, [q.id]: e.target.value }))}
                        placeholder="Descripción de los trabajos, condiciones, materiales, plazos de entrega…"
                        rows={4}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 resize-y bg-white"
                      />
                    </div>

                    {/* Notas de trabajo — solo visibles internamente para el admin */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">
                        Notas de trabajo <span className="text-gray-400 font-normal">(internas — solo las ve Persianas Santander)</span>
                      </label>
                      <textarea
                        value={editWorkNotes[q.id] !== undefined ? editWorkNotes[q.id] : (q.work_notes ?? '')}
                        onChange={e => setEditWorkNotes(p => ({ ...p, [q.id]: e.target.value }))}
                        placeholder="Instalación en 2ª planta, requiere desmontaje previo, características especiales…"
                        rows={2}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 resize-none bg-white"
                      />
                    </div>

                    {/* Selector de plantilla PDF */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-400 shrink-0">Plantilla:</span>
                      {TEMPLATE_OPTS.map(t => {
                        const sel = (editTemplate[q.id] ?? 'azul') === t.id
                        return (
                          <button key={t.id}
                            onClick={() => setEditTemplate(p => ({ ...p, [q.id]: t.id }))}
                            title={t.label}
                            style={sel ? { backgroundColor: t.color, borderColor: t.color } : {}}
                            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-all ${sel ? 'text-white' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sel ? 'rgba(255,255,255,0.5)' : t.color }} />
                            {t.label}
                          </button>
                        )
                      })}
                    </div>

                    {/* Acciones cliente */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => handleDownloadClientPDF(q)} disabled={downloadingClient[q.id]}
                        className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                        {downloadingClient[q.id]
                          ? <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        }
                        PDF para cliente
                      </button>

                      {clientAccepted ? (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Cliente aceptó · {fmtDate(q.client_accepted_at)}
                        </div>
                      ) : (
                        <button onClick={() => handleClientAccepted(q.id)} disabled={acceptingClient[q.id]}
                          className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                          {acceptingClient[q.id]
                            ? <span className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          }
                          Mi cliente ha aceptado
                        </button>
                      )}
                    </div>

                    {/* Factura para cliente — cuando el cliente ha aceptado el presupuesto */}
                    {clientAccepted && (
                      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-blue-100 mt-1">
                        <span className="text-xs text-blue-600 font-medium">Factura cliente:</span>
                        <input
                          type="text"
                          value={invoiceNums[q.id] ?? `FAC-${(q.id ?? '').slice(0, 8).toUpperCase()}`}
                          onChange={e => setInvoiceNums(p => ({ ...p, [q.id]: e.target.value }))}
                          className="w-36 border border-blue-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
                          placeholder="Nº factura"
                        />
                        <button onClick={() => handleGenerateInvoice(q)} disabled={generatingInv[q.id]}
                          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                          {generatingInv[q.id]
                            ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          }
                          Generar factura
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Acciones generales */}
                  <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                    {isAccepted && (
                      <button onClick={() => handleDownload(q)} disabled={downloadingId === q.id}
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
                        {downloadingId === q.id
                          ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        }
                        PDF cotización Santander
                      </button>
                    )}
                    <div className="ml-auto">
                      {confirmId === q.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-600 font-medium">¿Eliminar?</span>
                          <button onClick={() => handleDelete(q.id)} disabled={deletingId === q.id}
                            className="text-xs font-bold text-red-600 hover:text-red-800 disabled:opacity-50">
                            {deletingId === q.id ? '…' : 'Sí'}
                          </button>
                          <button onClick={() => setConfirmId(null)} className="text-xs text-gray-500">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmId(q.id)}
                          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Configuraciones guardadas ── */}
      <div className="pt-2">
        <ConfiguracionesTab configuraciones={configuraciones ?? []} setConfiguraciones={setConfiguraciones} globalDiscount={globalDiscount} hideHeader />
      </div>
    </div>
  )
}
