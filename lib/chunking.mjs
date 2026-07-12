// Markdown-aware chunking for the knowledge index.
//
// KB docs and Campsite pages are short and section-structured, so we split on
// `##` headers first (each section is a coherent retrieval unit), then
// length-wrap any section that's still too long. Overlap carries a little
// context across a wrap boundary so a chunk cut mid-thought still retrieves.

const TARGET_CHARS = 900;
const OVERLAP_CHARS = 120;
const MIN_CHARS = 40; // drop trivial fragments (a lone header, etc.)

// Split raw text into ~TARGET_CHARS windows on sentence/paragraph boundaries
// where possible, with OVERLAP_CHARS of trailing context repeated.
function windowText(text) {
  const clean = String(text || '').trim();
  if (clean.length <= TARGET_CHARS) return clean ? [clean] : [];
  const out = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + TARGET_CHARS, clean.length);
    if (end < clean.length) {
      // Prefer to break at a paragraph, then a sentence, then a space.
      const slice = clean.slice(start, end);
      const para = slice.lastIndexOf('\n\n');
      const sent = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('.\n'));
      const space = slice.lastIndexOf(' ');
      const breakAt = para > TARGET_CHARS * 0.5 ? para
        : sent > TARGET_CHARS * 0.5 ? sent + 1
        : space > TARGET_CHARS * 0.5 ? space
        : -1;
      if (breakAt > 0) end = start + breakAt;
    }
    const piece = clean.slice(start, end).trim();
    if (piece.length >= MIN_CHARS || out.length === 0) out.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - OVERLAP_CHARS, start + 1);
  }
  return out;
}

// Turn one document into ordered chunks. Each returned chunk is a plain string;
// the caller pairs it with doc metadata + a chunk index.
//
// `body` is markdown. We keep the section header line prepended to each chunk
// of that section so an embedded/retrieved fragment carries its own topic.
export function chunkDocument(body) {
  const text = String(body || '').trim();
  if (!text) return [];

  // Split on `##`/`###` headers, keeping the header with its section.
  const sections = [];
  const lines = text.split('\n');
  let current = { header: '', buf: [] };
  for (const line of lines) {
    if (/^#{2,6}\s+/.test(line)) {
      if (current.buf.length || current.header) sections.push(current);
      current = { header: line.replace(/^#{2,6}\s+/, '').trim(), buf: [] };
    } else {
      current.buf.push(line);
    }
  }
  if (current.buf.length || current.header) sections.push(current);

  const chunks = [];
  for (const sec of sections) {
    const sectionText = sec.buf.join('\n').trim();
    if (!sectionText && !sec.header) continue;
    const windows = windowText(sectionText);
    if (!windows.length && sec.header) {
      // header-only section — still index it so the topic is findable
      chunks.push(sec.header);
      continue;
    }
    for (const w of windows) {
      chunks.push(sec.header ? `${sec.header}\n${w}` : w);
    }
  }

  // Fallback: a doc with no headers still needs to be windowed.
  if (!chunks.length) return windowText(text);
  return chunks;
}
