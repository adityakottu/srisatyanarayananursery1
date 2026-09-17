# Gangumalla's Sri Satyanarayana Nursery

- **Website** — https://adityakottu.github.io/srisatyanarayananursery1/
- **Admin** — .../admin.html
- **VIP portal** — .../vip.html?key=vip2024ssn

## Publishing

Admin changes are saved in that browser only. To push them to every device:

**One-click (set up once)**
Admin → Import & Export → Connection settings → paste a GitHub
fine-grained token with *Contents: Read and write* on this repository.
After that, **Publish Now** commits everything in one click.

**Manual fallback**
Build `site-content.js`, then upload it to the `data` folder here.

| Path | Purpose |
|---|---|
| `index.html` | The public website |
| `admin.html` | Plants, photos, categories, VIP, import, backup, publish |
| `vip.html` | Private client portal |
| `data/plants.js` | 390 varieties across 8 categories |
| `data/site-content.js` | Published photos and content |
| `data/plant-routes.js` | Generated permanent URL map for plant profiles |
| `images/` | Hero, family and story photographs |

## Plant pages

The public catalogue has a permanent static page under `plants/` for every
record in `data/plants.js`. After changing the catalogue, regenerate those
pages from the shared source:

	ruby tools/generate-plant-pages.rb

The generator also refreshes `data/plant-routes.js`; commit both the generated
`plants/` directory and that route map when publishing.

## Release checks

Run the static contract test before publishing:

	ruby tools/test-site.rb

To include the deployed GitHub Pages smoke checks:

	LIVE_BASE_URL=https://adityakottu.github.io/srisatyanarayananursery1/ ruby tools/test-site.rb

Admin changes are synchronized to the public and VIP pages through the shared
`data/site-content.js` payload when **Publish Now** completes. Changes to the
catalogue source still require regenerating and committing the static `plants/`
pages separately.

Contact: +91 94401 79027 · srisatyanarayananursery@yahoo.co.in
