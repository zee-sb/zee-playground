// PII redaction pass — runs over a transcript before it lands in the message
// table so high-confidence identifiers don't leak into chat history.
//
// Scope is intentionally narrow: we only redact patterns that have low false-
// positive risk (formatted SSNs, IBANs, credit-card numbers via Luhn, generic
// 9+ digit national IDs prefixed by an explicit keyword). We DO NOT try to
// catch names or addresses — those need NER and would butcher legitimate
// employee references like "tell John about the schedule".
//
// Output: { text, redactions: [{kind, start, end}] } where text has matches
// replaced with a token like [REDACTED_SSN].

const TOKEN = (kind) => `[REDACTED_${kind}]`;

// Luhn check (credit card).
function passesLuhn(digits) {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum > 0 && sum % 10 === 0;
}

// IBAN: ISO 13616 — 2 country letters, 2 check digits, up to 30 alphanumerics.
// We validate the mod-97 check rather than just shape matching.
function isValidIban(raw) {
  const s = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  const expanded = rearranged.replace(/[A-Z]/g, (c) => (c.charCodeAt(0) - 55).toString());
  // Mod-97 over big number — chunked to stay in JS int range.
  let rem = 0;
  for (let i = 0; i < expanded.length; i += 7) {
    rem = parseInt(String(rem) + expanded.slice(i, i + 7), 10) % 97;
  }
  return rem === 1;
}

const PATTERNS = [
  {
    kind: 'SSN',
    // US SSN: 3-2-4 with hyphens or spaces. Reject the well-known invalid
    // pattern 000-00-0000 and the 9-digit-no-separator case to avoid eating
    // tracking numbers.
    re: /\b(?!000)\d{3}[-\s]\d{2}[-\s]\d{4}\b/g,
    validate: (m) => m.replace(/[^\d]/g, '') !== '000000000',
  },
  {
    kind: 'CARD',
    // 13-19 digits, optionally separated by spaces or hyphens. Luhn-gated to
    // kill false positives on long order/tracking numbers.
    re: /\b(?:\d[ -]?){12,18}\d\b/g,
    validate: (m) => passesLuhn(m.replace(/[^\d]/g, '')),
  },
  {
    kind: 'IBAN',
    re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){10,30}\b/g,
    validate: isValidIban,
  },
  {
    kind: 'NATIONAL_ID',
    // Keyword-gated: only redact a long digit run when an obvious prefix
    // appears within 25 chars. Keeps us from butchering ticket numbers.
    re: /\b(?:national\s*id|personal\s*id|personalausweis|dni|passport\s*no\.?|passport\s*number|tax\s*id|nino|cpr)[^\d]{0,25}(\d[\d -]{6,18}\d)/gi,
    capture: 1,
  },
];

export function redactPII(text) {
  if (!text || typeof text !== 'string') return { text: text || '', redactions: [] };
  let working = text;
  const redactions = [];

  for (const pat of PATTERNS) {
    // Recompute against the latest working string each iteration so prior
    // redactions don't shift offsets in a way we'd have to track manually.
    working = working.replace(pat.re, (m, ...rest) => {
      const captured = pat.capture != null ? rest[pat.capture - 1] : m;
      if (pat.validate && !pat.validate(captured)) return m;
      redactions.push({ kind: pat.kind, length: m.length });
      if (pat.capture != null) {
        return m.replace(captured, TOKEN(pat.kind));
      }
      return TOKEN(pat.kind);
    });
  }

  return { text: working, redactions };
}
