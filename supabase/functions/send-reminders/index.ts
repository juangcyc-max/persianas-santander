import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_KEY   = Deno.env.get('RESEND_API_KEY')!
const ADMIN_EMAIL  = 'adminpersianassantander@gmail.com'
const FROM         = 'Persianas Santander <noreply@persianassantander.es>'

// Timestamp hace N horas
function hoursAgo(n: number) {
  return new Date(Date.now() - n * 3_600_000).toISOString()
}

// Query REST de Supabase con rango de fechas
async function dbGet(table: string, filters: Record<string, string>, select = '*') {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`)
  url.searchParams.set('select', select)
  for (const [k, v] of Object.entries(filters)) {
    url.searchParams.append(k, v)
  }
  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
  })
  return r.json()
}

// Email del usuario desde auth.users
async function getUserEmail(userId: string): Promise<string | null> {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
  })
  const d = await r.json()
  return d?.email ?? null
}

// Enviar email via Resend
async function send(to: string, subject: string, html: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  })
  if (!r.ok) {
    const err = await r.json()
    console.error('Resend error:', err)
  }
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
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:bold">Persianas Santander</h1>
      </div>
      <div style="padding:32px">${body}</div>
      <div style="background:#f9f9f9;padding:14px 32px;border-top:1px solid #e5e7eb">
        <p style="color:#9ca3af;font-size:12px;margin:0">Email automático — Persianas Santander</p>
      </div>
    </div>
  </body></html>`
}

// ── Plantillas ───────────────────────────────────────────────────────────────

function tplPagoRecordatorio(inv: any) {
  return layout(`
    <h2 style="color:#111;margin-top:0;font-size:18px">⏰ Recuerda: tienes un pago pendiente</h2>
    <p style="color:#374151;font-size:14px">
      Tu factura <strong>${inv.invoice_number}</strong> lleva más de 24 horas pendiente de pago.
    </p>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:20px;margin:16px 0;text-align:center">
      <div style="font-size:28px;font-weight:bold;color:#b91c1c">${fmt(inv.total_with_iva)}</div>
      <div style="color:#6b7280;font-size:13px;margin-top:4px">Total con IVA</div>
    </div>
    <p style="color:#374151;font-size:14px">
      Formas de pago aceptadas:<br>
      <strong>Bizum · Transferencia bancaria · Efectivo</strong>
    </p>
    <p style="color:#374151;font-size:14px">
      ¿Tienes alguna duda? Contáctanos:<br>
      <a href="tel:+34942000000" style="color:#b91c1c">+34 942 00 00 00</a> ·
      <a href="mailto:${ADMIN_EMAIL}" style="color:#b91c1c">${ADMIN_EMAIL}</a>
    </p>
  `)
}

function tplAdminPedidosPendientes(orders: any[]) {
  const rows = orders.map((o: any) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;font-size:14px">
        #${(o.id ?? '').slice(0, 8).toUpperCase()}<br>
        <span style="color:#9ca3af;font-size:12px">${new Date(o.created_at).toLocaleDateString('es-ES')}</span>
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151">
        ${o.user_type === 'professional' ? 'Profesional' : 'Particular'}
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:bold;font-size:14px;color:#b91c1c">
        ${fmt(o.total_with_iva)}
      </td>
    </tr>
  `).join('')

  return layout(`
    <h2 style="color:#111;margin-top:0;font-size:18px">⚠️ Pedidos pendientes sin confirmar</h2>
    <p style="color:#374151;font-size:14px">
      Los siguientes <strong>${orders.length} pedido(s)</strong> llevan más de 48 horas en estado pendiente:
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb">Pedido</th>
          <th style="text-align:left;padding:8px;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb">Tipo</th>
          <th style="text-align:right;padding:8px;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#9ca3af;font-size:13px">
      Accede al panel de administración para confirmarlos o contactar con los clientes.
    </p>
  `)
}

// ── Servidor ─────────────────────────────────────────────────────────────────

serve(async () => {
  let invoicesCount = 0
  let ordersCount   = 0

  try {
    // 1. Recordatorio de pago: facturas entre 24h y 48h sin pagar
    const invoices: any[] = await dbGet(
      'invoices',
      {
        payment_status: 'eq.pending_payment',
        created_at:     `lt.${hoursAgo(24)}`,
        'created_at':   `gte.${hoursAgo(48)}`,
      },
      '*,orders(user_id)'
    )

    for (const inv of invoices ?? []) {
      const uid   = inv.orders?.user_id
      const email = uid ? await getUserEmail(uid) : null
      if (!email) continue
      await send(
        email,
        'Recuerda: tienes un pago pendiente — Persianas Santander',
        tplPagoRecordatorio(inv)
      )
      invoicesCount++
    }

    // 2. Aviso al admin: pedidos entre 48h y 72h aún pendientes
    const orders: any[] = await dbGet(
      'orders',
      {
        status:      'eq.pending',
        created_at:  `lt.${hoursAgo(48)}`,
        'created_at': `gte.${hoursAgo(72)}`,
      }
    )

    if ((orders ?? []).length > 0) {
      await send(
        ADMIN_EMAIL,
        `⚠️ ${orders.length} pedido(s) llevan más de 48h pendientes — Persianas Santander`,
        tplAdminPedidosPendientes(orders)
      )
      ordersCount = orders.length
    }

  } catch (e) {
    console.error('send-reminders error:', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  console.log(`Reminders sent — invoices: ${invoicesCount}, orders: ${ordersCount}`)
  return new Response(
    JSON.stringify({ ok: true, payment_reminders: invoicesCount, pending_orders: ordersCount }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
