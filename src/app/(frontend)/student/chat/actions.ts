'use server'

export type ChatTextMessage = {
  role: 'user' | 'assistant'
  content: string
}

function getVietApiKey(): string | undefined {
  const raw =
    process.env.VIETAPI_API_KEY ||
    process.env.apikey_vietchatbot ||
    process.env.APIKEY_VIETCHATBOT
  return raw?.trim()
}

export async function sendChatMessage(
  userMessage: string,
  history: ChatTextMessage[],
): Promise<{ reply?: string; error?: string }> {
  const cleanMessage = userMessage.trim()
  if (!cleanMessage) {
    return { error: 'Vui lòng nhập nội dung tin nhắn.' }
  }

  const apiKey = getVietApiKey()
  if (!apiKey) {
    return { error: 'Hệ thống gặp vấn đề' }
  }

  const model = process.env.VIETAPI_MODEL?.trim() || 'claude-opus-4.6'
  const endpoint =
    process.env.VIETAPI_BASE_URL?.trim().replace(/\/+$/, '') ||
    'https://api.vietapi.tech/v1/chat/completions'
  const url = endpoint.endsWith('/chat/completions') ? endpoint : `${endpoint}/chat/completions`

  const messages = [
    {
      role: 'system',
      content:
        'Bạn là trợ lý học tiếng Anh thông minh, thân thiện và nhiệt tình. Trả lời rõ ràng, dễ hiểu bằng tiếng Việt (hoặc tiếng Anh theo ngôn ngữ người dùng hỏi), có ví dụ minh họa khi cần.',
    },
    ...history.slice(-16),
    { role: 'user', content: cleanMessage },
  ]

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error(`[ChatBot ${model}] HTTP ${response.status}:`, errText)
      return { error: 'Hệ thống gặp vấn đề' }
    }

    const data = await response.json()
    const reply: string = data?.choices?.[0]?.message?.content?.trim() || ''

    if (!reply) {
      return { error: 'Hệ thống gặp vấn đề' }
    }

    return { reply }
  } catch (err: any) {
    console.error('[ChatBot] Network error:', err)
    return { error: 'Hệ thống gặp vấn đề' }
  }
}

