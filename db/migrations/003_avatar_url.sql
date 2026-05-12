-- Companion v3: store the user's real Staffbase profile photo URL.
--
-- The legacy `avatar_initials` text column stays for the gradient-initials
-- fallback (when no live photo is available), but the rendered UI prefers
-- `avatar_url` whenever it's populated.

alter table users add column if not exists avatar_url text;
