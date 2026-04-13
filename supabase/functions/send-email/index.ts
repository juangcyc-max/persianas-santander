import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const ADMIN_EMAIL    = 'adminpersianassantander@gmail.com'
const FROM           = 'Persianas Santander <noreply@persianassantander.es>'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BLIND_LABELS: Record<string, string> = {
  laminada:                  'Paño Laminado',
  autoblocante:              'Paño Autoblocante',
  blocking:                  'Bloqueante',
  sistema_mini_pvc:          'Sistema Mini PVC',
  sistema_mini_aluminio:     'Sistema Mini Aluminio',
  sistema_mini_autoblocante: 'Sistema Mini Autoblocante',
  solo_guias:                'Solo Guías',
  solo_motor:                'Solo Motor',
  motor_mas_guias:           'Motor + Guías',
  pano_mas_guias:            'Paño + Guías',
}

const SISTEMAS    = ['sistema_mini_pvc', 'sistema_mini_aluminio', 'sistema_mini_autoblocante']
const PANOS       = ['laminada', 'autoblocante', 'blocking', 'pano_mas_guias']
const GUIDE_PRODS = ['solo_guias', 'motor_mas_guias']

function blindLabel(type: string) {
  return BLIND_LABELS[type] ?? type ?? 'Persiana'
}

function itemColor(i: any) {
  if (SISTEMAS.includes(i.blind_type))    return `Cajón: ${i.box_color_name ?? '—'} · Lamas: ${i.slat_color_name ?? '—'}`
  if (PANOS.includes(i.blind_type))       return `Lamas: ${i.slat_color_name ?? '—'}`
  if (GUIDE_PRODS.includes(i.blind_type)) return `Guías: ${i.slat_color_name ?? '—'}`
  return ''
}

function itemMedidas(i: any) {
  if (i.blind_type === 'solo_motor')           return ''
  if (GUIDE_PRODS.includes(i.blind_type))      return `${i.height ?? '—'} mm`
  return `${i.width ?? '—'}×${i.height ?? '—'} mm`
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
}

function layout(body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:20px;background:#f4f4f5;font-family:Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
      <div style="background:#b91c1c;padding:24px 32px">
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:bold;letter-spacing:-.3px">Persianas Santander</h1>
      </div>
      <div style="padding:32px">${body}</div>
      <div style="background:#f9f9f9;padding:14px 32px;border-top:1px solid #e5e7eb">
        <p style="color:#9ca3af;font-size:12px;margin:0">Email automático — Persianas Santander</p>
      </div>
    </div>
  </body></html>`
}

async function send(
  to: string | string[],
  subject: string,
  html: string,
  attachments?: Array<{ filename: string; content: string }>,
) {
  const body: Record<string, unknown> = {
    from: FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  }
  if (attachments?.length) body.attachments = attachments
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.message ?? 'Error Resend')
  return json
}

// ── Plantillas ──────────────────────────────────────────────────────────────

function tplNuevoPedido(d: any) {
  const items = (d.items ?? []).map((i: any) => {
    const medidas = itemMedidas(i)
    const color   = itemColor(i)
    return `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;font-size:14px">
        ${blindLabel(i.blind_type)}${medidas ? ` · ${medidas}` : ''}${i.mechanism ? ` · ${i.mechanism}` : ''}<br>
        ${color ? `<span style="color:#9ca3af;font-size:12px">${color}</span>` : ''}
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:bold;font-size:14px">${fmt(i.estimated_price)}</td>
    </tr>`
  }).join('')

  const citaBlock = d.installacion === false
    ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:14px;margin:16px 0">
        <strong style="color:#92400e">Sin instalación — Solo material</strong><br>
        <span style="color:#78350f;font-size:13px">El cliente debe pagar en 24-48 horas</span>
       </div>`
    : d.user_type === 'professional'
    ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:14px;margin:16px 0">
        <strong style="color:#1e40af">Pedido profesional</strong><br>
        <span style="color:#1d4ed8;font-size:13px">Instalación propia</span>
       </div>`
    : `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:14px;margin:16px 0">
        <strong style="color:#166534">Cita de medición</strong><br>
        <span style="color:#15803d;font-size:13px">
          Dirección: ${d.address}<br>Teléfono: ${d.phone}<br>
          Fecha preferida: ${d.preferred_date} a las ${d.preferred_time}
        </span>
       </div>`

  return layout(`
    <h2 style="color:#111;margin-top:0;font-size:18px">🛒 Nuevo pedido recibido</h2>
    <p style="color:#6b7280;font-size:14px;margin-top:0">
      <strong>${d.user_email}</strong> &nbsp;·&nbsp;
      ${d.user_type === 'professional' ? 'Profesional' : 'Particular'}
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">${items}
      <tr>
        <td style="padding:12px 8px;font-weight:bold">Total con IVA</td>
        <td style="padding:12px 8px;text-align:right;font-weight:bold;color:#b91c1c;font-size:16px">${fmt(d.total_with_iva)}</td>
      </tr>
    </table>
    ${citaBlock}
  `)
}

function tplConfirmacionCliente(d: any) {
  const sinInst = d.installacion === false
  const isPro   = d.user_type === 'professional'

  const detalle = sinInst
    ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:16px;margin:16px 0">
        <strong style="color:#92400e">Aviso de pago</strong><br>
        <span style="color:#78350f;font-size:13px">El pago deberá realizarse en un plazo de <strong>24-48 horas</strong>.<br>Formas de pago: Bizum, transferencia bancaria o efectivo.</span>
       </div>`
    : isPro
    ? `<p style="color:#374151;font-size:14px">Nos pondremos en contacto contigo para coordinar la entrega del material.</p>`
    : `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px;margin:16px 0">
        <strong style="color:#166534">Datos de tu solicitud de cita</strong><br>
        <span style="color:#15803d;font-size:13px">
          Dirección: ${d.address}<br>Fecha preferida: ${d.preferred_date} a las ${d.preferred_time}
        </span>
       </div>`

  return layout(`
    <h2 style="color:#111;margin-top:0;font-size:18px">¡Pedido recibido correctamente!</h2>
    <p style="color:#374151;font-size:14px">Hemos recibido tu pedido y lo estamos procesando.</p>
    ${detalle}
    <p style="color:#9ca3af;font-size:13px;margin-top:24px">Puedes consultar el seguimiento en tu área personal en nuestra web.</p>
  `)
}

function tplCambioEstado(d: any) {
  const labels: Record<string,string> = { pending:'Pendiente', confirmed:'Confirmado', completed:'Completado', cancelled:'Cancelado' }
  const colors: Record<string,string> = { pending:'#f59e0b', confirmed:'#3b82f6', completed:'#22c55e', cancelled:'#ef4444' }
  const label = labels[d.status] ?? d.status
  const color = colors[d.status] ?? '#6b7280'

  const citaBlock = d.status === 'confirmed' && d.confirmed_date
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px;margin:16px 0">
        <strong style="color:#166534">Cita confirmada</strong><br>
        <span style="color:#15803d;font-size:13px">${d.confirmed_date} a las ${d.confirmed_time}</span>
       </div>`
    : ''

  const notasBlock = d.admin_notes
    ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:14px;margin:16px 0">
        <strong style="color:#374151;font-size:13px">Nota:</strong>
        <span style="color:#6b7280;font-size:13px"> ${d.admin_notes}</span>
       </div>`
    : ''

  return layout(`
    <h2 style="color:#111;margin-top:0;font-size:18px">Actualización de tu pedido</h2>
    <div style="border-left:4px solid ${color};background:#f9fafb;padding:14px 18px;border-radius:4px;margin:16px 0">
      <span style="font-size:18px;font-weight:bold;color:${color}">${label}</span>
    </div>
    ${citaBlock}
    ${notasBlock}
    <p style="color:#9ca3af;font-size:12px">Pedido #${(d.order_id ?? '').slice(0,8).toUpperCase()}</p>
  `)
}

function tplConfirmacionCita(d: any) {
  return layout(`
    <h2 style="color:#111;margin-top:0;font-size:18px">✅ Cita de medición confirmada</h2>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:16px 0">
      <div style="margin-bottom:10px"><strong style="color:#166534">Fecha:</strong> <span style="color:#374151">${d.confirmed_date}</span></div>
      <div style="margin-bottom:10px"><strong style="color:#166534">Hora:</strong>  <span style="color:#374151">${d.confirmed_time}</span></div>
      <div><strong style="color:#166534">Dirección:</strong> <span style="color:#374151">${d.address}</span></div>
    </div>
    ${d.admin_notes ? `<p style="color:#374151;font-size:14px"><strong>Nota:</strong> ${d.admin_notes}</p>` : ''}
    <p style="color:#374151;font-size:14px">Nuestro técnico se presentará en la dirección indicada. Si necesitas modificar algo, no dudes en contactarnos.</p>
  `)
}

function tplFacturaCliente(d: any) {
  const items = (d.items ?? []).map((i: any) => {
    const medidas = itemMedidas(i)
    const color   = itemColor(i)
    return `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;font-size:14px">
        ${blindLabel(i.blind_type)}${medidas ? ` · ${medidas}` : ''}
        ${color ? `<br><span style="color:#9ca3af;font-size:12px">${color}</span>` : ''}
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:bold;font-size:14px">${fmt(i.estimated_price * (i.quantity ?? 1))}</td>
    </tr>`
  }).join('')

  const pagoBlock = d.payment_status === 'paid'
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:14px;margin:16px 0">
        <strong style="color:#166534">✓ Factura pagada</strong>
       </div>`
    : `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:14px;margin:16px 0">
        <strong style="color:#92400e">Pendiente de pago</strong><br>
        <span style="color:#78350f;font-size:13px">Formas de pago: Bizum, transferencia bancaria o efectivo.<br>
        Contacto: <a href="tel:+34942000000" style="color:#b91c1c">+34 942 00 00 00</a></span>
       </div>`

  return layout(`
    <h2 style="color:#111;margin-top:0;font-size:18px">📄 Tu factura — ${d.invoice_number}</h2>
    <p style="color:#6b7280;font-size:14px;margin-top:0">Pedido #${(d.order_id ?? '').slice(0,8).toUpperCase()}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">${items}
      <tr>
        <td style="padding:12px 8px;font-size:13px;color:#6b7280">Base imponible</td>
        <td style="padding:12px 8px;text-align:right;font-size:13px;color:#6b7280">${fmt(d.total_without_iva)}</td>
      </tr>
      <tr>
        <td style="padding:4px 8px;font-size:13px;color:#6b7280">IVA (21%)</td>
        <td style="padding:4px 8px;text-align:right;font-size:13px;color:#6b7280">${fmt(d.iva)}</td>
      </tr>
      <tr>
        <td style="padding:12px 8px;font-weight:bold;font-size:15px">Total con IVA</td>
        <td style="padding:12px 8px;text-align:right;font-weight:bold;color:#b91c1c;font-size:18px">${fmt(d.total_with_iva)}</td>
      </tr>
    </table>
    ${pagoBlock}
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">
      Persianas Santander · NIF B39476726<br>
      Polígono Nueva Montaña, C/ Isla Oleo, Nave 9 · Santander
    </p>
  `)
}

function tplPresupuestoAdmin(d: any) {
  return layout(`
    <h2 style="color:#111;margin-top:0;font-size:18px">📋 Nueva solicitud de presupuesto</h2>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:16px 0;font-size:14px">
      <div style="margin-bottom:6px"><strong>Nombre:</strong> ${d.customer_name}</div>
      <div style="margin-bottom:6px"><strong>Teléfono:</strong> ${d.customer_phone}</div>
      <div style="margin-bottom:6px"><strong>Email:</strong> ${d.customer_email}</div>
      ${d.customer_address ? `<div><strong>Dirección:</strong> ${d.customer_address}</div>` : ''}
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:16px 0;font-size:14px">
      <strong>Configuración</strong><br><br>
      Tipo: ${d.blind_type} · Mecanismo: ${d.mechanism}<br>
      Medidas: ${d.width} × ${d.height} mm<br>
      Caja: ${d.box_color} · Lamas: ${d.slat_color}<br>
      <strong style="color:#b91c1c">Precio estimado: ${d.estimated_price}</strong>
    </div>
  `)
}

function tplPresupuestoCliente(d: any) {
  return layout(`
    <h2 style="color:#111;margin-top:0;font-size:18px">Tu presupuesto de Persianas Santander</h2>
    <p style="color:#374151;font-size:14px">Hola <strong>${d.customer_name}</strong>, hemos recibido tu solicitud de presupuesto.</p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:16px 0;font-size:14px">
      Tipo: ${d.blind_type} · Mecanismo: ${d.mechanism}<br>
      Medidas: ${d.width} × ${d.height} mm<br>
      Caja: ${d.box_color} · Lamas: ${d.slat_color}
    </div>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;margin:16px 0;text-align:center">
      <div style="font-size:28px;font-weight:bold;color:#b91c1c">${d.estimated_price}</div>
      <div style="color:#6b7280;font-size:13px;margin-top:4px">Precio estimado (IVA incluido)</div>
    </div>
    <p style="color:#374151;font-size:14px">Nos pondremos en contacto contigo a la mayor brevedad para confirmar los detalles.</p>
  `)
}

// ── Servidor ────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { type, data } = await req.json()

    switch (type) {
      case 'new_order':
        await send(ADMIN_EMAIL, `Nuevo pedido — ${data.user_email}`, tplNuevoPedido(data))
        break

      case 'order_confirmation':
        await send(data.user_email, 'Hemos recibido tu pedido — Persianas Santander', tplConfirmacionCliente(data))
        break

      case 'status_change':
        await send(data.user_email, `Tu pedido está ${data.status_label ?? data.status} — Persianas Santander`, tplCambioEstado(data))
        break

      case 'appointment_confirmation':
        await send(data.user_email, 'Cita de medición confirmada — Persianas Santander', tplConfirmacionCita(data))
        break

      case 'send_invoice': {
        const attachments = data.pdf_base64
          ? [{ filename: data.pdf_filename ?? `Factura_${data.invoice_number}.pdf`, content: data.pdf_base64, content_type: 'application/pdf' }]
          : undefined
        console.log('[send_invoice] adjunto:', attachments ? `${data.pdf_filename} (${data.pdf_base64?.length ?? 0} chars)` : 'sin adjunto')
        await send(data.user_email, `Tu factura ${data.invoice_number} — Persianas Santander`, tplFacturaCliente(data), attachments)
        break
      }

      case 'budget_request':
        await Promise.all([
          send(ADMIN_EMAIL, `Nueva solicitud de presupuesto — ${data.customer_name}`, tplPresupuestoAdmin(data)),
          data.customer_email
            ? send(data.customer_email, 'Tu presupuesto de Persianas Santander', tplPresupuestoCliente(data))
            : Promise.resolve(),
        ])
        break

      default:
        throw new Error(`Tipo desconocido: ${type}`)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('send-email error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
