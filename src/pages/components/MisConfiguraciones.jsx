import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase/client'

// --- Custom Hook (Business Logic) ---
const useConfigurations = () => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchConfigs = async () => {
    try {
      setLoading(true)
      
      // ✅ SIN DESTRUCTURING ANIDADO - Evita errores de copiado
      const authResponse = await supabase.auth.getUser()
      const user = authResponse.data.user
      
      if (!user) throw new Error('No session')

      const response = await supabase
        .from('blind_configurations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (response.error) throw response.error
      setData(response.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchConfigs() }, [])

  return { data, setData, loading, error, refresh: fetchConfigs }
}

// --- Sub-componente: Botón de Acción Profesional ---
const ActionButton = ({ onClick, label, variant = 'default', disabled, children }) => {
  const baseStyles = 'px-3 py-1.5 text-xs font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1'
  
  const variants = {
    default: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-300',
    primary: 'bg-santander-red text-white hover:bg-red-700 focus:ring-red-400',
    danger: 'text-red-600 hover:text-red-800 hover:bg-red-50 focus:ring-red-300'
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {disabled ? (
        <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : children || label}
    </button>
  )
}

// --- Sub-componente: Tarjeta de Configuración Profesional ---
const ConfigCard = ({ config, onDelete, onView, onDuplicate, isProcessing }) => {
  const price = new Intl.NumberFormat('es-ES', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 2 
  }).format(config.estimated_price || 0)
  
  const date = new Intl.DateTimeFormat('es-ES', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  }).format(new Date(config.created_at))

  const imageUrl = "/assets/blinds/blocking-blanco-blanco.webp.png"

  return (
    <article className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors">
      
      {/* Preview de imagen */}
      <div className="relative h-40 bg-gray-100">
        <img 
          src={imageUrl} 
          alt={`Configuración de persiana ${config.blind_type}`}
          className="w-full h-full object-cover"
          onError={(e) => { 
            e.target.onerror = null
            e.target.src = "/assets/blinds/blocking-gris-negro.webp.png"
          }} 
        />
        <div className="absolute top-3 right-3 bg-white/90 px-2 py-1 rounded text-xs text-gray-600 font-medium">
          {date}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4">
        <header className="mb-3">
          <h3 className="font-semibold text-gray-900 text-base">
            {config.blind_type === 'blocking' ? 'Persiana Bloqueante' : 'Persiana Estándar'}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {config.mechanism || 'Mecanismo no especificado'}
          </p>
        </header>

        <dl className="grid grid-cols-2 gap-2 text-sm mb-4">
          <div>
            <dt className="text-gray-400 text-xs uppercase tracking-wide">Medidas</dt>
            <dd className="text-gray-700 font-medium">{config.width} × {config.height} mm</dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs uppercase tracking-wide">Colores</dt>
            <dd className="text-gray-700 font-medium truncate">
              {config.box_color_name} / {config.slat_color_name}
            </dd>
          </div>
        </dl>

        <footer className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-lg font-semibold text-santander-red">{price}</span>
          
          <div className="flex items-center gap-1">
            <ActionButton onClick={() => onView(config)} label="Ver" />
            <ActionButton onClick={() => onDuplicate(config)} label="Duplicar" />
            <ActionButton 
              onClick={() => onDelete(config.id)} 
              label="Eliminar" 
              variant="danger"
              disabled={isProcessing}
            />
          </div>
        </footer>
      </div>
    </article>
  )
}

// --- Componente Principal ---
export default function MisConfiguraciones() {
  const navigate = useNavigate()
  const hookData = useConfigurations()
  const configs = hookData.data
  const setData = hookData.setData
  const loading = hookData.loading
  const refresh = hookData.refresh
  
  const [processingId, setProcessingId] = useState(null)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')

  const filteredConfigs = useMemo(() => {
    return configs.filter(c => {
      const matchesSearch = c.blind_type?.toLowerCase().includes(search.toLowerCase()) || 
                            c.mechanism?.toLowerCase().includes(search.toLowerCase())
      const matchesFilter = activeFilter === 'all' || 
                           (activeFilter === 'blocking' ? c.blind_type === 'blocking' : c.blind_type !== 'blocking')
      return matchesSearch && matchesFilter
    })
  }, [configs, search, activeFilter])

  const handleDelete = async (id) => {
    setProcessingId(id)
    
    try {
      const response = await supabase
        .from('blind_configurations')
        .delete()
        .eq('id', id)
      
      if (response.error) throw response.error
      setData(prev => prev.filter(c => c.id !== id))
      
    } catch (err) {
      console.error('Error al eliminar:', err)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDuplicate = async (config) => {
    setProcessingId('dup-' + config.id)
    const { id, created_at, ...copyData } = config
    const response = await supabase.from('blind_configurations').insert([copyData])
    if (!response.error) refresh()
    setProcessingId(null)
  }

  // Loading state profesional
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-santander-red border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-600 text-sm">Cargando configuraciones...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Mis Configuraciones</h1>
            <p className="text-gray-500 text-sm mt-1">Gestiona tus presupuestos guardados</p>
          </div>
          <button
            onClick={() => navigate('/configurador')}
            className="inline-flex items-center justify-center px-4 py-2 bg-santander-red text-white text-sm font-medium rounded hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
          >
            Nueva configuración
          </button>
        </header>

        {/* Filtros y búsqueda */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <input 
              type="text" 
              placeholder="Buscar por tipo o mecanismo..." 
              className="w-full pl-4 pr-4 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-santander-red focus:border-transparent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {['all', 'blocking', 'standard'].map(filter => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-4 py-2 text-sm font-medium rounded border transition-colors ${
                  activeFilter === filter
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {filter === 'all' ? 'Todos' : filter === 'blocking' ? 'Bloqueantes' : 'Estándar'}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de configuraciones */}
        {filteredConfigs.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-900 font-medium mb-2">
              {search || activeFilter !== 'all' ? 'No se encontraron resultados' : 'Aún no tienes configuraciones guardadas'}
            </p>
            <p className="text-gray-500 text-sm mb-6">
              {search || activeFilter !== 'all' 
                ? 'Prueba ajustando los filtros de búsqueda.' 
                : 'Configura tu primera persiana y guárdala para gestionarla aquí.'}
            </p>
            <button
              onClick={() => navigate('/configurador')}
              className="inline-flex items-center justify-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors"
            >
              Configurar persiana
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredConfigs.map(config => (
              <ConfigCard 
                key={config.id}
                config={config}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onView={(c) => navigate('/configurador', { state: { loadConfig: c } })}
                isProcessing={processingId === config.id || processingId === 'dup-' + config.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}