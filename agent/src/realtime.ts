import WebSocket from "ws";
import type { Env } from "./env.js";

type RealtimeEvent =
  | { type: "session.created" }
  | { type: "session.updated" }
  | { type: "input_audio_buffer.speech_started" }
  | { type: "input_audio_buffer.speech_stopped" }
  | { type: "input_audio_buffer.committed" }
  | { type: "conversation.item.created"; item: any }
  | { type: "response.audio.delta"; delta: string }
  | { type: "response.audio.done" }
  | { type: "response.done" }
  | { type: "error"; error: any };

export class RealtimeSession {
  private ws: WebSocket | null = null;
  private env: Env;
  private systemPrompt: string;
  private livekitUrl: string = "";
  private livekitToken: string = "";

  constructor(env: Env, systemPrompt: string) {
    this.env = env;
    this.systemPrompt = systemPrompt;
  }

  async connect(livekitUrl: string, livekitToken: string): Promise<void> {
    this.livekitUrl = livekitUrl;
    this.livekitToken = livekitToken;

    // Connect to OpenAI Realtime API
    const realtimeUrl = `wss://api.openai.com/v1/realtime?model=${this.env.OPENAI_REALTIME_MODEL}`;
    this.ws = new WebSocket(realtimeUrl, {
      headers: {
        Authorization: `Bearer ${this.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1"
      }
    });

    await new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new Error("WebSocket not initialized"));

      this.ws.once("open", () => {
        console.log("Connected to OpenAI Realtime API");
        resolve();
      });

      this.ws.once("error", (err) => {
        console.error("OpenAI Realtime WebSocket error:", err);
        reject(err);
      });
    });

    // Configure session
    this.send({
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions: this.systemPrompt,
        voice: "alloy",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: "whisper-1"
        },
        turn_detection: {
          type: "server_vad",
          threshold: this.env.OPENAI_VAD_THRESHOLD,
          prefix_padding_ms: this.env.OPENAI_VAD_PREFIX_PADDING_MS,
          silence_duration_ms: this.env.OPENAI_VAD_SILENCE_DURATION_MS,
          create_response: this.env.OPENAI_VAD_CREATE_RESPONSE
        }
      }
    });

    console.log("LiveKit URL:", livekitUrl);
    console.log("Realtime session configured");

    this.setupRealtimeHandlers();
  }

  private setupRealtimeHandlers(): void {
    if (!this.ws) return;

    this.ws.on("message", (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString()) as RealtimeEvent;

        switch (event.type) {
          case "session.created":
            console.log("Realtime session created");
            break;

          case "session.updated":
            console.log("Realtime session updated");
            break;

          case "input_audio_buffer.speech_started":
            console.log("User started speaking");
            break;

          case "input_audio_buffer.speech_stopped":
            console.log("User stopped speaking");
            break;

          case "response.audio.delta":
            if (event.delta) {
              const audioData = Buffer.from(event.delta, "base64");
              console.log(`Received audio delta: ${audioData.length} bytes`);
              // Audio will be forwarded to LiveKit room by client
            }
            break;

          case "response.audio.done":
            console.log("Response audio complete");
            break;

          case "response.done":
            console.log("Response complete");
            break;

          case "error":
            console.error("Realtime API error:", event.error);
            break;

          default:
            break;
        }
      } catch (err) {
        console.error("Error parsing Realtime event:", err);
      }
    });

    this.ws.on("error", (err) => {
      console.error("Realtime WebSocket error:", err);
    });

    this.ws.on("close", () => {
      console.log("Realtime WebSocket closed");
    });
  }

  send(event: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("Cannot send: WebSocket not open");
      return;
    }
    this.ws.send(JSON.stringify(event));
  }

  sendAudio(audioData: Buffer): void {
    this.send({
      type: "input_audio_buffer.append",
      audio: audioData.toString("base64")
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  getWebSocket(): WebSocket | null {
    return this.ws;
  }
}
