'use client'

import React, { useState } from 'react'
import { gradeWriting } from './actions'

export default function StudentPage() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!text.trim()) {
      setError('Vui lòng nhập nội dung bài viết trước khi nộp.')
      return
    }
    
    setLoading(true)
    setError(null)
    setResult(null)

    const response = await gradeWriting(text)

    if (response.error) {
      setError(response.error)
    } else if (response.result) {
      setResult(response.result)
    }

    setLoading(false)
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Luyện tập Viết (Writing Practice)</h1>
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Đề bài: Viết một đoạn văn ngắn về sở thích của bạn.</h2>
        
        <textarea 
          className="w-full h-64 p-4 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
          placeholder="Viết bài của bạn tại đây..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
        ></textarea>
        
        {error && <p className="text-red-500 mt-2">{error}</p>}

        <div className="mt-4 flex justify-end">
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className={`px-6 py-2 rounded-md text-white transition ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {loading ? 'Đang chấm điểm...' : 'Nộp bài & Chấm điểm với AI'}
          </button>
        </div>
      </div>
      
      {/* Khu vực hiển thị kết quả chấm điểm từ AI */}
      {result && (
        <div className="mt-8 bg-blue-50 p-6 rounded-lg border border-blue-100">
          <h3 className="text-lg font-bold text-blue-800 mb-4">Đánh giá từ AI:</h3>
          <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">
            {result}
          </div>
        </div>
      )}
    </div>
  )
}
