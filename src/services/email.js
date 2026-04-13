import { supabase } from './supabase/client'

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
export function notifyStatusChange({ userEmail, orderId, status, statusLabel, confirmedDate, confirmedTime }) {
  return callSendEmail('status_change', {
    user_email:     userEmail,
    order_id:       orderId,
    status,
    status_label:   statusLabel,
    confirmed_date: confirmedDate,
    confirmed_time: confirmedTime,
  })
}

/** Confirma al cliente la cita de medición */
export function confirmAppointment({ userEmail, confirmedDate, confirmedTime, address }) {
  return callSendEmail('appointment_confirmation', {
    user_email:     userEmail,
    confirmed_date: confirmedDate,
    confirmed_time: confirmedTime,
    address,
  })
}

/** Envía la factura al cliente por email */
export function sendInvoiceEmail({ userEmail, invoice, orderId, items, pdfBase64 }) {
  return callSendEmail('send_invoice', {
    user_email:        userEmail,
    order_id:          orderId,
    invoice_number:    invoice.invoice_number,
    total_without_iva: invoice.total_without_iva,
    iva:               invoice.iva,
    total_with_iva:    invoice.total_with_iva,
    payment_status:    invoice.payment_status,
    items:             items ?? [],
    pdf_base64:        pdfBase64 ?? null,
    pdf_filename:      `Factura_${invoice.invoice_number}.pdf`,
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
