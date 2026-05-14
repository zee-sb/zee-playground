// Azure voice provider — production target. Two flavors share this module:
//
//   VOICE_PROVIDER=azure-openai  → Azure OpenAI deployment of whisper/tts/realtime.
//                                  Same SDK shapes as OpenAI; only the base URL
//                                  and auth header differ. Drop-in.
//
//   VOICE_PROVIDER=azure-speech  → Azure AI Speech (cognitive services). Richer
//                                  STT (streaming partials, custom vocab,
//                                  dialect tuning) + Neural TTS. Different API
//                                  surface, but produces the same envelope.
//
// This file is stubbed: it documents the env contract and the call shapes so
// production swap is mechanical, but throws at runtime if invoked without
// credentials. The OpenAI provider remains the default for the prototype.

const ENV_CONTRACT = `
Azure OpenAI mode (VOICE_PROVIDER=azure-openai):
  AZURE_OPENAI_ENDPOINT       e.g. https://<resource>.openai.azure.com
  AZURE_OPENAI_API_KEY        Azure OpenAI key
  AZURE_OPENAI_API_VERSION    e.g. 2024-10-01-preview
  AZURE_OPENAI_STT_DEPLOYMENT name of the whisper / gpt-4o-transcribe deployment
  AZURE_OPENAI_TTS_DEPLOYMENT name of the gpt-4o-mini-tts deployment
  AZURE_OPENAI_REALTIME_DEPLOYMENT name of the gpt-4o-realtime-preview deployment

Azure AI Speech mode (VOICE_PROVIDER=azure-speech):
  AZURE_SPEECH_KEY            cognitive services key
  AZURE_SPEECH_REGION         e.g. westeurope (for GDPR)
  AZURE_SPEECH_TTS_VOICE_*    optional per-lang voice overrides (e.g. en-US-AvaNeural)
`;

function notImplemented(method) {
  throw new Error(
    `[voice/azure] ${method} not implemented in this prototype. ` +
    `The OpenAI provider is the default — set VOICE_PROVIDER=openai (or unset) ` +
    `to use it. Production wiring contract:\n${ENV_CONTRACT}`
  );
}

export function azureProvider({ flavor }) {
  return {
    name: flavor,
    async transcribe() { notImplemented('transcribe'); },
    async synthesize() { notImplemented('synthesize'); },
    async openRealtimeSession() { notImplemented('openRealtimeSession'); },
  };
}
