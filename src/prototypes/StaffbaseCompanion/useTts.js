// Per-message text-to-speech playback.
//
// Tap the speaker icon → POST /api/companion/tts → stream the MP3 back →
// HTMLAudioElement plays it. Opt-in (never auto-play in MVP) — see the
// plan's Phase 1 scope.

import { useCallback, useEffect, useRef, useState } from 'react';

function stripMarkdown(text) {
  return String(text || '')
    .replace(/<suggestions>[\s\S]*?<\/suggestions>/g, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_#>~]+/g, '')
    .trim();
}

export function useTts() {
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);
  const urlRef = useRef(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch { /* ignore */ }
      audioRef.current = null;
    }
    if (urlRef.current) {
      try { URL.revokeObjectURL(urlRef.current); } catch { /* ignore */ }
      urlRef.current = null;
    }
    setPlayingId(null);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const play = useCallback(async (id, text, lang) => {
    if (playingId === id) { stop(); return; }
    stop();
    const cleaned = stripMarkdown(text);
    if (!cleaned) return;
    try {
      const res = await fetch('/api/companion/tts', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleaned, lang: lang || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || `TTS failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { stop(); };
      audio.onerror = () => { stop(); };
      setPlayingId(id);
      await audio.play().catch(() => stop());
    } catch (err) {
      console.warn('[useTts]', err.message);
      stop();
    }
  }, [playingId, stop]);

  return { playingId, play, stop };
}
