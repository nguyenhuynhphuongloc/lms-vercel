'use client'

import React, { useState, useRef } from 'react'
import { transcribeAudio } from './actions'

export default function SpeakingPage() {
  const [isRecording, setIsRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await handleAudioUpload(audioBlob)
        
        // Tắt micro sau khi thu xong
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setError(null)
    } catch (err) {
      console.error('Lỗi truy cập micro:', err)
      setError('Không thể truy cập Micro. Vui lòng cấp quyền trong trình duyệt.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleAudioUpload = async (blob: Blob) => {
    setLoading(true)
    setError(null)
    
    const formData = new FormData()
    formData.append('audio', blob)

    const response = await transcribeAudio(formData)

    if (response.error) {
      setError(response.error)
    } else if (response.text) {
      setTranscript(response.text)
    }
    
    setLoading(false)
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Luyện tập Nói (Speaking Practice)</h1>
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 text-center">
        <h2 className="text-xl font-semibold mb-6">Nhấn nút bên dưới để bắt đầu thu âm</h2>
        
        <div className="flex justify-center items-center space-x-4 mb-8">
          {!isRecording ? (
            <button 
              onClick={startRecording}
              disabled={loading}
              className="bg-red-500 text-white w-20 h-20 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition disabled:opacity-50"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          ) : (
            <button 
              onClick={stopRecording}
              className="bg-gray-800 text-white w-20 h-20 rounded-full flex items-center justify-center shadow-lg animate-pulse"
            >
              <div className="w-8 h-8 bg-white rounded-sm"></div>
            </button>
          )}
        </div>

        {isRecording && <p className="text-red-500 font-semibold mb-4 animate-pulse">Đang thu âm...</p>}
        {loading && <p className="text-blue-500 font-semibold mb-4">Đang dùng AI để phân tích giọng nói...</p>}
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>
      
      {/* Khu vực hiển thị văn bản sau khi nhận diện */}
      {transcript && (
        <div className="mt-8 bg-green-50 p-6 rounded-lg border border-green-100">
          <h3 className="text-lg font-bold text-green-800 mb-4">Văn bản nhận diện được (Transcript):</h3>
          <div className="text-gray-800 text-lg leading-relaxed bg-white p-4 rounded border">
            {transcript}
          </div>
        </div>
      )}
    </div>
  )
}
