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
import CustomerForm from './components/CustomerForm'

function Configurator() {
  const [isProfessional, setIsProfessional] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsProfessional(user?.user_metadata?.user_type === 'professional')
    })
  }, [])
  const [boxColor, setBoxColor] = useState('#F5F5F5')
  const [slatColor, setSlatColor] = useState('#C4A77D')
  
  // Medidas
  const [width, setWidth] = useState(1000)
  const [height, setHeight] = useState(1200)
  const [depth, setDepth] = useState(150)

  // Tipo de persiana
  const [blindType, setBlindType] = useState('normal')

  // Mecanismo y orientación
  const [mechanism, setMechanism] = useState('muelle')
  const [orientation, setOrientation] = useState('izquierda')

  // Tipo de motor (solo si mechanism === 'motor')
  const [motorType, setMotorType] = useState('mecanico')

  // Tipo de lamas
  const [slatType, setSlatType] = useState('normal')

  // Tipo de usuario
  const [userType, setUserType] = useState('public')

  // Datos del cliente
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  })

  // Mostrar formulario de cliente
  const [showCustomerForm, setShowCustomerForm] = useState(false)

  // Colores Winchester disponibles (24 colores — misma paleta que el Home)
  const winchesterColors = [
    { name: 'Blanco puro',      hex: '#F5F5F5' },
    { name: 'Marfil',           hex: '#FFFFF0' },
    { name: 'Fresno claro',     hex: '#E8E0D2' },
    { name: 'Arce suave',       hex: '#F3E5DC' },
    { name: 'Aluminio',         hex: '#C0C0C0' },
    { name: 'Gris plata',       hex: '#A2A2A2' },
    { name: 'Roble dorado',     hex: '#C4A77D' },
    { name: 'Pino natural',     hex: '#DBCABB' },
    { name: 'Teak salvaje',     hex: '#B19F83' },
    { name: 'Sapelly',          hex: '#9C7F6B' },
    { name: 'Cerezo clásico',   hex: '#8D6E63' },
    { name: 'Gris cuarzo',      hex: '#6F7A85' },
    { name: 'Gris tráfico',     hex: '#707476' },
    { name: 'Gris carbono',     hex: '#3D3D3D' },
    { name: 'Gris basalto',     hex: '#4D5C63' },
    { name: 'Nogal oscuro',     hex: '#5D4037' },
    { name: 'Caoba premium',    hex: '#4E342E' },
    { name: 'Bronce metal',     hex: '#6F4E37' },
    { name: 'Rojo vino',        hex: '#7C2D3A' },
    { name: 'Verde musgo',      hex: '#4B5320' },
    { name: 'Azul báltico',     hex: '#00416A' },
    { name: 'Antracita',        hex: '#373F41' },
    { name: 'Wengué',           hex: '#2B2B2B' },
    { name: 'Negro satinado',   hex: '#1A1A1A' },
  ]

  // Calcular precio
  const calculatePrice = () => {
    const getBasePricePerSqm = () => {
      if (blindType === 'blocking') return 180
      return 120
    }

    const getMechanismMultiplier = () => {
      switch (mechanism) {
        case 'muelle': return 1.0
        case 'cinta': return 1.1
        case 'motor': return 1.5
        default: return 1.0
      }
    }

    const getSlatTypeMultiplier = () => {
      return slatType === 'seguridad' ? 1.3 : 1.0
    }

    const areaSqm = (width / 1000) * (height / 1000)
    const basePrice = areaSqm * getBasePricePerSqm()
    const priceWithMechanism = basePrice * getMechanismMultiplier()
    const priceWithSlatType = priceWithMechanism * getSlatTypeMultiplier()
    const depthCost = depth > 200 ? (depth - 200) * 0.5 : 0
    const totalPrice = priceWithSlatType + depthCost
    const iva = totalPrice * 0.21
    const totalWithIva = totalPrice + iva

    return userType === 'professional' ? totalWithIva * 0.8 : totalWithIva
  }

  // Objeto de configuración completo
  const configuration = {
    blindType,
    mechanism,
    orientation,
    motorType,
    slatType,
    width,
    height,
    depth,
    boxColor,
    slatColor,
    boxColorName: winchesterColors.find(c => c.hex === boxColor)?.name,
    slatColorName: winchesterColors.find(c => c.hex === slatColor)?.name,
    estimatedPrice: calculatePrice(),
    customerData,
  }

  const handleSaveSuccess = (savedConfig) => {
    console.log('Configuración guardada:', savedConfig)
    setShowCustomerForm(false)
  }

  const handleCustomerFormSubmit = () => {
    setShowCustomerForm(false)
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      
      {/* Botón volver al panel — solo para profesionales */}
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

      {/* Header de página */}
      <section className="bg-red-700 text-white py-12">
        <div className="w-full px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Configura tu Persiana</h1>
          <p className="text-red-100 text-sm">Personaliza cada detalle y obtén tu presupuesto al instante</p>
        </div>
      </section>

      {/* Contenido principal - Full width */}
      <section className="py-12 bg-white">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          
          <div className="grid lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
            
            {/* Columna Izquierda - Visual + Precio + Resumen + Acciones */}
            <div className="space-y-6">
              
              {/* Preview de la persiana */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <BlindPreview 
                  boxColor={boxColor} 
                  slatColor={slatColor} 
                  width={width}
                  blindType={blindType}
                />
              </div>

              {/* Precio */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <PriceDisplay 
                  blindType={blindType}
                  mechanism={mechanism}
                  motorType={motorType}
                  slatType={slatType}
                  width={width}
                  height={height}
                  depth={depth}
                  userType={userType}
                />
              </div>

              {/* Resumen de configuración */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <ConfigurationSummary 
                  blindType={blindType}
                  mechanism={mechanism}
                  orientation={orientation}
                  motorType={motorType}
                  slatType={slatType}
                  width={width}
                  height={height}
                  depth={depth}
                  boxColor={boxColor}
                  slatColor={slatColor}
                  winchesterColors={winchesterColors}
                />
              </div>

              {/* Botones de acción */}
              <div className="space-y-3">
                <button
                  onClick={() => setShowCustomerForm(true)}
                  className="w-full py-3 px-6 rounded font-semibold bg-red-700 hover:bg-red-800 text-white transition-colors"
                >
                  Solicitar Presupuesto por Email
                </button>

                <SaveConfigurationButton 
                  configuration={configuration}
                  onSuccess={handleSaveSuccess}
                />
              </div>
            </div>

            {/* Columna Derecha - Controles */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-6">
              
              <BlindTypeSelector 
                blindType={blindType} 
                onTypeChange={setBlindType} 
              />

              <MechanismSelector 
                blindType={blindType}
                mechanism={mechanism}
                onMechanismChange={setMechanism}
                orientation={orientation}
                onOrientationChange={setOrientation}
              />

              {/* Selector de Tipo de Motor (solo si es Motor) */}
              {mechanism === 'motor' && (
                <MotorTypeSelector 
                  motorType={motorType}
                  onMotorTypeChange={setMotorType}
                />
              )}

              <SlatTypeSelector 
                slatType={slatType}
                onSlatTypeChange={setSlatType}
                blindType={blindType}
              />

              <MeasurementsForm 
                width={width}
                height={height}
                depth={depth}
                onWidthChange={setWidth}
                onHeightChange={setHeight}
                onDepthChange={setDepth}
              />

              <ColorPicker 
                label="Color de la Caja"
                selectedColor={boxColor}
                onColorChange={setBoxColor}
                colors={winchesterColors}
              />

              <ColorPicker 
                label="Color de las Lamas"
                selectedColor={slatColor}
                onColorChange={setSlatColor}
                colors={winchesterColors}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Modal Formulario Cliente */}
      {showCustomerForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative border border-gray-200">
            <button
              onClick={() => setShowCustomerForm(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-lg font-semibold text-gray-900 mb-4">Datos de Contacto</h3>

            <CustomerForm 
              customerData={customerData}
              onCustomerDataChange={setCustomerData}
              configuration={configuration}
              onSubmit={handleCustomerFormSubmit}
              loading={false}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default Configurator