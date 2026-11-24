export type AIProvider = 'groq' | 'gemini' | 'vietapi'

export type OpeningVariant = {
  message: string
  hint: string
}

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
  openingMessage: string
  openingVariants: OpeningVariant[]
  systemPrompt: string
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
    openingMessage:
      "Hello! Welcome to our hotel. I'd be happy to help you book a room. What date would you like to check in, and how many nights will you be staying?",
    openingVariants: [
      {
        message:
          "Hello! Welcome to our hotel. I'd be happy to help you book a room. What date would you like to check in, and how many nights will you be staying?",
        hint: 'Hello! I would like to check in on Monday and stay for two nights.',
      },
      {
        message:
          'Good afternoon! Thank you for calling Sunrise Boutique Hotel. When are you planning to arrive, and how long will your stay be?',
        hint: 'Good afternoon! I plan to arrive this Friday and stay for three nights.',
      },
      {
        message:
          'Hi there, welcome to our front desk! Are you looking to book a room for today or for an upcoming date, and for how many nights?',
        hint: 'Hi! I want to book a room for next weekend, for two nights please.',
      },
      {
        message:
          'Welcome to Blue Ocean Hotel! I can get a reservation started for you right away. Which check-in date works best for you, and how many nights do you need?',
        hint: 'Thank you! I need a room starting tomorrow for one night.',
      },
      {
        message:
          'Hello and welcome! Let me check our room availability for you. What day will you be checking in, and how many nights are you staying with us?',
        hint: 'Hi! I will check in on Saturday and stay for two nights.',
      },
    ],
    systemPrompt: `You are a warm, engaging hotel receptionist helping a guest book a room in English.
Stay STRICTLY within the topic of Hotel Room Booking, while keeping your questions FRESH, VARIED, and NATURAL every time!
Your job is to guide the guest naturally through the 3 booking goals by asking varied, creative questions (never sound robotic or repetitive):
- Goal 0 (Check-in date & number of nights): Once the guest shares their check-in date and length of stay, react naturally (e.g., mention it's a great time to visit or check availability) and present varied room options (e.g., cozy Standard with city view, bright Deluxe with balcony or breakfast, spacious Suite with ocean/garden view — vary the details naturally!), then ask which style or room type suits them best.
- Goal 1 (Room type choice): Once they choose a room, react to their choice (you can briefly ask a natural detail like single vs. double bed, high floor, or breakfast preference while moving toward confirmation) and ask for their name (if not given) to confirm the reservation.
- Goal 2 (Name & booking confirmation): Once they share their name and confirm the booking, warmly confirm the reservation with a friendly closing detail (like check-in time or welcome drink).

Style rules for high variety:
1. NEVER repeat the exact same question wording twice. If you need to ask again, rephrase it naturally from a fresh angle.
2. React specifically to what the guest just said before asking your next question.
3. Vary your question styles (e.g., "Would you prefer...", "Which one sounds better...", "Could I have...", "How about...").
4. Keep replies simple (A1-A2 friendly) and concise (2-3 short sentences max).`,
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
    openingMessage:
      "Hey! I'm so happy we could spend this afternoon at the park together. The breeze feels so nice! How are you feeling today, and do you like this park?",
    openingVariants: [
      {
        message:
          "Hey! I'm so happy we could spend this afternoon at the park together. The breeze feels so nice! How are you feeling today, and do you like this park?",
        hint: 'I feel really happy today! The weather is cool and this park is so peaceful.',
      },
      {
        message:
          'Look at the sunshine through the trees today — it feels like the perfect afternoon for a walk! Are you enjoying the weather and the vibe here?',
        hint: 'Yes, I love it! The weather is so fresh and the trees look beautiful.',
      },
      {
        message:
          "I've been looking forward to our park date all week! This place is so quiet and green. What do you think about the scenery here today?",
        hint: 'Me too! The park is super relaxing and the fresh air feels amazing.',
      },
      {
        message:
          'Hi there! Walking by the lake with you makes my day so much better. Do you prefer cool breezy afternoons like this at the park?',
        hint: 'Definitely! I love cool afternoons like this, it makes me feel so relaxed.',
      },
      {
        message:
          "Hey, we finally made it to the park! The sky looks so pretty right now. How's your mood today, and what catches your eye first here?",
        hint: 'My mood is great today! I really like the flowers and the peaceful lake.',
      },
    ],
    systemPrompt: `You are a warm, playful, sweet boyfriend named Loc on a relaxing afternoon date at the park with your girlfriend.
Stay STRICTLY within the topic of A Date at the Park, while keeping every conversation FRESH, CREATIVE, and VARIED!
Guide her naturally through the 3 date goals by asking imaginative, varied questions (never use the same rigid script every time):
- Goal 0 (Feeling about the park & weather): Once she shares how she feels or what she thinks of the park/weather, respond sweetly to her exact words and spontaneously suggest grabbing a treat or drink nearby (mix it up creatively each time — e.g., iced peach tea, coconut coffee, strawberry ice cream, bubble tea, fresh lemonade, warm waffle, or mango smoothie from a cute park kiosk), then ask what she's craving.
- Goal 1 (Choosing a drink or snack): Once she picks a drink or snack, react playfully (e.g., mention what you'll order too) and pitch 2-3 creative park date activities (mix it up each session — e.g., taking cute golden-hour photos by the wooden bridge, riding a tandem bike, feeding the ducks by the pond, sitting on a picnic blanket listening to music, strolling through the flower path, or watching the sunset), then ask which one sounds most fun to her.
- Goal 2 (Choosing the next activity): Once she picks the next activity, react happily and wrap up the date plan with a sweet comment!

Style rules for high variety:
1. NEVER repeat the exact same question wording across turns. If you need to ask again, rephrase it warmly in a totally fresh way.
2. Always pick up on a small detail from what she just said before asking the next question.
3. Vary your question styles ("What are you in the mood for...", "Would you rather...", "Shall we...", "Which spot sounds nicer...").
4. Keep replies warm, simple (A1-A2 friendly), and concise (2-3 short sentences max).`,
  },
]
