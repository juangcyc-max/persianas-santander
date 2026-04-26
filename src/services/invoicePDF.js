import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

// ── PALETA ────────────────────────────────────────────────────────────────
const C = {
  red:      [180, 20, 25],
  dark:     [20,  20, 20],
  mid:      [90,  90, 90],
  light:    [160, 160, 160],
  grayBg:   [247, 247, 247],
  white:    [255, 255, 255],
  green:    [22,  163, 74],
  greenBg:  [236, 253, 245],
  amber:    [161, 98,  7],
  amberBg:  [254, 249, 230],
  border:   [225, 225, 225],
}

// ── HELPERS ───────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0)

const fmtDate = (d) =>
  new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image()
  img.onload  = () => resolve(img)
  img.onerror = () => resolve(null)
  img.src = src
})

/** Etiqueta de sección: barra roja lateral + texto gris uppercase */
function label(doc, x, y, text, color = C.red) {
  doc.setFillColor(...color)
  doc.rect(x, y - 4.5, 2, 6, 'F')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.light)
  doc.text(text.toUpperCase(), x + 5, y)
}

// ── GENERADOR PRINCIPAL ───────────────────────────────────────────────────
export async function generateInvoicePDF(invoice, order = {}, empresa = null, { returnBase64 = false } = {}) {
  const doc  = new jsPDF()
  const W    = doc.internal.pageSize.width   // 210
  const H    = doc.internal.pageSize.height  // 297
  const ML   = 14
  const MR   = 14
  const CW   = W - ML - MR                  // 182
  const isPaid     = invoice.payment_status === 'paid'
  const isProforma = invoice.invoice_number?.startsWith('PRO-')

  const logoImg = await loadImage('/persianassantanderlogo.png')

  // ── CABECERA ──────────────────────────────────────────────────────────
  doc.setFillColor(...C.red)
  doc.rect(0, 0, W, 32, 'F')

  // Línea de acento bajo la cabecera
  doc.setFillColor(210, 28, 33)
  doc.rect(0, 32, W, 1.5, 'F')

  // Título
  doc.setTextColor(...C.white)
  doc.setFontSize(isProforma ? 16 : 22)
  doc.setFont('helvetica', 'bold')
  doc.text(isProforma ? 'FACTURA PROFORMA' : 'FACTURA', ML, 22)

  // Número y fecha (derecha)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text(invoice.invoice_number,              W - MR, 13, { align: 'right' })
  doc.text(fmtDate(invoice.created_at),         W - MR, 22, { align: 'right' })

  // Logo
  if (logoImg && logoImg.naturalWidth > 0) {
    doc.setFillColor(...C.white)
    doc.roundedRect(W - 52, 3, 38, 26, 2, 2, 'F')
    try { doc.addImage(logoImg, 'PNG', W - 51, 4, 36, 24) } catch {}
  }

  // ── BADGE ESTADO ──────────────────────────────────────────────────────
  const bBg   = isPaid ? C.greenBg : C.amberBg
  const bTxt  = isPaid ? C.green   : C.amber
  const bText = isPaid ? 'PAGADA' : 'PENDIENTE DE PAGO'
  const bW    = isPaid ? 34 : 58

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')

  if (isProforma) {
    const pW = 74
    doc.setFillColor(219, 234, 254)
    doc.roundedRect(ML, 38, pW, 9, 2, 2, 'F')
    doc.setTextColor(29, 78, 216)
    doc.text('PROFORMA · SUJETA A MEDICIÓN', ML + pW / 2, 43.8, { align: 'center' })
    doc.setFillColor(...bBg)
    doc.roundedRect(ML + pW + 4, 38, bW, 9, 2, 2, 'F')
    doc.setTextColor(...bTxt)
    doc.text(bText, ML + pW + 4 + bW / 2, 43.8, { align: 'center' })
  } else {
    doc.setFillColor(...bBg)
    doc.roundedRect(ML, 38, bW, 9, 2, 2, 'F')
    doc.setTextColor(...bTxt)
    doc.text(bText, ML + bW / 2, 43.8, { align: 'center' })
  }

  let y = 55

  // ── EMISOR / CLIENTE ──────────────────────────────────────────────────
  const halfW = (CW - 5) / 2
  const col2X = ML + halfW + 5

  // Emisor
  doc.setFillColor(...C.grayBg)
  doc.roundedRect(ML, y, halfW, 56, 3, 3, 'F')
  label(doc, ML + 6, y + 9, 'Emisor')
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.dark)
  doc.text('Persianas Santander S.L.', ML + 6, y + 19)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...C.mid)
  ;[
    'NIF: B39476726',
    'C/ Isla Oleo, Nave 9',
    'Pol. Nueva Montaña, 39011 Santander',
    'Tel. 942 00 00 00',
    'info@persianassantander.com',
  ].forEach((l, i) => doc.text(l, ML + 6, y + 27 + i * 6))

  // Cliente
  doc.setFillColor(...C.grayBg)
  doc.roundedRect(col2X, y, halfW, 56, 3, 3, 'F')
  label(doc, col2X + 6, y + 9, 'Cliente')

  if (empresa) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.dark)
    doc.text(empresa.razon_social || '—', col2X + 6, y + 19, { maxWidth: halfW - 10 })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...C.mid)
    const loc = [empresa.codigo_postal, empresa.ciudad, empresa.provincia].filter(Boolean).join(' ')
    ;[
      `CIF/NIF: ${empresa.cif_nif || '—'}`,
      empresa.direccion_fiscal || '—',
      loc || '—',
      empresa.telefono || '—',
      empresa.email_facturacion || '—',
    ].forEach((l, i) => doc.text(l, col2X + 6, y + 27 + i * 6))
  } else {
    const bd   = order?.billing_data
    const name = bd
      ? `${bd.nombre ?? ''} ${bd.apellidos ?? ''}`.trim()
      : (order?.profiles?.email || '—')
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.dark)
    doc.text(name || '—', col2X + 6, y + 19, { maxWidth: halfW - 10 })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...C.mid)
    if (bd) {
      ;[
        bd.dni_nif ? `DNI/NIF: ${bd.dni_nif}` : null,
        bd.direccion || null,
        [bd.codigo_postal, bd.ciudad].filter(Boolean).join(' ') || null,
        order?.phone || null,
        bd.email || order?.profiles?.email || null,
      ].filter(Boolean).forEach((l, i) => doc.text(l, col2X + 6, y + 27 + i * 6))
    } else {
      if (order?.address) doc.text(order.address, col2X + 6, y + 27)
      if (order?.phone)   doc.text(order.phone,   col2X + 6, y + 33)
    }
  }

  y += 64

  // ── TABLA PRODUCTOS ───────────────────────────────────────────────────
  const items = order?.items ?? invoice?.items ?? []
  const BLIND_LABELS_INV = {'laminada':'Paño Laminado','autoblocante':'Paño Autoblocante','blocking':'Bloqueante','sistema_mini_cajon_pvc':'Sistema Mini Cajón PVC','sistema_mini_cajon_aluminio':'Sistema Mini Cajón Aluminio','sistema_mini_autoblocante':'Sistema Mini Autoblocante','solo_guias':'Solo Guías','solo_motor':'Solo Motor','mosquitera_enrollable':'Mosquitera Enrollable','sistema_mini_pvc':'Sistema Mini PVC','sistema_mini_aluminio':'Sistema Mini Aluminio','motor_mas_guias':'Motor + Guías','pano_mas_guias':'Paño + Guías','normal':'Estándar'}
  const SISTEMAS_INV     = ['sistema_mini_cajon_pvc','sistema_mini_cajon_aluminio','sistema_mini_autoblocante','sistema_mini_pvc','sistema_mini_aluminio']
  const PANOS_INV        = ['laminada','autoblocante','blocking','mosquitera_enrollable','pano_mas_guias']
  const GUIDE_PROD_INV   = ['solo_guias','motor_mas_guias']

  const getMedidas = (i) => {
    if (i.blind_type === 'solo_motor') return '—'
    if (GUIDE_PROD_INV.includes(i.blind_type)) return `${i.height ?? '—'} mm`
    return `${i.width ?? '—'}×${i.height ?? '—'} mm`
  }
  const getColores = (i) => {
    if (SISTEMAS_INV.includes(i.blind_type))    return `Cajón: ${i.box_color_name ?? '—'}\nLamas: ${i.slat_color_name ?? '—'}`
    if (PANOS_INV.includes(i.blind_type))       return `Lamas: ${i.slat_color_name ?? '—'}`
    if (GUIDE_PROD_INV.includes(i.blind_type))  return `Guías: ${i.slat_color_name ?? '—'}`
    return '—'
  }

  const tableData = items.length > 0
    ? items.map(i => [
        `${BLIND_LABELS_INV[i.blind_type] ?? i.blind_type ?? 'Persiana'}${(i.quantity ?? 1) > 1 ? ` ×${i.quantity}` : ''}`,
        getMedidas(i),
        i.mechanism ?? '—',
        getColores(i),
        fmt(i.estimated_price * (i.quantity ?? 1)),
      ])
    : [['Sin detalle de productos', '', '', '', fmt(invoice.total_with_iva)]]

  autoTable(doc, {
    startY: y,
    head: [['Descripción', 'Medidas', 'Mecanismo', 'Colores', 'Importe']],
    body: tableData,
    headStyles: {
      fillColor: C.dark,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    },
    bodyStyles: {
      fontSize: 8.5,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      textColor: C.dark,
      overflow: 'linebreak',
    },
    alternateRowStyles: { fillColor: C.grayBg },
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 38 },
      4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: ML, right: MR },
  })

  y = doc.lastAutoTable.finalY + 12

  if (y + 75 > H - 22) { doc.addPage(); y = 22 }

  // ── TOTALES ───────────────────────────────────────────────────────────
  const totalNoIva  = Number(invoice.total_without_iva || 0)
  const iva         = Number(invoice.iva || 0)
  const total       = Number(invoice.total_with_iva || 0)
  const isPro       = order?.user_type === 'professional'
  const proDiscount = invoice.pro_discount ?? null

  const boxW = 84
  const boxX = W - MR - boxW

  // Nota de pago (izquierda)
  const noteW = CW - boxW - 6
  const noteH = 22
  if (isProforma) {
    doc.setFillColor(219, 234, 254)
    doc.roundedRect(ML, y, noteW, noteH, 3, 3, 'F')
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(29, 78, 216)
    doc.text('Importe provisional', ML + 6, y + 8)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text('Se actualizará con el precio definitivo\ntras la visita de medición.', ML + 6, y + 15, { maxWidth: noteW - 10 })
  } else {
    doc.setFillColor(...(isPaid ? C.greenBg : C.amberBg))
    doc.roundedRect(ML, y, noteW, noteH, 3, 3, 'F')
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...(isPaid ? C.green : C.amber))
    doc.text(isPaid ? 'Pago recibido' : 'Pendiente de pago', ML + 6, y + 8)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    const noteBody = isPaid
      ? 'Gracias por confiar en Persianas Santander.'
      : 'Realiza la transferencia a la cuenta\nindicada por la empresa.'
    doc.text(noteBody, ML + 6, y + 15, { maxWidth: noteW - 10 })
  }

  // Caja de totales (derecha)
  const proRows = isPro && proDiscount ? 2 : 0
  const grayH   = 9 + (2 + proRows) * 8 + 5
  doc.setFillColor(...C.grayBg)
  doc.roundedRect(boxX, y, boxW, grayH, 3, 3, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...C.mid)

  let ty = y + 9
  if (isPro && proDiscount) {
    const tarifaGeneral = totalNoIva / (1 - proDiscount / 100)
    const descuentoAmt  = tarifaGeneral - totalNoIva
    doc.text('Tarifa general',                    boxX + 6, ty)
    doc.text(fmt(tarifaGeneral),                  boxX + boxW - 5, ty, { align: 'right' })
    ty += 8
    doc.setTextColor(...C.green)
    doc.text(`Dto. profesional -${proDiscount}%`,  boxX + 6, ty)
    doc.text(`-${fmt(descuentoAmt)}`,             boxX + boxW - 5, ty, { align: 'right' })
    ty += 8
    doc.setTextColor(...C.mid)
  }
  doc.text('Base imponible', boxX + 6, ty)
  doc.text(fmt(totalNoIva),  boxX + boxW - 5, ty, { align: 'right' })
  ty += 8
  doc.text('IVA (21%)',      boxX + 6, ty)
  doc.text(fmt(iva),         boxX + boxW - 5, ty, { align: 'right' })
  ty += 5

  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.3)
  doc.line(boxX + 4, ty, boxX + boxW - 4, ty)
  ty += 5

  doc.setFillColor(...C.red)
  doc.roundedRect(boxX, ty, boxW, 13, 2, 2, 'F')
  doc.setTextColor(...C.white)
  doc.setFontSize(11.5)
  doc.setFont('helvetica', 'bold')
  doc.text(`TOTAL  ${fmt(total)}`, boxX + boxW / 2, ty + 9, { align: 'center' })

  y = ty + 20

  // ── CONDICIONES ───────────────────────────────────────────────────────
  if (y + 36 > H - 22) { doc.addPage(); y = 22 }

  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.2)
  doc.line(ML, y, W - MR, y)
  y += 8

  label(doc, ML, y + 4, 'Condiciones generales')
  y += 11

  const conditions = isProforma ? [
    'DOCUMENTO PROVISIONAL — no tiene validez como factura definitiva.',
    'El precio final se confirmará tras la visita de medición y se emitirá la factura definitiva.',
    'Garantía: 2 años en mecanismos · 5 años en lamas de aluminio.',
    'Cualquier reclamación deberá realizarse en un plazo máximo de 48 h tras la instalación.',
  ] : [
    'Precio definitivo sujeto a verificación de medidas en visita técnica.',
    'Garantía: 2 años en mecanismos · 5 años en lamas de aluminio.',
    'Cualquier reclamación deberá realizarse en un plazo máximo de 48 h tras la recepción.',
    'En caso de devolución, los artículos deben estar en perfecto estado y en su embalaje original.',
  ]
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...C.light)
  conditions.forEach((c, i) => {
    doc.text(`· ${c}`, ML, y + i * 6)
  })

  // ── PIE (todas las páginas) ───────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFillColor(...C.grayBg)
    doc.rect(0, H - 14, W, 14, 'F')
    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.2)
    doc.line(0, H - 14, W, H - 14)
    doc.setTextColor(...C.light)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.text(
      'Persianas Santander S.L.  ·  NIF: B39476726  ·  C/ Isla Oleo, Nave 9 - Pol. Nueva Montaña, 39011 Santander',
      W / 2, H - 8, { align: 'center' }
    )
    doc.text(
      `942 00 00 00  ·  info@persianassantander.com  ·  www.persianassantander.com  ·  Pág. ${p}/${pages}`,
      W / 2, H - 3.5, { align: 'center' }
    )
  }

  if (returnBase64) {
    return doc.output('datauristring').split(',')[1]
  }
  const prefix = isProforma ? 'FacturaProforma' : 'Factura'
  doc.save(`${prefix}_${invoice.invoice_number}.pdf`)
}
