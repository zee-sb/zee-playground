-- Per-user language preference + signup locale capture.
--
-- preferred_language: only set when the user explicitly picks a language
--   (via the picker or by accepting a drift-confirm chip). Resolution
--   step 1 in lib/i18n/resolve-default-lang.mjs.
--
-- signup_locale: raw locale seen at signup (Google OAuth, Staffbase profile,
--   or browser-supplied). Set once on insert, never overwritten — used as a
--   fallback when no explicit preference exists yet. Stored raw (e.g. "en",
--   "de-DE", "fr") and normalized at read time via normalizeLang().

alter table users
  add column if not exists preferred_language text
    check (preferred_language is null or preferred_language ~ '^[a-z]{2}$');

alter table users
  add column if not exists signup_locale text;

create index if not exists users_preferred_language_idx
  on users (preferred_language)
  where preferred_language is not null;
