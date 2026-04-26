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
    laminada:                    'Paño Laminado',
    autoblocante:                'Paño Autoblocante',
    blocking:                    'Bloqueante',
    sistema_mini_cajon_pvc:      'Sistema Mini Cajón PVC',
    sistema_mini_cajon_aluminio: 'Sistema Mini Cajón Aluminio',
    sistema_mini_autoblocante:   'Sistema Mini Autoblocante',
    solo_motor:                  'Solo Motor',
    solo_guias:                  'Solo Guías',
    mosquitera_enrollable:       'Mosquitera Enrollable',
    // legacy
    sistema_mini_pvc:     'Sistema Mini PVC',
    sistema_mini_aluminio:'Sistema Mini Aluminio',
    motor_mas_guias:      'Motor + Guías',
    pano_mas_guias:       'Paño + Guías',
    sistema_mini:         'Sistema Mini Autoblocante',
    normal:               'Estándar',
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

/** Etiqueta de sección con barra lateral de color */
function sectionLabel(doc, x, y, text, color = COLORS.red) {
  doc.setFillColor(...color)
  doc.rect(x, y - 4.5, 2, 6, 'F')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.light)
  doc.text(text.toUpperCase(), x + 5, y)
}

function addPageHeader(doc, logoImg, title, number, today, brandColor = COLORS.red) {
  const W = doc.internal.pageSize.width
  doc.setFillColor(...brandColor)
  doc.rect(0, 0, W, 32, 'F')

  // Línea de acento
  doc.setFillColor(brandColor[0] + 30, brandColor[1] + 10, brandColor[2] + 10)
  doc.rect(0, 32, W, 1.5, 'F')

  doc.setTextColor(...COLORS.white)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, 22)

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text(`Nº ${number}`, W - 14, 13, { align: 'right' })
  doc.text(`Fecha: ${today}`, W - 14, 22, { align: 'right' })

  if (logoImg && logoImg.naturalWidth > 0) {
    doc.setFillColor(...COLORS.white)
    doc.roundedRect(W - 52, 3, 38, 26, 2, 2, 'F')
    try { doc.addImage(logoImg, 'PNG', W - 51, 4, 36, 24) } catch {}
  }
}

function addPageFooter(doc, footerLines, page, pageCount) {
  const W = doc.internal.pageSize.width
  const H = doc.internal.pageSize.height
  doc.setFillColor(...COLORS.grayBg)
  doc.rect(0, H - 14, W, 14, 'F')
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.2)
  doc.line(0, H - 14, W, H - 14)
  doc.setTextColor(...COLORS.light)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  const line1 = footerLines[0] || ''
  const line2 = footerLines[1] ? `${footerLines[1]}  ·  Pág. ${page}/${pageCount}` : `Pág. ${page}/${pageCount}`
  doc.text(line1, W / 2, H - 8,   { align: 'center' })
  doc.text(line2, W / 2, H - 3.5, { align: 'center' })
}

function addPriceBlock(doc, y, breakdown, isPro, proDiscount, brandColor = COLORS.red) {
  const W = doc.internal.pageSize.width
  const H = doc.internal.pageSize.height

  const { subtotalSinIva, iva, finalPrice, discount, lines = [] } = breakdown

  const blockHeight = 12 + lines.length * 6 + (isPro ? 44 : 34)
  if (y > H - blockHeight - 20) {
    doc.addPage()
    y = 38
  }

  doc.setFillColor(...COLORS.grayBg)
  doc.roundedRect(14, y, W - 28, blockHeight, 3, 3, "F")

  sectionLabel(doc, 20, y + 8, 'Resumen económico', brandColor)

  const col1 = 20
  const col2 = W - 18

  let ly = y + 16

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
    doc.text(`Descuento profesional (-${proDiscount}%)`, col1, ly)
    doc.text(`-${formatCurrency(discount)}`, col2, ly, { align: "right" })
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
export async function generateBudgetPDF(customerData = {}, configuration = {}, { skipSave = false, budgetNumberOverride = null, returnBase64 = false } = {}) {
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
    const productType    = configuration.productType ?? configuration.blindType
    const productLabel   = LABELS.productType[productType] ?? 'Estándar'
    const guideLabel     = LABELS.guideType[configuration.guideType] ?? 'Sin guías'
    const isSistemaType  = ['sistema_mini_cajon_pvc', 'sistema_mini_cajon_aluminio', 'sistema_mini_autoblocante', 'sistema_mini_pvc', 'sistema_mini_aluminio'].includes(productType)
    const isPanoType     = ['laminada', 'autoblocante', 'blocking', 'mosquitera_enrollable', 'pano_mas_guias'].includes(productType)
    const isSoloMotor    = productType === 'solo_motor'
    const isGuideProduct = ['solo_guias', 'motor_mas_guias'].includes(productType)
    const isMotorOnly    = ['autoblocante', 'blocking', 'sistema_mini_autoblocante'].includes(productType)
    const showMotorRow   = configuration.mechanism === 'motor' || isSoloMotor || isMotorOnly
    const showMecRow     = !isSoloMotor && !isGuideProduct && !isMotorOnly
    const colorName      = (name, gama) => name ? `${name} (${gama ?? '—'})` : '—'

    const tableRows = [
      ['Tipo de persiana', productLabel],
      !isSoloMotor && ['Medidas',
        isGuideProduct
          ? `${configuration.height || 0} mm (altura)`
          : `${configuration.width || 0} × ${configuration.height || 0} mm`],
      showMecRow && ['Mecanismo', LABELS.mechanism[configuration.mechanism] || '—'],
      showMotorRow && ['Tipo de motor', LABELS.motorType[configuration.motorType] || '—'],
      !isSoloMotor && ['Guías', guideLabel],
      ['Instalación', configuration.installacion === false ? 'Sin instalación' : 'Con instalación'],
      isSistemaType && ['Color del cajón', colorName(configuration.boxColorName, configuration.boxColorGama)],
      (isSistemaType || isPanoType) && ['Color de lamas', colorName(configuration.slatColorName, configuration.slatColorGama)],
      isGuideProduct && ['Color de guías', colorName(configuration.slatColorName, configuration.slatColorGama)],
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
      "Garantía: 3 años en todos los componentes y acabados.",
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
        "Persianas Santander S.L.  ·  NIF: B39476726  ·  C/ Isla Oleo, Nave 9 - Pol. Nueva Montaña, 39011 Santander",
        "942 00 00 00  ·  info@persianassantander.com  ·  www.persianassantander.com",
      ], i, pageCount)
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
            budget_status:     'pending',
            client_notes:      configuration.clientNotes || null,
          })
        }
      } catch (dbErr) {
        console.error('Fallo al guardar en Supabase:', dbErr)
      }
    }

    const safeCustomerName = (customerData.name || "Cliente").trim().replace(/[^a-z0-9]/gi, "_")

    if (returnBase64) {
      return doc.output('datauristring').split(',')[1]
    }

    doc.save(`Presupuesto_${safeCustomerName}_${budgetNumber}.pdf`)

  } catch (error) {
    console.error("Error generando PDF:", error)
  }
}

// ── PRESUPUESTO MULTI-ÍTEM (CREADO DESDE EL PANEL ADMIN) ─────────────────
export async function generateAdminMultiBudgetPDF(customerData = {}, items = [], { returnBase64 = false, budgetNumberOverride = null } = {}) {
  try {
    const doc = new jsPDF()
    const W = doc.internal.pageSize.width
    const budgetNumber = budgetNumberOverride ?? `PRE-${Date.now().toString().slice(-8)}`
    const today = formatDate(new Date())
    const logoImg = await loadImage("/persianassantanderlogo.png")
    let y = 38

    // Bloque cliente
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

    // Tabla de ítems
    const tableRows = items.map((item, idx) => {
      const dims = item.blindType === 'solo_motor' ? '—'
        : item.blindType === 'solo_guias' ? `${item.height} mm alt.`
        : `${item.width} × ${item.height} mm`
      const MOTOR_ONLY = ['autoblocante', 'blocking', 'sistema_mini_autoblocante']
      const mech = (item.blindType === 'solo_motor' || MOTOR_ONLY.includes(item.blindType))
        ? (LABELS.motorType[item.motorType] ?? '—')
        : (LABELS.mechanism[item.mechanism] ?? '—')
      const guides = item.guideType === 'none' ? 'Sin guías' : (LABELS.guideType[item.guideType] ?? '—')
      return [
        String(idx + 1),
        item.label,
        dims,
        item.colorGroup ?? '—',
        mech,
        guides,
        item.installacion ? 'Sí' : 'No',
        formatCurrency(item.priceBreakdown?.subtotalSinIva ?? 0),
      ]
    })

    autoTable(doc, {
      startY: y,
      head: [['#', 'Tipo', 'Medidas', 'Color', 'Mecanismo', 'Guías', 'Inst.', 'Precio s/IVA']],
      body: tableRows,
      headStyles: { fillColor: COLORS.red, textColor: COLORS.white, fontStyle: 'bold', fontSize: 8, cellPadding: 4 },
      bodyStyles: { fontSize: 8, cellPadding: 3.5, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.grayBg },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 38 },
        2: { cellWidth: 28 },
        3: { cellWidth: 20 },
        4: { cellWidth: 22 },
        5: { cellWidth: 18 },
        6: { cellWidth: 10 },
        7: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, top: 38, bottom: 20 },
    })
    y = doc.lastAutoTable.finalY + 12

    // Bloque de precio total
    const totalSinIva = items.reduce((sum, i) => sum + (i.priceBreakdown?.subtotalSinIva ?? 0), 0)
    const iva = totalSinIva * 0.21
    const totalConIva = totalSinIva * 1.21
    addPriceBlock(doc, y, { subtotalSinIva: totalSinIva, iva, finalPrice: totalConIva, discount: 0, lines: [] }, false, 0)

    // Cabeceras y pies
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      addPageHeader(doc, logoImg, "PRESUPUESTO", budgetNumber, today)
      addPageFooter(doc, [
        "Persianas Santander S.L.  ·  NIF: B39476726  ·  C/ Isla Oleo, Nave 9 - Pol. Nueva Montaña, 39011 Santander",
        "942 00 00 00  ·  info@persianassantander.com  ·  www.persianassantander.com",
      ], i, pageCount)
    }

    if (returnBase64) return doc.output('datauristring').split(',')[1]
    doc.save(`Presupuesto_${budgetNumber}.pdf`)
  } catch (err) {
    console.error("Error generando PDF multi-ítem:", err)
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
    const productType    = configuration.productType ?? configuration.blindType
    const productLabel   = LABELS.productType[productType] ?? 'Estándar'
    const guideLabel     = LABELS.guideType[configuration.guideType] ?? 'Sin guías'
    const isSistemaType  = ['sistema_mini_cajon_pvc', 'sistema_mini_cajon_aluminio', 'sistema_mini_autoblocante', 'sistema_mini_pvc', 'sistema_mini_aluminio'].includes(productType)
    const isPanoType     = ['laminada', 'autoblocante', 'blocking', 'mosquitera_enrollable', 'pano_mas_guias'].includes(productType)
    const isSoloMotor    = productType === 'solo_motor'
    const isGuideProduct = ['solo_guias', 'motor_mas_guias'].includes(productType)
    const isMotorOnly    = ['autoblocante', 'blocking', 'sistema_mini_autoblocante'].includes(productType)
    const showMotorRow   = configuration.mechanism === 'motor' || isSoloMotor || isMotorOnly
    const showMecRow     = !isSoloMotor && !isGuideProduct && !isMotorOnly
    const colorName      = (name, gama) => name ? `${name} (${gama ?? '—'})` : '—'

    const tableRows = [
      ['Tipo de persiana', productLabel],
      !isSoloMotor && ['Medidas',
        isGuideProduct
          ? `${configuration.height || 0} mm (altura)`
          : `${configuration.width || 0} × ${configuration.height || 0} mm`],
      showMecRow && ['Mecanismo', LABELS.mechanism[configuration.mechanism] || '—'],
      showMotorRow && ['Tipo de motor', LABELS.motorType[configuration.motorType] || '—'],
      !isSoloMotor && ['Guías', guideLabel],
      ['Instalación', configuration.installacion === false ? 'Sin instalación' : 'Con instalación'],
      isSistemaType && ['Color del cajón', colorName(configuration.boxColorName, configuration.boxColorGama)],
      (isSistemaType || isPanoType) && ['Color de lamas', colorName(configuration.slatColorName, configuration.slatColorGama)],
      isGuideProduct && ['Color de guías', colorName(configuration.slatColorName, configuration.slatColorGama)],
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
      "Garantía: 3 años en todos los componentes y acabados.",
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
      ], i, pageCount)
    }

    const safeCustomerName = (customerData.name || "Cliente").trim().replace(/[^a-z0-9]/gi, "_")
    doc.save(`Presupuesto_Cliente_${safeCustomerName}_${bNumber}.pdf`)

  } catch (error) {
    console.error("Error generando PDF cliente:", error)
  }
}

// ── FACTURA DEL PROFESIONAL PARA SU CLIENTE ──────────────────────────────
export async function generateClientInvoicePDF({
  customerData = {},
  configuration = {},
  empresa = {},
  logoUrl = null,
  clientPrice,
  invoiceNumber = null,
}) {
  try {
    const doc = new jsPDF()
    const W = doc.internal.pageSize.width
    const H = doc.internal.pageSize.height
    const iNumber = invoiceNumber ?? `F-${Date.now().toString().slice(-6)}`
    const today = formatDate(new Date())

    const finalPrice = Number(clientPrice || 0)
    const subtotalSinIva = finalPrice / 1.21
    const iva = finalPrice - subtotalSinIva

    const logoImg = logoUrl ? await loadImage(logoUrl) : null
    const brandColor = COLORS.blue

    let y = 38

    // ── BLOQUE EMISOR ─────────────────────────────────────────────────────
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
    if (empresa.telefono)          doc.text(`Tel: ${empresa.telefono}`, W - 14, y + 22, { align: "right" })
    if (empresa.email_facturacion) doc.text(empresa.email_facturacion, W - 14, y + 29, { align: "right" })
    y += 50

    // ── BLOQUE CLIENTE ────────────────────────────────────────────────────
    doc.setFillColor(...COLORS.grayBg)
    doc.roundedRect(14, y, W - 28, 36, 3, 3, "F")
    doc.setTextColor(...brandColor)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text("DATOS DEL CLIENTE / RECEPTOR", 20, y + 7)
    doc.setTextColor(...COLORS.dark)
    doc.setFontSize(10)
    doc.text(customerData.name || "Cliente no especificado", 20, y + 15)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.mid)
    const contactInfo = [customerData.phone, customerData.email].filter(Boolean).join("  ·  ")
    doc.text(contactInfo || "Sin datos de contacto", 20, y + 22)
    if (customerData.address) doc.text(customerData.address, 20, y + 29)
    if (customerData.nif) doc.text(`NIF: ${customerData.nif}`, W - 14, y + 22, { align: "right" })
    y += 44

    // ── TABLA CONCEPTOS ───────────────────────────────────────────────────
    const productLabel = LABELS.productType[configuration.productType ?? configuration.blindType] ?? 'Persiana'
    const boxLabel = ''
    const guideLabel = LABELS.guideType[configuration.guideType] ?? ''
    const hasMotor = configuration.mechanism === 'motor'

    const invoiceLines = [
      { concepto: productLabel, detalle: `${configuration.width || 0} × ${configuration.height || 0} mm · ${configuration.slatColorName ?? ''}` },
      boxLabel && { concepto: boxLabel, detalle: configuration.boxColorName ?? '' },
      guideLabel && guideLabel !== 'Sin guías' && { concepto: guideLabel, detalle: '2 uds.' },
      hasMotor && { concepto: `Motor ${LABELS.motorType[configuration.motorType] ?? ''}`, detalle: '' },
      configuration.installacion !== false && { concepto: 'Instalación', detalle: 'Incluida' },
    ].filter(Boolean)

    autoTable(doc, {
      startY: y,
      head: [['CONCEPTO', 'DETALLE', 'IMPORTE']],
      body: invoiceLines.map((line, i) => [
        line.concepto,
        line.detalle,
        i === 0 ? formatCurrency(subtotalSinIva) : '—',
      ]),
      headStyles: { fillColor: brandColor, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9, cellPadding: 5 },
      bodyStyles: { fontSize: 9, cellPadding: 4, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.grayBg },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 80, textColor: COLORS.mid },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35, halign: 'right' },
      },
      margin: { left: 14, right: 14, top: 38, bottom: 20 },
    })
    y = doc.lastAutoTable.finalY + 12

    // ── BLOQUE TOTALES ────────────────────────────────────────────────────
    if (y > H - 60) { doc.addPage(); y = 38 }
    doc.setFillColor(...COLORS.grayBg)
    doc.roundedRect(14, y, W - 28, 45, 3, 3, "F")
    doc.setTextColor(...brandColor)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text("TOTALES", 20, y + 7)

    const col1 = 20, col2 = W - 18
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.mid)
    doc.text("Base imponible", col1, y + 16)
    doc.text(formatCurrency(subtotalSinIva), col2, y + 16, { align: "right" })
    doc.text("IVA (21%)", col1, y + 23)
    doc.text(formatCurrency(iva), col2, y + 23, { align: "right" })

    doc.setDrawColor(...COLORS.border)
    doc.setLineWidth(0.3)
    doc.line(14, y + 30, W - 14, y + 30)

    doc.setFillColor(...brandColor)
    doc.roundedRect(W - 80, y + 32, 66, 14, 2, 2, "F")
    doc.setTextColor(...COLORS.white)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text(`TOTAL: ${formatCurrency(finalPrice)}`, W - 47, y + 41, { align: "center" })
    doc.setTextColor(...COLORS.mid)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text("IVA incluido", col1, y + 41)
    y += 58

    // ── CONDICIONES DE PAGO ───────────────────────────────────────────────
    if (y > H - 50) { doc.addPage(); y = 38 }
    doc.setTextColor(...brandColor)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text("FORMA DE PAGO Y CONDICIONES", 14, y + 6)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.mid)
    doc.text("Formas de pago aceptadas: Bizum · Transferencia bancaria · Efectivo.", 14, y + 13)
    doc.text("Esta factura tiene validez fiscal como documento oficial de pago.", 14, y + 20)

    // ── CABECERAS Y PIES ──────────────────────────────────────────────────
    const footerLine1 = [empresa.razon_social, empresa.cif_nif].filter(Boolean).join("  ·  ")
    const footerLine2 = [empresa.telefono, empresa.email_facturacion].filter(Boolean).join("  ·  ")

    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      addPageHeader(doc, logoImg, "FACTURA", iNumber, today, brandColor)
      addPageFooter(doc, [
        footerLine1 || "Empresa profesional",
        footerLine2 || "",
      ], i, pageCount)
    }

    const safeCustomerName = (customerData.name || "Cliente").trim().replace(/[^a-z0-9]/gi, "_")
    doc.save(`Factura_${safeCustomerName}_${iNumber}.pdf`)

  } catch (error) {
    console.error("Error generando factura cliente:", error)
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
    boxType:        null,
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

// ── PRESUPUESTO MULTI-ÍTEM PARA PROFESIONAL ───────────────────────────────
// items: [{ description, blind_type, mechanism, motor_type, guide_type, width, height,
//            box_color_name, slat_color_name, client_price }]
export async function generateGroupBudgetPDF({
  project = {},
  empresa = {},
  logoUrl = null,
  returnBase64 = false,
} = {}) {
  try {
    const doc    = new jsPDF()
    const W      = doc.internal.pageSize.width
    const H      = doc.internal.pageSize.height
    const bNum   = project.budget_number ?? `PRO-${Date.now().toString().slice(-6)}`
    const today  = formatDate(new Date())
    const items  = project.items ?? []

    const logoImg = logoUrl ? await loadImage(logoUrl) : null

    // ── CABECERA ────────────────────────────────────────────────────────────
    doc.setFillColor(...COLORS.blue)
    doc.rect(0, 0, W, 32, 'F')
    doc.setFillColor(60, 110, 190)
    doc.rect(0, 32, W, 1.5, 'F')

    if (logoImg) {
      doc.addImage(logoImg, 'PNG', 14, 6, 0, 20)
    } else {
      doc.setTextColor(...COLORS.white)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text(empresa.razon_social || 'Empresa', 14, 20)
    }

    doc.setTextColor(...COLORS.white)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('PRESUPUESTO', W - 14, 14, { align: 'right' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(bNum, W - 14, 21, { align: 'right' })
    doc.text(today, W - 14, 27, { align: 'right' })

    let y = 42

    // ── BLOQUE EMPRESA (izq) + CLIENTE (der) ────────────────────────────────
    const blockH = 38
    doc.setFillColor(...COLORS.grayBg)
    doc.roundedRect(14, y, (W - 32) / 2 - 2, blockH, 3, 3, 'F')
    doc.roundedRect(14 + (W - 32) / 2 + 2, y, (W - 32) / 2 - 2, blockH, 3, 3, 'F')

    // Empresa
    const ex = 20
    sectionLabel(doc, ex, y + 8, 'Emisor')
    doc.setTextColor(...COLORS.dark)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(empresa.razon_social || '—', ex, y + 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.mid)
    doc.text(empresa.cif_nif || '', ex, y + 22)
    doc.text(empresa.direccion_fiscal || '', ex, y + 27)
    doc.text([empresa.codigo_postal, empresa.ciudad].filter(Boolean).join(' '), ex, y + 32)
    doc.text(empresa.telefono || '', ex, y + 37)

    // Cliente
    const cx = 14 + (W - 32) / 2 + 8
    sectionLabel(doc, cx, y + 8, 'Cliente')
    doc.setTextColor(...COLORS.dark)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(project.client_name || '—', cx, y + 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.mid)
    if (project.client_nif)     doc.text(`NIF: ${project.client_nif}`, cx, y + 22)
    if (project.client_phone)   doc.text(project.client_phone, cx, y + 27)
    if (project.client_email)   doc.text(project.client_email, cx, y + 32)
    if (project.client_address) doc.text(project.client_address, cx, y + 37)

    y += blockH + 10

    // ── NOMBRE DEL PROYECTO ─────────────────────────────────────────────────
    if (project.name) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...COLORS.dark)
      doc.text(project.name, 14, y)
      y += 7
    }
    if (project.notes) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(...COLORS.mid)
      doc.text(project.notes, 14, y)
      y += 6
    }

    // ── TABLA DE ÍTEMS ──────────────────────────────────────────────────────
    const tableBody = items.map((item, i) => [
      `${i + 1}. ${item.description || '—'}`,
      LABELS.productType[item.blind_type] ?? item.blind_type ?? '—',
      item.width && item.height ? `${item.width}×${item.height} mm` : '—',
      LABELS.mechanism[item.mechanism] ?? item.mechanism ?? '—',
      [item.box_color_name, item.slat_color_name].filter(Boolean).join(' / ') || '—',
      formatCurrency(item.client_price ?? 0),
    ])

    autoTable(doc, {
      startY: y,
      head: [['Descripción', 'Tipo', 'Medidas', 'Mecanismo', 'Color', 'Precio']],
      body: tableBody,
      headStyles: { fillColor: COLORS.blue, textColor: COLORS.white, fontStyle: 'bold', fontSize: 8, cellPadding: 4 },
      bodyStyles: { fontSize: 8, cellPadding: 3.5, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.grayBg },
      columnStyles: {
        0: { cellWidth: 48 },
        1: { cellWidth: 32 },
        2: { cellWidth: 26 },
        3: { cellWidth: 24 },
        4: { cellWidth: 32 },
        5: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    })
    y = doc.lastAutoTable.finalY + 8

    // ── BLOQUE PRECIO ───────────────────────────────────────────────────────
    const totalConIva   = items.reduce((s, it) => s + (Number(it.client_price) || 0), 0)
    const subtotalSinIva = totalConIva / 1.21
    const iva = totalConIva - subtotalSinIva

    y = addPriceBlock(doc, y, {
      subtotalSinIva,
      iva,
      totalConIva,
      finalPrice: totalConIva,
      discount: 0,
    }, false, 0)

    // ── CONDICIONES ─────────────────────────────────────────────────────────
    if (y > H - 60) { doc.addPage(); y = 38 }
    doc.setTextColor(...COLORS.blue)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('CONDICIONES', 14, y + 6)
    const terms = [
      'Presupuesto válido 30 días desde la fecha de emisión.',
      'Precio orientativo sujeto a verificación de medidas en visita técnica.',
      'Plazo de entrega estimado: 7-15 días laborables desde confirmación.',
      'Garantía: 3 años en todos los componentes y acabados.',
    ]
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.mid)
    let tY = y + 13
    terms.forEach(t => {
      const lines = doc.splitTextToSize(`• ${t}`, W - 28)
      doc.text(lines, 14, tY)
      tY += lines.length * 5
    })

    // ── CABECERAS Y PIES ─────────────────────────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      // pie
      const footY = H - 12
      doc.setFillColor(...COLORS.grayBg)
      doc.rect(0, footY - 6, W, 18, 'F')
      doc.setTextColor(...COLORS.light)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      const footLines = [
        `${empresa.razon_social || ''}  ·  CIF: ${empresa.cif_nif || ''}  ·  ${empresa.direccion_fiscal || ''}`,
        `${empresa.telefono || ''}  ·  ${empresa.email_facturacion || ''}`,
      ].filter(l => l.trim().replace(/·/g, '').trim())
      footLines.forEach((line, idx) => doc.text(line, W / 2, footY - 1 + idx * 5, { align: 'center' }))
      doc.text(`Página ${i} de ${pageCount}`, W - 14, footY + 4, { align: 'right' })
    }

    if (returnBase64) {
      return doc.output('datauristring').split(',')[1]
    }

    const safeName = (project.client_name || 'Proyecto').trim().replace(/[^a-z0-9]/gi, '_')
    doc.save(`Presupuesto_${safeName}_${bNum}.pdf`)

  } catch (err) {
    console.error('Error generando presupuesto de grupo:', err)
  }
}

// ── FACTURA MULTI-ÍTEM PARA PROFESIONAL ──────────────────────────────────
export async function generateGroupInvoicePDF({
  project = {},
  empresa = {},
  logoUrl = null,
  invoiceNumber = null,
} = {}) {
  try {
    const doc    = new jsPDF()
    const W      = doc.internal.pageSize.width
    const H      = doc.internal.pageSize.height
    const iNum   = invoiceNumber ?? `F-${Date.now().toString().slice(-6)}`
    const today  = formatDate(new Date())
    const items  = project.items ?? []

    const logoImg = logoUrl ? await loadImage(logoUrl) : null

    // ── CABECERA verde oscuro ───────────────────────────────────────────────
    const brandColor = [20, 100, 50]
    doc.setFillColor(...brandColor)
    doc.rect(0, 0, W, 32, 'F')

    if (logoImg) {
      doc.addImage(logoImg, 'PNG', 14, 6, 0, 20)
    } else {
      doc.setTextColor(...COLORS.white)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text(empresa.razon_social || 'Empresa', 14, 20)
    }

    doc.setTextColor(...COLORS.white)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('FACTURA', W - 14, 14, { align: 'right' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(iNum, W - 14, 21, { align: 'right' })
    doc.text(today, W - 14, 27, { align: 'right' })

    let y = 42

    // ── BLOQUES EMPRESA + CLIENTE ───────────────────────────────────────────
    const blockH = 40
    doc.setFillColor(...COLORS.grayBg)
    doc.roundedRect(14, y, (W - 32) / 2 - 2, blockH, 3, 3, 'F')
    doc.roundedRect(14 + (W - 32) / 2 + 2, y, (W - 32) / 2 - 2, blockH, 3, 3, 'F')

    const ex = 20
    sectionLabel(doc, ex, y + 8, 'Emisor', brandColor)
    doc.setTextColor(...COLORS.dark)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(empresa.razon_social || '—', ex, y + 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.mid)
    doc.text(`CIF/NIF: ${empresa.cif_nif || '—'}`, ex, y + 22)
    doc.text(empresa.direccion_fiscal || '', ex, y + 27)
    doc.text([empresa.codigo_postal, empresa.ciudad].filter(Boolean).join(' '), ex, y + 32)
    doc.text(empresa.telefono || '', ex, y + 37)

    const cx = 14 + (W - 32) / 2 + 8
    sectionLabel(doc, cx, y + 8, 'Cliente', brandColor)
    doc.setTextColor(...COLORS.dark)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(project.client_name || '—', cx, y + 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.mid)
    if (project.client_nif)     doc.text(`NIF/DNI: ${project.client_nif}`, cx, y + 22)
    if (project.client_phone)   doc.text(project.client_phone, cx, y + 27)
    if (project.client_email)   doc.text(project.client_email, cx, y + 32)
    if (project.client_address) doc.text(project.client_address, cx, y + 37)

    y += blockH + 10

    if (project.name) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...COLORS.dark)
      doc.text(project.name, 14, y)
      y += 7
    }

    // ── TABLA ────────────────────────────────────────────────────────────────
    const tableBody = items.map((item, i) => [
      `${i + 1}. ${item.description || '—'}`,
      LABELS.productType[item.blind_type] ?? item.blind_type ?? '—',
      item.width && item.height ? `${item.width}×${item.height} mm` : '—',
      LABELS.mechanism[item.mechanism] ?? item.mechanism ?? '—',
      [item.box_color_name, item.slat_color_name].filter(Boolean).join(' / ') || '—',
      formatCurrency(item.client_price ?? 0),
    ])

    autoTable(doc, {
      startY: y,
      head: [['Descripción', 'Tipo', 'Medidas', 'Mecanismo', 'Color', 'Importe']],
      body: tableBody,
      headStyles: { fillColor: brandColor, textColor: COLORS.white, fontStyle: 'bold', fontSize: 8, cellPadding: 4 },
      bodyStyles: { fontSize: 8, cellPadding: 3.5, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.grayBg },
      columnStyles: {
        0: { cellWidth: 48 },
        1: { cellWidth: 32 },
        2: { cellWidth: 26 },
        3: { cellWidth: 24 },
        4: { cellWidth: 32 },
        5: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    })
    y = doc.lastAutoTable.finalY + 8

    // ── PRECIO ──────────────────────────────────────────────────────────────
    const totalConIva    = items.reduce((s, it) => s + (Number(it.client_price) || 0), 0)
    const subtotalSinIva = totalConIva / 1.21
    const iva = totalConIva - subtotalSinIva
    y = addPriceBlock(doc, y, { subtotalSinIva, iva, totalConIva, finalPrice: totalConIva, discount: 0 }, false, 0)

    // ── PIE ─────────────────────────────────────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      const footY = H - 12
      doc.setFillColor(...COLORS.grayBg)
      doc.rect(0, footY - 6, W, 18, 'F')
      doc.setTextColor(...COLORS.light)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      const footLines = [
        `${empresa.razon_social || ''}  ·  CIF: ${empresa.cif_nif || ''}  ·  ${empresa.direccion_fiscal || ''}`,
        `${empresa.telefono || ''}  ·  ${empresa.email_facturacion || ''}`,
      ].filter(l => l.trim().replace(/·/g, '').trim())
      footLines.forEach((line, idx) => doc.text(line, W / 2, footY - 1 + idx * 5, { align: 'center' }))
      doc.text(`Página ${i} de ${pageCount}`, W - 14, footY + 4, { align: 'right' })
    }

    const safeName = (project.client_name || 'Proyecto').trim().replace(/[^a-z0-9]/gi, '_')
    doc.save(`Factura_${safeName}_${iNum}.pdf`)

  } catch (err) {
    console.error('Error generando factura de grupo:', err)
  }
}

// ── FACTURA DE PEDIDO (cesta → Persianas Santander) ───────────────────────
// Genera la factura oficial de PS para pedidos realizados desde la cesta.
export async function generateOrderInvoicePDF({ order, invoice }) {
  try {
    const doc    = new jsPDF()
    const W      = doc.internal.pageSize.width
    const H      = doc.internal.pageSize.height
    const iNum   = invoice?.invoice_number ?? `FAC-${Date.now().toString().slice(-8)}`
    const today  = formatDate(new Date())

    const isPro         = order.user_type === 'professional'
    const proDiscount   = Number(invoice?.pro_discount ?? 0)
    const totalWithIva  = Number(invoice?.total_with_iva ?? order.total_with_iva ?? 0)
    const subtotalSinIva = totalWithIva / 1.21
    const iva            = totalWithIva - subtotalSinIva
    const discount       = isPro && proDiscount > 0 ? totalWithIva * (proDiscount / 100) : 0
    const finalPrice     = totalWithIva - discount

    const logoImg = await loadImage('/persianassantanderlogo.png')
    const billing = order.billing_data ?? {}
    const items   = invoice?.items ?? order.items ?? []

    let y = 38

    // ── BLOQUE CLIENTE ────────────────────────────────────────────────────
    doc.setFillColor(...COLORS.grayBg)
    doc.roundedRect(14, y, W - 28, 42, 3, 3, 'F')
    doc.setTextColor(...COLORS.red)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('DATOS DEL CLIENTE', 20, y + 7)

    const clientName = billing.nombre
      ? `${billing.nombre}${billing.apellidos ? ' ' + billing.apellidos : ''}`.trim()
      : 'Cliente profesional'
    doc.setTextColor(...COLORS.dark)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(clientName, 20, y + 15)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.mid)
    if (billing.dni_nif)    doc.text(`DNI/NIF: ${billing.dni_nif}`, 20, y + 22)
    if (billing.direccion)  doc.text(billing.direccion, 20, y + 29)
    const city = [billing.codigo_postal, billing.ciudad].filter(Boolean).join(' ')
    if (city) doc.text(city, 20, y + 36)
    if (billing.email) doc.text(billing.email, W - 14, y + 22, { align: 'right' })
    y += 50

    // ── TABLA DE ÍTEMS ────────────────────────────────────────────────────
    const tableBody = items.map((item, i) => [
      `${i + 1}. ${LABELS.productType[item.blind_type] ?? item.blind_type ?? '—'}`,
      item.width && item.height ? `${item.width}×${item.height} mm` : (item.height ? `${item.height} mm` : '—'),
      LABELS.mechanism[item.mechanism] ?? item.mechanism ?? '—',
      [item.box_color_name, item.slat_color_name].filter(Boolean).join(' / ') || '—',
      formatCurrency(item.estimated_price ?? 0),
    ])

    autoTable(doc, {
      startY: y,
      head: [['Concepto', 'Medidas', 'Mecanismo', 'Color', 'Importe']],
      body: tableBody,
      headStyles: { fillColor: COLORS.red, textColor: COLORS.white, fontStyle: 'bold', fontSize: 8, cellPadding: 4 },
      bodyStyles: { fontSize: 8, cellPadding: 3.5, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.grayBg },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 28 },
        2: { cellWidth: 26 },
        3: { cellWidth: 36 },
        4: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    })
    y = doc.lastAutoTable.finalY + 12

    // ── BLOQUE PRECIO ─────────────────────────────────────────────────────
    y = addPriceBlock(doc, y, { subtotalSinIva, iva, finalPrice, discount }, isPro, proDiscount)

    // ── CONDICIONES DE PAGO ───────────────────────────────────────────────
    if (y > H - 50) { doc.addPage(); y = 38 }
    doc.setTextColor(...COLORS.red)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('FORMA DE PAGO Y CONDICIONES', 14, y + 6)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.mid)
    doc.text('Formas de pago aceptadas: Bizum · Transferencia bancaria · Efectivo.', 14, y + 13)
    doc.text('Esta factura tiene validez fiscal como documento oficial de pago.', 14, y + 20)

    // ── CABECERAS Y PIES ──────────────────────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      addPageHeader(doc, logoImg, 'FACTURA', iNum, today)
      addPageFooter(doc, [
        'Persianas Santander S.L.  ·  NIF: B39476726  ·  C/ Isla Oleo, Nave 9 - Pol. Nueva Montaña, 39011 Santander',
        '942 00 00 00  ·  info@persianassantander.com  ·  www.persianassantander.com',
      ], i, pageCount)
    }

    const safeName = clientName.trim().replace(/[^a-z0-9]/gi, '_')
    doc.save(`Factura_PS_${safeName}_${iNum}.pdf`)

  } catch (err) {
    console.error('Error generando factura de pedido:', err)
  }
}

// ── COTIZACIÓN DE COMPRA PROFESIONAL ──────────────────────────────────────
export async function generateProQuotePDF(quote, proInfo = {}, { returnBase64 = false } = {}) {
  try {
    const doc      = new jsPDF({ unit: 'mm', format: 'a4' })
    const W        = doc.internal.pageSize.width
    const today    = formatDate(new Date())
    const quoteNum = `COT-${(quote.id ?? '').slice(0, 8).toUpperCase()}`

    const logoImg = await loadImage('/persianassantanderlogo.png')
    addPageHeader(doc, logoImg, 'COTIZACIÓN DE COMPRA', quoteNum, today)

    let y = 42

    // Datos del profesional — bloque gris con todos los datos fiscales
    const proLines = [
      proInfo.cif_nif           ? `CIF/NIF: ${proInfo.cif_nif}`                                           : null,
      proInfo.direccion_fiscal  ? proInfo.direccion_fiscal                                                 : null,
      [proInfo.codigo_postal, proInfo.ciudad, proInfo.provincia].filter(Boolean).join(' ') || null,
      proInfo.telefono          ? `Tel. ${proInfo.telefono}`                                               : null,
      proInfo.email             ? proInfo.email                                                            : null,
    ].filter(Boolean)

    const blockH = 10 + (proLines.length * 5.5) + 6
    doc.setFillColor(...COLORS.grayBg)
    doc.roundedRect(14, y, W - 28, blockH, 2, 2, 'F')
    sectionLabel(doc, 20, y + 8, 'Datos del profesional')
    if (proInfo.razon_social) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...COLORS.dark)
      doc.text(proInfo.razon_social, 20, y + 8 + 7)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...COLORS.mid)
      proLines.forEach((l, i) => doc.text(l, 20, y + 8 + 7 + 5.5 + i * 5.5))
    }
    y += blockH + 6

    // Tabla de persianas
    sectionLabel(doc, 14, y, 'Persianas solicitadas')
    y += 5

    const rows = (quote.items ?? []).map((it, i) => [
      String(i + 1),
      LABELS.productType[it.blind_type] ?? it.blind_type ?? '—',
      it.width && it.height ? `${it.width}×${it.height}` : '—',
      it.mechanism ? (LABELS.mechanism[it.mechanism] ?? it.mechanism) : '—',
      it.guide_type && it.guide_type !== 'none' ? (LABELS.guideType[it.guide_type] ?? it.guide_type) : '—',
      it.slat_color_name ?? '—',
      formatCurrency((it.price_professional ?? 0) * 1.21),
    ])

    autoTable(doc, {
      startY: y,
      head: [['#', 'Producto', 'Medidas (mm)', 'Mecanismo', 'Guías', 'Color lamas', 'Precio']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: COLORS.red, textColor: COLORS.white, fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 8,  halign: 'center' },
        6: { halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    })

    y = doc.lastAutoTable.finalY + 8

    // Nota del admin
    if (quote.admin_notes) {
      const noteLines = doc.splitTextToSize(quote.admin_notes, W - 36)
      const noteH     = noteLines.length * 5 + 14
      doc.setFillColor(...COLORS.grayBg)
      doc.roundedRect(14, y, W - 28, noteH, 2, 2, 'F')
      sectionLabel(doc, 20, y + 8, 'Nota de Persianas Santander')
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.dark)
      doc.text(noteLines, 20, y + 14)
      y += noteH + 6
    }

    // Bloque de precio
    const total  = quote.admin_total_con_iva ?? quote.total_con_iva ?? 0
    const sinIva = total / 1.21
    const iva    = total - sinIva
    addPriceBlock(doc, y, { subtotalSinIva: sinIva, iva, finalPrice: total, discount: 0, lines: [] }, false, 0)

    // Cabeceras y pies
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      addPageFooter(doc, [
        'Persianas Santander · NIF B39476726 · Polígono Nueva Montaña, C/ Isla Oleo, Nave 9 · Santander',
        'adminpersianassantander@gmail.com',
      ], i, pageCount)
    }

    if (returnBase64) return doc.output('datauristring').split(',')[1]
    return doc
  } catch (err) {
    console.error('Error generando PDF cotización pro:', err)
    return null
  }
}
