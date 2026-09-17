'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Headphones,
  Trash2,
  Sparkles,
} from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

// Saran pertanyaan cepat
const QUICK_SUGGESTIONS = [
  'Siapa kamu?',
  'Bagaimana cara mendaftar pelatihan?',
  'Bagaimana cek status pendaftaran?',
  'Dokumen apa saja yang dibutuhkan?',
]

// Pesan sambutan awal dari Admin PSKTI
const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    'Halo! 👋 Selamat datang di SIKOMPETENSI ACEH. Saya **Admin PSKTI**, asisten virtual yang siap membantu Anda seputar pendaftaran pelatihan, cek status pendaftaran, program pelatihan, dan informasi lainnya.\n\nAda yang bisa saya bantu hari ini? 😊',
  timestamp: Date.now(),
}

export function AdminPsktiChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sessionId, setSessionId] = useState<string>('')
  const [unreadCount, setUnreadCount] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const loadRef = useRef(false)

  // Auto-scroll ke bawah saat ada pesan baru
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Focus input saat chat dibuka
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0)
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  // Kirim pesan ke API
  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading || loadRef.current) return

    loadRef.current = true
    setLoading(true)
    setError('')

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, sessionId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim pesan')
      }

      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, aiMessage])

      if (data.sessionId) {
        setSessionId(data.sessionId)
      }

      // Jika chat tidak terbuka, tambahkan unread count
      if (!isOpen) {
        setUnreadCount((c) => c + 1)
      }
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : 'Terjadi kesalahan jaringan'
      setError(errMsg)
      // Tambahkan pesan error sebagai assistant message agar user tahu
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `⚠️ ${errMsg}\n\nSilakan coba beberapa saat lagi. Jika masalah berlanjut, hubungi BPSDM Aceh via email **bpsdm@acehprov.go.id** atau telepon **0651-22000**.`,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
      loadRef.current = false
    }
  }

  // Handle submit form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  // Handle klik suggestion
  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion)
  }

  // Reset percakapan
  const handleReset = async () => {
    if (sessionId) {
      try {
        await fetch(`/api/chat?sessionId=${encodeURIComponent(sessionId)}`, {
          method: 'DELETE',
        })
      } catch {}
    }
    setMessages([WELCOME_MESSAGE])
    setSessionId('')
    setError('')
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // Format pesan: render **bold** dan newline
  const formatMessage = (content: string) => {
    return content
      .split('\n')
      .map((line, i) => (
        <span key={i} className="block">
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={j} className="font-semibold">
                  {part.slice(2, -2)}
                </strong>
              )
            }
            return <span key={j}>{part}</span>
          })}
        </span>
      ))
  }

  return (
    <>
      {/* ===== FLOATING BUTTON ===== */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key="chat-fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.5, duration: 0.5 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-[#195737] to-[#0F4C81] shadow-2xl shadow-[#195737]/40 flex items-center justify-center group"
            aria-label="Buka chat Admin PSKTI"
          >
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full bg-[#195737] animate-ping opacity-20" />

            {/* Icon */}
            <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 text-white relative z-10" />

            {/* Notification badge */}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white z-20">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}

            {/* Tooltip */}
            <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-xs font-medium px-3 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden sm:block">
              Chat dengan Admin PSKTI
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ===== CHAT WINDOW ===== */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-window"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-[400px] h-[100vh] sm:h-[600px] sm:max-h-[calc(100vh-3rem)] bg-white rounded-none sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          >
            {/* ===== HEADER ===== */}
            <div className="bg-gradient-to-r from-[#195737] to-[#0F4C81] text-white px-4 py-3.5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30">
                    <Headphones className="w-5 h-5 text-white" />
                  </div>
                  {/* Online indicator */}
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-[#195737]" />
                </div>

                {/* Name & status */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm sm:text-base truncate">
                      Admin PSKTI
                    </h3>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />
                  </div>
                  <p className="text-[11px] text-white/80 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
                    Online • Asisten Virtual
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Reset button */}
                <button
                  onClick={handleReset}
                  className="p-2 hover:bg-white/15 rounded-lg transition-colors"
                  title="Reset percakapan"
                  aria-label="Reset percakapan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {/* Close button */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/15 rounded-lg transition-colors"
                  title="Tutup"
                  aria-label="Tutup chat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* ===== MESSAGES AREA ===== */}
            <div className="flex-1 overflow-y-auto bg-slate-50 px-3 sm:px-4 py-4 space-y-3 scroll-smooth">
              {/* Info banner */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-center">
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  💬 Saya asisten AI yang siap membantu Anda seputar layanan
                  SIKOMPETENSI ACEH
                </p>
              </div>

              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${
                    msg.role === 'user'
                      ? 'justify-end'
                      : 'justify-start'
                  }`}
                >
                  <div
                    className={`flex gap-2 max-w-[85%] ${
                      msg.role === 'user'
                        ? 'flex-row-reverse'
                        : 'flex-row'
                    }`}
                  >
                    {/* Avatar for assistant */}
                    {msg.role === 'assistant' && (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#195737] to-[#0F4C81] flex items-center justify-center mt-0.5">
                        <Headphones className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}

                    {/* Message bubble */}
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[#0F4C81] text-white rounded-br-md'
                          : 'bg-white text-slate-700 rounded-bl-md border border-slate-200 shadow-sm'
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">
                        {formatMessage(msg.content)}
                      </div>
                      <span
                        className={`block text-[10px] mt-1 ${
                          msg.role === 'user'
                            ? 'text-white/60'
                            : 'text-slate-400'
                        }`}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="flex gap-2 max-w-[85%]">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#195737] to-[#0F4C81] flex items-center justify-center mt-0.5">
                      <Headphones className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ===== QUICK SUGGESTIONS ===== */}
            {messages.length <= 1 && !loading && (
              <div className="px-3 py-2 bg-white border-t border-slate-100 flex flex-wrap gap-1.5 flex-shrink-0">
                {QUICK_SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-[11px] px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-[#195737]/10 hover:text-[#195737] text-slate-600 transition-colors border border-slate-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* ===== INPUT AREA ===== */}
            <form
              onSubmit={handleSubmit}
              className="bg-white border-t border-slate-200 p-3 flex items-center gap-2 flex-shrink-0"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ketik pesan Anda..."
                maxLength={2000}
                disabled={loading}
                className="flex-1 px-4 py-2.5 text-sm bg-slate-50 rounded-full border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#195737]/20 focus:border-[#195737] transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#195737] to-[#0F4C81] text-white flex items-center justify-center hover:shadow-lg hover:shadow-[#195737]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                aria-label="Kirim pesan"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>

            {/* Footer info */}
            <div className="bg-slate-50 border-t border-slate-100 px-4 py-1.5 text-center flex-shrink-0">
              <p className="text-[10px] text-slate-400">
                Powered by AI • BPSDM Aceh - Bidang PSKTI
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
