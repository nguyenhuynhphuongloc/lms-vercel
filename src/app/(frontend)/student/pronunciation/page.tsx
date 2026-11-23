import PronunciationChecker from './PronunciationChecker'

export const metadata = {
  title: 'Kiểm tra phát âm từ vựng AI',
  description: 'Thu âm hoặc tải lên audio để AI chấm điểm độ chính xác phát âm tiếng Anh theo phần trăm.',
}

export default function PronunciationPage() {
  return <PronunciationChecker />
}

