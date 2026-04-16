import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../services/supabase/client'
import { useCart } from '../context/CartContext'
import { generateGroupBudgetPDF, generateGroupInvoicePDF, generateOrderInvoicePDF } from '../services/pdf'
import { getProfessionalDiscountForUser } from '../services/settings'
import WAButton from '../shared/WAButton'

// ── Helpers ───────────────────────────────────────────────────────────────
const fmt     = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
const fmtDate = (d) => d ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—'
const uid     = () => Math.random().toString(36).slice(2, 10)

const BLIND_LABELS = {
  laminada:                    'Paño laminado',
  autoblocante:                'Paño autoblocante',
  blocking:                    'Bloqueante',
  sistema_mini_cajon_pvc:      'Mini Cajón PVC',
  sistema_mini_cajon_aluminio: 'Mini Cajón Aluminio',
  sistema_mini_autoblocante:   'Mini Autoblocante',
  solo_guias:                  'Solo guías',
  solo_motor:                  'Solo motor',
  mosquitera_enrollable:       'Mosquitera',
  sistema_mini_pvc:            'Mini PVC',
  sistema_mini_aluminio:       'Mini Aluminio',
  motor_mas_guias:             'Motor + Guías',
  pano_mas_guias:              'Paño + Guías',
}
const blindLabel = (t) => BLIND_LABELS[t] ?? t ?? '—'

function processConfigurations(configs) {
  const groupMap = new Map()
  const singles  = []
  for (const config of configs) {
    const match = config.configuration_number?.match(/^GRUPO-(.+)-(\d+)$/)
    if (match) {
      const groupId = match[1]
      if (!groupMap.has(groupId)) groupMap.set(groupId, [])
      groupMap.get(groupId).push(config)
    } else {
      singles.push({ type: 'single', id: config.id, item: config, sortDate: config.created_at })
    }
  }
  const result = []
  for (const [groupId, items] of groupMap) {
    const sorted = [...items].sort((a, b) => {
      const na = parseInt(a.configuration_number?.match(/-(\d+)$/)?.[1] ?? '0')
      const nb = parseInt(b.configuration_number?.match(/-(\d+)$/)?.[1] ?? '0')
      return na - nb
    })
    result.push({ type: 'group', id: `group-${groupId}`, items: sorted, sortDate: sorted[0].created_at })
  }
  for (const s of singles) result.push(s)
  result.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate))
  return result
}

const PROJECT_STATUS = {
  draft:    { label: 'Borrador',  cls: 'bg-gray-100 text-gray-600'    },
  sent:     { label: 'Enviado',   cls: 'bg-blue-100 text-blue-700'    },
  accepted: { label: 'Aceptado',  cls: 'bg-green-100 text-green-700'  },
  rejected: { label: 'Rechazado', cls: 'bg-red-100 text-red-700'      },
}

const ORDER_STATUS = {
  pending:   { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700'  },
  confirmed: { label: 'Confirmado', cls: 'bg-blue-100 text-blue-700'    },
  completed: { label: 'Completado', cls: 'bg-green-100 text-green-700'  },
  cancelled: { label: 'Cancelado',  cls: 'bg-red-100 text-red-700'      },
}

const TABS = [
  { id: 'overview',         label: 'Resumen',          icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
  { id: 'proyectos',        label: 'Proyectos',        icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { id: 'configuraciones',  label: 'Configuraciones',  icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { id: 'pedidos',          label: 'Pedidos',          icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'empresa',          label: 'Mi empresa',       icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
]

// ── Componentes base ──────────────────────────────────────────────────────
function Badge({ status, map = PROJECT_STATUS }) {
  const s = map[status] ?? { label: status ?? '—', cls: 'bg-gray-100 text-gray-600' }
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
}

function Spinner({ small }) {
  return <span className={`inline-block border-2 border-current border-t-transparent rounded-full animate-spin ${small ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
}

function Field({ label, value, onChange, type = 'text', placeholder = '', required }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}{required && ' *'}
      </label>
      <input type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 transition-colors" />
    </div>
  )
}

function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      {action}
    </div>
  )
}

// ── Modal: Añadir ítem desde configuraciones guardadas ────────────────────
function AddItemModal({ configuraciones, onAdd, onClose }) {
  const [selected, setSelected] = useState(null)
  const [desc,     setDesc]     = useState('')
  const [price,    setPrice]    = useState('')
  const [err,      setErr]      = useState('')

  function handleConfirm() {
    if (!selected) { setErr('Selecciona una configuración'); return }
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) { setErr('Introduce un precio válido'); return }
    onAdd({
      item_id:        uid(),
      config_id:      selected.id,
      description:    desc.trim() || blindLabel(selected.blind_type),
      blind_type:     selected.blind_type,
      mechanism:      selected.mechanism,
      motor_type:     selected.motor_type ?? null,
      guide_type:     selected.guide_type ?? null,
      width:          selected.width,
      height:         selected.height,
      box_color_name: selected.box_color_name ?? null,
      slat_color_name:selected.slat_color_name ?? null,
      cost_price:     selected.estimated_price ?? 0,
      client_price:   parseFloat(price),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Añadir persiana al proyecto</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {configuraciones.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <p className="text-sm">No tienes configuraciones guardadas.</p>
              <Link to="/configurador" className="mt-3 inline-block text-sm font-bold text-red-700 hover:underline">Ir al configurador →</Link>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {configuraciones.map(c => (
                <button key={c.id} onClick={() => { setSelected(c); setPrice(String(c.estimated_price ?? '')); setErr('') }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all ${
                    selected?.id === c.id ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{blindLabel(c.blind_type)}</p>
                    <p className="text-xs text-gray-400">{c.width} × {c.height} mm · {c.mechanism}</p>
                  </div>
                  <span className={`text-sm font-bold flex-shrink-0 ml-3 ${selected?.id === c.id ? 'text-red-700' : 'text-gray-700'}`}>
                    {fmt(c.estimated_price)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <>
              <Field label="Descripción (opcional)" value={desc} onChange={setDesc} placeholder="Ej: Ventana salón, Puerta garaje…" />
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Precio para el cliente (€ con IVA) *</label>
                <div className="relative">
                  <input type="number" min="0" step="0.01" value={price} onChange={e => { setPrice(e.target.value); setErr('') }}
                    className="w-full px-3.5 py-2.5 pr-8 rounded-xl border border-gray-300 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                </div>
                {price && !isNaN(parseFloat(price)) && (
                  <p className="text-xs text-gray-400 mt-1">Sin IVA: {fmt(parseFloat(price) / 1.21)}</p>
                )}
              </div>
            </>
          )}

          {err && <p className="text-xs text-red-600 font-medium">{err}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={handleConfirm} disabled={!selected}
              className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-sm font-bold disabled:opacity-40 transition-colors">
              Añadir
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal: Editar / ver proyecto ──────────────────────────────────────────
function ProjectModal({ project: initial, configuraciones, empresa, logoUrl, onSave, onDelete, onClose }) {
  const [project,      setProject]      = useState({ ...initial })
  const [saving,       setSaving]       = useState(false)
  const [generating,   setGenerating]   = useState(null) // 'budget' | 'invoice'
  const [showAddItem,  setShowAddItem]  = useState(false)
  const [invoiceNumber,setInvoiceNumber]= useState(`F-${Date.now().toString().slice(-6)}`)
  const [showInvNum,   setShowInvNum]   = useState(false)
  const [saved,        setSaved]        = useState(false)

  const items    = project.items ?? []
  const total    = items.reduce((s, it) => s + (Number(it.client_price) || 0), 0)
  const isNew    = !initial.id

  function updateField(field, value) { setProject(p => ({ ...p, [field]: value })) }

  function updateItem(item_id, field, value) {
    setProject(p => ({
      ...p,
      items: (p.items ?? []).map(it => it.item_id === item_id ? { ...it, [field]: field === 'client_price' ? parseFloat(value) || 0 : value } : it),
    }))
  }

  function removeItem(item_id) {
    setProject(p => ({ ...p, items: (p.items ?? []).filter(it => it.item_id !== item_id) }))
  }

  function addItem(item) { setProject(p => ({ ...p, items: [...(p.items ?? []), item] })) }

  async function handleSave() {
    setSaving(true)
    const updated = { ...project, updated_at: new Date().toISOString() }
    await onSave(updated)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleBudget() {
    setGenerating('budget')
    const bNum = `PRO-${Date.now().toString().slice(-6)}`
    const updated = { ...project, budget_number: bNum }
    await generateGroupBudgetPDF({ project: updated, empresa, logoUrl })
    await onSave({ ...updated, status: project.status === 'draft' ? 'sent' : project.status })
    setProject(updated)
    setGenerating(null)
  }

  async function handleInvoice() {
    setGenerating('invoice')
    await generateGroupInvoicePDF({ project, empresa, logoUrl, invoiceNumber })
    setGenerating(null)
    setShowInvNum(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-mono">{project.budget_number ?? (isNew ? 'Nuevo proyecto' : `#${project.id?.slice(0,8).toUpperCase()}`)}</p>
            <h2 className="text-lg font-bold text-gray-900 mt-0.5">{isNew ? 'Crear proyecto' : (project.name || 'Proyecto sin nombre')}</h2>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && <Badge status={project.status} />}
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Info básica */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre del proyecto" value={project.name ?? ''} onChange={v => updateField('name', v)} placeholder="Ej: Casa García - Calle Mayor" />
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Estado</label>
              <select value={project.status ?? 'draft'} onChange={e => updateField('status', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400">
                {Object.entries(PROJECT_STATUS).map(([k, { label }]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
          </div>

          {/* Datos del cliente */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Datos del cliente</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nombre *" value={project.client_name ?? ''} onChange={v => updateField('client_name', v)} placeholder="Juan García" />
              <Field label="NIF / DNI" value={project.client_nif ?? ''} onChange={v => updateField('client_nif', v)} placeholder="12345678A" />
              <Field label="Teléfono" value={project.client_phone ?? ''} onChange={v => updateField('client_phone', v)} placeholder="600 123 456" type="tel" />
              <Field label="Email" value={project.client_email ?? ''} onChange={v => updateField('client_email', v)} placeholder="cliente@email.com" type="email" />
              <div className="sm:col-span-2">
                <Field label="Dirección" value={project.client_address ?? ''} onChange={v => updateField('client_address', v)} placeholder="Calle Mayor 1, Santander" />
              </div>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notas internas</label>
            <textarea rows={2} value={project.notes ?? ''} onChange={e => updateField('notes', e.target.value)}
              placeholder="Observaciones, condiciones especiales…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 resize-none" />
          </div>

          {/* Ítems */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Persianas ({items.length})
              </p>
              <button onClick={() => setShowAddItem(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Añadir persiana
              </button>
            </div>

            {items.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                <p className="text-sm text-gray-400">Sin persianas. Pulsa "Añadir persiana" para empezar.</p>
                <Link to="/configurador" className="mt-2 inline-block text-xs font-bold text-red-700 hover:underline">
                  O crea una nueva configuración →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.item_id} className="bg-gray-50 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 bg-red-700 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                        <input
                          value={item.description ?? ''}
                          onChange={e => updateItem(item.item_id, 'description', e.target.value)}
                          placeholder="Descripción (opcional)"
                          className="flex-1 text-sm font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:bg-white focus:px-2 rounded-lg transition-all"
                        />
                      </div>
                      <p className="text-xs text-gray-400 ml-7">
                        {blindLabel(item.blind_type)} · {item.width}×{item.height} mm · {item.mechanism}
                        {item.box_color_name && ` · ${item.box_color_name}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="relative">
                        <input
                          type="number" min="0" step="0.01"
                          value={item.client_price ?? ''}
                          onChange={e => updateItem(item.item_id, 'client_price', e.target.value)}
                          className="w-24 px-2.5 py-1.5 pr-5 rounded-lg border border-gray-300 text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-red-100"
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                      </div>
                      <button onClick={() => removeItem(item.item_id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}

                {/* Total */}
                <div className="flex justify-end pt-2 border-t border-gray-200">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Sin IVA: {fmt(total / 1.21)}</p>
                    <p className="text-lg font-black text-red-700">Total: {fmt(total)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100">
            {/* Eliminar */}
            {!isNew && (
              <button onClick={() => { if (window.confirm('¿Eliminar este proyecto?')) { onDelete(project.id); onClose() } }}
                className="sm:mr-auto px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">
                Eliminar
              </button>
            )}

            {/* Guardar */}
            <button onClick={handleSave} disabled={saving || !project.client_name?.trim()}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-40'}`}>
              {saving ? <Spinner small /> : saved ? '✓ Guardado' : 'Guardar proyecto'}
            </button>

            {/* Presupuesto PDF */}
            {items.length > 0 && (
              <button onClick={handleBudget} disabled={!!generating || !project.client_name?.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold disabled:opacity-40 transition-colors">
                {generating === 'budget' ? <Spinner small /> : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                Presupuesto PDF
              </button>
            )}

            {/* Factura PDF */}
            {items.length > 0 && !showInvNum && (
              <button onClick={() => setShowInvNum(true)} disabled={!!generating || !project.client_name?.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-bold disabled:opacity-40 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Factura PDF
              </button>
            )}
          </div>

          {/* Campo nº factura inline */}
          {showInvNum && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-green-700 mb-1">Nº de factura</label>
                <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-green-300 text-sm focus:outline-none" />
              </div>
              <button onClick={handleInvoice} disabled={generating === 'invoice'}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-700 hover:bg-green-800 text-white text-sm font-bold transition-colors">
                {generating === 'invoice' ? <Spinner small /> : 'Generar'}
              </button>
              <button onClick={() => setShowInvNum(false)} className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {showAddItem && (
        <AddItemModal configuraciones={configuraciones} onAdd={addItem} onClose={() => setShowAddItem(false)} />
      )}
    </div>
  )
}

// ── Tab Proyectos ─────────────────────────────────────────────────────────
function ProyectosTab({ proyectos, setProyectos, configuraciones, empresa, logoUrl, user }) {
  const [modal,    setModal]    = useState(null) // null | project object | 'new'
  const [search,   setSearch]   = useState('')
  const [statusF,  setStatusF]  = useState('all')

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
    } else {
      // Actualizar
      const { data, error } = await supabase.from('pro_projects').update(updated).eq('id', updated.id).select().single()
      if (!error && data) setProyectos(prev => prev.map(p => p.id === data.id ? data : p))
    }
  }

  async function deleteProject(id) {
    await supabase.from('pro_projects').delete().eq('id', id)
    setProyectos(prev => prev.filter(p => p.id !== id))
  }

  const filtered = proyectos.filter(p => {
    const q = search.toLowerCase()
    const matchQ = !q || p.name?.toLowerCase().includes(q) || p.client_name?.toLowerCase().includes(q)
    const matchS = statusF === 'all' || p.status === statusF
    return matchQ && matchS
  })

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Proyectos"
        action={
          <button onClick={() => setModal(EMPTY_PROJECT)}
            className="flex items-center gap-2 text-sm font-bold bg-red-700 text-white px-4 py-2 rounded-xl hover:bg-red-800 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo proyecto
          </button>
        }
      />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o cliente…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400" />
        </div>
        <select value={statusF} onChange={e => setStatusF(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400">
          <option value="all">Todos los estados</option>
          {Object.entries(PROJECT_STATUS).map(([k, { label }]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <p className="font-semibold text-gray-700 mb-1">{search || statusF !== 'all' ? 'Sin resultados' : 'Todavía no hay proyectos'}</p>
          <p className="text-sm text-gray-400 mb-5">
            {search || statusF !== 'all' ? 'Prueba con otros filtros' : 'Crea tu primer proyecto para agrupar persianas de un cliente y generar el presupuesto de una vez.'}
          </p>
          {!search && statusF === 'all' && (
            <button onClick={() => setModal(EMPTY_PROJECT)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-700 text-white text-sm font-bold rounded-xl hover:bg-red-800 transition-colors">
              + Nuevo proyecto
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(p => {
            const items = p.items ?? []
            const total = items.reduce((s, it) => s + (Number(it.client_price) || 0), 0)
            const st    = PROJECT_STATUS[p.status] ?? PROJECT_STATUS.draft
            return (
              <button key={p.id} onClick={() => setModal(p)}
                className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-left hover:border-red-200 hover:shadow-md transition-all group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-gray-900 truncate">{p.name || p.client_name || 'Proyecto sin nombre'}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${st.cls}`}>{st.label}</span>
                    </div>
                    {p.name && p.client_name && (
                      <p className="text-sm text-gray-500 truncate mb-1">{p.client_name}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{items.length} persiana{items.length !== 1 ? 's' : ''}</span>
                      {p.budget_number && <span className="font-mono">{p.budget_number}</span>}
                      <span>{fmtDate(p.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xl font-black text-red-700">{fmt(total)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">con IVA</p>
                  </div>
                </div>
                {items.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {items.slice(0, 4).map(it => (
                      <span key={it.item_id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {it.description || blindLabel(it.blind_type)}
                      </span>
                    ))}
                    {items.length > 4 && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">+{items.length - 4} más</span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {modal && (
        <ProjectModal
          project={modal}
          configuraciones={configuraciones}
          empresa={empresa}
          logoUrl={logoUrl}
          onSave={saveProject}
          onDelete={deleteProject}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ── Tarjeta de configuración con carrito ──────────────────────────────────
function ProConfigCard({ c, onDelete, deleting }) {
  const navigate               = useNavigate()
  const { addToCart, items: cartItems } = useCart()
  const [adding,    setAdding]   = useState(false)
  const [expanded,  setExpanded] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const added = cartItems.some(ci => ci.configuration_id === c.id)

  async function handleAddToCart() {
    setAdding(true)
    const { error } = await addToCart(c.id)
    setAdding(false)
    if (!error) setTimeout(() => navigate('/cesta'), 600)
  }

  const borderCls = added
    ? 'bg-green-50 border-green-200'
    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${borderCls}`}>
      {/* ── Cabecera colapsable ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {added ? (
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          )}
          <span className={`text-xs font-bold truncate ${added ? 'text-green-700' : 'text-gray-800'}`}>
            {added ? 'En cesta · ' : ''}{blindLabel(c.blind_type)}
          </span>
          {!added && c.width && c.height && (
            <span className="text-xs text-gray-400 hidden sm:inline">· {c.width}×{c.height}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className={`text-sm font-black ${added ? 'text-green-700' : 'text-red-700'}`}>{fmt(c.estimated_price)}</span>
          <span className="text-xs text-gray-400">{fmtDate(c.created_at)}</span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Detalle expandido ── */}
      {expanded && (
        <div className={`px-4 pb-4 pt-3 border-t space-y-3 ${added ? 'border-green-100' : 'border-gray-100'}`}>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {c.width && c.height && <span>{c.width} × {c.height} mm</span>}
            {c.mechanism && <span>{c.mechanism}</span>}
            {c.slat_color_name && <span>{c.slat_color_name}</span>}
          </div>

          {added ? (
            <button onClick={() => navigate('/cesta')}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-green-600 text-white hover:bg-green-700 transition-colors">
              Ir a la cesta →
            </button>
          ) : (
            <button onClick={handleAddToCart} disabled={adding}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-60 transition-colors">
              {adding ? <Spinner small /> : (
                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>Añadir a la cesta</>
              )}
            </button>
          )}

          <div className="flex gap-2">
            <button onClick={() => navigate('/configurador')}
              className="flex-1 text-xs font-semibold py-2 px-3 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
              Nueva similar
            </button>
            {confirmDel ? (
              <div className="flex gap-1.5">
                <button onClick={() => setConfirmDel(false)}
                  className="text-xs font-semibold py-2 px-3 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={() => onDelete(c.id)} disabled={deleting === c.id}
                  className="text-xs font-bold py-2 px-3 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center gap-1.5">
                  {deleting === c.id ? <Spinner small /> : null}Eliminar
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(true)}
                className="text-xs font-semibold py-2 px-3 rounded-lg border border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de grupo (varias persianas de una sesión) ────────────────────
function ProGroupCard({ items, onDeleteGroup, deleting }) {
  const { addToCart, items: cartItems } = useCart()
  const navigate = useNavigate()
  const [adding,   setAdding]   = useState(false)
  const [expanded, setExpanded] = useState(false)  // collapsed by default
  const [confirm,  setConfirm]  = useState(false)

  const total    = items.reduce((s, c) => s + (c.estimated_price ?? 0), 0)
  const allInCart = cartItems.length > 0 && items.every(c => cartItems.some(ci => ci.configuration_id === c.id))

  async function handleAddAllToCart() {
    setAdding(true)
    for (const c of items) await addToCart(c.id)
    setAdding(false)
    setTimeout(() => navigate('/cesta'), 600)
  }

  const borderCls = allInCart
    ? 'bg-green-50 border-green-200'
    : 'bg-white border-red-100 hover:border-red-200 hover:shadow-sm'

  return (
    <div className={`border-2 rounded-2xl overflow-hidden transition-all ${borderCls}`}>
      {/* ── Cabecera siempre visible (toggle) ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {allInCart ? (
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          )}
          <span className={`text-xs font-bold truncate ${allInCart ? 'text-green-700' : 'text-red-700'}`}>
            {allInCart ? 'En cesta · ' : ''}Grupo · {items.length} persianas
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className={`text-sm font-black ${allInCart ? 'text-green-700' : 'text-red-700'}`}>{fmt(total)}</span>
          <span className="text-xs text-gray-400">{fmtDate(items[0].created_at)}</span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Detalle expandido ── */}
      {expanded && (
        <div className={`px-4 pb-4 pt-3 border-t space-y-3 ${allInCart ? 'border-green-100' : 'border-gray-100'}`}>
          {/* Lista */}
          <div className="space-y-2">
            {items.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold flex-shrink-0 text-[10px] ${allInCart ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{blindLabel(c.blind_type)}</p>
                  {c.width && c.height && <p className="text-gray-400">{c.width} × {c.height} mm{c.mechanism ? ` · ${c.mechanism}` : ''}</p>}
                </div>
                <span className="font-bold text-gray-700 flex-shrink-0">{fmt(c.estimated_price)}</span>
              </div>
            ))}
          </div>

          {/* Acciones */}
          {allInCart ? (
            <button onClick={() => navigate('/cesta')}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-green-600 text-white hover:bg-green-700 transition-colors">
              Ir a la cesta →
            </button>
          ) : (
            <>
              <button onClick={handleAddAllToCart} disabled={adding}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-60"
              >
                {adding ? <Spinner small /> : (
                  <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>Añadir todo a la cesta</>
                )}
              </button>
              <div className="flex justify-end">
                {confirm ? (
                  <div className="flex gap-1.5">
                    <button onClick={() => setConfirm(false)}
                      className="text-xs font-semibold py-2 px-3 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
                      Cancelar
                    </button>
                    <button onClick={onDeleteGroup} disabled={!!deleting}
                      className="text-xs font-bold py-2 px-3 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center gap-1.5">
                      {deleting ? <Spinner small /> : null}
                      Eliminar grupo
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirm(true)}
                    className="text-xs font-semibold py-2 px-3 rounded-lg border border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Eliminar grupo
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab Configuraciones ───────────────────────────────────────────────────
function ConfiguracionesTab({ configuraciones, setConfiguraciones }) {
  const [search,    setSearch]   = useState('')
  const [deleting,  setDeleting] = useState(null)
  const [sortOrder, setSortOrder] = useState('desc')

  const filtered = configuraciones.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      blindLabel(c.blind_type).toLowerCase().includes(q) ||
      (c.configuration_number ?? '').toLowerCase().includes(q) ||
      (c.mechanism ?? '').toLowerCase().includes(q) ||
      (c.slat_color_name ?? '').toLowerCase().includes(q)
    )
  })

  const displayEntries = (() => {
    const entries = processConfigurations(filtered)
    return sortOrder === 'asc' ? [...entries].reverse() : entries
  })()

  async function handleDelete(id) {
    setDeleting(id)
    const { error } = await supabase.from('blind_configurations').delete().eq('id', id)
    if (!error) setConfiguraciones(prev => prev.filter(c => c.id !== id))
    setDeleting(null)
  }

  async function handleDeleteGroup(entryId, ids) {
    setDeleting(entryId)
    const { error } = await supabase.from('blind_configurations').delete().in('id', ids)
    if (!error) setConfiguraciones(prev => prev.filter(c => !ids.includes(c.id)))
    setDeleting(null)
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Configuraciones guardadas" action={
        <Link to="/configurador"
          className="flex items-center gap-2 text-sm font-bold bg-red-700 text-white px-4 py-2 rounded-xl hover:bg-red-800 transition-colors">
          + Nueva configuración
        </Link>
      } />

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {displayEntries.map(entry =>
            entry.type === 'group' ? (
              <ProGroupCard
                key={entry.id}
                items={entry.items}
                onDeleteGroup={() => handleDeleteGroup(entry.id, entry.items.map(c => c.id))}
                deleting={deleting === entry.id ? entry.id : null}
              />
            ) : (
              <ProConfigCard
                key={entry.item.id}
                c={entry.item}
                onDelete={handleDelete}
                deleting={deleting}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab Pedidos (unifica pedidos + facturas) ──────────────────────────────
function PedidosTab({ pedidos, facturas, newOrderId }) {
  const navigate = useNavigate()
  const [downloadingId, setDownloadingId] = useState(null)
  const [expandedId,    setExpandedId]    = useState(null)
  const [autoDownloaded,setAutoDownloaded]= useState(false)
  const [newBanner,     setNewBanner]     = useState(!!newOrderId)

  // Auto-descarga factura del pedido recién confirmado
  useEffect(() => {
    if (!newOrderId || autoDownloaded || pedidos.length === 0) return
    const order   = pedidos.find(p => p.id === newOrderId)
    const invoice = facturas.find(f => f.order_id === newOrderId)
    if (!order) return
    setAutoDownloaded(true)
    setExpandedId(newOrderId)
    if (invoice) handleDownload(order, invoice)
    navigate(window.location.pathname + '?tab=pedidos', { replace: true })
  }, [newOrderId, pedidos, facturas, autoDownloaded])

  async function handleDownload(order, invoice) {
    setDownloadingId(order.id)
    await generateOrderInvoicePDF({ order, invoice })
    setDownloadingId(null)
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Pedidos" action={
        <Link to="/cesta" className="flex items-center gap-2 text-sm font-bold bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Ver cesta
        </Link>
      } />

      {newBanner && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-green-700 font-medium">Pedido confirmado. La factura se está descargando…</p>
          </div>
          <button onClick={() => setNewBanner(false)} className="text-green-500 hover:text-green-700 text-lg leading-none">×</button>
        </div>
      )}

      {pedidos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <p className="font-semibold text-gray-700 mb-4">No hay pedidos todavía</p>
          <Link to="/configurador" className="inline-block px-5 py-2.5 bg-red-700 text-white text-sm font-bold rounded-xl hover:bg-red-800 transition-colors">
            Ir al configurador
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map(p => {
            const invoice    = facturas.find(f => f.order_id === p.id)
            const isExpanded = expandedId === p.id
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Cabecera colapsable */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-gray-500 flex-shrink-0">#{p.id.slice(0,8).toUpperCase()}</span>
                    <Badge status={p.status} map={ORDER_STATUS} />
                    {invoice && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${invoice.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {invoice.payment_status === 'paid' ? 'Pagada' : 'Pago pendiente'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-xs text-gray-400">{fmtDate(p.created_at)}</span>
                    <span className="text-sm font-bold text-gray-900">{fmt(p.total_with_iva)}</span>
                    {invoice && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDownload(p, invoice) }}
                        disabled={downloadingId === p.id}
                        title="Descargar factura"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-60"
                      >
                        {downloadingId === p.id ? <Spinner small /> : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        )}
                      </button>
                    )}
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Detalle expandido */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
                    <div className="space-y-1.5">
                      {(p.items ?? []).map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-gray-700 font-medium">{BLIND_LABELS[item.blind_type] ?? item.blind_type ?? '—'}</span>
                          {item.width && item.height && <span className="text-gray-400">{item.width}×{item.height} mm</span>}
                          <span className="font-bold text-gray-900">{fmt(item.estimated_price ?? 0)}</span>
                        </div>
                      ))}
                    </div>
                    {invoice && (
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                        <div>
                          <p className="text-xs font-semibold text-gray-700">Factura: {invoice.invoice_number}</p>
                        </div>
                        <button
                          onClick={() => handleDownload(p, invoice)}
                          disabled={downloadingId === p.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 text-white text-xs font-bold rounded-lg hover:bg-red-800 disabled:opacity-60 transition-colors"
                        >
                          {downloadingId === p.id ? <Spinner small /> : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Descargar factura
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tab Facturas ──────────────────────────────────────────────────────────
function FacturasTab({ facturas }) {
  return (
    <div className="space-y-4">
      <SectionHeader title="Facturas" />
      {facturas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <p className="font-semibold text-gray-700">No hay facturas todavía</p>
          <p className="text-sm text-gray-400 mt-1">Las facturas aparecen cuando completas un pedido.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Nº Factura', 'Fecha', 'Estado pago', 'Total'].map((h, i) => (
                    <th key={h} className={`px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i === 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {facturas.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-gray-600">{f.invoice_number}</td>
                    <td className="px-5 py-3 text-gray-400">{fmtDate(f.created_at)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${f.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {f.payment_status === 'paid' ? 'Pagada' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-gray-900">{fmt(f.total_with_iva)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab Mi empresa ────────────────────────────────────────────────────────
const REQUIRED_EMPRESA = ['razon_social', 'cif_nif', 'telefono', 'direccion_fiscal', 'codigo_postal', 'ciudad', 'provincia', 'email_facturacion']

function EmpresaTab({ empresa, setEmpresa, user, logoUrl, setLogoUrl }) {
  const [edit,    setEdit]    = useState(empresa ?? {})
  const [errors,  setErrors]  = useState({})
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [uploading, setUploading] = useState(false)

  const FIELDS = [
    { key: 'razon_social',       label: 'Razón social *' },
    { key: 'cif_nif',            label: 'CIF / NIF *' },
    { key: 'telefono',           label: 'Teléfono *' },
    { key: 'email_facturacion',  label: 'Email de facturación *' },
    { key: 'direccion_fiscal',   label: 'Dirección fiscal *' },
    { key: 'codigo_postal',      label: 'Código postal *' },
    { key: 'ciudad',             label: 'Ciudad *' },
    { key: 'provincia',          label: 'Provincia *' },
    { key: 'web',                label: 'Página web' },
  ]

  async function handleSave() {
    const errs = {}
    REQUIRED_EMPRESA.forEach(f => { if (!edit[f]?.toString().trim()) errs[f] = 'Obligatorio' })
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setSaving(true)
    const { error } = await supabase.from('professional_data').upsert({ ...edit, user_id: user.id })
    setSaving(false)
    if (!error) { setEmpresa(edit); setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  async function handleLogo(file) {
    if (!file) return
    setUploading(true)
    const { error } = await supabase.storage.from('professional-logos').upload(`${user.id}/logo`, file, { upsert: true, contentType: file.type })
    if (!error) {
      const { data } = supabase.storage.from('professional-logos').getPublicUrl(`${user.id}/logo`)
      setLogoUrl(data.publicUrl + `?t=${Date.now()}`)
    }
    setUploading(false)
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Mi empresa" />

      {/* Logo */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-sm font-bold text-gray-900 mb-4">Logo de empresa</p>
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 overflow-hidden flex items-center justify-center bg-gray-50">
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" onError={e => e.target.style.display = 'none'} />
              : <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            }
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">PNG o JPG recomendado. Aparecerá en presupuestos y facturas.</p>
            <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors ${uploading ? 'opacity-60' : ''}`}>
              {uploading ? <><Spinner small /> Subiendo…</> : 'Cambiar logo'}
              <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => handleLogo(e.target.files[0])} />
            </label>
          </div>
        </div>
      </div>

      {/* Campos */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-sm font-bold text-gray-900 mb-4">Datos fiscales</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
              <input type="text" value={edit[key] ?? ''} onChange={e => { setEdit(p => ({ ...p, [key]: e.target.value })); setErrors(p => ({ ...p, [key]: '' })) }}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 transition-colors ${errors[key] ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
              {errors[key] && <p className="text-xs text-red-600 mt-1">{errors[key]}</p>}
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-red-700 hover:bg-red-800 text-white disabled:opacity-60'}`}>
            {saving ? <Spinner small /> : saved ? '✓ Guardado' : 'Guardar datos'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────
export default function ProfessionalDashboard() {
  const navigate        = useNavigate()
  const [searchParams]  = useSearchParams()
  const { itemCount }   = useCart()
  const tabParam    = searchParams.get('tab')
  const newOrderId  = searchParams.get('new')
  const [activeTab,      setActiveTab]      = useState(tabParam === 'facturas' ? 'pedidos' : (tabParam ?? 'overview'))
  const [menuOpen,       setMenuOpen]       = useState(false)
  const [user,           setUser]           = useState(null)
  const [empresa,        setEmpresa]        = useState(null)
  const [configuraciones,setConfiguraciones]= useState([])
  const [proyectos,      setProyectos]      = useState([])
  const [pedidos,        setPedidos]        = useState([])
  const [facturas,       setFacturas]       = useState([])
  const [logoUrl,        setLogoUrl]        = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [globalDiscount, setGlobalDiscount] = useState(20)
  const [showEmpresaModal, setShowEmpresaModal] = useState(false)

  const empresaCompleta = useCallback((e) => e && REQUIRED_EMPRESA.every(f => e[f]?.toString().trim()), [])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }
      setUser(user)

      const [empR, configR, proyR, pedR, facR, disc] = await Promise.all([
        supabase.from('professional_data').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('blind_configurations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('pro_projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        getProfessionalDiscountForUser(user.id),
      ])

      setGlobalDiscount(disc)
      const emp = empR.data ?? null
      setEmpresa(emp)
      setConfiguraciones(configR.data ?? [])
      setProyectos(proyR.data ?? [])
      setPedidos(pedR.data ?? [])
      setFacturas(facR.data ?? [])

      if (user.id) {
        const { data: logoData } = supabase.storage.from('professional-logos').getPublicUrl(`${user.id}/logo`)
        if (logoData?.publicUrl) setLogoUrl(logoData.publicUrl + `?t=${Date.now()}`)
      }
      if (!empresaCompleta(emp)) setShowEmpresaModal(true)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() { await supabase.auth.signOut(); navigate('/') }

  const totalFacturado = pedidos.filter(p => p.status === 'completed').reduce((a, p) => a + (p.total_with_iva ?? 0), 0)

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src="/persianassantanderlogo.png" alt="Persianas Santander" className="h-9 w-auto" onError={e => { e.target.src = '/persianassantanderlogo.svg' }} />
              <div className="hidden sm:block h-6 w-px bg-gray-200" />
              <span className="hidden sm:block text-sm font-semibold text-gray-700">Panel profesional</span>
              <span className="hidden sm:inline-flex bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                −{empresa?.discount_percent ?? globalDiscount}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/cesta" className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-700 text-white text-xs font-bold rounded-full flex items-center justify-center">{itemCount}</span>
                )}
              </Link>
              <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <div className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">
                  {empresa?.razon_social?.[0] ?? user?.email?.[0]?.toUpperCase() ?? 'P'}
                </div>
                <span className="text-sm text-gray-600 max-w-[160px] truncate">{empresa?.razon_social ?? user?.email}</span>
              </div>
              <Link to="/configurador" className="text-sm font-bold bg-red-700 text-white px-4 py-2 rounded-xl hover:bg-red-800 transition-colors">
                <span className="hidden sm:inline">+ Nueva</span>
                <span className="sm:hidden">+</span>
              </Link>
              <button onClick={handleLogout} className="hidden sm:block p-2 text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors text-sm font-medium px-3">
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={TABS.find(t => t.id === activeTab)?.icon} />
                  </svg>
                  {TABS.find(t => t.id === activeTab)?.label}
                </span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuOpen && (
                <nav className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden">
                  {TABS.map(({ id, label, icon }) => (
                    <button key={id} onClick={() => { setActiveTab(id); setMenuOpen(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-left border-b border-gray-100 last:border-0 transition-colors ${activeTab === id ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
                      </svg>
                      {label}
                    </button>
                  ))}
                </nav>
              )}
            </div>

            {/* Desktop sidebar */}
            <nav className="hidden lg:flex lg:flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {TABS.map(({ id, label, icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-left border-b border-gray-100 last:border-0 transition-colors ${
                    activeTab === id
                      ? 'bg-red-50 text-red-700 border-l-2 border-l-red-700 pl-3.5'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
                  </svg>
                  {label}
                  {id === 'proyectos' && proyectos.length > 0 && (
                    <span className="ml-auto text-xs font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{proyectos.length}</span>
                  )}
                  {id === 'configuraciones' && configuraciones.length > 0 && (
                    <span className="ml-auto text-xs font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{configuraciones.length}</span>
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {/* Contenido */}
          <main className="flex-1 min-w-0">
            {/* ── RESUMEN ── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {empresa?.razon_social ? `Hola, ${empresa.razon_social}` : 'Panel profesional'}
                  </h1>
                  <p className="text-gray-500 text-sm mt-1">Resumen de tu actividad.</p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Descuento activo', value: `−${empresa?.discount_percent ?? globalDiscount}%`, sub: 'Tarifa profesional', accent: true },
                    { label: 'Proyectos', value: proyectos.length, sub: `${proyectos.filter(p => p.status === 'accepted').length} aceptados` },
                    { label: 'Pedidos', value: pedidos.length, sub: `${pedidos.filter(p => p.status === 'completed').length} completados` },
                    { label: 'Total facturado', value: fmt(totalFacturado), sub: 'pedidos completados' },
                  ].map(({ label, value, sub, accent }) => (
                    <div key={label} className={`rounded-2xl p-5 border ${accent ? 'bg-red-700 border-red-600' : 'bg-white border-gray-200'}`}>
                      <p className={`text-2xl font-black mb-0.5 ${accent ? 'text-white' : 'text-gray-900'}`}>{value}</p>
                      <p className={`text-sm font-medium ${accent ? 'text-red-200' : 'text-gray-700'}`}>{label}</p>
                      {sub && <p className={`text-xs mt-0.5 ${accent ? 'text-red-300' : 'text-gray-400'}`}>{sub}</p>}
                    </div>
                  ))}
                </div>

                {!empresaCompleta(empresa) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-amber-800">Completa los datos de tu empresa</p>
                      <p className="text-sm text-amber-600 mt-0.5">Necesarios para que aparezcan en facturas y presupuestos.</p>
                    </div>
                    <button onClick={() => setActiveTab('empresa')}
                      className="flex-shrink-0 px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 transition-colors">
                      Completar →
                    </button>
                  </div>
                )}

                {itemCount > 0 && (
                  <Link to="/cesta" className="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl px-5 py-4 hover:bg-red-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-700 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-bold text-red-900 text-sm">{itemCount} producto{itemCount > 1 ? 's' : ''} en la cesta</p>
                        <p className="text-xs text-red-600">Finaliza tu pedido</p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}

                {/* Últimos proyectos */}
                {proyectos.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900 text-sm">Últimos proyectos</h3>
                      <button onClick={() => setActiveTab('proyectos')} className="text-xs font-semibold text-red-700 hover:underline">Ver todos</button>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {proyectos.slice(0, 4).map(p => {
                        const total = (p.items ?? []).reduce((s, it) => s + (Number(it.client_price) || 0), 0)
                        return (
                          <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{p.name || p.client_name || 'Sin nombre'}</p>
                              <p className="text-xs text-gray-400">{(p.items ?? []).length} persianas · {fmtDate(p.created_at)}</p>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <Badge status={p.status} />
                              <span className="font-bold text-red-700 text-sm">{fmt(total)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PROYECTOS ── */}
            {activeTab === 'proyectos' && (
              <ProyectosTab
                proyectos={proyectos}
                setProyectos={setProyectos}
                configuraciones={configuraciones}
                empresa={empresa ?? {}}
                logoUrl={logoUrl}
                user={user}
              />
            )}

            {/* ── CONFIGURACIONES ── */}
            {activeTab === 'configuraciones' && (
              <ConfiguracionesTab configuraciones={configuraciones} setConfiguraciones={setConfiguraciones} />
            )}

            {/* ── PEDIDOS ── */}
            {activeTab === 'pedidos' && <PedidosTab pedidos={pedidos} facturas={facturas} newOrderId={newOrderId} />}

            {/* ── EMPRESA ── */}
            {activeTab === 'empresa' && (
              <EmpresaTab empresa={empresa} setEmpresa={setEmpresa} user={user} logoUrl={logoUrl} setLogoUrl={setLogoUrl} />
            )}
          </main>
        </div>
      </div>

      {/* Modal obligatorio datos empresa */}
      {showEmpresaModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Completa tu empresa</h2>
            <p className="text-sm text-gray-500 mb-6">Necesitamos los datos fiscales de tu empresa para generar presupuestos y facturas correctamente.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowEmpresaModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Más tarde
              </button>
              <button onClick={() => { setShowEmpresaModal(false); setActiveTab('empresa') }}
                className="flex-1 py-2.5 rounded-xl bg-red-700 text-white text-sm font-bold hover:bg-red-800 transition-colors">
                Completar ahora
              </button>
            </div>
          </div>
        </div>
      )}

      <WAButton />
    </div>
  )
}
