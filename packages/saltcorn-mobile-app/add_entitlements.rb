require 'xcodeproj'

project_path = 'ios/App/App.xcodeproj'
target_name  = 'App'
entitlements_relative_path = 'App/App.entitlements'

project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |t| t.name == target_name }
abort("Target '#{target_name}' not found") unless target

target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = entitlements_relative_path
end

project.save
puts "Entitlements configured successfully for target '#{target_name}'"
