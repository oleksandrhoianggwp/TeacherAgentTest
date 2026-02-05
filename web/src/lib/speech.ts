export type SpeechController = {
  supported: boolean;
  listening: boolean;
  start: () => void;
  stop: () => void;
};

type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function createSpeechController(opts: {
  onFinalText: (text: string) => void;
  onListeningChange: (listening: boolean) => void;
  lang?: string;
}): SpeechController {
  const SpeechRecognitionCtor =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognitionCtor) {
    return {
      supported: false,
      listening: false,
      start: () => {},
      stop: () => {}
    };
  }

  const recognition = new SpeechRecognitionCtor() as RecognitionLike;
  recognition.lang = opts.lang ?? "uk-UA";
  recognition.interimResults = false;
  recognition.continuous = false;

  let listening = false;
  recognition.onresult = (ev: any) => {
    const text = ev?.results?.[0]?.[0]?.transcript;
    if (typeof text === "string" && text.trim()) opts.onFinalText(text.trim());
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
      if (listening) return;
      listening = true;
      opts.onListeningChange(true);
      recognition.start();
    },
    stop() {
      if (!listening) return;
      recognition.stop();
    }
  };
}

