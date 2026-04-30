import { useState, useEffect } from 'react'
import { supabase } from '../../../services/supabase/client'
import { generateGroupBudgetPDF, generateGroupInvoicePDF } from '../../../services/pdf'
import { getProductPrices } from '../../../services/prices'
import {
  fmt, uid, blindLabel,
  PRO_BLIND_TYPES, PRO_MOTOR_ONLY, PRO_NO_MOTOR,
  PROJECT_STATUS, calcProItemPrice,
} from '../constants'
import Badge from './Badge'
import Field from './Field'
import Spinner from './Spinner'

// ── Modal: Configurar y añadir persiana directamente ─────────────────────
function AddItemModal({ userId, onAdd, onClose, onConfigSaved }) {
  const [blindType,    setBlindType]    = useState('laminada')
  const [width,        setWidth]        = useState('')
  const [height,       setHeight]       = useState('')
  const [mechanism,    setMechanism]    = useState('muelle')
  const [motorType,    setMotorType]    = useState('mecanico')
  const [orientation,  setOrientation]  = useState('derecha')
  const [guideType,    setGuideType]    = useState('none')
  const [colorGroup,   setColorGroup]   = useState('Grupo Base')
  const [installacion, setInstallacion] = useState(false)
  const [desc,         setDesc]         = useState('')
  const [price,        setPrice]        = useState('')
  const [pricesData,   setPricesData]   = useState(null)
  const [priceEdited,  setPriceEdited]  = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [err,          setErr]          = useState('')

  useEffect(() => { getProductPrices().then(setPricesData) }, [])

  const requiresMotor = PRO_MOTOR_ONLY.includes(blindType)
  const noMotor       = PRO_NO_MOTOR.includes(blindType)
  const isSoloMot     = blindType === 'solo_motor'
  const isSoloGuia    = blindType === 'solo_guias'

  useEffect(() => {
    if (requiresMotor) setMechanism('motor')
    else if (noMotor && mechanism === 'motor') setMechanism('muelle')
  }, [blindType])

  useEffect(() => {
    if (priceEdited || !pricesData) return
    const w = parseFloat(width)
    const h = parseFloat(height)
    if (!isSoloMot && !isSoloGuia && (!w || !h || isNaN(w) || isNaN(h))) return
    if (isSoloGuia && (!h || isNaN(h))) return
    const calc = calcProItemPrice({ ...pricesData, blindType, width: w || 0, height: h || 0, mechanism, motorType, guideType, colorGroup, installacion })
    if (!isNaN(calc) && calc > 0) setPrice(calc.toFixed(2))
  }, [pricesData, blindType, width, height, mechanism, motorType, guideType, colorGroup, installacion, priceEdited])

  async function handleConfirm() {
    if (!isSoloMot && (!height || isNaN(parseFloat(height)))) { setErr('Introduce la altura'); return }
    if (!isSoloMot && !isSoloGuia && (!width || isNaN(parseFloat(width)))) { setErr('Introduce el ancho'); return }
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) { setErr('Precio inválido'); return }
    setSaving(true)
    const w = parseFloat(width) || null
    const h = parseFloat(height) || null
    const mechFinal        = isSoloMot ? 'motor' : mechanism
    const motorFinal       = (mechanism === 'motor' || requiresMotor || isSoloMot) ? motorType : null
    const orientationFinal = mechFinal === 'cinta' ? orientation : null
    const guideFinal       = guideType !== 'none' ? guideType : null
    const colorFinal     = (!isSoloMot && !isSoloGuia) ? colorGroup : null
    const costPrice      = parseFloat(price) / 1.21

    const { data: savedConfig } = await supabase.from('blind_configurations').insert({
      user_id:         userId,
      blind_type:      blindType,
      mechanism:       mechFinal,
      motor_type:      motorFinal,
      orientation:     orientationFinal,
      guide_type:      guideFinal,
      width:           isSoloMot ? null : w,
      height:          h,
      slat_color_name: colorFinal,
      estimated_price: costPrice,
    }).select().single()

    if (savedConfig) onConfigSaved?.(savedConfig)

    onAdd({
      item_id:         uid(),
      config_id:       savedConfig?.id ?? null,
      description:     desc.trim() || blindLabel(blindType),
      blind_type:      blindType,
      mechanism:       mechFinal,
      motor_type:      motorFinal,
      orientation:     orientationFinal,
      guide_type:      guideFinal,
      width:           isSoloMot ? null : w,
      height:          h,
      box_color_name:  null,
      slat_color_name: colorFinal,
      cost_price:      costPrice,
      client_price:    parseFloat(price),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Añadir persiana al presupuesto</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">

          {/* Tipo */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tipo de persiana</label>
            <select value={blindType} onChange={e => { setBlindType(e.target.value); setPriceEdited(false); setErr('') }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400">
              {PRO_BLIND_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          {/* Medidas */}
          {!isSoloMot && (
            <div className={`grid gap-3 ${isSoloGuia ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {!isSoloGuia && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Ancho (mm)</label>
                  <input type="number" min="1" value={width} onChange={e => { setWidth(e.target.value); setPriceEdited(false); setErr('') }} placeholder="1200"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Alto (mm)</label>
                <input type="number" min="1" value={height} onChange={e => { setHeight(e.target.value); setPriceEdited(false); setErr('') }} placeholder="1500"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400" />
              </div>
            </div>
          )}

          {/* Mecanismo */}
          {!isSoloMot && !isSoloGuia && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Mecanismo</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'muelle', label: 'Muelle', disabled: requiresMotor },
                  { id: 'cinta',  label: 'Cinta',  disabled: requiresMotor || noMotor },
                  { id: 'motor',  label: 'Motor',  disabled: noMotor },
                ].map(({ id, label, disabled }) => (
                  <button key={id} type="button" disabled={disabled}
                    onClick={() => { if (!disabled) { setMechanism(id); setPriceEdited(false) } }}
                    className={`py-2 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      mechanism === id ? 'border-red-600 bg-red-50 text-red-700'
                      : disabled ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Orientación cinta */}
          {mechanism === 'cinta' && !isSoloMot && !isSoloGuia && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Orientación de cinta</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'derecha',   label: 'Derecha' },
                  { id: 'izquierda', label: 'Izquierda' },
                ].map(({ id, label }) => (
                  <button key={id} type="button" onClick={() => setOrientation(id)}
                    className={`py-2 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      orientation === id ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Motor type */}
          {(mechanism === 'motor' || requiresMotor || isSoloMot) && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tipo de motor</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'mecanico',        label: 'Mecánico' },
                  { id: 'mando_distancia', label: 'Mando distancia' },
                ].map(({ id, label }) => (
                  <button key={id} type="button" onClick={() => { setMotorType(id); setPriceEdited(false) }}
                    className={`py-2 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      motorType === id ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Guías */}
          {!isSoloMot && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Guías</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'none', label: 'Sin guías' },
                  { id: 'v25',  label: 'Guía V25'  },
                  { id: 'h25',  label: 'Guía H25'  },
                ].map(({ id, label }) => (
                  <button key={id} type="button" onClick={() => { setGuideType(id); setPriceEdited(false) }}
                    className={`py-2 px-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                      guideType === id ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color group */}
          {!isSoloMot && !isSoloGuia && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Grupo de color</label>
              <select value={colorGroup} onChange={e => { setColorGroup(e.target.value); setPriceEdited(false) }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400">
                {['Grupo Base', 'Grupo 1', 'Grupo 2', 'Grupo 3'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}

          {/* Instalación */}
          <button type="button" onClick={() => { setInstallacion(v => !v); setPriceEdited(false) }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${installacion ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${installacion ? 'border-red-600 bg-red-600' : 'border-gray-300'}`}>
                {installacion && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className="text-sm font-medium text-gray-700">Con instalación</span>
            </div>
            <span className="text-xs text-gray-400">{isSoloMot ? '+150 €' : '+100 €/m²'}</span>
          </button>

          {/* Precio */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Precio para el cliente (€ con IVA)</label>
            <div className="relative">
              <input type="number" min="0" step="0.01" value={price}
                onChange={e => { setPrice(e.target.value); setPriceEdited(true); setErr('') }}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 pr-8 rounded-xl border border-gray-300 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
            </div>
            {price && !isNaN(parseFloat(price)) && parseFloat(price) > 0 && (
              <p className="text-xs text-gray-400 mt-1">Sin IVA: {fmt(parseFloat(price) / 1.21)}</p>
            )}
            {priceEdited && (
              <button type="button" onClick={() => setPriceEdited(false)} className="text-xs text-red-600 hover:underline mt-1 block">
                Recalcular automáticamente
              </button>
            )}
          </div>

          {/* Descripción */}
          <Field label="Descripción (opcional)" value={desc} onChange={setDesc} placeholder="Ej: Ventana salón, Puerta garaje…" />

          {err && <p className="text-xs text-red-600 font-medium">{err}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="button" onClick={handleConfirm} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-sm font-bold disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {saving ? <Spinner small /> : 'Añadir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal: Editar / ver proyecto ──────────────────────────────────────────
export default function ProjectModal({ project: initial, userId, empresa, logoUrl, onSave, onDelete, onClose, onConfigSaved }) {
  const [project,      setProject]      = useState({ ...initial })
  const [saving,       setSaving]       = useState(false)
  const [generating,   setGenerating]   = useState(null) // 'budget' | 'invoice'
  const [showAddItem,  setShowAddItem]  = useState(false)
  const [invoiceNumber,setInvoiceNumber]= useState(`F-${Date.now().toString().slice(-6)}`)
  const [showInvNum,   setShowInvNum]   = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [ivaPct,       setIvaPct]       = useState(initial.iva_pct ?? 21)

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
    const saved = await onSave(updated)
    // Si era nuevo, actualizar el id local para que handleBudget no inserte un duplicado
    if (saved?.id && !project.id) setProject(p => ({ ...p, id: saved.id }))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleBudget() {
    setGenerating('budget')
    const bNum = `PRO-${Date.now().toString().slice(-6)}`
    const updated = { ...project, budget_number: bNum, iva_pct: ivaPct }
    await generateGroupBudgetPDF({ project: updated, empresa, logoUrl, ivaPct })
    await onSave({ ...updated, status: project.status === 'draft' ? 'sent' : project.status })
    setProject(updated)
    setGenerating(null)
  }

  async function handleInvoice() {
    setGenerating('invoice')
    await generateGroupInvoicePDF({ project: { ...project, iva_pct: ivaPct }, empresa, logoUrl, invoiceNumber, ivaPct })
    await onSave({ ...project, iva_pct: ivaPct })
    setGenerating(null)
    setShowInvNum(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-mono">{project.budget_number ?? (isNew ? 'Nuevo presupuesto' : `#${project.id?.slice(0,8).toUpperCase()}`)}</p>
            <h2 className="text-lg font-bold text-gray-900 mt-0.5">{isNew ? 'Crear presupuesto' : (project.name || 'Presupuesto sin nombre')}</h2>
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

          {/* Tipo IVA */}
          {items.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-gray-500">Tipo IVA para PDF:</span>
              {[21, 10, 4, 0].map(pct => (
                <button key={pct} onClick={() => setIvaPct(pct)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${ivaPct === pct ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                  {pct}%
                </button>
              ))}
            </div>
          )}

          {/* Acciones */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100">
            {/* Eliminar */}
            {!isNew && (
              <button onClick={() => { if (window.confirm('¿Eliminar este presupuesto?')) { onDelete(project.id); onClose() } }}
                className="sm:mr-auto px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">
                Eliminar
              </button>
            )}

            {/* Guardar */}
            <button onClick={handleSave} disabled={saving || !project.client_name?.trim()}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-40'}`}>
              {saving ? <Spinner small /> : saved ? '✓ Guardado' : 'Guardar presupuesto'}
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
        <AddItemModal userId={userId} onAdd={addItem} onClose={() => setShowAddItem(false)} onConfigSaved={onConfigSaved} />
      )}
    </div>
  )
}
