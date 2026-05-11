// Supported languages and helpers used across MCP servers + UI.

export const SUPPORTED_LANGS = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl'];

export const LANG_LABELS = {
  en: { name: 'English',   native: 'English',   flag: '🇬🇧' },
  de: { name: 'German',    native: 'Deutsch',   flag: '🇩🇪' },
  fr: { name: 'French',    native: 'Français',  flag: '🇫🇷' },
  es: { name: 'Spanish',   native: 'Español',   flag: '🇪🇸' },
  it: { name: 'Italian',   native: 'Italiano',  flag: '🇮🇹' },
  nl: { name: 'Dutch',     native: 'Nederlands', flag: '🇳🇱' },
  pl: { name: 'Polish',    native: 'Polski',    flag: '🇵🇱' },
};

export const DEFAULT_LANG = 'en';

export function normalizeLang(lang) {
  if (!lang || typeof lang !== 'string') return DEFAULT_LANG;
  const lower = lang.toLowerCase().split('-')[0];
  return SUPPORTED_LANGS.includes(lower) ? lower : DEFAULT_LANG;
}

// Pick a localized field with EN fallback.
// Use for: titles, summaries, category labels, content.
export function pick(map, lang) {
  if (!map) return '';
  const l = normalizeLang(lang);
  return map[l] ?? map.en ?? Object.values(map)[0] ?? '';
}

// Translate categories — used by policy/holiday/faq data.
export const CATEGORIES = {
  // HR
  time_off:        { en: 'Time Off',                de: 'Abwesenheit',           fr: 'Congés',                  es: 'Ausencias',                  it: 'Assenze',                    nl: 'Verlof',                  pl: 'Urlopy' },
  benefits:        { en: 'Benefits',                de: 'Leistungen',            fr: 'Avantages',                es: 'Beneficios',                 it: 'Benefit',                    nl: 'Voordelen',               pl: 'Świadczenia' },
  work_arrangements:{ en: 'Work Arrangements',      de: 'Arbeitsmodelle',        fr: 'Modalités de travail',     es: 'Modalidades de trabajo',     it: 'Modalità di lavoro',         nl: 'Werkregelingen',          pl: 'Formy pracy' },
  conduct:         { en: 'Conduct & Compliance',    de: 'Verhalten & Compliance', fr: 'Conduite & Conformité',   es: 'Conducta y Cumplimiento',    it: 'Condotta e Compliance',      nl: 'Gedrag & Compliance',     pl: 'Etyka i zgodność' },
  performance:     { en: 'Performance & Pay',       de: 'Leistung & Vergütung',   fr: 'Performance & Rémunération', es: 'Desempeño y Retribución', it: 'Performance e Retribuzione', nl: 'Prestaties & Beloning',  pl: 'Wyniki i wynagrodzenie' },
  lifecycle:       { en: 'Employee Lifecycle',      de: 'Mitarbeiterlebenszyklus', fr: 'Cycle de vie',          es: 'Ciclo del empleado',         it: 'Ciclo del dipendente',       nl: 'Medewerkerscyclus',       pl: 'Cykl pracownika' },
  learning:        { en: 'Learning & Development',  de: 'Weiterbildung',         fr: 'Formation',                es: 'Formación',                  it: 'Formazione',                 nl: 'Leren & Ontwikkeling',    pl: 'Rozwój' },
  travel:          { en: 'Travel & Expenses',       de: 'Reisen & Spesen',       fr: 'Voyages & Frais',          es: 'Viajes y Gastos',            it: 'Viaggi e Spese',             nl: 'Reizen & Onkosten',       pl: 'Podróże i wydatki' },
  // IT / Security
  security:        { en: 'Security',                de: 'Sicherheit',            fr: 'Sécurité',                 es: 'Seguridad',                  it: 'Sicurezza',                  nl: 'Beveiliging',             pl: 'Bezpieczeństwo' },
  it_ops:          { en: 'IT Operations',           de: 'IT-Betrieb',            fr: 'Opérations IT',            es: 'Operaciones de TI',          it: 'Operazioni IT',              nl: 'IT-operaties',            pl: 'Operacje IT' },
  data_privacy:    { en: 'Data & Privacy',          de: 'Daten & Datenschutz',   fr: 'Données et Confidentialité', es: 'Datos y Privacidad',      it: 'Dati e Privacy',             nl: 'Data & Privacy',          pl: 'Dane i Prywatność' },
  access:          { en: 'Access & Identity',       de: 'Zugriff & Identität',   fr: 'Accès et Identité',        es: 'Acceso e Identidad',         it: 'Accesso e Identità',         nl: 'Toegang & Identiteit',    pl: 'Dostęp i Tożsamość' },
};

export function categoryLabel(key, lang) {
  return pick(CATEGORIES[key] ?? { en: key }, lang);
}
