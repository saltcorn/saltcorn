#!/usr/bin/env ruby
# frozen_string_literal: true

# Adds a "share-ext" Share Extension target to an existing Capacitor iOS
# project (App.xcodeproj), so the app can be built with iOS share-to support
# without ever opening Xcode. Replaces the manual "File -> New -> Target ->
# Share Extension" step previously documented as a tutorial in the admin UI.
#
# Usage:
#   create_share_extension.rb <project_path> <bundle_id> [entitlements_path]
#
#   project_path        path to App.xcodeproj
#   bundle_id            PRODUCT_BUNDLE_IDENTIFIER for the new target
#   entitlements_path    optional, path (relative to the project dir) to an
#                        entitlements plist for the new target (app group)

require "xcodeproj"

project_path, bundle_id, entitlements_path = ARGV
if project_path.nil? || bundle_id.nil?
  abort "Usage: create_share_extension.rb <project_path> <bundle_id> [entitlements_path]"
end

TARGET_NAME = "share-ext"

project = Xcodeproj::Project.open(project_path)
app_target = project.targets.find { |t| t.name == "App" }
abort "App target not found in #{project_path}" unless app_target

# safe to run again: clear a previous run's leftovers, dependency first
app_target.dependencies.each do |dep|
  dep.remove_from_project if dep.target.nil? || dep.target.name == TARGET_NAME
end
if (existing_target = project.targets.find { |t| t.name == TARGET_NAME })
  existing_target.remove_from_project
end
if (existing_group = project.main_group.find_subpath(TARGET_NAME))
  existing_group.remove_from_project
end
app_target.copy_files_build_phases.each do |phase|
  next unless phase.name == "Embed Foundation Extensions"
  phase.files.each { |f| phase.remove_file_reference(f.file_ref) }
end

deployment_target = app_target.deployment_target
ext_target = project.new_target(
  :app_extension, TARGET_NAME, :ios, deployment_target, nil, :swift
)

group = project.main_group.new_group(TARGET_NAME, TARGET_NAME)
swift_ref = group.new_file("ShareViewController.swift")
group.new_file("Info.plist")
ext_target.source_build_phase.add_file_reference(swift_ref)

app_swift_version =
  app_target.build_configurations.first.build_settings["SWIFT_VERSION"] || "5.0"
app_device_family =
  app_target.build_configurations.first.build_settings["TARGETED_DEVICE_FAMILY"] ||
  "1,2"
app_supported_platforms =
  app_target.build_configurations.first.build_settings["SUPPORTED_PLATFORMS"] ||
  "iphoneos iphonesimulator"
app_project_version =
  app_target.build_configurations.first.build_settings["CURRENT_PROJECT_VERSION"] ||
  "1"

ext_target.build_configurations.each do |config|
  config.build_settings["PRODUCT_NAME"] = "$(TARGET_NAME)"
  config.build_settings["PRODUCT_BUNDLE_IDENTIFIER"] = bundle_id
  config.build_settings["INFOPLIST_FILE"] = "#{TARGET_NAME}/Info.plist"
  # matches Xcode's own default - a later build step sets the real version
  config.build_settings["MARKETING_VERSION"] = "1.0"
  config.build_settings["SWIFT_VERSION"] = app_swift_version
  config.build_settings["TARGETED_DEVICE_FAMILY"] = app_device_family
  config.build_settings["SUPPORTED_PLATFORMS"] = app_supported_platforms
  config.build_settings["CURRENT_PROJECT_VERSION"] = app_project_version
  config.build_settings["CODE_SIGN_STYLE"] = "Manual"
  if entitlements_path
    config.build_settings["CODE_SIGN_ENTITLEMENTS"] = entitlements_path
  end
end

# embed the extension inside the app
app_target.add_dependency(ext_target)
embed_phase =
  app_target.copy_files_build_phases.find { |p| p.name == "Embed Foundation Extensions" } ||
  app_target.new_copy_files_build_phase("Embed Foundation Extensions")
embed_phase.symbol_dst_subfolder_spec = :plug_ins
build_file = embed_phase.add_file_reference(ext_target.product_reference)
build_file.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }

project.save

# Xcode's own "New Target" wizard regenerates the schemes too - do the same
# here, since xcodebuild won't reliably pick up a target added this way.
project.recreate_user_schemes

puts "Added '#{TARGET_NAME}' target to #{project_path}"
