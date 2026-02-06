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
    // Keep refs updated
    onTranscriptRef.current = props.onTranscript;
    firstQuestionRef.current = props.firstQuestion;
    // Connect to LiveKit for avatar video
    useEffect(() => {
        if (!props.livekitUrl || !props.livekitToken)
            return;
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
    // Connect to OpenAI Realtime через backend AudioRouter (with LiveAvatar lip-sync)
    useEffect(() => {
        if (!connected || !props.demoSessionId)
            return;
        // Підключаємось до backend AudioRouter WebSocket
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/api/realtime/${props.demoSessionId}`;
        console.log("[Realtime] Connecting to AudioRouter:", wsUrl);
        const ws = new WebSocket(wsUrl);
        realtimeWsRef.current = ws;
        let sessionConfigured = false;
        ws.onopen = () => {
            console.log("[Realtime] WebSocket connected to AudioRouter");
            setRealtimeConnected(true);
            // Backend AudioRouter handles session.update - just wait for session.updated
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
                // Only log non-audio events to reduce noise
                if (data.type !== "response.audio.delta" && data.type !== "response.audio_transcript.delta") {
                    console.log("[Realtime]", data.type);
                }
                switch (data.type) {
                    case "session.updated":
                        console.log("[Realtime] Session configured by backend");
                        if (!sessionConfigured) {
                            sessionConfigured = true;
                            setStatus("Сесія готова. Увімкни мікрофон.");
                            // Send initial greeting after session is configured
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
                    // Audio is now handled by LiveAvatar via LiveKit - no direct playback needed
                    case "response.audio.delta":
                        // Audio routed to LiveAvatar for lip-sync, comes back via LiveKit
                        break;
                    case "conversation.item.input_audio_transcription.completed":
                        if (data.transcript) {
                            console.log("[Realtime] User:", data.transcript);
                            onTranscriptRef.current("user", data.transcript);
                        }
                        break;
                    case "response.audio_transcript.done":
                        if (data.transcript) {
                            console.log("[Realtime] Assistant:", data.transcript);
                            onTranscriptRef.current("assistant", data.transcript);
                        }
                        break;
                    case "input_audio_buffer.speech_started":
                        console.log("[Realtime] User speaking...");
                        setStatus("Слухаю...");
                        break;
                    case "input_audio_buffer.speech_stopped":
                        console.log("[Realtime] User stopped");
                        setStatus("Обробляю...");
                        break;
                    case "response.done":
                        console.log("[Realtime] Response complete");
                        setStatus("Готово. Твоя черга.");
                        break;
                    case "avatar.speaking_started":
                        console.log("[Realtime] Avatar speaking (lip-sync)");
                        setStatus("Говорю...");
                        break;
                    case "avatar.speaking_ended":
                        console.log("[Realtime] Avatar finished speaking");
                        setStatus("Готово. Твоя черга.");
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
            console.log("[Realtime] WebSocket closed:", event.code, event.reason);
            setRealtimeConnected(false);
        };
        return () => {
            ws.close();
            realtimeWsRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connected, props.demoSessionId]);
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
            // Stop microphone
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach((track) => track.stop());
                mediaStreamRef.current = null;
            }
            setMicEnabled(false);
            setStatus("Мікрофон вимкнено.");
        }
    }
    return (_jsxs("div", { style: { display: "flex", gap: "24px", marginTop: "16px" }, children: [_jsxs("div", { style: { flex: "1", position: "relative", minHeight: "700px", background: "#000", borderRadius: "16px", overflow: "hidden" }, children: [_jsx("video", { ref: avatarVideoRef, autoPlay: true, playsInline: true, muted: true, style: { width: "100%", height: "100%", objectFit: "cover" } }), _jsx("audio", { ref: audioRef, autoPlay: true }), !connected && (_jsx("div", { style: {
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            color: "white"
                        }, children: _jsx("div", { className: "pulse" }) })), _jsxs("div", { style: {
                            position: "absolute",
                            bottom: "16px",
                            left: "16px",
                            right: "16px",
                            fontSize: "15px",
                            color: "white",
                            background: "rgba(0,0,0,0.6)",
                            padding: "12px 16px",
                            borderRadius: "10px"
                        }, children: [_jsx("strong", { children: "\u041C\u0430\u0440\u0456\u044F" }), " - ", status, realtimeConnected && _jsx("span", { style: { marginLeft: "8px", color: "#4ade80" }, children: "\u25CF Realtime" })] })] }), _jsxs("div", { style: { flex: "1", position: "relative", minHeight: "700px", background: "#000", borderRadius: "16px", overflow: "hidden" }, children: [_jsx(UserWebcam, { enabled: connected }), _jsx("div", { style: { position: "absolute", bottom: "16px", left: "16px", right: "16px" }, children: _jsx("button", { className: micEnabled ? "danger" : "primary", onClick: toggleMic, disabled: !realtimeConnected, style: { width: "100%", padding: "14px", fontSize: "16px" }, children: micEnabled ? "🎤 Вимкнути мікрофон" : "🎤 Увімкнути мікрофон" }) })] })] }));
}
