import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
export default function UserWebcam({ enabled }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!enabled) {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
            return;
        }
        async function startWebcam() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480 },
                    audio: false
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            }
            catch (err) {
                setError(err?.message || "Не вдалося увімкнути камеру");
            }
        }
        startWebcam();
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
            }
        };
    }, [enabled]);
    if (!enabled)
        return null;
    return (_jsxs("div", { style: { position: "relative", width: "100%", height: "100%", background: "#000" }, children: [_jsx("video", { ref: videoRef, autoPlay: true, playsInline: true, muted: true, style: {
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scaleX(-1)"
                } }), error && (_jsx("div", { style: {
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    color: "white",
                    background: "rgba(0,0,0,0.7)",
                    padding: "12px",
                    borderRadius: "8px",
                    fontSize: "14px"
                }, children: error }))] }));
}
