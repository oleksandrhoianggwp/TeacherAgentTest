export function speak(text: string, lang = "uk-UA"): Promise<void> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth) return resolve();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 1;
    utter.pitch = 1;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    synth.cancel();
    synth.speak(utter);
  });
}

