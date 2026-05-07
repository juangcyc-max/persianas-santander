import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../services/supabase/client'
import { getProfessionalDiscountForUser } from '../../../services/settings'
import { REQUIRED_EMPRESA } from '../constants'

export function useProData() {
  const navigate = useNavigate()

  const [user,           setUser]           = useState(null)
  const [empresa,        setEmpresa]        = useState(null)
  const [configuraciones,setConfiguraciones]= useState([])
  const [cotizaciones,   setCotizaciones]   = useState([])
  const [pedidos,        setPedidos]        = useState([])
  const [facturas,       setFacturas]       = useState([])
  const [unreadMsgs,     setUnreadMsgs]     = useState(0)
  const [logoUrl,        setLogoUrl]        = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [globalDiscount, setGlobalDiscount] = useState(0)
  const [showEmpresaModal, setShowEmpresaModal] = useState(false)
  const [papelera,         setPapelera]         = useState([])

  const empresaCompleta = useCallback((e) => e && REQUIRED_EMPRESA.every(f => e[f]?.toString().trim()), [])

  async function loadData() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }
      setUser(user)

      const [empR, configR, pedR, facR, disc, cotR, unreadR, papR] = await Promise.all([
        supabase.rpc('get_professional_data', { p_user_id: user.id }).then(r => ({ data: r.data?.[0] ?? null, error: r.error })),
        supabase.from('blind_configurations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        getProfessionalDiscountForUser(user.id),
        supabase.from('pro_purchase_quotes').select('*').eq('user_id', user.id).is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('pro_messages').select('id', { count: 'exact', head: true }).eq('professional_user_id', user.id).eq('sender_role', 'admin').eq('read_by_professional', false),
        supabase.from('pro_purchase_quotes').select('id,budget_number,client_info,created_at,deleted_at,admin_total_con_iva,total_con_iva,client_total').eq('user_id', user.id).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      ])

      setGlobalDiscount(disc)
      const emp = empR.data ?? null
      setEmpresa(emp)
      setConfiguraciones(configR.data ?? [])
      setCotizaciones(cotR.data ?? [])
      setUnreadMsgs(unreadR.count ?? 0)
      setPedidos(pedR.data ?? [])
      setFacturas(facR.data ?? [])
      setPapelera(papR.data ?? [])

      if (user.id) {
        const { data: logoData } = supabase.storage.from('professional-logos').getPublicUrl(`${user.id}/logo`)
        if (logoData?.publicUrl) setLogoUrl(logoData.publicUrl + `?t=${Date.now()}`)
      }
      if (!empresaCompleta(emp)) setShowEmpresaModal(true)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() { await supabase.auth.signOut(); navigate('/') }

  return {
    user, empresa, setEmpresa,
    configuraciones, setConfiguraciones,
    cotizaciones, setCotizaciones,
    pedidos, facturas,
    unreadMsgs, setUnreadMsgs,
    logoUrl, setLogoUrl,
    loading,
    globalDiscount,
    showEmpresaModal, setShowEmpresaModal,
    empresaCompleta,
    papelera, setPapelera,
    loadData,
    handleLogout,
  }
}
