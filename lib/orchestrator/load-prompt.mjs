// Load and interpolate a versioned prompt file.
//
// Prompts live in lib/orchestrator/prompts/*.txt with Mustache-style
// {{placeholder}} tokens. This loader reads them at runtime and substitutes
// values, so prompt edits do not require a code change.
//
// We cache file contents per-process so we don't re-read on every turn.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PROMPT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'prompts');
const CACHE = new Map();

function readPrompt(name) {
  if (CACHE.has(name)) return CACHE.get(name);
  const text = readFileSync(join(PROMPT_DIR, `${name}.txt`), 'utf8');
  CACHE.set(name, text);
  return text;
}

export function loadPrompt(name, vars = {}) {
  const template = readPrompt(name);
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key in vars) return String(vars[key]);
    return `{{${key}}}`;
  });
}
