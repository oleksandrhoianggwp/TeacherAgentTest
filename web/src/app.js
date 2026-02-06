import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import DemoSessionPage from "./pages/DemoSessionPage";
export default function App() {
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        // Auto-create demo session on load
        fetch("/api/demo/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
        })
            .then((res) => res.json())
            .then((data) => {
            if (data.token) {
                setToken(data.token);
            }
            else {
                setError("Не вдалося створити сесію");
            }
        })
            .catch((e) => setError(e?.message ?? "Помилка"))
            .finally(() => setLoading(false));
    }, []);
    if (loading) {
        return (_jsxs("div", { style: {
                minHeight: "100vh",
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            }, children: [_jsxs("div", { style: { textAlign: "center" }, children: [_jsx("div", { style: {
                                width: "60px",
                                height: "60px",
                                border: "3px solid rgba(255,255,255,0.3)",
                                borderTopColor: "#3b82f6",
                                borderRadius: "50%",
                                animation: "spin 1s linear infinite",
                                margin: "0 auto"
                            } }), _jsx("p", { style: { color: "#94a3b8", marginTop: "16px" }, children: "\u0417\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043D\u044F..." })] }), _jsx("style", { children: `
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        ` })] }));
    }
    if (error) {
        return (_jsx("div", { style: {
                minHeight: "100vh",
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            }, children: _jsxs("div", { style: {
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "12px",
                    padding: "24px 32px",
                    textAlign: "center"
                }, children: [_jsx("p", { style: { color: "#f87171", margin: 0 }, children: error }), _jsx("button", { onClick: () => window.location.reload(), style: {
                            marginTop: "16px",
                            background: "#3b82f6",
                            color: "#fff",
                            border: "none",
                            padding: "10px 24px",
                            borderRadius: "8px",
                            cursor: "pointer"
                        }, children: "\u0421\u043F\u0440\u043E\u0431\u0443\u0432\u0430\u0442\u0438 \u0437\u043D\u043E\u0432\u0443" })] }) }));
    }
    return _jsx(DemoSessionPage, { token: token });
}
