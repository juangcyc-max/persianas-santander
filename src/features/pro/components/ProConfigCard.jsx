import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../../../context/CartContext'
import { fmt, fmtDate, blindLabel } from '../constants'
import Spinner from './Spinner'

export default function ProConfigCard({ c, onDelete, deleting, isExpanded, onToggle, globalDiscount = 0 }) {
  const navigate               = useNavigate()
  const { addToCart, items: cartItems, orderedConfigIds } = useCart()
  const [adding,     setAdding]    = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const inCart    = cartItems.some(ci => ci.configuration_id === c.id)
  const isOrdered = !inCart && orderedConfigIds.has(c.id)
  const added     = inCart || isOrdered

  async function handleAddToCart() {
    setAdding(true)
    const { error } = await addToCart(c.id)
    setAdding(false)
    if (!error) setTimeout(() => navigate('/cesta'), 600)
  }

  const borderCls = added
    ? 'bg-green-50 border-green-200'
    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${borderCls}`}>
      {/* ── Cabecera colapsable ── */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {added ? (
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          )}
          <span className={`text-xs font-bold truncate ${added ? 'text-green-700' : 'text-gray-800'}`}>
            {added ? 'En cesta · ' : ''}{blindLabel(c.blind_type)}
          </span>
          {!added && c.width && c.height && (
            <span className="text-xs text-gray-400">· {c.width}×{c.height}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className={`text-sm font-black ${added ? 'text-green-700' : 'text-red-700'}`}>{fmt((c.estimated_price ?? 0) * (1 - globalDiscount / 100))}</span>
          <span className="text-xs text-gray-400">{fmtDate(c.created_at)}</span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Detalle expandido ── */}
      {isExpanded && (
        <div className={`px-4 pb-4 pt-3 border-t space-y-3 ${added ? 'border-green-100' : 'border-gray-100'}`}>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {c.width && c.height && <span>{c.width} × {c.height} mm</span>}
            {c.mechanism && <span>
              {c.mechanism}
              {c.mechanism === 'cinta' && c.orientation ? ` (${c.orientation})` : ''}
              {c.mechanism === 'motor' && c.motor_type ? ` · ${c.motor_type}` : ''}
            </span>}
            {c.guide_type && c.guide_type !== 'none' && <span>guía {c.guide_type}</span>}
            {c.slat_color_name && <span>{c.slat_color_name}</span>}
          </div>

          {isOrdered ? (
            <button disabled className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-green-100 text-green-700 cursor-default flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Ya pedida
            </button>
          ) : added ? (
            <button onClick={() => navigate('/cesta')}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-green-600 text-white hover:bg-green-700 transition-colors">
              Ir a la cesta →
            </button>
          ) : (
            <button onClick={handleAddToCart} disabled={adding}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-60 transition-colors">
              {adding ? <Spinner small /> : (
                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>Añadir a la cesta</>
              )}
            </button>
          )}

          <div className="flex gap-2">
            <button onClick={() => navigate('/configurador')}
              className="flex-1 text-xs font-semibold py-2 px-3 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
              Nueva similar
            </button>
            {onDelete && confirmDel ? (
              <div className="flex gap-1.5">
                <button onClick={() => setConfirmDel(false)}
                  className="text-xs font-semibold py-2 px-3 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={() => onDelete(c.id)} disabled={deleting === c.id}
                  className="text-xs font-bold py-2 px-3 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center gap-1.5">
                  {deleting === c.id ? <Spinner small /> : null}Eliminar
                </button>
              </div>
            ) : onDelete ? (
              <button onClick={() => setConfirmDel(true)}
                className="text-xs font-semibold py-2 px-3 rounded-lg border border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
