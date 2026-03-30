import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import QRCode from "qrcode"
import { supabase } from "./supabase/client"

export async function generateBudgetPDF(customerData = {}, configuration = {}) {
  try {
    const doc = new jsPDF()
    const primary = [236, 28, 36]
    const gray = [60, 60, 60]
    const budgetNumber = `PS-${Date.now().toString().slice(-6)}`
    const today = new Date().toLocaleDateString("es-ES")
    const pageHeight = doc.internal.pageSize.height

    // LOGO
    const img = new Image()
    img.src = "/persianassantanderlogo.png"
    await new Promise(res => img.onload = res)
    doc.addImage(img, "PNG", 80, 8, 50, 50)

    // TITULO
    doc.setTextColor(...primary)
    doc.setFontSize(22)
    doc.setFont("helvetica", "bold")
    doc.text("PRESUPUESTO", 105, 70, { align: "center" })
    doc.setFontSize(10)
    doc.setTextColor(...gray)
    doc.text(`Nº ${budgetNumber}`, 14, 78)
    doc.text(`Fecha: ${today}`, 160, 78)

    // CLIENTE
    autoTable(doc, {
      startY: 85,
      head: [["DATOS CLIENTE", ""]],
      body: [
        ["Nombre", customerData.name || "-"],
        ["Teléfono", customerData.phone || "-"],
        ["Email", customerData.email || "-"],
        ["Dirección", customerData.address || "-"]
      ],
      headStyles: { fillColor: primary },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 }, 1: { cellWidth: 140 } }
    })

    let y = doc.lastAutoTable.finalY + 10

    // CONFIGURACION
    autoTable(doc, {
      startY: y,
      head: [["CONFIGURACIÓN PERSIANA", ""]],
      body: [
        ["Tipo", configuration.blindType || "-"],
        ["Mecanismo", configuration.mechanism || "-"],
        ["Motor", configuration.motorType || "-"],
        ["Orientación", configuration.orientation || "-"],
        ["Tipo lama", configuration.slatType || "-"],
        ["Ancho", `${configuration.width || 0} mm`],
        ["Alto", `${configuration.height || 0} mm`],
        ["Fondo", `${configuration.depth || 0} mm`]
      ],
      headStyles: { fillColor: primary },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 }, 1: { cellWidth: 130 } }
    })

    y = doc.lastAutoTable.finalY + 15

    // PRECIO
    const price = Number(configuration.estimatedPrice || 0)
    doc.setFillColor(...primary)
    doc.roundedRect(14, y, 182, 28, 4, 4, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    doc.setFont("helvetica", "bold")
    doc.text(`TOTAL: ${price.toFixed(2)} €`, 105, y + 18, { align: "center" })
    doc.setFontSize(10)
    doc.text("IVA incluido", 105, y + 25, { align: "center" })
    y += 40

    if (y + 50 > pageHeight) { doc.addPage(); y = 20 }

    // QR
    try {
      const configUrl = `${window.location.origin}/configurador`
      const qr = await QRCode.toDataURL(configUrl, { width: 300 })
      doc.setTextColor(...gray)
      doc.setFontSize(11)
      doc.text("Escanea para ver la configuración online:", 14, y)
      doc.addImage(qr, "PNG", 14, y + 6, 40, 40)
      y += 50
    } catch (e) {
      console.warn("QR no generado")
    }

    // CONDICIONES
    doc.setTextColor(...primary)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("CONDICIONES", 14, y)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(9)
    const terms = [
      "Validez del presupuesto: 30 días.",
      "Precio sujeto a verificación de medidas.",
      "Instalación no incluida salvo indicación.",
      "Entrega estimada: 7-15 días laborables.",
      "Garantía: 2 años mecanismos / 5 años lamas."
    ]
    terms.forEach((t, i) => { doc.text(`• ${t}`, 14, y + 6 + (i * 5)) })

    // FOOTER
    const pageH = doc.internal.pageSize.height
    doc.setFillColor(240, 240, 240)
    doc.rect(0, pageH - 18, 210, 18, "F")
    doc.setTextColor(...gray)
    doc.setFontSize(9)
    doc.text("Persianas Santander • Calidad y confianza desde 1990", 105, pageH - 10, { align: "center" })
    doc.text("942 00 00 00  |  info@persianassantander.com", 105, pageH - 5, { align: "center" })

    // ── GUARDAR EN SUPABASE ──────────────────────────────────────────────
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const priceWithoutIva = price / 1.21
        const iva             = price - priceWithoutIva
        await supabase.from('budgets').insert({
          user_id:          user.id,
          budget_number:    budgetNumber,
          customer_name:    customerData.name    || null,
          customer_phone:   customerData.phone   || null,
          customer_email:   customerData.email   || null,
          customer_address: customerData.address || null,
          blind_type:       configuration.blindType,
          mechanism:        configuration.mechanism,
          width:            configuration.width,
          height:           configuration.height,
          depth:            configuration.depth,
          box_color_name:   configuration.boxColorName,
          slat_color_name:  configuration.slatColorName,
          price_without_iva: priceWithoutIva,
          total_price:      priceWithoutIva,
          iva:              iva,
          total_with_iva:   price,
          user_type:        user.user_metadata?.user_type ?? 'public',
          customer_data:    customerData,
          status:           'pending',
        })
      }
    } catch (dbErr) {
      console.warn('No se pudo guardar el presupuesto en BD:', dbErr)
    }

    // DESCARGAR
    const safeName = (customerData.name || "Cliente").replace(/[^a-z0-9]/gi, "_")
    doc.save(`Presupuesto_${safeName}_${budgetNumber}.pdf`)

  } catch (error) {
    console.error("Error generando PDF", error)
  }
}