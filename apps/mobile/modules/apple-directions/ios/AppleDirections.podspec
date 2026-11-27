# Breadcrumb's local Expo module: walking routes from Apple MapKit (see AppleDirectionsModule.swift).
Pod::Spec.new do |s|
  s.name           = 'AppleDirections'
  s.version        = '0.1.0'
  s.summary        = 'Walking routes from Apple MapKit for Breadcrumb trail maps'
  s.description    = 'Asks MKDirections for a walking route between two points and returns its line and travel time.'
  s.author         = 'Breadcrumb'
  s.homepage       = 'https://github.com/domchenn/breadcrumb'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'MapKit'
  s.source_files   = '**/*.{h,m,swift}'
end
