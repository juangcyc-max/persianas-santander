import { Helmet } from 'react-helmet-async'

export default function SEO({ 
  title, 
  description, 
  canonical,
  image = 'https://persianas-santander.vercel.app/persianassantanderlogo.png'
}) {
  const fullTitle = title 
    ? `${title} | Persianas Santander` 
    : 'Persianas Santander — Fabricación propia en Santander'

  const fullDescription = description ?? 
    'Persianas de aluminio a medida fabricadas en Santander. Configura tu persiana online, elige color y mecanismo y recibe tu presupuesto al instante. Garantía 3 años.'

  const url = canonical 
    ? `https://persianas-santander.vercel.app${canonical}`
    : 'https://persianas-santander.vercel.app'

  return (
    <Helmet>
      {/* Básico */}
      <title>{fullTitle}</title>
      <meta name="description" content={fullDescription} />
      <link rel="canonical" href={url} />

      {/* Open Graph (Facebook, WhatsApp, LinkedIn) */}
      <meta property="og:type"        content="website" />
      <meta property="og:url"         content={url} />
      <meta property="og:title"       content={fullTitle} />
      <meta property="og:description" content={fullDescription} />
      <meta property="og:image"       content={image} />
      <meta property="og:locale"      content="es_ES" />
      <meta property="og:site_name"   content="Persianas Santander" />

      {/* Twitter Card */}
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:title"       content={fullTitle} />
      <meta name="twitter:description" content={fullDescription} />
      <meta name="twitter:image"       content={image} />

      {/* Otros */}
      <meta name="robots"   content="index, follow" />
      <meta name="language" content="Spanish" />
      <meta name="author"   content="Persianas Santander S.L." />
    </Helmet>
  )
}
