import WebSocket from "ws";
import type { Env } from "./env.js";

interface AudioRouterOptions {
  sessionId: string;
  sessionToken: string;
  livekitWsUrl: string | null;
  systemPrompt: string;
  env: Env;
  onTranscript?: (role: "user" | "assistant", text: string) => void;
}

/**
 * AudioRouter connects OpenAI Realtime API with LiveAvatar for lip-sync.
 *
 * Flow:
 * 1. Client sends audio to this router via WebSocket
 * 2. Router forwards audio to OpenAI Realtime
 * 3. OpenAI responds with audio
 * 4. Router sends audio to LiveAvatar for lip-sync
 * 5. LiveAvatar streams lip-synced video via LiveKit
 */
export class AudioRouter {
  private openaiWs: WebSocket | null = null;
  private liveAvatarWs: WebSocket | null = null;
  private clientWs: WebSocket | null = null;
  private options: AudioRouterOptions;
  private sessionConfigured = false;
  private eventId = 0;
  private messageBuffer: string[] = [];

  constructor(options: AudioRouterOptions) {
    this.options = options;
  }

  private getEventId(): string {
    return `evt_${++this.eventId}`;
  }

  async connect(clientWs: WebSocket): Promise<void> {
    this.clientWs = clientWs;

    // Connect to OpenAI Realtime API
    await this.connectOpenAI();

    // Connect to LiveAvatar WebSocket if URL is available
    if (this.options.livekitWsUrl) {
      await this.connectLiveAvatar();
    } else {
      console.log("[AudioRouter] No LiveAvatar WebSocket URL - audio lip-sync disabled");
    }
  }

  private async connectOpenAI(): Promise<void> {
    const model = this.options.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview-2024-12-17";
    const openaiUrl = `wss://api.openai.com/v1/realtime?model=${model}`;

    console.log(`[AudioRouter] Connecting to OpenAI Realtime: ${model}`);

    this.openaiWs = new WebSocket(openaiUrl, {
      headers: {
        Authorization: `Bearer ${this.options.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1"
      }
    });

    this.openaiWs.on("open", () => {
      console.log("[AudioRouter] OpenAI WebSocket connected");
    });

    this.openaiWs.on("message", (data: Buffer) => {
      this.handleOpenAIMessage(data);
    });

    this.openaiWs.on("error", (err) => {
      console.error("[AudioRouter] OpenAI WebSocket error:", err);
    });

    this.openaiWs.on("close", (code, reason) => {
      console.log(`[AudioRouter] OpenAI WebSocket closed: ${code} ${reason.toString()}`);
    });
  }

  private async connectLiveAvatar(): Promise<void> {
    const wsUrl = this.options.livekitWsUrl;
    if (!wsUrl) return;

    console.log(`[AudioRouter] Connecting to LiveAvatar WebSocket: ${wsUrl}`);

    this.liveAvatarWs = new WebSocket(wsUrl);

    this.liveAvatarWs.on("open", () => {
      console.log("[AudioRouter] LiveAvatar WebSocket connected");
    });

    this.liveAvatarWs.on("message", (data: Buffer) => {
      const msg = JSON.parse(data.toString());
      console.log("[AudioRouter] LiveAvatar event:", msg.type);

      // Forward important events to client
      if (msg.type === "avatar.speaking_started" || msg.type === "avatar.speaking_ended") {
        this.sendToClient(msg);
      }
    });

    this.liveAvatarWs.on("error", (err) => {
      console.error("[AudioRouter] LiveAvatar WebSocket error:", err);
    });

    this.liveAvatarWs.on("close", (code, reason) => {
      console.log(`[AudioRouter] LiveAvatar WebSocket closed: ${code} ${reason.toString()}`);
    });
  }

  private handleOpenAIMessage(data: Buffer): void {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case "session.created":
          console.log("[AudioRouter] Session created, configuring...");
          this.configureSession();
          break;

        case "session.updated":
          console.log("[AudioRouter] Session configured");
          this.sessionConfigured = true;
          this.flushMessageBuffer();
          this.sendToClient(msg);
          break;

        case "response.audio.delta":
          // Send audio to LiveAvatar for lip-sync
          if (msg.delta && this.liveAvatarWs?.readyState === WebSocket.OPEN) {
            this.sendAudioToLiveAvatar(msg.delta);
          }
          // Also forward to client for direct playback fallback
          this.sendToClient(msg);
          break;

        case "response.audio.done":
          // Signal end of audio to LiveAvatar
          if (this.liveAvatarWs?.readyState === WebSocket.OPEN) {
            this.liveAvatarWs.send(JSON.stringify({
              type: "agent.speak_end",
              event_id: this.getEventId()
            }));
          }
          this.sendToClient(msg);
          break;

        case "conversation.item.input_audio_transcription.completed":
          if (msg.transcript && this.options.onTranscript) {
            this.options.onTranscript("user", msg.transcript);
          }
          this.sendToClient(msg);
          break;

        case "response.audio_transcript.done":
          if (msg.transcript && this.options.onTranscript) {
            this.options.onTranscript("assistant", msg.transcript);
          }
          this.sendToClient(msg);
          break;

        case "input_audio_buffer.speech_started":
          // Interrupt any playing audio on LiveAvatar
          if (this.liveAvatarWs?.readyState === WebSocket.OPEN) {
            this.liveAvatarWs.send(JSON.stringify({
              type: "agent.interrupt",
              event_id: this.getEventId()
            }));
          }
          this.sendToClient(msg);
          break;

        case "error":
          console.error("[AudioRouter] OpenAI error:", msg.error);
          this.sendToClient(msg);
          break;

        default:
          // Forward all other events to client
          this.sendToClient(msg);
      }
    } catch (err) {
      console.error("[AudioRouter] Error parsing OpenAI message:", err);
    }
  }

  private configureSession(): void {
    if (!this.openaiWs || this.openaiWs.readyState !== WebSocket.OPEN) return;

    // Use gpt-4o-transcribe for better Ukrainian support, fallback to whisper-1
    const transcribeModel = (this.options.env as any).OPENAI_TRANSCRIBE_MODEL || "whisper-1";

    const config = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions: this.options.systemPrompt,
        voice: "shimmer",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: transcribeModel,
          language: "uk" // Ukrainian hint for better transcription
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 3000, // 3 seconds pause before responding
          create_response: true
        }
      }
    };

    console.log(`[AudioRouter] Sending session.update with transcribe model: ${transcribeModel}`);
    this.openaiWs.send(JSON.stringify(config));
  }

  private flushMessageBuffer(): void {
    while (this.messageBuffer.length > 0) {
      const msg = this.messageBuffer.shift()!;
      if (this.openaiWs?.readyState === WebSocket.OPEN) {
        this.openaiWs.send(msg);
      }
    }
  }

  private sendAudioToLiveAvatar(base64Audio: string): void {
    if (!this.liveAvatarWs || this.liveAvatarWs.readyState !== WebSocket.OPEN) return;

    // Send audio chunk to LiveAvatar for lip-sync
    // Format: PCM 16-bit 24kHz (same as OpenAI Realtime output)
    const msg = {
      type: "agent.speak",
      event_id: this.getEventId(),
      audio: base64Audio
    };

    this.liveAvatarWs.send(JSON.stringify(msg));
  }

  private sendToClient(msg: any): void {
    if (!this.clientWs || this.clientWs.readyState !== WebSocket.OPEN) return;
    this.clientWs.send(JSON.stringify(msg));
  }

  handleClientMessage(data: string): void {
    try {
      const msg = JSON.parse(data);

      // Buffer messages until session is configured
      if (!this.sessionConfigured) {
        // Skip session.update from client - we handle it
        if (msg.type !== "session.update") {
          this.messageBuffer.push(data);
        }
        return;
      }

      // Skip session.update from client
      if (msg.type === "session.update") {
        return;
      }

      // Forward to OpenAI
      if (this.openaiWs?.readyState === WebSocket.OPEN) {
        this.openaiWs.send(data);
      }
    } catch (err) {
      console.error("[AudioRouter] Error handling client message:", err);
    }
  }

  disconnect(): void {
    if (this.openaiWs) {
      this.openaiWs.close();
      this.openaiWs = null;
    }
    if (this.liveAvatarWs) {
      this.liveAvatarWs.close();
      this.liveAvatarWs = null;
    }
    this.clientWs = null;
  }
}
