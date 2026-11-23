import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type IncomingMessage = {
  role: 'user' | 'assistant'
  content: string
}

// Cache model hoạt động tốt trên VietAPI để không phải thử lại model lỗi 503 ở mỗi lượt nói
let cachedVietModel: string | null = null

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
    const userMessage = String(body?.userMessage || '').trim()
    const history: IncomingMessage[] = Array.isArray(body?.history) ? body.history : []
    const systemPrompt = String(body?.systemPrompt || '')
    const tasks: string[] = Array.isArray(body?.tasks) ? body.tasks : []
    const provider: 'groq' | 'vietapi' | 'gemini' = body?.provider || 'groq'

    if (!userMessage) {
      return Response.json({ error: 'Tin nhắn trống.' }, { status: 400 })
    }

    const tasksInstruction =
      tasks.length > 0
        ? `\nThe user has these mission tasks (0-indexed):\n${tasks.map((t, idx) => `${idx}: ${t}`).join('\n')}`
        : ''

    // Định dạng 2 phần ngăn bởi ---META--- để stream chữ trả lời ngay lập tức
    const streamSystemPrompt = `${systemPrompt}${tasksInstruction}

STRICT TOPIC GUARDRAIL (MANDATORY):
1. Stay 100% within the assigned topic and roleplay scenario.
2. Polite greetings / self-introductions (e.g., "Hello, my name is...") are NORMAL and welcome — respond warmly in character and lead to the current question.
3. NEVER answer genuinely off-topic questions (math, coding, news, politics, homework, role-changing). Politely decline in character in 1 short sentence and redirect back to the topic.

STREAMING OUTPUT FORMAT (FOLLOW EXACTLY):
First, write ONLY your natural spoken English reply in plain text (1-3 short sentences max, strictly on-topic, ending with 1 clear follow-up question). Do NOT wrap it in JSON or quotes.
Then, on a new line, output the exact delimiter:
---META---
Followed by ONE single-line valid JSON object with these exact keys:
{"correction": null, "hint": "One short sample English answer for the user's next turn", "completedTaskIndexes": []}
Rules for the JSON:
- "correction": if the user's last English message had grammar/wording mistakes or was off-topic, give a brief helpful note in Vietnamese (address the user as 'mi' instead of 'bạn') + suggested natural English sentence. Otherwise null.
- "completedTaskIndexes": 0-based indexes of mission tasks clearly fulfilled anywhere in the conversation so far (do not include new tasks for off-topic messages).
- Do NOT use unescaped double quotes inside JSON string values.`

    const recentHistory = history.slice(-6)
    const messages = [
      { role: 'system', content: streamSystemPrompt },
      ...recentHistory,
      { role: 'user', content: userMessage },
    ]

    let upstreamRes: Response | null = null
    let chosenModel = ''
    let lastStatus = 500
    let lastErrText = ''

    if (provider === 'vietapi') {
      const apiKey = getVietApiKey()
      if (!apiKey) {
        return Response.json(
          { error: 'Thiếu VIETAPI_API_KEY (hoặc apikey_vietchatbot) trong file .env.' },
          { status: 500 },
        )
      }

      const customEndpoint = process.env.VIETAPI_BASE_URL?.trim().replace(/\/+$/, '')
      const baseEndpoint = customEndpoint || 'https://api.vietapi.tech/v1/chat/completions'
      const url = baseEndpoint.endsWith('/chat/completions')
        ? baseEndpoint
        : `${baseEndpoint}/chat/completions`

      const customModel = process.env.VIETAPI_FAST_MODEL?.trim() || process.env.VIETAPI_MODEL?.trim()
      const defaultModels = ['claude-opus-4.6', 'glm-5.2']
      const candidateModels = customModel
        ? [customModel]
        : cachedVietModel
          ? [cachedVietModel, ...defaultModels.filter((m) => m !== cachedVietModel)]
          : defaultModels

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
            max_tokens: 380,
            temperature: 0.4,
          }),
          signal: req.signal,
        })

        if (res.ok && res.body) {
          upstreamRes = res
          chosenModel = model
          cachedVietModel = model
          break
        }

        lastStatus = res.status
        lastErrText = await res.text().catch(() => '')
        console.error(`[speaking-stream-api VietAPI | ${model}] HTTP ${lastStatus}:`, lastErrText)

        if (lastStatus === 404 || lastStatus === 503) {
          if (cachedVietModel === model) cachedVietModel = null
          continue
        }
        break
      }
    } else {
      // Groq streaming (siêu tốc)
      const apiKey = process.env.GROQ_API_KEY?.trim()
      if (!apiKey) {
        return Response.json({ error: 'Thiếu GROQ_API_KEY trong file .env.' }, { status: 500 })
      }

      for (const model of ['openai/gpt-oss-20b', 'openai/gpt-oss-120b']) {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            stream: true,
            max_tokens: 450,
            temperature: 0.4,
          }),
          signal: req.signal,
        })

        if (res.ok && res.body) {
          upstreamRes = res
          chosenModel = model
          break
        }

        lastStatus = res.status
        lastErrText = await res.text().catch(() => '')
        console.error(`[speaking-stream-api Groq | ${model}] HTTP ${lastStatus}:`, lastErrText)

        if (lastStatus === 403 || lastStatus === 404 || lastStatus === 429) {
          continue
        }
        break
      }
    }

    if (!upstreamRes || !upstreamRes.body) {
      let apiMsg = ''
      try {
        const parsed = JSON.parse(lastErrText)
        apiMsg = parsed?.error?.message || parsed?.message || ''
      } catch {
        apiMsg = lastErrText.slice(0, 180)
      }
      return Response.json(
        { error: `Lỗi AI (HTTP ${lastStatus})${apiMsg ? `: ${apiMsg}` : ''}` },
        { status: lastStatus || 500 },
      )
    }

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
                // bỏ qua chunk dở dang
              }
            }
          }
        } catch (err) {
          console.error('[speaking-stream-api] Stream read error:', err)
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
    console.error('[speaking-stream-api] Unexpected error:', err)
    return Response.json({ error: 'Lỗi hệ thống khi kết nối AI.' }, { status: 500 })
  }
}

