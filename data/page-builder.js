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
      if(add.tagline && ["A dependable shade and avenue tree for Indian conditions.", "Grown for its seasonal flowering display.", "A productive fruiting variety suited to local climates.", "An architectural palm for premium landscapes.", "A versatile shrub for hedging, borders and colour.", "A spreading ground cover for quick, low green carpet.", "A hardy, drought-tolerant specimen needing little care.", "An aquatic plant for ponds, tanks and water features."].indexOf(add.tagline)>=0) delete add.tagline;
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

  // ── Media: photos are published as files, never inline text ──
  // Deterministic 53-bit hash (same result in the browser and in Node)
  function hash53(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    var n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
    return ('00000000000000' + n.toString(16)).slice(-14);
  }
  var MEDIA_RE = /^data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+\/=\s]+)$/;
  // Returns { data: copy with every inline image replaced by 'media/<hash>.<ext>',
  //           media: { 'media/<hash>.<ext>': '<base64>' } }
  function extractMedia(published) {
    var media = {};
    function walk(v) {
      if (typeof v === 'string') {
        var m = v.length > 200 && MEDIA_RE.exec(v);
        if (!m) return v;
        var ext = m[1] === 'jpeg' ? 'jpg' : m[1];
        var b64 = m[2].replace(/\s/g, '');
        var path = 'media/' + hash53(b64) + '.' + ext;
        media[path] = b64;
        return path;
      }
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object') {
        var o = {};
        for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = walk(v[k]);
        return o;
      }
      return v;
    }
    return { data: published ? walk(published) : published, media: media };
  }
  function isFilePath(v) { return typeof v === 'string' && /^media\/[a-z0-9]+\.(jpg|png|webp|gif)$/.test(v); }
  // The first published photo of a plant, as a site-relative file path
  function photoFor(key, published) {
    if (!published) return '';
    var list = [];
    var ph = published.ssn_plant_photos && published.ssn_plant_photos[key];
    if (Array.isArray(ph)) list = list.concat(ph); else if (ph) list.push(ph);
    var ov = published.ssn_overrides && published.ssn_overrides[key];
    if (ov) { if (Array.isArray(ov.images)) list = list.concat(ov.images); list.push(ov.image); }
    var cu = published.ssn_custom_plants && published.ssn_custom_plants[key];
    if (cu) { if (Array.isArray(cu.images)) list = list.concat(cu.images); list.push(cu.image); }
    for (var i = 0; i < list.length; i++) {
      var p = list[i] && typeof list[i] === 'object' ? (list[i].src || '') : list[i];
      if (isFilePath(p)) return p;
    }
    return '';
  }

  // ── Shared look: the same header, fonts and footer as the main site ──
  var FONTS = '  <link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">\n';
  var CSS =
    ':root{color-scheme:light;--ink:#1b2a20;--green:#1f3a2d;--green-deep:#142319;--gold:#b9893f;--gold-l:#e3c88a;--cream:#f8f3e8;--cream2:#efe7d6;--muted:#6b6457;--line:rgba(27,42,32,.14)}\n' +
    '*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--cream);color:var(--ink);font:16px/1.7 Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif}\n' +
    'a{color:var(--green)}img{max-width:100%;display:block}h1,h2,h3,.serif{font-family:Fraunces,Georgia,serif;font-weight:400}\n' +
    '.top{position:sticky;top:0;z-index:10;background:rgba(248,243,232,.96);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}\n' +
    '.top-in{max-width:1180px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;gap:20px}\n' +
    '.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--green);min-width:0}.brand img{width:34px;height:34px;object-fit:contain}\n' +
    '.brand b{display:block;font:500 1rem/1.2 Fraunces,Georgia,serif}.brand small{display:block;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:#8d6724}\n' +
    '.links{margin-left:auto;display:flex;align-items:center;gap:22px;font-size:.86rem}.links a{position:relative;text-decoration:none;color:var(--muted);transition:color .2s}.links a:hover{color:var(--green)}.links a::after{content:"";position:absolute;left:0;right:0;bottom:-4px;height:1.5px;background:var(--gold);transform:scaleX(0);transform-origin:left;transition:transform .35s cubic-bezier(.22,1,.36,1)}.links a:hover::after{transform:scaleX(1)}\n' +
    '.cta{background:var(--green);color:var(--cream)!important;padding:9px 18px;border-radius:2px;text-decoration:none;font-size:.8rem;letter-spacing:.04em;font-weight:500;white-space:nowrap;transition:background .2s}.cta:hover{background:var(--green-deep)}.cta::after{display:none}\n' +
    '.wrap{max-width:1180px;margin:0 auto;padding:0 24px}\n' +
    '.crumbs{font-size:.8rem;color:var(--muted);padding:22px 0 0}.crumbs a{color:var(--muted)}\n' +
    '.hero{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:48px;align-items:center;padding:26px 0 40px}\n' +
    '.hero.noimg{grid-template-columns:1fr}.eyebrow{color:#8d6724;font-size:.74rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase}\n' +
    'h1{font-size:clamp(2.2rem,5.5vw,3.8rem);line-height:1.05;margin:12px 0 6px;color:var(--green-deep)}.botanical{font-family:Fraunces,Georgia,serif;font-style:italic;color:var(--gold);font-size:1.15rem}\n' +
    '.tagline{font-size:1.08rem;color:var(--muted);margin:16px 0 22px;max-width:560px}\n' +
    '.photo{border-radius:10px;overflow:hidden;box-shadow:0 18px 44px rgba(20,35,25,.18);aspect-ratio:4/5;background:var(--cream2)}.photo img{width:100%;height:100%;object-fit:cover;transition:transform 1.2s cubic-bezier(.22,1,.36,1)}.photo:hover img{transform:scale(1.04)}\n' +
    '.actions{display:flex;flex-wrap:wrap;gap:10px}.button{display:inline-flex;align-items:center;gap:8px;background:var(--gold);color:var(--green-deep);padding:13px 26px;text-decoration:none;font-weight:500;font-size:.86rem;letter-spacing:.04em;border-radius:2px;border:1px solid var(--gold);transition:all .22s}.button:hover{background:var(--gold-l);border-color:var(--gold-l)}.button.ghost{background:transparent;color:var(--green);border-color:var(--green)}.button.ghost:hover{background:var(--green);color:var(--cream)}\n' +
    '.care{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));background:var(--green-deep);color:var(--cream);border-radius:8px;overflow:hidden;margin:0 0 44px}\n' +
    '.care div{padding:18px 18px;border-right:1px solid rgba(248,243,232,.1)}.care div:last-child{border:0}.care dt{font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-l);margin-bottom:6px}.care dd{margin:0;font-size:.9rem;line-height:1.5}\n' +
    '.body{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:44px;padding-bottom:56px}\n' +
    '.card{background:#fbf8f1;border:1px solid var(--line);border-radius:10px;padding:26px 28px}.card h2{font-size:1.35rem;margin:0 0 14px;color:var(--green-deep)}\n' +
    '.facts{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:6px;overflow:hidden;margin:20px 0 0}\n' +
    '.facts div{background:#fbf8f1;padding:11px 14px}.facts dt{font-size:.66rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-bottom:3px}.facts dd{margin:0;font-size:.92rem}\n' +
    '.facts div:last-child:nth-child(odd){grid-column:1/-1}\n' +
    '.supply{margin:20px 0 0;padding:14px 16px 14px 18px;border-left:3px solid var(--gold);background:rgba(185,137,63,.08);border-radius:0 6px 6px 0;font-size:.92rem;color:var(--muted)}.supply strong{color:var(--green-deep)}.supply a{color:var(--gold);font-weight:600}\n' +
    '.side{display:flex;flex-direction:column;gap:20px}ul.clean{list-style:none;padding:0;margin:0}ul.clean li{padding:7px 0;border-bottom:1px solid var(--line)}ul.clean li:last-child{border:0}\n' +
    '.foot{background:var(--green-deep);color:rgba(248,243,232,.72);font-size:.86rem}.foot-in{max-width:1180px;margin:0 auto;padding:40px 24px;display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:30px}\n' +
    '.foot-copy{border-top:1px solid rgba(248,243,232,.1);text-align:center;padding:16px 24px;font-size:.76rem;color:rgba(248,243,232,.6)}\n' +
    '.foot h3{color:var(--cream);font-size:1.1rem;margin:0 0 10px}.foot a{color:var(--gold-l);text-decoration:none}.foot p{margin:0 0 6px}\n' +
    '.dir-cat{margin:0 0 40px}.dir-cat h2{font-size:1.6rem;color:var(--green-deep);margin:0 0 4px}.dir-cat p{color:var(--muted);margin:0 0 14px;font-size:.9rem}\n' +
    '.dir-list{columns:3 220px;column-gap:30px;list-style:none;padding:0;margin:0}.dir-list li{break-inside:avoid;padding:5px 0;border-bottom:1px solid var(--line)}.dir-list a{text-decoration:none}.dir-list a:hover{text-decoration:underline}.dir-list i{display:block;font-size:.78rem;color:var(--muted)}\n' +
    '@media(max-width:900px){.links a:not(.cta){display:none}.hero,.body{grid-template-columns:1fr;gap:26px}.photo{aspect-ratio:4/3}.care{grid-template-columns:1fr 1fr}.care div{border-bottom:1px solid rgba(248,243,232,.1)}.foot-in{grid-template-columns:1fr}}\n' +
    '@media(max-width:560px){.top-in{padding:10px 16px;gap:10px}.wrap{padding:0 16px}.brand b{font-size:.86rem}.brand small{display:none}.facts{grid-template-columns:1fr}.facts div:last-child:nth-child(odd){grid-column:auto}.card{padding:20px 18px}.cta{padding:8px 12px;font-size:.78rem}}\n';

  function chromeTop(rel) {
    return '<header class="top"><div class="top-in">' +
      '<a class="brand" href="' + rel + '"><img src="' + rel + 'images/gallery-e92598cf.png" alt="" width="34" height="34"><span><b>Gangumalla&rsquo;s Sri Satyanarayana Nursery</b><small>Kadiyapulanka, Andhra Pradesh</small></span></a>' +
      '<nav class="links" aria-label="Main"><a href="' + rel + '">Home</a><a href="' + rel + 'plants/">Plant Directory</a><a href="' + rel + '#catalog">Catalogue</a><a href="' + rel + '#gallery">Gallery</a><a class="cta" href="' + rel + '#contact">Visit &amp; Enquire</a></nav>' +
      '</div></header>\n';
  }
  function chromeFoot(rel) {
    return '<footer class="foot"><div class="foot-in">' +
      '<div><h3>Gangumalla&rsquo;s Sri Satyanarayana Nursery</h3><p>Family-run wholesale and retail nursery since 1963.</p><p>Kadiyapulanka Village, Kadiyam Mandal, East Godavari District, Andhra Pradesh &ndash; 533126</p></div>' +
      '<div><h3>Contact</h3><p><a href="tel:+919440179027">+91 94401 79027</a></p><p><a href="https://wa.me/' + PHONE_WA + '" rel="noopener">WhatsApp &mdash; available 24/7</a></p><p><a href="mailto:srisatyanarayananursery@yahoo.co.in">srisatyanarayananursery@yahoo.co.in</a></p></div>' +
      '<div><h3>Explore</h3><p><a href="' + rel + 'plants/">All plants A&ndash;Z</a></p><p><a href="' + rel + '#catalog">Catalogue</a></p><p><a href="' + rel + '#contact">Visit &amp; enquire</a></p></div>' +
      '</div><div class="foot-copy">&copy; 1963&ndash;<span class="js-year">' + new Date().getFullYear() + '</span> Gangumalla&rsquo;s Sri Satyanarayana Nursery. All rights reserved. Design, text and photographs may not be copied or reused.</div></footer>\n' +
      '<script>(function(){var y=new Date().getFullYear(),e=document.querySelector(".js-year");if(e&&y>+e.textContent)e.textContent=y;})();</script>\n';
  }
  function head(o) {
    return '<!doctype html>\n<!-- © ' + NURSERY + '. All rights reserved. Design, code, text and photographs may not be copied or reused without written permission. -->\n<html lang="en-IN">\n<head>\n' +
      '  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n' +
      '  <title>' + esc(o.title) + '</title>\n' +
      '  <meta name="description" content="' + esc(o.desc) + '">\n' +
      '  <link rel="canonical" href="' + esc(o.canonical) + '">\n' +
      '  <link rel="icon" href="' + o.rel + 'images/gallery-e92598cf.png">\n' +
      '  <meta name="theme-color" content="#1f3a2d">\n' +
      '  <meta name="author" content="' + esc(NURSERY) + '">\n' +
      '  <meta name="copyright" content="© ' + esc(NURSERY) + '. All rights reserved.">\n' +
      '  <meta property="og:type" content="website">\n' +
      '  <meta property="og:locale" content="en_IN">\n' +
      '  <meta property="og:site_name" content="' + esc(NURSERY) + '">\n' +
      '  <meta property="og:title" content="' + esc(o.ogTitle || o.title) + '">\n' +
      '  <meta property="og:description" content="' + esc(o.desc) + '">\n' +
      '  <meta property="og:url" content="' + esc(o.canonical) + '">\n' +
      '  <meta property="og:image" content="' + esc(o.image) + '">\n' +
      '  <meta name="twitter:card" content="summary_large_image">\n' +
      FONTS +
      '  <style>\n' + CSS + '  </style>\n' +
      '  <script type="application/ld+json">' + jsonForScript(o.ld) + '</script>\n' +
      '</head>\n';
  }

  // ── 3. One plant page ──
  function renderPlantPage(key, plant, ctx) {
    var baseUrl = cleanBase(ctx.baseUrl);
    var slug = ctx.slugs[key];
    var url = baseUrl + '/plants/' + slug + '/';
    var canonKey = (ctx.canonical && ctx.canonical[key]) || key;
    var canonUrl = baseUrl + '/plants/' + ctx.slugs[canonKey] + '/';
    var name = plant.name || '';
    var description = plant.description ||
      (name + ' from ' + NURSERY + ', Kadiyapulanka, Kadiyam.');
    var metaDesc = description.length > 155 ? description.slice(0, 152).replace(/\s+\S*$/, '') + '…' : description;
    var catLabel = categoryLabel(plant, ctx.categories);
    var botanical = plant.botanical && plant.botanical !== '—' ? plant.botanical : '';
    var title = name + (botanical && botanical.toLowerCase() !== name.toLowerCase() ? ' (' + botanical + ')' : '') + ' | ' + NURSERY;
    var photo = ctx.photos && ctx.photos[key] || '';
    var image = photo ? baseUrl + '/' + photo : baseUrl + '/' + OG_IMAGE;
    var rel = '../../';

    var related = (Array.isArray(plant.related) ? plant.related : [])
      .filter(function (r) { return ctx.plants[r] && ctx.slugs[r]; }).slice(0, 6);
    var relatedHtml = related.map(function (r) {
      return '<li><a href="../../plants/' + esc(ctx.slugs[r]) + '/">' + esc(ctx.plants[r].name) + '</a></li>';
    }).join('');

    var care = plant.care || {};
    var CARE = [['water','Water'],['light','Light'],['soil','Soil'],['growth','Growth'],['difficulty','Difficulty']];
    var careHtml = CARE.filter(function (c) { return String(care[c[0]] || '').trim(); })
      .map(function (c) { return '<div><dt>' + c[1] + '</dt><dd>' + esc(care[c[0]]) + '</dd></div>'; }).join('');

    var facts = (plant.facts && typeof plant.facts === 'object') ? plant.facts : {};
    var FACT_ROWS = [['family','Family'],['origin','Native to'],['size','Mature size'],['season','Season'],['highlight','Known for']];
    var factsHtml = FACT_ROWS.filter(function (r) { return String(facts[r[0]] || '').trim(); })
      .map(function (r) { return '<div><dt>' + r[1] + '</dt><dd>' + esc(facts[r[0]]) + '</dd></div>'; }).join('');

    var uses = (Array.isArray(plant.uses) ? plant.uses : []).filter(Boolean);
    var tips = (Array.isArray(plant.tips) ? plant.tips : []).filter(Boolean);
    var list = function (a) { return '<ul class="clean">' + a.map(function (u) { return '<li>' + esc(u) + '</li>'; }).join('') + '</ul>'; };

    var waText = 'Hello, I found ' + name + ' on your website and would like to know its availability and sizes.';
    var waHref = 'https://wa.me/' + PHONE_WA + '?text=' + encodeURIComponent(waText);

    var ld = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage', '@id': url, url: url, name: title, description: metaDesc,
          inLanguage: 'en-IN',
          primaryImageOfPage: photo ? { '@type': 'ImageObject', url: image } : undefined,
          isPartOf: { '@type': 'WebSite', name: NURSERY, url: baseUrl + '/' },
          about: { '@type': 'Thing', name: name, alternateName: botanical || undefined, description: plant.tagline || undefined },
          publisher: { '@id': baseUrl + '/#nursery' }
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl + '/' },
            { '@type': 'ListItem', position: 2, name: 'Plant Directory', item: baseUrl + '/plants/' },
            { '@type': 'ListItem', position: 3, name: name, item: url }
          ]
        }
      ]
    };

    return head({ title: title, desc: metaDesc, canonical: canonUrl, image: image, ld: ld, rel: rel, ogTitle: name }) +
'<body>\n' + chromeTop(rel) +
'<main class="wrap">\n' +
'  <nav class="crumbs" aria-label="Breadcrumb"><a href="../../">Home</a> &rsaquo; <a href="../../plants/">Plant Directory</a> &rsaquo; <a href="../../plants/#' + esc(plant.cat || '') + '">' + esc(catLabel) + '</a> &rsaquo; ' + esc(name) + '</nav>\n' +
'  <section class="hero' + (photo ? '' : ' noimg') + '">\n' +
'    <div>\n' +
'      <p class="eyebrow">' + esc(catLabel) + '</p>\n' +
'      <h1>' + esc(name) + '</h1>\n' +
(botanical ? '      <div class="botanical">' + esc(botanical) + '</div>\n' : '') +
(plant.tagline ? '      <p class="tagline">' + esc(plant.tagline) + '</p>\n' : '') +
'      <div class="actions"><a class="button wa" href="' + esc(waHref) + '" rel="noopener">Ask on WhatsApp &rarr;</a><a class="button ghost" href="../../#contact">Request a quote</a></div>\n' +
'    </div>\n' +
(photo ? '    <figure class="photo" style="margin:0"><img src="../../' + esc(photo) + '" alt="' + esc(name + (botanical ? ' (' + botanical + ')' : '') + ' at Gangumalla’s Sri Satyanarayana Nursery') + '" width="800" height="1000"></figure>\n' : '') +
'  </section>\n' +
(careHtml ? '  <dl class="care" aria-label="Care guide">' + careHtml + '</dl>\n' : '') +
'  <div class="body">\n' +
'    <article class="card">\n' +
'      <h2>About this plant</h2>\n' +
'      <p style="margin:0">' + esc(description) + '</p>\n' +
(factsHtml ? '      <dl class="facts">' + factsHtml + '</dl>\n' : '') +
'      <p class="supply"><strong>' + esc(name) + '</strong>' + (botanical ? ' (<em>' + esc(botanical) + '</em>)' : '') + ' is grown and supplied by Gangumalla&rsquo;s Sri Satyanarayana Nursery at Kadiyapulanka, Andhra Pradesh. Available wholesale and retail in a range of sizes. <a href="../../#contact">Contact us</a> for current stock, sizing and pricing.</p>\n' +
'    </article>\n' +
'    <aside class="side">\n' +
(uses.length ? '      <section class="card"><h2>Best used for</h2>' + list(uses) + '</section>\n' : '') +
(tips.length ? '      <section class="card"><h2>Growing tips</h2>' + list(tips) + '</section>\n' : '') +
(relatedHtml ? '      <section class="card"><h2>Related plants</h2><ul class="clean">' + relatedHtml + '</ul></section>\n' : '') +
'    </aside>\n' +
'  </div>\n' +
'</main>\n' + chromeFoot(rel) +
'</body></html>\n';
  }

  // ── 3b. The plant directory: every plant, one crawlable page ──
  function renderDirectory(ctx) {
    var baseUrl = cleanBase(ctx.baseUrl);
    var url = baseUrl + '/plants/';
    var groups = {}, order = [];
    Object.keys(ctx.plants).forEach(function (k) {
      var p = ctx.plants[k];
      var cat = p.cat || 'other';
      if (!groups[cat]) { groups[cat] = { label: categoryLabel(p, ctx.categories), items: [] }; order.push(cat); }
      groups[cat].items.push(k);
    });
    var total = Object.keys(ctx.plants).length;
    var sections = order.map(function (cat) {
      var g = groups[cat];
      g.items.sort(function (a, b) { return String(ctx.plants[a].name).localeCompare(String(ctx.plants[b].name)); });
      return '  <section class="dir-cat" id="' + esc(cat) + '"><h2>' + esc(g.label) + '</h2><p>' + g.items.length + ' plants</p><ul class="dir-list">' +
        g.items.map(function (k) {
          var p = ctx.plants[k], target = (ctx.canonical && ctx.canonical[k]) || k;
          var bot = p.botanical && p.botanical !== '—' && p.botanical.toLowerCase() !== String(p.name).toLowerCase() ? '<i>' + esc(p.botanical) + '</i>' : '';
          return '<li><a href="' + esc(ctx.slugs[target]) + '/">' + esc(p.name) + '</a>' + bot + '</li>';
        }).join('') + '</ul></section>\n';
    }).join('');
    var jump = order.map(function (cat) { return '<a href="#' + esc(cat) + '">' + esc(groups[cat].label) + '</a>'; }).join(' &middot; ');
    var desc = 'Browse all ' + total + ' plants grown and supplied by ' + NURSERY + ' at Kadiyapulanka, Andhra Pradesh — avenue trees, palms, fruit plants, shrubs, flowering trees, aquatic and desert plants.';
    var ld = { '@context': 'https://schema.org', '@graph': [
      { '@type': 'CollectionPage', '@id': url, url: url, name: 'Plant Directory', description: desc, inLanguage: 'en-IN',
        isPartOf: { '@type': 'WebSite', name: NURSERY, url: baseUrl + '/' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl + '/' },
        { '@type': 'ListItem', position: 2, name: 'Plant Directory', item: url } ] } ] };
    return head({ title: 'Plant Directory — ' + total + ' plants | ' + NURSERY, desc: desc, canonical: url, image: baseUrl + '/' + OG_IMAGE, ld: ld, rel: '../', ogTitle: 'Plant Directory' }) +
'<body>\n' + chromeTop('../') +
'<main class="wrap" style="padding-bottom:40px">\n' +
'  <nav class="crumbs" aria-label="Breadcrumb"><a href="../">Home</a> &rsaquo; Plant Directory</nav>\n' +
'  <section class="hero noimg" style="padding-bottom:20px"><div><p class="eyebrow">Plant Directory</p><h1>All ' + total + ' plants, A&ndash;Z</h1><p class="tagline">Every plant we grow and supply, by category. Open a plant for its description, care guide and quick facts, or <a href="../#contact">send us an enquiry</a>.</p><p style="font-size:.86rem;line-height:2">' + jump + '</p></div></section>\n' +
sections +
'</main>\n' + chromeFoot('../') +
'</body></html>\n';
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
      '  <meta property="og:title" content="' + esc(NURSERY) + ' — Kadiyapulanka, Andhra Pradesh">\n' +
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
    // Plants listed twice under the same name (e.g. an avenue tree that also
    // appears under Flowering) share one canonical page, so search engines
    // see one strong page instead of two competing copies.
    var canonical = {}, byName = {};
    Object.keys(plants).forEach(function (k) {
      var n = String(plants[k].name || '').trim().toLowerCase();
      if (!n) return;
      (byName[n] = byName[n] || []).push(k);
    });
    Object.keys(byName).forEach(function (n) {
      var ks = byName[n];
      if (ks.length < 2) return;
      var main = ks.filter(function (k) { return plants[k].cat !== 'flowering'; })[0] || ks[0];
      ks.forEach(function (k) { canonical[k] = main; });
    });
    var photos = {};
    Object.keys(plants).forEach(function (k) { var p = photoFor(k, published); if (p) photos[k] = p; });
    var ctx = { baseUrl: baseUrl, plants: plants, slugs: slugs, canonical: canonical, photos: photos,
                categories: published && published.ssn_categories };
    var files = {};
    var prev = parseSitemap(opts.previousSitemap);
    var today = opts.today || new Date().toISOString().slice(0, 10);
    var entries = [{ loc: baseUrl + '/', lastmod: prev[baseUrl + '/'] || today }];

    Object.keys(plants).forEach(function (key) {
      var path = 'plants/' + slugs[key] + '/index.html';
      var html = renderPlantPage(key, plants[key], ctx);
      files[path] = html;
      if (canonical[key] && canonical[key] !== key) return;   // not in the sitemap
      var loc = baseUrl + '/plants/' + slugs[key] + '/';
      var keep = prev[loc] && opts.isUnchanged && opts.isUnchanged(path, html);
      entries.push({ loc: loc, lastmod: keep ? prev[loc] : today });
    });
    var dirHtml = renderDirectory(ctx);
    files['plants/index.html'] = dirHtml;
    var dirLoc = baseUrl + '/plants/';
    entries.push({ loc: dirLoc, lastmod: (prev[dirLoc] && opts.isUnchanged && opts.isUnchanged('plants/index.html', dirHtml)) ? prev[dirLoc] : today });
    entries.sort(function (a, b) { return a.loc < b.loc ? -1 : a.loc > b.loc ? 1 : 0; });

    files['data/plant-routes.js'] = renderRoutes(slugs);
    files['sitemap.xml'] = renderSitemap(entries);
    files['robots.txt'] = renderRobots(baseUrl);
    return { files: files, plantCount: Object.keys(plants).length };
  }

  var api = {
    buildSite: buildSite, mergePlants: mergePlants, computeSlugs: computeSlugs,
    renderPlantPage: renderPlantPage, parseSitemap: parseSitemap,
    applyHomeSeo: applyHomeSeo, extractMedia: extractMedia, photoFor: photoFor
  };
  root.SSNPageBuilder = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
