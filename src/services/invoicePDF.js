import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

// ── CONSTANTES DE DISEÑO ──────────────────────────────────────────────────
const COLORS = {
  red:       [180, 20, 25],
  redBg:     [253, 242, 242],
  dark:      [30, 30, 30],
  mid:       [80, 80, 80],
  light:     [150, 150, 150],
  grayBg:    [248, 248, 248],
  white:     [255, 255, 255],
  green:     [22, 163, 74],
  greenBg:   [240, 253, 244],
  amber:     [180, 120, 0],
  amberBg:   [255, 251, 235],
  border:    [220, 220, 220]
}

// ── FORMATTERS & HELPERS ──────────────────────────────────────────────────
const formatCurrency = (amount) => 
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(amount) || 0)

const formatDate = (dateString) => 
  new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dateString))

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = () => resolve(null)
  img.src = src
})

export async function generateInvoicePDF(invoice, order = {}, empresa = null) {
  const doc = new jsPDF()
  const W = doc.internal.pageSize.width
  const H = doc.internal.pageSize.height
  const isPaid = invoice.payment_status === 'paid'

  const logoImg = await loadImage("/persianassantanderlogo.png")

  // ── HEADER ────────────────────────────────────────────────────────────
  doc.setFillColor(...COLORS.red)
  doc.rect(0, 0, W, 28, "F")

  doc.setTextColor(...COLORS.white)
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text("FACTURA", 14, 18)

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(`Nº ${invoice.invoice_number}`, W - 14, 13, { align: "right" })
  doc.text(`Fecha: ${formatDate(invoice.created_at)}`, W - 14, 21, { align: "right" })

  if (logoImg && logoImg.naturalWidth > 0) {
    doc.setFillColor(...COLORS.white)
    doc.roundedRect(W - 54, 2, 40, 24, 2, 2, "F")
    try { doc.addImage(logoImg, "PNG", W - 53, 3, 38, 22) } catch (e) {}
  }

  doc.setFillColor(...COLORS.redBg)
  doc.rect(0, 28, W, 3, "F")

  // ── BADGE ESTADO PAGO (SIN EMOJIS Y MÁS ANCHO) ────────────────────────
  const badgeColor = isPaid ? COLORS.green : COLORS.amber
  const badgeText  = isPaid ? "PAGADA" : "PENDIENTE DE PAGO"
  
  doc.setFillColor(...badgeColor)
  doc.roundedRect(14, 36, 55, 9, 2, 2, "F") // Ancho aumentado a 55
  doc.setTextColor(...COLORS.white)
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.text(badgeText, 41.5, 42, { align: "center" }) // Centro calculado: 14 + (55/2)

  let y = 54

  // ── EMISOR / CLIENTE ──────────────────────────────────────────────────
  const colW = (W - 34) / 2

  doc.setFillColor(...COLORS.grayBg)
  doc.roundedRect(14, y, colW, 52, 3, 3, "F")
  doc.setTextColor(...COLORS.red)
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.text("EMISOR", 20, y + 8)

  doc.setTextColor(...COLORS.dark)
  doc.setFontSize(10)
  doc.text("Persianas Santander S.L.", 20, y + 16)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(...COLORS.mid)
  const emisorLines = [
    "NIF: B39476726",
    "C/ Isla Oleo, Nave 9 - Pol. Nueva Montaña",
    "39011 Santander, Cantabria",
    "942 00 00 00",
    "info@persianassantander.com",
  ]
  emisorLines.forEach((l, i) => doc.text(l, 20, y + 23 + i * 6))

  const cx = 14 + colW + 6
  doc.setFillColor(...COLORS.grayBg)
  doc.roundedRect(cx, y, colW, 52, 3, 3, "F")
  doc.setTextColor(...COLORS.red)
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.text("CLIENTE", cx + 6, y + 8)

  doc.setTextColor(...COLORS.dark)
  if (empresa) {
    doc.setFontSize(10)
    doc.text(empresa.razon_social || "—", cx + 6, y + 16)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...COLORS.mid)
    
    const ubicacion = [empresa.codigo_postal, empresa.ciudad, empresa.provincia].filter(Boolean).join(" ")
    const clienteLines = [
      `CIF/NIF: ${empresa.cif_nif || "—"}`,
      empresa.direccion_fiscal || "—",
      ubicacion || "—",
      empresa.telefono || "—",
      empresa.email_facturacion || "—",
    ]
    clienteLines.forEach((l, i) => doc.text(l, cx + 6, y + 23 + i * 6))
  } else {
    doc.setFontSize(9.5)
    doc.text(order?.profiles?.email || order?.address || "—", cx + 6, y + 16)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...COLORS.mid)
    if (order?.address) doc.text(order.address, cx + 6, y + 23)
    if (order?.phone)   doc.text(order.phone,   cx + 6, y + 30)
  }

  y += 60

  // ── TABLA PRODUCTOS ───────────────────────────────────────────────────
  const items = order?.items ?? invoice?.items ?? []
  
  const tableData = items.length > 0 
    ? items.map(i => [
        `Persiana ${i.blind_type === 'blocking' ? 'bloqueante' : 'estándar'}${(i.quantity ?? 1) > 1 ? ` ×${i.quantity}` : ''}`,
        `${i.width ?? '-'}×${i.height ?? '-'} mm`,
        i.mechanism ?? '—',
        `Caja: ${i.box_color_name ?? '—'}\nLamas: ${i.slat_color_name ?? '—'}`,
        formatCurrency(i.estimated_price * (i.quantity ?? 1))
      ]) 
    : [['Sin detalle de productos', '', '', '', formatCurrency(invoice.total_with_iva)]]

  autoTable(doc, {
    startY: y,
    head: [['Descripción', 'Medidas', 'Mecanismo', 'Colores', 'Importe']],
    body: tableData,
    headStyles: { fillColor: COLORS.dark, textColor: COLORS.white, fontStyle: 'bold', fontSize: 8.5, cellPadding: 3.5 },
    bodyStyles: { fontSize: 8.5, cellPadding: 3.5, textColor: COLORS.dark, overflow: 'linebreak' },
    alternateRowStyles: { fillColor: COLORS.grayBg },
    columnStyles: {
      0: { cellWidth: 56 },
      1: { cellWidth: 26, halign: 'center' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 40 },
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    tableWidth: doc.internal.pageSize.width - 28,
    margin: { left: 14, right: 14 },
  })

  y = doc.lastAutoTable.finalY + 8

  if (y + 60 > H - 20) {
    doc.addPage()
    y = 20
  }

  // ── TOTALES ───────────────────────────────────────────────────────────
  const totalNoIva   = Number(invoice.total_without_iva || 0)
  const iva          = Number(invoice.iva || 0)
  const total        = Number(invoice.total_with_iva || 0)
  const isPro        = order?.user_type === 'professional'
  const proDiscount  = invoice.pro_discount ?? null  // porcentaje entero, e.g. 20

  const boxW = 80
  const boxX = W - 14 - boxW
  // boxH: 9 (padding) + rows + 4 (sep) + 4 (gap) + 11 (total bar) = gray height + 11
  // without pro: 9 + 8 (base) + 4 (iva) + 4 (sep) = 25 → gray height = 25, boxH = 36
  // with pro:    9 + 8 + 8 (tarifa+dto) + 8 (base) + 4 (iva) + 4 (sep) = 41 → gray height = 41, boxH = 52
  const boxH = isPro && proDiscount ? 52 : 36

  doc.setFillColor(...COLORS.grayBg)
  doc.roundedRect(boxX, y, boxW, boxH - 11, 3, 3, "F")

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.mid)

  let ty = y + 9
  if (isPro && proDiscount) {
    const tarifaGeneral = totalNoIva / (1 - proDiscount / 100)
    const descuentoAmt  = tarifaGeneral - totalNoIva
    doc.text(`Tarifa general`,                   boxX + 6, ty); doc.text(formatCurrency(tarifaGeneral), boxX + boxW - 6, ty, { align: "right" }); ty += 8
    doc.setTextColor(...COLORS.green)
    doc.text(`Dto. profesional −${proDiscount}%`, boxX + 6, ty); doc.text(`−${formatCurrency(descuentoAmt)}`,  boxX + boxW - 6, ty, { align: "right" }); ty += 8
    doc.setTextColor(...COLORS.mid)
  }
  doc.text("Base imponible", boxX + 6, ty);   doc.text(formatCurrency(totalNoIva), boxX + boxW - 6, ty,  { align: "right" }); ty += 8
  doc.text("IVA (21%)",      boxX + 6, ty);   doc.text(formatCurrency(iva),        boxX + boxW - 6, ty,  { align: "right" }); ty += 4

  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.line(boxX + 6, ty, boxX + boxW - 6, ty); ty += 4

  doc.setFillColor(...COLORS.red)
  doc.roundedRect(boxX, ty, boxW, 11, 2, 2, "F")
  doc.setTextColor(...COLORS.white)
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text(`TOTAL  ${formatCurrency(total)}`, boxX + boxW / 2, ty + 7.5, { align: "center" })

  // ── NOTA PAGO (CORREGIDA Y CON TEXT WRAP) ─────────────────────────────
  const noteY = y + 8 
  const noteW = W - 34 - boxW // Ancho dinámico para no pisar la caja de totales
  
  doc.setFillColor(...(isPaid ? COLORS.greenBg : COLORS.amberBg))
  doc.roundedRect(14, noteY, noteW, 16, 3, 3, "F") // Alto aumentado ligeramente
  
  doc.setTextColor(...(isPaid ? COLORS.green : COLORS.amber))
  doc.setFontSize(8.5)
  doc.setFont("helvetica", "bold")
  
  const noteText = isPaid 
    ? "Pago recibido. Gracias por confiar en nosotros." 
    : "Pendiente de pago. Por favor realiza la transferencia a la cuenta indicada por la empresa."
  
  // Usamos maxWidth para que salte de línea si es muy largo
  doc.text(noteText, 18, noteY + 7, { maxWidth: noteW - 8 })

  // ── FOOTER ────────────────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFillColor(...COLORS.grayBg)
    doc.rect(0, H - 16, W, 16, "F")
    doc.setDrawColor(...COLORS.border)
    doc.setLineWidth(0.3)
    doc.line(0, H - 16, W, H - 16)
    
    doc.setTextColor(...COLORS.light)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text("Persianas Santander S.L.  ·  NIF: B39476726  ·  C/ Isla Oleo, Nave 9 - Pol. Nueva Montaña, 39011 Santander", W / 2, H - 9,  { align: "center" })
    doc.text("942 00 00 00  ·  info@persianassantander.com  ·  www.persianassantander.com",  W / 2, H - 4, { align: "center" })
  }

  doc.save(`Factura_${invoice.invoice_number}.pdf`)
}