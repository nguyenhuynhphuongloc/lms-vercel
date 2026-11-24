import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type IncomingMessage = {
  role: 'user' | 'assistant'
  content: string
}

// Cache model hoạt động tốt trên VietAPI để không bị delay thử các model 503 ở mỗi tin nhắn
let cachedChatVietModel: string | null = null

function getVietApiKey(): string | undefined {
  const raw =
    process.env.VIETAPI_API_KEY ||
    process.env.apikey_vietchatbot ||
    process.env.APIKEY_VIETCHATBOT
  return raw?.trim()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const userMessage = String(body?.message || '').trim()
    const history: IncomingMessage[] = Array.isArray(body?.history) ? body.history : []

    if (!userMessage) {
      return Response.json({ error: 'Vui lòng nhập nội dung tin nhắn.' }, { status: 400 })
    }

    const apiKey = getVietApiKey()
    if (!apiKey) {
      return Response.json({ error: 'Hệ thống gặp vấn đề' }, { status: 500 })
    }

    const customEndpoint = process.env.VIETAPI_BASE_URL?.trim().replace(/\/+$/, '')
    const baseEndpoint = customEndpoint || 'https://api.vietapi.tech/v1/chat/completions'
    const url = baseEndpoint.endsWith('/chat/completions')
      ? baseEndpoint
      : `${baseEndpoint}/chat/completions`

    // Ưu tiên claude-opus-4.6 (dự phòng glm-5.2), không thử các model 503 gây delay
    const customModel = process.env.VIETAPI_FAST_MODEL?.trim() || process.env.VIETAPI_MODEL?.trim()
    const defaultModels = ['claude-opus-4.6', 'glm-5.2']
    const candidateModels = customModel
      ? [customModel]
      : cachedChatVietModel
        ? [cachedChatVietModel, ...defaultModels.filter((m) => m !== cachedChatVietModel)]
        : defaultModels

    const messages = [
      {
        role: 'system',
        content:
          'Bạn là trợ lý học tiếng Anh thân thiện. Trả lời ngắn gọn, rõ ràng, đi thẳng vào trọng tâm (có ví dụ dễ hiểu khi cần).',
      },
      ...history.slice(-10),
      { role: 'user', content: userMessage },
    ]

    let upstreamRes: Response | null = null
    let chosenModel = candidateModels[0]
    let lastStatus = 500
    let lastErrText = ''

    for (const model of candidateModels) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          max_tokens: 700,
          temperature: 0.6,
        }),
        signal: req.signal,
      })

      if (res.ok && res.body) {
        upstreamRes = res
        chosenModel = model
        cachedChatVietModel = model
        break
      }

      lastStatus = res.status
      lastErrText = await res.text().catch(() => '')
      console.error(`[student-chat-api | ${model}] HTTP ${lastStatus}:`, lastErrText)

      // 404 hoặc 503 (New-API model_not_found) -> thử model tiếp theo
      if (lastStatus === 404 || lastStatus === 503) {
        if (cachedChatVietModel === model) cachedChatVietModel = null
        continue
      }
      break
    }

    if (!upstreamRes || !upstreamRes.body) {
      return Response.json({ error: 'Hệ thống gặp vấn đề' }, { status: lastStatus || 500 })
    }

    // Chuyển luồng SSE từ OpenAI-compatible sang luồng text thuần để client đọc tức thì
    const reader = upstreamRes.body.getReader()
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = ''
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const rawLine of lines) {
              const line = rawLine.trim()
              if (!line || !line.startsWith('data:')) continue

              const dataStr = line.slice(5).trim()
              if (dataStr === '[DONE]') {
                controller.close()
                return
              }

              try {
                const json = JSON.parse(dataStr)
                const delta = json?.choices?.[0]?.delta?.content
                if (typeof delta === 'string' && delta.length > 0) {
                  controller.enqueue(encoder.encode(delta))
                }
              } catch {
                // Bỏ qua chunk chưa hoàn chỉnh
              }
            }
          }
        } catch (err) {
          console.error('[student-chat-api] Stream read error:', err)
        } finally {
          reader.releaseLock()
          try {
            controller.close()
          } catch {
            // already closed
          }
        }
      },
      cancel() {
        reader.cancel().catch(() => {})
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-AI-Model': chosenModel,
      },
    })
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return new Response('', { status: 499 })
    }
    console.error('[student-chat-api] Unexpected error:', err)
    return Response.json({ error: 'Hệ thống gặp vấn đề' }, { status: 500 })
  }
}

