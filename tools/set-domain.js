#!/usr/bin/env node
//
// Point the whole site at a new address.
//
//   node tools/set-domain.js https://www.srisatyanarayananursery.in
//   node tools/set-domain.js --check          (report drift, change nothing)
//
// data/site-config.js calls itself the one place to change when the site moves,
// and it is — for everything the admin panel regenerates (the plant pages,
// plants/index.html, sitemap.xml, robots.txt). It is not true for index.html,
// whose canonical, og: tags and GardenStore JSON-LD are written by hand and
// which no build step rewrites.
//
// Those tags cannot simply be filled in by JavaScript at runtime: WhatsApp,
// Facebook and other link scrapers read og: tags out of the raw HTML without
// ever running scripts, so a JS-injected URL reaches them as the old domain.
// They have to be correct in the file on disk. Hence this script.
//
// It rewrites every occurrence of the current base address across the repo's
// text files, so nothing is left pointing at the old host whether or not the
// admin republishes afterwards.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = path.join(ROOT, 'data', 'site-config.js');

// Anything that can hold the address. Binary assets are skipped, as are the
// git directory and the photo folders. tools/ is skipped because it is build
// tooling rather than deployed content — and because this script's own usage
// example is an address, which it would otherwise rewrite.
const EXTS = new Set(['.html', '.js', '.json', '.xml', '.txt', '.webmanifest']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'media', 'images', 'tools']);

function readBaseUrl() {
  const src = fs.readFileSync(CONFIG, 'utf8');
  const m = src.match(/"baseUrl"\s*:\s*"([^"]+)"/);
  if (!m) throw new Error('No baseUrl found in data/site-config.js');
  return m[1];
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (EXTS.has(path.extname(entry.name).toLowerCase())) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function validate(url) {
  let u;
  try { u = new URL(url); }
  catch (e) { throw new Error('Not a valid URL: ' + url); }
  if (u.protocol !== 'https:') throw new Error('Use https:// — search engines and browsers expect it.');
  if (url.endsWith('/')) throw new Error('Drop the trailing slash: ' + url.replace(/\/+$/, ''));
  if (url !== u.origin + u.pathname.replace(/\/$/, '')) {
    throw new Error('Give the site root only, with no query or fragment.');
  }
  return url;
}

function main() {
  const arg = process.argv[2];
  const oldBase = readBaseUrl();

  if (!arg || arg === '--help' || arg === '-h') {
    console.log('Current address: ' + oldBase);
    console.log('Usage: node tools/set-domain.js https://www.example.in');
    console.log('       node tools/set-domain.js --check');
    process.exit(arg ? 0 : 1);
  }

  const files = walk(ROOT, []);
  const check = arg === '--check';
  const newBase = check ? oldBase : validate(arg);

  if (!check && newBase === oldBase) {
    console.log('Already set to ' + newBase + ' — nothing to do.');
    return;
  }

  // Count first, so --check and a real run report the same thing.
  let hits = 0, touched = 0;
  const report = [];
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    // site-config.js documents both a testing and a production address in its
    // header comment. A blanket replace rewrites those examples too, leaving
    // the comment claiming the old host is the new one — so here only the
    // setting itself is touched.
    const configOnly = path.resolve(file) === CONFIG;
    const n = configOnly
      ? (/"baseUrl"\s*:\s*"([^"]+)"/.exec(src) || [])[1] === oldBase ? 1 : 0
      : src.split(oldBase).length - 1;
    if (!n) continue;
    hits += n;
    touched++;
    const rel = path.relative(ROOT, file);
    if (report.length < 12) report.push('  ' + String(n).padStart(3) + '  ' + rel);
    if (check) continue;
    fs.writeFileSync(file, configOnly
      ? src.replace(/("baseUrl"\s*:\s*")[^"]+(")/, '$1' + newBase + '$2')
      : src.split(oldBase).join(newBase));
  }

  console.log((check ? 'Found ' : 'Rewrote ') + hits + ' occurrence(s) of ' + oldBase +
              ' across ' + touched + ' file(s).');
  report.forEach(l => console.log(l));
  if (touched > report.length) console.log('  ... and ' + (touched - report.length) + ' more');

  if (check) {
    console.log('\nNothing was changed. Pass a URL to rewrite.');
    return;
  }

  console.log('\nNow set to ' + newBase);
  console.log('Next: open the admin panel and click Publish Now, so the plant');
  console.log('pages and sitemap are regenerated and committed with the new address.');
}

try {
  main();
} catch (err) {
  // A stack trace helps nobody here — the caller mistyped an address.
  console.error('set-domain: ' + err.message);
  process.exit(1);
}
