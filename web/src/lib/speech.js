export function createSpeechController(opts) {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
        return {
            supported: false,
            listening: false,
            start: () => { },
            stop: () => { }
        };
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = opts.lang ?? "uk-UA";
    recognition.interimResults = false;
    recognition.continuous = false;
    let listening = false;
    recognition.onresult = (ev) => {
        const text = ev?.results?.[0]?.[0]?.transcript;
        if (typeof text === "string" && text.trim())
            opts.onFinalText(text.trim());
    };
    recognition.onend = () => {
        listening = false;
        opts.onListeningChange(false);
    };
    return {
        supported: true,
        get listening() {
            return listening;
        },
        start() {
            if (listening)
                return;
            listening = true;
            opts.onListeningChange(true);
            recognition.start();
        },
        stop() {
            if (!listening)
                return;
            recognition.stop();
        }
    };
}
