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

  const [boxColor,   setBoxColor]   = useState('#F5F5F5')
  const [slatColor,  setSlatColor]  = useState('#C4A77D')
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
    { name: 'Blanco puro',    hex: '#F5F5F5' },
    { name: 'Marfil',         hex: '#FFFFF0' },
    { name: 'Fresno claro',   hex: '#E8E0D2' },
    { name: 'Arce suave',     hex: '#F3E5DC' },
    { name: 'Aluminio',       hex: '#C0C0C0' },
    { name: 'Gris plata',     hex: '#A2A2A2' },
    { name: 'Roble dorado',   hex: '#C4A77D' },
    { name: 'Pino natural',   hex: '#DBCABB' },
    { name: 'Teak salvaje',   hex: '#B19F83' },
    { name: 'Sapelly',        hex: '#9C7F6B' },
    { name: 'Cerezo clásico', hex: '#8D6E63' },
    { name: 'Gris cuarzo',    hex: '#6F7A85' },
    { name: 'Gris tráfico',   hex: '#707476' },
    { name: 'Gris carbono',   hex: '#3D3D3D' },
    { name: 'Gris basalto',   hex: '#4D5C63' },
    { name: 'Nogal oscuro',   hex: '#5D4037' },
    { name: 'Caoba premium',  hex: '#4E342E' },
    { name: 'Bronce metal',   hex: '#6F4E37' },
    { name: 'Rojo vino',      hex: '#7C2D3A' },
    { name: 'Verde musgo',    hex: '#4B5320' },
    { name: 'Azul báltico',   hex: '#00416A' },
    { name: 'Antracita',      hex: '#373F41' },
    { name: 'Wengué',         hex: '#2B2B2B' },
    { name: 'Negro satinado', hex: '#1A1A1A' },
  ]

  const calculatePrice = () => {
    const basePerSqm    = blindType === 'blocking' ? 180 : 120
    const mechMult      = mechanism === 'motor' ? 1.5 : mechanism === 'cinta' ? 1.1 : 1.0
    const slatMult      = slatType === 'seguridad' ? 1.3 : 1.0
    const areaSqm       = (width / 1000) * (height / 1000)
    const base          = areaSqm * basePerSqm * mechMult * slatMult
    const depthCost     = depth > 200 ? (depth - 200) * 0.5 : 0
    const total         = (base + depthCost) * 1.21
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
                <PriceDisplay blindType={blindType} mechanism={mechanism} motorType={motorType}
                  slatType={slatType} width={width} height={height} depth={depth} userType={userType} />
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
                onWidthChange={setWidth} onHeightChange={setHeight} onDepthChange={setDepth} />
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