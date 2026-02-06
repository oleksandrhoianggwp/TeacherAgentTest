export type TrainingCriterion = {
  name: string;
  questions: string[];
};

export type DemoContent = {
  title: string;
  trainingLanguage: "uk";
  avatarKey: "female_friendly";
  openingTextTemplate: string;
  criteria: TrainingCriterion[];
};

export const AI_SCHOOLS_UK: DemoContent = {
  title: "Впровадження штучного інтелекту в школах",
  trainingLanguage: "uk",
  avatarKey: "female_friendly",
  openingTextTemplate:
    "Привіт! Я ваш віртуальний друг, який хоче допомогти вам не відстати від сучасних технологій " +
    "і своєчасно впровадити штучний інтелект в освіті. " +
    "Давайте спочатку познайомимось — як вас звати?",
  criteria: [
    {
      name: "Знайомство",
      questions: [
        "Яку роль ти виконуєш у своїй школі: вчитель, директор, чи адміністратор?",
        "Наскільки добре ти розумієш можливості AI у школах: від 1 до 10?"
      ]
    },
    {
      name: "Цілі впровадження",
      questions: [
        "Що для тебе важливіше: економія часу вчителів, персоналізація навчання, чи підвищення результатів учнів?",
        "Які конкретні проблеми хочеш вирішити за допомогою AI?"
      ]
    },
    {
      name: "Бар'єри",
      questions: [
        "Що зараз найбільше стримує впровадження: бюджет, навички вчителів, чи технічна інфраструктура?",
        "Чи є в школі вже якісь цифрові інструменти (електронний журнал, LMS)?"
      ]
    },
    {
      name: "Практичні кроки",
      questions: [
        "Хочеш почути про конкретні інструменти AI для твоєї ситуації?",
        "Готовий спробувати пілотний проект на 2-4 тижні?"
      ]
    }
  ]
};

export function renderOpeningText(template: string, name: string): string {
  return template.replaceAll("{name}", name);
}
