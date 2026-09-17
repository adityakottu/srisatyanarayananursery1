#!/usr/bin/env ruby

require 'json'
require 'net/http'
require 'uri'

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
expect.call(routes.length == plants.length, "route count #{routes.length} does not match plant count #{plants.length}")
expect.call(Dir.glob(File.join(ROOT, 'plants', '*', 'index.html')).length == plants.length, 'generated plant pages do not match plant records')

index = read.call('index.html')
admin = read.call('admin.html')
vip = read.call('vip.html')
expect.call(index.include?('data/site-content.js'), 'public page does not load published content')
expect.call(admin.include?("path:'data/site-content.js'"), 'Admin publish path is not data/site-content.js')
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
  puts "PASS: #{plants.length} plants, #{routes.length} routes, generated pages, shared publish wiring#{base_url ? ', and live endpoints' : ''}."
else
  warn errors.map { |error| "FAIL: #{error}" }
  exit 1
end
