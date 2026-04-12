import { Link } from 'react-router-dom'
import HeroBlind from './HeroBlind'
import SEO from '../shared/SEO'

const FEATURES = [
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
    title: 'Garantía 3 años',
    desc: 'Resistencia UV certificada y acabados anti-arañazos en todos nuestros productos.',
  },
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />,
    title: 'Seguridad certificada',
    desc: 'Lamas bloqueantes anti-levantamiento. Homologación europea EN 1627.',
  },
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />,
    title: 'Fabricación propia',
    desc: 'Taller en Santander con control total de calidad desde el aluminio hasta la instalación.',
  },
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
    title: 'Entrega en 7–15 días',
    desc: 'Fabricamos a medida y enviamos con instalador propio en toda Cantabria.',
  },
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
    title: 'Descuento profesional',
    desc: 'Descuento exclusivo para instaladores, arquitectos y empresas constructoras.',
  },
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />,
    title: 'Soporte técnico',
    desc: 'Asesoramiento en obra, visita técnica gratuita y posventa en toda la región.',
  },
]

const PROCESS_STEPS = [
  { n: '01', title: 'Configura online',     desc: 'Elige tipo, medidas, colores y mecanismo en nuestro configurador.' },
  { n: '02', title: 'Recibe presupuesto',   desc: 'Te enviamos el presupuesto detallado en menos de 24 h.' },
  { n: '03', title: 'Fabricamos a medida',  desc: 'Producción en nuestro taller de Santander con control de calidad.' },
  { n: '04', title: 'Instalación incluida', desc: 'Nuestro equipo instala y revisa el funcionamiento en tu hogar.' },
]

const TESTIMONIALS = [
  { name: 'Carlos Méndez',          role: 'Arquitecto',           initials: 'CM', stars: 5, text: 'La precisión de medidas y la calidad del aluminio extrusionado superan a la mayoría de fabricantes nacionales. Trabajo con ellos en todos mis proyectos.' },
  { name: 'Laura Fernández',         role: 'Propietaria particular', initials: 'LF', stars: 5, text: 'Pedí 12 persianas motorizadas para mi casa nueva. El configurador fue muy fácil y el equipo de instalación fue puntual y limpio.' },
  { name: 'Grupo Constructor Norte', role: 'Empresa promotora',    initials: 'GN', stars: 5, text: 'Llevamos 3 años trabajando con Persianas Santander. Los plazos se cumplen y la relación calidad-precio es inmejorable.' },
]

function StarRating({ count }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} className="w-4 h-4 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

function SocialLink({ href, label }) {
  return (
    <a href={href} aria-label={label}
      className="w-8 h-8 rounded-full border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-500 transition-colors text-xs font-bold">
      {label[0]}
    </a>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <SEO canonical="/" />

      {/* ── HERO ── */}
      <HeroBlind />

      {/* ── CARACTERÍSTICAS ── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">¿Por qué elegirnos?</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Más de tres décadas fabricando persianas de aluminio con la mayor exigencia técnica.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title} className="bg-white rounded-xl p-6 border border-gray-200 hover:border-red-200 hover:shadow-md transition-all group">
                <div className="w-12 h-12 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mb-4 group-hover:bg-red-600 group-hover:text-white transition-colors">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">{icon}</svg>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-xs font-bold tracking-widest uppercase text-red-600 mb-3 block">Proceso</span>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Cómo funciona</h2>
            <p className="text-gray-500">Del configurador a la instalación en 4 pasos.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0 relative">
            {/* Línea conectora desktop */}
            <div className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-gray-200 z-0" />
            {PROCESS_STEPS.map(({ n, title, desc }) => (
              <div key={n} className="relative z-10 flex flex-col items-center text-center px-6 pb-8">
                <div className="w-16 h-16 rounded-full bg-white border-2 border-red-600 flex items-center justify-center mb-5 shadow-sm">
                  <span className="text-red-600 font-black text-lg">{n}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-base">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* CTA debajo del proceso */}
          <div className="text-center mt-8">
            <Link
              to="/configurador"
              className="inline-flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white px-8 py-3.5 rounded-full font-bold text-sm transition-colors"
            >
              Empezar ahora
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── PRODUCTOS ── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Nuestros productos</h2>
            <p className="text-gray-500">Dos líneas fabricadas con aluminio extrusionado de primera calidad.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { badge: 'Más popular', title: 'Persiana estándar', price: 'Desde 43 €/m²', desc: 'Ideal para viviendas, locales y oficinas. Disponible con muelle, cinta o motor.', features: ['Muelle, cinta o motor', 'Lamas normales o de seguridad', 'Garantía 3 años', 'Ancho hasta 3.000 mm'], accent: true },
              { badge: 'Alta seguridad', title: 'Persiana bloqueante', price: 'Desde 134 €/m²', desc: 'Sistema anti-levantamiento certificado EN 1627. Exclusivo con motor.', features: ['Solo motorizada', 'Lamas de seguridad reforzadas', 'Certificado EN 1627', 'Acero + aluminio compuesto'], accent: false },
            ].map(({ badge, title, price, desc, features, accent }) => (
              <div key={title} className={`rounded-xl p-8 border-2 ${accent ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className={`inline-block text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded mb-2 ${accent ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{badge}</span>
                    <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                  </div>
                  <span className={`font-bold text-sm ${accent ? 'text-red-700' : 'text-gray-700'}`}>{price}</span>
                </div>
                <p className="text-gray-600 text-sm mb-5 leading-relaxed">{desc}</p>
                <ul className="space-y-2 mb-6">
                  {features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                      <svg className={`w-4 h-4 flex-shrink-0 ${accent ? 'text-red-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/configurador" className={`block text-center py-3 rounded-lg font-semibold text-sm transition-colors ${accent ? 'bg-red-700 text-white hover:bg-red-800' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
                  Configurar este modelo
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Lo que dicen nuestros clientes</h2>
            <p className="text-gray-500">Más de 5.000 instalaciones en Cantabria y resto de España.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ name, role, text, stars, initials }) => (
              <div key={name} className="bg-white rounded-xl p-6 border border-gray-200 flex flex-col gap-4">
                <StarRating count={stars} />
                <p className="text-gray-700 text-sm leading-relaxed flex-1">"{text}"</p>
                <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                  <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-sm flex-shrink-0">{initials}</div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{name}</p>
                    <p className="text-gray-400 text-xs">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DESCARGA GUÍA DE MEDIDAS ── */}
      <section className="py-12 bg-gray-50 border-y border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-base mb-0.5">Guía gratuita para tomar medidas</p>
                <p className="text-gray-500 text-sm">Descarga nuestra guía paso a paso y mide tu ventana sin errores antes de pedir presupuesto.</p>
              </div>
            </div>
            <a
              href="/tutorial-medidas.pdf"
              download="guia-medidas-persianas-santander.pdf"
              className="flex-shrink-0 flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Descargar PDF gratis
            </a>
          </div>
        </div>
      </section>

      {/* ── CTA PROFESIONAL ── */}
      <section className="py-20 bg-red-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block bg-red-800/60 text-red-200 text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full border border-red-500/40 mb-4">
            Para instaladores y constructores
          </span>
          <h2 className="text-4xl font-black mb-4">Cuenta profesional con descuento exclusivo</h2>
          <p className="text-red-100 mb-8 text-lg max-w-2xl mx-auto">
            Acceso a precios de tarifa profesional, gestión de múltiples proyectos y presupuestos PDF descargables.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/registro" className="inline-block bg-white text-red-700 px-8 py-3.5 rounded-full font-bold hover:bg-red-50 transition-colors">Crear cuenta profesional</Link>
            <Link to="/login"    className="inline-block border border-red-400/60 text-white px-8 py-3.5 rounded-full font-semibold hover:bg-red-600 transition-colors">Ya tengo cuenta</Link>
          </div>
        </div>
      </section>

      {/* ── DÓNDE ESTAMOS ── */}
      <section className="bg-gray-50 border-t border-gray-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">¿Dónde estamos?</h2>
            <p className="text-gray-500 text-sm">Visítanos en nuestra fábrica en Santander</p>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-md border border-gray-200">
            <iframe
              title="Ubicación Persianas Santander"
              src="https://www.openstreetmap.org/export/embed.html?bbox=-3.8500%2C43.4400%2C-3.8430%2C43.4470&layer=mapnik&marker=43.4433918%2C-3.8463897"
              width="100%"
              height="420"
              style={{ border: 0, display: 'block' }}
              loading="lazy"
            />
          </div>
          <div className="text-center mt-4">
            <a
              href="https://www.google.com/maps/place/persianas+Santander/@43.4433918,-3.8463897,17z"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-red-700 hover:text-red-800 hover:underline"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Abrir en Google Maps
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-gray-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 mb-12">

            {/* Marca — 2 columnas */}
            <div className="md:col-span-2">
              <img
                src="/persianassantanderlogo.png"
                alt="Persianas Santander"
                className="h-24 w-auto mb-5"
                onError={e => { e.target.src = '/persianassantanderlogo.svg' }}
              />
              <p className="text-sm leading-relaxed text-gray-500 max-w-xs mb-6">
                Fabricantes de persianas de aluminio desde 1990. Taller propio en Santander, instalación en toda Cantabria.
              </p>
              <div className="flex gap-3">
                {[
                  { label: 'Facebook',  letter: 'F' },
                  { label: 'Instagram', letter: 'I' },
                  { label: 'LinkedIn',  letter: 'L' },
                ].map(({ label, letter }) => (
                  <a key={label} href="#" aria-label={label}
                    className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-700 hover:border-red-200 transition-colors text-xs font-bold">
                    {letter}
                  </a>
                ))}
              </div>
            </div>

            {/* Productos */}
            <div>
              <p className="text-gray-900 font-semibold text-xs uppercase tracking-widest mb-5">Productos</p>
              <ul className="space-y-3">
                {[
                  { label: 'Configurador', to: '/configurador', link: true },
                  { label: 'Persianas estándar' },
                  { label: 'Persianas bloqueantes' },
                  { label: 'Motorización' },
                  { label: '📄 Guía de medidas (PDF)', download: true },
                ].map(({ label, to, link, download }) => (
                  <li key={label} className="text-sm">
                    {link
                      ? <Link to={to} className="text-gray-500 hover:text-red-700 transition-colors">{label}</Link>
                      : download
                      ? <a href="/tutorial-medidas.pdf" download="guia-medidas-persianas-santander.pdf"
                           className="text-gray-500 hover:text-red-700 transition-colors">{label}</a>
                      : <span className="text-gray-500 hover:text-red-700 cursor-pointer transition-colors">{label}</span>
                    }
                  </li>
                ))}
              </ul>
            </div>

            {/* Empresa */}
            <div>
              <p className="text-gray-900 font-semibold text-xs uppercase tracking-widest mb-5">Empresa</p>
              <ul className="space-y-3">
                {['Sobre nosotros', 'Trabaja con nosotros', 'Aviso legal', 'Privacidad'].map(l => (
                  <li key={l} className="text-sm">
                    <span className="text-gray-500 hover:text-red-700 cursor-pointer transition-colors">{l}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contacto */}
            <div>
              <p className="text-gray-900 font-semibold text-xs uppercase tracking-widest mb-5">Contacto</p>
              <ul className="space-y-4">
                <li>
                  <a href="tel:+34942000000" className="flex items-center gap-3 text-sm text-gray-500 hover:text-red-700 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-red-50 flex items-center justify-center flex-shrink-0 transition-colors">
                      <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    +34 942 00 00 00
                  </a>
                </li>
                <li>
                  <a href="mailto:adminpersianassantander@gmail.com" className="flex items-center gap-3 text-sm text-gray-500 hover:text-red-700 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-red-50 flex items-center justify-center flex-shrink-0 transition-colors">
                      <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    adminpersianassantander@gmail.com
                  </a>
                </li>
                <li>
                  <div className="flex items-start gap-3 text-sm text-gray-500">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="leading-relaxed">Polígono Nueva Montaña<br />C/ Isla Oleo, Nave 9<br />Santander, Cantabria</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Barra inferior */}
          <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
            <p>© {new Date().getFullYear()} Persianas Santander S.L. Todos los derechos reservados.</p>
            <div className="flex gap-5">
              <Link to="/terminos"   className="hover:text-gray-600 transition-colors">Aviso legal</Link>
              <Link to="/privacidad" className="hover:text-gray-600 transition-colors">Privacidad</Link>
              <Link to="/cookies"    className="hover:text-gray-600 transition-colors">Cookies</Link>
            </div>
          </div>
          {/* Enlace sitio anterior */}
          <div className="border-t border-gray-100 pt-5 mt-2">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <a
                href="https://persianassantander.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-2.5 transition-colors group"
              >
                <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span className="text-sm text-gray-500 group-hover:text-gray-700 transition-colors">
                  Sitio web anterior: <span className="font-semibold text-gray-700">persianassantander.com</span>
                </span>
              </a>
              <a
                href="https://mindbride.net"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-2.5 transition-colors group"
              >
                <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span className="text-sm text-gray-500 group-hover:text-gray-700 transition-colors">
                  Diseño y desarrollo: <span className="font-semibold text-gray-700">mindbride.net</span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Botón flotante WhatsApp */}
      <a
        href="https://wa.me/34654990000"
        target="_blank"
        rel="noopener noreferrer"
        title="Contactar por WhatsApp"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold text-sm px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all"
      >
        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        WhatsApp
      </a>
    </div>
  )
}