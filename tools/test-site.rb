#!/usr/bin/env ruby

require 'json'
require 'net/http'
require 'uri'

Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8

ROOT = File.expand_path('..', __dir__)
errors = []

read = ->(path) { File.read(File.join(ROOT, path)) }
expect = ->(condition, message) { errors << message unless condition }

plants_source = read.call('data/plants.js')
plants_json = plants_source[/window\.PLANT_DATA_RAW\s*=\s*(\{.*\});?\s*\z/m, 1]
expect.call(plants_json, 'data/plants.js does not expose PLANT_DATA_RAW')
plants = plants_json ? JSON.parse(plants_json) : {}

routes_source = read.call('data/plant-routes.js')
routes_json = routes_source[/window\.PLANT_ROUTES\s*=\s*(\{.*\});?\s*\z/m, 1]
routes = routes_json ? JSON.parse(routes_json) : {}
expect.call(plants.length == 390, "expected 390 plant records, found #{plants.length}")

# Custom plants published from the admin also get pages
published_src = File.exist?(File.join(ROOT, 'data', 'site-content.js')) ? read.call('data/site-content.js') : ''
published_json = published_src[/window\.SSN_PUBLISHED\s*=\s*(\{.*\});?\s*\z/m, 1]
published = (JSON.parse(published_json) rescue {}) if published_json
custom = ((published || {})['ssn_custom_plants'] || {}).select { |_, p| p.is_a?(Hash) && p['name'].to_s.strip != '' }
expected_keys = plants.keys | custom.keys
expect.call(routes.keys.sort == expected_keys.sort, "routes (#{routes.length}) do not match base + published plants (#{expected_keys.length})")
page_dirs = Dir.glob(File.join(ROOT, 'plants', '*', 'index.html')).map { |f| File.basename(File.dirname(f)) }.sort
expect.call(page_dirs == routes.values.map { |r| r.split('/')[1] }.sort, 'plant page folders do not match the route map')

# Site address lives in one place, and every generated file uses it
config = read.call('data/site-config.js')
site_url = config[/"baseUrl"\s*:\s*"([^"]+)"/, 1].to_s.sub(%r{/+\z}, '')
expect.call(site_url.start_with?('https://'), 'data/site-config.js baseUrl must be an https address')
sample = page_dirs.first(25) + page_dirs.last(5)
sample.each do |slug|
  page = read.call("plants/#{slug}/index.html")
  expect.call(page =~ %r{<link rel="canonical" href="#{Regexp.escape(site_url)}/plants/[a-z0-9-]+/">}, "#{slug}: canonical does not use the configured site address")
  expect.call(!page.include?('"@type":"Product"'), "#{slug}: Product schema without offers is invalid for Google")
end
sitemap = read.call('sitemap.xml') rescue ''
# Every page is in the sitemap except duplicates that point their canonical at a twin
canon_pages = page_dirs.select { |slug| read.call("plants/#{slug}/index.html").include?(%(<link rel="canonical" href="#{site_url}/plants/#{slug}/">)) }
expect.call(sitemap.scan('<loc>').length == canon_pages.length + 2, "sitemap.xml should list #{canon_pages.length} canonical plant pages, the directory and the home page")
expect.call(sitemap.include?("<loc>#{site_url}/plants/</loc>") && File.exist?(File.join(ROOT, 'plants', 'index.html')), 'plant directory page missing or not in the sitemap')
dir = read.call('plants/index.html')
expect.call(dir.scan('<li><a href=').length == routes.length, 'plant directory does not link every plant')
expect.call(sitemap.include?("<loc>#{site_url}/</loc>"), 'sitemap.xml does not use the configured site address')
robots = read.call('robots.txt') rescue ''
expect.call(robots.include?("Sitemap: #{site_url}/sitemap.xml"), 'robots.txt does not point at the sitemap')
expect.call(File.exist?(File.join(ROOT, 'data', 'page-builder.js')), 'data/page-builder.js is missing — publish cannot rebuild pages')
home = read.call('index.html')
expect.call(home.include?(%(<link rel="canonical" href="#{site_url}/">)), 'index.html canonical does not use the configured site address')
expect.call(home.include?('"@type":"GardenStore"'), 'index.html is missing its local business details')

index = read.call('index.html')
admin = read.call('admin.html')
vip = read.call('vip.html')
expect.call(index.include?('data/site-content.js'), 'public page does not load published content')
expect.call(admin.include?("GH_CONTENT_PATH = 'data/site-content.js'"), 'Admin publish path is not data/site-content.js')
expect.call(admin.include?('data/page-builder.js'), 'Admin does not load the shared page builder')
expect.call(admin.include?('ghConflict'), 'Admin publish has no conflict protection')
expect.call(admin.include?('window.SSN_PUBLISHED'), 'Admin does not build the published payload')
expect.call(vip.include?('window.SSN_PUBLISHED'), 'VIP page does not consume published content')
expect.call(index.include?('Who we <em>supply</em>'), 'Who We Supply section is missing')

base_url = ENV['LIVE_BASE_URL']
if base_url
  %w[/ /admin.html /vip.html?key=vip2024ssn /data/site-content.js].each do |path|
    uri = URI.join(base_url.end_with?('/') ? base_url : "#{base_url}/", path.sub(%r{\A/}, ''))
    response = Net::HTTP.get_response(uri)
    expect.call(response.is_a?(Net::HTTPSuccess), "#{uri} returned HTTP #{response.code}")
  end
  live_index = Net::HTTP.get(URI.join(base_url.end_with?('/') ? base_url : "#{base_url}/", ''))
  live_vip = Net::HTTP.get(URI.join(base_url.end_with?('/') ? base_url : "#{base_url}/", 'vip.html?key=vip2024ssn'))
  expect.call(live_index.include?('Who we'), 'live public page is missing Who We Supply')
  expect.call(live_vip.include?('Private Collection'), 'live VIP page is missing private collection content')
end

if errors.empty?
  puts "PASS: #{plants.length} base plants, #{routes.length} routes and pages, sitemap, robots, site address, shared publish wiring#{base_url ? ', and live endpoints' : ''}."
else
  warn errors.map { |error| "FAIL: #{error}" }
  exit 1
end
