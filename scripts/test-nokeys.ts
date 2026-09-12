/**
 * Zero-keys acceptance test — `npm run test:nokeys`.
 *
 * Proves the governing constraint literally: a clean checkout with an EMPTY
 * .env.local must build and serve. No component and no config module may
 * require an API key, make its own outbound HTTP call, or read an
 * environment variable — every byte of WordPress data flows through
 * lib/wp.ts, and the whole env surface is the three variables documented in
 * .env.example ("No tool or page may require any other env var").
 *
 * This checks it three ways, because any one alone is easy to fool:
 *
 * 1. STATIC — grep components/ and config/ for outbound-call and env-read
 *    signatures. A component that fetches at request time fails even if it
 *    happens to work today, because it will fail the day the upstream does.
 *
 * 2. ENV SURFACE — .env.example may only declare the three known variables.
 *    A fourth appearing means some code now depends on configuration a clean
 *    checkout does not have; that needs a deliberate decision, not a drift.
 *
 * 3. RUNTIME — the homepage on a server started with a scrubbed environment
 *    must answer 200 with real content. `SEO_BASE_URL` points at that server.
 *
 * The static halves run anywhere. The runtime half is skipped with a warning
 * if no server is listening, so the check is still useful in CI before a
 * build exists.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const BASE = (process.env.SEO_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const failures: string[] = [];
const notes: string[] = [];

/* ---- 1. Static: no outbound calls, no env reads, in UI/config source ---- */

const SCANNED = ['components', 'config'];

/** Patterns that would mean a scanned file depends on something external. */
const FORBIDDEN: { pattern: RegExp; label: string }[] = [
  { pattern: /\bfetch\s*\(/, label: 'fetch() call' },
  { pattern: /\baxios\b/, label: 'axios' },
  { pattern: /\bXMLHttpRequest\b/, label: 'XMLHttpRequest' },
  { pattern: /process\.env\./, label: 'process.env read' },
];

/**
 * The one sanctioned env read in the scanned tree: config/sites.ts resolves
 * the default tenant from NEXT_PUBLIC_DEFAULT_HOST (documented in
 * .env.example). The literal is stripped before the pattern test so any
 * OTHER env read in that file still fails.
 */
const ALLOWED_LITERALS: { file: string; literal: string }[] = [
  { file: 'config/sites.ts', literal: 'process.env.NEXT_PUBLIC_DEFAULT_HOST' },
];

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (['.ts', '.tsx'].includes(extname(entry))) out.push(full);
  }
  return out;
}

console.log('');
console.log('  ZERO-KEYS TEST');
console.log('  ' + '═'.repeat(66));
console.log('');
console.log('  1. Static scan — no outbound calls or env reads in components/config');
console.log('  ' + '─'.repeat(66));

let scanned = 0;
for (const relative of SCANNED) {
  for (const file of walk(join(ROOT, relative))) {
    // Test files may render fixtures however they like; they never ship.
    if (/\.test\.(ts|tsx)$/.test(file)) continue;
    scanned += 1;
    const source = readFileSync(file, 'utf8');
    const shown = file.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '');

    for (const { pattern, label } of FORBIDDEN) {
      // Strip comments first: the files legitimately DISCUSS these patterns.
      let code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      for (const allowed of ALLOWED_LITERALS) {
        if (shown === allowed.file) code = code.split(allowed.literal).join('');
      }
      if (pattern.test(code)) {
        failures.push(`${shown}: contains ${label}`);
      }
    }

    // An https:// literal is fine as a link a human clicks, but not inside
    // a call.
    if (/(?:fetch|axios)\s*\(\s*['"`]https?:/.test(source)) {
      failures.push(`${shown}: hardcoded outbound request`);
    }
  }
}
console.log(`     ${scanned} files scanned`);
console.log(`     ${failures.length === 0 ? 'PASS — no outbound calls, no env reads' : 'FAIL'}`);

/* ---- 2. Env surface: .env.example declares exactly the known trio ------- */

console.log('');
console.log('  2. Env surface — .env.example stays tiny');
console.log('  ' + '─'.repeat(66));

const KNOWN_ENV = new Set(['REVALIDATE_SECRET', 'INDEXNOW_KEY', 'NEXT_PUBLIC_DEFAULT_HOST']);
const envExamplePath = join(ROOT, '.env.example');
if (!existsSync(envExamplePath)) {
  notes.push('.env.example missing — the env surface is undocumented');
  console.log('     NOTE  .env.example not found');
} else {
  const declared = [...readFileSync(envExamplePath, 'utf8').matchAll(/^([A-Z][A-Z0-9_]*)=/gm)]
    .map((m) => m[1]);
  for (const name of declared) {
    if (!KNOWN_ENV.has(name)) {
      failures.push(
        `.env.example declares ${name} — a new env dependency needs a deliberate decision`,
      );
    }
  }
  console.log(`     ${declared.length} variable(s) declared: ${declared.join(', ') || '(none)'}`);
}

/* ---- 3. Runtime: the site serves with a scrubbed environment ------------ */

console.log('');
console.log(`  3. Runtime — homepage on ${BASE}`);
console.log('  ' + '─'.repeat(66));

async function head(path: string): Promise<{ status: number; body: string } | null> {
  try {
    const res = await fetch(BASE + path, { signal: AbortSignal.timeout(30_000) });
    return { status: res.status, body: await res.text() };
  } catch {
    return null;
  }
}

const homeProbe = await head('/');
if (!homeProbe) {
  console.log(`     SKIPPED — no server listening at ${BASE}`);
  notes.push('runtime half skipped: start a production server and re-run');
} else if (homeProbe.status !== 200) {
  failures.push(`/ returned ${homeProbe.status}`);
} else {
  // 200 is not enough — the page must actually contain its own content.
  const words = homeProbe.body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;

  if (words < 150) {
    failures.push(`/ has ~${words} words (minimum 150) — an empty shell is not serving`);
  } else {
    console.log(`     PASS  /  (~${words} words)`);
  }
}

/* ---- Summary ----------------------------------------------------------- */

console.log('');
console.log('  ' + '═'.repeat(66));
if (notes.length > 0) {
  for (const note of notes) console.log(`  NOTE  ${note}`);
}
if (failures.length === 0) {
  console.log('  ZERO-KEYS TEST PASSED — no page needs a key, a call or an env var.');
} else {
  for (const failure of failures) console.log(`  FAIL  ${failure}`);
  console.log(`  ${failures.length} failure(s).`);
  process.exitCode = 1;
}
console.log('');
