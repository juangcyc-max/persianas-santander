import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import QRCode from "qrcode"
import { supabase } from "./supabase/client"

// ── CONSTANTES DE DISEÑO Y DICCIONARIOS ───────────────────────────────────
const COLORS = {
  red:       [180, 20, 25],
  redBg:     [253, 242, 242],
  dark:      [30, 30, 30],
  mid:       [80, 80, 80],
  light:     [150, 150, 150],
  grayBg:    [248, 248, 248],
  white:     [255, 255, 255],
  greenText: [34, 139, 34],
  border:    [220, 220, 220]
}

const LABELS = {
  mechanism: { muelle: 'Muelle', cinta: 'Cinta', motor: 'Motor' },
  blindType: { blocking: 'Bloqueante', standard: 'Estándar' },
  slatType:  { seguridad: 'Seguridad', normal: 'Normal' },
  motorType: { mecanico: 'Mecánico', domotico: 'Domótico' }
}

// ── FORMATTERS & HELPERS ──────────────────────────────────────────────────
const formatCurrency = (amount) => 
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(amount) || 0)

const formatDate = (date) => 
  new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = () => resolve(null)
  img.src = src
})

// ── COMPONENTES DEL PDF ───────────────────────────────────────────────────
function addHeader(doc, img, budgetNumber, today) {
  const W = doc.internal.pageSize.width

  doc.setFillColor(...COLORS.red)
  doc.rect(0, 0, W, 28, "F")

  doc.setTextColor(...COLORS.white)
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text("PRESUPUESTO", 14, 18)

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(`Nº ${budgetNumber}`, W - 14, 13, { align: "right" })
  doc.text(`Fecha: ${today}`, W - 14, 21, { align: "right" })

  if (img && img.naturalWidth > 0) {
    doc.setFillColor(...COLORS.white)
    doc.roundedRect(W - 54, 2, 40, 24, 2, 2, "F")
    try { doc.addImage(img, "PNG", W - 53, 3, 38, 22) } catch (e) {}
  }

  doc.setFillColor(...COLORS.redBg)
  doc.rect(0, 28, W, 3, "F")
}

function addFooter(doc) {
  const W = doc.internal.pageSize.width
  const H = doc.internal.pageSize.height

  doc.setFillColor(...COLORS.grayBg)
  doc.rect(0, H - 16, W, 16, "F")

  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.line(0, H - 16, W, H - 16)

  doc.setTextColor(...COLORS.light)
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.text("Persianas Santander S.L.  ·  Polígono Industrial Nueva Montaña, Santander", W / 2, H - 9, { align: "center" })
  doc.text("942 00 00 00  ·  info@persianassantander.com  ·  www.persianassantander.com", W / 2, H - 4, { align: "center" })
}

// ── GENERADOR PRINCIPAL ───────────────────────────────────────────────────
export async function generateBudgetPDF(customerData = {}, configuration = {}) {
  try {
    const doc = new jsPDF()
    const W = doc.internal.pageSize.width
    const H = doc.internal.pageSize.height
    const budgetNumber = `PS-${Date.now().toString().slice(-6)}`
    const today = formatDate(new Date())

    const isPro = configuration.userType === 'professional'
    const total = Number(configuration.estimatedPrice || 0)
    const baseImponible = total / 1.21
    const iva = total - baseImponible
    
    const totalWithoutDiscount = isPro ? total / 0.8 : total
    const discountAmount = isPro ? totalWithoutDiscount - total : 0

    const logoImg = await loadImage("/persianassantanderlogo.png")

    let y = 38

    // ── BLOQUE CLIENTE ────────────────────────────────────────────────────
    doc.setFillColor(...COLORS.grayBg)
    doc.roundedRect(14, y, W - 28, 36, 3, 3, "F")

    doc.setTextColor(...COLORS.red)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text("DATOS DEL CLIENTE", 20, y + 7)

    doc.setTextColor(...COLORS.dark)
    doc.setFontSize(10)
    doc.text(customerData.name || "Cliente no especificado", 20, y + 15)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.mid)
    
    const contactInfo = [customerData.phone, customerData.email].filter(Boolean).join("  ·  ")
    doc.text(contactInfo || "Sin datos de contacto", 20, y + 22)
    doc.text(customerData.address || "Dirección no especificada", 20, y + 29)

    y += 44

    // ── TABLA CONFIGURACIÓN ───────────────────────────────────────────────
    const motorDisplay = configuration.mechanism === 'motor' 
      ? LABELS.motorType[configuration.motorType] || 'No especificado' 
      : '—'

    autoTable(doc, {
      startY: y,
      head: [['DESCRIPCIÓN DE LA PERSIANA', 'DETALLE']],
      body: [
        ['Tipo de persiana',       LABELS.blindType[configuration.blindType] || 'Estándar'],
        ['Medidas (ancho × alto)', `${configuration.width || 0} × ${configuration.height || 0} mm`],
        ['Fondo de cajón',         `${configuration.depth || 0} mm`],
        ['Mecanismo',              LABELS.mechanism[configuration.mechanism] || '—'],
        ['Tipo de motor',          motorDisplay],
        ['Tipo de lamas',          LABELS.slatType[configuration.slatType] || 'Normal'],
        ['Color del cajón',        configuration.boxColorName || '—'],
        ['Color de lamas',         configuration.slatColorName || '—'],
        ['Orientación',            configuration.orientation || '—'],
      ],
      headStyles: { fillColor: COLORS.red, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9, cellPadding: 5 },
      bodyStyles: { fontSize: 9, cellPadding: 4, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.grayBg },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 80, textColor: COLORS.mid },
        1: { cellWidth: 'auto' },
      },
      margin: { left: 14, right: 14, top: 38, bottom: 20 }, 
    })

    y = doc.lastAutoTable.finalY + 12

    // ── PAGINACIÓN 1: CORTE ESTRICTO ──────────────────────────────────────
    // Si la posición Y baja del margen de 80mm antes de dibujar el precio, salta.
    if (y > H - 80) {
      doc.addPage()
      y = 38
    }

    // ── BLOQUE PRECIO ─────────────────────────────────────────────────────
    doc.setFillColor(...COLORS.grayBg)
    doc.roundedRect(14, y, W - 28, isPro ? 44 : 34, 3, 3, "F")

    doc.setTextColor(...COLORS.red)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text("RESUMEN ECONÓMICO", 20, y + 7)

    const col1 = 20
    const col2 = W - 18
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.mid)

    doc.text("Base imponible",  col1, y + 15)
    doc.text(formatCurrency(baseImponible), col2, y + 15, { align: "right" })
    doc.text("IVA (21%)",       col1, y + 22)
    doc.text(formatCurrency(iva), col2, y + 22, { align: "right" })

    if (isPro) {
      doc.setTextColor(...COLORS.greenText)
      doc.text("Descuento profesional (−20%)", col1, y + 29)
      doc.text(`−${formatCurrency(discountAmount)}`, col2, y + 29, { align: "right" })
    }

    const lineY = y + (isPro ? 33 : 27)
    doc.setDrawColor(...COLORS.border)
    doc.setLineWidth(0.3)
    doc.line(14, lineY, W - 14, lineY)

    doc.setFillColor(...COLORS.red)
    doc.roundedRect(W - 80, lineY + 2, 66, 14, 2, 2, "F")
    doc.setTextColor(...COLORS.white)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text(`TOTAL: ${formatCurrency(total)}`, W - 47, lineY + 11, { align: "center" })

    doc.setTextColor(...COLORS.mid)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text("IVA incluido", col1, lineY + 11)

    y += isPro ? 58 : 48

    // ── PAGINACIÓN 2: CORTE ESTRICTO ──────────────────────────────────────
    // Si la caja de precio ha empujado la posición Y más allá del límite seguro, salta.
    if (y > H - 85) {
      doc.addPage()
      y = 38 
    }

    // ── QR Y CONDICIONES ──────────────────────────────────────────────────
    try {
      const qrDataUrl = await QRCode.toDataURL(`${window.location.origin}/configurador`, { width: 200, margin: 1 })
      doc.addImage(qrDataUrl, "PNG", 14, y, 28, 28)
      doc.setTextColor(...COLORS.light)
      doc.setFontSize(7.5)
      doc.setFont("helvetica", "normal")
      doc.text("Configura online", 28, y + 31, { align: "center" })
    } catch (e) {
      console.warn("No se pudo generar el QR", e)
    }

    const condX = 50
    doc.setTextColor(...COLORS.red)
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
    doc.setTextColor(...COLORS.mid)
    
    let termY = y + 13
    terms.forEach((term) => {
      const splitText = doc.splitTextToSize(`• ${term}`, W - condX - 14)
      doc.text(splitText, condX, termY)
      termY += splitText.length * 5 
    })

    // ── CABECERAS Y PIES MAESTROS ─────────────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      addHeader(doc, logoImg, budgetNumber, today)
      addFooter(doc)
    }

    // ── GUARDAR EN SUPABASE ───────────────────────────────────────────────
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('budgets').insert({
          user_id:           user.id,
          budget_number:     budgetNumber,
          customer_name:     customerData.name || null,
          customer_phone:    customerData.phone || null,
          customer_email:    customerData.email || null,
          customer_address:  customerData.address || null,
          blind_type:        configuration.blindType,
          mechanism:         configuration.mechanism,
          width:             configuration.width,
          height:            configuration.height,
          depth:             configuration.depth,
          box_color_name:    configuration.boxColorName,
          slat_color_name:   configuration.slatColorName,
          price_without_iva: baseImponible,
          total_price:       total,
          iva:               iva,
          total_with_iva:    total,
          user_type:         user.user_metadata?.user_type ?? 'public',
          customer_data:     customerData,
          status:            'pending',
        })
      }
    } catch (dbErr) {
      console.error('Fallo al guardar en Supabase:', dbErr)
    }

    // ── DESCARGA ──────────────────────────────────────────────────────────
    const safeCustomerName = (customerData.name || "Cliente").trim().replace(/[^a-z0-9]/gi, "_")
    doc.save(`Presupuesto_${safeCustomerName}_${budgetNumber}.pdf`)

  } catch (error) {
    console.error("Error generando PDF:", error)
  }
}