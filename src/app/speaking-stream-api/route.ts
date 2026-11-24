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

STRICT ENGLISH-ONLY & TOPIC GUARDRAIL (MANDATORY - NEVER VIOLATE):
1. Your spoken reply MUST be 100% in English ONLY. NEVER write Vietnamese or any other language in your spoken reply.
2. Stay 100% strictly within the assigned topic and mission tasks.
3. Polite English greetings / self-introductions (e.g., "Hello, my name is...") are acceptable — respond briefly in English in character and guide them to the current uncompleted mission question.
4. If the user's message is NOT in English, is unclear/garbled/nonsensical, or is off-topic (unrelated to the scenario, e.g., math, coding, news, politics, random questions):
   - Do NOT try to answer any off-topic or non-English request.
   - Politely say in English that you didn't understand (vary your phrasing naturally, do not repeat the exact same sentence every time).
   - Immediately ask the current uncompleted mission question again using a DIFFERENT, fresh phrasing so the conversation feels natural and varied.
   - Do NOT mark any new task as completed in "completedTaskIndexes".

CONVERSATIONAL VARIETY:
- Always respond naturally to specific details the user just mentioned before asking your next question.
- Vary your question patterns (Wh-questions, Would you rather..., How about..., Which one...) and bring fresh, lively details within the topic instead of repeating the same wording.

STREAMING OUTPUT FORMAT (FOLLOW EXACTLY):
First, write ONLY your natural spoken English reply in plain text (1-3 short sentences max, 100% English, strictly on-topic, ending with 1 clear question guiding toward the next uncompleted mission task). Do NOT wrap it in JSON or quotes.
Then, on a new line, output the exact delimiter:
---META---
Followed by ONE single-line valid JSON object with these exact keys:
{"correction": null, "hint": "One short sample English answer for the user's next turn", "completedTaskIndexes": []}
Rules for the JSON:
- "correction": if the user's last message was unclear, not in English, off-topic, or had grammar/wording mistakes, give a brief helpful note in Vietnamese (address the user as 'mi' instead of 'bạn') + suggested natural English sentence to answer the current mission question. Otherwise null.
- "completedTaskIndexes": 0-based indexes of mission tasks clearly fulfilled in English anywhere in the conversation so far (never add a task if the message was unclear, non-English, or off-topic).
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
        return Response.json({ error: 'Hệ thống gặp vấn đề' }, { status: 500 })
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
            temperature: 0.75,
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
        return Response.json({ error: 'Hệ thống gặp vấn đề' }, { status: 500 })
      }

      for (const model of ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']) {
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
            temperature: 0.75,
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
      return Response.json({ error: 'Hệ thống gặp vấn đề' }, { status: lastStatus || 500 })
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
    return Response.json({ error: 'Hệ thống gặp vấn đề' }, { status: 500 })
  }
}

