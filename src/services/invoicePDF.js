import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

export function generateInvoicePDF(invoice, order, empresa = null) {
  const doc = new jsPDF()
  const primary = [236, 28, 36]
  const gray = [60, 60, 60]
  const pageH = doc.internal.pageSize.height

  // LOGO
  const img = new Image()
  img.src = "/persianassantanderlogo.png"

  const render = () => {
    try { doc.addImage(img, "PNG", 80, 8, 50, 50) } catch (e) {}

    // CABECERA
    doc.setTextColor(...primary)
    doc.setFontSize(22)
    doc.setFont("helvetica", "bold")
    doc.text("FACTURA", 105, 70, { align: "center" })

    doc.setFontSize(10)
    doc.setTextColor(...gray)
    doc.text(`Nº ${invoice.invoice_number}`, 14, 78)
    doc.text(`Fecha: ${new Date(invoice.created_at).toLocaleDateString("es-ES")}`, 150, 78)

    // ESTADO DE PAGO
    const isPaid = invoice.payment_status === 'paid'
    doc.setFillColor(...(isPaid ? [34, 197, 94] : [251, 191, 36]))
    doc.roundedRect(14, 82, 50, 8, 2, 2, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.text(isPaid ? "PAGADA" : "PENDIENTE DE PAGO", 39, 87.5, { align: "center" })

    // EMISOR
    autoTable(doc, {
      startY: 96,
      head: [["EMISOR", ""]],
      body: [
        ["Empresa", "Persianas Santander S.L."],
        ["Dirección", "Polígono Industrial Nueva Montaña, Santander"],
        ["Teléfono", "942 00 00 00"],
        ["Email", "info@persianassantander.com"],
      ],
      headStyles: { fillColor: primary },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 }, 1: { cellWidth: 140 } }
    })

    // CLIENTE / EMPRESA
    const clienteRows = empresa ? [
      ["Razón social", empresa.razon_social ?? "—"],
      ["CIF/NIF",      empresa.cif_nif ?? "—"],
      ["Dirección",    `${empresa.direccion_fiscal ?? "—"}, ${empresa.codigo_postal ?? ""} ${empresa.ciudad ?? ""}`],
      ["Provincia",    empresa.provincia ?? "—"],
      ["Teléfono",     empresa.telefono ?? "—"],
      ["Email",        empresa.email_facturacion ?? order?.profiles?.email ?? "—"],
    ] : [
      ["Email",        order?.profiles?.email ?? "—"],
      ["Dirección",    order?.address ?? "—"],
      ["Teléfono",     order?.phone ?? "—"],
    ]

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      head: [["CLIENTE", ""]],
      body: clienteRows,
      headStyles: { fillColor: gray },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 }, 1: { cellWidth: 140 } }
    })

    let y = doc.lastAutoTable.finalY + 10

    // PRODUCTOS
    const items = order?.items ?? []
    autoTable(doc, {
      startY: y,
      head: [["Descripción", "Medidas", "Mecanismo", "Precio"]],
      body: items.map(i => [
        `Persiana ${i.blind_type === 'blocking' ? 'bloqueante' : 'estándar'}`,
        `${i.width}×${i.height} mm`,
        i.mechanism,
        `${Number(i.estimated_price * (i.quantity ?? 1)).toFixed(2)} €`
      ]),
      headStyles: { fillColor: primary },
    })

    y = doc.lastAutoTable.finalY + 10

    // TOTALES
    const totalSinIva = invoice.total_without_iva
    const iva         = invoice.iva
    const total       = invoice.total_with_iva

    autoTable(doc, {
      startY: y,
      body: [
        ["Base imponible", `${Number(totalSinIva).toFixed(2)} €`],
        ["IVA (21%)",      `${Number(iva).toFixed(2)} €`],
        ["TOTAL",          `${Number(total).toFixed(2)} €`],
      ],
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 150 },
        1: { halign: "right", cellWidth: 30 }
      },
      bodyStyles: { fontSize: 11 },
      didParseCell: (data) => {
        if (data.row.index === 2) {
          data.cell.styles.fontStyle = "bold"
          data.cell.styles.fontSize  = 13
          data.cell.styles.fillColor = [254, 242, 242]
          data.cell.styles.textColor = primary
        }
      }
    })

    // FOOTER
    doc.setFillColor(240, 240, 240)
    doc.rect(0, pageH - 18, 210, 18, "F")
    doc.setTextColor(...gray)
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.text("Persianas Santander S.L. • NIF: B00000000", 105, pageH - 10, { align: "center" })
    doc.text("942 00 00 00  |  info@persianassantander.com", 105, pageH - 5, { align: "center" })

    doc.save(`Factura_${invoice.invoice_number}.pdf`)
  }

  if (img.complete) { render() }
  else { img.onload = render; img.onerror = render }
}