import Foundation
import ImageIO
import Photos
import UIKit

enum ImageSourceResolver {

  /// Resolves a source string to a CGImage and its EXIF orientation.
  static func resolve(source: String) throws -> (CGImage, CGImagePropertyOrientation) {
    guard !source.isEmpty else {
      throw RuntimeError("INVALID_SOURCE: Source string is empty")
    }

    if source.hasPrefix("ph://") {
      return try resolvePhotosAsset(source: source)
    }

    if source.hasPrefix("data:") {
      return try resolveBase64(source: source)
    }

    if source.hasPrefix("file://") || source.hasPrefix("/") {
      return try resolveFileURL(source: source)
    }

    throw RuntimeError("INVALID_SOURCE: Unsupported URI scheme")
  }

  // MARK: - File URL

  private static func resolveFileURL(source: String) throws -> (CGImage, CGImagePropertyOrientation) {
    let url: URL
    if source.hasPrefix("file://") {
      url = URL(fileURLWithPath: String(source.dropFirst("file://".count)))
    } else {
      url = URL(fileURLWithPath: source)
    }

    guard let imageSource = CGImageSourceCreateWithURL(url as CFURL, nil) else {
      throw RuntimeError("IMAGE_LOAD_FAILED: Could not decode image at \(source)")
    }

    guard let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else {
      throw RuntimeError("IMAGE_LOAD_FAILED: Could not decode image at \(source)")
    }

    let orientation = exifOrientation(from: imageSource)
    return (cgImage, orientation)
  }

  private static func exifOrientation(from imageSource: CGImageSource) -> CGImagePropertyOrientation {
    guard let properties = CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil) as? [CFString: Any],
          let orientationRaw = properties[kCGImagePropertyOrientation] as? UInt32,
          let orientation = CGImagePropertyOrientation(rawValue: orientationRaw) else {
      return .up
    }
    return orientation
  }

  // MARK: - Photos Library (ph://)

  private static func resolvePhotosAsset(source: String) throws -> (CGImage, CGImagePropertyOrientation) {
    let assetId = String(source.dropFirst("ph://".count))
    let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil)
    guard let asset = fetchResult.firstObject else {
      throw RuntimeError("IMAGE_LOAD_FAILED: Could not decode image at \(source)")
    }

    let requestOptions = PHImageRequestOptions()
    // Network access disabled to preserve the offline guarantee.
    // iCloud-only assets will fail with IMAGE_LOAD_FAILED.
    // The calling app should download the asset first if needed.
    requestOptions.isNetworkAccessAllowed = false
    requestOptions.version = .current
    requestOptions.deliveryMode = .highQualityFormat
    // isSynchronous blocks the current (Nitro async) thread, not the main
    // thread. Acceptable for local assets; iCloud-only assets fail fast
    // since isNetworkAccessAllowed is false.
    requestOptions.isSynchronous = true

    var resultImage: CGImage?
    var resultOrientation: CGImagePropertyOrientation = .up
    var loadError: Error?

    PHImageManager.default().requestImageDataAndOrientation(
      for: asset,
      options: requestOptions
    ) { data, _, orientation, _ in
      guard let data = data else {
        loadError = RuntimeError("IMAGE_LOAD_FAILED: Could not decode image at \(source)")
        return
      }

      guard let imageSource = CGImageSourceCreateWithData(data as CFData, nil),
            let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else {
        loadError = RuntimeError("IMAGE_LOAD_FAILED: Could not decode image at \(source)")
        return
      }

      resultImage = cgImage
      resultOrientation = CGImagePropertyOrientation(rawValue: UInt32(orientation)) ?? .up
    }

    if let error = loadError {
      throw error
    }

    guard let image = resultImage else {
      throw RuntimeError("IMAGE_LOAD_FAILED: Could not decode image at \(source)")
    }

    return (image, resultOrientation)
  }

  // MARK: - Base64 Data URI

  private static func resolveBase64(source: String) throws -> (CGImage, CGImagePropertyOrientation) {
    guard let commaIndex = source.firstIndex(of: ",") else {
      throw RuntimeError("IMAGE_LOAD_FAILED: Could not decode base64 image data")
    }

    let base64String = String(source[source.index(after: commaIndex)...])
    guard let data = Data(base64Encoded: base64String) else {
      throw RuntimeError("IMAGE_LOAD_FAILED: Could not decode base64 image data")
    }

    guard let uiImage = UIImage(data: data) else {
      throw RuntimeError("IMAGE_LOAD_FAILED: Could not decode base64 image data")
    }

    guard let cgImage = uiImage.cgImage else {
      throw RuntimeError("IMAGE_LOAD_FAILED: Could not decode base64 image data")
    }

    let orientation = cgImagePropertyOrientation(from: uiImage.imageOrientation)
    return (cgImage, orientation)
  }

  private static func cgImagePropertyOrientation(
    from uiOrientation: UIImage.Orientation
  ) -> CGImagePropertyOrientation {
    switch uiOrientation {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}

/// Simple error type for throwing descriptive errors.
struct RuntimeError: LocalizedError {
  let message: String

  init(_ message: String) {
    self.message = message
  }

  var errorDescription: String? {
    return message
  }
}
