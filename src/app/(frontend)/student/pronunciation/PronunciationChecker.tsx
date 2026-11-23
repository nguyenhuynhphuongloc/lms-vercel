'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileAudio,
  Flame,
  History,
  Lightbulb,
  Mic,
  MessageSquare,
  RotateCcw,
  Sparkles,
  Square,
  Upload,
  Volume2,
} from 'lucide-react'
import { synthesizeSpeech } from '../speaking/actions'
import { checkPronunciation, type PronunciationResult } from './actions'
import { sampleVocabList, type VocabItem } from './vocab'

type HistoryItem = {
  id: string
  word: string
  spokenText: string
  accuracy: number
  timestamp: string
}

export default function PronunciationChecker() {
  const [selectedVocab, setSelectedVocab] = useState<VocabItem | null>(sampleVocabList[0])
  const [targetText, setTargetText] = useState<string>(sampleVocabList[0].word)
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'A1-A2' | 'B1-B2' | 'C1'>('ALL')

  // Input mode: thu âm mic hoặc tải file audio
  const [inputMode, setInputMode] = useState<'mic' | 'upload'>('mic')
  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)

  // Trạng thái chấm điểm & đọc mẫu
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSpeakingSample, setIsSpeakingSample] = useState(false)
  const [result, setResult] = useState<PronunciationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Lưu lịch sử & điểm tốt nhất của từng từ trong phiên
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [bestScores, setBestScores] = useState<Record<string, number>>({})

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      if (sampleAudioRef.current) sampleAudioRef.current.pause()
    }
  }, [audioUrl])

  const handleSelectVocab = (item: VocabItem) => {
    setSelectedVocab(item)
    setTargetText(item.word)
    setResult(null)
    setError(null)
  }

  const handleCustomWordChange = (val: string) => {
    setTargetText(val)
    const matched = sampleVocabList.find(
      (v) => v.word.toLowerCase() === val.trim().toLowerCase(),
    )
    setSelectedVocab(matched || null)
  }

  const playSamplePronunciation = useCallback(async (text: string, slow = false) => {
    const clean = text.trim()
    if (!clean) return

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    if (sampleAudioRef.current) {
      sampleAudioRef.current.pause()
      sampleAudioRef.current = null
    }

    setIsSpeakingSample(true)

    try {
      if (!slow) {
        const res = await synthesizeSpeech(clean)
        if ('audio' in res && res.audio) {
          const blob = new Blob(
            [Uint8Array.from(atob(res.audio), (c) => c.charCodeAt(0))],
            { type: res.mimeType || 'audio/mpeg' },
          )
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          sampleAudioRef.current = audio
          audio.onended = () => {
            URL.revokeObjectURL(url)
            setIsSpeakingSample(false)
          }
          audio.onerror = () => setIsSpeakingSample(false)
          await audio.play()
          return
        }
      }

      const utterance = new SpeechSynthesisUtterance(clean)
      utterance.lang = 'en-US'
      utterance.rate = slow ? 0.65 : 0.95
      const voices = window.speechSynthesis.getVoices()
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Natural')),
      )
      if (preferred) utterance.voice = preferred
      utterance.onend = () => setIsSpeakingSample(false)
      utterance.onerror = () => setIsSpeakingSample(false)
      window.speechSynthesis.speak(utterance)
    } catch {
      setIsSpeakingSample(false)
    }
  }, [])

  const analyzeAudio = useCallback(async (blob: Blob, currentTarget: string) => {
    const trimmed = currentTarget.trim()
    if (!trimmed) {
      setError('Vui lòng nhập từ vựng trước khi kiểm tra.')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    const fd = new FormData()
    const fileName =
      blob instanceof File && blob.name && blob.name !== 'blob'
        ? blob.name
        : blob.type.includes('mp4')
          ? 'recording.m4a'
          : 'recording.webm'
    fd.append('audio', blob, fileName)
    fd.append('targetText', trimmed)

    const res = await checkPronunciation(fd)
    setIsAnalyzing(false)

    if (res.error) {
      setError(res.error)
      return
    }

    setResult(res)

    const key = trimmed.toLowerCase()
    setBestScores((prev) => ({
      ...prev,
      [key]: Math.max(prev[key] ?? 0, res.accuracy),
    }))
    setHistory((prev) => [
      {
        id: `${Date.now()}`,
        word: trimmed,
        spokenText: res.spokenText,
        accuracy: res.accuracy,
        timestamp: new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
      ...prev.slice(0, 14),
    ])
  }, [])

  const startRecording = useCallback(async () => {
    if (isAnalyzing) return
    if (!targetText.trim()) {
      setError('Vui lòng nhập hoặc chọn một từ vựng trước khi thu âm.')
      return
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
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        const mimeType = mediaRecorder.mimeType || 'audio/webm'
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        setUploadedFileName(null)
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
        await analyzeAudio(blob, targetText)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordSeconds(0)
      setError(null)
      setResult(null)

      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1)
      }, 1000)
    } catch {
      setError('Không thể truy cập Microphone. Vui lòng cấp quyền trong trình duyệt.')
    }
  }, [isAnalyzing, targetText, analyzeAudio])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && !e.repeat && inputMode === 'mic') {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        if (isRecording) stopRecording()
        else if (!isAnalyzing) startRecording()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [inputMode, isRecording, isAnalyzing, startRecording, stopRecording])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|webm|m4a|ogg|flac)$/i.test(file.name)) {
      setError('Vui lòng chọn file âm thanh hợp lệ (.mp3, .wav, .webm, .m4a, .ogg).')
      return
    }

    setError(null)
    setResult(null)
    setAudioBlob(file)
    setUploadedFileName(file.name)
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const filteredVocab = sampleVocabList.filter((item) =>
    levelFilter === 'ALL' ? true : item.level === levelFilter,
  )

  const getScoreTheme = (score: number) => {
    if (score >= 85) {
      return {
        stroke: '#16a34a',
        text: 'text-emerald-600',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        bar: 'bg-emerald-500',
      }
    }
    if (score >= 60) {
      return {
        stroke: '#d97706',
        text: 'text-amber-600',
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        bar: 'bg-amber-500',
      }
    }
    return {
      stroke: '#dc2626',
      text: 'text-red-600',
      badge: 'bg-red-50 text-red-600 border-red-200',
      bar: 'bg-red-500',
    }
  }

  const radius = 56
  const circumference = 2 * Math.PI * radius
  const strokeOffset = result
    ? circumference - (result.accuracy / 100) * circumference
    : circumference

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 p-3 md:p-5 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-5">
        {/* ================= HEADER ================= */}
        <header className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <Link
              href="/student/speaking"
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-600 border border-gray-200 flex items-center justify-center text-gray-500 transition shrink-0"
              title="Quay lại Luyện nói"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                  <Sparkles className="w-3 h-3" />
                  AI Pronunciation Check
                </span>
              </div>
              <h1 className="text-lg md:text-xl font-bold text-gray-900 mt-1">
                Kiểm tra Phát âm Từ vựng bằng Audio
              </h1>
            </div>
          </div>

          <Link
            href="/student/speaking"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-red-50 border border-gray-200 hover:border-red-300 text-sm text-gray-700 hover:text-red-600 transition shrink-0 shadow-sm"
          >
            <MessageSquare className="w-4 h-4 text-red-600" />
            <span>Luyện hội thoại AI</span>
          </Link>
        </header>

        {/* ================= MAIN 2 CỘT ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ---------- CỘT TRÁI (8/12): THỰC HÀNH & KẾT QUẢ ---------- */}
          <div className="lg:col-span-8 space-y-5">
            {/* 1. Card Từ vựng mục tiêu */}
            <section className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Từ vựng hoặc cụm từ muốn kiểm tra
                </label>
                {selectedVocab && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 w-fit">
                    Trình độ {selectedVocab.level}
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={targetText}
                  onChange={(e) => handleCustomWordChange(e.target.value)}
                  placeholder="Nhập từ vựng tiếng Anh bất kỳ (VD: comfortable, pronunciation...)"
                  className="flex-1 bg-gray-50 border border-gray-300 focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 rounded-xl px-4 py-3 text-lg md:text-2xl font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-normal placeholder:text-base focus:outline-none transition"
                />

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => playSamplePronunciation(targetText, false)}
                    disabled={!targetText.trim() || isSpeakingSample}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-semibold text-sm shadow-md shadow-red-500/20 transition"
                    title="Nghe phát âm chuẩn"
                  >
                    <Volume2 className={`w-4 h-4 ${isSpeakingSample ? 'animate-pulse' : ''}`} />
                    <span>Nghe mẫu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => playSamplePronunciation(targetText, true)}
                    disabled={!targetText.trim() || isSpeakingSample}
                    className="px-3.5 py-3 rounded-xl bg-gray-100 hover:bg-red-50 border border-gray-200 hover:border-red-300 disabled:opacity-40 text-gray-700 hover:text-red-600 text-sm font-medium transition"
                    title="Nghe tốc độ chậm 0.7x"
                  >
                    0.7x
                  </button>
                </div>
              </div>

              {selectedVocab && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-sm md:text-base text-red-600 bg-red-50 border border-red-200 px-3 py-0.5 rounded-lg">
                      {selectedVocab.ipa}
                    </span>
                    <span className="text-sm text-gray-700 font-medium">
                      {selectedVocab.meaningVi}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-gray-500 italic">
                    Ví dụ: &ldquo;{selectedVocab.example}&rdquo;
                  </p>
                  <p className="text-xs text-gray-600 flex items-start gap-1.5 pt-0.5">
                    <Lightbulb className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <span>{selectedVocab.tipVi}</span>
                  </p>
                </div>
              )}
            </section>

            {/* 2. Card Input Audio (Thu âm Mic / Tải file Audio) */}
            <section className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 shadow-sm">
              <div className="flex items-center gap-2 p-1 bg-gray-100 border border-gray-200 rounded-xl w-fit mb-5">
                <button
                  type="button"
                  onClick={() => setInputMode('mic')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    inputMode === 'mic'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  <span>Thu âm trực tiếp</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('upload')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    inputMode === 'upload'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Tải file Audio</span>
                </button>
              </div>

              {inputMode === 'mic' ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 py-8 px-4 flex flex-col items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isAnalyzing}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      isRecording
                        ? 'bg-red-600 border-4 border-red-300 text-white shadow-[0_0_30px_rgba(220,38,38,0.45)] scale-105'
                        : 'bg-gradient-to-br from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-500/25 hover:scale-105'
                    }`}
                    title={isRecording ? 'Dừng và chấm điểm' : 'Bắt đầu thu âm'}
                  >
                    {isRecording ? (
                      <Square className="w-7 h-7 fill-white" />
                    ) : (
                      <Mic className="w-9 h-9" />
                    )}
                  </button>

                  {isRecording ? (
                    <div className="text-center space-y-1">
                      <p className="text-sm font-semibold text-red-600">
                        Đang thu âm... 00:{String(recordSeconds).padStart(2, '0')}
                      </p>
                      <p className="text-xs text-gray-600">
                        Đọc to từ <span className="text-gray-900 font-semibold">&ldquo;{targetText}&rdquo;</span> rồi nhấn nút vuông để AI phân tích audio
                      </p>
                    </div>
                  ) : isAnalyzing ? (
                    <div className="flex items-center gap-2.5 text-sm text-red-600 font-medium">
                      <div className="w-4 h-4 rounded-full border-2 border-red-600 border-t-transparent animate-spin" />
                      <span>AI đang lắng nghe và phân tích từng âm tiết...</span>
                    </div>
                  ) : (
                    <div className="text-center space-y-1.5">
                      <p className="text-sm text-gray-800 font-medium">
                        Nhấn nút Micro và đọc từ vựng phía trên
                      </p>
                      <p className="text-xs text-gray-500">
                        Hoặc nhấn phím{' '}
                        <kbd className="px-2 py-0.5 rounded bg-white border border-gray-300 text-gray-700 font-mono text-[11px] shadow-sm">
                          Shift
                        </kbd>{' '}
                        để bắt đầu / dừng thu âm nhanh
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-gray-300 hover:border-red-400 bg-gray-50 p-7 flex flex-col items-center justify-center gap-3 text-center transition">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.webm,.m4a,.ogg"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center">
                    <FileAudio className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {uploadedFileName || 'Chọn file âm thanh từ thiết bị của bạn'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Hỗ trợ định dạng MP3, WAV, M4A, WEBM, OGG
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-white hover:bg-gray-100 border border-gray-300 text-sm text-gray-700 transition shadow-sm"
                    >
                      Chọn file Audio
                    </button>
                    {audioBlob && (
                      <button
                        type="button"
                        onClick={() => analyzeAudio(audioBlob, targetText)}
                        disabled={isAnalyzing}
                        className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-semibold shadow-md shadow-red-500/20 transition"
                      >
                        {isAnalyzing ? 'Đang chấm...' : 'Check phát âm ngay'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {audioUrl && (
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <span className="text-xs text-gray-500 shrink-0 font-medium">
                    Audio của bạn:
                  </span>
                  <audio controls src={audioUrl} className="w-full h-9" />
                  {audioBlob && !isAnalyzing && (
                    <button
                      type="button"
                      onClick={() => analyzeAudio(audioBlob, targetText)}
                      className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-50 hover:bg-red-600 border border-red-200 text-red-600 hover:text-white text-xs font-semibold transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Chấm lại
                    </button>
                  )}
                </div>
              )}

              {error && (
                <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </section>

            {/* 3. Card Kết quả phân tích & Phần trăm phát âm đúng */}
            {result && (
              <section className="bg-white border border-red-200 rounded-2xl p-5 md:p-6 shadow-md space-y-6">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                  {/* Vòng tròn điểm % */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className="relative w-36 h-36 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 132 132">
                        <circle
                          cx="66"
                          cy="66"
                          r={radius}
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="10"
                        />
                        <circle
                          cx="66"
                          cy="66"
                          r={radius}
                          fill="none"
                          stroke={getScoreTheme(result.accuracy).stroke}
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeOffset}
                          className="transition-all duration-700 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span
                          className={`text-3xl font-extrabold ${getScoreTheme(result.accuracy).text}`}
                        >
                          {result.accuracy}%
                        </span>
                        <span className="text-[11px] text-gray-500 mt-0.5">Độ chính xác</span>
                      </div>
                    </div>

                    <span
                      className={`mt-2 px-3 py-1 rounded-full text-xs font-semibold border ${
                        getScoreTheme(result.accuracy).badge
                      }`}
                    >
                      {result.grade}
                    </span>
                  </div>

                  {/* Thông tin so sánh & 3 chỉ số */}
                  <div className="flex-1 w-full space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
                        <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                          Từ mục tiêu
                        </p>
                        <p className="text-base font-bold text-gray-900 mt-1">{result.targetText}</p>
                        {result.ipaTarget && (
                          <p className="text-xs font-mono text-red-600 mt-0.5">
                            {result.ipaTarget}
                          </p>
                        )}
                      </div>

                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
                        <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                          AI nghe được từ Audio
                        </p>
                        <p className="text-base font-bold text-gray-900 mt-1">
                          {result.spokenText}
                        </p>
                        {result.ipaSpoken && (
                          <p className="text-xs font-mono text-gray-500 mt-0.5">
                            {result.ipaSpoken}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {[
                        { label: 'Độ chuẩn âm tiết', value: result.breakdown.phonemeAccuracy },
                        { label: 'Độ rõ ràng giọng nói', value: result.breakdown.clarity },
                        { label: 'Trọng âm & Ngữ điệu', value: result.breakdown.stressIntonation },
                      ].map((metric) => (
                        <div key={metric.label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600">{metric.label}</span>
                            <span className="font-semibold text-gray-900">{metric.value}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                getScoreTheme(metric.value).bar
                              }`}
                              style={{ width: `${metric.value}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {result.summaryVi && (
                  <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 leading-relaxed">
                    {result.summaryVi}
                  </p>
                )}

                {result.syllables.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2.5">
                      Phân tích từng âm tiết / phần từ
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {result.syllables.map((syl, idx) => {
                        const style =
                          syl.status === 'correct'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : syl.status === 'close'
                              ? 'bg-amber-50 border-amber-200 text-amber-700'
                              : 'bg-red-50 border-red-200 text-red-700'
                        return (
                          <div
                            key={idx}
                            className={`px-3 py-2 rounded-xl border text-sm ${style}`}
                          >
                            <span className="font-bold">{syl.part}</span>
                            {syl.note && (
                              <span className="block text-[11px] opacity-85 mt-0.5">
                                {syl.note}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-red-50/70 border border-red-200 rounded-xl p-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-red-600 mb-2.5">
                      <Flame className="w-4 h-4" />
                      <span>Điểm cần khắc phục</span>
                    </h3>
                    {result.mistakes.length > 0 ? (
                      <ul className="space-y-1.5 text-sm text-gray-700 list-disc pl-4">
                        {result.mistakes.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-emerald-600 flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        Không phát hiện lỗi phát âm đáng kể!
                      </p>
                    )}
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2.5">
                      <Lightbulb className="w-4 h-4 text-red-600" />
                      <span>Mẹo phát âm chuẩn bản xứ</span>
                    </h3>
                    <ul className="space-y-1.5 text-sm text-gray-700 list-disc pl-4">
                      {result.tips.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* ---------- CỘT PHẢI (4/12): KHO TỪ VỰNG & LỊCH SỬ ---------- */}
          <aside className="lg:col-span-4 space-y-5">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-[15px] font-bold text-gray-900">Từ vựng luyện nhanh</h2>
                <span className="text-xs text-gray-500">{filteredVocab.length} từ</span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3.5">
                {(['ALL', 'A1-A2', 'B1-B2', 'C1'] as const).map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => setLevelFilter(lv)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                      levelFilter === lv
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-gray-100 text-gray-600 border-gray-200 hover:border-red-300 hover:text-red-600'
                    }`}
                  >
                    {lv === 'ALL' ? 'Tất cả' : lv}
                  </button>
                ))}
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {filteredVocab.map((item) => {
                  const isActive =
                    targetText.trim().toLowerCase() === item.word.toLowerCase()
                  const best = bestScores[item.word.toLowerCase()]
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectVocab(item)}
                      className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between gap-2 ${
                        isActive
                          ? 'bg-red-50 border-red-300'
                          : 'bg-gray-50 border-gray-200 hover:border-red-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900 truncate">
                            {item.word}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-500">
                            {item.level}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          <span className="font-mono text-red-600 mr-1.5">{item.ipa}</span>
                          {item.meaningVi}
                        </p>
                      </div>

                      {best !== undefined && (
                        <span
                          className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border ${
                            getScoreTheme(best).badge
                          }`}
                        >
                          {best}%
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-red-600" />
                <h2 className="text-[15px] font-bold text-gray-900">Lịch sử chấm điểm</h2>
              </div>

              {history.length === 0 ? (
                <p className="text-xs text-gray-500 py-4 text-center">
                  Chưa có lượt chấm nào. Hãy thu âm hoặc tải file audio để bắt đầu!
                </p>
              ) : (
                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{h.word}</p>
                        <p className="text-[11px] text-gray-500 truncate">
                          Nghe được: &ldquo;{h.spokenText}&rdquo; · {h.timestamp}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                          getScoreTheme(h.accuracy).badge
                        }`}
                      >
                        {h.accuracy}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
