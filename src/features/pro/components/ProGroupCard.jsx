import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../../../context/CartContext'
import { fmt, fmtDate, blindLabel } from '../constants'
import Spinner from './Spinner'

export default function ProGroupCard({ items, onDeleteGroup, deleting, isExpanded, onToggle, globalDiscount = 0 }) {
  const { addToCart, items: cartItems, orderedConfigIds } = useCart()
  const navigate = useNavigate()
  const [adding,  setAdding] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const total      = items.reduce((s, c) => s + (c.estimated_price ?? 0) * (1 - globalDiscount / 100), 0)
  const inCart     = cartItems.length > 0 && items.every(c => cartItems.some(ci => ci.configuration_id === c.id))
  const isOrdered  = !inCart && items.every(c => orderedConfigIds.has(c.id))
  const allInCart  = inCart || isOrdered

  async function handleAddAllToCart() {
    setAdding(true)
    for (const c of items) await addToCart(c.id)
    setAdding(false)
    setTimeout(() => navigate('/cesta'), 600)
  }

  const borderCls = allInCart
    ? 'bg-green-50 border-green-200'
    : 'bg-white border-red-100 hover:border-red-200 hover:shadow-sm'

  return (
    <div className={`border-2 rounded-2xl overflow-hidden transition-all ${borderCls}`}>
      {/* ── Cabecera siempre visible (toggle) ── */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {allInCart ? (
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          )}
          <span className={`text-xs font-bold truncate ${allInCart ? 'text-green-700' : 'text-red-700'}`}>
            {allInCart ? 'En cesta · ' : ''}Grupo · {items.length} persianas
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className={`text-sm font-black ${allInCart ? 'text-green-700' : 'text-red-700'}`}>{fmt(total)}</span>
          <span className="text-xs text-gray-400">{fmtDate(items[0].created_at)}</span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Detalle expandido ── */}
      {isExpanded && (
        <div className={`px-4 pb-4 pt-3 border-t space-y-3 ${allInCart ? 'border-green-100' : 'border-gray-100'}`}>
          {/* Lista */}
          <div className="space-y-2">
            {items.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold flex-shrink-0 text-[10px] ${allInCart ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{blindLabel(c.blind_type)}</p>
                  {c.width && c.height && <p className="text-gray-400">
                    {c.width} × {c.height} mm
                    {c.mechanism ? ` · ${c.mechanism}` : ''}
                    {c.mechanism === 'cinta' && c.orientation ? ` (${c.orientation})` : ''}
                    {c.mechanism === 'motor' && c.motor_type ? ` · ${c.motor_type}` : ''}
                    {c.guide_type && c.guide_type !== 'none' ? ` · guía ${c.guide_type}` : ''}
                  </p>}
                </div>
                <span className="font-bold text-gray-700 flex-shrink-0">{fmt((c.estimated_price ?? 0) * (1 - globalDiscount / 100))}</span>
              </div>
            ))}
          </div>

          {/* Acciones */}
          {isOrdered ? (
            <button disabled className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-green-100 text-green-700 cursor-default flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Ya pedido
            </button>
          ) : allInCart ? (
            <button onClick={() => navigate('/cesta')}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-green-600 text-white hover:bg-green-700 transition-colors">
              Ir a la cesta →
            </button>
          ) : (
            <>
              <button onClick={handleAddAllToCart} disabled={adding}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-60"
              >
                {adding ? <Spinner small /> : (
                  <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>Añadir todo a la cesta</>
                )}
              </button>
              {onDeleteGroup && (
                <div className="flex justify-end">
                  {confirm ? (
                    <div className="flex gap-1.5">
                      <button onClick={() => setConfirm(false)}
                        className="text-xs font-semibold py-2 px-3 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
                        Cancelar
                      </button>
                      <button onClick={onDeleteGroup} disabled={!!deleting}
                        className="text-xs font-bold py-2 px-3 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center gap-1.5">
                        {deleting ? <Spinner small /> : null}
                        Eliminar grupo
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirm(true)}
                      className="text-xs font-semibold py-2 px-3 rounded-lg border border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Eliminar grupo
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
