// Voice provider interface. One thin seam that lets us swap STT/TTS/Realtime
// backends by changing VOICE_PROVIDER env var, without touching any caller.
//
// Today: openai (whisper-1 / gpt-4o-mini-tts / gpt-4o-realtime-preview).
// Tomorrow: azure-openai (same models on Azure) OR azure-speech (richer
// enterprise STT/TTS — custom vocab, dialect tuning, EU residency).
//
// The shapes below are the canonical envelope every implementation honors.
// Voice features upstream (api/companion.transcribe, /tts, orchestrator
// form extraction) all consume this surface, never the raw vendor SDK.

import { openaiProvider } from './providers/openai.mjs';
import { azureProvider } from './providers/azure.mjs';

let _cached = null;

export function getVoiceProvider() {
  if (_cached) return _cached;
  const flavor = (process.env.VOICE_PROVIDER || 'openai').toLowerCase();
  if (flavor === 'azure-openai' || flavor === 'azure-speech' || flavor === 'azure') {
    _cached = azureProvider({ flavor });
  } else {
    _cached = openaiProvider();
  }
  return _cached;
}

// Test hook — lets unit tests inject a fake without env juggling.
export function __setVoiceProviderForTest(p) {
  _cached = p;
}

// Provider interface (documentation):
//
// transcribe({ audio: Buffer, mimeType: string, languageHint?: string })
//   → { text, language, confidence, segments? }
//
// synthesize({ text, voice?: string, lang?: string })
//   → { audio: Buffer | ReadableStream, contentType: string }
//
// openRealtimeSession({ sessionId, tools? })          // Phase 2
//   → { ephemeralKey, model, voice, expiresAt }
