import { supabase } from './supabase/client'

const SESSION_KEY = 'ps_pro_discount'
const DEFAULT     = 0

export async function getProfessionalDiscount() {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'professional_discount')
      .maybeSingle()
    if (data?.value != null) {
      const v = parseFloat(data.value)
      sessionStorage.setItem(SESSION_KEY, String(v))
      return v
    }
  } catch {}
  const cached = sessionStorage.getItem(SESSION_KEY)
  return cached !== null ? parseFloat(cached) : DEFAULT
}

export async function setProfessionalDiscount(percent) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'professional_discount', value: String(percent) }, { onConflict: 'key' })
  if (!error) sessionStorage.setItem(SESSION_KEY, String(percent))
  return !error
}

// Descuento individual por profesional (professional_data.discount_percent)
// Si no tiene row o columna, cae al descuento global
export async function getProfessionalDiscountForUser(userId) {
  if (!userId) return 0
  try {
    const { data } = await supabase
      .from('professional_data')
      .select('discount_percent')
      .eq('user_id', userId)
      .maybeSingle()
    if (data?.discount_percent != null) return parseFloat(data.discount_percent)
  } catch {}
  return 0
}

export async function setProfessionalDiscountForUser(userId, percent) {
  const { error } = await supabase
    .from('professional_data')
    .update({ discount_percent: percent })
    .eq('user_id', userId)
  return !error
}
