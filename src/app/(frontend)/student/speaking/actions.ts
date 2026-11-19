'use server'

export async function transcribeAudio(formData: FormData) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { error: 'Thiếu GROQ_API_KEY trong file .env' };
  }

  const audioFile = formData.get('audio') as Blob;
  if (!audioFile) {
    return { error: 'Không tìm thấy file âm thanh.' };
  }

  // Chuẩn bị dữ liệu gửi lên Groq Whisper
  const groqFormData = new FormData();
  groqFormData.append('file', audioFile, 'audio.webm');
  // Sử dụng mô hình whisper-large-v3-turbo siêu nhanh của Groq
  groqFormData.append('model', 'whisper-large-v3-turbo');
  groqFormData.append('response_format', 'json');
  // Có thể thêm tham số language: 'vi' để ép nhận diện tiếng Việt
  groqFormData.append('language', 'vi');

  try {
    console.log('Bắt đầu gửi audio lên Groq Whisper...');
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: groqFormData
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Groq Whisper Error:", errText);
      return { error: 'Lỗi khi gọi API nhận diện giọng nói.' };
    }

    const data = await response.json();
    console.log('Nhận diện hoàn tất!');
    return { text: data.text };
  } catch (err: any) {
    console.error('Lỗi hệ thống:', err);
    return { error: 'Đã xảy ra lỗi kết nối. Vui lòng thử lại.' };
  }
}
