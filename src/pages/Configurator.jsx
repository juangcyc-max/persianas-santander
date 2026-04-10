import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../services/supabase/client'
import { getProfessionalDiscount, getProfessionalDiscountForUser } from '../services/settings'
import BlindPreview from './components/BlindPreview'
import BlindTypeSelector from './components/BlindTypeSelector'
import BoxTypeSelector from './components/BoxTypeSelector'
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
    'Grupo Base': 134,
    'Grupo 1':    166.6,
    'Grupo 2':    176.4,
    'Grupo 3':    238,
  },
  sistema_mini: {
    'Grupo Base': 197.8,
    'Grupo 1':    234.18,
    'Grupo 2':    244.58,
    'Grupo 3':    323.80,
  },
  cajon_aluminio: {
    'Grupo Base': 105,
    'Grupo 1':    110,
    'Grupo 2':    114,
    'Grupo 3':    133,
  },
  cajon_pvc: {
    'Grupo Base': 100,
    'Grupo 1':    102,
    'Grupo 2':    106,
    'Grupo 3':    124.6,
  },
}

const MOTOR_PRICES = { mecanico: 120, mando_distancia: 260 }
const GUIDE_PRICE_PER_ML = { v25: 5, h25: 7 }
const INSTALACION_PRICE = 100
const MIN_SQM = 1.5

function getGamaFromColor(colors, hex) {
  return colors.find(c => c.hex === hex)?.gama ?? 'Grupo Base'
}

function getPricePerSqm(table, gama) {
  return table[gama] ?? table['Grupo Base']
}

function Configurator() {
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

  // Estado de configuración
  const [productType,  setProductType]  = useState('laminada')   // laminada | autoblocante | sistema_mini
  const [boxType,      setBoxType]      = useState('aluminio')    // aluminio | pvc | sin_cajon
  const [mechanism,    setMechanism]    = useState('muelle')
  const [orientation,  setOrientation]  = useState('izquierda')
  const [motorType,    setMotorType]    = useState('mecanico')
  const [guideType,    setGuideType]    = useState('v25')         // v25 | h25
  const [installacion, setInstallacion] = useState(true)
  const [width,        setWidth]        = useState(1000)
  const [height,       setHeight]       = useState(1200)
  const [boxColor,     setBoxColor]     = useState('#F2ECCA')
  const [slatColor,    setSlatColor]    = useState('#C49A6C')
  const [customerData, setCustomerData] = useState({ name: '', phone: '', email: '', address: '' })
  const [showCustomerForm, setShowCustomerForm] = useState(false)

  // Forzar motor si el tipo lo requiere
  useEffect(() => {
    if (productType === 'autoblocante' || productType === 'sistema_mini') {
      setMechanism('motor')
    }
  }, [productType])

  // Colores disponibles
  const winchesterColors = [
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

  // ─── Cálculo de precios ──────────────────────────────────────────────────
  const calculatePriceBreakdown = () => {
    const areaSqm = (width / 1000) * (height / 1000)
    const billableSqm = Math.max(areaSqm, MIN_SQM)

    const slatGama = getGamaFromColor(winchesterColors, slatColor)
    const boxGama  = getGamaFromColor(winchesterColors, boxColor)

    // Precio del paño según tipo y color de lama
    const productTable = PRICES[productType]
    const productPricePerSqm = getPricePerSqm(productTable, slatGama)

    // Precio cajón (solo para laminada, y solo si tiene cajón)
    let boxPricePerSqm = 0
    let boxLabel = ''
    if (productType === 'laminada' && boxType !== 'sin_cajon') {
      const cajonTable = boxType === 'aluminio' ? PRICES.cajon_aluminio : PRICES.cajon_pvc
      boxPricePerSqm = getPricePerSqm(cajonTable, boxGama)
      boxLabel = boxType === 'aluminio' ? 'Cajón mini aluminio' : 'Cajón mini PVC'
    }

    // Guías: precio por metro lineal × 2 guías × altura (metros)
    let guidesCost = 0
    if (guideType !== 'none') {
      const pricePerMl = GUIDE_PRICE_PER_ML[guideType]
      guidesCost = 2 * (height / 1000) * pricePerMl
    }

    // Motor
    const motorCost = mechanism === 'motor' ? (MOTOR_PRICES[motorType] ?? 0) : 0

    // Instalación
    const installacionCost = installacion ? INSTALACION_PRICE : 0

    // Totales sin IVA
    const subtotalSinIva =
      productPricePerSqm * billableSqm +
      boxPricePerSqm * billableSqm +
      guidesCost +
      motorCost +
      installacionCost

    const iva = subtotalSinIva * 0.21
    const totalConIva = subtotalSinIva * 1.21
    const discount = userType === 'professional' ? totalConIva * (proDiscount / 100) : 0
    const finalPrice = totalConIva - discount

    const productLabelMap = {
      laminada: 'Paño laminada',
      autoblocante: 'Paño autoblocante',
      sistema_mini: 'Sistema mini autoblocante',
    }

    return {
      productLabel: productLabelMap[productType] ?? productType,
      productPricePerSqm,
      boxLabel,
      boxPricePerSqm,
      guidesCost,
      motorCost,
      installacionCost,
      billableSqm,
      subtotalSinIva,
      iva,
      totalConIva,
      discount,
      finalPrice,
    }
  }

  const priceBreakdown = calculatePriceBreakdown()

  const configuration = {
    productType,
    blindType: productType, // alias para compatibilidad con BD y PDF
    boxType, mechanism, orientation, motorType, guideType, installacion,
    width, height,
    boxColor, slatColor,
    boxColorName:  winchesterColors.find(c => c.hex === boxColor)?.name,
    boxColorGama:  winchesterColors.find(c => c.hex === boxColor)?.gama,
    slatColorName: winchesterColors.find(c => c.hex === slatColor)?.name,
    slatColorGama: winchesterColors.find(c => c.hex === slatColor)?.gama,
    estimatedPrice: priceBreakdown.finalPrice,
    proDiscount,
    customerData,
  }

  const handleSaveSuccess = () => {
    setShowCustomerForm(false)
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

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

      <section className="bg-red-700 text-white py-8 md:py-12">
        <div className="w-full px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-xl md:text-3xl font-bold mb-2">Configura tu Persiana</h1>
          <p className="text-red-100 text-sm">Personaliza cada detalle y obtén tu presupuesto al instante</p>
        </div>
      </section>

      <section className="py-6 md:py-12 bg-white">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">

            {/* Columna izquierda */}
            <div className="space-y-6">
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <BlindPreview boxColor={boxColor} slatColor={slatColor} width={width} blindType={productType} />
              </div>

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
                  boxType={boxType}
                  guideType={guideType}
                  installacion={installacion}
                  mechanism={mechanism}
                  orientation={orientation}
                  motorType={motorType}
                  width={width}
                  height={height}
                  boxColor={boxColor}
                  slatColor={slatColor}
                  winchesterColors={winchesterColors}
                />
              </div>

              <div className="space-y-3">
                <SaveConfigurationButton
                  configuration={configuration}
                  onSuccess={handleSaveSuccess}
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

            {/* Columna derecha — controles */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-6">
              <BlindTypeSelector blindType={productType} onTypeChange={setProductType} />

              {/* Selector de cajón solo para laminada */}
              {productType === 'laminada' && (
                <BoxTypeSelector boxType={boxType} onBoxTypeChange={setBoxType} />
              )}

              <MechanismSelector
                productType={productType}
                mechanism={mechanism}
                onMechanismChange={setMechanism}
                orientation={orientation}
                onOrientationChange={setOrientation}
              />

              {mechanism === 'motor' && (
                <MotorTypeSelector motorType={motorType} onMotorTypeChange={setMotorType} />
              )}

              <MeasurementsForm
                productType={productType}
                width={width}
                height={height}
                onWidthChange={v  => setWidth(parseFloat(v)  || 0)}
                onHeightChange={v => setHeight(parseFloat(v) || 0)}
              />

              <GuideSelector
                guideType={guideType}
                onGuideTypeChange={setGuideType}
                installacion={installacion}
                onInstallacionChange={setInstallacion}
                height={height}
              />

              <ColorPicker label="Color de la Caja" selectedColor={boxColor}
                onColorChange={setBoxColor} colors={winchesterColors} />
              <ColorPicker label="Color de las Lamas" selectedColor={slatColor}
                onColorChange={setSlatColor} colors={winchesterColors} />
            </div>
          </div>
        </div>
      </section>

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
