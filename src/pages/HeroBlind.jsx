import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'

const PALETTE = [
  { name: 'Marfil',        hex: '#F2ECCA', light: true  },
  { name: 'Natural',       hex: '#E8E8E4', light: true  },
  { name: 'Inox',          hex: '#C8C8C8', light: true  },
  { name: 'Gris Sable',    hex: '#8A8C7E', light: true  },
  { name: 'Gris Moteado',  hex: '#7A7A7A', light: false },
  { name: '7011',          hex: '#52595D', light: false },
  { name: '7016',          hex: '#2F3538', light: false },
  { name: 'Bronce',        hex: '#828559', light: false },
  { name: '8014',          hex: '#4E3829', light: false },
  { name: '8017',          hex: '#44221A', light: false },
  { name: '3005',          hex: '#5E2028', light: false },
  { name: '6009',          hex: '#27352A', light: false },
  { name: '6005',          hex: '#0F4336', light: false },
  { name: 'Negro',         hex: '#1A1A1A', light: false },
  { name: 'Winchester',    hex: '#C49A6C', light: true  },
  { name: 'Madera 120',    hex: '#C4A06A', light: true  },
  { name: 'Madera 176',    hex: '#A0724A', light: false },
  { name: 'Madera Oscuro', hex: '#5D3A1A', light: false },
]

function ColorDropdown({ label, selectedHex, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const selected = PALETTE.find(c => c.hex === selectedHex)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">{label}</p>

      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 bg-white border border-gray-300 hover:border-gray-400 rounded-xl px-4 py-3 transition-colors shadow-sm"
      >
        <div className="flex items-center gap-3">
          <span
            className="w-6 h-6 rounded-lg border border-gray-200 flex-shrink-0 shadow-sm"
            style={{ backgroundColor: selectedHex }}
          />
          <span className="text-sm font-semibold text-gray-900">{selected?.name}</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Desplegable */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-xl p-3 shadow-xl">
          <div className="grid grid-cols-6 gap-1.5">
            {PALETTE.map(c => (
              <button
                key={c.hex}
                title={c.name}
                onClick={() => { onChange(c.hex); setOpen(false) }}
                className={`aspect-square rounded-lg border-2 transition-all relative ${
                  selectedHex === c.hex
                    ? 'border-gray-900 scale-110 shadow-md'
                    : c.light
                    ? 'border-gray-200 hover:border-gray-400'
                    : 'border-transparent hover:border-gray-400'
                }`}
                style={{ backgroundColor: c.hex }}
              >
                {selectedHex === c.hex && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                      stroke={c.light ? '#111' : '#fff'} strokeWidth="3.5">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function HeroBlind() {
  const [boxColor,  setBoxColor]  = useState('#F2ECCA')
  const [slatColor, setSlatColor] = useState('#C49A6C')

  const maskStyle = (src) => ({
    maskImage:          `url(${src})`,
    maskSize:           'contain',
    maskRepeat:         'no-repeat',
    maskPosition:       'center',
    WebkitMaskImage:    `url(${src})`,
    WebkitMaskSize:     'contain',
    WebkitMaskRepeat:   'no-repeat',
    WebkitMaskPosition: 'center',
  })

  return (
    <section className="w-full min-h-screen flex flex-col lg:flex-row">

      {/* ── Panel izquierdo: persiana ── */}
      <div
        className="relative flex-1 flex items-center justify-center overflow-hidden"
        style={{ background: '#f0f0ee', minHeight: '45vw' }}
      >
        <div className="relative w-full h-full flex items-center justify-center" style={{ minHeight: '45vw' }}>
          <div className="absolute inset-0 transition-colors duration-500"
            style={{ backgroundColor: slatColor, ...maskStyle('/persianacompleta.png') }} />
          <div className="absolute inset-0 transition-colors duration-500"
            style={{ backgroundColor: boxColor, ...maskStyle('/caja.png') }} />
          <img src="/persianacompleta.png" alt="Persiana Santander"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            draggable={false} style={{ mixBlendMode: 'multiply' }} />
        </div>
      </div>

      {/* ── Panel derecho: controles ── */}
      <div className="flex flex-col justify-center gap-6 px-6 py-10 bg-white border-t lg:border-t-0 lg:border-l border-gray-200 lg:w-[420px] lg:flex-shrink-0">
        <div>
          <span className="text-xs font-bold tracking-widest uppercase text-red-600 mb-2 block">
            Fabricación propia · Santander
          </span>
          <h1 className="text-3xl lg:text-4xl font-black text-gray-900 leading-tight mb-3">
            Tu persiana,<br />tu color
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            18 acabados Winchester. Elige el color de la caja y las lamas por separado.
          </p>
        </div>

        <div className="h-px bg-gray-100" />

        <div className="space-y-4">
          <ColorDropdown label="Color de la caja"   selectedHex={boxColor}  onChange={setBoxColor}  />
          <ColorDropdown label="Color de las lamas" selectedHex={slatColor} onChange={setSlatColor} />
        </div>

        <div className="h-px bg-gray-100" />

        <div className="grid grid-cols-3 gap-3">
          {[
            { n: '18',      l: 'acabados' },
            { n: '3 años',  l: 'garantía'  },
            { n: '7–15d',   l: 'entrega'   },
          ].map(({ n, l }) => (
            <div key={n} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
              <p className="text-gray-900 font-black text-sm">{n}</p>
              <p className="text-gray-400 text-xs mt-0.5">{l}</p>
            </div>
          ))}
        </div>

        <Link to="/configurador"
          className="block w-full py-4 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-sm text-center transition-colors">
          Configurar a medida con precio →
        </Link>
      </div>
    </section>
  )
}