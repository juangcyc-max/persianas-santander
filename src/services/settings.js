import { supabase } from './supabase/client'

const SESSION_KEY = 'ps_pro_discount'
const DEFAULT     = 20

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
