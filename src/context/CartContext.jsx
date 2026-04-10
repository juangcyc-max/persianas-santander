import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase/client'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(false)
  const [user,    setUser]    = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) loadCart(user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadCart(session.user.id)
      else setItems([])
    })
    return () => subscription.unsubscribe()
  }, [])

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

  // estimated_price ya incluye IVA y descuento profesional aplicado
  const totalPrice    = items.reduce((acc, i) => acc + (i.blind_configurations?.estimated_price ?? 0) * i.quantity, 0)
  const totalWithIva  = totalPrice
  const itemCount     = items.reduce((acc, i) => acc + i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, loading, user, itemCount, totalPrice, totalWithIva, addToCart, removeFromCart, clearCart, loadCart }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)