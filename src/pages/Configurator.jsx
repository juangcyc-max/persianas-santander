import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../services/supabase/client'
import BlindPreview from './components/BlindPreview'
import BlindTypeSelector from './components/BlindTypeSelector'
import MeasurementsForm from './components/MeasurementsForm'
import ColorPicker from './components/ColorPicker'
import MechanismSelector from './components/MechanismSelector'
import MotorTypeSelector from './components/MotorTypeSelector'
import SlatTypeSelector from './components/SlatTypeSelector'
import PriceDisplay from './components/PriceDisplay'
import ConfigurationSummary from './components/ConfigurationSummary'
import SaveConfigurationButton from './components/SaveConfigurationButton'
import AddToCartButton from './components/AddToCartButton'
import CustomerForm from './components/CustomerForm'

function Configurator() {
  const [isProfessional, setIsProfessional] = useState(false)
  const [savedConfigId,  setSavedConfigId]  = useState(null) // ID de la config guardada

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsProfessional(user?.user_metadata?.user_type === 'professional')
    })
  }, [])

  const [boxColor,   setBoxColor]   = useState('#F2ECCA')
  const [slatColor,  setSlatColor]  = useState('#C49A6C')
  const [width,      setWidth]      = useState(1000)
  const [height,     setHeight]     = useState(1200)
  const [depth,      setDepth]      = useState(150)
  const [blindType,  setBlindType]  = useState('normal')
  const [mechanism,  setMechanism]  = useState('muelle')
  const [orientation,setOrientation]= useState('izquierda')
  const [motorType,  setMotorType]  = useState('mecanico')
  const [slatType,   setSlatType]   = useState('normal')
  const [userType,   setUserType]   = useState('public')
  const [customerData, setCustomerData] = useState({ name: '', phone: '', email: '', address: '' })
  const [showCustomerForm, setShowCustomerForm] = useState(false)

  const winchesterColors = [
    { name: '3005',          hex: '#5E2028' }, // Rojo vino
    { name: 'Bronce',        hex: '#828559' }, // Bronce oliva
    { name: '8017',          hex: '#44221A' }, // Marrón chocolate
    { name: '6009',          hex: '#27352A' }, // Verde abeto
    { name: 'Negro',         hex: '#1A1A1A' }, // Negro
    { name: 'Winchester',    hex: '#C49A6C' }, // Madera roble claro
    { name: 'Madera Oscuro', hex: '#5D3A1A' }, // Madera oscura
    { name: 'Madera 176',    hex: '#A0724A' }, // Madera media
    { name: '7011',          hex: '#52595D' }, // Gris hierro
    { name: 'Natural',       hex: '#E0E0DC' }, // Natural / aluminio
    { name: '6005',          hex: '#0F4336' }, // Verde musgo
    { name: '7016',          hex: '#293133' }, // Gris antracita
    { name: 'Marfil',        hex: '#F2ECCA' }, // Marfil
    { name: 'Gris Sable',    hex: '#7E8B6E' }, // Gris sable
    { name: '8014',          hex: '#4E3829' }, // Marrón sepia
    { name: 'Madera 120',    hex: '#C4A06A' }, // Madera clara
    { name: 'Inox',          hex: '#C8C8C8' }, // Acero inoxidable
    { name: 'Gris Moteado',  hex: '#7A7A7A' }, // Gris moteado
  ]

  const calculatePrice = () => {
    const w = parseFloat(width)  || 0
    const h = parseFloat(height) || 0
    const d = parseFloat(depth)  || 0
    const basePerSqm = blindType === 'blocking' ? 180 : 120
    const mechMult   = mechanism === 'motor' ? 1.5 : mechanism === 'cinta' ? 1.1 : 1.0
    const slatMult   = slatType === 'seguridad' ? 1.3 : 1.0
    const areaSqm    = (w / 1000) * (h / 1000)
    const base       = areaSqm * basePerSqm * mechMult * slatMult
    const depthCost  = d > 200 ? (d - 200) * 0.5 : 0
    const total      = (base + depthCost) * 1.21
    return userType === 'professional' ? total * 0.8 : total
  }

  const configuration = {
    blindType, mechanism, orientation, motorType, slatType,
    width, height, depth, boxColor, slatColor,
    boxColorName:  winchesterColors.find(c => c.hex === boxColor)?.name,
    slatColorName: winchesterColors.find(c => c.hex === slatColor)?.name,
    estimatedPrice: calculatePrice(),
    customerData,
  }

  // Cuando se guarda la configuración, guardamos el ID para poder añadirla a la cesta
  const handleSaveSuccess = (savedConfig) => {
    if (savedConfig?.id) setSavedConfigId(savedConfig.id)
    setShowCustomerForm(false)
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* Volver al panel — solo profesionales */}
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

      {/* Header */}
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
                <BlindPreview boxColor={boxColor} slatColor={slatColor} width={width} blindType={blindType} />
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <PriceDisplay
                  estimatedPrice={calculatePrice()}
                  blindType={blindType}
                  mechanism={mechanism}
                  userType={userType}
                />
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <ConfigurationSummary blindType={blindType} mechanism={mechanism} orientation={orientation}
                  motorType={motorType} slatType={slatType} width={width} height={height} depth={depth}
                  boxColor={boxColor} slatColor={slatColor} winchesterColors={winchesterColors} />
              </div>

              {/* Botones de acción */}
              <div className="space-y-3">
                {/* 1. Guardar configuración — SIEMPRE primero */}
                <SaveConfigurationButton
                  configuration={configuration}
                  onSuccess={handleSaveSuccess}
                />

                {/* 2. Añadir a la cesta — aparece solo cuando hay una config guardada */}
                {savedConfigId && (
                  <AddToCartButton configurationId={savedConfigId} />
                )}

                {/* 3. Si aún no hay config guardada, mensaje informativo */}
                {!savedConfigId && (
                  <p className="text-xs text-center text-gray-400">
                    Guarda la configuración primero para poder añadirla a la cesta
                  </p>
                )}

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
              <BlindTypeSelector blindType={blindType} onTypeChange={setBlindType} />
              <MechanismSelector blindType={blindType} mechanism={mechanism} onMechanismChange={setMechanism}
                orientation={orientation} onOrientationChange={setOrientation} />
              {mechanism === 'motor' && (
                <MotorTypeSelector motorType={motorType} onMotorTypeChange={setMotorType} />
              )}
              <SlatTypeSelector slatType={slatType} onSlatTypeChange={setSlatType} blindType={blindType} />
              <MeasurementsForm width={width} height={height} depth={depth}
                onWidthChange={v  => setWidth(parseFloat(v)  || 0)}
                onHeightChange={v => setHeight(parseFloat(v) || 0)}
                onDepthChange={v  => setDepth(parseFloat(v)  || 0)} />
              <ColorPicker label="Color de la Caja" selectedColor={boxColor}
                onColorChange={setBoxColor} colors={winchesterColors} />
              <ColorPicker label="Color de las Lamas" selectedColor={slatColor}
                onColorChange={setSlatColor} colors={winchesterColors} />
            </div>
          </div>
        </div>
      </section>

      {/* Modal formulario cliente */}
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