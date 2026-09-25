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

  // ── Shared look: the same palette, type and motion as the main site ──
  var FONTS = '  <link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;1,9..144,300&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">\n';

  var CSS = [
  ':root{color-scheme:light;--ink:#1b2a20;--green:#1f3a2d;--green-deep:#142319;--green-mid:#2f6647;--gold:#b9893f;--gold-l:#e3c88a;--gold-text:#8d6724;--cream:#f8f3e8;--cream2:#efe7d6;--cream3:#faf6ed;--muted:#6b6457;--line:rgba(27,42,32,.13);--radius:4px}',
  '*{box-sizing:border-box;margin:0;padding:0}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}',
  'body{background:var(--cream);color:var(--ink);font:300 16px/1.7 Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif}',
  'img{max-width:100%;display:block}a{color:var(--green)}h1,h2,h3,h4{font-family:Fraunces,Georgia,serif;font-weight:400}',
  '.wrap{max-width:1180px;margin:0 auto;padding:0 32px}',
  /* top bar */
  '.top{position:sticky;top:0;z-index:100;background:rgba(248,243,232,.96);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}',
  '.top-in{max-width:1180px;margin:0 auto;padding:11px 32px;display:flex;align-items:center;gap:20px;min-height:62px}',
  '.brand{display:flex;align-items:center;gap:11px;text-decoration:none;color:var(--green);min-width:0}.brand img{width:34px;height:auto}',
  '.brand b{display:block;font:500 1rem/1.2 Fraunces,Georgia,serif;color:var(--green-deep)}',
  '.brand small{display:block;font-size:.58rem;letter-spacing:.07em;text-transform:uppercase;color:var(--gold-text);margin-top:2px}',
  '.links{margin-left:auto;display:flex;align-items:center;gap:26px;font-size:.86rem}',
  '.links a{position:relative;text-decoration:none;color:var(--ink);opacity:.68;transition:opacity .2s,color .2s}.links a:hover{opacity:1;color:var(--green)}',
  '.links a::after{content:"";position:absolute;left:0;right:0;bottom:-5px;height:1.5px;background:var(--gold);transform:scaleX(0);transform-origin:left;transition:transform .35s cubic-bezier(.22,1,.36,1)}',
  '.links a:hover::after,.links a[aria-current]::after{transform:scaleX(1)}',
  '.cta{background:var(--green);color:var(--cream)!important;opacity:1!important;padding:9px 20px;border-radius:var(--radius);font-size:.78rem;letter-spacing:.04em;white-space:nowrap;transition:background .2s}',
  '.cta:hover{background:var(--green-deep)}.cta::after{display:none!important}',
  /* back bar */
  '.backbar{background:var(--green-deep);border-bottom:1px solid rgba(185,137,63,.25);position:sticky;top:62px;z-index:90}',
  '.backbar-in{max-width:1180px;margin:0 auto;padding:13px 32px;display:flex;align-items:center;gap:18px}',
  '.backbar a{color:var(--gold-l);text-decoration:none;font-size:.82rem;letter-spacing:.03em;white-space:nowrap;transition:gap .2s,color .2s}',
  '.backbar .crumb{font-size:.76rem;color:rgba(248,243,232,.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}',
  '.backbar .pill{border:1px solid rgba(217,184,119,.35);padding:6px 13px;border-radius:16px}.backbar .pill:hover{background:rgba(217,184,119,.12)}',
  /* hero */
  '.phero{background:radial-gradient(120% 80% at 50% -5%,#234433 0%,var(--green-deep) 60%,#0e1810 100%);padding:60px 0 54px;color:var(--cream)}',
  '.phero-in{display:grid;grid-template-columns:300px 1fr;gap:60px;align-items:center}',
  '.phero-in.noimg{grid-template-columns:1fr;text-align:left}',
  '.pframe{width:280px;height:280px;border-radius:50%;overflow:hidden;border:2px solid var(--gold);background:rgba(248,243,232,.06);margin:0 auto;box-shadow:0 20px 50px rgba(0,0,0,.35)}',
  '.pframe img{width:100%;height:100%;object-fit:cover;transition:transform 1.3s cubic-bezier(.22,1,.36,1)}.pframe:hover img{transform:scale(1.07)}',
  '.pframe.empty{display:flex;align-items:center;justify-content:center}.pframe.empty svg{width:96px;height:96px;opacity:.55}',
  '.badge{display:inline-flex;align-items:center;gap:6px;background:rgba(185,137,63,.18);border:1px solid rgba(185,137,63,.4);color:var(--gold-l);padding:5px 14px;border-radius:20px;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;margin-bottom:16px;text-decoration:none}',
  '.phero h1{font-size:clamp(2.2rem,5.2vw,3.7rem);font-weight:300;line-height:1.05;letter-spacing:-.01em}',
  '.bot{font-family:Fraunces,Georgia,serif;font-style:italic;font-size:1.05rem;color:var(--gold-l);margin-top:8px}',
  '.ptag{color:rgba(248,243,232,.72);font-size:1rem;margin-top:14px;max-width:520px}',
  '.pacts{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}',
  '.btn{display:inline-block;padding:13px 28px;font-size:.85rem;letter-spacing:.04em;font-weight:500;border-radius:var(--radius);text-decoration:none;transition:all .22s;border:1px solid transparent;cursor:pointer}',
  '.btn-gold{background:var(--gold);color:var(--green-deep)}.btn-gold:hover{background:var(--gold-l)}',
  '.btn-line{border-color:rgba(248,243,232,.45);color:var(--cream)}.btn-line:hover{border-color:var(--cream);background:rgba(248,243,232,.07)}',
  '.btn-green{background:var(--green);color:var(--cream)}.btn-green:hover{background:var(--green-deep)}',
  /* care bar */
  '.carebar{background:var(--green);border-bottom:2px solid var(--gold);padding:20px 0}',
  '.carebar-in{display:flex;flex-wrap:wrap}',
  '.cstat{flex:1;min-width:160px;padding:12px 24px;border-right:1px solid rgba(248,243,232,.12)}.cstat:last-child{border-right:none}',
  '.cstat .ic{font-size:1.3rem;margin-bottom:4px}',
  '.cstat dt{font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-l);margin-bottom:4px}',
  '.cstat dd{font-size:.88rem;color:var(--cream)}',
  /* body */
  '.content{padding:64px 0}',
  '.pgrid{display:grid;grid-template-columns:1.55fr 1fr;gap:36px;margin-bottom:52px;align-items:start}',
  '.sec{background:var(--cream3);border:1px solid var(--line);border-radius:6px;padding:30px}',
  '.sec h2{font-size:1.12rem;font-weight:500;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px;color:var(--green-deep)}',
  '.sec p{font-size:.96rem;color:rgba(27,42,32,.78);line-height:1.75}',
  '.ulist{list-style:none;display:flex;flex-direction:column;gap:10px}',
  '.ulist li{display:flex;gap:10px;font-size:.9rem;color:rgba(27,42,32,.76)}.ulist li::before{content:"◆";color:var(--gold);font-size:.6rem;line-height:1.9}',
  '.facts{margin:22px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:6px;overflow:hidden}',
  '.facts div{background:var(--cream3);padding:13px 16px}',
  '.facts dt{font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-text);margin-bottom:3px}',
  '.facts dd{font-size:.9rem;color:var(--green-deep);line-height:1.5}',
  '.facts div:last-child:nth-child(odd){grid-column:1/-1}',
  '.supply{margin-top:22px;padding:15px 18px;border-left:3px solid var(--gold);background:rgba(185,137,63,.08);border-radius:0 6px 6px 0;font-size:.9rem;color:var(--muted)}',
  '.supply strong{color:var(--green-deep);font-weight:500}.supply a{color:var(--gold-text);font-weight:500}',
  '.h-rule{font-size:1.18rem;font-weight:500;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid var(--line);color:var(--green-deep)}',
  '.tips{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px;margin-bottom:10px}',
  '.tip{background:var(--cream3);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:6px;padding:20px 22px;font-size:.9rem;color:rgba(27,42,32,.76)}',
  /* enquire + related */
  '.enq{background:var(--green-deep);padding:46px 0;text-align:center;color:var(--cream)}',
  '.enq h2{font-weight:300;font-size:1.6rem;margin-bottom:8px}.enq p{color:rgba(248,243,232,.6);font-size:.92rem;margin-bottom:22px}',
  '.rel{background:var(--cream2);padding:60px 0}',
  '.rel h2{font-size:1.5rem;font-weight:300;color:var(--green-deep);margin-bottom:6px}',
  '.rel .sub{font-size:.85rem;color:var(--muted);margin-bottom:26px}',
  '.pcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px}',
  '.pcard{display:block;background:var(--cream);border:1px solid var(--line);border-radius:6px;padding:20px 22px;text-decoration:none;transition:transform .25s,box-shadow .25s,border-color .25s}',
  '.pcard:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(20,35,25,.1);border-color:var(--gold)}',
  '.pcard b{display:block;font:500 1rem/1.3 Fraunces,Georgia,serif;color:var(--green-deep)}',
  '.pcard i{display:block;font-size:.78rem;color:var(--muted);margin-top:4px}',
  '.pcard span{display:block;font-size:.74rem;color:var(--gold-text);margin-top:10px;letter-spacing:.05em}',
  /* directory */
  '.dhero{background:radial-gradient(120% 80% at 50% -5%,#234433 0%,var(--green-deep) 60%,#0e1810 100%);padding:70px 0 60px;color:var(--cream)}',
  '.dhero .eyebrow{font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-l);margin-bottom:14px;display:block}',
  '.dhero h1{font-size:clamp(2.2rem,5.6vw,4rem);font-weight:300;line-height:1.05}.dhero h1 em{font-style:italic;color:var(--gold-l)}',
  '.dhero p{color:rgba(248,243,232,.7);max-width:620px;margin-top:16px}',
  '.dsearch{margin-top:28px;max-width:520px;position:relative}',
  '.dsearch input{width:100%;background:rgba(248,243,232,.08);border:1px solid rgba(185,137,63,.45);border-radius:var(--radius);padding:14px 18px 14px 44px;color:var(--cream);font:300 .95rem Inter,sans-serif}',
  '.dsearch input::placeholder{color:rgba(248,243,232,.45)}.dsearch input:focus{outline:none;border-color:var(--gold-l);background:rgba(248,243,232,.12)}',
  '.dsearch svg{position:absolute;left:16px;top:50%;transform:translateY(-50%);width:17px;height:17px;stroke:rgba(248,243,232,.5);fill:none;stroke-width:2}',
  '.dcount{margin-top:12px;font-size:.8rem;color:rgba(248,243,232,.55)}',
  '.chipbar{position:sticky;top:62px;z-index:80;background:var(--cream2);border-bottom:1px solid var(--line)}',
  '.chipbar-in{max-width:1180px;margin:0 auto;padding:12px 32px;display:flex;gap:9px;overflow-x:auto;-webkit-overflow-scrolling:touch}',
  '.chip{white-space:nowrap;border:1px solid var(--line);background:var(--cream);color:var(--muted);border-radius:18px;padding:7px 15px;font-size:.78rem;text-decoration:none;transition:all .2s}',
  '.chip:hover,.chip.on{background:var(--green);border-color:var(--green);color:var(--cream)}',
  '.catsec{padding:52px 0 8px}.catsec:nth-child(even){background:var(--cream3)}',
  '.cathead{margin-bottom:26px}',
  '.cathead .eyebrow{font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-text);display:block;margin-bottom:8px}',
  '.cathead h2{font-size:1.9rem;font-weight:300;color:var(--green-deep)}',
  '.cathead p{font-size:.88rem;color:var(--muted);margin-top:6px}',
  '.empty-note{display:none;text-align:center;padding:60px 20px;color:var(--muted)}',
  /* footer */
  '.foot{background:var(--green-deep);color:rgba(248,243,232,.72);font-size:.88rem}',
  '.foot-in{max-width:1180px;margin:0 auto;padding:46px 32px;display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:34px}',
  '.foot h3{color:var(--cream);font-size:1.05rem;font-weight:300;margin-bottom:12px}',
  '.foot a{color:var(--gold-l);text-decoration:none}.foot a:hover{text-decoration:underline}.foot p{margin-bottom:7px}',
  '.foot-copy{border-top:1px solid rgba(248,243,232,.1);text-align:center;padding:16px 24px;font-size:.74rem;color:rgba(248,243,232,.5)}',
  /* motion */
  '.rv{opacity:0;transform:translateY(18px);transition:opacity .7s ease,transform .7s ease}.rv.in{opacity:1;transform:none}',
  '@media (prefers-reduced-motion:reduce){.rv{opacity:1!important;transform:none!important;transition:none!important}*{scroll-behavior:auto!important}}',
  /* WhatsApp button on phones */
  '.wafab{display:none}',
  '@media(max-width:900px){.links a:not(.cta){display:none}.phero-in{grid-template-columns:1fr;gap:30px}.pframe{width:220px;height:220px}.pgrid{grid-template-columns:1fr}.foot-in{grid-template-columns:1fr}.cstat{border-right:none;border-bottom:1px solid rgba(248,243,232,.12)}}',
  '@media(max-width:768px){.wafab{display:flex;position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:850;width:54px;height:54px;border-radius:50%;background:#1f7a47;color:#fff;align-items:center;justify-content:center;box-shadow:0 10px 26px rgba(20,35,25,.35);text-decoration:none}}',
  '@media(max-width:600px){.wrap,.top-in,.backbar-in,.foot-in,.chipbar-in{padding-left:18px;padding-right:18px}.brand small{display:none}.sec{padding:22px 20px}.facts{grid-template-columns:1fr}.facts div:last-child:nth-child(odd){grid-column:auto}.backbar .crumb{display:none}.content{padding:42px 0}.catsec{padding:36px 0 4px}}'
  ].join('\n');

  var REVEAL_JS = '<script>(function(){var y=new Date().getFullYear(),c=document.querySelector(".js-year");if(c&&y>+c.textContent)c.textContent=y;' +
    'var els=[].slice.call(document.querySelectorAll(".rv"));' +
    'if(!("IntersectionObserver" in window)||matchMedia("(prefers-reduced-motion:reduce)").matches){els.forEach(function(e){e.classList.add("in");});return;}' +
    'var io=new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){x.target.classList.add("in");io.unobserve(x.target);}});},{rootMargin:"0px 0px -8% 0px"});' +
    'els.forEach(function(e){io.observe(e);});})();</script>\n';

  var LEAF_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 42V20M24 20C24 20 12 18 12 8 12 8 24 8 24 20 24 8 36 8 36 8 36 18 24 20 24 20Z" stroke="#e3c88a" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>';

  function chromeTop(rel, here) {
    function link(href, label) {
      return '<a href="' + href + '"' + (here === label ? ' aria-current="page"' : '') + '>' + label + '</a>';
    }
    return '<header class="top"><div class="top-in">' +
      '<a class="brand" href="' + rel + '"><img src="' + rel + 'images/gallery-e92598cf.png" alt="" width="34" height="43"><span><b>Gangumalla&rsquo;s Sri Satyanarayana Nursery</b><small>Kadiyapulanka, Andhra Pradesh</small></span></a>' +
      '<nav class="links" aria-label="Main">' + link(rel, 'Home') + link(rel + '#catalog', 'Full Catalogue') +
      link(rel + '#about', 'Our Heritage') + link(rel + '#gallery', 'Gallery') +
      '<a class="cta" href="' + rel + '#contact">Visit &amp; Enquire</a></nav>' +
      '</div></header>\n';
  }
  function waFab() {
    return '<a class="wafab" href="https://wa.me/' + PHONE_WA + '" target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp">' +
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.7.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.08-.12-.28-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 01-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 01-1.51-5.26c0-5.45 4.44-9.89 9.89-9.89 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 012.89 6.99c0 5.45-4.43 9.89-9.88 9.89m8.41-18.3A11.82 11.82 0 0012.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 005.69 1.45c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 00-3.48-8.42z"/></svg></a>\n';
  }
  function chromeFoot(rel) {
    return '<footer class="foot"><div class="foot-in">' +
      '<div><h3>Gangumalla&rsquo;s Sri Satyanarayana Nursery</h3><p>Family-run wholesale and retail nursery since 1963, grown by Gangumalla Satyanarayana &amp; Bros.</p><p>Kadiyapulanka Village, Kadiyam Mandal,<br>East Godavari District, Andhra Pradesh &ndash; 533126</p></div>' +
      '<div><h3>Contact</h3><p><a href="tel:+919440179027">+91 94401 79027</a></p><p><a href="https://wa.me/' + PHONE_WA + '" rel="noopener">WhatsApp &mdash; 24/7</a></p><p><a href="mailto:srisatyanarayananursery@yahoo.co.in">srisatyanarayananursery@yahoo.co.in</a></p></div>' +
      '<div><h3>Explore</h3><p><a href="' + rel + '#catalog">Full catalogue</a></p><p><a href="' + rel + 'plants/">Plant index (A&ndash;Z)</a></p><p><a href="' + rel + '#gallery">Gallery</a></p><p><a href="' + rel + '#contact">Visit &amp; enquire</a></p></div>' +
      '</div><div class="foot-copy">&copy; 1963&ndash;<span class="js-year">' + new Date().getFullYear() + '</span> Gangumalla&rsquo;s Sri Satyanarayana Nursery. All rights reserved. Design, text and photographs may not be copied or reused.</div></footer>\n';
  }
  function head(o) {
    return '<!doctype html>\n<!-- © ' + NURSERY + '. All rights reserved. Design, code, text and photographs may not be copied or reused without written permission. -->\n<html lang="en-IN">\n<head>\n' +
      '  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n' +
      '  <title>' + esc(o.title) + '</title>\n' +
      '  <meta name="description" content="' + esc(o.desc) + '">\n' +
      '  <link rel="canonical" href="' + esc(o.canonical) + '">\n' +
      '  <link rel="icon" type="image/png" href="' + o.rel + 'images/gallery-e92598cf.png">\n' +
      '  <link rel="apple-touch-icon" href="' + o.rel + 'images/gallery-e92598cf.png">\n' +
      '  <link rel="manifest" href="' + o.rel + 'site.webmanifest">\n' +
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
      '  <style>\n' + CSS + '\n  </style>\n' +
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
    var description = plant.description || (name + ' from ' + NURSERY + ', Kadiyapulanka, Andhra Pradesh.');
    var metaDesc = description.length > 155 ? description.slice(0, 152).replace(/\s+\S*$/, '') + '…' : description;
    var catLabel = categoryLabel(plant, ctx.categories);
    var botanical = plant.botanical && plant.botanical !== '—' ? plant.botanical : '';
    var title = name + (botanical && botanical.toLowerCase() !== name.toLowerCase() ? ' (' + botanical + ')' : '') + ' | ' + NURSERY;
    var photo = (ctx.photos && ctx.photos[key]) || '';
    var image = photo ? baseUrl + '/' + photo : baseUrl + '/' + OG_IMAGE;
    var rel = '../../';

    var related = (Array.isArray(plant.related) ? plant.related : [])
      .filter(function (r) { return ctx.plants[r] && ctx.slugs[r] && r !== key; }).slice(0, 4);
    var relatedHtml = related.map(function (r) {
      var p = ctx.plants[r], b = p.botanical && p.botanical !== '—' ? p.botanical : '';
      return '<a class="pcard" href="../' + esc(ctx.slugs[r]) + '/"><b>' + esc(p.name) + '</b>' +
        (b ? '<i>' + esc(b) + '</i>' : '') + '<span>View plant &rarr;</span></a>';
    }).join('');

    var care = plant.care || {};
    var CARE = [['water','Water','💧'],['light','Light','☀️'],['soil','Soil','🌱'],['growth','Growth','📈'],['difficulty','Difficulty','⭐']];
    var careHtml = CARE.filter(function (c) { return String(care[c[0]] || '').trim(); })
      .map(function (c) { return '<div class="cstat"><div class="ic">' + c[2] + '</div><dt>' + c[1] + '</dt><dd>' + esc(care[c[0]]) + '</dd></div>'; }).join('');

    var facts = (plant.facts && typeof plant.facts === 'object') ? plant.facts : {};
    var FACT_ROWS = [['family','Family'],['origin','Native to'],['size','Mature size'],['season','Season'],['highlight','Known for']];
    var factsHtml = FACT_ROWS.filter(function (r) { return String(facts[r[0]] || '').trim(); })
      .map(function (r) { return '<div><dt>' + r[1] + '</dt><dd>' + esc(facts[r[0]]) + '</dd></div>'; }).join('');

    var uses = (Array.isArray(plant.uses) ? plant.uses : []).filter(Boolean);
    var tips = (Array.isArray(plant.tips) ? plant.tips : []).filter(Boolean);

    var waText = 'Hello, I found ' + name + ' on your website and would like to know its availability and sizes.';
    var waHref = 'https://wa.me/' + PHONE_WA + '?text=' + encodeURIComponent(waText);

    var ld = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', '@id': url, url: url, name: title, description: metaDesc, inLanguage: 'en-IN',
          primaryImageOfPage: photo ? { '@type': 'ImageObject', url: image } : undefined,
          isPartOf: { '@type': 'WebSite', name: NURSERY, url: baseUrl + '/' },
          about: { '@type': 'Thing', name: name, alternateName: botanical || undefined, description: plant.tagline || undefined },
          publisher: { '@id': baseUrl + '/#nursery' } },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl + '/' },
          { '@type': 'ListItem', position: 2, name: 'Plant Directory', item: baseUrl + '/plants/' },
          { '@type': 'ListItem', position: 3, name: name, item: url } ] }
      ]
    };

    return head({ title: title, desc: metaDesc, canonical: canonUrl, image: image, ld: ld, rel: rel, ogTitle: name }) +
'<body>\n' + chromeTop(rel) +
'<div class="backbar"><div class="backbar-in">' +
  '<a href="../../#catalog">&larr; Full catalogue</a>' +
  '<span class="crumb">' + esc(catLabel) + ' / ' + esc(name) + '</span>' +
  '<a class="pill" href="' + esc(waHref) + '" rel="noopener">Enquire on WhatsApp</a>' +
'</div></div>\n' +
'<section class="phero"><div class="wrap phero-in' + (photo ? '' : ' noimg') + '">\n' +
(photo ? '  <div class="pframe"><img src="../../' + esc(photo) + '" alt="' + esc(name + (botanical ? ' (' + botanical + ')' : '') + ' grown at Gangumalla’s Sri Satyanarayana Nursery') + '" width="560" height="560"></div>\n'
       : '  <div class="pframe empty">' + LEAF_SVG + '</div>\n') +
'  <div>\n' +
'    <a class="badge" href="../../#catalog/' + encodeURIComponent(plant.cat || '') + '">' + esc(catLabel) + '</a>\n' +
'    <h1>' + esc(name) + '</h1>\n' +
(botanical ? '    <div class="bot">' + esc(botanical) + '</div>\n' : '') +
(plant.tagline ? '    <p class="ptag">' + esc(plant.tagline) + '</p>\n' : '') +
'    <div class="pacts"><a class="btn btn-gold wa" href="' + esc(waHref) + '" rel="noopener">Ask on WhatsApp</a><a class="btn btn-line" href="../../#quote/add/' + encodeURIComponent(key) + '">&#128722; Add to quote request</a></div>\n' +
'  </div>\n</div></section>\n' +
(careHtml ? '<div class="carebar"><div class="wrap"><dl class="carebar-in">' + careHtml + '</dl></div></div>\n' : '') +
'<section class="content"><div class="wrap">\n' +
'  <div class="pgrid">\n' +
'    <article class="sec rv"><h2><span>📖</span> About This Plant</h2>\n' +
'      <p>' + esc(description) + '</p>\n' +
(factsHtml ? '      <dl class="facts">' + factsHtml + '</dl>\n' : '') +
'      <p class="supply"><strong>' + esc(name) + '</strong>' + (botanical ? ' (<em>' + esc(botanical) + '</em>)' : '') + ' is grown and supplied by Gangumalla&rsquo;s Sri Satyanarayana Nursery at Kadiyapulanka, Andhra Pradesh. Available wholesale and retail in a range of sizes. <a href="../../#contact">Contact us</a> for current stock, sizing and pricing.</p>\n' +
'    </article>\n' +
(uses.length ? '    <aside class="sec rv"><h2><span>🌿</span> Where to Use It</h2><ul class="ulist">' +
    uses.map(function (u) { return '<li>' + esc(u) + '</li>'; }).join('') + '</ul></aside>\n' : '') +
'  </div>\n' +
(tips.length ? '  <h2 class="h-rule rv">💡 &nbsp;Care Tips &amp; Growing Guide</h2>\n  <div class="tips rv">' +
  tips.map(function (t) { return '<div class="tip">' + esc(t) + '</div>'; }).join('') + '</div>\n' : '') +
'</div></section>\n' +
'<section class="enq"><div class="wrap">\n' +
'  <h2>Interested in ' + esc(name) + '?</h2>\n' +
'  <p>Available wholesale and retail &mdash; contact us for current pricing, sizes and availability.</p>\n' +
'  <a class="btn btn-gold" href="../../#contact">Send an Enquiry</a>\n' +
'</div></section>\n' +
(relatedHtml ? '<section class="rel"><div class="wrap"><h2>You may also like</h2><p class="sub">More from ' + esc(catLabel) + '</p><div class="pcards rv">' + relatedHtml + '</div></div></section>\n' : '') +
chromeFoot(rel) + waFab() + REVEAL_JS +
'</body></html>\n';
  }

  // ── 3b. The plant directory: every plant, one crawlable page ──
  function renderDirectory(ctx) {
    var baseUrl = cleanBase(ctx.baseUrl);
    var url = baseUrl + '/plants/';
    var ICONS = { avenue:'🌳', flowering:'🌼', fruit:'🍎', palm:'🌴', shrub:'🌿',
                  ground:'🌱', aquatic:'🌊', desert:'🌵', ficus:'🌲', indoor:'🪴', pots:'🏺' };
    var BLURB = { avenue:'Shade and boulevard trees grown for straight trunks and full canopies.',
      flowering:'Trees and shrubs grown for their season of colour.',
      fruit:'Grafted and seedling fruit for orchards, farms and home gardens.',
      palm:'Architectural palms and cycads for entrances, avenues and courtyards.',
      shrub:'Hedging, borders, topiary and mass colour.',
      ground:'Low spreading cover for slopes, edges and under-planting.',
      aquatic:'Lotus, lilies and marginals for ponds and water features.',
      desert:'Drought-hardy succulents, cacti and desert specimens.' };
    var groups = {}, order = [];
    Object.keys(ctx.plants).forEach(function (k) {
      var p = ctx.plants[k], cat = p.cat || 'other';
      if (!groups[cat]) { groups[cat] = { label: categoryLabel(p, ctx.categories), items: [] }; order.push(cat); }
      groups[cat].items.push(k);
    });
    var total = Object.keys(ctx.plants).length;
    var sections = order.map(function (cat) {
      var g = groups[cat];
      g.items.sort(function (a, b) { return String(ctx.plants[a].name).localeCompare(String(ctx.plants[b].name)); });
      return '<section class="catsec" id="' + esc(cat) + '" data-cat="' + esc(cat) + '"><div class="wrap">' +
        '<div class="cathead rv"><span class="eyebrow">Collection</span><h2>' + (ICONS[cat] ? ICONS[cat] + ' ' : '') + esc(g.label) + '</h2>' +
        '<p>' + esc(BLURB[cat] || 'Grown and supplied from our own fields at Kadiyapulanka.') + ' &mdash; <em>' + g.items.length + ' varieties, more available on request</em></p></div>' +
        '<div class="pcards">' + g.items.map(function (k) {
          var p = ctx.plants[k], target = (ctx.canonical && ctx.canonical[k]) || k;
          var b = p.botanical && p.botanical !== '—' && p.botanical.toLowerCase() !== String(p.name).toLowerCase() ? p.botanical : '';
          return '<a class="pcard" href="' + esc(ctx.slugs[target]) + '/" data-name="' + esc(String(p.name).toLowerCase() + ' ' + b.toLowerCase()) + '">' +
            '<b>' + esc(p.name) + '</b>' + (b ? '<i>' + esc(b) + '</i>' : '') + '<span>View plant &rarr;</span></a>';
        }).join('') + '</div>' +
        '<p class="empty-note">No plant in this collection matches your search.</p>' +
        '</div></section>\n';
    }).join('');
    var chips = order.map(function (cat) {
      return '<a class="chip" href="#' + esc(cat) + '">' + (ICONS[cat] ? ICONS[cat] + ' ' : '') + esc(groups[cat].label) + ' &middot; ' + groups[cat].items.length + '</a>';
    }).join('');
    var desc = 'Browse all ' + total + ' plants grown and supplied by ' + NURSERY + ' at Kadiyapulanka, Andhra Pradesh — avenue trees, flowering trees, palms, fruit plants, shrubs, ground cover, aquatic and desert plants.';
    var ld = { '@context': 'https://schema.org', '@graph': [
      { '@type': 'CollectionPage', '@id': url, url: url, name: 'Plant Directory', description: desc, inLanguage: 'en-IN',
        isPartOf: { '@type': 'WebSite', name: NURSERY, url: baseUrl + '/' }, publisher: { '@id': baseUrl + '/#nursery' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl + '/' },
        { '@type': 'ListItem', position: 2, name: 'Plant Directory', item: url } ] } ] };
    var searchJs = '<script>(function(){var i=document.getElementById("dq"),c=document.getElementById("dcount"),' +
      'cards=[].slice.call(document.querySelectorAll(".pcard[data-name]")),secs=[].slice.call(document.querySelectorAll(".catsec"));' +
      'if(!i)return;var total=cards.length;' +
      'function run(){var q=i.value.trim().toLowerCase(),n=0;' +
      'cards.forEach(function(a){var hit=!q||a.getAttribute("data-name").indexOf(q)>=0;a.style.display=hit?"":"none";if(hit)n++;});' +
      'secs.forEach(function(s){var vis=[].slice.call(s.querySelectorAll(".pcard")).some(function(a){return a.style.display!=="none";});' +
      's.style.display=(q&&!vis)?"none":"";var e=s.querySelector(".empty-note");if(e)e.style.display="none";});' +
      'c.textContent=q?(n+" of "+total+" plants match \\u201c"+i.value.trim()+"\\u201d"):(total+" plants, in 8 collections");}' +
      'i.addEventListener("input",run);run();})();</script>\n';
    return head({ title: 'Plant Directory — all ' + total + ' plants | ' + NURSERY, desc: desc, canonical: url,
                  image: baseUrl + '/' + OG_IMAGE, ld: ld, rel: '../', ogTitle: 'Plant Directory' }) +
'<body>\n' + chromeTop('../', 'Plant Directory') +
'<section class="dhero"><div class="wrap">\n' +
'  <span class="eyebrow">Plant Directory</span>\n' +
'  <h1>Every plant we grow,<br><em>all ' + total + ' of them</em>.</h1>\n' +
'  <p>Grown, trained and supplied from our own fields at Kadiyapulanka since 1963. Open any plant for its description, care guide and quick facts.</p>\n' +
'  <div class="dsearch"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5" stroke-linecap="round"/></svg>' +
'    <input id="dq" type="search" placeholder="Search by plant or botanical name" aria-label="Search plants" autocomplete="off"></div>\n' +
'  <p class="dcount" id="dcount">' + total + ' plants, in ' + order.length + ' collections</p>\n' +
'</div></section>\n' +
'<div class="chipbar"><div class="chipbar-in">' + chips + '</div></div>\n' +
sections +
'<section class="enq"><div class="wrap">\n' +
'  <h2>Cannot find what you are looking for?</h2>\n' +
'  <p>We carry far more than is listed here, and we source to order. Tell us the plant, the size and the quantity.</p>\n' +
'  <a class="btn btn-gold" href="../#contact">Send an Enquiry</a>\n' +
'</div></section>\n' +
chromeFoot('../') + waFab() + searchJs + REVEAL_JS +
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
    // admin.html and vip.html are deliberately not named here. Listing them
    // published their address to every scraper that reads robots.txt, and it
    // worked against itself: Disallow stops a crawler fetching the page, so it
    // never reads the noindex tag those pages already carry, and the bare URL
    // can still end up indexed if anything links to it. The meta tag alone
    // keeps them out of results without advertising where they live.
    return 'User-agent: *\nAllow: /\n\nSitemap: ' +
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
