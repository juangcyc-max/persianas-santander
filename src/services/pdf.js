import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import QRCode from "qrcode"
import { supabase } from "./supabase/client"

// ── CONSTANTES DE DISEÑO ──────────────────────────────────────────────────
const COLORS = {
  red:       [180, 20, 25],
  redBg:     [253, 242, 242],
  dark:      [30, 30, 30],
  mid:       [80, 80, 80],
  light:     [150, 150, 150],
  grayBg:    [248, 248, 248],
  white:     [255, 255, 255],
  greenText: [34, 139, 34],
  border:    [220, 220, 220],
  blue:      [30, 80, 160],
}

const LABELS = {
  productType: {
    laminada:    'Paño Laminada',
    autoblocante:'Paño Autoblocante',
    sistema_mini:'Sistema Mini Autoblocante',
    // legacy
    blocking:    'Bloqueante',
    normal:      'Estándar',
  },
  boxType: {
    aluminio:  'Cajón mini aluminio',
    pvc:       'Cajón mini PVC',
    sin_cajon: 'Sin cajón',
  },
  mechanism:   { muelle: 'Muelle', cinta: 'Cinta manual', motor: 'Motor' },
  motorType:   { mecanico: 'Mecánico', mando_distancia: 'Mando / Radio' },
  guideType:   { none: 'Sin guías', v25: 'Guía V25', h25: 'Guía H25' },
}

// ── FORMATTERS & HELPERS ──────────────────────────────────────────────────
const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(amount) || 0)

const formatDate = (date) =>
  new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image()
  img.crossOrigin = "anonymous"
  img.onload = () => resolve(img)
  img.onerror = () => resolve(null)
  img.src = src
})

// ── COMPONENTES COMPARTIDOS ───────────────────────────────────────────────
function addPageHeader(doc, logoImg, title, number, today, brandColor = COLORS.red) {
  const W = doc.internal.pageSize.width
  doc.setFillColor(...brandColor)
  doc.rect(0, 0, W, 28, "F")

  doc.setTextColor(...COLORS.white)
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text(title, 14, 18)

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(`Nº ${number}`, W - 14, 13, { align: "right" })
  doc.text(`Fecha: ${today}`, W - 14, 21, { align: "right" })

  if (logoImg && logoImg.naturalWidth > 0) {
    doc.setFillColor(...COLORS.white)
    doc.roundedRect(W - 54, 2, 40, 24, 2, 2, "F")
    try { doc.addImage(logoImg, "PNG", W - 53, 3, 38, 22) } catch {}
  }

  doc.setFillColor(brandColor[0] + 40, brandColor[1] + 40, brandColor[2] + 40)
  doc.rect(0, 28, W, 3, "F")
}

function addPageFooter(doc, footerLines) {
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
  footerLines.forEach((line, i) => {
    doc.text(line, W / 2, H - 9 + i * 5, { align: "center" })
  })
}

function addPriceBlock(doc, y, breakdown, isPro, proDiscount, brandColor = COLORS.red) {
  const W = doc.internal.pageSize.width
  const H = doc.internal.pageSize.height

  const { subtotalSinIva, iva, totalConIva, finalPrice, discount, lines = [] } = breakdown

  const blockHeight = 12 + lines.length * 6 + (isPro ? 44 : 34)
  if (y > H - blockHeight - 20) {
    doc.addPage()
    y = 38
  }

  doc.setFillColor(...COLORS.grayBg)
  doc.roundedRect(14, y, W - 28, blockHeight, 3, 3, "F")

  doc.setTextColor(...brandColor)
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.text("RESUMEN ECONÓMICO", 20, y + 7)

  const col1 = 20
  const col2 = W - 18

  let ly = y + 14

  // Líneas de desglose (producto, cajón, guías, motor, instalación)
  if (lines.length > 0) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.mid)
    lines.forEach(({ label, value }) => {
      doc.text(label, col1, ly)
      doc.text(formatCurrency(value), col2, ly, { align: "right" })
      ly += 6
    })
    ly += 2
  }

  doc.setFontSize(9)
  doc.setTextColor(...COLORS.mid)
  doc.text("Base imponible", col1, ly)
  doc.text(formatCurrency(subtotalSinIva), col2, ly, { align: "right" })
  ly += 7
  doc.text("IVA (21%)", col1, ly)
  doc.text(formatCurrency(iva), col2, ly, { align: "right" })
  ly += 7

  if (isPro && discount > 0) {
    doc.setTextColor(...COLORS.greenText)
    doc.text(`Descuento profesional (−${proDiscount}%)`, col1, ly)
    doc.text(`−${formatCurrency(discount)}`, col2, ly, { align: "right" })
    ly += 7
  }

  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.line(14, ly, W - 14, ly)
  ly += 2

  doc.setFillColor(...brandColor)
  doc.roundedRect(W - 80, ly, 66, 14, 2, 2, "F")
  doc.setTextColor(...COLORS.white)
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text(`TOTAL: ${formatCurrency(finalPrice)}`, W - 47, ly + 9, { align: "center" })

  doc.setTextColor(...COLORS.mid)
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.text("IVA incluido", col1, ly + 9)

  return ly + 20
}

// ── PRESUPUESTO PERSIANAS SANTANDER (nuestro configurador) ────────────────
export async function generateBudgetPDF(customerData = {}, configuration = {}, { skipSave = false, budgetNumberOverride = null } = {}) {
  try {
    const doc = new jsPDF()
    const W = doc.internal.pageSize.width
    const H = doc.internal.pageSize.height
    const budgetNumber = budgetNumberOverride ?? `PS-${Date.now().toString().slice(-6)}`
    const today = formatDate(new Date())

    const isPro = configuration.userType === 'professional'
    const proDiscount = Number(configuration.proDiscount ?? 0)
    const finalPrice = Number(configuration.estimatedPrice || 0)

    // Recalcular desglose limpio
    const priceBeforeDiscount = isPro && proDiscount > 0
      ? finalPrice / (1 - proDiscount / 100)
      : finalPrice
    const subtotalSinIva = priceBeforeDiscount / 1.21
    const iva = priceBeforeDiscount - subtotalSinIva
    const discount = priceBeforeDiscount - finalPrice

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
    const productLabel = LABELS.productType[configuration.productType ?? configuration.blindType] ?? 'Estándar'
    const boxLabel = LABELS.boxType[configuration.boxType] ?? ''
    const guideLabel = LABELS.guideType[configuration.guideType] ?? 'Sin guías'
    const motorDisplay = configuration.mechanism === 'motor'
      ? (LABELS.motorType[configuration.motorType] || '—')
      : '—'

    const tableRows = [
      ['Tipo de persiana',       productLabel],
      boxLabel && ['Cajón',      boxLabel],
      ['Medidas (ancho × alto)', `${configuration.width || 0} × ${configuration.height || 0} mm`],
      ['Mecanismo',              LABELS.mechanism[configuration.mechanism] || '—'],
      configuration.mechanism === 'motor' && ['Tipo de motor', motorDisplay],
      ['Guías',                  guideLabel],
      ['Instalación',            configuration.installacion === false ? 'Sin instalación' : 'Con instalación'],
      ['Color del cajón',        configuration.boxColorName  ? `${configuration.boxColorName} (${configuration.boxColorGama ?? '—'})` : '—'],
      ['Color de lamas',         configuration.slatColorName ? `${configuration.slatColorName} (${configuration.slatColorGama ?? '—'})` : '—'],
    ].filter(Boolean)

    autoTable(doc, {
      startY: y,
      head: [['DESCRIPCIÓN DE LA PERSIANA', 'DETALLE']],
      body: tableRows,
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

    // ── BLOQUE PRECIO ─────────────────────────────────────────────────────
    y = addPriceBlock(doc, y, { subtotalSinIva, iva, totalConIva: priceBeforeDiscount, finalPrice, discount }, isPro, proDiscount)

    // ── QR Y CONDICIONES ──────────────────────────────────────────────────
    if (y > H - 85) { doc.addPage(); y = 38 }
    try {
      const qrDataUrl = await QRCode.toDataURL(`${window.location.origin}/configurador`, { width: 200, margin: 1 })
      doc.addImage(qrDataUrl, "PNG", 14, y, 28, 28)
      doc.setTextColor(...COLORS.light)
      doc.setFontSize(7.5)
      doc.setFont("helvetica", "normal")
      doc.text("Configura online", 28, y + 31, { align: "center" })
    } catch {}

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
      configuration.installacion === false
        ? "Sin instalación incluida. No nos hacemos responsables de medidas incorrectas tomadas por el cliente."
        : "Instalación incluida en el precio.",
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
      addPageHeader(doc, logoImg, "PRESUPUESTO", budgetNumber, today)
      addPageFooter(doc, [
        "Persianas Santander S.L.  ·  Polígono Industrial Nueva Montaña, Santander",
        "942 00 00 00  ·  info@persianassantander.com  ·  www.persianassantander.com",
      ])
    }

    // ── GUARDAR EN SUPABASE ───────────────────────────────────────────────
    if (!skipSave) {
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
            blind_type:        configuration.productType ?? configuration.blindType,
            mechanism:         configuration.mechanism,
            width:             configuration.width,
            height:            configuration.height,
            box_color_name:    configuration.boxColorName,
            slat_color_name:   configuration.slatColorName,
            price_without_iva: subtotalSinIva,
            total_price:       finalPrice,
            iva:               iva,
            total_with_iva:    finalPrice,
            user_type:         user.user_metadata?.user_type ?? 'public',
            customer_data:     customerData,
            status:            'pending',
          })
        }
      } catch (dbErr) {
        console.error('Fallo al guardar en Supabase:', dbErr)
      }
    }

    const safeCustomerName = (customerData.name || "Cliente").trim().replace(/[^a-z0-9]/gi, "_")
    doc.save(`Presupuesto_${safeCustomerName}_${budgetNumber}.pdf`)

  } catch (error) {
    console.error("Error generando PDF:", error)
  }
}

// ── PRESUPUESTO DEL PROFESIONAL PARA SU CLIENTE ───────────────────────────
// Este PDF lleva el logo y datos de la empresa del profesional, NO de Persianas Santander.
// El precio mostrado es el precio que el profesional cobra a su cliente (sin descuento PS).
export async function generateClientBudgetPDF({
  customerData = {},
  configuration = {},
  empresa = {},
  logoUrl = null,
  clientPrice,
  budgetNumber = null,
}) {
  try {
    const doc = new jsPDF()
    const W = doc.internal.pageSize.width
    const H = doc.internal.pageSize.height
    const bNumber = budgetNumber ?? `PRO-${Date.now().toString().slice(-6)}`
    const today = formatDate(new Date())

    const finalPrice = Number(clientPrice || 0)
    const totalConIva = finalPrice
    const subtotalSinIva = totalConIva / 1.21
    const iva = totalConIva - subtotalSinIva

    // Cargar logo del profesional
    const logoImg = logoUrl ? await loadImage(logoUrl) : null

    // Color de marca: azul corporativo para diferenciar del nuestro
    const brandColor = COLORS.blue

    let y = 38

    // ── BLOQUE EMISOR (datos del profesional) ─────────────────────────────
    doc.setFillColor(...COLORS.grayBg)
    doc.roundedRect(14, y, W - 28, 42, 3, 3, "F")

    doc.setTextColor(...brandColor)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text("DATOS DEL EMISOR", 20, y + 7)

    doc.setTextColor(...COLORS.dark)
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text(empresa.razon_social || "Empresa no especificada", 20, y + 15)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.mid)
    if (empresa.cif_nif)           doc.text(`CIF/NIF: ${empresa.cif_nif}`, 20, y + 22)
    if (empresa.direccion_fiscal)  doc.text(empresa.direccion_fiscal, 20, y + 29)
    const cityLine = [empresa.codigo_postal, empresa.ciudad, empresa.provincia].filter(Boolean).join(" · ")
    if (cityLine) doc.text(cityLine, 20, y + 36)
    if (empresa.telefono) {
      doc.text(`Tel: ${empresa.telefono}`, W - 14, y + 22, { align: "right" })
    }
    if (empresa.email_facturacion) {
      doc.text(empresa.email_facturacion, W - 14, y + 29, { align: "right" })
    }
    y += 50

    // ── BLOQUE CLIENTE ────────────────────────────────────────────────────
    doc.setFillColor(...COLORS.grayBg)
    doc.roundedRect(14, y, W - 28, 36, 3, 3, "F")

    doc.setTextColor(...brandColor)
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
    if (customerData.address) doc.text(customerData.address, 20, y + 29)
    y += 44

    // ── TABLA CONFIGURACIÓN ───────────────────────────────────────────────
    const productLabel = LABELS.productType[configuration.productType ?? configuration.blindType] ?? 'Estándar'
    const boxLabel = LABELS.boxType[configuration.boxType] ?? ''
    const guideLabel = LABELS.guideType[configuration.guideType] ?? 'Sin guías'
    const motorDisplay = configuration.mechanism === 'motor'
      ? (LABELS.motorType[configuration.motorType] || '—')
      : '—'

    const tableRows = [
      ['Tipo de persiana',       productLabel],
      boxLabel && ['Cajón',      boxLabel],
      ['Medidas (ancho × alto)', `${configuration.width || 0} × ${configuration.height || 0} mm`],
      ['Mecanismo',              LABELS.mechanism[configuration.mechanism] || '—'],
      configuration.mechanism === 'motor' && ['Tipo de motor', motorDisplay],
      ['Guías',                  guideLabel],
      ['Instalación',            configuration.installacion === false ? 'Sin instalación' : 'Con instalación'],
      ['Color del cajón',        configuration.boxColorName  ? `${configuration.boxColorName} (${configuration.boxColorGama ?? '—'})` : '—'],
      ['Color de lamas',         configuration.slatColorName ? `${configuration.slatColorName} (${configuration.slatColorGama ?? '—'})` : '—'],
    ].filter(Boolean)

    autoTable(doc, {
      startY: y,
      head: [['DESCRIPCIÓN DE LA PERSIANA', 'DETALLE']],
      body: tableRows,
      headStyles: { fillColor: brandColor, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9, cellPadding: 5 },
      bodyStyles: { fontSize: 9, cellPadding: 4, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.grayBg },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 80, textColor: COLORS.mid },
        1: { cellWidth: 'auto' },
      },
      margin: { left: 14, right: 14, top: 38, bottom: 20 },
    })
    y = doc.lastAutoTable.finalY + 12

    // ── BLOQUE PRECIO ─────────────────────────────────────────────────────
    if (y > H - 60) { doc.addPage(); y = 38 }
    doc.setFillColor(...COLORS.grayBg)
    doc.roundedRect(14, y, W - 28, 38, 3, 3, "F")

    doc.setTextColor(...brandColor)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text("RESUMEN ECONÓMICO", 20, y + 7)

    const col1 = 20
    const col2 = W - 18

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.mid)
    doc.text("Base imponible", col1, y + 16)
    doc.text(formatCurrency(subtotalSinIva), col2, y + 16, { align: "right" })
    doc.text("IVA (21%)", col1, y + 23)
    doc.text(formatCurrency(iva), col2, y + 23, { align: "right" })

    doc.setDrawColor(...COLORS.border)
    doc.setLineWidth(0.3)
    doc.line(14, y + 28, W - 14, y + 28)

    doc.setFillColor(...brandColor)
    doc.roundedRect(W - 80, y + 30, 66, 14, 2, 2, "F")
    doc.setTextColor(...COLORS.white)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text(`TOTAL: ${formatCurrency(finalPrice)}`, W - 47, y + 39, { align: "center" })

    doc.setTextColor(...COLORS.mid)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text("IVA incluido", col1, y + 39)

    y += 52

    // ── CONDICIONES ───────────────────────────────────────────────────────
    if (y > H - 60) { doc.addPage(); y = 38 }
    doc.setTextColor(...brandColor)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text("CONDICIONES", 14, y + 6)
    const terms = [
      "Presupuesto válido 30 días desde la fecha de emisión.",
      "Precio orientativo sujeto a verificación de medidas in situ.",
      "Plazo de entrega estimado: 7-15 días laborables desde confirmación.",
      configuration.installacion === false
        ? "Sin instalación incluida. El cliente es responsable de la correcta toma de medidas."
        : "Instalación incluida en el precio.",
    ]
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.mid)
    let termY = y + 13
    terms.forEach((term) => {
      const splitText = doc.splitTextToSize(`• ${term}`, W - 28)
      doc.text(splitText, 14, termY)
      termY += splitText.length * 5
    })

    // ── CABECERAS Y PIES MAESTROS ─────────────────────────────────────────
    const footerLine1 = [empresa.razon_social, empresa.cif_nif].filter(Boolean).join("  ·  ")
    const footerLine2 = [empresa.telefono, empresa.email_facturacion].filter(Boolean).join("  ·  ")

    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      addPageHeader(doc, logoImg, "PRESUPUESTO", bNumber, today, brandColor)
      addPageFooter(doc, [
        footerLine1 || "Empresa profesional",
        footerLine2 || "",
      ])
    }

    const safeCustomerName = (customerData.name || "Cliente").trim().replace(/[^a-z0-9]/gi, "_")
    doc.save(`Presupuesto_Cliente_${safeCustomerName}_${bNumber}.pdf`)

  } catch (error) {
    console.error("Error generando PDF cliente:", error)
  }
}

// ── REGENERAR PDF DE PRESUPUESTO EXISTENTE ────────────────────────────────
export async function redownloadBudgetPDF(budget) {
  const customerData = budget.customer_data ?? {
    name:    budget.customer_name,
    phone:   budget.customer_phone,
    email:   budget.customer_email,
    address: budget.customer_address,
  }

  const configuration = {
    productType:    budget.blind_type,
    blindType:      budget.blind_type,
    boxType:        budget.box_type,
    mechanism:      budget.mechanism,
    motorType:      budget.motor_type,
    guideType:      budget.guide_type,
    installacion:   budget.installacion,
    orientation:    budget.orientation,
    width:          budget.width,
    height:         budget.height,
    boxColorName:   budget.box_color_name,
    boxColorGama:   budget.box_color_gama,
    slatColorName:  budget.slat_color_name,
    slatColorGama:  budget.slat_color_gama,
    estimatedPrice: budget.total_with_iva,
    userType:       budget.user_type,
    proDiscount:    0,
  }

  return generateBudgetPDF(customerData, configuration, {
    skipSave: true,
    budgetNumberOverride: budget.budget_number,
  })
}
