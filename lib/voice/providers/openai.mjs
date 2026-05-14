// OpenAI voice provider — used today against a standard OpenAI platform key.
//
// STT: gpt-4o-mini-transcribe (fast, multilingual, returns detected language).
//      Falls back to whisper-1 if the newer model is unavailable.
// TTS: gpt-4o-mini-tts (streaming MP3, multi-language voices).
// Realtime: gpt-4o-realtime-preview (Phase 2; ephemeral session token).
//
// All shapes match lib/voice/provider.mjs's documented envelope so production
// can swap to Azure (lib/voice/providers/azure.mjs) without callers changing.

import OpenAI from 'openai';

const STT_MODEL = process.env.OPENAI_STT_MODEL || 'gpt-4o-mini-transcribe';
const STT_FALLBACK = 'whisper-1';
const TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview';

// Voice picks. Stable across languages — OpenAI voices auto-adapt to the
// language of the input text. Mapped 1:1 to Azure Neural voices when we swap.
const VOICE_BY_LANG = {
  en: 'alloy',
  de: 'nova',
  es: 'shimmer',
  fr: 'nova',
  it: 'nova',
  pt: 'alloy',
  nl: 'nova',
  ar: 'alloy',
  default: 'alloy',
};

function pickVoice({ voice, lang }) {
  if (voice) return voice;
  if (lang && VOICE_BY_LANG[lang]) return VOICE_BY_LANG[lang];
  return VOICE_BY_LANG.default;
}

function clientOrThrow() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set');
  return new OpenAI({ apiKey: key });
}

// Build an `Uploadable` Web File from a Node Buffer. The OpenAI SDK accepts
// a Web File in serverless runtimes — no temp file needed.
function bufferToFile(buf, mimeType, name) {
  const blob = new Blob([buf], { type: mimeType || 'audio/webm' });
  // Node 18+ exposes `File` globally; fall back to constructing from Blob if
  // we're on an older runtime.
  if (typeof File !== 'undefined') {
    return new File([blob], name, { type: blob.type });
  }
  // Older Node — pretend Blob is a File by tacking on a name. The SDK reads
  // it as a stream via blob.arrayBuffer(), so this is sufficient.
  blob.name = name;
  return blob;
}

export function openaiProvider() {
  return {
    name: 'openai',

    async transcribe({ audio, mimeType, languageHint }) {
      const client = clientOrThrow();
      const ext = (mimeType || '').includes('mp4') ? 'mp4'
        : (mimeType || '').includes('wav') ? 'wav'
        : (mimeType || '').includes('mpeg') ? 'mp3'
        : (mimeType || '').includes('ogg') ? 'ogg'
        : 'webm';
      const file = bufferToFile(audio, mimeType, `clip.${ext}`);

      const tryModel = async (model) => {
        const params = {
          model,
          file,
          // verbose_json gives us {text, language, segments}. Some newer
          // models reject verbose_json and only accept "json" — we handle
          // both shapes below.
          response_format: model === STT_FALLBACK ? 'verbose_json' : 'json',
          temperature: 0,
        };
        if (languageHint) params.language = languageHint;
        return client.audio.transcriptions.create(params);
      };

      let resp;
      try {
        resp = await tryModel(STT_MODEL);
      } catch (err) {
        // Newer transcribe models may not be available on every account —
        // fall back to whisper-1 which is universally enabled.
        if (STT_MODEL !== STT_FALLBACK) {
          resp = await tryModel(STT_FALLBACK);
        } else {
          throw err;
        }
      }

      const text = resp?.text || '';
      const language = resp?.language || languageHint || null;
      const segments = Array.isArray(resp?.segments) ? resp.segments : undefined;
      // OpenAI STT doesn't return an explicit confidence — derive a rough
      // proxy from segment avg_logprob if present. Otherwise 1 when we got
      // text back, 0 when empty.
      let confidence = text ? 0.9 : 0;
      if (segments && segments.length) {
        const avg = segments.reduce((s, x) => s + (Number(x.avg_logprob) || 0), 0) / segments.length;
        // avg_logprob is roughly in [-1, 0]; map to [0.5, 1].
        confidence = Math.max(0, Math.min(1, 1 + avg * 0.5));
      }
      return { text, language, confidence, segments };
    },

    async synthesize({ text, voice, lang }) {
      const client = clientOrThrow();
      const chosen = pickVoice({ voice, lang });
      const resp = await client.audio.speech.create({
        model: TTS_MODEL,
        voice: chosen,
        input: text,
        response_format: 'mp3',
      });
      // SDK returns a Response-like object with arrayBuffer().
      const ab = await resp.arrayBuffer();
      return { audio: Buffer.from(ab), contentType: 'audio/mpeg', voice: chosen };
    },

    async openRealtimeSession({ sessionId, tools } = {}) {
      // Phase 2 — minted ephemeral session token for browser WebRTC.
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error('OPENAI_API_KEY is not set');
      const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: REALTIME_MODEL,
          voice: 'alloy',
          modalities: ['text', 'audio'],
          tools: tools || [],
          metadata: sessionId ? { sessionId } : undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`openai realtime session failed: ${res.status} ${text}`);
      }
      const json = await res.json();
      return {
        ephemeralKey: json.client_secret?.value || null,
        model: REALTIME_MODEL,
        voice: 'alloy',
        expiresAt: json.client_secret?.expires_at || null,
      };
    },
  };
}
