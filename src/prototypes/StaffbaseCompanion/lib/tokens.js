// Shared brand tokens for the Staffbase Companion desktop redesign.
// Existing inline styles in older components are left untouched — these
// tokens are picked up by the new desktop surfaces (DesktopHero,
// InspectorDock, DesktopHeaderStrip, DesktopSidebar) so brand changes
// land in one place.

export const BRAND = {
  // Staffbase identity
  teal: '#00C7B2',
  tealDeep: '#00736A',
  tealSoft: 'rgba(0, 199, 178, 0.10)',

  // Neutral surfaces
  bg: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceMuted: '#FAFAFB',

  // Ink scale
  ink: '#0F172A',
  inkSoft: '#1F2937',
  muted: '#6B7280',
  mutedSoft: '#94A3B8',
  hairline: 'rgba(15, 23, 42, 0.08)',
  hairlineSoft: 'rgba(15, 23, 42, 0.04)',

  // Assistant identity (legacy purple — kept for avatar / assistant chrome)
  assistant: '#7C3AED',
  assistantSoft: 'rgba(124, 58, 237, 0.10)',
};
