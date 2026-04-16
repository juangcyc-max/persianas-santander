import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase/client'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items,            setItems]            = useState([])
  const [loading,          setLoading]          = useState(false)
  const [user,             setUser]             = useState(null)
  const [orderedConfigIds, setOrderedConfigIds] = useState(new Set())

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) { loadCart(user.id); loadOrderedIds(user.id) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (session?.user) { loadCart(session.user.id); loadOrderedIds(session.user.id) }
      else { setItems([]); setOrderedConfigIds(new Set()) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadOrderedIds(userId) {
    const { data } = await supabase.from('orders').select('items').eq('user_id', userId)
    const ids = new Set()
    ;(data ?? []).forEach(order =>
      (order.items ?? []).forEach(item => { if (item.configuration_id) ids.add(item.configuration_id) })
    )
    setOrderedConfigIds(ids)
  }

  async function loadCart(userId) {
    const { data } = await supabase
      .from('cart_items')
      .select('*, blind_configurations(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setItems(data ?? [])
  }

  async function addToCart(configurationId) {
    if (!user) return { error: 'not_logged_in' }
    setLoading(true)
    // Comprobar si ya está en la cesta
    const existing = items.find(i => i.configuration_id === configurationId)
    if (existing) {
      await supabase.from('cart_items').update({ quantity: existing.quantity + 1 }).eq('id', existing.id)
    } else {
      await supabase.from('cart_items').insert({ user_id: user.id, configuration_id: configurationId })
    }
    await loadCart(user.id)
    setLoading(false)
    return { error: null }
  }

  async function removeFromCart(cartItemId) {
    await supabase.from('cart_items').delete().eq('id', cartItemId)
    setItems(prev => prev.filter(i => i.id !== cartItemId))
  }

  async function clearCart() {
    if (!user) return
    await supabase.from('cart_items').delete().eq('user_id', user.id)
    setItems([])
  }

  // estimated_price ya incluye IVA; totalWithIva = suma total con IVA, totalPrice = base sin IVA
  const totalWithIva  = items.reduce((acc, i) => acc + (i.blind_configurations?.estimated_price ?? 0) * i.quantity, 0)
  const totalPrice    = totalWithIva / 1.21
  const itemCount     = items.reduce((acc, i) => acc + i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, loading, user, itemCount, totalPrice, totalWithIva, orderedConfigIds, addToCart, removeFromCart, clearCart, loadCart }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)