#!/usr/bin/env node
/*
 * Rebuild the static SEO pages, plant-routes.js, sitemap.xml and robots.txt.
 *   node tools/generate-plant-pages.js
 *
 * Uses data/page-builder.js — the same template the admin panel uses on
 * Publish Now — so a local build and a publish always produce identical files.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

function extract(src, name) {
  const m = src.match(new RegExp('window\\.' + name + '\\s*=\\s*([\\s\\S]*?);?\\s*$'));
  if (!m) return null;
  try { return JSON.parse(m[1].trim().replace(/;$/, '')); } catch (e) { return null; }
}

const builder = require(path.join(ROOT, 'data', 'page-builder.js'));
const base = extract(read('data/plants.js'), 'PLANT_DATA_RAW');
if (!base) { console.error('Could not read PLANT_DATA_RAW from data/plants.js'); process.exit(1); }

const config = extract(read('data/site-config.js'), 'SSN_CONFIG');
if (!config || !config.baseUrl) { console.error('baseUrl missing in data/site-config.js'); process.exit(1); }

const rawPublished = exists('data/site-content.js') ? extract(read('data/site-content.js'), 'SSN_PUBLISHED') : null;
// Photos saved inline by the admin become files under media/, exactly as Publish Now does
const extracted = builder.extractMedia(rawPublished);
const published = extracted.data;
let mediaWritten = 0;
for (const [rel, b64] of Object.entries(extracted.media)) {
  const abs = path.join(ROOT, rel);
  if (fs.existsSync(abs)) continue;
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, Buffer.from(b64, 'base64'));
  mediaWritten++;
}
const previousSitemap = exists('sitemap.xml') ? read('sitemap.xml') : '';

const result = builder.buildSite({
  base, published, baseUrl: config.baseUrl, previousSitemap,
  isUnchanged: (p, content) => exists(p) && read(p) === content
});

// Home page head follows the same site address
const indexPath = 'index.html';
if (exists(indexPath)) {
  const html = read(indexPath);
  result.files[indexPath] = builder.applyHomeSeo(html, config.baseUrl);
}

let written = 0, same = 0;
for (const [rel, content] of Object.entries(result.files)) {
  const abs = path.join(ROOT, rel);
  if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf8') === content) { same++; continue; }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  written++;
}

// Remove pages for plants that no longer exist, so Google stops finding them
const keep = new Set(Object.keys(result.files).filter(p => p.startsWith('plants/') && p !== indexPath).map(p => p.split('/')[1]));
let removed = 0;
const plantsDir = path.join(ROOT, 'plants');
if (fs.existsSync(plantsDir)) {
  for (const dir of fs.readdirSync(plantsDir)) {
    if (!keep.has(dir)) { fs.rmSync(path.join(plantsDir, dir), { recursive: true, force: true }); removed++; }
  }
}

console.log(`${result.plantCount} plant pages · ${written} written · ${same} unchanged · ${removed} removed`);
console.log(`Photos: ${Object.keys(extracted.media).length} in media/ (${mediaWritten} new)`);
console.log(`Site URL: ${config.baseUrl}`);
