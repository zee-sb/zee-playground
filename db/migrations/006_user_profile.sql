-- Companion v5: persist richer Staffbase Directory profile fields on the
-- users row, so the Companion UI can show the real title / department /
-- location / avatar / custom fields the user has filled out on Campsite.
--
-- All columns are nullable — older user rows that predated this migration
-- (or sign-ins where the live API is unavailable) keep working with the
-- legacy gradient-initials avatar and seed title.

alter table users add column if not exists location      text;
alter table users add column if not exists custom_fields jsonb not null default '{}'::jsonb;
