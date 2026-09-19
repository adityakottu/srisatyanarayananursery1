/*
 * Static SEO page builder — the single template for /plants/<slug>/ pages,
 * plant-routes.js, sitemap.xml and robots.txt.
 *
 * Used by:
 *   admin.html                      — regenerates pages on Publish Now
 *   tools/generate-plant-pages.js   — local / command-line builds
 *
 * Change the page design here and nowhere else.
 */
(function (root) {
  'use strict';

  var NURSERY = "Gangumalla’s Sri Satyanarayana Nursery";
  var PHONE_WA = '919440179027';
  var OG_IMAGE = 'images/hero-f34e7a95.jpg';

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // JSON inside <script> must never contain "</script"
  function jsonForScript(obj) {
    return JSON.stringify(obj).replace(/</g, '\\u003c');
  }
  function capitalize(s) {
    s = String(s || '');
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
  function cleanBase(url) {
    return String(url || '').replace(/\/+$/, '');
  }

  // ── 1. Merge the base catalogue with what the admin has published ──
  function mergePlants(base, published) {
    var plants = {};
    var k;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) plants[k] = base[k];
    if (!published) return plants;

    var strip = function (o) {
      var out = {};
      for (var f in o) {
        if (Object.prototype.hasOwnProperty.call(o, f) && f !== 'image' && f !== 'images' && f.charAt(0) !== '_') out[f] = o[f];
      }
      return out;
    };
    var ov = published.ssn_overrides || {};
    for (k in ov) {
      if (!Object.prototype.hasOwnProperty.call(ov, k)) continue;
      if (!plants[k] || !ov[k] || typeof ov[k] !== 'object') continue;
      var merged = {};
      var src = plants[k], add = strip(ov[k]), f;
      // An old stock sentence saved alongside a photo is not a real edit
      if (add.description && /is grown and supplied by Gangumalla.s Sri Satyanarayana Nursery at Kadiyapulanka, Kadiyam\.\s*Available wholesale and retail in a range of sizes\./.test(add.description)) delete add.description;
      for (f in src) merged[f] = src[f];
      for (f in add) merged[f] = add[f];
      plants[k] = merged;
    }
    var cu = published.ssn_custom_plants || {};
    for (k in cu) {
      if (!Object.prototype.hasOwnProperty.call(cu, k)) continue;
      var p = cu[k];
      if (!p || typeof p !== 'object' || !String(p.name || '').trim()) continue;
      plants[k] = strip(p);
    }
    return plants;
  }

  // ── 2. Stable slugs (existing URLs must never change) ──
  function slugFor(key, plant) {
    var source = /__(custom|sheet)__/.test(key) ? plant.name : (key.split('__').slice(1).join('__') || plant.name);
    return String(source || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function computeSlugs(plants) {
    var slugs = {}, used = {};
    Object.keys(plants).forEach(function (key) {
      var plant = plants[key];
      var candidate = slugFor(key, plant);
      if (used[candidate]) candidate = key.split('__')[0] + '-' + candidate;
      var n = 2;
      while (used[candidate]) { candidate = slugFor(key, plant) + '-' + n; n++; }
      slugs[key] = candidate;
      used[candidate] = true;
    });
    return slugs;
  }

  function categoryLabel(plant, categories) {
    if (Array.isArray(categories)) {
      for (var i = 0; i < categories.length; i++) {
        if (categories[i] && categories[i].key === plant.cat && categories[i].label) return categories[i].label;
      }
    }
    return plant.catLabel || 'Plant collection';
  }

  // ── 3. One plant page ──
  function renderPlantPage(key, plant, ctx) {
    var baseUrl = cleanBase(ctx.baseUrl);
    var slug = ctx.slugs[key];
    var url = baseUrl + '/plants/' + slug + '/';
    var name = plant.name || '';
    var description = plant.description ||
      (name + ' from ' + NURSERY + ', Kadiyapulanka, Kadiyam.');
    var metaDesc = description.length > 155 ? description.slice(0, 152).replace(/\s+\S*$/, '') + '…' : description;
    var catLabel = categoryLabel(plant, ctx.categories);
    var botanical = plant.botanical && plant.botanical !== '—' ? plant.botanical : '';
    var title = name + ' | ' + NURSERY;

    var related = (Array.isArray(plant.related) ? plant.related : [])
      .filter(function (r) { return ctx.plants[r] && ctx.slugs[r]; }).slice(0, 4);
    var relatedHtml = related.map(function (r) {
      return '<li><a href="../../plants/' + esc(ctx.slugs[r]) + '/">' + esc(ctx.plants[r].name) + '</a></li>';
    }).join('');

    var care = plant.care || {};
    var careHtml = Object.keys(care).filter(function (c) { return String(care[c] || '').trim(); })
      .map(function (c) { return '<li><strong>' + esc(capitalize(c)) + ':</strong> ' + esc(care[c]) + '</li>'; }).join('');

    var facts = (plant.facts && typeof plant.facts === 'object') ? plant.facts : {};
    var FACT_ROWS = [['family','Family'],['origin','Native to'],['size','Mature size'],['season','Season'],['highlight','Known for']];
    var factsHtml = FACT_ROWS.filter(function (r) { return String(facts[r[0]] || '').trim(); })
      .map(function (r) { return '<div><dt>' + r[1] + '</dt><dd>' + esc(facts[r[0]]) + '</dd></div>'; }).join('');

    var uses = (Array.isArray(plant.uses) ? plant.uses : []).filter(Boolean);
    var usesHtml = uses.length ? '<section class="panel"><h2>Uses</h2><ul>' +
      uses.map(function (u) { return '<li>' + esc(u) + '</li>'; }).join('') + '</ul></section>' : '';

    var waText = 'Hello, I found ' + name + ' on your website and would like to know its availability and sizes.';
    var waHref = 'https://wa.me/' + PHONE_WA + '?text=' + encodeURIComponent(waText);

    var ld = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage', '@id': url, url: url, name: title, description: metaDesc,
          inLanguage: 'en-IN',
          isPartOf: { '@type': 'WebSite', name: NURSERY, url: baseUrl + '/' },
          about: { '@type': 'Thing', name: name, alternateName: botanical || undefined }
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl + '/' },
            { '@type': 'ListItem', position: 2, name: catLabel, item: baseUrl + '/#catalog' },
            { '@type': 'ListItem', position: 3, name: name, item: url }
          ]
        }
      ]
    };

    return '<!doctype html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'  <meta charset="utf-8">\n' +
'  <meta name="viewport" content="width=device-width,initial-scale=1">\n' +
'  <title>' + esc(title) + '</title>\n' +
'  <meta name="description" content="' + esc(metaDesc) + '">\n' +
'  <link rel="canonical" href="' + esc(url) + '">\n' +
'  <meta property="og:type" content="website">\n' +
'  <meta property="og:site_name" content="' + esc(NURSERY) + '">\n' +
'  <meta property="og:title" content="' + esc(name) + '">\n' +
'  <meta property="og:description" content="' + esc(metaDesc) + '">\n' +
'  <meta property="og:url" content="' + esc(url) + '">\n' +
'  <meta property="og:image" content="' + esc(baseUrl + '/' + OG_IMAGE) + '">\n' +
'  <meta name="twitter:card" content="summary_large_image">\n' +
'  <style>\n' +
'    :root{color-scheme:light;--ink:#1b2a20;--green:#1f3a2d;--gold:#b9893f;--cream:#f8f3e8;--line:rgba(27,42,32,.14)}\n' +
'    *{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font:16px/1.65 Georgia,serif}\n' +
'    main{max-width:820px;margin:0 auto;padding:8vh 24px}.eyebrow{color:var(--gold);font:600 12px/1.2 Arial,sans-serif;letter-spacing:.15em;text-transform:uppercase}\n' +
'    h1{font-size:clamp(2.3rem,7vw,4.5rem);line-height:1.05;font-weight:400;margin:18px 0 8px}.botanical{color:#6b6457;font-style:italic}\n' +
'    .intro{font-size:1.15rem;max-width:680px;margin:30px 0}.panel{border-top:1px solid var(--line);padding:24px 0;margin-top:30px}\n' +
'    .grid{display:grid;grid-template-columns:1fr 1fr;gap:36px}\n' +
'    .actions{display:flex;flex-wrap:wrap;gap:12px}\n' +
'    .button{display:inline-block;background:var(--green);color:var(--cream);padding:12px 18px;text-decoration:none;font:600 14px Arial,sans-serif;border-radius:3px}\n' +
'    .button.wa{background:#1f7a47}\n' +
'    .facts{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:6px;overflow:hidden;margin:0 0 10px}\n' +
'    .facts div{background:var(--cream);padding:11px 14px}.facts dt{font:600 11px/1.2 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-bottom:4px}.facts dd{margin:0}\n' +
'    .supply{margin:0 0 10px;padding:14px 16px;border-left:3px solid var(--gold);background:rgba(185,137,63,.08);line-height:1.7}.supply a{color:var(--gold);font-weight:600}\n' +
'    .facts div:last-child:nth-child(odd){grid-column:1/-1}@media(max-width:600px){.facts{grid-template-columns:1fr}.facts div:last-child:nth-child(odd){grid-column:auto}}\n' +
'    nav.crumbs{font:13px Arial,sans-serif;color:#6b6457}nav.crumbs a{color:var(--green)}\n' +
'    ul{padding-left:20px}a{color:var(--green)}@media(max-width:600px){.grid{grid-template-columns:1fr}}\n' +
'  </style>\n' +
'  <script type="application/ld+json">' + jsonForScript(ld) + '</script>\n' +
'</head>\n' +
'<body><main>\n' +
'  <nav class="crumbs"><a href="../../">Home</a> &rsaquo; <a href="../../#catalog">' + esc(catLabel) + '</a> &rsaquo; ' + esc(name) + '</nav>\n' +
'  <p class="eyebrow">' + esc(catLabel) + '</p>\n' +
'  <h1>' + esc(name) + '</h1>\n' +
(botanical ? '  <div class="botanical">' + esc(botanical) + '</div>\n' : '') +
'  <p class="intro">' + esc(description) + '</p>\n' +
(factsHtml ? '  <dl class="facts">' + factsHtml + '</dl>\n' : '') +
'  <p class="supply"><strong>' + esc(name) + '</strong>' + (botanical ? ' (<em>' + esc(botanical) + '</em>)' : '') + ' is grown and supplied by Gangumalla&rsquo;s Sri Satyanarayana Nursery at Kadiyapulanka, Kadiyam. Available wholesale and retail in a range of sizes. <a href="../../#contact">Contact us</a> for current stock, sizing and pricing.</p>\n' +
'  <div class="grid">' +
    (careHtml ? '<section class="panel"><h2>Care guide</h2><ul>' + careHtml + '</ul></section>' : '') +
    (relatedHtml ? '<section class="panel"><h2>Related plants</h2><ul>' + relatedHtml + '</ul></section>' : '') +
  '</div>\n' +
(usesHtml ? '  ' + usesHtml + '\n' : '') +
'  <section class="panel actions">\n' +
'    <a class="button wa" href="' + esc(waHref) + '" rel="noopener">Ask on WhatsApp</a>\n' +
'    <a class="button" href="../../#contact">Visit &amp; enquire</a>\n' +
'  </section>\n' +
'</main></body></html>\n';
  }


  // ── Home page head: canonical, sharing preview, local business ──
  var HOME_START = '<!-- SSN:SEO START — generated from data/site-config.js, do not edit -->';
  var HOME_END = '<!-- SSN:SEO END -->';
  function renderHomeSeo(baseUrl) {
    baseUrl = cleanBase(baseUrl);
    var desc = 'Family-run wholesale and retail plant nursery at Kadiyapulanka, Kadiyam, Andhra Pradesh. Avenue trees, palms, fruit plants, shrubs and rare specimens since 1963.';
    var business = {
      '@context': 'https://schema.org',
      '@type': 'GardenStore',
      '@id': baseUrl + '/#nursery',
      name: NURSERY,
      alternateName: 'Sri Satyanarayana Nursery',
      url: baseUrl + '/',
      image: baseUrl + '/' + OG_IMAGE,
      description: desc,
      telephone: '+91 94401 79027',
      email: 'srisatyanarayananursery@yahoo.co.in',
      foundingDate: '1963',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Kadiyapulanka Village, Kadiyam Mandal',
        addressLocality: 'Kadiyam',
        addressRegion: 'Andhra Pradesh',
        postalCode: '533126',
        addressCountry: 'IN'
      },
      sameAs: [
        'https://www.instagram.com/srisatyanarayananursery',
        'https://www.facebook.com/share/1HbxtGuQ4Y/',
        'https://youtube.com/@srisatyanarayananursery3690'
      ]
    };
    return HOME_START + '\n' +
      '  <link rel="canonical" href="' + esc(baseUrl + '/') + '">\n' +
      '  <meta property="og:type" content="website">\n' +
      '  <meta property="og:site_name" content="' + esc(NURSERY) + '">\n' +
      '  <meta property="og:title" content="' + esc(NURSERY) + ' — Kadiyam, Andhra Pradesh">\n' +
      '  <meta property="og:description" content="' + esc(desc) + '">\n' +
      '  <meta property="og:url" content="' + esc(baseUrl + '/') + '">\n' +
      '  <meta property="og:image" content="' + esc(baseUrl + '/' + OG_IMAGE) + '">\n' +
      '  <meta name="twitter:card" content="summary_large_image">\n' +
      '  <script type="application/ld+json">' + jsonForScript(business) + '</script>\n' +
      '  ' + HOME_END;
  }
  // Put the block into index.html, replacing any previous one
  function applyHomeSeo(html, baseUrl) {
    var block = renderHomeSeo(baseUrl);
    var a = html.indexOf(HOME_START), b = html.indexOf(HOME_END);
    if (a >= 0 && b > a) return html.slice(0, a) + block + html.slice(b + HOME_END.length);
    var h = html.indexOf('</head>');
    if (h < 0) return html;
    return html.slice(0, h) + '  ' + block + '\n' + html.slice(h);
  }

  function renderRoutes(slugs) {
    var routes = {};
    Object.keys(slugs).forEach(function (k) { routes[k] = 'plants/' + slugs[k] + '/'; });
    return 'window.PLANT_ROUTES = ' + JSON.stringify(routes) + ';\n';
  }

  function parseSitemap(xml) {
    var out = {};
    String(xml || '').replace(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g, function (_, loc, mod) {
      out[loc.replace(/&amp;/g, '&')] = mod;
      return _;
    });
    return out;
  }

  function renderSitemap(entries) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      entries.map(function (e) {
        return '  <url><loc>' + esc(e.loc) + '</loc><lastmod>' + esc(e.lastmod) + '</lastmod></url>';
      }).join('\n') + '\n</urlset>\n';
  }

  function renderRobots(baseUrl) {
    return 'User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /vip.html\n\nSitemap: ' +
      cleanBase(baseUrl) + '/sitemap.xml\n';
  }

  /*
   * Build every generated file.
   *   opts.base            — PLANT_DATA_RAW
   *   opts.published       — SSN_PUBLISHED-shaped object (may be null)
   *   opts.baseUrl         — public site root
   *   opts.previousSitemap — current sitemap.xml text, to keep unchanged lastmod dates
   *   opts.isUnchanged(path, content) — optional; true keeps the old lastmod
   *   opts.today           — 'YYYY-MM-DD'
   * Returns { files: {path: content}, plantCount }
   */
  function buildSite(opts) {
    var baseUrl = cleanBase(opts.baseUrl);
    if (!/^https?:\/\//.test(baseUrl)) throw new Error('baseUrl must start with http:// or https://');
    var published = opts.published || null;
    var plants = mergePlants(opts.base || {}, published);
    var slugs = computeSlugs(plants);
    var ctx = { baseUrl: baseUrl, plants: plants, slugs: slugs,
                categories: published && published.ssn_categories };
    var files = {};
    var prev = parseSitemap(opts.previousSitemap);
    var today = opts.today || new Date().toISOString().slice(0, 10);
    var entries = [{ loc: baseUrl + '/', lastmod: prev[baseUrl + '/'] || today }];

    Object.keys(plants).forEach(function (key) {
      var path = 'plants/' + slugs[key] + '/index.html';
      var html = renderPlantPage(key, plants[key], ctx);
      files[path] = html;
      var loc = baseUrl + '/plants/' + slugs[key] + '/';
      var keep = prev[loc] && opts.isUnchanged && opts.isUnchanged(path, html);
      entries.push({ loc: loc, lastmod: keep ? prev[loc] : today });
    });
    entries.sort(function (a, b) { return a.loc < b.loc ? -1 : a.loc > b.loc ? 1 : 0; });

    files['data/plant-routes.js'] = renderRoutes(slugs);
    files['sitemap.xml'] = renderSitemap(entries);
    files['robots.txt'] = renderRobots(baseUrl);
    return { files: files, plantCount: Object.keys(plants).length };
  }

  var api = {
    buildSite: buildSite, mergePlants: mergePlants, computeSlugs: computeSlugs,
    renderPlantPage: renderPlantPage, parseSitemap: parseSitemap,
    applyHomeSeo: applyHomeSeo
  };
  root.SSNPageBuilder = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
