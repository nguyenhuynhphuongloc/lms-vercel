'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Search } from 'lucide-react'
import { speakingTopics } from './topics'

export default function SpeakingIndexPage() {
  const [query, setQuery] = useState('')

  const filteredTopics = speakingTopics.filter((topic) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      topic.title.toLowerCase().includes(q) ||
      topic.titleVi.toLowerCase().includes(q) ||
      topic.descriptionVi.toLowerCase().includes(q) ||
      topic.tags.some((t) => t.toLowerCase().includes(q))
    )
  })

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">App luyện nói lộc làm cho mi đẹp gái</h1>
            <p className="text-gray-500 mt-1 text-sm">
              lộc hi vọng app này sẽ giúp mi đạt aim nha
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div className="mb-8 relative max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm chủ đề luyện nói..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition shadow-sm"
          />
        </div>

        {/* Topic Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTopics.map((topic) => (
            <Link key={topic.id} href={`/student/speaking/${topic.id}`}>
              <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-red-400 hover:shadow-lg hover:shadow-red-500/5 transition-all cursor-pointer group h-full flex flex-col shadow-sm">
                {/* Title */}
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold text-gray-900 text-base group-hover:text-red-600 transition-colors">
                    {topic.titleVi}
                  </h2>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-red-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </div>
                <p className="text-xs text-gray-400 mb-2.5">{topic.title}</p>

                {/* Description */}
                <p className="text-sm text-gray-600 leading-relaxed flex-1 line-clamp-3">
                  {topic.descriptionVi}
                </p>

                {/* Badges */}
                <div className="mt-4 pt-3.5 border-t border-gray-100 flex items-center flex-wrap gap-2">
                  <span className="inline-block text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-full px-2.5 py-0.5">
                    {topic.level}
                  </span>
                  {topic.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="inline-block text-xs bg-gray-100 text-gray-600 border border-gray-200 rounded-full px-2.5 py-0.5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
