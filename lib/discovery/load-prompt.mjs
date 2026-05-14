// Discovery prompt loader. Identical pattern to lib/orchestrator/load-prompt.mjs.
// Prompts live in lib/discovery/prompts/*.txt; mustache-style {{placeholders}}
// are substituted at runtime; file contents cached per-process.

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
