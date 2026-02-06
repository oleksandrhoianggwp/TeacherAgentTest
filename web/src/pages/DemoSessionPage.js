import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
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
export default function DemoSessionPage({ token }) {
    const name = "Учень";
    const [trainer, setTrainer] = useState(null);
    const [demoSessionId, setDemoSessionId] = useState(null);
    const [liveAvatarSessionId, setLiveAvatarSessionId] = useState(null);
    const [livekitUrl, setLivekitUrl] = useState(null);
    const [livekitToken, setLivekitToken] = useState(null);
    const [openingText, setOpeningText] = useState("");
    const [firstQuestion, setFirstQuestion] = useState("");
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [sessionActive, setSessionActive] = useState(false);
    const chatRef = useRef(null);
    useEffect(() => {
        if (!token)
            return;
        setError(null);
        getJson(`/api/demo/${token}`)
            .then(setTrainer)
            .catch((e) => setError(e?.message ?? "Помилка завантаження"));
    }, [token]);
    useEffect(() => {
        chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
    }, [messages.length]);
    async function onStart() {
        if (!token)
            return;
        setError(null);
        setLoading(true);
        try {
            const out = await postJson(`/api/demo/${token}/liveavatar/start`, { userName: name });
            setDemoSessionId(out.demoSessionId);
            setLiveAvatarSessionId(out.liveAvatarSessionId);
            setLivekitUrl(out.livekitUrl);
            setLivekitToken(out.livekitToken);
            setOpeningText(out.openingText);
            setFirstQuestion(out.firstQuestion);
            setMessages([]);
            setSessionActive(true);
        }
        catch (e) {
            setError(String(e?.message ?? "Не вдалося стартувати сесію"));
        }
        finally {
            setLoading(false);
        }
    }
    async function onEnd() {
        if (!token || !demoSessionId)
            return;
        try {
            await fetch(`/api/demo/${token}/liveavatar/stop`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ demoSessionId })
            });
        }
        catch {
            // ignore
        }
        setSessionActive(false);
        setDemoSessionId(null);
        setLiveAvatarSessionId(null);
        setLivekitUrl(null);
        setLivekitToken(null);
    }
    useEffect(() => {
        if (!token || !demoSessionId)
            return;
        return () => {
            fetch(`/api/demo/${token}/liveavatar/stop`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ demoSessionId })
            }).catch(() => { });
        };
    }, [token, demoSessionId]);
    const isActive = sessionActive && livekitUrl && livekitToken && liveAvatarSessionId;
    return (_jsxs("div", { style: {
            minHeight: "100vh",
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
            padding: "20px"
        }, children: [_jsxs("div", { style: { textAlign: "center", marginBottom: "20px" }, children: [_jsx("h1", { style: { fontSize: "24px", fontWeight: "600", color: "#fff", margin: "0 0 4px 0" }, children: trainer?.title ?? "Віртуальний викладач" }), _jsx("p", { style: { fontSize: "14px", color: "#94a3b8", margin: 0 }, children: "\u0406\u043D\u0442\u0435\u0440\u0430\u043A\u0442\u0438\u0432\u043D\u0438\u0439 \u0443\u0440\u043E\u043A \u0437 AI-\u0430\u0441\u0438\u0441\u0442\u0435\u043D\u0442\u043E\u043C" })] }), !isActive ? (
            /* Start Screen */
            _jsx("div", { style: {
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "70vh"
                }, children: _jsxs("div", { style: {
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: "20px",
                        padding: "40px 50px",
                        textAlign: "center",
                        border: "1px solid rgba(255,255,255,0.1)"
                    }, children: [_jsx("h2", { style: { fontSize: "22px", color: "#fff", marginBottom: "12px" }, children: "\u0413\u043E\u0442\u043E\u0432\u0456 \u0440\u043E\u0437\u043F\u043E\u0447\u0430\u0442\u0438 \u0443\u0440\u043E\u043A?" }), _jsx("p", { style: { fontSize: "15px", color: "#94a3b8", marginBottom: "28px", maxWidth: "350px" }, children: "\u0412\u0430\u0448 \u0432\u0456\u0440\u0442\u0443\u0430\u043B\u044C\u043D\u0438\u0439 \u0432\u0438\u043A\u043B\u0430\u0434\u0430\u0447 \u0434\u043E\u043F\u043E\u043C\u043E\u0436\u0435 \u0432\u0430\u043C \u0437\u0440\u043E\u0437\u0443\u043C\u0456\u0442\u0438 \u043C\u043E\u0436\u043B\u0438\u0432\u043E\u0441\u0442\u0456 \u0448\u0442\u0443\u0447\u043D\u043E\u0433\u043E \u0456\u043D\u0442\u0435\u043B\u0435\u043A\u0442\u0443 \u0432 \u043E\u0441\u0432\u0456\u0442\u0456" }), _jsx("button", { onClick: onStart, disabled: loading, style: {
                                background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                                color: "#fff",
                                fontSize: "16px",
                                fontWeight: "600",
                                padding: "14px 40px",
                                borderRadius: "10px",
                                border: "none",
                                cursor: loading ? "wait" : "pointer",
                                opacity: loading ? 0.7 : 1
                            }, children: loading ? "Підключення..." : "Розпочати урок" }), error && (_jsx("p", { style: { color: "#f87171", marginTop: "14px", fontSize: "13px" }, children: error }))] }) })) : (
            /* Active Session */
            _jsxs("div", { children: [_jsx(RealtimeAvatar, { livekitUrl: livekitUrl, livekitToken: livekitToken, liveAvatarSessionId: liveAvatarSessionId, demoSessionId: demoSessionId, openingText: openingText, firstQuestion: firstQuestion, onTranscript: (type, text) => {
                            setMessages((m) => [...m, { role: type === "user" ? "user" : "assistant", content: text }]);
                        } }), _jsx("div", { style: {
                            maxWidth: "1600px",
                            margin: "20px auto 0",
                            padding: "0 20px"
                        }, children: _jsx("div", { ref: chatRef, style: {
                                background: "rgba(255,255,255,0.03)",
                                borderRadius: "12px",
                                border: "1px solid rgba(255,255,255,0.08)",
                                padding: "16px",
                                maxHeight: "200px",
                                overflowY: "auto"
                            }, children: messages.length === 0 ? (_jsx("p", { style: { color: "#64748b", fontSize: "14px", margin: 0, textAlign: "center" }, children: "\u0422\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442 \u0440\u043E\u0437\u043C\u043E\u0432\u0438 \u0437'\u044F\u0432\u0438\u0442\u044C\u0441\u044F \u0442\u0443\u0442..." })) : (messages.map((m, idx) => (_jsxs("div", { style: { marginBottom: "10px" }, children: [_jsxs("span", { style: {
                                            fontSize: "12px",
                                            fontWeight: "600",
                                            color: m.role === "user" ? "#3b82f6" : "#22c55e"
                                        }, children: [m.role === "user" ? "Ви" : "Викладач", ":"] }), _jsx("span", { style: { fontSize: "14px", color: "#e2e8f0", marginLeft: "8px" }, children: m.content })] }, idx)))) }) }), _jsx("div", { style: { display: "flex", justifyContent: "center", marginTop: "20px" }, children: _jsx("button", { onClick: onEnd, style: {
                                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                                color: "#fff",
                                fontSize: "15px",
                                fontWeight: "600",
                                padding: "12px 32px",
                                borderRadius: "10px",
                                border: "none",
                                cursor: "pointer"
                            }, children: "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0438 \u0443\u0440\u043E\u043A" }) })] }))] }));
}
