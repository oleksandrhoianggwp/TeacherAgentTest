import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import UserWebcam from "./UserWebcam";

type RealtimeAvatarProps = {
  livekitUrl: string;
  livekitToken: string;
  liveAvatarSessionId: string;
  openingText: string;
  firstQuestion: string;
  onTranscript: (type: "user" | "assistant", text: string) => void;
};

export default function RealtimeAvatar(props: RealtimeAvatarProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [status, setStatus] = useState("Підключення...");
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const avatarVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const realtimeWsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Connect to LiveKit for avatar video
  useEffect(() => {
    if (!props.livekitUrl || !props.livekitToken) return;

    const r = new Room({ adaptiveStream: true, dynacast: true });
    setRoom(r);
    setStatus("Підключення до LiveKit...");

    r.connect(props.livekitUrl, props.livekitToken, { autoSubscribe: true })
      .then(() => {
        setConnected(true);
        setStatus("Підключено. Увімкни мікрофон.");

        r.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
          if (track.kind === Track.Kind.Video && avatarVideoRef.current) {
            track.attach(avatarVideoRef.current);
            setStatus("Аватар готовий");
          }
          if (track.kind === Track.Kind.Audio && audioRef.current) {
            track.attach(audioRef.current);
          }
        });
      })
      .catch((e) => setStatus(`Помилка: ${String(e?.message ?? e)}`));

    return () => {
      r.disconnect();
      setRoom(null);
    };
  }, [props.livekitUrl, props.livekitToken]);

  // Connect to OpenAI Realtime через backend proxy
  useEffect(() => {
    if (!connected || !props.liveAvatarSessionId) return;

    // Підключаємось до backend WebSocket proxy
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/realtime/${props.liveAvatarSessionId}`;

    const ws = new WebSocket(wsUrl);
    realtimeWsRef.current = ws;

    ws.onopen = () => {
      console.log("[Realtime] WebSocket connected to:", wsUrl);
      setRealtimeConnected(true);

      // Configure session
      ws.send(
        JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: `Ти Марія, віртуальна викладачка. ${props.openingText}`,
            voice: "shimmer",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: {
              model: "whisper-1"
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1200
            }
          }
        })
      );

      // Send initial greeting
      ws.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: props.firstQuestion }]
          }
        })
      );

      ws.send(JSON.stringify({ type: "response.create" }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[Realtime]", data.type, data);

        switch (data.type) {
          case "response.audio.delta":
            if (data.delta) {
              console.log("[Realtime] Audio delta received, length:", data.delta.length);
              playAudioChunk(data.delta);
            }
            break;

          case "conversation.item.input_audio_transcription.completed":
            if (data.transcript) {
              console.log("[Realtime] User transcript:", data.transcript);
              props.onTranscript("user", data.transcript);
            }
            break;

          case "response.audio_transcript.done":
            if (data.transcript) {
              console.log("[Realtime] Assistant transcript:", data.transcript);
              props.onTranscript("assistant", data.transcript);
            }
            break;

          case "input_audio_buffer.speech_started":
            console.log("[Realtime] Speech started");
            setStatus("Слухаю...");
            break;

          case "input_audio_buffer.speech_stopped":
            console.log("[Realtime] Speech stopped");
            setStatus("Обробляю...");
            break;

          case "response.done":
            console.log("[Realtime] Response done");
            setStatus("Готово. Твоя черга.");
            break;

          case "error":
            console.error("[Realtime] Error:", data.error);
            setStatus(`Помилка: ${data.error?.message || "unknown"}`);
            break;

          case "session.created":
          case "session.updated":
            console.log("[Realtime] Session:", data.type);
            break;

          default:
            console.log("[Realtime] Unhandled event:", data.type);
        }
      } catch (err) {
        console.error("[Realtime] Error parsing message:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("[Realtime] WebSocket error:", err);
      setStatus("Помилка підключення до Realtime");
      setRealtimeConnected(false);
    };

    ws.onclose = (event) => {
      console.log("[Realtime] WebSocket closed:", event.code, event.reason);
      setRealtimeConnected(false);
    };

    return () => {
      ws.close();
      realtimeWsRef.current = null;
    };
  }, [connected, props.liveAvatarSessionId, props.openingText, props.firstQuestion, props.onTranscript]);

  // Play audio chunk from Realtime
  function playAudioChunk(base64Audio: string) {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
        console.log("[Audio] AudioContext created");
      }

      const audioData = Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0));
      const audioBuffer = audioContextRef.current.createBuffer(1, audioData.length / 2, 24000);
      const channelData = audioBuffer.getChannelData(0);

      // Convert PCM16 to Float32
      for (let i = 0; i < audioData.length / 2; i++) {
        const int16 = (audioData[i * 2 + 1] << 8) | audioData[i * 2];
        channelData[i] = int16 / 32768.0;
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();
      console.log("[Audio] Playing chunk, duration:", audioBuffer.duration);
    } catch (err) {
      console.error("[Audio] Error playing chunk:", err);
    }
  }

  // Toggle microphone and start/stop audio streaming
  async function toggleMic() {
    if (!micEnabled) {
      // Start microphone
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 24000,
            echoCancellation: true,
            noiseSuppression: true
          }
        });

        mediaStreamRef.current = stream;
        setMicEnabled(true);
        setStatus("Мікрофон увімкнено. Говори.");

        // Setup audio processing
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext({ sampleRate: 24000 });
        }

        const source = audioContextRef.current.createMediaStreamSource(stream);
        const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
          if (!realtimeWsRef.current || realtimeWsRef.current.readyState !== WebSocket.OPEN) {
            return;
          }

          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(inputData.length);

          for (let i = 0; i < inputData.length; i++) {
            pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
          }

          const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));

          realtimeWsRef.current.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: base64
            })
          );
        };

        source.connect(processor);
        processor.connect(audioContextRef.current.destination);
      } catch (err: any) {
        setStatus(`Помилка мікрофона: ${err?.message || "unknown"}`);
        setMicEnabled(false);
      }
    } else {
      // Stop microphone
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      setMicEnabled(false);
      setStatus("Мікрофон вимкнено.");
    }
  }

  return (
    <div style={{ display: "flex", gap: "16px", marginTop: "16px" }}>
      {/* Avatar - Left (bigger) */}
      <div style={{ flex: "2", position: "relative", minHeight: "500px", background: "#000", borderRadius: "12px", overflow: "hidden" }}>
        <video
          ref={avatarVideoRef}
          autoPlay
          playsInline
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <audio ref={audioRef} autoPlay />
        {!connected && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "white"
            }}
          >
            <div className="pulse" />
          </div>
        )}
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            left: "12px",
            right: "12px",
            fontSize: "14px",
            color: "white",
            background: "rgba(0,0,0,0.5)",
            padding: "8px 12px",
            borderRadius: "8px"
          }}
        >
          {status}
          {realtimeConnected && <span style={{ marginLeft: "8px", color: "#4ade80" }}>● Realtime</span>}
        </div>
      </div>

      {/* User Webcam - Right (smaller) */}
      <div style={{ flex: "1", minHeight: "500px", background: "#000", borderRadius: "12px", overflow: "hidden", position: "relative" }}>
        <UserWebcam enabled={connected} />

        {/* Controls */}
        <div style={{ position: "absolute", bottom: "12px", left: "12px", right: "12px" }}>
          <button
            className={micEnabled ? "danger" : "primary"}
            onClick={toggleMic}
            disabled={!realtimeConnected}
            style={{ width: "100%" }}
          >
            {micEnabled ? "🎤 Вимкнути мікрофон" : "🎤 Увімкнути мікрофон"}
          </button>
        </div>
      </div>
    </div>
  );
}
