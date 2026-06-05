#!/usr/bin/env node
// scripts/search-terms-analysis.mjs
//
// Pulls the last 3 months of Campsite search terms from the Staffbase
// Analytics API, MERGES near-duplicate terms, CLASSIFIES them into intent
// categories, and writes three artifacts back into the repo:
//
//   data/search-terms.raw.json   ← exact rows the API returned (audit trail)
//   data/search-terms.csv        ← merged term | count | category (open in Excel)
//   outputs/search-terms-report.md ← human-readable analysis
//
// WHY THIS RUNS LOCALLY: the Cowork sandbox can't reach campsite.staffbase.com
// (network allowlist). Your machine can — the Navigator app already calls it.
//
// Run from the repo root:
//   node scripts/search-terms-analysis.mjs
//
// Credentials are read from .env.local / .vercel/.env.development.local
// (STAFFBASE_API_BASE, STAFFBASE_API_TOKEN) — no extra setup needed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Load env from the files that already hold the prod read token ────────────
function loadEnv() {
  const files = ['.env.local', '.vercel/.env.development.local', '.env'];
  const env = {};
  for (const f of files) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(m[1] in env)) env[m[1]] = v;
    }
  }
  return env;
}

const env = loadEnv();
const BASE = process.env.STAFFBASE_API_BASE || env.STAFFBASE_API_BASE || 'https://campsite.staffbase.com/api';
const TOKEN = process.env.STAFFBASE_API_TOKEN || env.STAFFBASE_API_TOKEN || '';
if (!TOKEN) {
  console.error('✗ No STAFFBASE_API_TOKEN found in .env.local / .vercel/.env.development.local');
  process.exit(1);
}
const AUTH = { Authorization: `Basic ${TOKEN}`, Accept: 'application/json' };

// ── Date window: last 3 months ───────────────────────────────────────────────
const UNTIL = new Date();
const SINCE = new Date(UNTIL.getTime());
SINCE.setMonth(SINCE.getMonth() - 3);
const sinceIso = SINCE.toISOString();
const untilIso = UNTIL.toISOString();
const TZ = 'Europe/Berlin';

async function tryGet(pathname, params) {
  const url = new URL(`${BASE}${pathname}`);
  for (const [k, v] of Object.entries(params || {})) if (v != null) url.searchParams.set(k, String(v));
  try {
    const res = await fetch(url.toString(), { headers: AUTH });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { ok: res.ok, status: res.status, json, text, url: url.toString() };
  } catch (e) {
    return { ok: false, status: 0, error: e.message, url: url.toString() };
  }
}

// Pull every term-like row out of whatever shape the endpoint returns.
function extractRows(json) {
  if (!json) return [];
  const candidates = json.data || json.results || json.rankings || json.terms ||
                     json.entries || json.items || (Array.isArray(json) ? json : []);
  const rows = [];
  for (const r of candidates) {
    if (r == null) continue;
    const term = r.term ?? r.query ?? r.searchTerm ?? r.text ?? r.name ?? r.value ??
                 r.label ?? (typeof r === 'string' ? r : null);
    if (!term) continue;
    const count = Number(
      r.count ?? r.searches ?? r.total ?? r.hits ?? r.value ?? r.frequency ?? r.occurrences ?? 1
    ) || 0;
    const results = r.resultCount ?? r.results ?? r.numResults ?? r.matches ?? null;
    rows.push({ term: String(term), count, results: results == null ? null : Number(results) });
  }
  return rows;
}

// ── Endpoint discovery — Staffbase analytics lives under /branch/analytics/* ──
const COMMON = { since: sinceIso, until: untilIso, timezone: TZ, format: 'json', limit: 50000 };
const CANDIDATES = [
  ['/branch/analytics/search/rankings', COMMON],
  ['/branch/analytics/searches/rankings', COMMON],
  ['/branch/analytics/search/terms/rankings', COMMON],
  ['/branch/analytics/searchterms/rankings', COMMON],
  ['/branch/analytics/search/terms', COMMON],
  ['/branch/analytics/v2/search/rankings', COMMON],
  ['/branch/analytics/search/queries/rankings', COMMON],
  ['/branch/analytics/queries/rankings', COMMON],
  ['/branch/analytics/search', COMMON],
];

async function discover() {
  console.log(`→ Window: ${sinceIso.slice(0, 10)} … ${untilIso.slice(0, 10)} (TZ ${TZ})`);
  console.log(`→ Base:   ${BASE}\n→ Probing search-analytics endpoints:`);
  for (const [p, params] of CANDIDATES) {
    const r = await tryGet(p, params);
    const rows = r.ok ? extractRows(r.json) : [];
    console.log(`   [${r.status}] ${p}${r.ok ? `  → ${rows.length} rows` : ''}`);
    if (r.ok && rows.length) return { endpoint: p, params, rows, raw: r.json };
    // Some tenants return 200 with an empty body for the wrong path; keep going.
  }
  return null;
}

// ── Merge near-duplicate terms ────────────────────────────────────────────────
function normalize(t) {
  return t
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')                 // punctuation → space
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/s\b/g, (m, i, s) => (s.length > 4 ? '' : m)); // light plural→singular
}

function merge(rows) {
  const byKey = new Map();
  for (const { term, count, results } of rows) {
    const key = normalize(term);
    if (!key) continue;
    const e = byKey.get(key) || { display: term, count: 0, variants: new Set(), results: [] };
    e.count += count;
    e.variants.add(term);
    if (results != null) e.results.push(results);
    // keep the most frequent surface form as the display label
    if (count > (e._top || 0)) { e.display = term; e._top = count; }
    byKey.set(key, e);
  }
  return [...byKey.entries()]
    .map(([key, e]) => ({
      key,
      term: e.display,
      count: e.count,
      variants: [...e.variants],
      avgResults: e.results.length ? e.results.reduce((a, b) => a + b, 0) / e.results.length : null,
    }))
    .sort((a, b) => b.count - a.count);
}

// ── Classify into intent categories (intranet-tuned, deterministic) ───────────
const CATEGORIES = [
  ['HR & Benefits',        /\b(vacation|holiday|pto|leave|sick|absence|benefit|insurance|pension|maternity|parental|payslip|payroll|salary|bonus|compensation|sabbatical|urlaub|gehalt|lohn|krank)\b/],
  ['IT & Access',          /\b(vpn|password|reset|login|sso|wifi|laptop|hardware|software|install|access|account|2fa|mfa|okta|email setup|printer|jira|confluence|slack|zoom|outlook|teams|it support|ticket)\b/],
  ['People & Directory',   /\b(who is|contact|phone|email of|org chart|team|manager|reports to|directory|find .* (person|colleague)|profile)\b/],
  ['Policies & Compliance',/\b(policy|policies|guideline|compliance|gdpr|nda|code of conduct|handbook|regulation|legal|security policy|data protection|datenschutz|richtlinie)\b/],
  ['Payroll & Finance',    /\b(expense|reimburse|invoice|budget|finance|travel cost|spesen|reisekosten|tax|steuer|iban|bank details)\b/],
  ['Facilities & Office',  /\b(office|desk|booking|room|parking|canteen|cafeteria|building|badge|access card|address|location|floor|kitchen|büro|parkplatz)\b/],
  ['Onboarding & Training',/\b(onboard|training|course|learning|certification|new hire|first day|mentor|buddy|e-?learning|schulung|einarbeitung)\b/],
  ['Travel',               /\b(travel|flight|hotel|trip|booking travel|per diem|mileage|reise|dienstreise)\b/],
  ['Tools & Software',     /\b(tool|app|system|portal|dashboard|how to use|guide|manual|setup|configure)\b/],
  ['News & Events',        /\b(news|event|town ?hall|all ?hands|webinar|announcement|meetup|holiday party|celebration|veranstaltung)\b/],
  ['Org & Strategy',       /\b(strategy|roadmap|okr|kpi|goals|mission|vision|reorg|restructure|leadership|ceo|cfo|board)\b/],
];

function classify(term) {
  const t = ` ${term.toLowerCase()} `;
  for (const [name, re] of CATEGORIES) if (re.test(t)) return name;
  return 'Other / Uncategorized';
}

// ── Build report ──────────────────────────────────────────────────────────────
function buildReport(merged, endpoint, totalRaw) {
  const totalSearches = merged.reduce((a, t) => a + t.count, 0);
  const byCat = new Map();
  for (const t of merged) {
    const c = classify(t.term);
    const e = byCat.get(c) || { count: 0, unique: 0, top: [] };
    e.count += t.count; e.unique += 1; e.top.push(t);
    byCat.set(c, e);
  }
  const cats = [...byCat.entries()].sort((a, b) => b[1].count - a[1].count);

  const zeroResult = merged.filter(t => t.avgResults != null && t.avgResults < 0.5);

  let md = `# Campsite Search-Term Analysis\n\n`;
  md += `**Window:** ${sinceIso.slice(0, 10)} – ${untilIso.slice(0, 10)} (last 3 months)\n`;
  md += `**Source:** Staffbase Analytics API \`${endpoint}\`\n`;
  md += `**Totals:** ${totalSearches.toLocaleString()} searches · ${merged.length.toLocaleString()} unique terms (after merge) · ${totalRaw.toLocaleString()} raw rows\n\n`;

  md += `## Categories (by search volume)\n\n`;
  md += `| Category | Searches | % | Unique terms |\n|---|--:|--:|--:|\n`;
  for (const [name, e] of cats) {
    md += `| ${name} | ${e.count.toLocaleString()} | ${(100 * e.count / totalSearches).toFixed(1)}% | ${e.unique} |\n`;
  }

  md += `\n## Top 30 terms\n\n| # | Term | Searches | Category |\n|--:|---|--:|---|\n`;
  merged.slice(0, 30).forEach((t, i) => {
    md += `| ${i + 1} | ${t.term} | ${t.count.toLocaleString()} | ${classify(t.term)} |\n`;
  });

  md += `\n## Top terms per category\n\n`;
  for (const [name, e] of cats) {
    const top = e.top.slice(0, 8).map(t => `${t.term} (${t.count})`).join(', ');
    md += `**${name}** — ${top}\n\n`;
  }

  if (zeroResult.length) {
    md += `## ⚠️ Likely zero/low-result searches (content gaps)\n\n`;
    md += `Terms where the API reported few/no matching results — candidates for new content or better tagging:\n\n`;
    zeroResult.slice(0, 25).forEach(t => { md += `- ${t.term} (${t.count} searches)\n`; });
    md += `\n`;
  }

  return md;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const found = await discover();
  if (!found) {
    console.error('\n✗ No search-analytics endpoint returned data. Paste the list above to Claude');
    console.error('  so the candidate paths can be adjusted for this tenant.');
    process.exit(2);
  }
  console.log(`\n✓ Using ${found.endpoint} — ${found.rows.length} raw rows`);

  const merged = merge(found.rows);
  const report = buildReport(merged, found.endpoint, found.rows.length);

  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  fs.mkdirSync(path.join(ROOT, 'outputs'), { recursive: true });

  fs.writeFileSync(path.join(ROOT, 'data/search-terms.raw.json'),
    JSON.stringify({ endpoint: found.endpoint, since: sinceIso, until: untilIso, rows: found.rows }, null, 2));

  const csv = ['term,count,category,variants',
    ...merged.map(t => `"${t.term.replace(/"/g, '""')}",${t.count},"${classify(t.term)}","${t.variants.join('; ').replace(/"/g, '""')}"`)
  ].join('\n');
  fs.writeFileSync(path.join(ROOT, 'data/search-terms.csv'), csv);

  fs.writeFileSync(path.join(ROOT, 'outputs/search-terms-report.md'), report);

  console.log(`\n✓ Wrote:`);
  console.log(`   data/search-terms.raw.json   (${found.rows.length} rows)`);
  console.log(`   data/search-terms.csv        (${merged.length} merged terms)`);
  console.log(`   outputs/search-terms-report.md`);
  console.log(`\nNext: tell Claude it's done — it'll read data/search-terms.raw.json and refine the analysis.`);
})();
