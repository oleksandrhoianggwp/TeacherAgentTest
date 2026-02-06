import { useEffect, useRef, useState } from "react";
import RealtimeAvatar from "../liveavatar/RealtimeAvatar";

type DemoTrainerDto = {
  token: string;
  title: string;
  trainingLanguage: string;
  avatarKey: string;
  openingText: string;
  criteria: Array<{ name: string; questions: string[] }>;
};

type DemoSessionPageProps = {
  token: string;
};

type ChatMsg = { role: "user" | "assistant"; content: string };

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

export default function DemoSessionPage({ token }: DemoSessionPageProps) {
  const name = "Учень";

  const [trainer, setTrainer] = useState<DemoTrainerDto | null>(null);
  const [demoSessionId, setDemoSessionId] = useState<string | null>(null);
  const [liveAvatarSessionId, setLiveAvatarSessionId] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [openingText, setOpeningText] = useState<string>("");
  const [firstQuestion, setFirstQuestion] = useState<string>("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);

  const chatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!token) return;
    setError(null);
    getJson<DemoTrainerDto>(`/api/demo/${token}`)
      .then(setTrainer)
      .catch((e: any) => setError(e?.message ?? "Помилка завантаження"));
  }, [token]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function onStart() {
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
        { userName: name }
      );
      setDemoSessionId(out.demoSessionId);
      setLiveAvatarSessionId(out.liveAvatarSessionId);
      setLivekitUrl(out.livekitUrl);
      setLivekitToken(out.livekitToken);
      setOpeningText(out.openingText);
      setFirstQuestion(out.firstQuestion);
      setMessages([]);
      setSessionActive(true);
    } catch (e: any) {
      setError(String(e?.message ?? "Не вдалося стартувати сесію"));
    } finally {
      setLoading(false);
    }
  }

  async function onEnd() {
    if (!token || !demoSessionId) return;
    try {
      await fetch(`/api/demo/${token}/liveavatar/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demoSessionId })
      });
    } catch {
      // ignore
    }
    setSessionActive(false);
    setDemoSessionId(null);
    setLiveAvatarSessionId(null);
    setLivekitUrl(null);
    setLivekitToken(null);
  }

  useEffect(() => {
    if (!token || !demoSessionId) return;
    return () => {
      fetch(`/api/demo/${token}/liveavatar/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demoSessionId })
      }).catch(() => {});
    };
  }, [token, demoSessionId]);

  const isActive = sessionActive && livekitUrl && livekitToken && liveAvatarSessionId;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
      padding: "20px"
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "600", color: "#fff", margin: "0 0 4px 0" }}>
          {trainer?.title ?? "Віртуальний викладач"}
        </h1>
        <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0 }}>
          Інтерактивний урок з AI-асистентом
        </p>
      </div>

      {/* Main Content */}
      {!isActive ? (
        /* Start Screen */
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "70vh"
        }}>
          <div style={{
            background: "rgba(255,255,255,0.05)",
            borderRadius: "20px",
            padding: "40px 50px",
            textAlign: "center",
            border: "1px solid rgba(255,255,255,0.1)"
          }}>
            <h2 style={{ fontSize: "22px", color: "#fff", marginBottom: "12px" }}>
              Готові розпочати урок?
            </h2>
            <p style={{ fontSize: "15px", color: "#94a3b8", marginBottom: "28px", maxWidth: "350px" }}>
              Ваш віртуальний викладач допоможе вам зрозуміти можливості штучного інтелекту в освіті
            </p>

            <button
              onClick={onStart}
              disabled={loading}
              style={{
                background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                color: "#fff",
                fontSize: "16px",
                fontWeight: "600",
                padding: "14px 40px",
                borderRadius: "10px",
                border: "none",
                cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? "Підключення..." : "Розпочати урок"}
            </button>

            {error && (
              <p style={{ color: "#f87171", marginTop: "14px", fontSize: "13px" }}>{error}</p>
            )}
          </div>
        </div>
      ) : (
        /* Active Session */
        <div>
          <RealtimeAvatar
            livekitUrl={livekitUrl!}
            livekitToken={livekitToken!}
            liveAvatarSessionId={liveAvatarSessionId!}
            demoSessionId={demoSessionId!}
            openingText={openingText}
            firstQuestion={firstQuestion}
            onTranscript={(type, text) => {
              setMessages((m) => [...m, { role: type === "user" ? "user" : "assistant", content: text }]);
            }}
            onSessionEnd={onEnd}
          />

          {/* Transcript */}
          <div style={{
            maxWidth: "1600px",
            margin: "20px auto 0",
            padding: "0 20px"
          }}>
            <div
              ref={chatRef}
              style={{
                background: "rgba(255,255,255,0.03)",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "16px",
                maxHeight: "200px",
                overflowY: "auto"
              }}
            >
              {messages.length === 0 ? (
                <p style={{ color: "#64748b", fontSize: "14px", margin: 0, textAlign: "center" }}>
                  Транскрипт розмови з'явиться тут...
                </p>
              ) : (
                messages.map((m, idx) => (
                  <div key={idx} style={{ marginBottom: "10px" }}>
                    <span style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: m.role === "user" ? "#3b82f6" : "#22c55e"
                    }}>
                      {m.role === "user" ? "Ви" : "Викладач"}:
                    </span>
                    <span style={{ fontSize: "14px", color: "#e2e8f0", marginLeft: "8px" }}>
                      {m.content}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* End Button */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
            <button
              onClick={onEnd}
              style={{
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                color: "#fff",
                fontSize: "15px",
                fontWeight: "600",
                padding: "12px 32px",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer"
              }}
            >
              Завершити урок
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
