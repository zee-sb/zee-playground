// Voice-and-text composer.
//
// UX shape (conversational, not form-filling):
//   - Hold mic to speak. Release → STT → message sends automatically.
//     The transcript appears as the user bubble in chat (no preview chip).
//     STT mishearings are corrected the same way humans correct each other:
//     by saying something next ("actually I meant Thursday"). The visible
//     ConfirmCard remains the safety gate for any write action.
//   - Optional "continuous" mode: after the assistant's TTS finishes, the
//     mic re-opens so the user can reply without touching the screen. Tap
//     anywhere on the mic chip to stop, or hit Cancel to exit the mode.
//   - The text input is always there for typing.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, Loader2, Mic, X, Languages, Radio } from 'lucide-react';
import { useVoiceInput } from './useVoiceInput.js';
import SlashMenu, { workflowPrompt, expertPrompt, visibleCount, itemAt } from './SlashMenu.jsx';

const LANG_LABEL = {
  en: 'EN', de: 'DE', es: 'ES', fr: 'FR', it: 'IT', pt: 'PT', nl: 'NL', ar: 'AR',
};

export default function VoiceComposer({
  onSubmit,
  disabled,
  isMobile,
  placeholder,
  sessionLang,
  onLanguageChange,
  // Continuous mode is owned by ChatPanel because the trigger to re-open the
  // mic (TTS finished playing) lives there. We just render the toggle + an
  // imperative `autoStart` ref that the parent calls when it wants the mic
  // open again.
  continuousMode = false,
  onToggleContinuousMode,
  registerAutoStart,
  // Server-filtered triggerable items (workflows + experts) for the slash
  // quick-actions menu. Optional — if absent the menu simply never opens.
  heroData,
}) {
  const [value, setValue] = useState('');
  const taRef = useRef(null);

  // Slash menu state. The menu opens whenever the input begins with "/" and
  // there's no whitespace before the slash (i.e. it's the leading token).
  // We track a selection index across both sections; the menu component
  // exposes flat-index helpers so we don't have to know its internals.
  const workflows = useMemo(() => heroData?.workflows || heroData?.flows || [], [heroData]);
  const experts = useMemo(() => heroData?.experts || heroData?.assistants || [], [heroData]);
  const slashOpen = value.startsWith('/');
  const slashQuery = slashOpen ? value.slice(1) : '';
  const [slashIndex, setSlashIndex] = useState(0);
  const slashCount = useMemo(
    () => (slashOpen ? visibleCount(workflows, experts, slashQuery) : 0),
    [slashOpen, slashQuery, workflows, experts],
  );
  useEffect(() => { if (slashIndex >= slashCount) setSlashIndex(0); }, [slashCount, slashIndex]);
  useEffect(() => { setSlashIndex(0); }, [slashQuery, slashOpen]);

  const { state, error, level, start, stop, cancel } = useVoiceInput({ languageHint: sessionLang || undefined });

  const isRecording = state === 'recording';
  const isUploading = state === 'uploading';
  const canSend = !!value.trim() && !disabled && !isRecording && !isUploading;

  // Track the most recent submit metadata so the parent's auto-start hook can
  // tell us what language to record the next utterance in.
  const sendVoice = useCallback(({ text, language }) => {
    if (!text) return;
    const lang = language || sessionLang || null;
    onSubmit(text, { inputModality: 'voice', lang });
    // If STT detected a language with confidence and it changed, propagate.
    if (language && language !== sessionLang) onLanguageChange?.(language);
  }, [onSubmit, sessionLang, onLanguageChange]);

  const sendText = useCallback(() => {
    const v = value.trim();
    if (!v || disabled || isRecording || isUploading) return;
    onSubmit(v, { inputModality: 'text', lang: sessionLang || null });
    setValue('');
    if (taRef.current) taRef.current.style.height = 'auto';
  }, [value, disabled, isRecording, isUploading, sessionLang, onSubmit]);

  // Send a slash-menu pick: build the trigger phrase and submit just like a
  // typed message. The orchestrator's intent classifier handles routing.
  const sendSlashPick = useCallback((item, kind) => {
    if (disabled || isRecording || isUploading) return;
    const text = kind === 'flow' ? workflowPrompt(item) : expertPrompt(item);
    onSubmit(text, { inputModality: 'text', lang: sessionLang || null, source: 'slash' });
    setValue('');
    if (taRef.current) {
      taRef.current.style.height = 'auto';
      taRef.current.focus();
    }
  }, [disabled, isRecording, isUploading, sessionLang, onSubmit]);

  function onKey(e) {
    if (slashOpen && slashCount > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % slashCount);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + slashCount) % slashCount);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const pick = itemAt(workflows, experts, slashQuery, slashIndex);
        if (pick) sendSlashPick(pick.item, pick.kind);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        // Close the menu by emptying the input — slash + query both go.
        setValue('');
        if (taRef.current) taRef.current.style.height = 'auto';
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); }
  }
  function onInput(e) {
    setValue(e.target.value);
    const el = taRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 80) + 'px'; }
  }

  // Hold-to-talk: pointerdown starts recording, pointerup stops + uploads + sends.
  const startRef = useRef(null);
  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    if (disabled || isRecording || isUploading) return;
    startRef.current = Date.now();
    start();
  }, [disabled, isRecording, isUploading, start]);

  const handlePointerUp = useCallback(async () => {
    if (!isRecording) return;
    const dur = Date.now() - (startRef.current || Date.now());
    if (dur < 350) {
      // Tap, not a hold — discard rather than upload a sub-half-second blip.
      cancel();
      return;
    }
    const result = await stop();
    if (result && result.text) {
      sendVoice({ text: result.text, language: result.language });
    }
  }, [isRecording, stop, cancel, sendVoice]);

  useEffect(() => {
    function onUp() { if (isRecording) handlePointerUp(); }
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [isRecording, handlePointerUp]);

  // Imperative hook for continuous mode — parent calls this when TTS ends.
  useEffect(() => {
    if (!registerAutoStart) return;
    registerAutoStart(() => {
      if (disabled || isRecording || isUploading) return;
      startRef.current = Date.now();
      start();
    });
  }, [registerAutoStart, disabled, isRecording, isUploading, start]);

  const langPill = sessionLang ? (LANG_LABEL[sessionLang] || sessionLang.toUpperCase()) : null;

  return (
    <div style={{ flexShrink: 0, position: 'relative', zIndex: 1, padding: '8px 12px 4px' }}>
      {slashOpen && (
        <SlashMenu
          query={slashQuery}
          workflows={workflows}
          experts={experts}
          isMobile={isMobile}
          selectedIndex={slashIndex}
          onHover={setSlashIndex}
          onPick={sendSlashPick}
        />
      )}
      {/* Mode strip — continuous-mode toggle + status line. Only renders when
          something is happening (recording, uploading, or continuous mode on)
          to keep the resting state clean. */}
      {(isRecording || isUploading || continuousMode) && (
        <div style={{
          margin: '0 6px 6px',
          padding: '6px 10px',
          background: isRecording ? 'rgba(220, 38, 38, 0.08)'
            : continuousMode ? 'rgba(0, 199, 178, 0.10)'
            : 'rgba(124, 58, 237, 0.08)',
          border: `1px solid ${isRecording ? 'rgba(220, 38, 38, 0.25)'
            : continuousMode ? 'rgba(0, 199, 178, 0.30)'
            : 'rgba(124, 58, 237, 0.25)'}`,
          borderRadius: 10,
          fontSize: 11,
          color: isRecording ? '#B91C1C'
            : continuousMode ? '#0F766E'
            : '#5B21B6',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          {isRecording ? (
            <>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#DC2626',
                boxShadow: `0 0 0 ${Math.round(2 + level * 8)}px rgba(220, 38, 38, 0.25)`,
                transition: 'box-shadow 80ms linear',
              }} />
              <span style={{ flex: 1 }}>Listening… release to send.</span>
              <button
                type="button"
                onPointerDown={(e) => { e.stopPropagation(); cancel(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                aria-label="Cancel recording"
              >
                <X size={12} />
              </button>
            </>
          ) : isUploading ? (
            <>
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ flex: 1 }}>Transcribing…</span>
            </>
          ) : (
            <>
              <Radio size={12} />
              <span style={{ flex: 1 }}>Conversation mode — mic re-opens when I finish speaking.</span>
              <button
                type="button"
                onClick={() => onToggleContinuousMode?.(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                aria-label="Stop conversation mode"
              >
                <X size={12} />
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <div style={{ margin: '0 6px 6px', padding: '6px 10px', background: 'rgba(254,242,242,0.92)', border: '1px solid #FECACA', borderRadius: 10, fontSize: 11, color: '#B91C1C' }}>
          {error}
        </div>
      )}

      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)',
        borderRadius: 28, padding: '0 6px 0 14px',
        border: '1px solid rgba(255,255,255,0.7)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
        minHeight: 48,
      }}>
        {/* Mic — hold to talk. Right-click toggles continuous mode for testing. */}
        <button
          type="button"
          aria-label={isRecording ? 'Release to send' : 'Hold to talk'}
          onPointerDown={handlePointerDown}
          onContextMenu={(e) => { e.preventDefault(); onToggleContinuousMode?.(!continuousMode); }}
          disabled={disabled || isUploading}
          style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: isRecording ? '#DC2626'
              : continuousMode ? '#00C7B2'
              : 'rgba(124,58,237,0.12)',
            border: 'none',
            cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
            boxShadow: isRecording
              ? `0 0 0 ${Math.round(4 + level * 14)}px rgba(220, 38, 38, 0.2)`
              : 'none',
            touchAction: 'none',
          }}
          title={
            isRecording ? 'Release to send'
            : continuousMode ? 'Conversation mode on. Right-click to disable.'
            : 'Hold to talk. Right-click for conversation mode.'
          }
        >
          {isUploading
            ? <Loader2 size={14} color="#7C3AED" style={{ animation: 'spin 1s linear infinite' }} />
            : continuousMode
              ? <Radio size={14} color="white" />
              : <Mic size={14} color={isRecording ? 'white' : '#7C3AED'} />}
        </button>

        <textarea
          ref={taRef}
          value={value}
          onChange={onInput}
          onKeyDown={onKey}
          placeholder={
            isRecording ? 'Listening… release to send.'
            : isUploading ? 'Transcribing…'
            : (placeholder || 'Ask or hold the mic to talk…')
          }
          disabled={disabled || isRecording || isUploading}
          rows={1}
          style={{
            flex: 1, border: 'none', background: 'none', resize: 'none', outline: 'none',
            fontSize: isMobile ? 16 : 14, color: '#111827', lineHeight: 1.5, fontFamily: 'inherit',
            maxHeight: 80, padding: '13px 0', margin: 0, display: 'block',
          }}
        />

        {langPill && (
          <button
            type="button"
            onClick={() => {
              const next = prompt('Switch language (2-letter ISO code, e.g. en, de, es)?', sessionLang || 'en');
              if (next && /^[a-z]{2}$/i.test(next.trim())) onLanguageChange?.(next.trim().toLowerCase());
            }}
            aria-label="Switch language"
            style={{
              flexShrink: 0, padding: '4px 8px', borderRadius: 999,
              background: 'rgba(124,58,237,0.12)', color: '#5B21B6',
              border: 'none', fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
            }}
            title={`Current language: ${langPill}. Tap to switch.`}
          >
            <Languages size={11} />
            {langPill}
          </button>
        )}

        <button
          type="button"
          onClick={sendText}
          disabled={!canSend}
          style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: canSend ? '#7C3AED' : 'rgba(124,58,237,0.25)',
            border: 'none', cursor: canSend ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
            boxShadow: canSend ? '0 2px 8px rgba(124,58,237,0.5)' : 'none',
          }}
          aria-label="Send message"
        >
          {disabled
            ? <Loader2 size={15} color="white" style={{ animation: 'spin 1s linear infinite' }} />
            : <Send size={15} color="white" />}
        </button>
      </div>
      <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 5, marginBottom: 3, fontWeight: 500 }}>
        Responses are AI generated. Check the answers.
      </div>
    </div>
  );
}
