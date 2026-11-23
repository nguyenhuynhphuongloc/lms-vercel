'use server'

export type SyllableAssessment = {
  part: string
  status: 'correct' | 'close' | 'incorrect'
  note?: string
}

export type PronunciationResult = {
  accuracy: number
  grade: string
  targetText: string
  spokenText: string
  ipaTarget: string
  ipaSpoken: string
  breakdown: {
    phonemeAccuracy: number
    clarity: number
    stressIntonation: number
  }
  syllables: SyllableAssessment[]
  mistakes: string[]
  tips: string[]
  summaryVi: string
  error?: string
}

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

function computeTextSimilarity(target: string, spoken: string): number {
  const a = normalizeText(target)
  const b = normalizeText(spoken)
  if (!a || !b) return 0
  if (a === b) return 100
  const maxLen = Math.max(a.length, b.length)
  const dist = levenshteinDistance(a, b)
  return Math.max(0, Math.round(((maxLen - dist) / maxLen) * 100))
}

export async function checkPronunciation(formData: FormData): Promise<PronunciationResult> {
  const apiKey = process.env.GROQ_API_KEY
  const targetText = String(formData.get('targetText') || '').trim()
  const audioFile = formData.get('audio') as Blob | null
  const browserSpokenText = String(formData.get('browserSpokenText') || '').trim()
  const browserConfidenceRaw = formData.get('browserConfidence')
  const browserConfidence =
    browserConfidenceRaw !== null && browserConfidenceRaw !== ''
      ? Math.max(0, Math.min(1, Number(browserConfidenceRaw)))
      : null

  const emptyError = (msg: string): PronunciationResult => ({
    accuracy: 0,
    grade: 'Lỗi',
    targetText,
    spokenText: '',
    ipaTarget: '',
    ipaSpoken: '',
    breakdown: { phonemeAccuracy: 0, clarity: 0, stressIntonation: 0 },
    syllables: [],
    mistakes: [],
    tips: [],
    summaryVi: '',
    error: msg,
  })

  if (!apiKey) return emptyError('Thiếu GROQ_API_KEY trong file .env.')
  if (!targetText) return emptyError('Vui lòng nhập hoặc chọn từ vựng cần kiểm tra.')
  if (!browserSpokenText && (!audioFile || audioFile.size === 0)) {
    return emptyError('Không tìm thấy dữ liệu giọng nói hoặc âm thanh.')
  }

  let spokenText = browserSpokenText
  let avgLogprob = -0.3
  let noSpeechProb = 0
  let acousticClarityOverride: number | null = null

  if (browserSpokenText) {
    // Dùng thẳng kết quả từ Web Speech API của trình duyệt (miễn phí, 0ms upload, không cần Whisper!)
    acousticClarityOverride =
      browserConfidence !== null && browserConfidence > 0
        ? Math.round(browserConfidence * 100)
        : 85
  } else if (audioFile) {
    // Fallback / Tab tải file Audio: gửi lên Groq Whisper
    const groqFormData = new FormData()
    const supportedExts = ['flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'opus', 'wav', 'webm']
    const rawName = typeof (audioFile as File).name === 'string' ? (audioFile as File).name : ''
    const rawExt = rawName.includes('.') ? rawName.split('.').pop()?.toLowerCase() || '' : ''

    let safeFileName = rawName
    if (!supportedExts.includes(rawExt)) {
      const mime = (audioFile.type || '').toLowerCase()
      let ext = 'webm'
      if (mime.includes('mpeg') || mime.includes('mp3')) ext = 'mp3'
      else if (mime.includes('wav')) ext = 'wav'
      else if (mime.includes('m4a') || mime.includes('mp4')) ext = 'm4a'
      else if (mime.includes('ogg')) ext = 'ogg'
      else if (mime.includes('opus')) ext = 'opus'
      else if (mime.includes('flac')) ext = 'flac'
      safeFileName = `recording.${ext}`
    }

    groqFormData.append('file', audioFile, safeFileName)
    groqFormData.append('model', 'whisper-large-v3')
    groqFormData.append('response_format', 'verbose_json')
    groqFormData.append('language', 'en')
    groqFormData.append('temperature', '0')

    try {
      const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: groqFormData,
      })

      if (!whisperRes.ok) {
        const errText = await whisperRes.text().catch(() => '')
        console.error(`[checkPronunciation] Whisper HTTP ${whisperRes.status}:`, errText)
        return emptyError(
          `Lỗi nhận diện âm thanh (HTTP ${whisperRes.status}). Hãy chuyển sang tab Thu âm trực tiếp (Web Speech API miễn phí) hoặc bật lại Whisper trên Groq.`,
        )
      }

      const whisperData = await whisperRes.json()
      spokenText = String(whisperData.text || '').trim()

      if (Array.isArray(whisperData.segments) && whisperData.segments.length > 0) {
        const segs = whisperData.segments
        const sumLogprob = segs.reduce(
          (acc: number, s: any) => acc + (typeof s.avg_logprob === 'number' ? s.avg_logprob : -0.3),
          0,
        )
        const sumNoSpeech = segs.reduce(
          (acc: number, s: any) => acc + (typeof s.no_speech_prob === 'number' ? s.no_speech_prob : 0),
          0,
        )
        avgLogprob = sumLogprob / segs.length
        noSpeechProb = sumNoSpeech / segs.length
      }
    } catch (err) {
      console.error('[checkPronunciation] Whisper error:', err)
      return emptyError('Lỗi kết nối khi phân tích file âm thanh.')
    }
  }

  // Trường hợp không có giọng nói trong audio
  if (!spokenText || noSpeechProb > 0.85) {
    return {
      accuracy: 0,
      grade: 'Chưa nghe rõ',
      targetText,
      spokenText: spokenText || '(Không nghe thấy giọng nói)',
      ipaTarget: '',
      ipaSpoken: '',
      breakdown: { phonemeAccuracy: 0, clarity: 0, stressIntonation: 0 },
      syllables: [
        {
          part: targetText,
          status: 'incorrect',
          note: 'Không nhận diện được giọng nói trong đoạn thu âm.',
        },
      ],
      mistakes: ['Đoạn audio quá nhỏ, bị nhiễu hoặc chưa có giọng nói tiếng Anh.'],
      tips: [
        'Đưa micro gần miệng hơn và nói to, rõ ràng hơn.',
        'Đảm bảo môi trường xung quanh yên tĩnh khi thu âm.',
      ],
      summaryVi: 'AI chưa nghe rõ giọng đọc của bạn. Hãy thử thu âm lại nhé!',
    }
  }

  // Tính chỉ số âm học bổ trợ để AI đánh giá thực tế hơn
  // avgLogprob càng gần 0 càng rõ (thường -0.05 là rất rõ, -0.5 là khá ổn, -1.2 là mờ/lệch âm)
  const acousticClarity =
    acousticClarityOverride !== null
      ? acousticClarityOverride
      : Math.max(0, Math.min(100, Math.round(Math.exp(avgLogprob) * 100)))
  const textSimilarity = computeTextSimilarity(targetText, spokenText)

  // Bước 2: Gửi kết quả âm học + transcript cho AI chuyên gia ngữ âm đánh giá % và hướng dẫn chi tiết
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000)

    const evalPrompt = `Bạn là chuyên gia ngữ âm học (English Pronunciation & Phonetics Coach) chấm điểm phát âm cho học viên Việt Nam.

Dữ liệu đầu vào từ bộ nhận diện giọng nói (ASR Whisper):
- Từ / cụm từ mục tiêu (Target): "${targetText}"
- Văn bản ASR thực tế nghe được từ audio (Spoken): "${spokenText}"
- Độ khớp chữ cơ bản (Text Similarity): ${textSimilarity}%
- Độ tin cậy âm học của mô hình ASR (Acoustic Clarity score, từ avg_logprob=${avgLogprob.toFixed(3)}): ${acousticClarity}%

Quy tắc chấm điểm công bằng & thực tế:
1. Nếu Spoken khớp hoàn toàn Target và Acoustic Clarity cao (>= 75%), điểm accuracy nên trong khoảng 88% - 99%.
2. Nếu Spoken khớp Target nhưng Acoustic Clarity trung bình/thấp (35% - 74%), nghĩa là phát âm hơi mờ hoặc nhấn âm chưa thật chuẩn, chấm khoảng 68% - 86%.
3. Nếu Spoken sai một vài âm (ví dụ thiếu âm cuối, nhầm nguyên âm/phụ âm gần nhau như "college" vs "colleague", "word" vs "world"), hãy chỉ rõ âm bị sai và chấm tương xứng (40% - 75%).
4. Nếu Spoken khác hoàn toàn Target, chấm thấp (5% - 35%).
5. Luôn tách Target thành các âm tiết (nếu là 1 từ) hoặc các từ (nếu là cụm từ/câu) trong mảng "syllables" và gán status ("correct" | "close" | "incorrect").

BẮT BUỘC trả về JSON hợp lệ DUY NHẤT (không markdown fence, không text thừa):
{
  "accuracy": 86,
  "grade": "Tốt",
  "ipaTarget": "/.../",
  "ipaSpoken": "/.../",
  "breakdown": {
    "phonemeAccuracy": 88,
    "clarity": 85,
    "stressIntonation": 84
  },
  "syllables": [
    { "part": "comf", "status": "correct", "note": "Âm đầu chuẩn" },
    { "part": "ta", "status": "close", "note": "Hơi kéo dài âm" },
    { "part": "ble", "status": "correct" }
  ],
  "mistakes": [
    "Mô tả lỗi phát âm cụ thể bằng tiếng Việt (mảng rỗng nếu đọc rất chuẩn)"
  ],
  "tips": [
    "Mẹo đặt lưỡi / môi / trọng âm cụ thể bằng tiếng Việt để đọc hay như người bản xứ"
  ],
  "summaryVi": "1-2 câu nhận xét khích lệ ngắn gọn bằng tiếng Việt."
}
LƯU Ý QUAN TRỌNG: Không dùng dấu ngoặc kép (") bên trong nội dung các chuỗi tiếng Việt, hãy dùng dấu nháy đơn (') nếu cần trích dẫn từ.`

    const buildFallbackResult = (): PronunciationResult => {
      const fallbackScore = Math.round(textSimilarity * 0.7 + acousticClarity * 0.3)
      return {
        accuracy: fallbackScore,
        grade:
          fallbackScore >= 90
            ? 'Xuất sắc'
            : fallbackScore >= 75
              ? 'Tốt'
              : fallbackScore >= 55
                ? 'Khá'
                : 'Cần luyện thêm',
        targetText,
        spokenText,
        ipaTarget: '',
        ipaSpoken: '',
        breakdown: {
          phonemeAccuracy: textSimilarity,
          clarity: acousticClarity,
          stressIntonation: fallbackScore,
        },
        syllables: [
          {
            part: targetText,
            status: fallbackScore >= 80 ? 'correct' : fallbackScore >= 50 ? 'close' : 'incorrect',
          },
        ],
        mistakes:
          textSimilarity < 100
            ? [`AI nghe thấy '${spokenText}' thay vì '${targetText}'.`]
            : [],
        tips: ['Nghe lại phát âm mẫu chậm (0.7x) và chú ý âm cuối cũng như trọng âm.'],
        summaryVi: `Độ chính xác ước tính của bạn là ${fallbackScore}%.`,
      }
    }

    const llmRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are an expert English phonetics evaluator. Return ONLY a strictly valid JSON object with properly escaped quotes.',
          },
          { role: 'user', content: evalPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.2,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!llmRes.ok) {
      const errBody = await llmRes.text().catch(() => '')
      console.error(`[checkPronunciation] LLM HTTP ${llmRes.status}:`, errBody)
      return buildFallbackResult()
    }

    const llmData = await llmRes.json()
    const rawContent: string = llmData.choices?.[0]?.message?.content || ''
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/)

    if (jsonMatch) {
      let parsed: any = null
      try {
        parsed = JSON.parse(jsonMatch[0])
      } catch {
        try {
          // Thử làm sạch dấu phẩy thừa trước ] hoặc } và xuống dòng raw trong chuỗi
          const cleaned = jsonMatch[0]
            .replace(/,\s*([}\]])/g, '$1')
            .replace(/\r?\n/g, ' ')
          parsed = JSON.parse(cleaned)
        } catch (parseErr) {
          console.warn('[checkPronunciation] JSON parse fallback triggered:', parseErr)
        }
      }

      if (parsed && typeof parsed === 'object') {
        const accuracy = Math.max(0, Math.min(100, Math.round(Number(parsed.accuracy) || 0)))
        const grade =
          parsed.grade ||
          (accuracy >= 90
            ? 'Xuất sắc'
            : accuracy >= 75
              ? 'Tốt'
              : accuracy >= 55
                ? 'Khá'
                : 'Cần luyện thêm')

        return {
          accuracy,
          grade,
          targetText,
          spokenText,
          ipaTarget: String(parsed.ipaTarget || ''),
          ipaSpoken: String(parsed.ipaSpoken || ''),
          breakdown: {
            phonemeAccuracy: Math.max(
              0,
              Math.min(100, Math.round(Number(parsed.breakdown?.phonemeAccuracy) || accuracy)),
            ),
            clarity: Math.max(
              0,
              Math.min(100, Math.round(Number(parsed.breakdown?.clarity) || acousticClarity)),
            ),
            stressIntonation: Math.max(
              0,
              Math.min(100, Math.round(Number(parsed.breakdown?.stressIntonation) || accuracy)),
            ),
          },
          syllables: Array.isArray(parsed.syllables) ? parsed.syllables : [],
          mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes : [],
          tips: Array.isArray(parsed.tips) ? parsed.tips : [],
          summaryVi: String(parsed.summaryVi || ''),
        }
      }
    }

    // Fallback nếu AI không trả đúng JSON
    return buildFallbackResult()
  } catch (err: any) {
    console.error('[checkPronunciation] Eval error:', err)
    return emptyError(
      err?.name === 'AbortError'
        ? 'AI phân tích quá lâu (timeout). Vui lòng thử lại.'
        : 'Lỗi khi phân tích phát âm. Vui lòng thử lại.',
    )
  }
}

