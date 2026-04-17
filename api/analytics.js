// Vercel serverless function — llama a GA4 Data API con cuenta de servicio
// Credenciales en variable de entorno: GOOGLE_SERVICE_ACCOUNT_KEY (JSON stringificado)

import { createSign } from 'crypto'

const SCOPES = 'https://www.googleapis.com/auth/analytics.readonly'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GA4_URL = 'https://analyticsdata.googleapis.com/v1beta'

function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function getAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({
    iss: credentials.client_email,
    scope: SCOPES,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  }))

  const sign = createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const sig = sign.sign(credentials.private_key, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const jwt = `${header}.${payload}.${sig}`

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json()
  return data.access_token
}

async function runReport(propertyId, token, body) {
  const res = await fetch(`${GA4_URL}/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
    const propertyId  = process.env.GA4_PROPERTY_ID

    if (!credentials || !propertyId) {
      return res.status(500).json({ error: 'Missing env vars' })
    }

    const token = await getAccessToken(credentials)

    const [overviewRes, pagesRes, sourcesRes, devicesRes] = await Promise.all([
      // Usuarios y sesiones últimos 30 días
      runReport(propertyId, token, {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
        ],
      }),
      // Top 10 páginas
      runReport(propertyId, token, {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10,
      }),
      // Fuentes de tráfico
      runReport(propertyId, token, {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      }),
      // Dispositivos
      runReport(propertyId, token, {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'sessions' }],
      }),
    ])

    // Parsear overview
    const row = overviewRes.rows?.[0]?.metricValues ?? []
    const overview = {
      activeUsers:             parseInt(row[0]?.value ?? 0),
      sessions:                parseInt(row[1]?.value ?? 0),
      pageViews:               parseInt(row[2]?.value ?? 0),
      bounceRate:              parseFloat(row[3]?.value ?? 0),
      avgSessionDuration:      parseFloat(row[4]?.value ?? 0),
    }

    const topPages = (pagesRes.rows ?? []).map(r => ({
      path:  r.dimensionValues[0].value,
      views: parseInt(r.metricValues[0].value),
    }))

    const sources = (sourcesRes.rows ?? []).map(r => ({
      channel:  r.dimensionValues[0].value,
      sessions: parseInt(r.metricValues[0].value),
    }))

    const devices = (devicesRes.rows ?? []).map(r => ({
      device:   r.dimensionValues[0].value,
      sessions: parseInt(r.metricValues[0].value),
    }))

    return res.status(200).json({ overview, topPages, sources, devices })

  } catch (err) {
    console.error('GA analytics error:', err)
    return res.status(500).json({ error: err.message })
  }
}
