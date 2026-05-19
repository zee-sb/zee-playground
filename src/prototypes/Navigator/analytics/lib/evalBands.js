// Maps a 0..1 evaluator score to a coloured band. Higher-is-worse dimensions
// (hallucination, friction) invert.

const INVERTED = new Set(['hallucination', 'friction']);

const BAND_COLORS = {
  good: { fg: '#16A34A', bg: '#ECFDF5', border: '#A7F3D0' },
  warn: { fg: '#B45309', bg: '#FEF3C7', border: '#FCD34D' },
  poor: { fg: '#B91C1C', bg: '#FEE2E2', border: '#FCA5A5' },
  na:   { fg: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' },
};

export function scoreToBand(dimension, value) {
  if (value == null || !Number.isFinite(value)) return 'na';
  const v = INVERTED.has(dimension) ? 1 - value : value;
  if (v >= 0.75) return 'good';
  if (v >= 0.5)  return 'warn';
  return 'poor';
}

export function bandColors(band) {
  return BAND_COLORS[band] || BAND_COLORS.na;
}

export function asPercent(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}`;
}

// Friendly labels for the 11 evaluator dimensions.
const LABELS = {
  resolution: 'Resolution',
  hallucination: 'Hallucination',
  factual_accuracy: 'Factual accuracy',
  friction: 'Friction',
  sentiment: 'Sentiment',
  prompt_injection_resistance: 'Prompt-injection resistance',
  memory_extraction_safety: 'Memory-extraction safety',
  language_switch_flag: 'Language switch',
  repeated_question_count: 'Repeated questions',
  response_latency_score: 'Response latency',
  primary_topic_id: 'Primary topic',
};

export function dimensionLabel(dim) {
  return LABELS[dim] || dim;
}

export function isInverted(dim) {
  return INVERTED.has(dim);
}
