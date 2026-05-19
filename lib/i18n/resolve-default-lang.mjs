// Pure resolver for the user's default chat language.
//
// Resolution order — first non-empty supported match wins:
//   1. users.preferred_language     (explicit user choice)
//   2. lastConvoLang                (sticky session_lang from prior chat)
//   3. staffbaseCustomFields.language / .locale  (admin-populated)
//   4. signupLocale                 (Google OAuth locale at signup)
//   5. clientLocale                 (navigator.language from the browser)
//   6. workspaceLocales[0]          (Staffbase branch availableLocales)
//   7. 'en'                         (final fallback)
//
// Each candidate passes through normalizeLang() so values like `en-US`,
// `de_DE`, `FR` collapse to a supported 2-char code. Unsupported langs
// fall through to the next candidate.

import { SUPPORTED_LANGS, DEFAULT_LANG } from '../../data/languages.mjs';

function pick(value) {
  if (!value || typeof value !== 'string') return null;
  const lower = value.toLowerCase().split(/[-_]/)[0];
  if (lower.length !== 2) return null;
  return SUPPORTED_LANGS.includes(lower) ? lower : null;
}

export function resolveDefaultLang({
  preferredLanguage = null,
  lastConvoLang = null,
  staffbaseCustomFields = null,
  signupLocale = null,
  clientLocale = null,
  workspaceLocales = null,
} = {}) {
  const customLang = staffbaseCustomFields && typeof staffbaseCustomFields === 'object'
    ? (staffbaseCustomFields.language || staffbaseCustomFields.locale || null)
    : null;
  const workspaceFirst = Array.isArray(workspaceLocales) && workspaceLocales.length
    ? workspaceLocales[0]
    : null;

  return (
    pick(preferredLanguage)
    || pick(lastConvoLang)
    || pick(customLang)
    || pick(signupLocale)
    || pick(clientLocale)
    || pick(workspaceFirst)
    || DEFAULT_LANG
  );
}
