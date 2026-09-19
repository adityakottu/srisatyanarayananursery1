# Gangumalla's Sri Satyanarayana Nursery

Kadiyapulanka, Kadiyam, East Godavari District, Andhra Pradesh 533126

| Page | Address |
|---|---|
| Website | `/` |
| Admin | `/admin.html` |
| VIP portal | `/vip.html?key=…` |

## Files

| Path | Purpose |
|---|---|
| `index.html` | Public website |
| `admin.html` | Plants, photos, categories, VIP, import, backup, publish |
| `vip.html` | Private client portal |
| `data/site-config.js` | **The site's public address.** The only thing to change when the domain changes |
| `data/plants.js` | The 390-variety base catalogue (read by the site *and* the admin) |
| `data/site-content.js` | Everything published from the admin — written by Publish Now |
| `data/version.json` | Tiny marker visitors check to pick up a new publish |
| `data/page-builder.js` | The single template for plant pages, sitemap and robots.txt |
| `data/plant-routes.js` | Generated map of plant → permanent page address |
| `plants/<name>/` | Generated search-engine page for every plant |
| `sitemap.xml`, `robots.txt` | Generated for search engines |
| `tools/` | Command-line build and release check |

Generated files (`plants/`, `plant-routes.js`, `sitemap.xml`, `robots.txt`, and the
marked block in the head of `index.html`) are never edited by hand.

## Publishing

**Admin → Import & Export → Publish Now** makes one commit containing only what
changed: the content, any plant pages whose text changed, the sitemap, and pages
removed for deleted plants.

Each device remembers what it last published. If the live site was changed from
another device since then, publishing pauses and offers **Load live content**,
rather than overwriting someone else's work. Every publish is a commit, so any
earlier version can be restored from the repository history.

## Moving to the production domain

1. Edit `data/site-config.js` and set `baseUrl` to the new address, e.g.
   `https://www.srisatyanarayananursery.in` (no trailing slash).
2. Rebuild: `node tools/generate-plant-pages.js` — or upload the config and press
   **Publish Now**, which rebuilds everything itself.
3. Check: `ruby tools/test-site.rb` must pass.
4. On the new host, submit `https://<new-address>/sitemap.xml` in Google Search Console.

## Building locally

    node tools/generate-plant-pages.js     # plant pages, routes, sitemap, robots, home-page head
    ruby tools/test-site.rb                # release check

`ruby tools/generate-plant-pages.rb` still works; it runs the Node version so the
local build and the admin always use the same template.

Contact: +91 94401 79027 · srisatyanarayananursery@yahoo.co.in
