'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Copy, Plus, Send, Sparkles, Square, Volume2 } from 'lucide-react'

type UIMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED_PROMPTS = [
  'Explain the present perfect tense with simple examples',
  'Sửa lỗi ngữ pháp giúp mình: "I go to school yesterday and meet my friend"',
  'Cho mình 8 từ vựng tiếng Anh thông dụng khi đi du lịch kèm nghĩa',
  'Viết một đoạn hội thoại ngắn khi gọi món ở quán cà phê',
]

export default function ChatBot() {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeModel, setActiveModel] = useState<string>('auto (model nhẹ)')
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
  }

  const handleSend = async (customText?: string) => {
    const text = (customText ?? input).trim()
    if (!text || isStreaming) return

    setError(null)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const userMsg: UIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }
    const aiMsgId = `ai-${Date.now() + 1}`

    const prevHistory = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    // Thêm tin nhắn user và khung tin nhắn AI rỗng để nhận stream chữ từng từ
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: aiMsgId, role: 'assistant', content: '' },
    ])
    setIsStreaming(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const response = await fetch('/student-chat-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: prevHistory,
        }),
        signal: controller.signal,
      })

      const modelHeader = response.headers.get('X-AI-Model')
      if (modelHeader) {
        setActiveModel(modelHeader)
      }

      if (!response.ok || !response.body) {
        let errMsg = `Lỗi phản hồi (HTTP ${response.status})`
        try {
          const errJson = await response.json()
          if (errJson?.error) errMsg = errJson.error
        } catch {
          // ignore
        }
        setError(errMsg)
        // Xóa khung AI rỗng nếu lỗi
        setMessages((prev) => prev.filter((m) => m.id !== aiMsgId))
        setIsStreaming(false)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        if (chunk) {
          accumulated += chunk
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, content: accumulated } : m)),
          )
        }
      }

      if (!accumulated.trim()) {
        setError('AI không trả về nội dung. Vui lòng thử lại.')
        setMessages((prev) => prev.filter((m) => m.id !== aiMsgId))
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError('Lỗi kết nối khi nhận phản hồi streaming. Vui lòng thử lại.')
        setMessages((prev) => prev.filter((m) => m.id !== aiMsgId || m.content.trim().length > 0))
      }
    } finally {
      abortControllerRef.current = null
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
  }

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      // ignore clipboard errors
    }
  }

  const handleSpeak = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const isVietnamese =
      /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = isVietnamese ? 'vi-VN' : 'en-US'
    utterance.rate = 0.95
    window.speechSynthesis.speak(utterance)
  }

  const handleNewChat = () => {
    handleStop()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setMessages([])
    setError(null)
    setInput('')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 p-3 md:p-4 font-sans">
      <div className="max-w-4xl mx-auto h-[calc(100vh-2rem)] flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {/* ================= HEADER ================= */}
        <header className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/student/speaking"
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-600 border border-gray-200 flex items-center justify-center text-gray-500 transition shrink-0"
              title="Quay lại Luyện nói"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <img
              src="/images/ai-avatar.jpg"
              alt="AI Avatar"
              className="w-9 h-9 rounded-full object-cover border-2 border-red-200 shrink-0"
            />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-gray-900 truncate">Trợ lý Chatbot AI</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                  {activeModel}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate">
                Streaming thời gian thực · Hỏi đáp &amp; luyện tiếng Anh
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNewChat}
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gray-100 hover:bg-red-50 border border-gray-200 hover:border-red-300 text-xs md:text-sm font-medium text-gray-700 hover:text-red-600 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Chat mới</span>
          </button>
        </header>

        {/* ================= VÙNG TIN NHẮN ================= */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-5 bg-white">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-8 px-4">
              <img
                src="/images/ai-avatar.jpg"
                alt="AI Avatar"
                className="w-16 h-16 rounded-full object-cover border-2 border-red-200 shadow-sm mb-4"
              />
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                VietAPI Streaming · Phản hồi nhanh
              </span>
              <h2 className="text-xl font-bold text-gray-900">
                Hôm nay bạn muốn hỏi gì nào?
              </h2>
              <p className="text-sm text-gray-500 mt-1 max-w-md">
                Nhập câu hỏi tiếng Anh hoặc tiếng Việt bên dưới, chữ sẽ chạy ra ngay lập tức giống ChatGPT.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-6 w-full max-w-2xl">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    className="text-left p-3.5 rounded-xl bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-300 text-sm text-gray-700 hover:text-red-700 transition"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => {
                const isLastStreamingAI =
                  isStreaming && msg.role === 'assistant' && idx === messages.length - 1

                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[85%] md:max-w-[75%] bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm md:text-[15px] leading-relaxed whitespace-pre-wrap shadow-sm">
                        {msg.content}
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={msg.id} className="flex items-start gap-2.5 max-w-[90%] md:max-w-[82%]">
                    <img
                      src="/images/ai-avatar.jpg"
                      alt="AI"
                      className={`w-8 h-8 rounded-full object-cover border border-red-200 shrink-0 mt-0.5 ${
                        isLastStreamingAI ? 'animate-pulse border-red-400' : ''
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm md:text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {msg.content ? (
                          <>
                            {msg.content}
                            {isLastStreamingAI && (
                              <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-red-500 animate-pulse rounded-sm" />
                            )}
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 py-1">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce [animation-delay:0ms]" />
                            <span className="w-2 h-2 bg-red-400 rounded-full animate-bounce [animation-delay:150ms]" />
                            <span className="w-2 h-2 bg-rose-400 rounded-full animate-bounce [animation-delay:300ms]" />
                          </span>
                        )}
                      </div>

                      {!isLastStreamingAI && msg.content && (
                        <div className="flex items-center gap-1.5 mt-1.5 pl-1">
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Sao chép"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-600">Đã chép</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Sao chép</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSpeak(msg.content)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Đọc to"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Nghe</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 text-center">
                  ⚠️ {error}
                </div>
              )}

              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* ================= Ô NHẬP TIN NHẮN ================= */}
        <div className="p-3.5 md:p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-end gap-2.5 bg-white border border-gray-300 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100 rounded-2xl px-3.5 py-2.5 transition shadow-sm">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInputResize}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              placeholder="Nhập tin nhắn để trò chuyện với AI... (Enter để gửi, Shift+Enter để xuống dòng)"
              className="flex-1 resize-none bg-transparent text-sm md:text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none max-h-40 leading-relaxed py-1"
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="w-10 h-10 rounded-xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-sm transition shrink-0"
                title="Dừng trả lời"
              >
                <Square className="w-4 h-4 fill-white" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className="w-10 h-10 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-sm transition shrink-0"
                title="Gửi tin nhắn"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
