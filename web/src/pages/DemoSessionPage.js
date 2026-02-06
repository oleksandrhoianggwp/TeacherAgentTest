import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import RealtimeAvatar from "../liveavatar/RealtimeAvatar";
async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(await res.text());
    return (await res.json());
}
async function postJson(url, body) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    if (!res.ok)
        throw new Error(await res.text());
    return (await res.json());
}
export default function DemoSessionPage() {
    const { token } = useParams();
    const [sp] = useSearchParams();
    const name = sp.get("name") || "Олег";
    const [trainer, setTrainer] = useState(null);
    const [demoSessionId, setDemoSessionId] = useState(null);
    const [liveAvatarSessionId, setLiveAvatarSessionId] = useState(null);
    const [livekitUrl, setLivekitUrl] = useState(null);
    const [livekitToken, setLivekitToken] = useState(null);
    const [openingText, setOpeningText] = useState("");
    const [firstQuestion, setFirstQuestion] = useState("");
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [options, setOptions] = useState(null);
    const [voiceId, setVoiceId] = useState("");
    const [contextId, setContextId] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const chatRef = useRef(null);
    useEffect(() => {
        if (!token)
            return;
        setError(null);
        getJson(`/api/demo/${token}`)
            .then(setTrainer)
            .catch((e) => setError(e?.message ?? "Помилка завантаження демо"));
    }, [token]);
    useEffect(() => {
        chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
    }, [messages.length]);
    async function onStartLiveAvatar() {
        if (!token)
            return;
        setError(null);
        setLoading(true);
        try {
            const out = await postJson(`/api/demo/${token}/liveavatar/start`, { userName: name, voiceId: voiceId.trim() || undefined, contextId: contextId.trim() || undefined });
            setDemoSessionId(out.demoSessionId);
            setLiveAvatarSessionId(out.liveAvatarSessionId);
            setLivekitUrl(out.livekitUrl);
            setLivekitToken(out.livekitToken);
            setOpeningText(out.openingText);
            setFirstQuestion(out.firstQuestion);
            setMessages([{ role: "assistant", content: `${out.openingText}\n\n${out.firstQuestion}`.trim() }]);
        }
        catch (e) {
            const msg = String(e?.message ?? "Не вдалося стартувати сесію");
            if (msg.includes("avatar_persona")) {
                setError("LiveAvatar просить avatar_persona (voice_id + context_id). " +
                    "Додай LIVEAVATAR_VOICE_ID та LIVEAVATAR_CONTEXT_ID у .env (або відкрий Advanced і встав їх тут).");
            }
            else {
                setError(msg);
            }
            if (!options) {
                try {
                    const out = await getJson("/api/demo/liveavatar/options");
                    setOptions(out);
                }
                catch {
                    // ignore
                }
            }
        }
        finally {
            setLoading(false);
        }
    }
    async function onSend(text) {
        if (!token || !demoSessionId)
            return;
        const msg = (text ?? input).trim();
        if (!msg)
            return;
        setInput("");
        setError(null);
        setLoading(true);
        setMessages((m) => [...m, { role: "user", content: msg }]);
        try {
            const out = await postJson(`/api/demo/${token}/chat`, { sessionId: demoSessionId, message: msg });
            const combined = `${out.assistantText}\n\n${out.nextQuestion}`.trim();
            setMessages((m) => [...m, { role: "assistant", content: combined }]);
        }
        catch (e) {
            setError(e?.message ?? "Помилка відповіді");
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        if (!token || !demoSessionId)
            return;
        return () => {
            // Best-effort stop to avoid leaving paid sessions running.
            fetch(`/api/demo/${token}/liveavatar/stop`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ demoSessionId })
            }).catch(() => { });
        };
    }, [token, demoSessionId]);
    return (_jsx("div", { className: "container", children: _jsx("div", { className: "hero", children: _jsxs("div", { children: [_jsxs("span", { className: "pill", children: ["Demo token: ", _jsx("span", { style: { color: "var(--muted)" }, children: token })] }), _jsx("h1", { style: { fontSize: 34, marginTop: 12 }, children: trainer?.title ?? "Завантажую..." }), _jsx("p", { children: "\u041D\u0430\u0442\u0438\u0441\u043D\u0438 \u201C\u0421\u0442\u0430\u0440\u0442 LiveAvatar\u201D, \u0434\u043E\u0437\u0432\u043E\u043B\u044C \u043C\u0456\u043A\u0440\u043E\u0444\u043E\u043D. \u041F\u0456\u0441\u043B\u044F \u0442\u0432\u043E\u0454\u0457 \u0440\u0435\u043F\u043B\u0456\u043A\u0438 \u043F\u0440\u0438\u0439\u0434\u0435 \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442, \u0456 \u041C\u0430\u0440\u0456\u044F (\u0447\u0435\u0440\u0435\u0437 OpenAI) \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0441\u0442\u044C \u0442\u0430 \u043E\u0437\u0432\u0443\u0447\u0438\u0442\u044C \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C." }), _jsxs("div", { style: { marginTop: 14 }, children: [!livekitUrl || !livekitToken || !liveAvatarSessionId ? (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "btnRow", style: { marginTop: 0 }, children: [_jsx("button", { className: "primary", onClick: onStartLiveAvatar, disabled: loading || !!demoSessionId, children: demoSessionId ? "Сесія активна" : loading ? "Старт..." : "Старт LiveAvatar" }), _jsx("button", { className: "danger", onClick: () => window.location.assign("/demo"), disabled: loading, children: "\u041D\u0430\u0437\u0430\u0434" }), _jsx("button", { onClick: () => setShowAdvanced((v) => !v), disabled: loading, children: showAdvanced ? "Hide advanced" : "Advanced" })] }), showAdvanced ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid2", style: { marginTop: 12 }, children: [_jsxs("div", { className: "field", children: [_jsx("div", { style: { color: "var(--muted)", fontSize: 13 }, children: "LIVEAVATAR_VOICE_ID (optional override)" }), _jsx("input", { value: voiceId, onChange: (e) => setVoiceId(e.target.value), placeholder: "voice_id" })] }), _jsxs("div", { className: "field", children: [_jsx("div", { style: { color: "var(--muted)", fontSize: 13 }, children: "LIVEAVATAR_CONTEXT_ID (optional override)" }), _jsx("input", { value: contextId, onChange: (e) => setContextId(e.target.value), placeholder: "context_id" })] })] }), _jsx("p", { style: { marginTop: 10, fontSize: 12 }, children: "\u0417\u0430\u0437\u0432\u0438\u0447\u0430\u0439 \u043D\u0435 \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u043E: \u0441\u0435\u0440\u0432\u0456\u0441 \u0441\u0430\u043C \u043F\u0456\u0434\u0431\u0438\u0440\u0430\u0454 voice/context. \u042F\u043A\u0449\u043E LiveAvatar \u0432\u0438\u043C\u0430\u0433\u0430\u0454 persona - \u0432\u0456\u0437\u044C\u043C\u0438 IDs \u0437 dashboard \u0430\u0431\u043E \u0437 `GET /api/demo/liveavatar/options`." }), options ? _jsx("p", { style: { marginTop: 6, fontSize: 12 }, children: "Options loaded." }) : null] })) : null, error ? _jsx("p", { style: { color: "var(--danger)", marginTop: 10 }, children: error }) : null] })) : (_jsx(RealtimeAvatar, { livekitUrl: livekitUrl, livekitToken: livekitToken, liveAvatarSessionId: liveAvatarSessionId, demoSessionId: demoSessionId, openingText: openingText, firstQuestion: firstQuestion, onTranscript: (type, text) => {
                                    setMessages((m) => [...m, { role: type === "user" ? "user" : "assistant", content: text }]);
                                } })), _jsxs("div", { className: "card", style: { marginTop: 16 }, children: [_jsxs("div", { className: "chat", ref: chatRef, children: [messages.length === 0 ? (_jsxs("div", { className: "msg assistant", children: [_jsx("div", { className: "meta", children: "\u041C\u0430\u0440\u0456\u044F" }), _jsx("div", { style: { whiteSpace: "pre-wrap" }, children: "\u041D\u0430\u0442\u0438\u0441\u043D\u0438 \u201C\u0421\u0442\u0430\u0440\u0442 LiveAvatar\u201D, \u0449\u043E\u0431 \u043F\u043E\u0447\u0430\u0442\u0438 \u0443\u0440\u043E\u043A." })] })) : null, messages.map((m, idx) => (_jsxs("div", { className: `msg ${m.role}`, children: [_jsx("div", { className: "meta", children: m.role === "user" ? "Ви" : "Марія" }), _jsx("div", { style: { whiteSpace: "pre-wrap" }, children: m.content })] }, idx)))] }), showAdvanced ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "field", children: [_jsx("div", { style: { color: "var(--muted)", fontSize: 13 }, children: "Debug: \u0442\u0435\u043A\u0441\u0442\u043E\u043C" }), _jsx("input", { value: input, onChange: (e) => setInput(e.target.value), placeholder: "\u041D\u0430\u043F\u0438\u0448\u0438 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C \u0442\u0443\u0442...", disabled: !demoSessionId || loading, onKeyDown: (e) => {
                                                            if (e.key === "Enter")
                                                                onSend();
                                                        } })] }), _jsx("div", { className: "btnRow", style: { marginTop: 12 }, children: _jsx("button", { onClick: () => onSend(), disabled: !demoSessionId || loading || !input.trim(), children: loading ? "Відповідаю..." : "Надіслати" }) })] })) : null, error ? _jsx("p", { style: { color: "var(--danger)", marginTop: 10 }, children: error }) : null] })] })] }) }) }));
}
