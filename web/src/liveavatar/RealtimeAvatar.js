import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import UserWebcam from "./UserWebcam";
export default function RealtimeAvatar(props) {
    const [room, setRoom] = useState(null);
    const [connected, setConnected] = useState(false);
    const [micEnabled, setMicEnabled] = useState(false);
    const [status, setStatus] = useState("Підключення...");
    const [realtimeConnected, setRealtimeConnected] = useState(false);
    const avatarVideoRef = useRef(null);
    const audioRef = useRef(null);
    const realtimeWsRef = useRef(null);
    const audioContextRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const onTranscriptRef = useRef(props.onTranscript);
    const firstQuestionRef = useRef(props.firstQuestion);
    onTranscriptRef.current = props.onTranscript;
    firstQuestionRef.current = props.firstQuestion;
    // Connect to LiveKit for avatar video
    useEffect(() => {
        if (!props.livekitUrl || !props.livekitToken)
            return;
        const r = new Room({ adaptiveStream: true, dynacast: true });
        setRoom(r);
        setStatus("Підключення до відео...");
        r.connect(props.livekitUrl, props.livekitToken, { autoSubscribe: true })
            .then(() => {
            setConnected(true);
            setStatus("Готово. Увімкніть мікрофон.");
            r.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
                if (track.kind === Track.Kind.Video && avatarVideoRef.current) {
                    track.attach(avatarVideoRef.current);
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
    // Connect to OpenAI Realtime via backend AudioRouter
    useEffect(() => {
        if (!connected || !props.demoSessionId)
            return;
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/api/realtime/${props.demoSessionId}`;
        console.log("[Realtime] Connecting to AudioRouter:", wsUrl);
        const ws = new WebSocket(wsUrl);
        realtimeWsRef.current = ws;
        let sessionConfigured = false;
        ws.onopen = () => {
            console.log("[Realtime] WebSocket connected");
            setRealtimeConnected(true);
        };
        ws.onmessage = async (event) => {
            try {
                let text;
                if (event.data instanceof Blob) {
                    text = await event.data.text();
                }
                else {
                    text = event.data;
                }
                const data = JSON.parse(text);
                switch (data.type) {
                    case "session.updated":
                        if (!sessionConfigured) {
                            sessionConfigured = true;
                            setStatus("Готово. Увімкніть мікрофон.");
                            // Trigger AI to start the lesson
                            ws.send(JSON.stringify({
                                type: "conversation.item.create",
                                item: {
                                    type: "message",
                                    role: "user",
                                    content: [{ type: "input_text", text: firstQuestionRef.current }]
                                }
                            }));
                            ws.send(JSON.stringify({ type: "response.create" }));
                        }
                        break;
                    case "response.audio.delta":
                        // Audio routed to LiveAvatar for lip-sync
                        break;
                    case "conversation.item.input_audio_transcription.completed":
                        if (data.transcript) {
                            onTranscriptRef.current("user", data.transcript);
                        }
                        break;
                    case "response.audio_transcript.done":
                        if (data.transcript) {
                            onTranscriptRef.current("assistant", data.transcript);
                        }
                        break;
                    case "input_audio_buffer.speech_started":
                        setStatus("Слухаю...");
                        break;
                    case "input_audio_buffer.speech_stopped":
                        setStatus("Обробляю...");
                        break;
                    case "response.done":
                        setStatus("Ваша черга говорити");
                        break;
                    case "avatar.speaking_started":
                        setStatus("Викладач говорить...");
                        break;
                    case "avatar.speaking_ended":
                        setStatus("Ваша черга говорити");
                        break;
                    case "error":
                        console.error("[Realtime] Error:", data.error);
                        setStatus(`Помилка: ${data.error?.message || "unknown"}`);
                        break;
                }
            }
            catch (err) {
                console.error("[Realtime] Error parsing message:", err);
            }
        };
        ws.onerror = (err) => {
            console.error("[Realtime] WebSocket error:", err);
            setStatus("Помилка підключення");
            setRealtimeConnected(false);
        };
        ws.onclose = (event) => {
            console.log("[Realtime] WebSocket closed:", event.code);
            setRealtimeConnected(false);
        };
        return () => {
            ws.close();
            realtimeWsRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connected, props.demoSessionId]);
    async function toggleMic() {
        if (!micEnabled) {
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
                setStatus("Мікрофон увімкнено. Говоріть.");
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
                    realtimeWsRef.current.send(JSON.stringify({
                        type: "input_audio_buffer.append",
                        audio: base64
                    }));
                };
                source.connect(processor);
                processor.connect(audioContextRef.current.destination);
            }
            catch (err) {
                setStatus(`Помилка мікрофона: ${err?.message || "unknown"}`);
                setMicEnabled(false);
            }
        }
        else {
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach((track) => track.stop());
                mediaStreamRef.current = null;
            }
            setMicEnabled(false);
            setStatus("Мікрофон вимкнено");
        }
    }
    return (_jsxs("div", { style: {
            display: "flex",
            gap: "20px",
            maxWidth: "1600px",
            margin: "0 auto",
            padding: "0 20px"
        }, children: [_jsxs("div", { style: {
                    flex: "1",
                    position: "relative",
                    aspectRatio: "16/9",
                    minHeight: "500px",
                    background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
                    borderRadius: "20px",
                    overflow: "hidden",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                    border: "1px solid rgba(255,255,255,0.1)"
                }, children: [_jsx("video", { ref: avatarVideoRef, autoPlay: true, playsInline: true, muted: true, style: {
                            width: "100%",
                            height: "100%",
                            objectFit: "cover"
                        } }), _jsx("audio", { ref: audioRef, autoPlay: true }), !connected && (_jsxs("div", { style: {
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            textAlign: "center"
                        }, children: [_jsx("div", { style: {
                                    width: "60px",
                                    height: "60px",
                                    border: "3px solid rgba(255,255,255,0.3)",
                                    borderTopColor: "#3b82f6",
                                    borderRadius: "50%",
                                    animation: "spin 1s linear infinite"
                                } }), _jsx("p", { style: { color: "#94a3b8", marginTop: "16px" }, children: "\u041F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043D\u044F..." })] })), _jsx("div", { style: {
                            position: "absolute",
                            bottom: "0",
                            left: "0",
                            right: "0",
                            background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                            padding: "40px 20px 20px"
                        }, children: _jsxs("div", { style: {
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between"
                            }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: "12px" }, children: [_jsx("div", { style: {
                                                width: "48px",
                                                height: "48px",
                                                borderRadius: "50%",
                                                background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "24px"
                                            }, children: "\uD83D\uDC69\u200D\uD83C\uDFEB" }), _jsxs("div", { children: [_jsx("div", { style: { color: "#fff", fontWeight: "600", fontSize: "16px" }, children: "\u0412\u0456\u0440\u0442\u0443\u0430\u043B\u044C\u043D\u0438\u0439 \u0432\u0438\u043A\u043B\u0430\u0434\u0430\u0447" }), _jsx("div", { style: { color: "#94a3b8", fontSize: "14px" }, children: status })] })] }), realtimeConnected && (_jsxs("div", { style: {
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        background: "rgba(34, 197, 94, 0.2)",
                                        padding: "6px 12px",
                                        borderRadius: "20px"
                                    }, children: [_jsx("div", { style: {
                                                width: "8px",
                                                height: "8px",
                                                borderRadius: "50%",
                                                background: "#22c55e",
                                                animation: "pulse 2s infinite"
                                            } }), _jsx("span", { style: { color: "#22c55e", fontSize: "13px", fontWeight: "500" }, children: "\u041E\u043D\u043B\u0430\u0439\u043D" })] }))] }) })] }), _jsxs("div", { style: {
                    flex: "1",
                    position: "relative",
                    aspectRatio: "16/9",
                    minHeight: "500px",
                    background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
                    borderRadius: "20px",
                    overflow: "hidden",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                    border: "1px solid rgba(255,255,255,0.1)"
                }, children: [_jsx(UserWebcam, { enabled: connected }), _jsx("div", { style: {
                            position: "absolute",
                            bottom: "0",
                            left: "0",
                            right: "0",
                            background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                            padding: "40px 20px 20px"
                        }, children: _jsx("button", { onClick: toggleMic, disabled: !realtimeConnected, style: {
                                width: "100%",
                                padding: "16px",
                                fontSize: "16px",
                                fontWeight: "600",
                                borderRadius: "12px",
                                border: "none",
                                cursor: realtimeConnected ? "pointer" : "not-allowed",
                                opacity: realtimeConnected ? 1 : 0.5,
                                background: micEnabled
                                    ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                                    : "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                                color: "#fff",
                                transition: "all 0.2s",
                                boxShadow: micEnabled
                                    ? "0 4px 20px rgba(239, 68, 68, 0.3)"
                                    : "0 4px 20px rgba(34, 197, 94, 0.3)"
                            }, children: micEnabled ? "🎤 Вимкнути мікрофон" : "🎤 Увімкнути мікрофон" }) })] }), _jsx("style", { children: `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      ` })] }));
}
