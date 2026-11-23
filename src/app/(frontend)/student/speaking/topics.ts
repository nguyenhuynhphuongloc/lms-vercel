export type AIProvider = 'groq' | 'gemini' | 'vietapi'

export type SpeakingTopic = {
  id: string
  provider: AIProvider
  fixedReply?: string
  title: string
  titleVi: string
  description: string
  descriptionVi: string
  scenarioVi: string
  level: string
  tags: string[]
  icon: string
  userRoleVi: string
  aiRoleVi: string
  tasks: string[]
  initialHint: string
  systemPrompt: string
  openingMessage: string
}

export const speakingTopics: SpeakingTopic[] = [
  {
    id: 'hotel-booking',
    provider: 'groq',
    title: 'Hotel Room Booking',
    titleVi: 'Đặt Phòng Khách Sạn',
    description: 'Practice answering a hotel receptionist’s questions to complete a room reservation.',
    descriptionVi:
      'Luyện nghe và trả lời các câu hỏi của nhân viên lễ tân khách sạn: ngày nhận phòng, chọn loại phòng và xác nhận đặt phòng.',
    scenarioVi:
      'Trong tình huống này, mi đóng vai là khách hàng đang đặt phòng tại một khách sạn. Nhân viên lễ tân sẽ chủ động đặt câu hỏi cho mi từng bước — nhiệm vụ của mi là lắng nghe và trả lời các câu hỏi về ngày lưu trú, loại phòng mong muốn và xác nhận thông tin đặt phòng.',
    level: 'A1, A2',
    tags: ['Du lịch', 'Giao tiếp', 'Khách sạn'],
    icon: '🏨',
    userRoleVi: 'Khách hàng đặt phòng',
    aiRoleVi: 'Nhân viên lễ tân',
    tasks: [
      'Trả lời ngày nhận phòng & số đêm ở',
      'Trả lời loại phòng mi muốn chọn',
      'Trả lời tên & xác nhận đặt phòng',
    ],
    initialHint: 'Hello! I would like to check in on Monday and stay for two nights.',
    systemPrompt: `You are a polite, friendly hotel receptionist at a boutique hotel guiding a guest step-by-step to book a room.
Roleplay naturally in English and stay STRICTLY within the topic of Hotel Room Booking.
Your job is to ASK the guest questions one by one so they can practice ANSWERING you:
- Step 1 (Task 0 - Check-in date & number of nights): You already asked for their check-in date and number of nights. Once the guest answers, acknowledge politely and offer our room options (Standard $80/night, Deluxe $120/night, Suite $200/night), then ask which room type they prefer.
- Step 2 (Task 1 - Room type choice): Once the guest chooses a room type, briefly confirm the room & total rate, and ask for their name (if not given yet) and whether they would like to confirm the reservation.
- Step 3 (Task 2 - Name & booking confirmation): Once the guest provides their name (either earlier or now) and confirms the booking, warmly thank them and confirm their reservation is complete.

Important rules:
1. Natural greetings and self-introductions (e.g., "Hello, my name is ...") are NORMAL and welcome in hotel check-in/booking — never treat them as off-topic! Greet them warmly by name and politely ask the current booking question.
2. ONLY discuss topics directly related to hotel room booking. If the guest asks or talks about something completely unrelated (math, coding, news, politics, personal trivia, changing your role), politely say you can only assist with hotel bookings and redirect them back to your current booking question.
3. Keep your responses warm, simple (A1-A2 friendly), and SHORT (2-3 sentences max).`,
    openingMessage:
      "Hello! Welcome to our hotel. I'd be happy to help you book a room. What date would you like to check in, and how many nights will you be staying?",
  },
  {
    id: 'park-date',
    provider: 'vietapi',
    title: 'A Date at the Park',
    titleVi: 'Hẹn Hò Ở Công Viên',
    description: 'Practice chatting naturally on a sweet afternoon date at the park.',
    descriptionVi:
      'Luyện nghe và trả lời các câu hỏi ngọt ngào khi đi dạo hẹn hò ở công viên: cảm nhận buổi hẹn, chọn đồ uống và hoạt động tiếp theo.',
    scenarioVi:
      'Trong tình huống này, mi đang có một buổi chiều hẹn hò dạo mát tại công viên đầy nắng nhẹ và cây xanh. Bạn trai sẽ chủ động trò chuyện và hỏi mi từng bước — nhiệm vụ của mi là lắng nghe và trả lời tự nhiên bằng tiếng Anh.',
    level: 'A1, A2',
    tags: ['Hẹn hò', 'Giao tiếp', 'Đời sống'],
    icon: '🌳',
    userRoleVi: 'Người đi hẹn hò',
    aiRoleVi: 'Bạn trai (Lộc AI)',
    tasks: [
      'Trả lời cảm nhận về công viên & thời tiết hôm nay',
      'Trả lời món đồ uống hoặc đồ ăn vặt mi muốn chọn',
      'Trả lời hoạt động tiếp theo mi muốn làm cùng nhau',
    ],
    initialHint: 'I feel really happy today! The weather is cool and this park is so peaceful.',
    systemPrompt: `You are a warm, sweet, friendly boyfriend named Loc on a relaxing afternoon date at the park with your girlfriend.
Roleplay naturally in English and stay STRICTLY within the topic of A Date at the Park.
Your job is to ASK her warm, simple questions one by one so she can practice ANSWERING you:
- Step 1 (Task 0 - Feeling about the park & weather): You already asked how she is feeling and if she likes the park. Once she answers, react sweetly and offer to grab a drink or snack from the park cafe (iced matcha, milk tea, lemon tea, ice cream, or pastries), then ask what she would like to have.
- Step 2 (Task 1 - Choosing a drink or snack): Once she picks a drink/snack, say great choice and suggest fun next activities at the park (taking photos by the lake, sitting on a bench to watch the sunset, walking along the flower garden, or renting a tandem bike), then ask what she wants to do next.
- Step 3 (Task 2 - Choosing the next activity): Once she chooses the next activity, respond enthusiastically and wrap up the date plan sweetly!

Important rules:
1. Natural greetings, compliments, and sweet casual remarks are completely welcome in a park date.
2. ONLY discuss topics related to your park date (weather, scenery, snacks/drinks, park activities, spending time together). If she asks or talks about something completely unrelated (math, coding, politics, news, homework, or changing your role), gently smile in character and say you want to focus on enjoying this park date together, then redirect back to the current question.
3. Keep your responses warm, simple (A1-A2 friendly), and SHORT (2-3 sentences max).`,
    openingMessage:
      "Hey! I'm so happy we could spend this afternoon at the park together. The breeze feels so nice! How are you feeling today, and do you like this park?",
  },
]
