import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
export default function DemoRequestPage() {
    const navigate = useNavigate();
    const [name, setName] = useState("Олег");
    const [company, setCompany] = useState("");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState(null);
    const canSubmit = useMemo(() => name.trim().length > 0 && !loading, [name, loading]);
    async function onCreate() {
        setErr(null);
        setLoading(true);
        try {
            const out = await postJson("/api/demo/request", {
                companyName: company.trim() || undefined,
                contactName: name.trim() || undefined
            });
            const q = new URLSearchParams({ name: name.trim() }).toString();
            navigate(`/demo/${out.token}?${q}`);
        }
        catch (e) {
            setErr(e?.message ?? "Помилка створення демо");
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { className: "container", children: _jsxs("div", { className: "hero", children: [_jsxs("div", { children: [_jsx("span", { className: "pill", children: "Live demo \u2022 AI Teacher" }), _jsxs("h1", { children: ["\u0410\u0432\u0430\u0442\u0430\u0440-\u0432\u0438\u043A\u043B\u0430\u0434\u0430\u0447 \u043F\u0440\u043E \u0442\u0440\u0435\u043D\u0434\u0438", " ", _jsx("span", { style: { color: "var(--accent)" }, children: "AI \u0443 \u0448\u043A\u043E\u043B\u0430\u0445" })] }), _jsx("p", { children: "\u0422\u0438 \u0432\u0456\u0434\u043A\u0440\u0438\u0432\u0430\u0454\u0448 \u043B\u0456\u043D\u043A - \u201C\u041C\u0430\u0440\u0456\u044F\u201D \u0432\u0456\u0442\u0430\u0454\u0442\u044C\u0441\u044F, \u0437\u043D\u0430\u0439\u043E\u043C\u0438\u0442\u044C\u0441\u044F, \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u0454 \u0440\u0456\u0432\u0435\u043D\u044C \u0456 \u0432\u0435\u0434\u0435 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0443\u0440\u043E\u043A: \u0456\u043D\u0444\u0440\u0430\u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430, \u0430\u043F\u0441\u043A\u0456\u043B \u0432\u0447\u0438\u0442\u0435\u043B\u0456\u0432, AI-\u0442\u044C\u044E\u0442\u043E\u0440\u0438, \u0431\u0435\u0437\u043F\u0435\u043A\u0430." }), _jsx("div", { className: "btnRow", children: _jsx("button", { className: "primary", disabled: !canSubmit, onClick: onCreate, children: loading ? "Створюю..." : "Створити демо-лінк" }) }), err ? _jsx("p", { style: { color: "var(--danger)" }, children: err }) : null] }), _jsxs("div", { className: "card", children: [_jsxs("div", { className: "field", children: [_jsx("div", { style: { color: "var(--muted)", fontSize: 13 }, children: "\u0406\u043C\u2019\u044F (\u0434\u043B\u044F \u0437\u0432\u0435\u0440\u0442\u0430\u043D\u043D\u044F)" }), _jsx("input", { value: name, onChange: (e) => setName(e.target.value), placeholder: "\u041E\u043B\u0435\u0433" })] }), _jsxs("div", { className: "field", children: [_jsx("div", { style: { color: "var(--muted)", fontSize: 13 }, children: "\u041A\u043E\u043C\u043F\u0430\u043D\u0456\u044F (\u043E\u043F\u0446\u0456\u0439\u043D\u043E)" }), _jsx("input", { value: company, onChange: (e) => setCompany(e.target.value), placeholder: "\u041D\u0430\u0437\u0432\u0430 \u0448\u043A\u043E\u043B\u0438 / \u0445\u043E\u043B\u0434\u0438\u043D\u0433\u0443" })] }), _jsx("p", { style: { marginTop: 12, fontSize: 13 }, children: "\u0417\u0430\u0440\u0430\u0437 \u0442\u0443\u0442 - \u0440\u043E\u0431\u043E\u0447\u0438\u0439 \u043F\u0440\u043E\u0442\u043E\u0442\u0438\u043F (TTS + \u043C\u0456\u043A\u0440\u043E\u0444\u043E\u043D \u0443 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0456). \u041F\u0456\u0434 LiveAvatar/LiveKit \u043F\u0456\u0434\u0432\u2019\u044F\u0436\u0435\u043C\u043E \u043D\u0430\u0441\u0442\u0443\u043F\u043D\u0438\u043C \u043A\u0440\u043E\u043A\u043E\u043C." })] })] }) }));
}
