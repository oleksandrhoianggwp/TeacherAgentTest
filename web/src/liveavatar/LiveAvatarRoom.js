import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
function encodeUtf8(s) {
    return new TextEncoder().encode(s);
}
function decodeUtf8(bytes) {
    return new TextDecoder().decode(bytes);
}
function safeJsonParse(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
export default function LiveAvatarRoom(props) {
    const [room, setRoom] = useState(null);
    const [connected, setConnected] = useState(false);
    const [micEnabled, setMicEnabled] = useState(false);
    const [status, setStatus] = useState("Підключення…");
    const videoRef = useRef(null);
    const audioRef = useRef(null);
    const busyRef = useRef(false);
    const lastTranscriptAtRef = useRef(0);
    const canConnect = useMemo(() => Boolean(props.livekitUrl && props.livekitToken && props.liveAvatarSessionId), [props.livekitUrl, props.livekitToken, props.liveAvatarSessionId]);
    useEffect(() => {
        if (!canConnect || props.disabled)
            return;
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
        const attachRemote = (track, publication, participant) => {
            if (publication.kind === Track.Kind.Video && videoRef.current) {
                track.attach(videoRef.current);
                setStatus(`Аватар підключився (${participant.identity}).`);
            }
            if (publication.kind === Track.Kind.Audio && audioRef.current) {
                track.attach(audioRef.current);
            }
        };
        const onData = async (payload, _p, _kind, topic) => {
            if (topic !== "agent-response")
                return;
            const txt = decodeUtf8(payload);
            const json = safeJsonParse(txt);
            if (!json || typeof json.event_type !== "string")
                return;
            if (json.event_type === "user.transcription" && typeof json.text === "string" && json.text.trim()) {
                const now = Date.now();
                if (now - lastTranscriptAtRef.current < 500)
                    return;
                lastTranscriptAtRef.current = now;
                if (busyRef.current)
                    return;
                busyRef.current = true;
                try {
                    const replyText = await props.onUserText(json.text.trim());
                    if (replyText) {
                        await publishSpeak(r, props.liveAvatarSessionId, replyText);
                    }
                }
                finally {
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
            r.on(RoomEvent.DataReceived, onData);
            // Speak the opening immediately via avatar command.
            await publishSpeak(r, props.liveAvatarSessionId, `${props.openingText}\n\n${props.firstQuestion}`);
            setStatus("Готово. Тепер твоя черга відповісти.");
        })
            .catch((e) => setStatus(`Помилка підключення: ${String(e?.message ?? e)}`));
        return () => {
            try {
                r.disconnect();
            }
            catch {
                // ignore
            }
            setRoom(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canConnect, props.disabled, props.livekitUrl, props.livekitToken, props.liveAvatarSessionId]);
    async function toggleMic() {
        if (!room)
            return;
        const next = !micEnabled;
        setMicEnabled(next);
        try {
            await room.localParticipant.setMicrophoneEnabled(next);
        }
        catch (e) {
            setStatus(`Не вдалося увімкнути мікрофон: ${String(e?.message ?? e)}`);
            setMicEnabled(false);
        }
    }
    return (_jsxs("div", { className: "grid2", children: [_jsxs("div", { className: "avatar", children: [_jsx("video", { ref: videoRef, autoPlay: true, playsInline: true, muted: true, style: { width: "100%", height: "100%", objectFit: "cover" } }), _jsx("audio", { ref: audioRef, autoPlay: true }), !connected ? _jsx("div", { className: "pulse" }) : null, _jsx("div", { style: {
                            position: "absolute",
                            bottom: 12,
                            left: 12,
                            right: 12,
                            fontSize: 12,
                            color: "var(--muted)"
                        }, children: status })] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "btnRow", style: { marginTop: 0 }, children: _jsx("button", { className: "primary", onClick: toggleMic, disabled: !room, children: micEnabled ? "Вимкнути мікрофон" : "Увімкнути мікрофон" }) }), _jsx("p", { style: { marginTop: 10, fontSize: 13 }, children: "\u041F\u043E\u0440\u0430\u0434\u0430: \u0433\u043E\u0432\u043E\u0440\u0438 \u043A\u043E\u0440\u043E\u0442\u043A\u043E. \u041F\u0456\u0441\u043B\u044F \u0442\u043E\u0433\u043E \u044F\u043A \u0442\u0438 \u0437\u0430\u043C\u043E\u0432\u043A\u043D\u0435\u0448, \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043E\u0442\u0440\u0438\u043C\u0430\u0454 \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442 \u0456 \u041C\u0430\u0440\u0456\u044F \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0441\u0442\u044C." })] })] }));
}
export async function publishSpeak(room, liveAvatarSessionId, text) {
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
