import { useState, useEffect } from 'react'
import { getProfessionalDiscount, setProfessionalDiscount } from '../../../services/settings'
import { getProductPrices, setProductPrices } from '../../../services/prices'
import { PRODUCT_LABELS, ALL_GROUPS } from '../constants'

export default function AdminConfigSection() {
  const [discount,     setDiscount]     = useState('')
  const [savingDisc,   setSavingDisc]   = useState(false)
  const [savedDisc,    setSavedDisc]    = useState(false)
  const [discError,    setDiscError]    = useState('')

  const [prices,       setPrices]       = useState(null)
  const [motorPrices,  setMotorPrices]  = useState({ mecanico: '', mando_distancia: '' })
  const [guidePrices,  setGuidePrices]  = useState({ v25: '', h25: '' })
  const [instPrice,    setInstPrice]    = useState('')
  const [instFija,     setInstFija]     = useState('')
  const [savingPrices, setSavingPrices] = useState(false)
  const [savedPrices,  setSavedPrices]  = useState(false)
  const [priceError,   setPriceError]   = useState('')

  useEffect(() => {
    getProfessionalDiscount().then(v => setDiscount(String(v)))
    getProductPrices().then(cfg => {
      setPrices(cfg.prices)
      setMotorPrices(cfg.motorPrices)
      setGuidePrices(cfg.guidePricePerMl)
      setInstPrice(cfg.instalacionPrice)
      setInstFija(cfg.instalacionFija)
    })
  }, [])

  async function handleSaveDiscount() {
    const n = parseFloat(discount)
    if (isNaN(n) || n < 0 || n > 100) { setDiscError('Introduce un valor entre 0 y 100'); return }
    setDiscError('')
    setSavingDisc(true)
    const ok = await setProfessionalDiscount(n)
    setSavingDisc(false)
    if (ok) { setSavedDisc(true); setTimeout(() => setSavedDisc(false), 2500) }
    else setDiscError('Error al guardar.')
  }

  function updatePrice(type, group, val) {
    setPrices(prev => ({ ...prev, [type]: { ...prev[type], [group]: val } }))
    setSavedPrices(false)
  }

  async function handleSavePrices() {
    setPriceError('')
    setSavingPrices(true)
    const parsedPrices = {}
    for (const [type, groups] of Object.entries(prices)) {
      parsedPrices[type] = {}
      for (const [g, v] of Object.entries(groups)) {
        const n = parseFloat(v)
        if (isNaN(n) || n < 0) { setPriceError('Hay valores no válidos en la tabla'); setSavingPrices(false); return }
        parsedPrices[type][g] = n
      }
    }
    const ok = await setProductPrices({
      prices:           parsedPrices,
      motorPrices:      { mecanico: parseFloat(motorPrices.mecanico), mando_distancia: parseFloat(motorPrices.mando_distancia) },
      guidePricePerMl:  { v25: parseFloat(guidePrices.v25), h25: parseFloat(guidePrices.h25) },
      instalacionPrice: parseFloat(instPrice),
      instalacionFija:  parseFloat(instFija),
    })
    setSavingPrices(false)
    if (ok) { setSavedPrices(true); setTimeout(() => setSavedPrices(false), 2500) }
    else setPriceError('Error al guardar.')
  }

  const inputCls = 'w-24 px-2 py-1.5 rounded-lg border border-gray-300 text-sm text-right focus:outline-none focus:ring-1 focus:ring-red-200 focus:border-red-400'

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-lg font-bold text-gray-900">Configuración</h2>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Descuento para profesionales</h3>
          <p className="text-xs text-gray-400">Se aplica a todos los profesionales. Se puede sobrescribir por factura.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input type="number" min="0" max="100" step="1" value={discount}
              onChange={e => { setDiscount(e.target.value); setSavedDisc(false); setDiscError('') }}
              className="w-24 px-3 py-2 pr-7 rounded-xl border border-gray-300 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
          </div>
          <button onClick={handleSaveDiscount} disabled={savingDisc}
            className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors disabled:opacity-50 ${savedDisc ? 'bg-green-600 text-white' : 'bg-red-700 hover:bg-red-800 text-white'}`}>
            {savingDisc ? 'Guardando…' : savedDisc ? '✓ Guardado' : 'Guardar'}
          </button>
        </div>
        {discError && <p className="text-xs text-red-600">{discError}</p>}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Precios por m² (sin IVA)</h3>
          <p className="text-xs text-gray-400">Precio base por m² según tipo de persiana y grupo de color.</p>
        </div>

        {prices === null ? (
          <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
            <div className="w-4 h-4 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
            Cargando precios…
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(prices).map(([type, groups]) => {
              const availableGroups = ALL_GROUPS.filter(g => g in groups)
              return (
                <div key={type}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{PRODUCT_LABELS[type] ?? type}</p>
                  <div className="flex flex-wrap gap-3">
                    {availableGroups.map(g => (
                      <div key={g} className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400">{g}</label>
                        <div className="relative">
                          <input type="number" min="0" step="0.01" value={groups[g]}
                            onChange={e => updatePrice(type, g, e.target.value)}
                            className={inputCls}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            <div className="border-t border-gray-100 pt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Motor</p>
                <div className="space-y-2">
                  {[['mecanico', 'Mecánico'], ['mando_distancia', 'Mando a distancia']].map(([k, label]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <label className="text-xs text-gray-400">{label}</label>
                      <div className="relative">
                        <input type="number" min="0" step="1" value={motorPrices[k]}
                          onChange={e => { setMotorPrices(p => ({ ...p, [k]: e.target.value })); setSavedPrices(false) }}
                          className={inputCls}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Guías (€/ml)</p>
                <div className="space-y-2">
                  {[['v25', 'V25'], ['h25', 'H25']].map(([k, label]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <label className="text-xs text-gray-400">{label}</label>
                      <div className="relative">
                        <input type="number" min="0" step="0.5" value={guidePrices[k]}
                          onChange={e => { setGuidePrices(p => ({ ...p, [k]: e.target.value })); setSavedPrices(false) }}
                          className={inputCls}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Instalación</p>
                <div className="space-y-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400">€/m² (paños y sistemas)</label>
                    <div className="relative">
                      <input type="number" min="0" step="1" value={instPrice}
                        onChange={e => { setInstPrice(e.target.value); setSavedPrices(false) }}
                        className={inputCls}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400">Precio fijo (motor/guías)</label>
                    <div className="relative">
                      <input type="number" min="0" step="1" value={instFija}
                        onChange={e => { setInstFija(e.target.value); setSavedPrices(false) }}
                        className={inputCls}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSavePrices} disabled={savingPrices || prices === null}
            className={`px-5 py-2 text-sm font-bold rounded-xl transition-colors disabled:opacity-50 ${savedPrices ? 'bg-green-600 text-white' : 'bg-red-700 hover:bg-red-800 text-white'}`}>
            {savingPrices ? 'Guardando…' : savedPrices ? '✓ Guardado' : 'Guardar precios'}
          </button>
          {priceError && <p className="text-xs text-red-600">{priceError}</p>}
        </div>
      </div>
    </div>
  )
}
