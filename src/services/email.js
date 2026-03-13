import emailjs from '@emailjs/browser'

// Credenciales de EmailJS
const EMAILJS_SERVICE_ID = 'service_s8q5ap6'
const EMAILJS_TEMPLATE_ID = 'template_8vz5fpl'
const EMAILJS_PUBLIC_KEY = 'ZMxKp_VCJFu3gDRf8'

export async function sendBudgetEmail(customerData, configuration) {

  const templateParams = {
    customer_name: customerData?.name || '',
    customer_phone: customerData?.phone || '',
    customer_email: customerData?.email || '',
    customer_address: customerData?.address || '',

    blind_type: configuration?.blindType || '',
    mechanism: configuration?.mechanism || '',
    orientation: configuration?.orientation || '',
    motor_type: configuration?.motorType || '',
    slat_type: configuration?.slatType || '',

    width: configuration?.width || '',
    height: configuration?.height || '',
    depth: configuration?.depth || '',

    box_color: configuration?.boxColorName || '',
    slat_color: configuration?.slatColorName || '',

    estimated_price: configuration?.estimatedPrice
      ? configuration.estimatedPrice.toFixed(2)
      : '0.00',

    date: new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  try {

    console.log('📨 Enviando email con parámetros:', templateParams)

    const result = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    )

    console.log('✅ Email enviado correctamente:', result)

    return {
      success: true,
      data: result
    }

  } catch (error) {

    console.error('❌ Error enviando email:', error)

    return {
      success: false,
      error: error?.text || error?.message || 'Error desconocido'
    }

  }
}