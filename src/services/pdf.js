import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import QRCode from "qrcode"
import { supabase } from "./supabase/client"

// ── Colores corporativos ──────────────────────────────────────────────────
const RED    = [180, 20, 25]
const RED_BG = [253, 242, 242]
const DARK   = [30, 30, 30]
const MID    = [80, 80, 80]
const LIGHT  = [150, 150, 150]
const GRAY_BG= [248, 248, 248]
const WHITE  = [255, 255, 255]

function addHeader(doc, img, budgetNumber, today) {
  const W = doc.internal.pageSize.width

  // Banda superior roja
  doc.setFillColor(...RED)
  doc.rect(0, 0, W, 28, "F")

  // Texto "PRESUPUESTO" en la banda
  doc.setTextColor(...WHITE)
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text("PRESUPUESTO", 14, 18)

  // Número y fecha alineados a la derecha
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(`Nº ${budgetNumber}`, W - 14, 13, { align: "right" })
  doc.text(`Fecha: ${today}`, W - 14, 21, { align: "right" })

  // Logo a la derecha sobre la banda — fondo blanco pequeño
  if (img?.complete && img.naturalWidth > 0) {
    doc.setFillColor(...WHITE)
    doc.roundedRect(W - 54, 2, 40, 24, 2, 2, "F")
    try { doc.addImage(img, "PNG", W - 53, 3, 38, 22) } catch (e) {}
  }

  // Línea decorativa bajo la banda
  doc.setFillColor(...RED_BG)
  doc.rect(0, 28, W, 3, "F")
}

function addFooter(doc) {
  const W = doc.internal.pageSize.width
  const H = doc.internal.pageSize.height

  doc.setFillColor(...GRAY_BG)
  doc.rect(0, H - 16, W, 16, "F")

  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(0, H - 16, W, H - 16)

  doc.setTextColor(...LIGHT)
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.text("Persianas Santander S.L.  ·  Polígono Industrial Nueva Montaña, Santander", W / 2, H - 9, { align: "center" })
  doc.text("942 00 00 00  ·  info@persianassantander.com  ·  www.persianassantander.com", W / 2, H - 4, { align: "center" })
}

export async function generateBudgetPDF(customerData = {}, configuration = {}) {
  try {
    const doc          = new jsPDF()
    const W            = doc.internal.pageSize.width
    const budgetNumber = `PS-${Date.now().toString().slice(-6)}`
    const today        = new Date().toLocaleDateString("es-ES")

    // Cargar logo
    const img = new Image()
    img.src   = "/persianassantanderlogo.png"
    await new Promise((res) => { img.onload = res; img.onerror = res })

    addHeader(doc, img, budgetNumber, today)
    addFooter(doc)

    let y = 38

    // ── BLOQUE CLIENTE ────────────────────────────────────────────────────
    doc.setFillColor(...GRAY_BG)
    doc.roundedRect(14, y, W - 28, 36, 3, 3, "F")

    doc.setTextColor(...RED)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text("DATOS DEL CLIENTE", 20, y + 7)

    doc.setTextColor(...DARK)
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text(customerData.name || "—", 20, y + 15)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...MID)
    doc.text(`${customerData.phone || "—"}  ·  ${customerData.email || "—"}`, 20, y + 22)
    doc.text(customerData.address || "—", 20, y + 29)

    y += 44

    // ── TABLA CONFIGURACIÓN ───────────────────────────────────────────────
    const mechLabel  = { muelle: 'Muelle', cinta: 'Cinta', motor: 'Motor' }
    const typeLabel  = configuration.blindType === 'blocking' ? 'Bloqueante' : 'Estándar'
    const slatLabel  = configuration.slatType  === 'seguridad' ? 'Seguridad' : 'Normal'
    const motorLabel = configuration.mechanism === 'motor' ? (configuration.motorType === 'mecanico' ? 'Mecánico' : 'Domótico') : '—'

    autoTable(doc, {
      startY: y,
      head: [['DESCRIPCIÓN DE LA PERSIANA', 'DETALLE']],
      body: [
        ['Tipo de persiana',  typeLabel],
        ['Medidas (ancho × alto)', `${configuration.width || 0} × ${configuration.height || 0} mm`],
        ['Fondo de caja',    `${configuration.depth || 0} mm`],
        ['Mecanismo',        mechLabel[configuration.mechanism] || '—'],
        ['Tipo de motor',    motorLabel],
        ['Tipo de lamas',    slatLabel],
        ['Color de la caja', configuration.boxColorName || '—'],
        ['Color de lamas',   configuration.slatColorName || '—'],
        ['Orientación',      configuration.orientation || '—'],
      ],
      headStyles: {
        fillColor:  RED,
        textColor:  WHITE,
        fontStyle:  'bold',
        fontSize:   9,
        cellPadding: 5,
      },
      bodyStyles: { fontSize: 9, cellPadding: 4, textColor: DARK },
      alternateRowStyles: { fillColor: GRAY_BG },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 80,  textColor: MID  },
        1: { cellWidth: 'auto' },
      },
      margin: { left: 14, right: 14 },
    })

    y = doc.lastAutoTable.finalY + 8

    // ── BLOQUE PRECIO ─────────────────────────────────────────────────────
    const price        = Number(configuration.estimatedPrice || 0)
    const priceNoIva   = price / 1.21
    const iva          = price - priceNoIva
    const isPro        = configuration.userType === 'professional'
    const priceBase    = isPro ? price / 0.8 : price
    const discount     = isPro ? priceBase - price : 0

    doc.setFillColor(...GRAY_BG)
    doc.roundedRect(14, y, W - 28, isPro ? 44 : 34, 3, 3, "F")

    doc.setTextColor(...RED)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text("RESUMEN ECONÓMICO", 20, y + 7)

    const col1 = 20, col2 = W - 18
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...MID)

    doc.text("Base imponible",  col1, y + 15)
    doc.text(`${priceNoIva.toFixed(2)} €`, col2, y + 15, { align: "right" })
    doc.text("IVA (21%)",       col1, y + 22)
    doc.text(`${iva.toFixed(2)} €`, col2, y + 22, { align: "right" })

    if (isPro) {
      doc.setTextColor(34, 139, 34)
      doc.text("Descuento profesional (−20%)", col1, y + 29)
      doc.text(`−${discount.toFixed(2)} €`, col2, y + 29, { align: "right" })
    }

    // Línea separadora
    const lineY = y + (isPro ? 33 : 27)
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.line(14, lineY, W - 14, lineY)

    // Total
    doc.setFillColor(...RED)
    doc.roundedRect(W - 80, lineY + 2, 66, 14, 2, 2, "F")
    doc.setTextColor(...WHITE)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text(`TOTAL: ${price.toFixed(2)} €`, W - 47, lineY + 11, { align: "center" })

    doc.setTextColor(...MID)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text("IVA incluido", col1, lineY + 11)

    y += isPro ? 58 : 48

    // ── QR ────────────────────────────────────────────────────────────────
    try {
      const qr = await QRCode.toDataURL(`${window.location.origin}/configurador`, { width: 200, margin: 1 })
      doc.addImage(qr, "PNG", 14, y, 28, 28)
      doc.setTextColor(...LIGHT)
      doc.setFontSize(7.5)
      doc.setFont("helvetica", "normal")
      doc.text("Configura online", 28, y + 31, { align: "center" })
    } catch (e) {}

    // ── CONDICIONES ───────────────────────────────────────────────────────
    const condX = 50
    doc.setTextColor(...RED)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text("CONDICIONES", condX, y + 6)

    const terms = [
      "Presupuesto válido 30 días desde la fecha de emisión.",
      "Precio orientativo sujeto a verificación de medidas en visita técnica.",
      "Plazo de entrega estimado: 7-15 días laborables desde confirmación.",
      "Garantía: 2 años en mecanismos · 5 años en lamas de aluminio.",
      "Instalación no incluida salvo acuerdo expreso.",
    ]
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...MID)
    terms.forEach((t, i) => doc.text(`• ${t}`, condX, y + 13 + i * 6))

    // ── GUARDAR EN SUPABASE ───────────────────────────────────────────────
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('budgets').insert({
          user_id:           user.id,
          budget_number:     budgetNumber,
          customer_name:     customerData.name    || null,
          customer_phone:    customerData.phone   || null,
          customer_email:    customerData.email   || null,
          customer_address:  customerData.address || null,
          blind_type:        configuration.blindType,
          mechanism:         configuration.mechanism,
          width:             configuration.width,
          height:            configuration.height,
          depth:             configuration.depth,
          box_color_name:    configuration.boxColorName,
          slat_color_name:   configuration.slatColorName,
          price_without_iva: priceNoIva,
          total_price:       priceNoIva,
          iva:               iva,
          total_with_iva:    price,
          user_type:         user.user_metadata?.user_type ?? 'public',
          customer_data:     customerData,
          status:            'pending',
        })
      }
    } catch (dbErr) {
      console.warn('No se pudo guardar el presupuesto:', dbErr)
    }

    const safeName = (customerData.name || "Cliente").replace(/[^a-z0-9]/gi, "_")
    doc.save(`Presupuesto_${safeName}_${budgetNumber}.pdf`)

  } catch (error) {
    console.error("Error generando PDF:", error)
  }
}