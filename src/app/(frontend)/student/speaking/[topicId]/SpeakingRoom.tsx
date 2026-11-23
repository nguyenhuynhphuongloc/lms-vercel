'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Flame,
  HelpCircle,
  Languages,
  Lightbulb,
  Mic,
  RefreshCw,
  Square,
  ThumbsDown,
  Trophy,
  User,
  Volume2,
  X,
} from 'lucide-react'
import {
  getSpeakingFeedback,
  synthesizeSpeech,
  transcribeAudio,
  translateText,
} from '../actions'
import type { SpeakingTopic } from '../topics'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  translation?: string
  isTranslating?: boolean
  correction?: string | null
  showCorrection?: boolean
  revealedOverride?: boolean | null
}

type SpeakingRoomProps = {
  topic: SpeakingTopic
}

export default function SpeakingRoom({ topic }: SpeakingRoomProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'opening',
      role: 'assistant',
      content: topic.openingMessage,
      revealedOverride: null,
    },
  ])
  const [isRecording, setIsRecording] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Sidebar states
  const [completedTasks, setCompletedTasks] = useState<boolean[]>(() =>
    topic.tasks.map(() => false),
  )
  const [showTaskHelp, setShowTaskHelp] = useState(false)
  const [expandDesc, setExpandDesc] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(true)

  // Settings toggles
  const [showAiReply, setShowAiReply] = useState(true)
  const [showHints, setShowHints] = useState(false)
  const [showCorrections, setShowCorrections] = useState(true)
  const [currentHint, setCurrentHint] = useState<string>(topic.initialHint)

  // Feedback Modal & Completion Popup
  const [completionPopupOpen, setCompletionPopupOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackData, setFeedbackData] = useState<{ score?: number; feedback?: string } | null>(
    null,
  )

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const speechRecognitionRef = useRef<any>(null)
  const speechTranscriptRef = useRef<string>('')
  const speechStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSubmittingRef = useRef<boolean>(false)
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const messagesRef = useRef<ChatMessage[]>(messages)
  const prevAllTasksDoneRef = useRef(false)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Tự động mở popup kết thúc phiên AI khi tất cả nhiệm vụ đã hoàn thành
  useEffect(() => {
    const allDone = topic.tasks.length > 0 && completedTasks.every(Boolean)
    if (allDone && !prevAllTasksDoneRef.current) {
      prevAllTasksDoneRef.current = true
      const timer = setTimeout(() => {
        setCompletionPopupOpen(true)
      }, 400)
      return () => clearTimeout(timer)
    }
    if (!allDone) {
      prevAllTasksDoneRef.current = false
    }
  }, [completedTasks, topic.tasks.length])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isProcessing, showHints])

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setIsSpeaking(false)
    setSpeakingMsgId(null)
  }, [])

  const speak = useCallback(
    async (text: string, msgId?: string) => {
      stopSpeaking()
      setIsSpeaking(true)
      setSpeakingMsgId(msgId || null)

      try {
        const result = await synthesizeSpeech(text)

        if ('audio' in result && result.audio) {
          const audioBlob = new Blob(
            [Uint8Array.from(atob(result.audio), (c) => c.charCodeAt(0))],
            { type: result.mimeType || 'audio/mpeg' },
          )
          const url = URL.createObjectURL(audioBlob)
          const audio = new Audio(url)
          audioRef.current = audio
          audio.onended = () => {
            URL.revokeObjectURL(url)
            setIsSpeaking(false)
            setSpeakingMsgId(null)
          }
          audio.onerror = () => {
            setIsSpeaking(false)
            setSpeakingMsgId(null)
          }
          await audio.play()
        } else {
          window.speechSynthesis.cancel()
          const isVietnamese =
            /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)
          const utterance = new SpeechSynthesisUtterance(text)
          utterance.lang = isVietnamese ? 'vi-VN' : 'en-US'
          utterance.rate = 0.95
          utterance.pitch = 1.0

          const voices = window.speechSynthesis.getVoices()
          const preferredVoice = isVietnamese
            ? voices.find((v) => v.lang.toLowerCase().startsWith('vi'))
            : voices.find(
                (v) =>
                  v.lang.startsWith('en') &&
                  (v.name.includes('Google') ||
                    v.name.includes('Samantha') ||
                    v.name.includes('Natural') ||
                    v.name.includes('Aria')),
              )
          if (preferredVoice) utterance.voice = preferredVoice

          utterance.onend = () => {
            setIsSpeaking(false)
            setSpeakingMsgId(null)
          }
          utterance.onerror = () => {
            setIsSpeaking(false)
            setSpeakingMsgId(null)
          }
          window.speechSynthesis.speak(utterance)
        }
      } catch {
        setIsSpeaking(false)
        setSpeakingMsgId(null)
      }
    },
    [stopSpeaking],
  )

  const cleanupSpeechRecognition = useCallback(() => {
    if (speechStopTimerRef.current) {
      clearTimeout(speechStopTimerRef.current)
      speechStopTimerRef.current = null
    }
    const rec = speechRecognitionRef.current
    if (rec) {
      rec.onstart = null
      rec.onresult = null
      rec.onerror = null
      rec.onend = null
      try {
        rec.abort()
      } catch {
        // ignore
      }
      speechRecognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      cleanupSpeechRecognition()
      stopSpeaking()
    }
  }, [cleanupSpeechRecognition, stopSpeaking])

  const sendUserTextToAI = useCallback(
    async (rawText: string) => {
      if (isSubmittingRef.current) return

      const userText = rawText.trim()
      if (!userText) {
        setError('Không nhận diện được giọng nói. Mi hãy thử nói rõ hơn nhé.')
        setIsProcessing(false)
        return
      }

      isSubmittingRef.current = true
      setIsProcessing(true)
      setError(null)

      const userMsgId = `user-${Date.now()}`
      const aiMsgId = `ai-${Date.now() + 1}`
      const historyForAI = messagesRef.current.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      // Thêm tin nhắn user bằng functional update để không bao giờ bị ghi đè mất tin nhắn
      setMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          role: 'user',
          content: userText,
          showCorrection: true,
        },
      ])

      try {
        // Nếu chủ đề có câu phản hồi cố định
        if (topic.fixedReply) {
          setMessages((prev) => [
            ...prev,
            {
              id: aiMsgId,
              role: 'assistant',
              content: topic.fixedReply!,
              revealedOverride: null,
            },
          ])
          setIsProcessing(false)
          isSubmittingRef.current = false
          await speak(topic.fixedReply, aiMsgId)
          return
        }

        // Tạo khung tin nhắn AI rỗng trước để stream từng từ ngay lập tức
        setMessages((prev) => [
          ...prev,
          {
            id: aiMsgId,
            role: 'assistant',
            content: '',
            revealedOverride: null,
          },
        ])
        setStreamingMsgId(aiMsgId)

        const response = await fetch('/speaking-stream-api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessage: userText,
            history: historyForAI,
            systemPrompt: topic.systemPrompt,
            tasks: topic.tasks,
            provider: topic.provider,
          }),
        })

        if (!response.ok || !response.body) {
          let errMsg = `AI không phản hồi (HTTP ${response.status}). Hãy thử lại.`
          try {
            const errJson = await response.json()
            if (errJson?.error) errMsg = errJson.error
          } catch {
            // ignore
          }
          setError(errMsg)
          setMessages((prev) => prev.filter((m) => m.id !== aiMsgId))
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let fullRaw = ''

        const extractVisibleReply = (raw: string) => {
          const metaIdx = raw.indexOf('---META---')
          if (metaIdx !== -1) {
            return raw.slice(0, metaIdx).trim()
          }
          // Che phần cuối nếu delimiter "---META---" đang được stream dở dang
          return raw.replace(/\n?-{1,3}(M(E(T(A(-{0,3})?)?)?)?)?$/, '').trimStart()
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          if (chunk) {
            fullRaw += chunk
            const visible = extractVisibleReply(fullRaw)
            setMessages((prev) =>
              prev.map((m) => (m.id === aiMsgId ? { ...m, content: visible } : m)),
            )
          }
        }

        const metaIdx = fullRaw.indexOf('---META---')
        const finalReply = (metaIdx !== -1 ? fullRaw.slice(0, metaIdx) : fullRaw).trim()

        if (!finalReply) {
          setError('AI không trả về nội dung. Hãy thử lại.')
          setMessages((prev) => prev.filter((m) => m.id !== aiMsgId))
          return
        }

        // Bóc JSON metadata (sửa bài, gợi ý, nhiệm vụ đã hoàn thành) sau ---META---
        let correction: string | null = null
        let hint: string | null = null
        let completedIndexes: number[] = []

        if (metaIdx !== -1) {
          const metaRaw = fullRaw.slice(metaIdx + '---META---'.length)
          const jsonMatch = metaRaw.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0].replace(/,\s*([}\]])/g, '$1'))
              correction = parsed?.correction ? String(parsed.correction) : null
              hint = parsed?.hint ? String(parsed.hint) : null
              completedIndexes = Array.isArray(parsed?.completedTaskIndexes)
                ? parsed.completedTaskIndexes.filter((n: unknown) => typeof n === 'number')
                : []
            } catch {
              // Bỏ qua nếu JSON metadata không chuẩn, câu trả lời chính vẫn hiển thị đầy đủ
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === aiMsgId) return { ...m, content: finalReply }
            if (m.id === userMsgId) return { ...m, correction }
            return m
          }),
        )

        if (hint) {
          setCurrentHint(hint)
        }

        if (completedIndexes.length > 0) {
          setCompletedTasks((prev) =>
            prev.map((done, idx) => done || completedIndexes.includes(idx)),
          )
        }

        setStreamingMsgId(null)
        setIsProcessing(false)
        isSubmittingRef.current = false
        await speak(finalReply, aiMsgId)
      } catch {
        setError('Lỗi kết nối khi nhận phản hồi từ AI. Hãy thử lại.')
        setMessages((prev) => prev.filter((m) => m.id !== aiMsgId || m.content.trim().length > 0))
      } finally {
        setStreamingMsgId(null)
        setIsProcessing(false)
        isSubmittingRef.current = false
      }
    },
    [topic.systemPrompt, topic.tasks, topic.provider, topic.fixedReply, speak],
  )

  const processAudio = useCallback(
    async (blob: Blob) => {
      setIsProcessing(true)
      setError(null)

      const fd = new FormData()
      fd.append('audio', blob, 'recording.webm')
      const transcribeResult = await transcribeAudio(fd, topic.provider)

      if (transcribeResult.error || !transcribeResult.text?.trim()) {
        setError(transcribeResult.error || 'Không nhận diện được giọng nói. Hãy thử nói rõ hơn.')
        setIsProcessing(false)
        return
      }

      await sendUserTextToAI(transcribeResult.text)
    },
    [topic.provider, sendUserTextToAI],
  )

  const startRecording = useCallback(async () => {
    if (isProcessing || isSubmittingRef.current) return
    const wasSpeaking = isSpeaking
    stopSpeaking()
    cleanupSpeechRecognition()
    setError(null)

    // Với chủ đề VietAPI: ưu tiên Web Speech Recognition của trình duyệt (miễn phí, không cần Groq Whisper)
    const SpeechRecognitionAPI =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null

    if (topic.provider === 'vietapi' && SpeechRecognitionAPI) {
      // Trên Chrome Windows, chờ 120ms sau khi tắt TTS để audio device được giải phóng hoàn toàn
      if (wasSpeaking) {
        await new Promise((resolve) => setTimeout(resolve, 120))
      }

      try {
        const recognition = new SpeechRecognitionAPI()
        recognition.lang = 'en-US'
        recognition.continuous = true
        recognition.interimResults = true

        speechTranscriptRef.current = ''
        setLiveTranscript('')
        let hasFinished = false

        const finalizeSpeech = async () => {
          if (hasFinished) return
          hasFinished = true

          if (speechStopTimerRef.current) {
            clearTimeout(speechStopTimerRef.current)
            speechStopTimerRef.current = null
          }

          recognition.onstart = null
          recognition.onresult = null
          recognition.onerror = null
          recognition.onend = null
          if (speechRecognitionRef.current === recognition) {
            speechRecognitionRef.current = null
          }
          try {
            recognition.abort()
          } catch {
            // ignore
          }

          setIsRecording(false)
          const spoken = speechTranscriptRef.current.trim()
          speechTranscriptRef.current = ''
          setLiveTranscript('')
          if (spoken) {
            await sendUserTextToAI(spoken)
          }
        }

        recognition.onresult = (event: any) => {
          let finalText = ''
          let interimText = ''
          for (let i = 0; i < event.results.length; i++) {
            const part = event.results[i][0]?.transcript || ''
            if (event.results[i].isFinal) {
              finalText += part + ' '
            } else {
              interimText += part
            }
          }
          const combined = `${finalText}${interimText}`.trim()
          speechTranscriptRef.current = combined
          setLiveTranscript(combined)
        }

        recognition.onerror = (event: any) => {
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setError('Không thể truy cập Microphone. Vui lòng cấp quyền trong trình duyệt.')
          } else if (event.error === 'audio-capture') {
            setError('Micro đang bị bận hoặc chưa kết nối. Mi hãy bấm lại nút micro nhé.')
          } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
            setError(`Lỗi nhận diện giọng nói trình duyệt (${event.error}). Hãy thử lại.`)
          }
          finalizeSpeech()
        }

        recognition.onend = () => {
          finalizeSpeech()
        }

        speechRecognitionRef.current = recognition
        ;(recognition as any).__finalize = finalizeSpeech
        recognition.start()
        setIsRecording(true)
        return
      } catch (err) {
        console.error('[startRecording SpeechRecognition] error:', err)
        cleanupSpeechRecognition()
        setError('Không thể khởi động nhận diện giọng nói. Mi hãy nhấn lại nút micro nhé.')
        return
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' })
        await processAudio(blob)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setError(null)
    } catch {
      setError('Không thể truy cập Microphone. Vui lòng cấp quyền trong trình duyệt.')
    }
  }, [
    isProcessing,
    isSpeaking,
    stopSpeaking,
    cleanupSpeechRecognition,
    topic.provider,
    processAudio,
    sendUserTextToAI,
  ])

  const stopRecording = useCallback(() => {
    const rec = speechRecognitionRef.current
    if (rec) {
      setIsRecording(false)
      try {
        rec.stop()
      } catch {
        // ignore
      }
      // Safety fallback: nếu Chrome không bắn onend sau 600ms thì chủ động kết thúc & nhả micro ngay
      if (speechStopTimerRef.current) {
        clearTimeout(speechStopTimerRef.current)
      }
      speechStopTimerRef.current = setTimeout(() => {
        if (typeof rec.__finalize === 'function') {
          rec.__finalize()
        } else {
          cleanupSpeechRecognition()
        }
      }, 600)
      return
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [cleanupSpeechRecognition])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && !e.repeat && !feedbackOpen && !completionPopupOpen) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        if (isRecording) {
          stopRecording()
        } else if (!isProcessing) {
          startRecording()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isRecording, isProcessing, feedbackOpen, completionPopupOpen, startRecording, stopRecording])

  const handleTranslate = async (msg: ChatMessage) => {
    if (msg.translation) {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, translation: undefined } : m)),
      )
      return
    }
    if (msg.isTranslating) return

    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, isTranslating: true } : m)),
    )

    const res = await translateText(msg.content, topic.provider)
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id
          ? { ...m, isTranslating: false, translation: res.translation || res.error }
          : m,
      ),
    )
  }

  const toggleMessageVisibility = (msgId: string, currentlyVisible: boolean) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, revealedOverride: !currentlyVisible } : m)),
    )
  }

  const toggleUserCorrection = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, showCorrection: !m.showCorrection } : m)),
    )
  }

  const handleCompleteAndFeedback = async () => {
    stopSpeaking()
    setCompletionPopupOpen(false)
    setFeedbackOpen(true)
    setFeedbackLoading(true)
    setFeedbackData(null)

    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    const res = await getSpeakingFeedback(history, topic.titleVi, topic.tasks, topic.provider)
    setFeedbackLoading(false)
    if (res.error) {
      setFeedbackData({ feedback: res.error })
    } else {
      setFeedbackData({ score: res.score, feedback: res.feedback })
    }
  }

  const handleRestart = () => {
    stopSpeaking()
    setMessages([
      {
        id: `opening-${Date.now()}`,
        role: 'assistant',
        content: topic.openingMessage,
        revealedOverride: null,
      },
    ])
    prevAllTasksDoneRef.current = false
    setCompletedTasks(topic.tasks.map(() => false))
    setCurrentHint(topic.initialHint)
    setError(null)
    setCompletionPopupOpen(false)
    setFeedbackOpen(false)
  }

  const tagColors = [
    'bg-red-50 text-red-600 border border-red-200',
    'bg-rose-50 text-rose-600 border border-rose-200',
    'bg-amber-50 text-amber-700 border border-amber-200',
    'bg-gray-100 text-gray-700 border border-gray-200',
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 p-3 md:p-4 font-sans">
      <div className="max-w-[1440px] mx-auto lg:h-[calc(100vh-2rem)] flex flex-col lg:flex-row gap-4">
        {/* ================= CỘT TRÁI: KHUNG CHAT LUYỆN NÓI ================= */}
        <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden min-h-[75vh] lg:min-h-0 shadow-sm">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between gap-3 bg-white">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/student/speaking"
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-600 border border-gray-200 flex items-center justify-center text-gray-500 transition shrink-0"
                title="Quay lại danh sách chủ đề"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div className="truncate">
                <h1 className="text-base md:text-lg font-bold text-gray-900 truncate">
                  {topic.titleVi}
                </h1>
              </div>
            </div>

            <button
              onClick={handleCompleteAndFeedback}
              className="shrink-0 flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-xs md:text-sm px-4 md:px-5 py-2 rounded-full shadow-md shadow-red-500/20 transition active:scale-95"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Hoàn tất &amp; Xem nhận xét</span>
            </button>
          </div>

          {/* Vùng tin nhắn */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-6 bg-white">
            {messages.map((msg) => {
              if (msg.role === 'assistant') {
                const isVisible =
                  msg.revealedOverride !== null && msg.revealedOverride !== undefined
                    ? msg.revealedOverride
                    : showAiReply

                return (
                  <div key={msg.id} className="flex flex-col items-start max-w-[85%] md:max-w-[75%]">
                    {/* Avatar chatbot */}
                    <div className="flex items-center gap-2 mb-2">
                      <img
                        src="/images/ai-avatar.jpg"
                        alt="Avatar"
                        className="w-10 h-10 rounded-full object-cover border-2 border-red-200 shadow-sm"
                      />
                      <button
                        onClick={() => speak(msg.content, msg.id)}
                        className="text-gray-400 hover:text-gray-600 transition p-1"
                        title="Báo cáo / Nghe lại"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Bong bóng AI */}
                    <div className="w-full bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm px-5 py-3.5 shadow-sm">
                      {streamingMsgId === msg.id && !msg.content ? (
                        <div className="flex items-center gap-1.5 py-1">
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce [animation-delay:0ms]" />
                          <span className="w-2 h-2 bg-red-400 rounded-full animate-bounce [animation-delay:150ms]" />
                          <span className="w-2 h-2 bg-rose-400 rounded-full animate-bounce [animation-delay:300ms]" />
                        </div>
                      ) : (
                        <p
                          className={`text-[15px] leading-relaxed text-gray-800 transition-all ${
                            !isVisible ? 'blur-md select-none opacity-40' : ''
                          }`}
                        >
                          {msg.content}
                          {streamingMsgId === msg.id && (
                            <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-red-500 animate-pulse rounded-sm" />
                          )}
                        </p>
                      )}

                      {!isVisible && streamingMsgId !== msg.id && (
                        <button
                          onClick={() => toggleMessageVisibility(msg.id, isVisible)}
                          className="mt-1 text-xs text-red-600 hover:text-red-500 underline"
                        >
                          Nhấn biểu tượng mắt để hiện nội dung
                        </button>
                      )}

                      {msg.isTranslating && (
                        <p className="mt-2.5 pt-2.5 border-t border-gray-200 text-xs text-gray-500 italic">
                          Đang dịch sang tiếng Việt...
                        </p>
                      )}

                      {msg.translation && (
                        <p className="mt-2.5 pt-2.5 border-t border-gray-200 text-sm text-red-700 leading-relaxed">
                          {msg.translation}
                        </p>
                      )}
                    </div>

                    {/* 3 nút action nhỏ bên dưới phải bong bóng AI: Loa - Mắt - Dịch */}
                    <div className="flex items-center justify-end gap-1.5 w-full mt-2 pr-1">
                      <button
                        onClick={() =>
                          speakingMsgId === msg.id && isSpeaking
                            ? stopSpeaking()
                            : speak(msg.content, msg.id)
                        }
                        className={`w-7 h-7 rounded-full border flex items-center justify-center transition ${
                          speakingMsgId === msg.id && isSpeaking
                            ? 'bg-red-50 border-red-400 text-red-600 animate-pulse'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600'
                        }`}
                        title="Nghe giọng đọc"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => toggleMessageVisibility(msg.id, isVisible)}
                        className={`w-7 h-7 rounded-full border flex items-center justify-center transition ${
                          !isVisible
                            ? 'bg-red-50 border-red-300 text-red-600'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600'
                        }`}
                        title={isVisible ? 'Ẩn văn bản' : 'Hiện văn bản'}
                      >
                        {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleTranslate(msg)}
                        className={`w-7 h-7 rounded-full border flex items-center justify-center transition ${
                          msg.translation
                            ? 'bg-red-50 border-red-300 text-red-600'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600'
                        }`}
                        title="Dịch sang tiếng Việt"
                      >
                        <Languages className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              }

              // Tin nhắn User (bên phải - tông màu Đỏ)
              return (
                <div key={msg.id} className="flex flex-col items-end">
                  <div className="max-w-[85%] md:max-w-[70%] bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-2xl rounded-tr-sm px-5 py-3 shadow-md shadow-red-500/20">
                    <p className="text-[15px] leading-relaxed font-medium">{msg.content}</p>
                  </div>

                  {/* Action bar dưới tin nhắn user */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <button
                      onClick={() => speak(msg.content, msg.id)}
                      className={`w-7 h-7 rounded-full border flex items-center justify-center transition ${
                        speakingMsgId === msg.id && isSpeaking
                          ? 'bg-red-50 border-red-400 text-red-600'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600'
                      }`}
                      title="Nghe cách đọc câu này"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>

                    {msg.correction && (
                      <button
                        onClick={() => toggleUserCorrection(msg.id)}
                        className={`w-7 h-7 rounded-full border flex items-center justify-center transition ${
                          msg.showCorrection && showCorrections
                            ? 'bg-amber-50 border-amber-300 text-amber-600'
                            : 'bg-white border-gray-200 text-amber-500 hover:border-amber-300 hover:bg-amber-50'
                        }`}
                        title="Xem phần sửa bài"
                      >
                        <Flame className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <span className="text-gray-400 p-1">
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  {/* Box sửa bài nếu bật */}
                  {showCorrections && msg.correction && msg.showCorrection && (
                    <div className="mt-2 max-w-[85%] md:max-w-[65%] bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs md:text-sm text-gray-800 leading-relaxed">
                      <div className="flex items-center gap-1.5 text-red-600 font-semibold text-xs mb-1">
                        <Flame className="w-3.5 h-3.5" />
                        <span>Gợi ý sửa bài</span>
                      </div>
                      <p>{msg.correction}</p>
                    </div>
                  )}
                </div>
              )
            })}

            {/* AI đang xử lý (chỉ hiện lúc đang nhận diện audio trước khi mở bong bóng stream) */}
            {isProcessing && !streamingMsgId && (
              <div className="flex flex-col items-start">
                <img
                  src="/images/ai-avatar.jpg"
                  alt="Avatar"
                  className="w-10 h-10 rounded-full object-cover border-2 border-red-300 shadow-sm mb-2 animate-pulse"
                />
                <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm px-5 py-3.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-red-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-rose-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            {/* Khung "Câu trả lời của bạn" ở cuối bên phải */}
            {!isProcessing && (
              <div className="flex flex-col items-end pt-1">
                <div
                  className={`rounded-full px-5 py-2.5 text-sm border transition ${
                    isRecording
                      ? 'border-red-400 bg-red-50 text-red-600 font-medium animate-pulse'
                      : 'border-gray-300 text-gray-500 bg-white'
                  }`}
                >
                  {isRecording
                    ? liveTranscript || 'Đang lắng nghe giọng nói của mi...'
                    : 'Câu trả lời của mi'}
                </div>

                {/* Gợi ý trả lời khi bật "Hiện gợi ý" */}
                {showHints && currentHint && (
                  <div className="mt-2.5 max-w-[85%] md:max-w-[70%] bg-red-50/80 border border-red-200 rounded-xl px-4 py-3 text-left">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
                        <Lightbulb className="w-3.5 h-3.5" />
                        Gợi ý trả lời
                      </span>
                      <button
                        onClick={() => speak(currentHint, 'hint')}
                        className="text-gray-500 hover:text-red-600 transition"
                        title="Nghe gợi ý"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed">{currentHint}</p>
                  </div>
                )}
              </div>
            )}

            {/* Lỗi */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 text-center">
                ⚠️ {error}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Khu vực Micro ở đáy khung trái */}
          <div className="p-3.5 md:p-4 bg-white">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 py-4 px-4 flex flex-col items-center justify-center gap-3">
              <div className="flex items-center gap-4">
                {isSpeaking && (
                  <button
                    onClick={stopSpeaking}
                    className="w-10 h-10 rounded-full bg-red-50 border border-red-200 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition"
                    title="Dừng giọng đọc AI"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                )}

                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    isRecording
                      ? 'bg-red-600 border-2 border-red-400 text-white shadow-[0_0_24px_rgba(220,38,38,0.45)] scale-105 animate-pulse'
                      : 'bg-white border border-gray-300 text-gray-700 shadow-sm hover:border-red-500 hover:bg-red-50 hover:text-red-600'
                  }`}
                  title={isRecording ? 'Dừng thu âm' : 'Bắt đầu thu âm'}
                >
                  {isRecording ? (
                    <Square className="w-5 h-5 fill-white text-white" />
                  ) : (
                    <Mic className="w-6 h-6" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                {isRecording ? (
                  <span className="text-red-600 font-medium">
                    Đang thu âm... Nhấn lại nút micro hoặc{' '}
                    <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-300 text-gray-700 font-mono text-[11px] shadow-sm">
                      Shift
                    </kbd>{' '}
                    để gửi
                  </span>
                ) : (
                  <>
                    <span>Hoặc nhấn</span>
                    <kbd className="px-2 py-0.5 rounded bg-white border border-gray-300 text-gray-700 font-mono text-[11px] shadow-sm">
                      Shift
                    </kbd>
                    <span>để bắt đầu thu âm</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================= CỘT PHẢI: SIDEBAR (NHIỆM VỤ - MÔ TẢ - CÀI ĐẶT) ================= */}
        <aside className="w-full lg:w-[340px] xl:w-[360px] flex flex-col gap-4 shrink-0 lg:overflow-y-auto">
          {/* Card 1: Nhiệm vụ */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-[15px] font-bold text-gray-900">Nhiệm vụ</h2>
              <button
                onClick={() => setShowTaskHelp((prev) => !prev)}
                className="w-7 h-7 rounded-full border border-gray-200 hover:border-red-300 text-gray-400 hover:text-red-600 flex items-center justify-center transition"
                title="Hướng dẫn nhiệm vụ"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>

            {showTaskHelp && (
              <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-2.5 mb-3">
                Hoàn thành các mục tiêu giao tiếp dưới đây khi trò chuyện với AI. Hệ thống sẽ tự động đánh dấu hoặc mi có thể tự nhấn để theo dõi.
              </p>
            )}

            <div className="space-y-2.5">
              {topic.tasks.map((task, idx) => {
                const done = completedTasks[idx]
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      setCompletedTasks((prev) => prev.map((v, i) => (i === idx ? !v : v)))
                    }
                    className={`w-full text-left flex items-center gap-3 px-3.5 py-3 rounded-xl border transition ${
                      done
                        ? 'bg-red-50 border-red-200 text-gray-500'
                        : 'bg-gray-50 border-gray-200 hover:border-red-300 text-gray-800'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition ${
                        done
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'border-gray-400 bg-white'
                      }`}
                    >
                      {done && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                    <span className={`text-sm ${done ? 'line-through text-gray-400' : ''}`}>
                      {task}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Card 2: Mô tả */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <h2 className="text-[15px] font-bold text-gray-900 mb-3">Mô tả</h2>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-3.5">
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                {topic.level}
              </span>
              {topic.tags.map((tag, i) => (
                <span
                  key={tag}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    tagColors[(i + 1) % tagColors.length]
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Nội dung mô tả */}
            <p
              className={`text-sm text-gray-600 leading-relaxed ${
                expandDesc ? '' : 'line-clamp-3'
              }`}
            >
              {topic.scenarioVi}
            </p>
            <button
              onClick={() => setExpandDesc((prev) => !prev)}
              className="mt-1.5 text-xs font-semibold text-gray-900 hover:text-red-600 transition"
            >
              {expandDesc ? 'Thu gọn' : 'Xem thêm'}
            </button>

            {/* Vai trò */}
            <div className="mt-4 pt-3.5 border-t border-gray-200 space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm text-gray-700">
                <span className="w-6 h-6 rounded-full bg-red-50 text-red-600 border border-red-200 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5" />
                </span>
                <span>{topic.userRoleVi}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-700">
                <img
                  src="/images/ai-avatar.jpg"
                  alt="Avatar"
                  className="w-6 h-6 rounded-full object-cover border border-red-200 shrink-0"
                />
                <span>{topic.aiRoleVi}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Cài đặt */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <button
              type="button"
              onClick={() => setSettingsOpen((prev) => !prev)}
              className="w-full flex items-center justify-between text-left"
            >
              <h2 className="text-[15px] font-bold text-gray-900">Cài đặt</h2>
              {settingsOpen ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {settingsOpen && (
              <div className="mt-4 space-y-3.5">
                {/* Toggle 1: Hiện câu trả lời của AI */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                      <Eye className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-sm text-gray-700">Hiện câu trả lời của AI</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showAiReply}
                    onClick={() => {
                      setShowAiReply((prev) => !prev)
                      setMessages((prev) => prev.map((m) => ({ ...m, revealedOverride: null })))
                    }}
                    className={`w-11 h-6 rounded-full p-1 transition-colors flex items-center ${
                      showAiReply ? 'bg-red-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                        showAiReply ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Toggle 2: Hiện gợi ý */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                      <Lightbulb className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-sm text-gray-700">Hiện gợi ý</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showHints}
                    onClick={() => setShowHints((prev) => !prev)}
                    className={`w-11 h-6 rounded-full p-1 transition-colors flex items-center ${
                      showHints ? 'bg-red-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                        showHints ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Toggle 3: Hiện phần sửa bài */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                      <Flame className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-sm text-gray-700">Hiện phần sửa bài</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showCorrections}
                    onClick={() => setShowCorrections((prev) => !prev)}
                    className={`w-11 h-6 rounded-full p-1 transition-colors flex items-center ${
                      showCorrections ? 'bg-red-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                        showCorrections ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ================= POPUP KẾT THÚC PHIÊN AI KHI HOÀN THÀNH NHIỆM VỤ ================= */}
      {completionPopupOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="relative px-6 pt-7 pb-5 text-center bg-gradient-to-b from-red-50/90 to-white">
              <button
                type="button"
                onClick={() => setCompletionPopupOpen(false)}
                className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white hover:bg-red-50 border border-gray-200 text-gray-400 hover:text-red-600 flex items-center justify-center transition"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30 mb-4">
                <Trophy className="w-8 h-8" />
              </div>

              <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-semibold mb-2.5">
                Hoàn thành {topic.tasks.length}/{topic.tasks.length} nhiệm vụ
              </span>

              <h3 className="text-xl font-bold text-gray-900">
                Kết thúc phiên luyện nói AI
              </h3>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                Chúc mừng! Mi đã hoàn thành xuất sắc toàn bộ nhiệm vụ của chủ đề{' '}
                <span className="font-semibold text-gray-900">{topic.titleVi}</span>. Cảm ơn mi đã
                luyện tập cùng AI!
              </p>
            </div>

            <div className="px-6 pb-5">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2 mb-5">
                {topic.tasks.map((task, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 text-sm text-gray-700">
                    <span className="w-4 h-4 rounded bg-red-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <span>{task}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleCompleteAndFeedback}
                  className="w-full py-2.5 px-4 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-sm shadow-md shadow-red-500/20 transition"
                >
                  Xem nhận xét &amp; Chấm điểm từ AI
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full bg-white hover:bg-red-50 border border-gray-300 hover:border-red-300 text-gray-700 hover:text-red-600 text-sm font-medium transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Luyện lại</span>
                  </button>
                  <Link
                    href="/student/speaking"
                    className="flex items-center justify-center py-2.5 px-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium transition"
                  >
                    Chủ đề khác
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => setCompletionPopupOpen(false)}
                  className="w-full pt-1 text-xs text-gray-400 hover:text-gray-600 transition"
                >
                  Đóng popup để tiếp tục trò chuyện thêm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL HOÀN TẤT & XEM NHẬN XÉT ================= */}
      {feedbackOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Nhận xét buổi luyện nói</h3>
              <button
                onClick={() => setFeedbackOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {feedbackLoading ? (
                <div className="py-12 flex flex-col items-center gap-3 text-gray-500">
                  <div className="w-10 h-10 rounded-full border-2 border-red-600 border-t-transparent animate-spin" />
                  <p className="text-sm">AI đang phân tích và chấm điểm bài nói của mi...</p>
                </div>
              ) : (
                <>
                  {feedbackData?.score !== undefined && (
                    <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl p-4">
                      <div>
                        <p className="text-xs text-red-600 uppercase tracking-wider font-semibold">
                          Điểm đánh giá tổng quan
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Nhiệm vụ hoàn thành: {completedTasks.filter(Boolean).length}/
                          {topic.tasks.length}
                        </p>
                      </div>
                      <div className="text-3xl font-extrabold text-red-600">
                        {feedbackData.score}
                        <span className="text-base text-gray-500 font-normal">/10</span>
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed bg-gray-50 border border-gray-200 rounded-xl p-4">
                    {feedbackData?.feedback}
                  </div>
                </>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-gray-200 flex items-center justify-end gap-3 bg-gray-50">
              <button
                onClick={handleRestart}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-gray-300 hover:border-red-400 text-sm text-gray-700 hover:text-red-600 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Luyện lại
              </button>
              <Link
                href="/student/speaking"
                className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition"
              >
                Chọn chủ đề khác
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
