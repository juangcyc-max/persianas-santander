import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase/client'
import { useCart } from '../context/CartContext'
import { sanitizeText } from '../services/sanitize'
import { getProfessionalDiscount, getProfessionalDiscountForUser } from '../services/settings'
import { notifyNewOrder, confirmOrderToClient } from '../services/email'

const HORAS = ['08:00','09:00','10:00','11:00','12:00','13:00','16:00','17:00','18:00','19:00']

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
}

const PRODUCT_LABELS = {
  laminada:                    'Paño Laminado',
  autoblocante:                'Paño Autoblocante',
  blocking:                    'Bloqueante',
  sistema_mini_cajon_pvc:      'Sistema Mini Cajón PVC',
  sistema_mini_cajon_aluminio: 'Sistema Mini Cajón Aluminio',
  sistema_mini_autoblocante:   'Sistema Mini Autoblocante',
  solo_motor:                  'Solo Motor',
  solo_guias:                  'Solo Guías',
  mosquitera_enrollable:       'Mosquitera Enrollable',
  // legacy
  sistema_mini_pvc:            'Sistema Mini PVC',
  sistema_mini_aluminio:       'Sistema Mini Aluminio',
  motor_mas_guias:             'Motor + Guías',
  pano_mas_guias:              'Paño + Guías',
  sistema_mini:                'Sistema Mini Autoblocante',
  normal:                      'Paño Estándar',
}
const MOTOR_LABELS  = { mecanico: 'Mecánico', mando_distancia: 'Mando a distancia' }
const GUIDE_LABELS  = { v25: 'Guía V25 (5 €/ml)', h25: 'Guía H25 (7 €/ml)', none: 'Sin guías' }
const MECH_LABELS   = { muelle: 'Muelle', cinta: 'Cinta', motor: 'Motor' }

// ── Tarjeta de producto en la cesta ──────────────────────────────────────
function CartItem({ item, onRemove }) {
  const config = item.blind_configurations
  const [expanded, setExpanded] = useState(false)
  if (!config) return null

  const type        = config.blind_type
  const isSoloMotor = type === 'solo_motor'
  const isSoloGuias = type === 'solo_guias'
  const isSistema   = ['sistema_mini_cajon_pvc','sistema_mini_cajon_aluminio','sistema_mini_autoblocante','sistema_mini_pvc','sistema_mini_aluminio','sistema_mini'].includes(type)

  const productName = PRODUCT_LABELS[type] ?? type

  let detail1 = ''
  let detail2 = ''
  if (isSoloMotor) {
    detail1 = MOTOR_LABELS[config.motor_type] ?? config.motor_type ?? '—'
  } else if (isSoloGuias) {
    detail1 = GUIDE_LABELS[config.guide_type] ?? config.guide_type ?? '—'
    detail2 = config.height ? `Altura: ${config.height} mm` : ''
  } else {
    detail1 = `${config.width ?? 0} × ${config.height ?? 0} mm · ${MECH_LABELS[config.mechanism] ?? config.mechanism ?? '—'}`
    detail2 = isSistema
      ? `Cajón: ${config.box_color_name ?? '—'} · Lamas: ${config.slat_color_name ?? '—'}`
      : `Color: ${config.slat_color_name ?? '—'}`
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* ── Cabecera colapsable ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-gray-900 truncate">{productName}</span>
          {!expanded && detail1 && (
            <span className="text-xs text-gray-400 truncate hidden sm:inline">· {detail1}</span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-2">
          <span className="font-bold text-gray-900 text-sm">{fmt(config.estimated_price * item.quantity)}</span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Detalle expandido ── */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 flex items-center gap-4">
          <div className="flex-1 min-w-0 space-y-0.5">
            {detail1 && <p className="text-xs text-gray-500">{detail1}</p>}
            {detail2 && <p className="text-xs text-gray-400">{detail2}</p>}
            <p className="text-xs text-gray-400">IVA incl.</p>
          </div>
          <button onClick={() => onRemove(item.id)}
            className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 p-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

// ── CESTA PRINCIPAL ───────────────────────────────────────────────────────
export default function Cart() {
  const { items, totalPrice, totalWithIva, removeFromCart, clearCart, user } = useCart()
  const navigate = useNavigate()
  const isProfessional = user?.user_metadata?.user_type === 'professional'
  const [proDiscount, setProDiscount] = useState(0)

  useEffect(() => {
    if (isProfessional && user?.id) {
      getProfessionalDiscountForUser(user.id).then(setProDiscount)
    } else {
      getProfessionalDiscount().then(setProDiscount)
    }
  }, [user?.id, isProfessional])

  // Si TODOS los items son sin instalación, no hace falta cita
  const sinInstalacion = items.length > 0 && items.every(i => i.blind_configurations?.installacion === false)

  const [step,      setStep]      = useState('cart')   // 'cart' | 'checkout' | 'success'
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [showItems, setShowItems] = useState(false)
  const [showList,  setShowList]  = useState(false)

  // Datos checkout particular
  const [address,  setAddress]  = useState('')
  const [phone,    setPhone]    = useState('')
  const [date,     setDate]     = useState('')
  const [time,     setTime]     = useState('')
  const [notes,    setNotes]    = useState('')

  // Datos de facturación (particulares)
  const [billingNombre,   setBillingNombre]   = useState('')
  const [billingApellidos,setBillingApellidos] = useState('')
  const [billingDni,      setBillingDni]      = useState('')
  const [billingDireccion,setBillingDireccion] = useState('')
  const [billingCp,       setBillingCp]       = useState('')
  const [billingCiudad,   setBillingCiudad]   = useState('')

  // Cargar datos de facturación guardados
  useEffect(() => {
    if (!user?.id || isProfessional) return
    supabase.from('client_data').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        if (data.nombre)        setBillingNombre(data.nombre)
        if (data.apellidos)     setBillingApellidos(data.apellidos)
        if (data.dni_nif)       setBillingDni(data.dni_nif)
        if (data.direccion)     setBillingDireccion(data.direccion)
        if (data.codigo_postal) setBillingCp(data.codigo_postal)
        if (data.ciudad)        setBillingCiudad(data.ciudad)
        if (data.telefono && !phone) setPhone(data.telefono)
      })
  }, [user?.id, isProfessional])

  // Fecha mínima = mañana
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  async function handleSubmit() {
    if (!isProfessional && !sinInstalacion) {
      if (!address.trim()) { setError('La dirección es obligatoria'); return }
      if (!phone.trim())   { setError('El teléfono es obligatorio'); return }
      if (!date)           { setError('Elige un día preferido'); return }
      if (!time)           { setError('Elige una hora preferida'); return }
    }
    if (!isProfessional) {
      if (!billingNombre.trim())    { setError('El nombre es obligatorio'); return }
      if (!billingApellidos.trim()) { setError('Los apellidos son obligatorios'); return }
      if (!billingDni.trim())       { setError('El DNI/NIF es obligatorio'); return }
    }
    setLoading(true)
    setError('')

    try {
      // Guardar/actualizar datos de facturación del cliente particular
      if (!isProfessional) {
        await supabase.from('client_data').upsert({
          user_id:       user.id,
          nombre:        sanitizeText(billingNombre),
          apellidos:     sanitizeText(billingApellidos),
          dni_nif:       sanitizeText(billingDni),
          direccion:     sanitizeText(billingDireccion),
          codigo_postal: sanitizeText(billingCp),
          ciudad:        sanitizeText(billingCiudad),
          telefono:      sanitizeText(phone),
          updated_at:    new Date().toISOString(),
        }, { onConflict: 'user_id' })
      }

      const billingData = !isProfessional ? {
        nombre:        sanitizeText(billingNombre),
        apellidos:     sanitizeText(billingApellidos),
        dni_nif:       sanitizeText(billingDni),
        direccion:     sanitizeText(billingDireccion),
        codigo_postal: sanitizeText(billingCp),
        ciudad:        sanitizeText(billingCiudad),
        email:         user.email,
      } : null

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
          motor_type:       i.blind_configurations?.motor_type,
          guide_type:       i.blind_configurations?.guide_type,
          estimated_price:  i.blind_configurations?.estimated_price,
          box_color_name:   i.blind_configurations?.box_color_name,
          slat_color_name:  i.blind_configurations?.slat_color_name,
        })),
        total_price:    totalWithIva,
        total_with_iva: totalWithIva,
        status:         'pending',
        installacion:   !sinInstalacion,
        address:        (!isProfessional && !sinInstalacion) ? sanitizeText(address) : null,
        phone:          (!isProfessional && !sinInstalacion) ? sanitizeText(phone)   : null,
        preferred_date: (!isProfessional && !sinInstalacion) ? date                  : null,
        preferred_time: (!isProfessional && !sinInstalacion) ? time                  : null,
        notes:          (!isProfessional && !sinInstalacion) ? sanitizeText(notes)   : null,
        billing_data:   billingData,
      }

      const { data: newOrder, error: orderError } = await supabase
        .from('orders').insert(orderData).select().single()
      if (orderError) throw orderError

      // Generar factura automáticamente al crear el pedido
      if (newOrder?.id) {
        const totalSinIva = totalWithIva / 1.21
        const iva         = totalWithIva - totalSinIva
        await supabase.from('invoices').insert({
          order_id:           newOrder.id,
          user_id:            user.id,
          invoice_number:     `FAC-${Date.now().toString().slice(-8)}`,
          payment_status:     'pending_payment',
          total_without_iva:  totalSinIva,
          iva:                iva,
          total_with_iva:     totalWithIva,
          items:              orderData.items,
          pro_discount:       isProfessional ? proDiscount : null,
        })
      }

      // Emails automáticos vía Resend (no bloquean el flujo)
      await Promise.all([
        notifyNewOrder(orderData, user.email),
        confirmOrderToClient(orderData, user.email),
      ])

      await clearCart()
      const destPath = isProfessional
        ? `/panel-profesional?tab=pedidos&new=${newOrder.id}`
        : `/mis-configuraciones?tab=pedidos&new=${newOrder.id}`
      navigate(destPath, { replace: true })
    } catch (err) {
      const code    = err?.code    ? ` [${err.code}]`    : ''
      const details = err?.details ? ` — ${err.details}` : ''
      const hint    = err?.hint    ? ` (${err.hint})`    : ''
      setError(`Error: ${err?.message ?? 'desconocido'}${code}${details}${hint}`)
      console.error('Order error:', JSON.stringify(err))
    } finally {
      setLoading(false)
    }
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
            {step === 'cart' ? 'Mi cesta' : (isProfessional || sinInstalacion) ? 'Confirmar pedido' : 'Solicitar cita de medición'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {step === 'cart'
              ? ''
              : sinInstalacion
              ? 'Solo material — recibirás las persianas fabricadas a medida'
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
                {/* Cabecera colapsable de la lista */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setShowList(s => !s)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left"
                  >
                    <span className="text-sm font-semibold text-gray-700">
                      {items.length} {items.length === 1 ? 'producto' : 'productos'}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-900">{fmt(totalWithIva)}</span>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${showList ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {showList && (
                    <div className="border-t border-gray-100 divide-y divide-gray-100">
                      {items.map(item => (
                        <CartItem key={item.id} item={item} onRemove={removeFromCart} />
                      ))}
                    </div>
                  )}
                </div>
                <Link to="/configurador"
                  className="flex items-center gap-2 text-sm text-red-700 hover:underline font-semibold mt-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Añadir otra persiana
                </Link>
              </>
            )}

            {step === 'checkout' && !isProfessional && sinInstalacion && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Pedido solo material</h3>
                  <p className="text-sm text-gray-500">Recibirás las persianas fabricadas a medida. La instalación corre de tu cuenta.</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-amber-800 mb-1">Aviso de pago</p>
                  <p className="text-sm text-amber-700">El pago deberá realizarse en un plazo de <strong>24-48 horas</strong> tras la confirmación del pedido. Formas de pago: Bizum, transferencia bancaria o efectivo.</p>
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
                )}
              </div>
            )}

            {step === 'checkout' && !isProfessional && !sinInstalacion && (
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

            {step === 'checkout' && !isProfessional && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                <div>
                  <h3 className="font-bold text-gray-900 mb-0.5">Datos de facturación</h3>
                  <p className="text-xs text-gray-400">Se guardarán para futuros pedidos</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre *</label>
                    <input type="text" value={billingNombre} onChange={e => setBillingNombre(e.target.value)}
                      placeholder="Juan"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Apellidos *</label>
                    <input type="text" value={billingApellidos} onChange={e => setBillingApellidos(e.target.value)}
                      placeholder="García López"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">DNI / NIF *</label>
                  <input type="text" value={billingDni} onChange={e => setBillingDni(e.target.value)}
                    placeholder="12345678A"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Dirección de facturación</label>
                  <input type="text" value={billingDireccion} onChange={e => setBillingDireccion(e.target.value)}
                    placeholder="Calle Mayor 1, 2ºA"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Código postal</label>
                    <input type="text" value={billingCp} onChange={e => setBillingCp(e.target.value)}
                      placeholder="39001"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Ciudad</label>
                    <input type="text" value={billingCiudad} onChange={e => setBillingCiudad(e.target.value)}
                      placeholder="Santander"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400" />
                  </div>
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
              <button
                onClick={() => setShowItems(s => !s)}
                className="w-full flex items-center justify-between mb-4"
              >
                <h3 className="font-bold text-gray-900">Resumen del pedido</h3>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${showItems ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showItems && (
                <div className="space-y-2 mb-4">
                  {items.map(i => (
                    <div key={i.id} className="flex justify-between text-sm">
                      <span className="text-gray-600 truncate pr-2">
                        {PRODUCT_LABELS[i.blind_configurations?.blind_type] ?? i.blind_configurations?.blind_type ?? 'Persiana'}
                        {i.quantity > 1 && ` ×${i.quantity}`}
                      </span>
                      <span className="text-gray-900 font-medium flex-shrink-0">
                        {fmt((i.blind_configurations?.estimated_price ?? 0) * i.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

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
                        {isProfessional || sinInstalacion ? 'Confirmar pedido →' : 'Solicitar cita de medición →'}
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
                      {loading ? 'Enviando...' : (isProfessional || sinInstalacion) ? 'Confirmar pedido' : 'Confirmar solicitud de cita'}
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