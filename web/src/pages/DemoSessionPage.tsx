import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import RealtimeAvatar from "../liveavatar/RealtimeAvatar";

type DemoTrainerDto = {
  token: string;
  title: string;
  trainingLanguage: string;
  avatarKey: string;
  openingText: string;
  criteria: Array<{ name: string; questions: string[] }>;
};

type ChatMsg = { role: "user" | "assistant"; content: string };

type LiveAvatarOptions = {
  voices: any;
  contexts: any;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

export default function DemoSessionPage() {
  const { token } = useParams();
  const [sp] = useSearchParams();
  const name = sp.get("name") || "Олег";

  const [trainer, setTrainer] = useState<DemoTrainerDto | null>(null);
  const [demoSessionId, setDemoSessionId] = useState<string | null>(null);
  const [liveAvatarSessionId, setLiveAvatarSessionId] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [openingText, setOpeningText] = useState<string>("");
  const [firstQuestion, setFirstQuestion] = useState<string>("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<LiveAvatarOptions | null>(null);
  const [voiceId, setVoiceId] = useState("");
  const [contextId, setContextId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const chatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!token) return;
    setError(null);
    getJson<DemoTrainerDto>(`/api/demo/${token}`)
      .then(setTrainer)
      .catch((e: any) => setError(e?.message ?? "Помилка завантаження демо"));
  }, [token]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function onStartLiveAvatar() {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const out = await postJson<{
        demoSessionId: string;
        liveAvatarSessionId: string;
        livekitUrl: string;
        livekitToken: string;
        openingText: string;
        firstQuestion: string;
      }>(
        `/api/demo/${token}/liveavatar/start`,
        { userName: name, voiceId: voiceId.trim() || undefined, contextId: contextId.trim() || undefined }
      );
      setDemoSessionId(out.demoSessionId);
      setLiveAvatarSessionId(out.liveAvatarSessionId);
      setLivekitUrl(out.livekitUrl);
      setLivekitToken(out.livekitToken);
      setOpeningText(out.openingText);
      setFirstQuestion(out.firstQuestion);
      setMessages([{ role: "assistant", content: `${out.openingText}\n\n${out.firstQuestion}`.trim() }]);
    } catch (e: any) {
      const msg = String(e?.message ?? "Не вдалося стартувати сесію");
      if (msg.includes("avatar_persona")) {
        setError(
          "LiveAvatar просить avatar_persona (voice_id + context_id). " +
            "Додай LIVEAVATAR_VOICE_ID та LIVEAVATAR_CONTEXT_ID у .env (або відкрий Advanced і встав їх тут)."
        );
      } else {
        setError(msg);
      }
      if (!options) {
        try {
          const out = await getJson<LiveAvatarOptions>("/api/demo/liveavatar/options");
          setOptions(out);
        } catch {
          // ignore
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function onSend(text?: string) {
    if (!token || !demoSessionId) return;
    const msg = (text ?? input).trim();
    if (!msg) return;

    setInput("");
    setError(null);
    setLoading(true);
    setMessages((m) => [...m, { role: "user", content: msg }]);

    try {
      const out = await postJson<{ assistantText: string; nextQuestion: string; done: boolean }>(
        `/api/demo/${token}/chat`,
        { sessionId: demoSessionId, message: msg }
      );

      const combined = `${out.assistantText}\n\n${out.nextQuestion}`.trim();
      setMessages((m) => [...m, { role: "assistant", content: combined }]);
    } catch (e: any) {
      setError(e?.message ?? "Помилка відповіді");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token || !demoSessionId) return;
    return () => {
      // Best-effort stop to avoid leaving paid sessions running.
      fetch(`/api/demo/${token}/liveavatar/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demoSessionId })
      }).catch(() => {});
    };
  }, [token, demoSessionId]);

  return (
    <div className="container">
      <div className="hero">
        <div>
          <span className="pill">
            Demo token: <span style={{ color: "var(--muted)" }}>{token}</span>
          </span>
          <h1 style={{ fontSize: 34, marginTop: 12 }}>{trainer?.title ?? "Завантажую..."}</h1>
          <p>
            Натисни “Старт LiveAvatar”, дозволь мікрофон. Після твоєї репліки прийде транскрипт, і
            Марія (через OpenAI) відповість та озвучить відповідь.
          </p>

          <div style={{ marginTop: 14 }}>
            {!livekitUrl || !livekitToken || !liveAvatarSessionId ? (
              <div className="card">
                <div className="btnRow" style={{ marginTop: 0 }}>
                  <button className="primary" onClick={onStartLiveAvatar} disabled={loading || !!demoSessionId}>
                    {demoSessionId ? "Сесія активна" : loading ? "Старт..." : "Старт LiveAvatar"}
                  </button>
                  <button className="danger" onClick={() => window.location.assign("/demo")} disabled={loading}>
                    Назад
                  </button>
                  <button onClick={() => setShowAdvanced((v) => !v)} disabled={loading}>
                    {showAdvanced ? "Hide advanced" : "Advanced"}
                  </button>
                </div>
                {showAdvanced ? (
                  <>
                    <div className="grid2" style={{ marginTop: 12 }}>
                      <div className="field">
                        <div style={{ color: "var(--muted)", fontSize: 13 }}>
                          LIVEAVATAR_VOICE_ID (optional override)
                        </div>
                        <input value={voiceId} onChange={(e) => setVoiceId(e.target.value)} placeholder="voice_id" />
                      </div>
                      <div className="field">
                        <div style={{ color: "var(--muted)", fontSize: 13 }}>
                          LIVEAVATAR_CONTEXT_ID (optional override)
                        </div>
                        <input
                          value={contextId}
                          onChange={(e) => setContextId(e.target.value)}
                          placeholder="context_id"
                        />
                      </div>
                    </div>
                    <p style={{ marginTop: 10, fontSize: 12 }}>
                      Зазвичай не потрібно: сервіс сам підбирає voice/context. Якщо LiveAvatar вимагає persona - візьми
                      IDs з dashboard або з `GET /api/demo/liveavatar/options`.
                    </p>
                    {options ? <p style={{ marginTop: 6, fontSize: 12 }}>Options loaded.</p> : null}
                  </>
                ) : null}
                {error ? <p style={{ color: "var(--danger)", marginTop: 10 }}>{error}</p> : null}
              </div>
            ) : (
              <RealtimeAvatar
                livekitUrl={livekitUrl}
                livekitToken={livekitToken}
                liveAvatarSessionId={liveAvatarSessionId}
                demoSessionId={demoSessionId!}
                openingText={openingText}
                firstQuestion={firstQuestion}
                onTranscript={(type, text) => {
                  setMessages((m) => [...m, { role: type === "user" ? "user" : "assistant", content: text }]);
                }}
              />
            )}

            <div className="card" style={{ marginTop: 16 }}>
              <div className="chat" ref={chatRef}>
                {messages.length === 0 ? (
                  <div className="msg assistant">
                    <div className="meta">Марія</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>Натисни “Старт LiveAvatar”, щоб почати урок.</div>
                  </div>
                ) : null}
                {messages.map((m, idx) => (
                  <div key={idx} className={`msg ${m.role}`}>
                    <div className="meta">{m.role === "user" ? "Ви" : "Марія"}</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                  </div>
                ))}
              </div>

              {showAdvanced ? (
                <>
                  <div className="field">
                    <div style={{ color: "var(--muted)", fontSize: 13 }}>Debug: текстом</div>
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Напиши відповідь тут..."
                      disabled={!demoSessionId || loading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onSend();
                      }}
                    />
                  </div>

                  <div className="btnRow" style={{ marginTop: 12 }}>
                    <button onClick={() => onSend()} disabled={!demoSessionId || loading || !input.trim()}>
                      {loading ? "Відповідаю..." : "Надіслати"}
                    </button>
                  </div>
                </>
              ) : null}
              {error ? <p style={{ color: "var(--danger)", marginTop: 10 }}>{error}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
