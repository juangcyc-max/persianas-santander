import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

const RED    = [180, 20, 25]
const RED_BG = [253, 242, 242]
const DARK   = [30, 30, 30]
const MID    = [80, 80, 80]
const LIGHT  = [150, 150, 150]
const GRAY_BG= [248, 248, 248]
const WHITE  = [255, 255, 255]
const GREEN  = [22, 163, 74]
const AMBER  = [180, 120, 0]

export function generateInvoicePDF(invoice, order, empresa = null) {
  const doc  = new jsPDF()
  const W    = doc.internal.pageSize.width
  const H    = doc.internal.pageSize.height
  const isPaid = invoice.payment_status === 'paid'

  const img = new Image()
  img.src   = "/persianassantanderlogo.png"

  const render = () => {

    // ── BANDA SUPERIOR ────────────────────────────────────────────────────
    doc.setFillColor(...RED)
    doc.rect(0, 0, W, 28, "F")

    doc.setTextColor(...WHITE)
    doc.setFontSize(18)
    doc.setFont("helvetica", "bold")
    doc.text("FACTURA", 14, 18)

    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.text(`Nº ${invoice.invoice_number}`, W - 14, 13, { align: "right" })
    doc.text(`Fecha: ${new Date(invoice.created_at).toLocaleDateString("es-ES")}`, W - 14, 21, { align: "right" })

    // Logo
    if (img?.complete && img.naturalWidth > 0) {
      doc.setFillColor(...WHITE)
      doc.roundedRect(W - 54, 2, 40, 24, 2, 2, "F")
      try { doc.addImage(img, "PNG", W - 53, 3, 38, 22) } catch (e) {}
    }

    doc.setFillColor(...RED_BG)
    doc.rect(0, 28, W, 3, "F")

    // ── BADGE ESTADO PAGO ─────────────────────────────────────────────────
    const badgeColor = isPaid ? GREEN : AMBER
    doc.setFillColor(...badgeColor)
    doc.roundedRect(14, 36, 50, 10, 2, 2, "F")
    doc.setTextColor(...WHITE)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text(isPaid ? "✓  PAGADA" : "⏳  PENDIENTE DE PAGO", 39, 42.5, { align: "center" })

    let y = 54

    // ── BLOQUE DOS COLUMNAS: EMISOR / CLIENTE ─────────────────────────────
    const colW = (W - 34) / 2

    // Emisor
    doc.setFillColor(...GRAY_BG)
    doc.roundedRect(14, y, colW, 52, 3, 3, "F")

    doc.setTextColor(...RED)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text("EMISOR", 20, y + 8)

    doc.setTextColor(...DARK)
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text("Persianas Santander S.L.", 20, y + 16)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...MID)
    const emisorLines = [
      "NIF: B00000000",
      "Pol. Industrial Nueva Montaña",
      "39011 Santander, Cantabria",
      "942 00 00 00",
      "info@persianassantander.com",
    ]
    emisorLines.forEach((l, i) => doc.text(l, 20, y + 23 + i * 6))

    // Cliente / Empresa
    const cx = 14 + colW + 6
    doc.setFillColor(...GRAY_BG)
    doc.roundedRect(cx, y, colW, 52, 3, 3, "F")

    doc.setTextColor(...RED)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text("CLIENTE", cx + 6, y + 8)

    if (empresa) {
      doc.setTextColor(...DARK)
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.text(empresa.razon_social || "—", cx + 6, y + 16)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8.5)
      doc.setTextColor(...MID)
      const clienteLines = [
        `CIF/NIF: ${empresa.cif_nif || "—"}`,
        empresa.direccion_fiscal || "—",
        `${empresa.codigo_postal || ""} ${empresa.ciudad || ""}, ${empresa.provincia || ""}`.trim(),
        empresa.telefono || "—",
        empresa.email_facturacion || "—",
      ]
      clienteLines.forEach((l, i) => doc.text(l, cx + 6, y + 23 + i * 6))
    } else {
      doc.setTextColor(...DARK)
      doc.setFontSize(9.5)
      doc.setFont("helvetica", "bold")
      doc.text(order?.profiles?.email || order?.address || "—", cx + 6, y + 16)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8.5)
      doc.setTextColor(...MID)
      if (order?.address) doc.text(order.address, cx + 6, y + 23)
      if (order?.phone)   doc.text(order.phone,   cx + 6, y + 30)
    }

    y += 60

    // ── TABLA PRODUCTOS ───────────────────────────────────────────────────
    const items = order?.items ?? invoice.items ?? []
    autoTable(doc, {
      startY: y,
      head: [['Descripción', 'Medidas', 'Mecanismo', 'Colores', 'Importe']],
      body: items.length > 0 ? items.map(i => [
        `Persiana ${i.blind_type === 'blocking' ? 'bloqueante' : 'estándar'}${(i.quantity ?? 1) > 1 ? ` ×${i.quantity}` : ''}`,
        `${i.width}×${i.height} mm`,
        i.mechanism ?? '—',
        `Caja: ${i.box_color_name ?? '—'}\nLamas: ${i.slat_color_name ?? '—'}`,
        `${Number(i.estimated_price * (i.quantity ?? 1)).toFixed(2)} €`,
      ]) : [['Sin detalle de productos', '', '', '', `${Number(invoice.total_with_iva).toFixed(2)} €`]],
      headStyles: {
        fillColor:   DARK,
        textColor:   WHITE,
        fontStyle:   'bold',
        fontSize:    8.5,
        cellPadding: 4,
      },
      bodyStyles:            { fontSize: 8.5, cellPadding: 4, textColor: DARK },
      alternateRowStyles:    { fillColor: GRAY_BG },
      columnStyles: {
        0: { cellWidth: 58 },
        1: { cellWidth: 28, halign: 'center' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 42 },
        4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    })

    y = doc.lastAutoTable.finalY + 6

    // ── TOTALES ───────────────────────────────────────────────────────────
    const totalNoIva = Number(invoice.total_without_iva || 0)
    const iva        = Number(invoice.iva || 0)
    const total      = Number(invoice.total_with_iva || 0)

    // Caja totales alineada a la derecha
    const boxW = 80, boxX = W - 14 - boxW
    doc.setFillColor(...GRAY_BG)
    doc.roundedRect(boxX, y, boxW, 34, 3, 3, "F")

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...MID)
    doc.text("Base imponible",  boxX + 6, y + 9)
    doc.text(`${totalNoIva.toFixed(2)} €`, boxX + boxW - 6, y + 9,  { align: "right" })
    doc.text("IVA (21%)",       boxX + 6, y + 17)
    doc.text(`${iva.toFixed(2)} €`,        boxX + boxW - 6, y + 17, { align: "right" })

    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.line(boxX + 6, y + 21, boxX + boxW - 6, y + 21)

    doc.setFillColor(...RED)
    doc.roundedRect(boxX, y + 23, boxW, 11, 2, 2, "F")
    doc.setTextColor(...WHITE)
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text(`TOTAL  ${total.toFixed(2)} €`, boxX + boxW / 2, y + 30.5, { align: "center" })

    y += 44

    // ── NOTA PAGO ─────────────────────────────────────────────────────────
    if (!isPaid) {
      doc.setFillColor(255, 251, 235)
      doc.roundedRect(14, y, W - 28, 14, 3, 3, "F")
      doc.setTextColor(...AMBER)
      doc.setFontSize(8.5)
      doc.setFont("helvetica", "bold")
      doc.text("⏳  Pendiente de pago — Por favor realiza la transferencia a la cuenta indicada por la empresa.", 20, y + 9)
    } else {
      doc.setFillColor(240, 253, 244)
      doc.roundedRect(14, y, W - 28, 14, 3, 3, "F")
      doc.setTextColor(...GREEN)
      doc.setFontSize(8.5)
      doc.setFont("helvetica", "bold")
      doc.text("✓  Pago recibido — Gracias por confiar en Persianas Santander.", 20, y + 9)
    }

    // ── FOOTER ────────────────────────────────────────────────────────────
    doc.setFillColor(...GRAY_BG)
    doc.rect(0, H - 16, W, 16, "F")
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.line(0, H - 16, W, H - 16)
    doc.setTextColor(...LIGHT)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text("Persianas Santander S.L.  ·  Polígono Industrial Nueva Montaña, Santander", W / 2, H - 9,  { align: "center" })
    doc.text("942 00 00 00  ·  info@persianassantander.com  ·  www.persianassantander.com",  W / 2, H - 4, { align: "center" })

    doc.save(`Factura_${invoice.invoice_number}.pdf`)
  }

  if (img.complete && img.naturalWidth > 0) { render() }
  else { img.onload = render; img.onerror = render }
}