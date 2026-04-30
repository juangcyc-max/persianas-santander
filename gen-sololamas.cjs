// Regenera sololamas.png excluyendo los carriles de guía (columnas laterales)
// Las guías están aproximadamente en x <= 530 (izquierda) y x >= 1430 (derecha)
const { PNG } = require('pngjs')
const fs = require('fs')
const path = require('path')

const publicDir = path.join(__dirname, 'public')

function loadPNG(name) {
  const buf = fs.readFileSync(path.join(publicDir, name))
  return PNG.sync.read(buf)
}

const persiana = loadPNG('persianacompleta.png')
const caja = loadPNG('caja.png')

const { width, height } = persiana
console.log(`Dimensiones: ${width}x${height}`)

const out = new PNG({ width, height })

// Columnas de guías: excluir de sololamas para que queden en color de caja
const LEFT_GUIDE_MAX = 530    // x <= esto = guía izquierda
const RIGHT_GUIDE_MIN = 1430  // x >= esto = guía derecha

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4
    out.data[i]   = persiana.data[i]
    out.data[i+1] = persiana.data[i+1]
    out.data[i+2] = persiana.data[i+2]

    // Calcular diferencia alpha (persiana - caja = slats + guías)
    const slatAlpha = Math.max(0, persiana.data[i+3] - caja.data[i+3])

    // Solo incluir si está en la zona de lamas (no en guías laterales)
    const isGuide = (x <= LEFT_GUIDE_MAX || x >= RIGHT_GUIDE_MIN)
    out.data[i+3] = isGuide ? 0 : slatAlpha
  }
}

const outBuf = PNG.sync.write(out)
fs.writeFileSync(path.join(publicDir, 'sololamas.png'), outBuf)
console.log('sololamas.png generado correctamente')
console.log(`Zona lamas: columnas ${LEFT_GUIDE_MAX+1} a ${RIGHT_GUIDE_MIN-1}`)

// ─── Generar sologuias.png (solo carriles laterales) ────────────────────────
const outGuias = new PNG({ width, height })

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4
    outGuias.data[i]   = persiana.data[i]
    outGuias.data[i+1] = persiana.data[i+1]
    outGuias.data[i+2] = persiana.data[i+2]

    // Solo incluir si está en la zona de guías laterales, persiana tiene contenido y NO es cajón
    const isGuideCol = (x <= LEFT_GUIDE_MAX || x >= RIGHT_GUIDE_MIN)
    const persianaAlpha = persiana.data[i+3]
    const cajaAlpha = caja.data[i+3]
    outGuias.data[i+3] = (isGuideCol && persianaAlpha > 0 && cajaAlpha === 0) ? persianaAlpha : 0
  }
}

const outGuiasBuf = PNG.sync.write(outGuias)
fs.writeFileSync(path.join(publicDir, 'sologuias.png'), outGuiasBuf)
console.log('sologuias.png generado correctamente')
console.log(`Zona guías: columnas 0-${LEFT_GUIDE_MAX} y ${RIGHT_GUIDE_MIN}-${width}`)
