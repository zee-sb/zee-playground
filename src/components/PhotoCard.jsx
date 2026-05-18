// Photo capture + AI-validation card for chat. Two phases:
//   1. capture  — render instructions + camera/upload buttons.
//                 Picking a file resizes it (max edge 1280, JPEG 0.85) and
//                 shows a preview with "Use this photo" / "Retake".
//   2. review   — server has run vision validation; show the photo with an
//                 SVG annotation overlay, per-criterion rows, and accept
//                 controls (Submit, Submit anyway, Retake).
//
// Phase is driven by props from the FlowTimeline (which mirrors the
// orchestrator's `awaiting.phase`). The card itself owns ephemeral state for
// the not-yet-submitted preview between local pick and POST.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Upload, RotateCcw, CheckCircle, AlertTriangle, Loader2, Image as ImageIcon } from 'lucide-react';
import {
  STAFFBASE_TEAL, STAFFBASE_TEAL_DEEP, NEUTRAL_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
} from '../prototypes/StaffbaseCompanion/cards/cardStyles.js';

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.85;

// Resize a File to a JPEG data URL with max-edge MAX_EDGE.
async function resizeImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = (e) => reject(new Error('image load failed'));
      i.src = url;
    });
    const { width: srcW, height: srcH } = img;
    const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
    const w = Math.round(srcW * scale);
    const h = Math.round(srcH * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    return { dataUrl, width: w, height: h, mimeType: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function severityColor(s) {
  if (s === 'error') return '#DC2626';
  if (s === 'info')  return '#2563EB';
  return '#D97706'; // warning
}

export default function PhotoCard({
  spec,
  phase = 'capture',           // 'capture' | 'review'
  staged = null,               // { imageDataUrl, imageWidth, imageHeight, mimeType, validation } when phase === 'review'
  busy = false,                // server round-trip in flight
  onValidate,                  // ({ imageDataUrl, imageWidth, imageHeight, mimeType }) => void
  onAccept,                    // ({ acceptedDespiteFail }) => void
  onRetake,                    // () => void
}) {
  // Local pre-submit preview (between client-side pick and POST to server).
  const [localPreview, setLocalPreview] = useState(null);
  const [resizing, setResizing] = useState(false);
  const [localError, setLocalError] = useState(null);
  const cameraInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  // When the server transitions us to 'review', clear the local preview so
  // we render from `staged` instead.
  useEffect(() => {
    if (phase === 'review') {
      setLocalPreview(null);
      setResizing(false);
      setLocalError(null);
    }
  }, [phase]);

  const captureMode = spec?.captureMode || 'both';
  const showCamera = captureMode === 'camera' || captureMode === 'both';
  const showUpload = captureMode === 'upload' || captureMode === 'both';
  const onFail = spec?.onFail || 'warn';

  async function onFile(file) {
    if (!file) return;
    setLocalError(null);
    setResizing(true);
    try {
      const out = await resizeImage(file);
      setLocalPreview(out);
    } catch (err) {
      setLocalError(err.message || 'Could not read this image. Try another.');
    } finally {
      setResizing(false);
    }
  }

  function clickHidden(ref) {
    try { ref.current?.click(); } catch { /* */ }
  }

  function submitForValidation() {
    if (!localPreview) return;
    onValidate?.({
      imageDataUrl: localPreview.dataUrl,
      imageWidth: localPreview.width,
      imageHeight: localPreview.height,
      mimeType: localPreview.mimeType,
    });
  }

  // ─────────── REVIEW PHASE ───────────
  if (phase === 'review' && staged) {
    return (
      <ReviewView
        spec={spec}
        staged={staged}
        busy={busy}
        onFail={onFail}
        onAccept={onAccept}
        onRetake={onRetake}
      />
    );
  }

  // ─────────── CAPTURE PHASE ──────────
  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={iconBoxStyle}>
          <Camera size={14} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={titleStyle}>{spec?.title || 'Take a photo'}</div>
          {spec?.description && (
            <div style={descStyle}>{spec.description}</div>
          )}
        </div>
      </div>

      {!localPreview && !resizing && (
        <div style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {showCamera && (
              <button
                type="button"
                disabled={busy}
                onClick={() => clickHidden(cameraInputRef)}
                style={primaryBtnStyle(busy)}
              >
                <Camera size={14} /> Take photo
              </button>
            )}
            {showUpload && (
              <button
                type="button"
                disabled={busy}
                onClick={() => clickHidden(uploadInputRef)}
                style={secondaryBtnStyle(busy)}
              >
                <Upload size={14} /> Upload
              </button>
            )}
          </div>
          {/* Hidden inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {localError && (
            <div style={errorBannerStyle}>
              <AlertTriangle size={12} /> {localError}
            </div>
          )}
        </div>
      )}

      {resizing && (
        <div style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 8, color: TEXT_SECONDARY, fontSize: 12 }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          Preparing photo…
        </div>
      )}

      {localPreview && !resizing && (
        <div style={{ padding: '10px 14px 12px' }}>
          <div style={{
            position: 'relative', borderRadius: 8, overflow: 'hidden',
            border: `1px solid ${NEUTRAL_BORDER}`, background: '#0F172A',
          }}>
            <img
              src={localPreview.dataUrl}
              alt="Photo preview"
              style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'contain' }}
            />
            {busy && (
              <div style={shimmerOverlayStyle}>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <div style={{ marginTop: 6, fontSize: 12 }}>Checking against criteria…</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={busy}
              onClick={submitForValidation}
              style={primaryBtnStyle(busy)}
            >
              <CheckCircle size={14} /> {spec?.submitLabel || 'Use this photo'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setLocalPreview(null)}
              style={secondaryBtnStyle(busy)}
            >
              <RotateCcw size={14} /> {spec?.retakeLabel || 'Retake'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewView({ spec, staged, busy, onFail, onAccept, onRetake }) {
  const v = staged.validation || {};
  const passed = !!v.passed;
  const anns = Array.isArray(v.annotations) ? v.annotations : [];
  const [hoverAnnId, setHoverAnnId] = useState(null);

  // The dispatch auto-advances on `passed` (or onFail=allow), so we only
  // render this view when validation failed under warn/block.
  // - warn  → let the employee continue anyway, or retake
  // - block → retake is the only option
  const showContinue = !passed && onFail === 'warn';
  const showRetake = true;

  const aspectRatio = staged.imageWidth && staged.imageHeight
    ? `${staged.imageWidth} / ${staged.imageHeight}`
    : '4 / 3';

  return (
    <div style={cardStyle}>
      <div style={{
        ...headerStyle,
        background: passed ? 'rgba(0,199,178,0.08)' : 'rgba(217,119,6,0.08)',
        borderBottom: `1px solid ${passed ? 'rgba(0,199,178,0.25)' : 'rgba(217,119,6,0.25)'}`,
      }}>
        <div style={{
          ...iconBoxStyle,
          background: passed ? STAFFBASE_TEAL : '#D97706',
        }}>
          {passed ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...titleStyle, color: passed ? STAFFBASE_TEAL_DEEP : '#92400E' }}>
            {passed ? 'Looks good' : 'Issues found'}
          </div>
          {v.summary && <div style={descStyle}>{v.summary}</div>}
        </div>
      </div>

      <div style={{ padding: '10px 14px 12px' }}>
        <div style={{
          position: 'relative', borderRadius: 8, overflow: 'hidden',
          border: `1px solid ${NEUTRAL_BORDER}`, background: '#0F172A',
          aspectRatio,
        }}>
          {staged.imageDataUrl ? (
            <img
              src={staged.imageDataUrl}
              alt="Submitted photo"
              style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: TEXT_MUTED, fontSize: 11, gap: 6,
            }}>
              <ImageIcon size={14} /> Image not available
            </div>
          )}
          {anns.length > 0 && staged.imageDataUrl && (
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                pointerEvents: 'none',
              }}
            >
              {anns.map((a) => {
                const color = severityColor(a.severity);
                const x = a.x * 100, y = a.y * 100, w = a.w * 100, h = a.h * 100;
                const dim = hoverAnnId && hoverAnnId !== a.id ? 0.3 : 1;
                return (
                  <g key={a.id} opacity={dim}>
                    <rect
                      x={x} y={y} width={w} height={h}
                      fill="none" stroke={color}
                      strokeWidth={0.6}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {Array.isArray(v.criteria) && v.criteria.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {v.criteria.map((c) => (
              <div
                key={c.id}
                onMouseEnter={() => {
                  const ann = anns.find((a) => a.id === c.id || a.label === c.label);
                  if (ann) setHoverAnnId(ann.id);
                }}
                onMouseLeave={() => setHoverAnnId(null)}
                style={{
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: c.passed ? 'rgba(0,199,178,0.06)' : 'rgba(220,38,38,0.06)',
                  border: `1px solid ${c.passed ? 'rgba(0,199,178,0.25)' : 'rgba(220,38,38,0.25)'}`,
                }}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: c.passed ? STAFFBASE_TEAL_DEEP : '#DC2626',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 1,
                }}>
                  {c.passed ? <CheckCircle size={9} /> : <AlertTriangle size={9} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: TEXT_PRIMARY }}>{c.label}</div>
                  {c.reason && (
                    <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 1 }}>{c.reason}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {showContinue && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAccept?.({ acceptedDespiteFail: true })}
              style={warningBtnStyle(busy)}
            >
              <AlertTriangle size={14} /> Continue anyway
            </button>
          )}
          {showRetake && (
            <button
              type="button"
              disabled={busy}
              onClick={onRetake}
              style={showContinue ? secondaryBtnStyle(busy) : primaryBtnStyle(busy)}
            >
              <RotateCcw size={14} /> {spec?.retakeLabel || 'Retake'}
            </button>
          )}
        </div>

        {v._error && (
          <div style={{ ...errorBannerStyle, marginTop: 8 }}>
            <AlertTriangle size={12} /> AI validation unavailable — please review the photo manually.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inline styles ─────────────────────────────────────────────────────────

const cardStyle = {
  margin: '4px 0',
  background: '#FFFFFF',
  border: `1px solid ${NEUTRAL_BORDER}`,
  borderRadius: 10,
  overflow: 'hidden',
};

const headerStyle = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '10px 14px',
  borderBottom: `1px solid ${NEUTRAL_BORDER}`,
  background: 'rgba(0,199,178,0.05)',
};

const iconBoxStyle = {
  width: 26, height: 26, borderRadius: 6,
  background: STAFFBASE_TEAL,
  color: 'white',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};

const titleStyle = {
  fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.3,
};

const descStyle = {
  fontSize: 11.5, color: TEXT_SECONDARY, marginTop: 2, lineHeight: 1.4,
};

function primaryBtnStyle(disabled) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 12px', borderRadius: 8,
    background: STAFFBASE_TEAL, color: 'white',
    fontSize: 12, fontWeight: 700, border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}
function secondaryBtnStyle(disabled) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 12px', borderRadius: 8,
    background: 'white', color: TEXT_PRIMARY,
    fontSize: 12, fontWeight: 600,
    border: `1px solid ${NEUTRAL_BORDER}`,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}
function warningBtnStyle(disabled) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 12px', borderRadius: 8,
    background: '#FEF3C7', color: '#92400E',
    fontSize: 12, fontWeight: 700,
    border: '1px solid #FCD34D',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

const errorBannerStyle = {
  display: 'flex', alignItems: 'center', gap: 6,
  marginTop: 8, padding: '6px 10px',
  background: 'rgba(220,38,38,0.06)',
  color: '#991B1B',
  border: '1px solid rgba(220,38,38,0.25)',
  borderRadius: 6,
  fontSize: 11.5,
};

const shimmerOverlayStyle = {
  position: 'absolute', inset: 0,
  background: 'rgba(15,23,42,0.55)',
  color: 'white',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
};
