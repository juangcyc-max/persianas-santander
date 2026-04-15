import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase/client'
import { getProfessionalDiscount, getProfessionalDiscountForUser } from '../services/settings'
import BlindPreview from './components/BlindPreview'
import BlindTypeSelector from './components/BlindTypeSelector'
import MeasurementsForm from './components/MeasurementsForm'
import ColorPicker from './components/ColorPicker'
import MechanismSelector from './components/MechanismSelector'
import MotorTypeSelector from './components/MotorTypeSelector'
import GuideSelector from './components/GuideSelector'
import PriceDisplay from './components/PriceDisplay'
import ConfigurationSummary from './components/ConfigurationSummary'
import SaveConfigurationButton from './components/SaveConfigurationButton'
import CustomerForm from './components/CustomerForm'

// ─── Tablas de precios por m² ──────────────────────────────────────────────
const PRICES = {
  laminada: {
    'Grupo Base': 43,
    'Grupo 1':    44.24,
    'Grupo 2':    46.02,
    'Grupo 3':    47.61,
  },
  autoblocante: {
    'Grupo Base': 134.4,
    'Grupo 1':    166.6,
    'Grupo 2':    176.4,
    'Grupo 3':    238,
  },
  blocking: {
    'Grupo Base': 134.4,
    'Grupo 1':    166.6,
    'Grupo 2':    176.4,
    'Grupo 3':    238,
  },
  sistema_mini_cajon_pvc: {
    'Grupo Base': 100,
    'Grupo 1':    102,
    'Grupo 2':    106,
    'Grupo 3':    124.6,
  },
  sistema_mini_cajon_aluminio: {
    'Grupo Base': 105,
    'Grupo 1':    110,
    'Grupo 2':    114,
    'Grupo 3':    133,
  },
  sistema_mini_autoblocante: {
    'Grupo Base': 197.8,
    'Grupo 1':    234.18,
    'Grupo 2':    244.58,
    'Grupo 3':    323.80,
  },
  mosquitera_enrollable: {
    'Grupo Base': 80,
  },
}

const MOTOR_PRICES = { mecanico: 120, mando_distancia: 260 }
const GUIDE_PRICE_PER_ML = { v25: 5, h25: 7 }
const INSTALACION_PRICE = 100   // €/m² para paños y sistemas
const INSTALACION_FIJA  = 150   // precio fijo para solo_motor, solo_guias
const MIN_SQM = 1.5
const CART_KEY = 'ps_cart'

const SISTEMAS = ['sistema_mini_cajon_pvc', 'sistema_mini_cajon_aluminio', 'sistema_mini_autoblocante']
const isSistema = (type) => SISTEMAS.includes(type)

// Tipos que requieren motor (no muelle/cinta)
const MOTOR_ONLY = ['autoblocante', 'blocking', 'sistema_mini_autoblocante']
const isMotorOnly = (type) => MOTOR_ONLY.includes(type)

// Tipos que NO admiten motor
const NO_MOTOR = ['mosquitera_enrollable']

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function getGamaFromColor(colors, hex) {
  return colors.find(c => c.hex === hex)?.gama ?? 'Grupo Base'
}

const VALID_TYPES = [
  'laminada', 'autoblocante', 'blocking',
  'sistema_mini_cajon_pvc', 'sistema_mini_cajon_aluminio', 'sistema_mini_autoblocante',
  'solo_guias', 'solo_motor',
  'mosquitera_enrollable',
]

function getPricePerSqm(table, gama) {
  if (!table) return 0
  return table[gama] ?? table['Grupo Base']
}

function Configurator() {
  const navigate = useNavigate()
  const [isProfessional, setIsProfessional] = useState(false)
  const [proDiscount, setProDiscount] = useState(20)
  const [userType, setUserType] = useState('public')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const isPro = user?.user_metadata?.user_type === 'professional'
      setIsProfessional(isPro)
      if (isPro) {
        setUserType('professional')
        if (user?.id) getProfessionalDiscountForUser(user.id).then(setProDiscount)
        else getProfessionalDiscount().then(setProDiscount)
      }
    })
  }, [])

  const [productType,  setProductType]  = useState(() => { const t = loadCart().productType; return VALID_TYPES.includes(t) ? t : 'laminada' })
  const [mechanism,    setMechanism]    = useState(() => loadCart().mechanism    ?? 'muelle')
  const [orientation,  setOrientation]  = useState(() => loadCart().orientation  ?? 'izquierda')
  const [motorType,    setMotorType]    = useState(() => loadCart().motorType    ?? 'mecanico')
  const [guideType,    setGuideType]    = useState(() => loadCart().guideType    ?? 'none')
  const [installacion, setInstallacion] = useState(() => loadCart().installacion ?? true)
  const [width,        setWidth]        = useState(() => loadCart().width        ?? 1000)
  const [height,       setHeight]       = useState(() => loadCart().height       ?? 1200)
  const [boxColor,     setBoxColor]     = useState(() => loadCart().boxColor     ?? '#F2ECCA')
  const [slatColor,    setSlatColor]    = useState(() => loadCart().slatColor    ?? '#F2ECCA')
  const [customerData, setCustomerData] = useState({ name: '', phone: '', email: '', address: '' })

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify({
      productType, mechanism, orientation, motorType,
      guideType, installacion, width, height, boxColor, slatColor,
    }))
  }, [productType, mechanism, orientation, motorType, guideType, installacion, width, height, boxColor, slatColor])

  const [showCustomerForm, setShowCustomerForm] = useState(false)

  // En desktop, el configurador ocupa toda la pantalla — bloquear scroll del body
  useEffect(() => {
    const apply = () => {
      if (window.innerWidth >= 1024) {
        document.body.style.overflow = 'hidden'
      } else {
        document.body.style.overflow = ''
      }
    }
    apply()
    window.addEventListener('resize', apply)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('resize', apply)
    }
  }, [])

  // Al cambiar tipo: ajustar motor, guías y mecanismo por defecto
  useEffect(() => {
    // Motor obligatorio para bloqueantes y sistemas autoblocantes
    if (isMotorOnly(productType)) {
      setMechanism('motor')
    }
    // Mosquitera: sin motor → forzar muelle si venían de motor
    if (NO_MOTOR.includes(productType) && mechanism === 'motor') {
      setMechanism('muelle')
    }
    // Sistemas: por defecto guía H25
    if (isSistema(productType)) {
      if (guideType === 'none') setGuideType('h25')
    }
    // Solo motor: sin guías
    if (productType === 'solo_motor') {
      setMechanism('motor')
    }
    // Solo guías: forzar guía por defecto
    if (productType === 'solo_guias') {
      if (guideType === 'none') setGuideType('v25')
    }
    // Mosquitera: sin guías
    if (productType === 'mosquitera_enrollable') {
      setGuideType('none')
    }
  }, [productType]) // eslint-disable-line react-hooks/exhaustive-deps

  // Colores disponibles
  const winchesterColors = [
    { name: 'Blanco',        hex: '#FFFFFF', gama: 'Grupo Base' },
    { name: 'Marfil',        hex: '#F2ECCA', gama: 'Grupo Base' },
    { name: '3005',          hex: '#5E2028', gama: 'Grupo 1' },
    { name: '6005',          hex: '#0F4336', gama: 'Grupo 1' },
    { name: '6009',          hex: '#27352A', gama: 'Grupo 1' },
    { name: '7011',          hex: '#52595D', gama: 'Grupo 1' },
    { name: '8014',          hex: '#4E3829', gama: 'Grupo 1' },
    { name: 'Natural',       hex: '#E8E8E4', gama: 'Grupo 1' },
    { name: 'Negro',         hex: '#1A1A1A', gama: 'Grupo 1' },
    { name: 'Bronce',        hex: '#828559', gama: 'Grupo 2' },
    { name: '7016',          hex: '#2F3538', gama: 'Grupo 2' },
    { name: '8017',          hex: '#44221A', gama: 'Grupo 2' },
    { name: 'Gris Sable',    hex: '#8A8C7E', gama: 'Grupo 2' },
    { name: 'Winchester',    hex: '#C49A6C', gama: 'Grupo 3', wood: true },
    { name: 'Madera 120',    hex: '#C4A06A', gama: 'Grupo 3', wood: true },
    { name: 'Madera 176',    hex: '#A0724A', gama: 'Grupo 3', wood: true },
    { name: 'Madera Oscuro', hex: '#5D3A1A', gama: 'Grupo 3', wood: true },
    { name: 'Inox',          hex: '#C8C8C8', gama: 'Grupo 3' },
    { name: 'Gris Moteado',  hex: '#7A7A7A', gama: 'Grupo 3' },
  ]

  // Mosquitera solo admite Grupo Base
  const availableColors = productType === 'mosquitera_enrollable'
    ? winchesterColors.filter(c => c.gama === 'Grupo Base')
    : winchesterColors

  // Para paños y solo_guias: el color de caja sigue al color de lamas
  useEffect(() => {
    if (!isSistema(productType) && productType !== 'solo_motor') {
      setBoxColor(slatColor)
    }
  }, [slatColor, productType])

  // ─── Cálculo de precios ──────────────────────────────────────────────────
  const calculatePriceBreakdown = () => {
    const productLabelMap = {
      laminada:                    'Paño laminado',
      autoblocante:                'Paño autoblocante',
      blocking:                    'Bloqueante',
      sistema_mini_cajon_pvc:      'Sistema Mini Cajón PVC',
      sistema_mini_cajon_aluminio: 'Sistema Mini Cajón Aluminio',
      sistema_mini_autoblocante:   'Sistema Mini Autoblocante',
      solo_guias:      guideType === 'h25' ? 'Guías H25 (7 €/ml)' : 'Guías V25 (5 €/ml)',
      solo_motor:      motorType === 'mando_distancia' ? 'Motor mando a distancia' : 'Motor mecánico',
      mosquitera_enrollable: 'Mosquitera Enrollable',
    }

    // ── Solo Motor ──────────────────────────────────────────────────────────
    if (productType === 'solo_motor') {
      const motorCost       = MOTOR_PRICES[motorType] ?? 0
      const installacionCost = installacion ? INSTALACION_FIJA : 0
      const subtotalSinIva  = motorCost + installacionCost
      const iva             = subtotalSinIva * 0.21
      const totalConIva     = subtotalSinIva * 1.21
      const discount        = userType === 'professional' ? totalConIva * (proDiscount / 100) : 0
      return {
        productLabel: productLabelMap.solo_motor,
        productPricePerSqm: 0,
        boxLabel: '', boxPricePerSqm: 0,
        guidesCost: 0, motorCost, installacionCost,
        billableSqm: 0,
        subtotalSinIva,
        iva, totalConIva, discount,
        finalPrice: totalConIva - discount,
        isSoloMotor: true,
      }
    }

    // ── Solo Guías ──────────────────────────────────────────────────────────
    if (productType === 'solo_guias') {
      const pricePerMl      = GUIDE_PRICE_PER_ML[guideType] ?? GUIDE_PRICE_PER_ML.v25
      const guidesCost      = 2 * (height / 1000) * pricePerMl
      const installacionCost = installacion ? INSTALACION_FIJA : 0
      const subtotalSinIva  = guidesCost + installacionCost
      const iva             = subtotalSinIva * 0.21
      const totalConIva     = subtotalSinIva * 1.21
      const discount        = userType === 'professional' ? totalConIva * (proDiscount / 100) : 0
      return {
        productLabel: productLabelMap.solo_guias,
        productPricePerSqm: 0,
        boxLabel: '', boxPricePerSqm: 0,
        guidesCost, motorCost: 0, installacionCost,
        billableSqm: 0,
        subtotalSinIva,
        iva, totalConIva, discount,
        finalPrice: totalConIva - discount,
        isSoloGuias: true,
      }
    }

    // ── Paños, Sistemas y Mosquitera ────────────────────────────────────────
    const areaSqm = (width / 1000) * (height / 1000)
    const billableSqm = Math.max(areaSqm, MIN_SQM)
    const slatGama = getGamaFromColor(availableColors, slatColor)

    const productTable = PRICES[productType]
    const productPricePerSqm = getPricePerSqm(productTable, slatGama)

    // Guías: todos los tipos pagan por ml (incluyendo sistemas)
    let guidesCost = 0
    if (guideType !== 'none' && productType !== 'mosquitera_enrollable') {
      guidesCost = 2 * (height / 1000) * (GUIDE_PRICE_PER_ML[guideType] ?? 0)
    }

    const motorCost = mechanism === 'motor' ? (MOTOR_PRICES[motorType] ?? 0) : 0
    const installacionCost = installacion ? INSTALACION_PRICE * billableSqm : 0

    const subtotalSinIva = productPricePerSqm * billableSqm + guidesCost + motorCost + installacionCost
    const iva = subtotalSinIva * 0.21
    const totalConIva = subtotalSinIva * 1.21
    const discount = userType === 'professional' ? totalConIva * (proDiscount / 100) : 0

    return {
      productLabel: productLabelMap[productType] ?? productType,
      productPricePerSqm,
      boxLabel: '', boxPricePerSqm: 0,
      guidesCost, motorCost, installacionCost,
      billableSqm,
      subtotalSinIva, iva, totalConIva, discount,
      finalPrice: totalConIva - discount,
    }
  }

  const priceBreakdown = calculatePriceBreakdown()

  // Color de caja efectivo (para sistemas: propio; para el resto: igual que lamas)
  const effectiveBoxColor = isSistema(productType) ? boxColor : slatColor

  const configuration = {
    productType,
    blindType: productType,
    mechanism, orientation, motorType, guideType,
    installacion,
    width, height,
    boxColor:     effectiveBoxColor,
    slatColor,
    boxColorName:  winchesterColors.find(c => c.hex === effectiveBoxColor)?.name,
    boxColorGama:  winchesterColors.find(c => c.hex === effectiveBoxColor)?.gama,
    slatColorName: winchesterColors.find(c => c.hex === slatColor)?.name,
    slatColorGama: winchesterColors.find(c => c.hex === slatColor)?.gama,
    estimatedPrice: priceBreakdown.finalPrice,
    proDiscount,
    customerData,
  }

  // Flags de visibilidad
  const showPreview      = !['solo_motor'].includes(productType)
  const showMechanism    = !isMotorOnly(productType) && !['solo_motor', 'solo_guias', 'mosquitera_enrollable'].includes(productType)
  const showMotorType    = mechanism === 'motor' || isMotorOnly(productType) || productType === 'solo_motor'
  const showMeasurements = productType !== 'solo_motor'
  const showGuides       = productType !== 'mosquitera_enrollable' && productType !== 'solo_motor'
  const showInstallation = true
  const showBoxColor     = isSistema(productType)
  const showSlatColor    = productType !== 'solo_motor'

  // Modo del selector de guías
  const guideMode = productType === 'solo_guias' ? 'product'
    : isSistema(productType) ? 'optional'
    : 'optional'

  return (
    <div className="bg-white text-gray-900 font-sans">

      {/* Banner profesional */}
      {isProfessional && (
        <div className="bg-white border-b border-gray-100 px-4 sm:px-6 lg:px-8 py-2">
          <Link to="/panel-profesional"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a mi panel
          </Link>
        </div>
      )}

      {/* Hero — solo en móvil/tablet */}
      <section className="bg-red-700 text-white py-8 lg:hidden">
        <div className="w-full px-4 sm:px-6 text-center">
          <h1 className="text-xl font-bold mb-2">Configura tu Persiana</h1>
          <p className="text-red-100 text-sm">Personaliza cada detalle y obtén tu presupuesto al instante</p>
        </div>
      </section>

      {/* Dos paneles con scroll independiente en desktop */}
      <div className="flex flex-col lg:flex-row lg:h-[calc(100vh_-_96px)] lg:overflow-hidden">

        {/* Panel izquierdo — resumen (en móvil va abajo) */}
        <div className="order-2 lg:order-1 lg:w-1/2 lg:h-full lg:overflow-y-auto lg:border-r lg:border-gray-100 bg-white">
          <div className="p-6 space-y-6">

            {/* Cabecera roja — solo en desktop */}
            <div className="hidden lg:block bg-red-700 text-white rounded-xl px-6 py-5">
              <h1 className="text-xl font-bold mb-0.5">Configura tu Persiana</h1>
              <p className="text-red-200 text-sm">Personaliza cada detalle y obtén tu presupuesto al instante</p>
            </div>

            {showPreview && (
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <BlindPreview boxColor={effectiveBoxColor} slatColor={slatColor} width={width} blindType={productType} />
              </div>
            )}

            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <PriceDisplay
                priceBreakdown={priceBreakdown}
                userType={userType}
                proDiscount={proDiscount}
              />
            </div>

            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <ConfigurationSummary
                productType={productType}
                guideType={guideType}
                installacion={installacion}
                mechanism={mechanism}
                orientation={orientation}
                motorType={motorType}
                width={width}
                height={height}
                boxColor={effectiveBoxColor}
                slatColor={slatColor}
                winchesterColors={winchesterColors}
              />
            </div>

            <div className="space-y-3">
              <SaveConfigurationButton
                configuration={configuration}
                onSuccess={() => navigate(userType === 'professional' ? '/panel-profesional?tab=configuraciones' : '/mis-configuraciones')}
                proDiscount={proDiscount}
              />
              <button
                onClick={() => setShowCustomerForm(true)}
                className="w-full py-3 px-6 rounded-xl font-semibold bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors text-sm"
              >
                Solicitar presupuesto por email
              </button>
            </div>
          </div>
        </div>

        {/* Panel derecho — controles (en móvil va primero) */}
        <div className="order-1 lg:order-2 lg:w-1/2 lg:h-full lg:overflow-y-auto bg-gray-50">
          <div className="p-6 space-y-6">
            <BlindTypeSelector blindType={productType} onTypeChange={setProductType} />

            {showMechanism && (
              <MechanismSelector
                productType={productType}
                mechanism={mechanism}
                onMechanismChange={setMechanism}
                orientation={orientation}
                onOrientationChange={setOrientation}
              />
            )}

            {showMotorType && (
              <MotorTypeSelector motorType={motorType} onMotorTypeChange={setMotorType} />
            )}

            {showMeasurements && (
              <MeasurementsForm
                productType={productType}
                width={width}
                height={height}
                onWidthChange={v  => setWidth(parseFloat(v)  || 0)}
                onHeightChange={v => setHeight(parseFloat(v) || 0)}
                heightOnly={productType === 'solo_guias'}
              />
            )}

            {showGuides && (
              <GuideSelector
                mode={guideMode}
                guideType={guideType}
                onGuideTypeChange={setGuideType}
                installacion={installacion}
                onInstallacionChange={setInstallacion}
                height={height}
                showInstallation={showInstallation}
              />
            )}

            {/* Instalación para solo_motor y mosquitera (sin selector de guías) */}
            {(productType === 'solo_motor' || productType === 'mosquitera_enrollable') && (
              <div>
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Instalación</h2>
                <button
                  onClick={() => setInstallacion(v => !v)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                    installacion ? 'border-red-600 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${installacion ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className={`text-sm font-semibold ${installacion ? 'text-red-700' : 'text-gray-800'}`}>
                        {installacion ? 'Con instalación' : 'Sin instalación'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {productType === 'mosquitera_enrollable' ? '+100 €/m²' : '+150 € precio fijo'}
                      </p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${installacion ? 'border-red-600 bg-red-600' : 'border-gray-300'}`}>
                    {installacion && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>}
                  </div>
                </button>
              </div>
            )}

            {showBoxColor && (
              <ColorPicker
                label="Color del Cajón"
                selectedColor={boxColor}
                onColorChange={setBoxColor}
                colors={winchesterColors}
              />
            )}

            {showSlatColor && (
              <ColorPicker
                label={
                  isSistema(productType) ? 'Color de las Lamas'
                  : productType === 'solo_guias' ? 'Color de las Guías'
                  : productType === 'mosquitera_enrollable' ? 'Color'
                  : 'Color'
                }
                selectedColor={slatColor}
                onColorChange={setSlatColor}
                colors={availableColors}
              />
            )}
          </div>
        </div>
      </div>

      {showCustomerForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative border border-gray-200">
            <button onClick={() => setShowCustomerForm(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Datos de Contacto</h3>
            <CustomerForm customerData={customerData} onCustomerDataChange={setCustomerData}
              configuration={configuration} onSubmit={() => setShowCustomerForm(false)} loading={false} />
          </div>
        </div>
      )}
    </div>
  )
}

export default Configurator
