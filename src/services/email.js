import emailjs from '@emailjs/browser'
import { supabase } from './supabase/client'

// ── EmailJS (presupuestos legacy — sigue funcionando) ─────────────────────
const EMAILJS_SERVICE_ID  = 'service_s8q5ap6'
const EMAILJS_TEMPLATE_ID = 'template_8vz5fpl'
const EMAILJS_PUBLIC_KEY  = 'ZMxKp_VCJFu3gDRf8'

export async function sendBudgetEmail(customerData, configuration) {
  const templateParams = {
    customer_name:    customerData?.name    || '',
    customer_phone:   customerData?.phone   || '',
    customer_email:   customerData?.email   || '',
    customer_address: customerData?.address || '',
    blind_type:       configuration?.blindType     || '',
    mechanism:        configuration?.mechanism     || '',
    orientation:      configuration?.orientation   || '',
    motor_type:       configuration?.motorType     || '',
    slat_type:        configuration?.slatType      || '',
    width:            configuration?.width         || '',
    height:           configuration?.height        || '',
    depth:            configuration?.depth         || '',
    box_color:        configuration?.boxColorName  || '',
    slat_color:       configuration?.slatColorName || '',
    estimated_price:  configuration?.estimatedPrice
      ? configuration.estimatedPrice.toFixed(2) : '0.00',
    date: new Date().toLocaleDateString('es-ES', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }),
  }
  try {
    const result = await emailjs.send(
      EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY
    )
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error?.text || error?.message || 'Error desconocido' }
  }
}

// ── Resend via Supabase Edge Function ─────────────────────────────────────

async function callSendEmail(type, data) {
  try {
    const { error } = await supabase.functions.invoke('send-email', {
      body: { type, data },
    })
    if (error) { console.warn(`[send-email] ${type}:`, error); return { success: false } }
    return { success: true }
  } catch (e) {
    console.warn(`[send-email] ${type}:`, e)
    return { success: false }
  }
}

/** Notifica al admin de un nuevo pedido */
export function notifyNewOrder(orderData, userEmail) {
  return callSendEmail('new_order', { ...orderData, user_email: userEmail })
}

/** Confirma al cliente que hemos recibido su pedido */
export function confirmOrderToClient(orderData, userEmail) {
  return callSendEmail('order_confirmation', { ...orderData, user_email: userEmail })
}

/** Notifica al cliente un cambio de estado */
export function notifyStatusChange({ userEmail, orderId, status, statusLabel, confirmedDate, confirmedTime, adminNotes }) {
  return callSendEmail('status_change', {
    user_email:     userEmail,
    order_id:       orderId,
    status,
    status_label:   statusLabel,
    confirmed_date: confirmedDate,
    confirmed_time: confirmedTime,
    admin_notes:    adminNotes,
  })
}

/** Confirma al cliente la cita de medición */
export function confirmAppointment({ userEmail, confirmedDate, confirmedTime, address, adminNotes }) {
  return callSendEmail('appointment_confirmation', {
    user_email:     userEmail,
    confirmed_date: confirmedDate,
    confirmed_time: confirmedTime,
    address,
    admin_notes:    adminNotes,
  })
}

/** Envía presupuesto a admin y cliente */
export function sendBudgetResend(customerData, configuration) {
  const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
  return callSendEmail('budget_request', {
    customer_name:    customerData?.name    || '',
    customer_phone:   customerData?.phone   || '',
    customer_email:   customerData?.email   || '',
    customer_address: customerData?.address || '',
    blind_type:       configuration?.blindType     || '',
    mechanism:        configuration?.mechanism     || '',
    width:            configuration?.width         || '',
    height:           configuration?.height        || '',
    box_color:        configuration?.boxColorName  || '',
    slat_color:       configuration?.slatColorName || '',
    estimated_price:  fmt(configuration?.estimatedPrice ?? 0),
  })
}
