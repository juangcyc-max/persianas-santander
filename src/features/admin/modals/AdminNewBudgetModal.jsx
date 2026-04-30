import { useState, useEffect } from 'react'
import { supabase } from '../../../services/supabase/client'
import { generateAdminMultiBudgetPDF } from '../../../services/pdf'
import { sendBudgetResend } from '../../../services/email'
import { getProductPrices, DEFAULT_MOTOR_PRICES, DEFAULT_GUIDE_PRICE_PER_ML, DEFAULT_INSTALACION_PRICE, DEFAULT_INSTALACION_FIJA } from '../../../services/prices'
import { fmt, ADMIN_BUDGET_BLIND_TYPES, ADMIN_BUDGET_COLOR_GROUPS, ADMIN_MOTOR_ONLY, ADMIN_NO_MOTOR, ADMIN_PANO_TYPES, ADMIN_SISTEMAS, calcAdminBudgetPrice } from '../constants'

export default function AdminNewBudgetModal({ onClose, onSaved }) {
  const [cfgPrices,        setCfgPrices]        = useState(null)
  const [motorPrices,      setMotorPrices]      = useState(DEFAULT_MOTOR_PRICES)
  const [guidePricePerMl,  setGuidePricePerMl]  = useState(DEFAULT_GUIDE_PRICE_PER_ML)
  const [instalacionPrice, setInstalacionPrice] = useState(DEFAULT_INSTALACION_PRICE)
  const [instalacionFija,  setInstalacionFija]  = useState(DEFAULT_INSTALACION_FIJA)

  const [customerName,    setCustomerName]    = useState('')
  const [customerPhone,   setCustomerPhone]   = useState('')
  const [customerEmail,   setCustomerEmail]   = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [clientNotes,     setClientNotes]     = useState('')

  const [blindType,    setBlindType]    = useState('laminada')
  const [width,        setWidth]        = useState(1000)
  const [height,       setHeight]       = useState(1200)
  const [mechanism,    setMechanism]    = useState('muelle')
  const [motorType,    setMotorType]    = useState('mecanico')
  const [guideType,    setGuideType]    = useState('none')
  const [colorGroup,   setColorGroup]   = useState('Grupo Base')
  const [installacion, setInstallacion] = useState(false)
  const [items,        setItems]        = useState([])

  const [saving,        setSaving]        = useState(false)
  const [saveFeedback,  setSaveFeedback]  = useState(null)
  const [pdfLoading,    setPdfLoading]    = useState(false)
  const [emailLoading,  setEmailLoading]  = useState(false)
  const [emailFeedback, setEmailFeedback] = useState(null)

  useEffect(() => {
    getProductPrices().then(cfg => {
      setCfgPrices(cfg.prices)
      setMotorPrices(cfg.motorPrices)
      setGuidePricePerMl(cfg.guidePricePerMl)
      setInstalacionPrice(cfg.instalacionPrice)
      setInstalacionFija(cfg.instalacionFija)
    })
  }, [])

  useEffect(() => {
    if (ADMIN_MOTOR_ONLY.includes(blindType)) setMechanism('motor')
    if (ADMIN_NO_MOTOR.includes(blindType) && mechanism === 'motor') setMechanism('muelle')
    if (blindType === 'solo_motor') setMechanism('motor')
    if (ADMIN_SISTEMAS.includes(blindType) && guideType === 'none') setGuideType('h25')
    if (blindType === 'mosquitera_enrollable') { setGuideType('none'); setColorGroup('Grupo Base') }
    if (blindType === 'solo_guias' && guideType === 'none') setGuideType('v25')
  }, [blindType]) // eslint-disable-line react-hooks/exhaustive-deps

  const priceBreakdown = calcAdminBudgetPrice({
    prices: cfgPrices, motorPrices, guidePricePerMl, instalacionPrice, instalacionFija,
    blindType, width: Number(width), height: Number(height), mechanism, motorType, guideType, colorGroup, installacion,
  })

  const grandTotal = items.reduce((sum, i) => sum + (i.priceBreakdown?.totalConIva ?? 0), 0)

  function handleAddItem() {
    if (!priceBreakdown) return
    const label = ADMIN_BUDGET_BLIND_TYPES.find(t => t.value === blindType)?.label ?? blindType
    setItems(prev => [...prev, { id: Date.now(), label, blindType, width: Number(width), height: Number(height), mechanism, motorType, guideType, colorGroup, installacion, priceBreakdown }])
  }

  function buildCustomer() {
    return { name: customerName, phone: customerPhone, email: customerEmail, address: customerAddress }
  }

  async function handleSave() {
    if (items.length === 0) return
    setSaving(true)
    const budgetNumber = `PRE-${Date.now().toString().slice(-8)}`
    const rows = items.map(item => ({
      budget_number:    budgetNumber,
      customer_name:    customerName    || null,
      customer_phone:   customerPhone   || null,
      customer_email:   customerEmail   || null,
      customer_address: customerAddress || null,
      client_notes:     clientNotes     || null,
      blind_type:       item.blindType,
      width:            item.width,
      height:           item.height,
      mechanism:        item.mechanism,
      motor_type:       item.motorType,
      guide_type:       item.guideType,
      installacion:     item.installacion,
      total_with_iva:   item.priceBreakdown?.totalConIva ?? 0,
      budget_status:    'pending',
      user_type:        'public',
      user_id:          null,
    }))
    const { error } = await supabase.from('budgets').insert(rows)
    setSaving(false)
    if (!error) {
      setSaveFeedback('ok')
      setTimeout(() => onSaved(), 1200)
    } else {
      setSaveFeedback('error')
      setTimeout(() => setSaveFeedback(null), 3000)
    }
  }

  async function handleDownloadPDF() {
    if (items.length === 0) return
    setPdfLoading(true)
    try { await generateAdminMultiBudgetPDF(buildCustomer(), items) } catch { }
    setPdfLoading(false)
  }

  async function handleSendEmail() {
    if (items.length === 0 || !customerEmail) return
    setEmailLoading(true); setEmailFeedback(null)
    try {
      const pdfBase64 = await generateAdminMultiBudgetPDF(buildCustomer(), items, { returnBase64: true })
      const syntheticConfig = { estimatedPrice: grandTotal, userType: 'public', proDiscount: 0 }
      await sendBudgetResend(buildCustomer(), syntheticConfig, pdfBase64)
      setEmailFeedback('ok')
      setTimeout(() => setEmailFeedback(null), 3000)
    } catch {
      setEmailFeedback('error')
      setTimeout(() => setEmailFeedback(null), 3000)
    }
    setEmailLoading(false)
  }

  const isSoloMotor    = blindType === 'solo_motor'
  const isSoloGuias    = blindType === 'solo_guias'
  const isSistema      = ADMIN_SISTEMAS.includes(blindType)
  const isPano         = ADMIN_PANO_TYPES.includes(blindType)
  const isMotorOnly    = ADMIN_MOTOR_ONLY.includes(blindType)
  const showMotor      = mechanism === 'motor' && !isPano
  const showGuides     = !isSoloMotor && blindType !== 'mosquitera_enrollable'
  const showColorGroup = !isSoloMotor && !isSoloGuias
  const showDimensions = !isSoloMotor
  const showMechanism  = !isMotorOnly && !isSoloMotor && !isSoloGuias

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Nuevo presupuesto manual</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Datos del cliente */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Datos del cliente</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Nombre</label>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nombre completo" className={inputCls} /></div>
              <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Teléfono</label>
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="600 000 000" className={inputCls} /></div>
              <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Email</label>
                <input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="cliente@email.com" className={inputCls} /></div>
              <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Dirección</label>
                <input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Calle, número, ciudad" className={inputCls} /></div>
              <div className="flex flex-col gap-1 sm:col-span-2"><label className="text-xs text-gray-500">Comentarios</label>
                <textarea value={clientNotes} onChange={e => setClientNotes(e.target.value)} placeholder="Notas adicionales…" rows={2} className={`${inputCls} resize-none`} /></div>
            </div>
          </div>

          {/* Configurador */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Añadir persiana al presupuesto</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs text-gray-500">Tipo de persiana</label>
                <select value={blindType} onChange={e => setBlindType(e.target.value)} className={inputCls}>
                  {ADMIN_BUDGET_BLIND_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {showDimensions && <>
                <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Ancho (mm)</label>
                  <input type="number" min="200" max="6000" step="10" value={width} onChange={e => setWidth(e.target.value)} className={inputCls} /></div>
                <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Alto (mm)</label>
                  <input type="number" min="200" max="6000" step="10" value={height} onChange={e => setHeight(e.target.value)} className={inputCls} /></div>
              </>}
              {showMechanism && (
                <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Mecanismo</label>
                  <select value={mechanism} onChange={e => setMechanism(e.target.value)} className={inputCls}>
                    <option value="muelle">Muelle</option>
                    <option value="cinta">Cinta</option>
                    <option value="motor">Motor</option>
                  </select></div>
              )}
              {(showMotor || isSoloMotor || isMotorOnly) && (
                <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Tipo de motor</label>
                  <select value={motorType} onChange={e => setMotorType(e.target.value)} className={inputCls}>
                    <option value="mecanico">Mecánico</option>
                    <option value="mando_distancia">Mando a distancia</option>
                  </select></div>
              )}
              {showGuides && (
                <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Guías</label>
                  <select value={guideType} onChange={e => setGuideType(e.target.value)} className={inputCls}>
                    {!isSistema && <option value="none">Sin guías</option>}
                    <option value="v25">Guías V25</option>
                    <option value="h25">Guías H25</option>
                  </select></div>
              )}
              {showColorGroup && (
                <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Grupo de color</label>
                  <select value={colorGroup} onChange={e => setColorGroup(e.target.value)} className={inputCls} disabled={blindType === 'mosquitera_enrollable'}>
                    {ADMIN_BUDGET_COLOR_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select></div>
              )}
              <div className="flex items-center gap-3 py-2">
                <input type="checkbox" id="adm_inst" checked={installacion} onChange={e => setInstallacion(e.target.checked)}
                  className="w-4 h-4 text-red-700 rounded border-gray-300 focus:ring-red-500" />
                <label htmlFor="adm_inst" className="text-sm text-gray-700 cursor-pointer">Incluir instalación</label>
              </div>
            </div>

            {cfgPrices && priceBreakdown && (
              <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between">
                <div className="text-xs text-gray-500 space-y-0.5">
                  {priceBreakdown.pricePerSqm !== undefined && (
                    <p>{fmt(priceBreakdown.pricePerSqm)}/m² × {priceBreakdown.billableSqm?.toFixed(2)} m²
                      {priceBreakdown.guidesCost > 0 && ` + guías ${fmt(priceBreakdown.guidesCost)}`}
                      {priceBreakdown.motorCost > 0 && ` + motor ${fmt(priceBreakdown.motorCost)}`}
                      {priceBreakdown.installacionCost > 0 && ` + inst. ${fmt(priceBreakdown.installacionCost)}`}
                    </p>
                  )}
                  <p className="text-gray-400">Subtotal s/IVA {fmt(priceBreakdown.subtotalSinIva)} · IVA {fmt(priceBreakdown.iva)}</p>
                </div>
                <p className="text-base font-bold text-red-700 ml-4 shrink-0">{fmt(priceBreakdown.totalConIva)}</p>
              </div>
            )}
            {!cfgPrices && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                Cargando precios…
              </div>
            )}

            <button onClick={handleAddItem} disabled={!cfgPrices || !priceBreakdown}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Añadir al presupuesto
            </button>
          </div>

          {/* Lista de ítems */}
          {items.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ítems del presupuesto ({items.length})</p>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                    <span className="text-xs font-bold text-gray-400 w-5 shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.label}</p>
                      <p className="text-xs text-gray-400">
                        {item.blindType !== 'solo_motor' && `${item.width} × ${item.height} mm · `}
                        {item.colorGroup}
                        {item.guideType !== 'none' && ` · ${item.guideType.toUpperCase()}`}
                        {item.installacion && ' · con inst.'}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-red-700 shrink-0">{fmt(item.priceBreakdown?.totalConIva ?? 0)}</span>
                    <button onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))} className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                <span className="text-sm font-semibold text-gray-700">Total presupuesto</span>
                <span className="text-lg font-bold text-red-700">{fmt(grandTotal)}</span>
              </div>
            </div>
          )}

          {/* Acciones finales */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            {items.length === 0 && (
              <p className="text-xs text-center text-gray-400">Añade al menos una persiana para poder guardar o descargar el presupuesto.</p>
            )}
            <div className="flex gap-3">
              <button onClick={handleDownloadPDF} disabled={pdfLoading || items.length === 0}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                {pdfLoading ? 'Generando…' : 'Descargar PDF'}
              </button>
              <button onClick={handleSendEmail} disabled={emailLoading || items.length === 0 || !customerEmail}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40
                  ${emailFeedback === 'ok' ? 'bg-green-600 text-white' : emailFeedback === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {emailLoading ? 'Enviando…' : emailFeedback === 'ok' ? '✓ Enviado' : emailFeedback === 'error' ? 'Error' : 'Enviar al cliente'}
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || saveFeedback === 'ok' || items.length === 0}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40
                  ${saveFeedback === 'ok' ? 'bg-green-600 text-white' : saveFeedback === 'error' ? 'bg-red-100 text-red-800' : 'bg-red-700 hover:bg-red-800 text-white'}`}>
                {saving ? 'Guardando…' : saveFeedback === 'ok' ? '✓ Guardado' : saveFeedback === 'error' ? 'Error al guardar' : `Guardar presupuesto${items.length > 1 ? ` (${items.length})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
