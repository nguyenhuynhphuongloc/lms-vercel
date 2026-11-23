export type VocabItem = {
  id: string
  word: string
  ipa: string
  meaningVi: string
  level: 'A1-A2' | 'B1-B2' | 'C1'
  example: string
  tipVi: string
}

export const sampleVocabList: VocabItem[] = [
  {
    id: 'comfortable',
    word: 'comfortable',
    ipa: '/ˈkʌm.fə.tə.bəl/',
    meaningVi: 'thoải mái, dễ chịu',
    level: 'A1-A2',
    example: 'This chair is very comfortable.',
    tipVi: 'Nhấn trọng âm ở âm tiết đầu tiên (COMF-tơ-bồ), không đọc thành "com-for-table".',
  },
  {
    id: 'schedule',
    word: 'schedule',
    ipa: '/ˈskedʒ.uːl/',
    meaningVi: 'lịch trình, thời khóa biểu',
    level: 'A1-A2',
    example: 'Let me check my schedule for tomorrow.',
    tipVi: 'Theo giọng Mỹ đọc là /ˈskedʒ.uːl/ (SKE-chuồ), chú ý âm /dʒ/ ở giữa.',
  },
  {
    id: 'vegetable',
    word: 'vegetable',
    ipa: '/ˈvedʒ.tə.bəl/',
    meaningVi: 'rau củ',
    level: 'A1-A2',
    example: 'You should eat more fresh vegetables every day.',
    tipVi: 'Chỉ có 3 âm tiết (VEJ-tơ-bồ), nuốt âm "e" thứ hai, không đọc 4 âm tiết.',
  },
  {
    id: 'pronunciation',
    word: 'pronunciation',
    ipa: '/prəˌnʌn.siˈeɪ.ʃən/',
    meaningVi: 'cách phát âm',
    level: 'B1-B2',
    example: 'Good pronunciation helps people understand you easily.',
    tipVi: 'Âm giữa là /nʌn/ (năn), không phải /naʊn/ như từ "pronounce". Trọng âm rơi vào /eɪ/.',
  },
  {
    id: 'environment',
    word: 'environment',
    ipa: '/ɪnˈvaɪ.rən.mənt/',
    meaningVi: 'môi trường',
    level: 'B1-B2',
    example: 'We need to protect the natural environment.',
    tipVi: 'Nhấn mạnh âm tiết thứ hai /vaɪ/ và bật nhẹ âm cuối /t/.',
  },
  {
    id: 'colleague',
    word: 'colleague',
    ipa: '/ˈkɒl.iːɡ/',
    meaningVi: 'đồng nghiệp',
    level: 'B1-B2',
    example: 'I am having lunch with my colleague today.',
    tipVi: 'Âm cuối là /iːɡ/ (COL-leeg), tránh nhầm với từ "college" (/ˈkɒl.ɪdʒ/).',
  },
  {
    id: 'entrepreneur',
    word: 'entrepreneur',
    ipa: '/ˌɒn.trə.prəˈnɜːr/',
    meaningVi: 'doanh nhân khởi nghiệp',
    level: 'C1',
    example: 'She is a successful tech entrepreneur.',
    tipVi: 'Bắt đầu bằng âm /ɒn/ (on-trơ-prơ-NƠ), trọng âm chính rơi vào âm tiết cuối cùng.',
  },
  {
    id: 'thoroughly',
    word: 'thoroughly',
    ipa: '/ˈθɜːr.ə.li/',
    meaningVi: 'một cách kỹ lưỡng, triệt để',
    level: 'C1',
    example: 'Please review the report thoroughly before submitting.',
    tipVi: 'Đặt đầu lưỡi giữa hai răng cho âm /θ/, kết thúc nhẹ bằng /ə.li/.',
  },
  {
    id: 'development',
    word: 'development',
    ipa: '/dɪˈvel.əp.mənt/',
    meaningVi: 'sự phát triển',
    level: 'B1-B2',
    example: 'Software development requires continuous learning.',
    tipVi: 'Trọng âm rơi vào âm thứ 2 (di-VE-lợp-mần), không nhấn vào âm đầu.',
  },
  {
    id: 'world',
    word: 'world',
    ipa: '/wɜːrld/',
    meaningVi: 'thế giới',
    level: 'A1-A2',
    example: 'I want to travel around the world.',
    tipVi: 'Tròn môi âm /w/, cong lưỡi âm /ɜːr/, nâng đầu lưỡi chạm lợi cho /l/ rồi bật /d/.',
  },
]

