#!/usr/bin/env ruby

require 'json'
require 'fileutils'

ROOT = File.expand_path('..', __dir__)
source = File.read(File.join(ROOT, 'data', 'plants.js'))
json = source[/window\.PLANT_DATA_RAW\s*=\s*(\{.*\});?\s*\z/m, 1]
abort 'Could not find PLANT_DATA_RAW in data/plants.js' unless json
plants = JSON.parse(json)

def esc(value)
  value.to_s.gsub('&', '&amp;').gsub('<', '&lt;').gsub('>', '&gt;').gsub('"', '&quot;')
end

def slug_for(key, plant)
  (key.split('__', 2).last || plant['name']).downcase.gsub(/[^a-z0-9]+/, '-').gsub(/\A-|-$|\s+/, '')
end

base_url = 'https://adityakottu.github.io/srisatyanarayananursery1'
slugs = {}
used_slugs = {}
plants.each do |key, plant|
  candidate = slug_for(key, plant)
  if used_slugs[candidate]
    category = key.split('__', 2).first
    candidate = "#{category}-#{candidate}"
  end
  suffix = 2
  while used_slugs[candidate]
    candidate = "#{slug_for(key, plant)}-#{suffix}"
    suffix += 1
  end
  slugs[key] = candidate
  used_slugs[candidate] = true
end

plants.each do |key, plant|
  slug = slugs[key]
  description = plant['description'] || "#{plant['name']} from Sri Satyanarayana Nursery, Kadiyapulanka, Kadiyam."
  related = Array(plant['related']).filter { |related_key| plants.key?(related_key) }.first(4)
  related_html = related.map do |related_key|
    related_plant = plants[related_key]
    related_slug = slugs[related_key]
    "<li><a href=\"../../plants/#{esc(related_slug)}/\">#{esc(related_plant['name'])}</a></li>"
  end.join
  care_html = (plant['care'] || {}).map { |label, value| "<li><strong>#{esc(label.capitalize)}:</strong> #{esc(value)}</li>" }.join
  title = "#{plant['name']} | Sri Satyanarayana Nursery"
  page = <<~HTML
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>#{esc(title)}</title>
      <meta name="description" content="#{esc(description[0, 155])}">
      <link rel="canonical" href="#{base_url}/plants/#{esc(slug)}/">
      <style>
        :root{color-scheme:light;--ink:#1b2a20;--green:#1f3a2d;--gold:#b9893f;--cream:#f8f3e8;--line:rgba(27,42,32,.14)}
        *{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font:16px/1.65 Georgia,serif}
        main{max-width:820px;margin:0 auto;padding:8vh 24px}.eyebrow{color:var(--gold);font:600 12px/1.2 Arial,sans-serif;letter-spacing:.15em;text-transform:uppercase}
        h1{font-size:clamp(2.3rem,7vw,4.5rem);line-height:1.05;font-weight:400;margin:18px 0 8px}.botanical{color:#6b6457;font-style:italic}
        .intro{font-size:1.15rem;max-width:680px;margin:30px 0}.panel{border-top:1px solid var(--line);padding:24px 0;margin-top:30px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:36px}.button{display:inline-block;background:var(--green);color:var(--cream);padding:12px 18px;text-decoration:none;font:600 14px Arial,sans-serif}
        ul{padding-left:20px}a{color:var(--green)}@media(max-width:600px){.grid{grid-template-columns:1fr}}
      </style>
      <script type="application/ld+json">#{JSON.generate('@context' => 'https://schema.org', '@type' => 'Product', 'name' => plant['name'], 'description' => description, 'url' => "#{base_url}/plants/#{slug}/", 'brand' => {'@type' => 'Brand', 'name' => 'Sri Satyanarayana Nursery'})}</script>
    </head>
    <body><main>
      <a href="../../#catalog">&larr; Full catalogue</a>
      <p class="eyebrow">#{esc(plant['catLabel'] || 'Plant collection')}</p>
      <h1>#{esc(plant['name'])}</h1>
      #{plant['botanical'] && plant['botanical'] != '—' ? "<div class=\"botanical\">#{esc(plant['botanical'])}</div>" : ''}
      <p class="intro">#{esc(description)}</p>
      <div class="grid"><section class="panel"><h2>Care guide</h2><ul>#{care_html}</ul></section>
      <section class="panel"><h2>Related plants</h2><ul>#{related_html}</ul></section></div>
      <section class="panel"><a class="button" href="../../#contact">Ask about availability</a></section>
    </main></body></html>
  HTML
  destination = File.join(ROOT, 'plants', slug, 'index.html')
  FileUtils.mkdir_p(File.dirname(destination))
  File.write(destination, page)
end
routes = slugs.transform_values { |slug| "plants/#{slug}/" }
File.write(File.join(ROOT, 'data', 'plant-routes.js'), "window.PLANT_ROUTES = #{JSON.generate(routes)};\n")
puts "Generated #{plants.length} plant pages"
