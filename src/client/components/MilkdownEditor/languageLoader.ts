import type { LanguageSupport, LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { json } from '@codemirror/lang-json';

export interface LanguageInfo {
  name: string;
  alias: readonly string[];
}

export function getAvailableLanguages(): LanguageInfo[] {
  return languages.map(lang => ({
    name: lang.name,
    alias: lang.alias,
  }));
}

export function findLanguageByName(name: string): LanguageDescription | null {
  if (!name) return null;

  const normalized = name.toLowerCase();

  return languages.find(lang =>
    lang.alias.some(alias => alias.toLowerCase() === normalized)
  ) || null;
}

export async function loadLanguage(language: string): Promise<LanguageSupport | null> {
  // JSON is always embedded (no CDN required)
  if (language.toLowerCase() === 'json') {
    return json();
  }

  const langDesc = findLanguageByName(language);

  if (!langDesc) {
    if (language) {
      console.warn(`Language "${language}" is not supported`);
    }
    return null;
  }

  try {
    const languageSupport = await langDesc.load();
    return languageSupport;
  } catch (error) {
    console.error(`Failed to load language "${language}":`, error);
    return null;
  }
}
