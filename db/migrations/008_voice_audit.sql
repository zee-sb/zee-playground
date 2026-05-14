-- Voice MVP: compliance audit table.
--
-- Why this exists separately from `messages`:
--   - retention is configurable per tenant independent of chat history
--   - lets compliance answer "how many voice turns last month, in which
--     languages, with what confidence" without scanning JSONB
--   - the actual transcript text lives in `messages.content` (already covered
--     by message retention); this table stores only modality + language +
--     hash linkage. We NEVER store the raw audio bytes here — see the
--     `lib/voice/provider.mjs` contract (audio is transcribe-and-drop).
--
-- The `messages.content` JSONB gets two new keys for voice turns:
--   - input_modality : "voice" | "text"   (default "text" when absent)
--   - stt_language   : ISO 639-1 code     (only present for voice turns)
-- No schema change needed for those — JSONB already accepts them.

create table if not exists voice_audit (
  id              bigserial primary key,
  conversation_id uuid not null
                   references conversations(id) on delete cascade,
  user_id         uuid not null
                   references users(id) on delete cascade,
  modality        text not null check (modality in ('voice', 'text')),
  language        text,            -- ISO 639-1 (en, de, …) or null
  confidence      double precision,
  transcript_hash text,            -- FNV-1a hex of the transcript text (no raw text)
  created_at      timestamptz not null default now()
);

create index if not exists voice_audit_conversation_idx
  on voice_audit (conversation_id, created_at desc);
create index if not exists voice_audit_user_lang_idx
  on voice_audit (user_id, language, created_at desc);
