import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../services/supabase/client'
import SectionHeader from '../components/SectionHeader'

export default function MensajesTab({ userId, onRead }) {
  const [messages,  setMessages]  = useState([])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(true)
  const [sending,   setSending]   = useState(false)
  const [hoverId,   setHoverId]   = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    loadMessages()
    const channel = supabase
      .channel(`pro-chat-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pro_messages',
        filter: `professional_user_id=eq.${userId}` },
        (payload) => setMessages(prev => [...prev, payload.new])
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pro_messages',
        filter: `professional_user_id=eq.${userId}` },
        (payload) => setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    const { data } = await supabase
      .from('pro_messages')
      .select('*')
      .eq('professional_user_id', userId)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setLoading(false)
    await supabase.from('pro_messages')
      .update({ read_by_professional: true })
      .eq('professional_user_id', userId)
      .eq('sender_role', 'admin')
    onRead?.()
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || sending) return
    setSending(true)
    const text = input.trim()
    setInput('')
    await supabase.from('pro_messages').insert({
      professional_user_id: userId,
      sender_id:            userId,
      sender_role:          'professional',
      message:              text,
      read_by_admin:        false,
      read_by_professional: true,
    })
    setSending(false)
  }

  async function handleDelete(id) {
    setMessages(prev => prev.filter(m => m.id !== id))
    await supabase.from('pro_messages').delete().eq('id', id)
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Mensajes" />
      <div className="bg-white rounded-2xl border border-gray-200 flex flex-col h-[60vh] sm:h-[65vh]">
        {/* Cabecera */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-red-700 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Persianas Santander</p>
            <p className="text-xs text-gray-400">Chat directo con el equipo</p>
          </div>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-sm text-gray-400">Ningún mensaje todavía.</p>
              <p className="text-xs text-gray-300 mt-1">Escríbenos cualquier consulta sobre tu cotización o pedido.</p>
            </div>
          ) : (
            messages.map(m => {
              const isMe = m.sender_role === 'professional'
              return (
                <div
                  key={m.id}
                  className={`flex items-end gap-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}
                  onMouseEnter={() => setHoverId(m.id)}
                  onMouseLeave={() => setHoverId(null)}
                >
                  {/* Botón eliminar — solo mis mensajes, visible al hover */}
                  {isMe && hoverId === m.id && (
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="p-1 rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0 mb-1"
                      title="Eliminar mensaje"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                    isMe ? 'bg-red-700 text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}>
                    <p className="leading-relaxed">{m.message}</p>
                    <p className={`text-xs mt-1 ${isMe ? 'text-red-200' : 'text-gray-400'}`}>
                      {new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="px-4 py-3 border-t border-gray-100 flex items-center gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Escribe un mensaje…"
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400"
          />
          <button type="submit" disabled={!input.trim() || sending}
            className="w-10 h-10 bg-red-700 hover:bg-red-800 text-white rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
