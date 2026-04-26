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

// Si el admin ha puesto un descuento individual (discount_percent no null), prevalece sobre el global
export async function getProfessionalDiscountForUser(userId) {
  try {
    const { data } = await supabase
      .from('professional_data')
      .select('discount_percent')
      .eq('user_id', userId)
      .maybeSingle()
    if (data?.discount_percent !== null && data?.discount_percent !== undefined)
      return parseFloat(data.discount_percent)
  } catch {}
  return getProfessionalDiscount()
}

// percent = número o null (null → usa el descuento global)
export async function setProfessionalDiscountForUser(userId, percent) {
  const { error } = await supabase.rpc('admin_set_professional_discount', {
    target_user_id: userId,
    discount: percent ?? null,
  })
  return !error
}
