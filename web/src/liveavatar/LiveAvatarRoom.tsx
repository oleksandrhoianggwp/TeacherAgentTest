import { useEffect, useMemo, useRef, useState } from "react";
import {
  DataPacket_Kind,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication
} from "livekit-client";

type LiveAvatarRoomProps = {
  livekitUrl: string;
  livekitToken: string;
  liveAvatarSessionId: string;
  openingText: string;
  firstQuestion: string;
  onUserText: (text: string) => Promise<string | null> | string | null;
  disabled?: boolean;
};

type AgentEvent =
  | { event_type: "user.transcription"; text: string; user_id?: string }
  | { event_type: "avatar.speak_started" | "avatar.speak_ended" }
  | { event_type: string; [k: string]: unknown };

function encodeUtf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function safeJsonParse(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function LiveAvatarRoom(props: LiveAvatarRoomProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [status, setStatus] = useState<string>("Підключення…");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const busyRef = useRef(false);
  const lastTranscriptAtRef = useRef<number>(0);

  const canConnect = useMemo(
    () => Boolean(props.livekitUrl && props.livekitToken && props.liveAvatarSessionId),
    [props.livekitUrl, props.livekitToken, props.liveAvatarSessionId]
  );

  useEffect(() => {
    if (!canConnect || props.disabled) return;

    const r = new Room({ adaptiveStream: true, dynacast: true });
    setRoom(r);
    setStatus("Підключення до LiveKit…");

    const onConnected = () => {
      setConnected(true);
      setStatus("Підключено. Увімкни мікрофон і говори.");
    };
    const onDisconnected = () => {
      setConnected(false);
      setMicEnabled(false);
      setStatus("Відключено");
    };

    const attachRemote = (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (publication.kind === Track.Kind.Video && videoRef.current) {
        track.attach(videoRef.current);
        setStatus(`Аватар підключився (${participant.identity}).`);
      }
      if (publication.kind === Track.Kind.Audio && audioRef.current) {
        track.attach(audioRef.current);
      }
    };

    const onData = async (
      payload: Uint8Array,
      _p: RemoteParticipant | undefined,
      _kind: DataPacket_Kind,
      topic?: string
    ) => {
      if (topic !== "agent-response") return;
      const txt = decodeUtf8(payload);
      const json = safeJsonParse(txt) as AgentEvent | null;
      if (!json || typeof (json as any).event_type !== "string") return;

      if (json.event_type === "user.transcription" && typeof json.text === "string" && json.text.trim()) {
        const now = Date.now();
        if (now - lastTranscriptAtRef.current < 500) return;
        lastTranscriptAtRef.current = now;
        if (busyRef.current) return;
        busyRef.current = true;
        try {
          const replyText = await props.onUserText(json.text.trim());
          if (replyText) {
            await publishSpeak(r, props.liveAvatarSessionId, replyText);
          }
        } finally {
          busyRef.current = false;
        }
      }
    };

    r
      .connect(props.livekitUrl, props.livekitToken, { autoSubscribe: true })
      .then(async () => {
        r.on(RoomEvent.Connected, onConnected);
        r.on(RoomEvent.Disconnected, onDisconnected);
        r.on(RoomEvent.TrackSubscribed, attachRemote);
        r.on(RoomEvent.DataReceived, onData as any);

        // Speak the opening immediately via avatar command.
        await publishSpeak(r, props.liveAvatarSessionId, `${props.openingText}\n\n${props.firstQuestion}`);
        setStatus("Готово. Тепер твоя черга відповісти.");
      })
      .catch((e) => setStatus(`Помилка підключення: ${String(e?.message ?? e)}`));

    return () => {
      try {
        r.disconnect();
      } catch {
        // ignore
      }
      setRoom(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canConnect, props.disabled, props.livekitUrl, props.livekitToken, props.liveAvatarSessionId]);

  async function toggleMic() {
    if (!room) return;
    const next = !micEnabled;
    setMicEnabled(next);
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
    } catch (e: any) {
      setStatus(`Не вдалося увімкнути мікрофон: ${String(e?.message ?? e)}`);
      setMicEnabled(false);
    }
  }

  return (
    <div className="grid2">
      <div className="avatar">
        <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <audio ref={audioRef} autoPlay />
        {!connected ? <div className="pulse" /> : null}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            right: 12,
            fontSize: 12,
            color: "var(--muted)"
          }}
        >
          {status}
        </div>
      </div>

      <div className="card">
        <div className="btnRow" style={{ marginTop: 0 }}>
          <button className="primary" onClick={toggleMic} disabled={!room}>
            {micEnabled ? "Вимкнути мікрофон" : "Увімкнути мікрофон"}
          </button>
        </div>
        <p style={{ marginTop: 10, fontSize: 13 }}>
          Порада: говори коротко. Після того як ти замовкнеш, система отримає транскрипт і Марія відповість.
        </p>
      </div>
    </div>
  );
}

export async function publishSpeak(room: Room, liveAvatarSessionId: string, text: string) {
  const payload = {
    event_type: "avatar.speak_text",
    text,
    session_id: liveAvatarSessionId
  };
  await room.localParticipant.publishData(encodeUtf8(JSON.stringify(payload)), {
    reliable: true,
    topic: "agent-control"
  });
}
