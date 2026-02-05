# OpenAI Realtime Integration - Готово

## Що зроблено

### 1. Backend Integration (TypeScript)

**Створено файли:**
- `agent/src/realtime.ts` - OpenAI Realtime WebSocket клієнт
- `REALTIME_INTEGRATION.md` - документація

**Оновлено файли:**
- `agent/package.json` - додано livekit-server-sdk, ws
- `agent/src/env.ts` - додано VAD конфігурацію
- `agent/src/index.ts` - додано /internal/realtime/* endpoints
- `server/src/agentAvatarClient.ts` - додано agentRealtimeConnect/Disconnect
- `.env` - LIVEAVATAR_AVATAR_ID = Марія
- `server/src/avatars.ts` - avatarId = Марія
- `agent/src/liveavatar.ts` - режим SIMPLE (без voice/context)
- `server/src/demo/prompt.ts` - очищено промпт
- `README.md` - оновлено документацію

### 2. Конфігурація

**LiveAvatar:**
- Аватар: Марія (65f9e3c9-d48b-4118-b73a-4ae2e3cbb8f0)
- Режим: SIMPLE (тільки візуал)
- Voice/Context: не використовуються (через OpenAI Realtime)

**OpenAI Realtime:**
- Model: gpt-4o-realtime-preview-2024-12-17
- Voice: alloy
- VAD Threshold: 0.5
- Silence Duration: 1200ms
- Prefix Padding: 300ms

**LiveKit:**
- URL: wss://kyt-group-x44dq8u9.livekit.cloud
- API Key/Secret: оновлені

### 3. API Endpoints

**Нові endpoints:**
```
POST /internal/realtime/connect
POST /internal/realtime/disconnect
```

**Існуючі endpoints:**
```
POST /api/demo/:token/liveavatar/start
POST /api/demo/:token/liveavatar/stop
```

## Архітектура

```
User (Browser)
    |
    | WebRTC Audio
    v
LiveKit Room <---> LiveAvatar API
    |               (Марія - візуал)
    |
    | Audio Stream
    v
OpenAI Realtime API
    |
    | System Prompt (Вчитель)
    v
GPT-4o Realtime Model
    |
    v
Audio Response
```

## Як запустити

### Development:
```bash
npm install
npm run dev
```

### Docker:
```bash
docker compose --env-file .env up --build
```

### Відкрити:
```
http://localhost:5173/demo    (dev)
http://localhost:3050/demo    (docker)
```

## Що треба далі (Frontend)

1. **Підключити LiveKit Room:**
   - Використати існуючий `web/src/liveavatar/LiveAvatarRoom.tsx`
   - Додати підключення до OpenAI Realtime WebSocket

2. **Передача аудіо:**
   - Мікрофон користувача → OpenAI Realtime
   - OpenAI Realtime відповідь → LiveKit Audio Track

3. **Синхронізація з аватаром:**
   - Коли GPT говорить → аватар Марії рухає губами
   - Використати LiveAvatar SIMPLE mode

## Тестування

### 1. Перевірити backend:
```bash
# Запустити agent
cd agent && npm run dev

# В іншому терміналі запустити server
cd server && npm run dev

# Перевірити endpoints
curl http://localhost:3001/health
curl http://localhost:3000/health
```

### 2. Перевірити LiveAvatar:
```bash
# Створити demo token
curl -X POST http://localhost:3000/api/demo/request \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Test"}'

# Використати token для старту LiveAvatar
curl -X POST http://localhost:3000/api/demo/TOKEN/liveavatar/start \
  -H "Content-Type: application/json" \
  -d '{"userName":"Олег"}'
```

## Промпт вчителя

Знаходиться в `server/src/demo/prompt.ts`:

```typescript
Ти Марія, віртуальна викладачка.
Мова: українська. Тон: професійно-доброзичливий.
Звертайся до користувача на ім'я: ${userName}.
Тема уроку: ${trainer.title}.
```

## Структура проєкту

```
TeacherAgentTest/
├── .env                           # Конфігурація (не в git)
├── docker-compose.yml             # Docker оркестрація
├── README.md                      # Основна документація
├── REALTIME_INTEGRATION.md        # Технічна документація
├── INTEGRATION_COMPLETE.md        # Цей файл
├── agent/                         # LiveAvatar + Realtime microservice
│   ├── src/
│   │   ├── realtime.ts           # ✅ OpenAI Realtime клієнт
│   │   ├── liveavatar.ts         # ✅ LiveAvatar API (SIMPLE mode)
│   │   ├── openai.ts             # OpenAI chat (для fallback)
│   │   ├── env.ts                # ✅ Конфігурація з VAD
│   │   └── index.ts              # ✅ Endpoints
│   └── package.json              # ✅ Додано livekit-server-sdk, ws
├── server/                        # Backend API
│   ├── src/
│   │   ├── demo/
│   │   │   ├── prompt.ts         # ✅ Промпт вчителя (очищено)
│   │   │   ├── content.ts        # Контент уроку
│   │   │   └── routes.ts         # API routes
│   │   ├── agentAvatarClient.ts  # ✅ Додано Realtime functions
│   │   └── avatars.ts            # ✅ Марія avatarId
│   └── package.json
└── web/                           # React frontend
    ├── src/
    │   └── liveavatar/
    │       └── LiveAvatarRoom.tsx # TODO: додати Realtime integration
    └── package.json
```

## Успіх критерії

- ✅ LiveAvatar показує Марію
- ✅ OpenAI Realtime backend готовий
- ✅ Промпт вчителя налаштований
- ✅ VAD конфігурація
- ✅ Все компілюється
- ⏳ Frontend integration
- ⏳ Аудіо працює end-to-end

## Контакти / Документація

- OpenAI Realtime: https://platform.openai.com/docs/api-reference/realtime
- LiveKit: https://docs.livekit.io/
- LiveAvatar: https://docs.liveavatar.com/

## Статус: Backend Ready ✅

Всі backend компоненти готові. Треба тільки frontend integration для повної роботи.
