// Helpers for migrating tools to the canonical ToolResult envelope.
//
// Use these in lib/mcp-servers/*.mjs as we wrap each tool. The migration is
// incremental: a tool can return either shape and the orchestrator handles
// both. New tools should return an envelope directly; legacy tools get
// adapted in place.

/** @typedef {import('./types.mjs').ToolResult} ToolResult */

/**
 * Detect whether a value already looks like a ToolResult envelope.
 * The minimum check: it's an object with `summary` (string) and `data` present.
 */
export function isEnvelope(value) {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof value.summary === 'string' &&
    'data' in value
  );
}

/**
 * Adapt a plain tool result into a ToolResult envelope.
 *
 *   wrapResult({ summary: '3 posts found', data: posts })
 *   wrapResult({ summary, data, presentation: [{ kind: 'post-list', props: { posts } }] })
 *
 * If `value` is already an envelope, returns it unchanged.
 *
 * @param {object} value
 * @returns {ToolResult}
 */
export function wrapResult(value) {
  if (isEnvelope(value)) return value;
  // Legacy Staffbase shape: { summary, chart?, cards?, raw }
  if (value && typeof value === 'object' && typeof value.summary === 'string' && 'raw' in value) {
    return migrateLegacyStaffbaseShape(value);
  }
  // Fallback: wrap an opaque value.
  return {
    summary: typeof value === 'string' ? value : 'Result',
    data: value,
  };
}

/**
 * Migrate the legacy {summary, chart?, cards?, raw} shape used by Staffbase
 * tools today. The chart/cards fields become PresentationHints; `raw` is
 * the canonical data.
 */
export function migrateLegacyStaffbaseShape(legacy) {
  /** @type {ToolResult} */
  const result = {
    summary: legacy.summary,
    data: legacy.raw,
  };
  /** @type {import('./types.mjs').PresentationHint[]} */
  const presentation = [];
  if (legacy.chart) {
    presentation.push({ kind: 'chart', props: legacy.chart });
  }
  if (legacy.cards) {
    // The current `cards` is itself { type, ...props } — its `type` becomes
    // the registry `kind`, the rest become props.
    const { type, ...props } = legacy.cards;
    if (type) presentation.push({ kind: type, props });
  }
  if (presentation.length) result.presentation = presentation;
  return result;
}
