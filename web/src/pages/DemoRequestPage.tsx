import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

export default function DemoRequestPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("Олег");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => name.trim().length > 0 && !loading, [name, loading]);

  async function onCreate() {
    setErr(null);
    setLoading(true);
    try {
      const out = await postJson<{ token: string }>("/api/demo/request", {
        companyName: company.trim() || undefined,
        contactName: name.trim() || undefined
      });
      const q = new URLSearchParams({ name: name.trim() }).toString();
      navigate(`/demo/${out.token}?${q}`);
    } catch (e: any) {
      setErr(e?.message ?? "Помилка створення демо");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="hero">
        <div>
          <span className="pill">Live demo • AI Teacher</span>
          <h1>
            Аватар-викладач про тренди{" "}
            <span style={{ color: "var(--accent)" }}>AI у школах</span>
          </h1>
          <p>
            Ти відкриваєш лінк - “Марія” вітається, знайомиться, перевіряє рівень і веде короткий
            урок: інфраструктура, апскіл вчителів, AI-тьютори, безпека.
          </p>
          <div className="btnRow">
            <button className="primary" disabled={!canSubmit} onClick={onCreate}>
              {loading ? "Створюю..." : "Створити демо-лінк"}
            </button>
          </div>
          {err ? <p style={{ color: "var(--danger)" }}>{err}</p> : null}
        </div>
        <div className="card">
          <div className="field">
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Ім’я (для звертання)</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Олег" />
          </div>
          <div className="field">
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Компанія (опційно)</div>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Назва школи / холдингу"
            />
          </div>
          <p style={{ marginTop: 12, fontSize: 13 }}>
            Зараз тут - робочий прототип (TTS + мікрофон у браузері). Під LiveAvatar/LiveKit підв’яжемо
            наступним кроком.
          </p>
        </div>
      </div>
    </div>
  );
}

