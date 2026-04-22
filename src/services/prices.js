import { supabase } from './supabase/client'

const SESSION_KEY = 'ps_product_prices'

// Precios por defecto — se usan si el admin no ha guardado nada en BD
export const DEFAULT_PRICES = {
  laminada: {
    'Grupo Base': 43,
    'Grupo 1':    44.24,
    'Grupo 2':    46.02,
    'Grupo 3':    47.61,
  },
  autoblocante: {
    'Grupo Base': 134.4,
    'Grupo 1':    166.6,
    'Grupo 2':    176.4,
    'Grupo 3':    238,
  },
  blocking: {
    'Grupo Base': 134.4,
    'Grupo 1':    166.6,
    'Grupo 2':    176.4,
    'Grupo 3':    238,
  },
  sistema_mini_cajon_pvc: {
    'Grupo Base': 100,
    'Grupo 1':    102,
    'Grupo 2':    106,
    'Grupo 3':    124.6,
  },
  sistema_mini_cajon_aluminio: {
    'Grupo Base': 105,
    'Grupo 1':    110,
    'Grupo 2':    114,
    'Grupo 3':    133,
  },
  sistema_mini_autoblocante: {
    'Grupo Base': 197.8,
    'Grupo 1':    234.18,
    'Grupo 2':    244.58,
    'Grupo 3':    323.80,
  },
  mosquitera_enrollable: {
    'Grupo Base': 80,
  },
}

export const DEFAULT_MOTOR_PRICES      = { mecanico: 120, mando_distancia: 260 }
export const DEFAULT_GUIDE_PRICE_PER_ML = { v25: 5, h25: 7 }
export const DEFAULT_INSTALACION_PRICE  = 100
export const DEFAULT_INSTALACION_FIJA   = 150

export async function getProductPrices() {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'product_prices')
      .maybeSingle()
    if (data?.value) {
      const parsed = JSON.parse(data.value)
      sessionStorage.setItem(SESSION_KEY, data.value)
      return parsed
    }
  } catch {}
  const cached = sessionStorage.getItem(SESSION_KEY)
  if (cached) {
    try { return JSON.parse(cached) } catch {}
  }
  return {
    prices:           DEFAULT_PRICES,
    motorPrices:      DEFAULT_MOTOR_PRICES,
    guidePricePerMl:  DEFAULT_GUIDE_PRICE_PER_ML,
    instalacionPrice: DEFAULT_INSTALACION_PRICE,
    instalacionFija:  DEFAULT_INSTALACION_FIJA,
  }
}

export async function setProductPrices(pricesObj) {
  const json = JSON.stringify(pricesObj)
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'product_prices', value: json }, { onConflict: 'key' })
  if (!error) sessionStorage.setItem(SESSION_KEY, json)
  return !error
}
