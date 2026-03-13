import { useState } from 'react'
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
  const [boxColor, setBoxColor] = useState('#FFFFFF')
  const [slatColor, setSlatColor] = useState('#FFFFFF')
  
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

  // Colores Winchester disponibles
  const winchesterColors = [
    { name: 'Blanco', hex: '#FFFFFF' },
    { name: 'Gris Antracita', hex: '#374151' },
    { name: 'Marrón', hex: '#4A3728' },
    { name: 'Negro', hex: '#000000' },
    { name: 'Rojo Vino', hex: '#7C2D3A' },
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
    // El envío se maneja dentro de CustomerForm ahora
    setShowCustomerForm(false)
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-santander-red mb-8 text-center">
        Configura tu Persiana
      </h1>

      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
        {/* Columna Izquierda - Visual + Precio + Resumen + Acciones */}
        <div className="space-y-6">
          <BlindPreview 
            boxColor={boxColor} 
            slatColor={slatColor} 
            width={width}
            blindType={blindType}
          />

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

          {/* Botones de acción */}
          <div className="space-y-4">
            <button
              onClick={() => setShowCustomerForm(true)}
              className="w-full py-4 px-6 rounded-lg font-semibold text-lg bg-green-600 hover:bg-green-700 text-white transition-all"
            >
              📧 Solicitar Presupuesto por Email
            </button>

            <SaveConfigurationButton 
              configuration={configuration}
              onSuccess={handleSaveSuccess}
            />
          </div>
        </div>

        {/* Columna Derecha - Controles */}
        <div className="bg-white p-8 rounded-xl shadow-lg space-y-6">
          
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

      {/* Modal Formulario Cliente */}
      {showCustomerForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 relative">
            <button
              onClick={() => setShowCustomerForm(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

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