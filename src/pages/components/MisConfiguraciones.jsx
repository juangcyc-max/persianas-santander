import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase/client'

// ─── Preview SVG generado dinámicamente (sin imágenes rotas) ────────────────
function BlindSVGPreview({ boxColor = '#dc2626', slatColor = '#ffffff' }) {
  // Asegurar contraste mínimo del texto
  const isDark = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 < 128
  }

  const slats = Array.from({ length: 7 })

  return (
    <svg
      viewBox="0 0 200 140"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      {/* Fondo cielo */}
      <defs>
        <linearGradient id={`sky-${boxColor}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfdbfe" />
          <stop offset="100%" stopColor="#e0f2fe" />
        </linearGradient>
      </defs>
      <rect width="200" height="140" fill={`url(#sky-${boxColor})`} />

      {/* Caja superior */}
      <rect x="10" y="10" width="180" height="24" rx="3" fill={boxColor} />
      {/* Brillo caja */}
      <rect x="10" y="10" width="180" height="6" rx="3" fill="rgba(255,255,255,0.15)" />

      {/* Lamas */}
      {slats.map((_, i) => (
        <g key={i}>
          <rect
            x="10"
            y={34 + i * 14}
            width="180"
            height="12"
            fill={slatColor}
          />
          {/* Línea de separación */}
          <rect
            x="10"
            y={34 + i * 14 + 12}
            width="180"
            height="2"
            fill="rgba(0,0,0,0.12)"
          />
        </g>
      ))}

      {/* Borde lateral cinta */}
      <rect x="183" y="34" width="7" height="98" rx="1" fill="#e5e7eb" />

      {/* Marco ventana */}
      <rect x="10" y="10" width="180" height="122" rx="3" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
    </svg>
  )
}

// ─── Custom hook ─────────────────────────────────────────────────────────────
const useConfigurations = () => {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetchConfigs = async () => {
    try {
      setLoading(true)
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

// ─── Botón de acción ─────────────────────────────────────────────────────────
const ActionButton = ({ onClick, label, variant = 'default', disabled, children }) => {
  const base = 'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors focus:outline-none'
  const variants = {
    default: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
    primary: 'bg-red-700 text-white hover:bg-red-800',
    danger:  'text-red-600 hover:text-red-800 hover:bg-red-50',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {disabled
        ? <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        : children || label}
    </button>
  )
}

// ─── Tarjeta de configuración ────────────────────────────────────────────────
const ConfigCard = ({ config, onDelete, onView, onDuplicate, isProcessing }) => {
  const price = new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
  }).format(config.estimated_price || 0)

  const date = new Intl.DateTimeFormat('es-ES', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(config.created_at))

  const isBlocking   = config.blind_type === 'blocking'
  const mechLabel    = { muelle: 'Muelle', cinta: 'Cinta', motor: 'Motor' }[config.mechanism] ?? config.mechanism ?? '—'

  return (
    <article className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-red-200 hover:shadow-md transition-all group">

      {/* Preview SVG (sin imágenes rotas) */}
      <div className="relative h-36 bg-gray-50 overflow-hidden">
        <BlindSVGPreview
          boxColor={config.box_color || '#dc2626'}
          slatColor={config.slat_color || '#ffffff'}
        />
        {/* Badge tipo */}
        <div className={`absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full ${
          isBlocking
            ? 'bg-gray-900 text-white'
            : 'bg-white text-gray-700 border border-gray-200'
        }`}>
          {isBlocking ? '🔒 Bloqueante' : 'Estándar'}
        </div>
        {/* Badge fecha */}
        <div className="absolute top-2 right-2 text-xs text-gray-500 bg-white/90 px-2 py-0.5 rounded-full border border-gray-100">
          {date}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4">
        <div className="mb-3">
          <h3 className="font-bold text-gray-900 text-sm">
            Persiana {isBlocking ? 'bloqueante' : 'estándar'}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">{mechLabel}</p>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-xs mb-4">
          <div>
            <dt className="text-gray-400 uppercase tracking-wide mb-0.5">Medidas</dt>
            <dd className="text-gray-700 font-semibold">{config.width} × {config.height} mm</dd>
          </div>
          <div>
            <dt className="text-gray-400 uppercase tracking-wide mb-0.5">Colores</dt>
            <dd className="text-gray-700 font-semibold truncate">
              <span className="inline-flex items-center gap-1">
                <span
                  className="inline-block w-3 h-3 rounded-full border border-gray-200 flex-shrink-0"
                  style={{ backgroundColor: config.box_color || '#ccc' }}
                />
                {config.box_color_name || '—'}
              </span>
              {' / '}
              <span className="inline-flex items-center gap-1">
                <span
                  className="inline-block w-3 h-3 rounded-full border border-gray-200 flex-shrink-0"
                  style={{ backgroundColor: config.slat_color || '#ccc' }}
                />
                {config.slat_color_name || '—'}
              </span>
            </dd>
          </div>
        </dl>

        <footer className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-lg font-black text-red-700">{price}</span>
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

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export default function MisConfiguraciones() {
  const navigate = useNavigate()
  const { data: configs, setData, loading, error, refresh } = useConfigurations()

  const [processingId, setProcessingId] = useState(null)
  const [search,       setSearch]       = useState('')
  const [activeFilter, setActiveFilter] = useState('all')

  const filteredConfigs = useMemo(() => configs.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = c.blind_type?.toLowerCase().includes(q) ||
                        c.mechanism?.toLowerCase().includes(q)  ||
                        c.box_color_name?.toLowerCase().includes(q) ||
                        c.slat_color_name?.toLowerCase().includes(q)
    const matchFilter = activeFilter === 'all' ||
                        (activeFilter === 'blocking' ? c.blind_type === 'blocking' : c.blind_type !== 'blocking')
    return matchSearch && matchFilter
  }), [configs, search, activeFilter])

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta configuración?')) return
    setProcessingId(id)
    try {
      const res = await supabase.from('blind_configurations').delete().eq('id', id)
      if (res.error) throw res.error
      setData(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      console.error(err)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDuplicate = async (config) => {
    setProcessingId('dup-' + config.id)
    const { id, created_at, ...copyData } = config
    const res = await supabase.from('blind_configurations').insert([copyData])
    if (!res.error) refresh()
    setProcessingId(null)
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-red-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Cargando configuraciones…</p>
        </div>
      </div>
    )
  }

  // ── Error ──
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-red-200 p-8 max-w-sm text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <p className="text-gray-900 font-semibold mb-1">No se pudieron cargar las configuraciones</p>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">

        {/* Cabecera */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mis configuraciones</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {configs.length} {configs.length === 1 ? 'configuración guardada' : 'configuraciones guardadas'}
            </p>
          </div>
          <button
            onClick={() => navigate('/configurador')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-700 text-white text-sm font-semibold rounded-xl hover:bg-red-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva configuración
          </button>
        </header>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por tipo, mecanismo, color…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white"
            />
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {[
              { key: 'all',      label: 'Todos' },
              { key: 'blocking', label: 'Bloqueantes' },
              { key: 'standard', label: 'Estándar' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`px-4 py-2.5 text-sm font-semibold rounded-xl border transition-colors ${
                  activeFilter === key
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid o vacío */}
        {filteredConfigs.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900 mb-1">
              {search || activeFilter !== 'all' ? 'Sin resultados' : 'Sin configuraciones guardadas'}
            </p>
            <p className="text-gray-400 text-sm mb-6">
              {search || activeFilter !== 'all'
                ? 'Prueba ajustando los filtros.'
                : 'Crea tu primera configuración en el configurador.'}
            </p>
            {!search && activeFilter === 'all' && (
              <button
                onClick={() => navigate('/configurador')}
                className="px-5 py-2.5 bg-red-700 text-white text-sm font-semibold rounded-xl hover:bg-red-800 transition-colors"
              >
                Ir al configurador
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredConfigs.map(config => (
              <ConfigCard
                key={config.id}
                config={config}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onView={c => navigate('/configurador', { state: { loadConfig: c } })}
                isProcessing={processingId === config.id || processingId === 'dup-' + config.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}