#!/usr/bin/env ruby
# Kept so existing habits still work. The template now lives in
# data/page-builder.js, shared with the admin panel's Publish Now, so the
# real work is done by the Node version to guarantee identical output.
exec('node', File.join(__dir__, 'generate-plant-pages.js'))
