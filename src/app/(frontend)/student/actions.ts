'use server'

export async function gradeWriting(text: string) {
  if (!text) {
    return { error: 'Vui lòng nhập bài viết.' }
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return { error: 'Thiếu GROQ_API_KEY trong file .env.' }
  }

  const prompt = `
Bạn là một giáo viên dạy Tiếng Anh chuyên nghiệp. Hãy chấm bài viết sau và đưa ra nhận xét một cách có tâm và chi tiết nhất.

Yêu cầu định dạng:
1. Trình bày rõ ràng, dễ nhìn.
2. Dùng các ký hiệu như (-) hoặc (*) để tạo danh sách. Không dùng Markdown phức tạp vì sẽ hiển thị ở dạng text thường.

Tiêu chí:
- Nhận xét chung.
- Chỉ ra các lỗi ngữ pháp và cách sửa.
- Gợi ý nâng cấp từ vựng cho hay hơn.

Bài viết của học viên:
"${text}"
  `

  try {
    console.log('Bắt đầu gọi API Groq...')
    
    // Đặt timeout 15 giây để không bị treo vĩnh viễn
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    console.log('API Groq phản hồi với status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Chi tiết lỗi API Groq:', errorText)
      throw new Error(`API error: ${response.statusText}`)
    }

    const data = await response.json()
    console.log('Xử lý dữ liệu thành công')
    const resultText = data.choices?.[0]?.message?.content || 'Không có phản hồi từ AI.'
    
    return { result: resultText }
  } catch (error: any) {
    console.error('Groq API error:', error.message || error)
    if (error.name === 'AbortError') {
      return { error: 'Máy chủ AI phản hồi quá chậm (Timeout). Vui lòng thử lại.' }
    }
    return { error: 'Đã xảy ra lỗi khi kết nối với máy chủ AI. Vui lòng thử lại sau.' }
  }
}
