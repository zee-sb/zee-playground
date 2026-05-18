import React, { useMemo } from 'react';
import { Sparkles, ArrowUpRight, Workflow, MapPin } from 'lucide-react';
import { BRAND } from './lib/tokens.js';

// Greeting copy by local hour. Pure presentation — no localisation yet.
function timeGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good evening';
}

// Tile palettes — three soft surface treatments so the three primary tiles
// have distinct identity at a glance without screaming for attention.
const TILE_PALETTES = [
  { bg: '#EEF6FF', border: 'rgba(59, 130, 246, 0.18)', icon: '#2563EB', iconBg: 'rgba(37, 99, 235, 0.12)' },
  { bg: '#ECFDF7', border: 'rgba(0, 199, 178, 0.22)', icon: '#00736A', iconBg: 'rgba(0, 199, 178, 0.14)' },
  { bg: '#F5F0FF', border: 'rgba(124, 58, 237, 0.18)', icon: '#7C3AED', iconBg: 'rgba(124, 58, 237, 0.12)' },
];

// Turn a Studio entry (assistant or flow) into a tile descriptor. The first
// sample prompt becomes the tile's call-to-action; if Studio didn't seed one
// we fall back to a benign "Help me with X" prompt that still routes the
// orchestrator into the right context.
function asTile(entry, kind) {
  const icon = entry.icon || (kind === 'flow' ? '▶' : '✦');
  const title = entry.name || (kind === 'flow' ? 'Flow' : 'Assistant');
  let prompt;
  let sample;
  if (kind === 'flow') {
    prompt = entry.goal ? `I want to start the ${title} flow — ${entry.goal}` : `Start: ${title}`;
    sample = entry.goal || `Let's run the ${title} flow.`;
  } else {
    prompt = entry.description
      ? `Help me with ${title.toLowerCase()} — ${entry.description.toLowerCase()}`
      : `Help me with something for the ${title}.`;
    sample = entry.description || `Ask the ${title} anything.`;
  }
  return { kind, icon, title, prompt, sample };
}

export default function DesktopHero({ user, heroData, onPick }) {
  const callMe = user?.customFields?.callme;
  const firstName = (callMe || user?.displayName || '').split(' ')[0] || 'there';
  const role = user?.title || 'Staffbase teammate';
  const location = user?.location || user?.department || null;

  // Tile composition: prefer the first 3 Studio-configured experts/workflows.
  // Experts come first so the persistent Navigator presence is what users
  // see; workflows fill in if there aren't enough experts. If Studio is empty
  // we still surface three generic tiles so the canvas never looks broken.
  const { tiles, chips, assistantCount, flowCount, studioEmpty } = useMemo(() => {
    // Accept both new (experts/workflows) and legacy (assistants/flows) shapes
    // so an older API response doesn't break the canvas during rollout.
    const experts = heroData?.experts || heroData?.assistants || [];
    const workflows = heroData?.workflows || heroData?.flows || [];
    const candidates = [
      ...experts.map((a) => asTile(a, 'assistant')),
      ...workflows.map((f) => asTile(f, 'flow')),
    ];

    if (candidates.length === 0) {
      return {
        tiles: [
          { kind: 'fallback', icon: '✦', title: 'Ask Navigator', prompt: 'What can you do?', sample: "I'll explain what I can help with today." },
          { kind: 'fallback', icon: '📋', title: 'Today at a glance', prompt: "What's happening at Staffbase today?", sample: 'Latest posts and notifications.' },
          { kind: 'fallback', icon: '🔍', title: 'Find something', prompt: 'Help me find a doc or person.', sample: 'Search intranet, HR, and IT.' },
        ],
        chips: [],
        assistantCount: 0,
        flowCount: 0,
        studioEmpty: true,
      };
    }

    return {
      tiles: candidates.slice(0, 3),
      chips: candidates.slice(3, 9),
      assistantCount: experts.length,
      flowCount: workflows.length,
      studioEmpty: false,
    };
  }, [heroData]);

  const footprintParts = [];
  if (assistantCount > 0) {
    footprintParts.push(`${assistantCount} ${assistantCount === 1 ? 'expert' : 'experts'} ready`);
  }
  if (flowCount > 0) {
    footprintParts.push(`${flowCount} ${flowCount === 1 ? 'workflow' : 'workflows'} available`);
  }
  if (footprintParts.length === 0) {
    footprintParts.push('Connected to your Staffbase intranet');
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      padding: '48px 32px 24px', minHeight: 0,
    }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        maxWidth: 820, margin: '0 auto', width: '100%',
      }}>
        {/* Greeting block ------------------------------------------------ */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 11px', borderRadius: 999,
            background: BRAND.tealSoft, color: BRAND.tealDeep,
            fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
            marginBottom: 18,
            border: `1px solid ${BRAND.teal}33`,
          }}>
            <Sparkles size={11} />
            Navigator
          </div>
          <div style={{
            fontSize: 40, fontWeight: 700, color: BRAND.ink,
            letterSpacing: '-1.2px', lineHeight: 1.1, marginBottom: 10,
          }}>
            {timeGreeting()}, {firstName}
          </div>
          <div style={{
            fontSize: 14, color: BRAND.muted, lineHeight: 1.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexWrap: 'wrap', gap: 8,
          }}>
            <span style={{ color: BRAND.inkSoft, fontWeight: 500 }}>{role}</span>
            {location && (
              <>
                <span style={{ color: BRAND.mutedSoft }}>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={12} /> {location}
                </span>
              </>
            )}
            <span style={{ color: BRAND.mutedSoft }}>·</span>
            <span style={{ color: BRAND.muted }}>{footprintParts.join(' · ')}</span>
          </div>
        </div>

        {/* Tile grid ----------------------------------------------------- */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14,
          width: '100%', marginBottom: 18,
        }}>
          {tiles.map((tile, i) => {
            const palette = TILE_PALETTES[i % TILE_PALETTES.length];
            const Icon = tile.kind === 'flow' ? Workflow : Sparkles;
            return (
              <button
                key={`${tile.kind}-${tile.title}-${i}`}
                onClick={() => onPick(tile.prompt)}
                style={{
                  textAlign: 'left', cursor: 'pointer',
                  padding: '16px 18px', borderRadius: 16,
                  background: palette.bg,
                  border: `1px solid ${palette.border}`,
                  display: 'flex', flexDirection: 'column', gap: 10,
                  minHeight: 140,
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
                  position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 10px 28px rgba(15,23,42,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: palette.iconBg, color: palette.icon,
                    display: 'grid', placeItems: 'center',
                    fontSize: 16,
                  }}>
                    {typeof tile.icon === 'string' && /^\p{Emoji}/u.test(tile.icon)
                      ? <span style={{ fontSize: 18, lineHeight: 1 }}>{tile.icon}</span>
                      : <Icon size={16} />}
                  </div>
                  <ArrowUpRight size={14} color={palette.icon} style={{ opacity: 0.6 }} />
                </div>
                <div>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: BRAND.ink,
                    marginBottom: 4, letterSpacing: '-0.1px',
                  }}>
                    {tile.title}
                  </div>
                  <div style={{
                    fontSize: 12.5, color: BRAND.muted, lineHeight: 1.45,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {tile.sample}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Quick-prompt chip row ----------------------------------------- */}
        {chips.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 7,
            justifyContent: 'center', maxWidth: 720,
          }}>
            {chips.map((chip, i) => (
              <button
                key={`chip-${chip.title}-${i}`}
                onClick={() => onPick(chip.prompt)}
                style={{
                  padding: '7px 12px', borderRadius: 999,
                  background: BRAND.surface, color: BRAND.inkSoft,
                  border: `1px solid ${BRAND.hairline}`,
                  fontSize: 12, fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  transition: 'border-color 0.15s ease, color 0.15s ease, background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = BRAND.teal + '66';
                  e.currentTarget.style.color = BRAND.tealDeep;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = BRAND.hairline;
                  e.currentTarget.style.color = BRAND.inkSoft;
                }}
              >
                <span style={{ opacity: 0.7 }}>{chip.kind === 'flow' ? '▶' : '✦'}</span>
                {chip.title}
              </button>
            ))}
          </div>
        )}

        {studioEmpty && (
          <div style={{
            marginTop: 18, padding: '10px 14px', borderRadius: 12,
            background: BRAND.surfaceMuted, border: `1px dashed ${BRAND.hairline}`,
            fontSize: 12, color: BRAND.muted, textAlign: 'center', maxWidth: 540,
          }}>
            No experts or workflows configured yet — visit Studio to wire up Navigator for this workspace.
          </div>
        )}
      </div>
    </div>
  );
}
