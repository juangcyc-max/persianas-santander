import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../services/supabase/client'

export default function AdminChatConversation({ proUserId, proName, adminUserId, onBack }) {
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(true)
  const [sending,  setSending]  = useState(false)
  const [hoverId,  setHoverId]  = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    loadMessages()
    const channel = supabase
      .channel(`admin-chat-${proUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pro_messages',
        filter: `professional_user_id=eq.${proUserId}` },
        (payload) => setMessages(prev => [...prev, payload.new])
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pro_messages',
        filter: `professional_user_id=eq.${proUserId}` },
        (payload) => setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [proUserId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadMessages() {
    const { data } = await supabase.from('pro_messages').select('*')
      .eq('professional_user_id', proUserId).order('created_at', { ascending: true })
    setMessages(data ?? [])
    setLoading(false)
    await supabase.from('pro_messages').update({ read_by_admin: true })
      .eq('professional_user_id', proUserId).eq('sender_role', 'professional')
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || sending) return
    setSending(true)
    const text = input.trim()
    setInput('')
    await supabase.from('pro_messages').insert({
      professional_user_id: proUserId,
      sender_id:            adminUserId,
      sender_role:          'admin',
      message:              text,
      read_by_professional: false,
      read_by_admin:        true,
    })
    setSending(false)
  }

  async function handleDelete(id) {
    setMessages(prev => prev.filter(m => m.id !== id))
    await supabase.from('pro_messages').delete().eq('id', id)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 flex flex-col" style={{ height: '65vh' }}>
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="font-bold text-gray-900 text-sm">{proName}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">Sin mensajes todavía.</div>
        ) : messages.map(m => {
          const isAdmin = m.sender_role === 'admin'
          return (
            <div
              key={m.id}
              className={`flex items-end gap-1.5 ${isAdmin ? 'justify-end' : 'justify-start'}`}
              onMouseEnter={() => setHoverId(m.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              {hoverId === m.id && (
                <button
                  onClick={() => handleDelete(m.id)}
                  className={`p-1 rounded-full transition-colors flex-shrink-0 mb-1 ${isAdmin ? 'order-first text-gray-300 hover:text-red-300 hover:bg-red-900/20' : 'text-gray-300 hover:text-red-400 hover:bg-red-50'}`}
                  title="Eliminar mensaje"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                isAdmin ? 'bg-red-700 text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'
              }`}>
                <p className="leading-relaxed">{m.message}</p>
                <p className={`text-xs mt-1 ${isAdmin ? 'text-red-200' : 'text-gray-400'}`}>
                  {new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="px-4 py-3 border-t border-gray-100 flex items-center gap-3">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Escribe un mensaje…"
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400" />
        <button type="submit" disabled={!input.trim() || sending}
          className="w-10 h-10 bg-red-700 hover:bg-red-800 text-white rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  )
}
