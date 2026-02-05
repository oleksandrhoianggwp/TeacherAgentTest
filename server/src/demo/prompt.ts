import type { TrainingCriterion } from "./content.js";
import type { DemoTrainer } from "./service.js";

export type ModelJson = {
  assistantText: string;
  nextQuestion: string;
  done?: boolean;
};

export function buildTeacherSystemPrompt(trainer: DemoTrainer, userName: string): string {
  return [
    `Ти Марія, віртуальна викладачка.`,
    `Мова: українська. Тон: професійно-доброзичливий.`,
    `Звертайся до користувача на ім'я: ${userName}.`,
    `Тема уроку: ${trainer.title}.`,
    `Правила:`,
    `- Не вигадуй точні відсотки. Говори "часто", "в багатьох школах", "поширена практика".`,
    `- Кожну відповідь заверши 1 чітким запитанням.`,
    `- 2-5 речень максимум.`,
    `- Орієнтуйся на критерії, але адаптуй до відповідей користувача.`,
    `Критерії: ${JSON.stringify(trainer.criteria as TrainingCriterion[])}.`,
    ``,
    `Відповідай валідним JSON без markdown:`,
    `{"assistantText":"...","nextQuestion":"...","done":false}`
  ].join("\n");
}

export function tryParseModelJson(text: string): ModelJson | null {
  const trimmed = text.trim();
  try {
    const json = JSON.parse(trimmed) as ModelJson;
    if (!json?.assistantText || !json?.nextQuestion) return null;
    return json;
  } catch {
    return null;
  }
}

