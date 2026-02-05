# OpenAI Realtime API Integration

## Статус інтеграції

**Backend готовий:**
- OpenAI Realtime WebSocket клієнт створено
- Endpoints для підключення/відключення реалізовані
- Конфігурація VAD (Voice Activity Detection) налаштована

**Що працює:**
1. LiveAvatar показує Марію (візуальний аватар)
2. LiveKit генерує токени для підключення
3. OpenAI Realtime API готовий приймати аудіо
4. Промпт вчителя налаштований

**Що треба доробити:**
Frontend інтеграцію - підключити React до Realtime WebSocket і передавати аудіо.

## API Endpoints

### POST /internal/realtime/connect
Створює Realtime session з OpenAI.

**Request:**
```json
{
  "sessionId": "uuid",
  "livekitUrl": "wss://...",
  "livekitToken": "token",
  "systemPrompt": "Ти Марія, віртуальна викладачка..."
}
```

**Response:**
```json
{
  "ok": true,
  "sessionId": "uuid"
}
```

### POST /internal/realtime/disconnect
Закриває Realtime session.

**Request:**
```json
{
  "sessionId": "uuid"
}
```

## Конфігурація (.env)

```env
# OpenAI Realtime
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2024-12-17

# VAD (Voice Activity Detection)
OPENAI_VAD_THRESHOLD=0.5
OPENAI_VAD_PREFIX_PADDING_MS=300
OPENAI_VAD_SILENCE_DURATION_MS=1200
OPENAI_VAD_CREATE_RESPONSE=false

# LiveAvatar (тільки візуал)
LIVEAVATAR_AVATAR_ID=65f9e3c9-d48b-4118-b73a-4ae2e3cbb8f0

# LiveKit
LIVEKIT_URL=wss://kyt-group-x44dq8u9.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

## Архітектура

```
User Browser
    |
    | (WebRTC Audio)
    v
LiveKit Room <---> LiveAvatar (візуальний аватар Марії)
    |
    | (Audio WebSocket)
    v
OpenAI Realtime API
    |
    | (Промпт вчителя + VAD)
    v
GPT-4o Realtime Model
```

## Наступні кроки

1. **Frontend Integration:**
   - Підключити LiveKit Room в React
   - Створити WebSocket з'єднання до OpenAI Realtime
   - Передавати мікрофон користувача до Realtime API
   - Отримувати аудіо відповіді і програвати через LiveKit

2. **Testing:**
   - Перевірити що Марія відображається
   - Перевірити що голос працює
   - Перевірити що промпт відповідає (урок про AI в школах)

## Приклад використання (Server)

```typescript
import { agentRealtimeConnect, agentRealtimeDisconnect } from "./agentAvatarClient.js";
import { buildTeacherSystemPrompt } from "./demo/prompt.js";

// Створити Realtime session
const systemPrompt = buildTeacherSystemPrompt(trainer, userName);
await agentRealtimeConnect(env, {
  sessionId: demoSession.id,
  livekitUrl,
  livekitToken,
  systemPrompt
});

// Закрити session
await agentRealtimeDisconnect(env, demoSession.id);
```

## Voice Options

OpenAI Realtime підтримує голоси:
- **alloy** (поточний)
- ash
- ballad
- coral
- sage
- verse

Змінити голос можна в `agent/src/realtime.ts` (параметр `voice`).
