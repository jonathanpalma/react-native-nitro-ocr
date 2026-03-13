import Foundation
import NitroModules
import Vision

enum VisionOCREngine {

  /// Performs OCR on the given image and returns recognized text observations.
  static func recognize(
    image: CGImage,
    orientation: CGImagePropertyOrientation,
    options: RecognizeOptions?
  ) throws -> [VNRecognizedTextObservation] {
    let request = VNRecognizeTextRequest()

    // Resolve recognition level (default: accurate)
    let level: VNRequestTextRecognitionLevel =
      options?.recognitionLevel == .fast ? .fast : .accurate

    request.recognitionLevel = level

    // Validate and set languages
    if let languages = options?.languages, !languages.isEmpty {
      let revision = VNRecognizeTextRequest.currentRevision
      let supported: [String]
      if #available(iOS 16.0, *) {
        supported = (try? request.supportedRecognitionLanguages()) ?? []
      } else {
        supported =
          (try? VNRecognizeTextRequest.supportedRecognitionLanguages(
            for: level,
            revision: revision
          )) ?? []
      }

      for lang in languages {
        if !supported.contains(lang) {
          throw RuntimeError(
            "UNSUPPORTED_LANGUAGE: Language '\(lang)' is not supported for recognition level '\(level == .fast ? "fast" : "accurate")'"
          )
        }
      }
      request.recognitionLanguages = languages
    } else {
      request.recognitionLanguages = []
    }

    // Language correction
    request.usesLanguageCorrection = options?.languageCorrection ?? true

    // Perform recognition
    let handler = VNImageRequestHandler(cgImage: image, orientation: orientation)
    do {
      try handler.perform([request])
    } catch {
      throw RuntimeError("RECOGNITION_FAILED: \(error.localizedDescription)")
    }

    return request.results ?? []
  }

  /// Returns the union of supported languages for both .accurate and .fast recognition levels.
  static func supportedLanguages() throws -> [String] {
    let revision = VNRecognizeTextRequest.currentRevision
    var allLanguages = Set<String>()

    if #available(iOS 16.0, *) {
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      if let accurate = try? request.supportedRecognitionLanguages() {
        allLanguages.formUnion(accurate)
      }
      request.recognitionLevel = .fast
      if let fast = try? request.supportedRecognitionLanguages() {
        allLanguages.formUnion(fast)
      }
    } else {
      if let accurate = try? VNRecognizeTextRequest.supportedRecognitionLanguages(
        for: .accurate,
        revision: revision
      ) {
        allLanguages.formUnion(accurate)
      }
      if let fast = try? VNRecognizeTextRequest.supportedRecognitionLanguages(
        for: .fast,
        revision: revision
      ) {
        allLanguages.formUnion(fast)
      }
    }

    return Array(allLanguages).sorted()
  }
}
