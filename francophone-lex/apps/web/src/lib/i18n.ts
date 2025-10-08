import fr from '../../messages/fr.json';
import en from '../../messages/en.json';

export const locales = ['fr', 'en'] as const;
export type Locale = (typeof locales)[number];

type Messages = typeof fr;

const dictionaries: Record<Locale, Messages> = {
  fr,
  en,
};

export function isLocale(input: string): input is Locale {
  return (locales as readonly string[]).includes(input);
}

export type { Messages };

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale];
}
