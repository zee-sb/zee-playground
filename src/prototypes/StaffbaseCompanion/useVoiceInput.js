// Push-to-talk voice input hook.
//
// Provider-agnostic: posts captured audio to /api/companion/transcribe and
// gets back { text, language, confidence }. The backend chooses the actual
// STT provider (OpenAI today, Azure tomorrow); the client doesn't care.
//
// Lifecycle:
//   start()  — request mic, begin recording. If permission denied, returns
//              an error state without throwing.
//   stop()   — stop recording, upload, return the transcription result.
//   cancel() — stop recording, throw away the clip, no upload.

import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_RECORDING_MS = 60_000;

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
  }
  return 'audio/webm';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

export function useVoiceInput({ languageHint } = {}) {
  const [state, setState] = useState('idle'); // idle | recording | uploading | error
  const [error, setError] = useState(null);
  const [level, setLevel] = useState(0);      // 0..1 audio level for the waveform

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const cancelledRef = useRef(false);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const stopTimeoutRef = useRef(null);

  const teardown = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (stopTimeoutRef.current) { clearTimeout(stopTimeoutRef.current); stopTimeoutRef.current = null; }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* ignore */ }
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    setLevel(0);
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const start = useCallback(async () => {
    if (state === 'recording' || state === 'uploading') return;
    setError(null);
    cancelledRef.current = false;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Microphone not available in this browser.');
      setState('error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.start();
      setState('recording');

      // Audio level meter for the waveform indicator.
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        const ctx = new AC();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let max = 0;
          for (let i = 0; i < data.length; i++) {
            const v = Math.abs(data[i] - 128) / 128;
            if (v > max) max = v;
          }
          setLevel(max);
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        // Level meter is cosmetic — recording still works without it.
      }

      // Safety cap so a stuck recording doesn't burn the user's bandwidth.
      stopTimeoutRef.current = setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state === 'recording') {
          try { recorderRef.current.stop(); } catch { /* ignore */ }
        }
      }, MAX_RECORDING_MS);
    } catch (err) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
      setError(denied ? 'Microphone permission denied.' : (err?.message || 'Could not access microphone.'));
      setState('error');
      teardown();
    }
  }, [state, teardown]);

  const finalize = useCallback(async () => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec) { resolve(null); return; }
      const onStop = async () => {
        rec.removeEventListener('stop', onStop);
        if (cancelledRef.current) { teardown(); resolve(null); return; }
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        teardown();
        if (blob.size < 1000) {
          setState('error');
          setError('No audio captured. Hold the mic button while speaking.');
          resolve(null);
          return;
        }
        setState('uploading');
        try {
          const dataUrl = await blobToBase64(blob);
          const res = await fetch('/api/companion/transcribe', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio: dataUrl,
              mimeType: blob.type,
              languageHint: languageHint || undefined,
            }),
          });
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.message || `Transcribe failed (${res.status})`);
          }
          const payload = await res.json();
          setState('idle');
          resolve({
            text: payload.text || '',
            language: payload.language || null,
            confidence: payload.confidence || null,
            redactions: payload.redactions || [],
          });
        } catch (err) {
          setState('error');
          setError(err.message || 'Transcription failed.');
          resolve(null);
        }
      };
      rec.addEventListener('stop', onStop);
      if (rec.state === 'recording') {
        try { rec.stop(); } catch { /* ignore */ }
      } else {
        // Already stopped (e.g. hit the timeout). Synthesize a stop event.
        onStop();
      }
    });
  }, [languageHint, teardown]);

  const stop = useCallback(async () => {
    if (state !== 'recording') return null;
    return finalize();
  }, [state, finalize]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    const rec = recorderRef.current;
    if (rec && rec.state === 'recording') {
      try { rec.stop(); } catch { /* ignore */ }
    } else {
      teardown();
      setState('idle');
    }
  }, [teardown]);

  return { state, error, level, start, stop, cancel };
}
