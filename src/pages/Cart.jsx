import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase/client'
import { useCart } from '../context/CartContext'
import { sanitizeText, sanitizeNumber } from '../services/sanitize'
import { getProfessionalDiscount } from '../services/settings'

const HORAS = ['08:00','09:00','10:00','11:00','12:00','13:00','16:00','17:00','18:00','19:00']

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
}

// ── Tarjeta de producto en la cesta ──────────────────────────────────────
function CartItem({ item, onRemove }) {
  const config = item.blind_configurations
  if (!config) return null

  const maskStyle = (src) => ({
    maskImage: `url(${src})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center',
    WebkitMaskImage: `url(${src})`, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center',
  })

  return (
    <div className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl">
      {/* Mini preview */}
      <div className="relative w-20 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-50">
        <div className="absolute inset-0 transition-colors"
          style={{ backgroundColor: config.slat_color_name ? '#C4A77D' : '#F5F5F5', ...maskStyle('/persianacompleta.png') }} />
        <div className="absolute inset-0 transition-colors"
          style={{ backgroundColor: config.box_color_name ? '#F5F5F5' : '#F5F5F5', ...maskStyle('/caja.png') }} />
        <img src="/persianacompleta.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ mixBlendMode: 'multiply' }} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">
          Persiana {config.blind_type === 'blocking' ? 'bloqueante' : 'estándar'}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {config.width} × {config.height} mm · {config.mechanism}
        </p>
        <p className="text-xs text-gray-400">
          Caja: {config.box_color_name} · Lamas: {config.slat_color_name}
        </p>
      </div>

      {/* Precio */}
      <div className="text-right flex-shrink-0">
        <p className="font-bold text-gray-900">{fmt(config.estimated_price * item.quantity)}</p>
        <p className="text-xs text-gray-400">sin IVA</p>
      </div>

      {/* Eliminar */}
      <button onClick={() => onRemove(item.id)}
        className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── CESTA PRINCIPAL ───────────────────────────────────────────────────────
export default function Cart() {
  const navigate = useNavigate()
  const { items, totalPrice, totalWithIva, removeFromCart, clearCart, user } = useCart()
  const isProfessional = user?.user_metadata?.user_type === 'professional'
  const [proDiscount, setProDiscount] = useState(20)

  useEffect(() => { getProfessionalDiscount().then(setProDiscount) }, [])

  const [step,     setStep]     = useState('cart')   // 'cart' | 'checkout' | 'success'
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  // Datos checkout particular
  const [address,  setAddress]  = useState('')
  const [phone,    setPhone]    = useState('')
  const [date,     setDate]     = useState('')
  const [time,     setTime]     = useState('')
  const [notes,    setNotes]    = useState('')

  // Fecha mínima = mañana
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  async function handleSubmit() {
    if (!isProfessional) {
      if (!address.trim()) { setError('La dirección es obligatoria'); return }
      if (!phone.trim())   { setError('El teléfono es obligatorio'); return }
      if (!date)           { setError('Elige un día preferido'); return }
      if (!time)           { setError('Elige una hora preferida'); return }
    }
    setLoading(true)
    setError('')

    try {
      const orderData = {
        user_id:        user.id,
        user_type:      isProfessional ? 'professional' : 'public',
        items:          items.map(i => ({
          configuration_id: i.configuration_id,
          quantity:         i.quantity,
          blind_type:       i.blind_configurations?.blind_type,
          width:            i.blind_configurations?.width,
          height:           i.blind_configurations?.height,
          mechanism:        i.blind_configurations?.mechanism,
          estimated_price:  i.blind_configurations?.estimated_price,
          box_color_name:   i.blind_configurations?.box_color_name,
          slat_color_name:  i.blind_configurations?.slat_color_name,
        })),
        total_price:    totalPrice,
        total_with_iva: totalWithIva,
        status:         'pending',
        ...(!isProfessional && {
          address:        sanitizeText(address),
          phone:          sanitizeText(phone),
          preferred_date: date,
          preferred_time: time,
          notes:          sanitizeText(notes),
        }),
      }

      const { data: order, error: orderError } = await supabase
        .from('orders').insert(orderData).select().single()
      if (orderError) throw orderError

      // Enviar email a la fábrica via EmailJS
      await sendEmailToFactory(order, orderData)

      await clearCart()
      setStep('success')
    } catch (err) {
      setError('Error al procesar la solicitud. Inténtalo de nuevo.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function sendEmailToFactory(order, data) {
    try {
      const itemsList = data.items.map(i =>
        `- Persiana ${i.blind_type === 'blocking' ? 'bloqueante' : 'estándar'} ${i.width}×${i.height}mm, ${i.mechanism}, Caja:${i.box_color_name}, Lamas:${i.slat_color_name} → ${fmt(i.estimated_price)}`
      ).join('\n')

      const citaInfo = !isProfessional
        ? `\n\nCITA DE MEDICIÓN SOLICITADA:\nDirección: ${data.address}\nTeléfono: ${data.phone}\nFecha preferida: ${data.preferred_date} a las ${data.preferred_time}\nNotas: ${data.notes || 'Ninguna'}`
        : '\n\nPEDIDO PROFESIONAL (instalación propia)'

      // Usar EmailJS si está configurado, sino fallback a Supabase edge function
      const { emailjs } = window
      if (emailjs) {
        await emailjs.send('service_id', 'template_factory', {
          order_id:    order.id,
          user_email:  user.email,
          user_type:   data.user_type,
          items_list:  itemsList,
          total_price: fmt(data.total_price),
          total_iva:   fmt(data.total_with_iva),
          cita_info:   citaInfo,
        })
      }
    } catch (e) {
      console.warn('Email no enviado:', e)
      // No bloqueamos el flujo si el email falla
    }
  }

  // ── PANTALLA DE ÉXITO ───────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {isProfessional ? '¡Pedido enviado!' : '¡Solicitud recibida!'}
          </h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-2">
            {isProfessional
              ? 'Hemos recibido tu pedido. Nos pondremos en contacto contigo para confirmar los detalles.'
              : 'Hemos recibido tu solicitud de medición. Nuestro equipo se pondrá en contacto contigo para confirmar la cita.'
            }
          </p>
          {!isProfessional && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-4 text-left">
              <p className="text-xs font-semibold text-blue-700 mb-1">Cita solicitada</p>
              <p className="text-sm text-blue-900">{date} a las {time}</p>
              <p className="text-sm text-blue-700">{address}</p>
            </div>
          )}
          <div className="flex flex-col gap-2 mt-6">
            <Link to="/"
              className="block w-full py-3 bg-red-700 text-white rounded-xl font-bold text-sm hover:bg-red-800 transition-colors">
              Volver al inicio
            </Link>
            <Link to="/mis-configuraciones"
              className="block w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors">
              Ver mis configuraciones
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── CESTA VACÍA ─────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Tu cesta está vacía</h2>
          <p className="text-gray-500 text-sm mb-6">Configura una persiana y añádela a la cesta</p>
          <Link to="/configurador"
            className="inline-block bg-red-700 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-red-800 transition-colors">
            Ir al configurador
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Título */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {step === 'cart' ? 'Mi cesta' : isProfessional ? 'Confirmar pedido' : 'Solicitar cita de medición'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {step === 'cart'
              ? `${items.length} ${items.length === 1 ? 'producto' : 'productos'}`
              : isProfessional
              ? 'Confirma tu pedido y nuestro equipo se pondrá en contacto'
              : 'Un técnico irá a medir y ajustar el presupuesto definitivo'
            }
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Columna izquierda — productos o formulario */}
          <div className="lg:col-span-2 space-y-4">
            {step === 'cart' && (
              <>
                {items.map(item => (
                  <CartItem key={item.id} item={item} onRemove={removeFromCart} />
                ))}
                <Link to="/configurador"
                  className="flex items-center gap-2 text-sm text-red-700 hover:underline font-semibold mt-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Añadir otra persiana
                </Link>
              </>
            )}

            {step === 'checkout' && !isProfessional && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Cita de medición</h3>
                  <p className="text-sm text-gray-500">Nuestro técnico irá a medir y confirmar el presupuesto final.</p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Dirección de instalación *</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                    placeholder="Calle, número, piso, ciudad"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono de contacto *</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="600 000 000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Día preferido *</label>
                    <input type="date" value={date} min={minDate} onChange={e => setDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Hora preferida *</label>
                    <select value={time} onChange={e => setTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white">
                      <option value="">Selecciona hora</option>
                      {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas adicionales</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                    placeholder="Acceso al edificio, piso, instrucciones especiales..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 resize-none" />
                </div>
              </div>
            )}

            {step === 'checkout' && isProfessional && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Pedido profesional</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Como instalador profesional, recibirás las persianas fabricadas a medida. La instalación corre de tu cuenta. Nos pondremos en contacto para coordinar la entrega.
                    </p>
                  </div>
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mt-4">
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Columna derecha — resumen */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-24">
              <h3 className="font-bold text-gray-900 mb-4">Resumen del pedido</h3>

              <div className="space-y-2 mb-4">
                {items.map(i => (
                  <div key={i.id} className="flex justify-between text-sm">
                    <span className="text-gray-600 truncate pr-2">
                      Persiana {i.blind_configurations?.blind_type === 'blocking' ? 'bloqueante' : 'estándar'}
                      {i.quantity > 1 && ` ×${i.quantity}`}
                    </span>
                    <span className="text-gray-900 font-medium flex-shrink-0">
                      {fmt((i.blind_configurations?.estimated_price ?? 0) * i.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-900">{fmt(totalPrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">IVA (21%)</span>
                  <span className="text-gray-900">{fmt(totalWithIva - totalPrice)}</span>
                </div>
                {isProfessional && (
                  <div className="flex justify-between text-sm text-green-700">
                    <span className="font-semibold">Descuento profesional (−{proDiscount}%)</span>
                    <span className="font-semibold">−{fmt(totalWithIva * (proDiscount / 100))}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
                  <span>Total estimado</span>
                  <span className="text-red-700">
                    {isProfessional ? fmt(totalWithIva * (1 - proDiscount / 100)) : fmt(totalWithIva)}
                  </span>
                </div>
                <p className="text-xs text-gray-400">* Precio orientativo. El técnico confirmará el precio definitivo.</p>
              </div>

              {/* Botones */}
              <div className="mt-5 space-y-2">
                {step === 'cart' && (
                  <>
                    {user ? (
                      <button onClick={() => setStep('checkout')}
                        className="w-full py-3.5 bg-red-700 hover:bg-red-800 text-white font-bold text-sm rounded-xl transition-colors">
                        {isProfessional ? 'Solicitar pedido →' : 'Solicitar cita de medición →'}
                      </button>
                    ) : (
                      <Link to="/login"
                        className="block w-full py-3.5 bg-red-700 hover:bg-red-800 text-white font-bold text-sm rounded-xl transition-colors text-center">
                        Inicia sesión para continuar
                      </Link>
                    )}
                    <Link to="/configurador"
                      className="block w-full py-3 text-center text-sm text-gray-500 hover:text-gray-700 transition-colors">
                      Seguir configurando
                    </Link>
                  </>
                )}

                {step === 'checkout' && (
                  <>
                    <button onClick={handleSubmit} disabled={loading}
                      className="w-full py-3.5 bg-red-700 hover:bg-red-800 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                      {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      {loading ? 'Enviando...' : isProfessional ? 'Confirmar pedido' : 'Confirmar solicitud de cita'}
                    </button>
                    <button onClick={() => { setStep('cart'); setError('') }}
                      className="w-full py-3 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                      ← Volver a la cesta
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}