import { useState } from 'react'
import { Link } from 'react-router-dom'

function Home() {
  const [isOpen, setIsOpen] = useState(false)
  const [boxColor, setBoxColor] = useState('#EC1C24')
  const [slatColor, setSlatColor] = useState('#C4A77D')
  const [isMotor, setIsMotor] = useState(true)

  const winchesterPalette = [
    { name: 'Roble Dorado', hex: '#C4A77D' }, { name: 'Nogal Oscuro', hex: '#5D4037' },
    { name: 'Caoba Premium', hex: '#4E342E' }, { name: 'Cerezo Clásico', hex: '#8D6E63' },
    { name: 'Fresno Claro', hex: '#E8E0D2' }, { name: 'Teak Salvaje', hex: '#B19F83' },
    { name: 'Wengué Intenso', hex: '#2B2B2B' }, { name: 'Pino Natural', hex: '#DBCABB' },
    { name: 'Sapelly', hex: '#9C7F6B' }, { name: 'Arce Suave', hex: '#F3E5DC' },
    { name: 'Gris Carbono', hex: '#3D3D3D' }, { name: 'Gris Tráfico', hex: '#707476' },
    { name: 'Gris Plata Pro', hex: '#A2A2A2' }, { name: 'Gris Basalto', hex: '#4D5C63' },
    { name: 'Negro Satinado', hex: '#1A1A1A' }, { name: 'Bronce Metal', hex: '#6F4E37' },
    { name: 'Cobre Puro', hex: '#B87333' }, { name: 'Aluminio Anodizado', hex: '#C0C0C0' },
    { name: 'Gris Cuarzo', hex: '#6F7A85' }, { name: 'Antracita Pro', hex: '#373F41' },
    { name: 'Blanco Puro', hex: '#FFFFFF' }, { name: 'Marfil', hex: '#FFFFF0' },
    { name: 'Verde Musgo', hex: '#4B5320' }, { name: 'Azul Báltico', hex: '#00416A' },
  ]

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      
      {/* HERO - Rojo sólido, sin sombras */}
      <section className="bg-red-700 text-white py-24">
        <div className="w-full px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-red-200 font-bold tracking-widest uppercase text-xs mb-3 block">Fabricación Propia | Desde Santander</span>
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight tracking-tight">Persianas Santander</h1>
          <p className="text-xl md:text-2xl text-white mb-12 font-medium max-w-2xl mx-auto leading-relaxed">Tecnología de extrusión y acabados de alta precisión para arquitecturas exigentes.</p>
          <Link to="/configurador" className="inline-flex items-center gap-3 bg-white text-red-700 px-10 py-4 rounded-full font-bold text-lg hover:bg-red-50 transition-colors">
            Configurar Proyecto a Medida
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
          </Link>
        </div>
      </section>

      {/* SHOWROOM MEJORADO */}
      <section className="py-16 bg-white">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Visualizador Interactivo</h2>
            <p className="text-gray-600">Personaliza caja y lamas de forma independiente</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start max-w-7xl mx-auto">
            
            {/* VENTANA 3D */}
            <div className="relative">
              <div className="relative bg-gray-100 rounded-lg p-8 shadow-lg">
                <div className="absolute inset-0 bg-black/10 rounded-lg blur-lg translate-y-3"></div>
                
                {/* Window container - SIN overflow-hidden para que se vea la cinta */}
                <div className="relative bg-white rounded shadow" style={{ height: '500px' }}>
                  {/* Fondo paisaje */}
                  <div className="absolute inset-0 bg-gradient-to-b from-blue-100 to-blue-50">
                    <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center"></div>
                  </div>
                  
                  {/* Reflejo cristal */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/10 pointer-events-none"></div>
                  
                  {/* CAJA SUPERIOR - Color independiente */}
                  <div 
                    className="absolute top-0 left-0 right-0 h-14 z-20 shadow"
                    style={{ 
                      backgroundColor: boxColor,
                      boxShadow: 'inset 0 2px 8px rgba(255,255,255,0.25), 0 3px 6px rgba(0,0,0,0.25)',
                      backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, transparent 60%, rgba(0,0,0,0.08) 100%)`
                    }}
                  ></div>

                  {/* LAMAS - Color independiente */}
                  <div 
                    className="absolute top-14 left-0 right-0 z-10"
                    style={{ 
                      height: isOpen ? '18px' : 'calc(100% - 56px)',
                      transition: 'height 1s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    <div 
                      className="w-full h-full relative"
                      style={{ 
                        backgroundColor: slatColor,
                        backgroundImage: `repeating-linear-gradient(to bottom, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.03) 2px, transparent 3px, transparent 21px, rgba(0,0,0,0.08) 21px, rgba(0,0,0,0.15) 23px)`,
                        boxShadow: 'inset 0 -4px 12px rgba(0,0,0,0.25)'
                      }}
                    >
                      <div className="absolute bottom-0 left-0 right-0 h-5 bg-black/15 border-t border-black/08"></div>
                    </div>
                  </div>

                  {/* CINTA MANUAL - En el borde derecho, DENTRO del área visible */}
                  {!isMotor && (
                    <div className="absolute top-14 right-0 w-7 h-[430px] z-40">
                      <div className="w-full h-full bg-gradient-to-b from-gray-100 via-gray-200 to-gray-100 rounded-r shadow-lg border-y border-r border-gray-300 relative">
                        {/* Textura de cinta enrollada */}
                        <div className="absolute inset-0 opacity-40" style={{
                          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent 10px, rgba(0,0,0,0.08) 10px, rgba(0,0,0,0.12) 11px)`
                        }}></div>
                        {/* Borde central sutil */}
                        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-gray-300/60"></div>
                        {/* Asa/tirador inferior */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-5 h-7 bg-gradient-to-b from-gray-100 to-gray-300 rounded border-2 border-gray-400 shadow flex items-center justify-center">
                          <div className="w-3 h-4 bg-gray-400 rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Indicador motor - Solo cuando ES motor */}
                  {isMotor && (
                    <div className="absolute top-16 right-4 flex items-center gap-2 z-30 bg-white/95 px-3 py-1.5 rounded shadow border border-gray-200">
                      <div className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-xs font-medium text-gray-700">Motor</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CONTROLES */}
            <div className="space-y-6">
              
              {/* Color CAJA */}
              <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold text-gray-900 uppercase tracking-wide">Color Caja</label>
                  <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                    {winchesterPalette.find(c => c.hex === boxColor)?.name}
                  </span>
                </div>
                <div className="grid grid-cols-8 gap-2">
                  {winchesterPalette.map((item) => (
                    <button
                      key={item.name + '-box'}
                      onClick={() => setBoxColor(item.hex)}
                      className={`w-full aspect-square rounded border-2 transition ${
                        boxColor === item.hex ? 'border-gray-900 scale-105' : 'border-gray-300 hover:border-gray-500'
                      }`}
                      style={{ backgroundColor: item.hex }}
                      title={item.name}
                    />
                  ))}
                </div>
              </div>

              {/* Color LAMAS */}
              <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold text-gray-900 uppercase tracking-wide">Color Lamas</label>
                  <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                    {winchesterPalette.find(c => c.hex === slatColor)?.name}
                  </span>
                </div>
                <div className="grid grid-cols-8 gap-2">
                  {winchesterPalette.map((item) => (
                    <button
                      key={item.name + '-slat'}
                      onClick={() => setSlatColor(item.hex)}
                      className={`w-full aspect-square rounded border-2 transition ${
                        slatColor === item.hex ? 'border-gray-900 scale-105' : 'border-gray-300 hover:border-gray-500'
                      }`}
                      style={{ backgroundColor: item.hex }}
                      title={item.name}
                    />
                  ))}
                </div>
              </div>

              {/* Mecanismo */}
              <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 space-y-3">
                <label className="text-sm font-bold text-gray-900 uppercase tracking-wide block">Sistema</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsMotor(true)}
                    className={`flex-1 py-2.5 rounded font-semibold text-sm transition ${
                      isMotor ? 'bg-red-700 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    Motorizado
                  </button>
                  <button 
                    onClick={() => setIsMotor(false)}
                    className={`flex-1 py-2.5 rounded font-semibold text-sm transition ${
                      !isMotor ? 'bg-red-700 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    Cinta
                  </button>
                </div>
                
                <button 
                  onClick={() => setIsOpen(!isOpen)}
                  className="w-full bg-gray-900 text-white py-2.5 rounded font-semibold hover:bg-gray-800 transition-colors"
                >
                  {isOpen ? 'Bajar Persiana' : 'Subir Persiana'}
                </button>
              </div>

              {/* Info */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700">
                  <strong className="text-gray-900">Combinación:</strong> Caja {winchesterPalette.find(c => c.hex === boxColor)?.name} + Lamas {winchesterPalette.find(c => c.hex === slatColor)?.name}
                </p>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* CARACTERÍSTICAS */}
      <section className="py-16 bg-gray-50">
         <div className="w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
            <FeatureCard title="Garantía 10 años" desc="Resistencia UV y anti-arañazos certificada." />
            <FeatureCard title="Seguridad" desc="Lamas bloqueantes anti-levantamiento." />
            <FeatureCard title="Soporte" desc="Asesoramiento técnico en Cantabria." />
         </div>
      </section>

      {/* CTA - Botón simple */}
      <section className="py-16 bg-white text-center">
          <h2 className="text-2xl font-bold mb-3 text-gray-900">¿Listo para tu proyecto?</h2>
          <p className="text-gray-600 mb-6 max-w-lg mx-auto text-sm">Únete a profesionales que confían en Persianas Santander.</p>
          <Link to="/registro" className="inline-block bg-red-700 text-white px-8 py-3 rounded font-semibold hover:bg-red-800 transition-colors">
            Crear Cuenta Profesional
          </Link>
      </section>
    </div>
  )
}

const FeatureCard = ({ title, desc }) => (
  <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
    <h3 className="text-base font-bold mb-2 text-gray-900">{title}</h3>
    <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
  </div>
)

export default Home