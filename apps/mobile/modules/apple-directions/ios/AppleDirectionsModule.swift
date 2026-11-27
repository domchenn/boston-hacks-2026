// Breadcrumb's local Expo module: a walking route between two points from Apple MapKit
// (MKDirections), as its line (coordinates), seconds and meters. Used by the app's trail
// maps (src/lib/walkingRoutes.ts). Only stop coordinates are sent to Apple, never the
// user's location. Resolves null when Apple has no route.
import ExpoModulesCore
import MapKit

public class AppleDirectionsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppleDirections")

    AsyncFunction("walkingRoute") { (fromLatitude: Double, fromLongitude: Double, toLatitude: Double, toLongitude: Double, promise: Promise) in
      let request = MKDirections.Request()
      request.source = MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: fromLatitude, longitude: fromLongitude)))
      request.destination = MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: toLatitude, longitude: toLongitude)))
      request.transportType = .walking
      request.requestsAlternateRoutes = false

      MKDirections(request: request).calculate { response, _ in
        guard let route = response?.routes.first else {
          promise.resolve(nil)
          return
        }
        let count = route.polyline.pointCount
        var points = [CLLocationCoordinate2D](repeating: kCLLocationCoordinate2DInvalid, count: count)
        route.polyline.getCoordinates(&points, range: NSRange(location: 0, length: count))
        promise.resolve([
          "seconds": route.expectedTravelTime,
          "meters": route.distance,
          "coordinates": points.map { ["latitude": $0.latitude, "longitude": $0.longitude] },
        ])
      }
    }
  }
}
