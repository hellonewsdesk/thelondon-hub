/**
 * IndexNow key files — runs automatically before every build (`prebuild`).
 *
 * IndexNow proves ownership by fetching https://<host>/<key>.txt and checking
 * it contains the key. The filename IS the key, so this cannot be a Next
 * route handler: the App Router only treats a whole path segment as dynamic,
 * and a folder called `[key].txt` is a literal string, not a parameter.
 * (Same constraint that forced /sitemap-posts/<n>/ over sitemap-posts-<n>.xml.)
 *
 * So the files are generated into public/ instead — one per registered site,
 * derived from the hostname. Adding site 16 needs no action here: the next
 * build writes its key file automatically.
 *
 * These are not secrets. The whole mechanism depends on them being publicly
 * readable.
 */

import { allSites } from '../config/sites.ts';
import { indexNowKey } from '../lib/indexnow.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');
mkdirSync(publicDir, { recursive: true });

for (const site of allSites()) {
  const key = indexNowKey(site);
  writeFileSync(join(publicDir, `${key}.txt`), key);
  console.log(`  indexnow: public/${key}.txt  (${site.hostname})`);
}
