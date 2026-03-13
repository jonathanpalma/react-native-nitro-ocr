import Foundation
import NitroModules
import Vision

class NitroOcr: HybridNitroOcrSpec {

  func recognize(source: String, options: RecognizeOptions?) throws -> Promise<OCRResult> {
    return Promise.async {
      let (image, orientation) = try ImageSourceResolver.resolve(source: source)
      let observations = try VisionOCREngine.recognize(
        image: image,
        orientation: orientation,
        options: options
      )
      return HierarchyBuilder.buildResult(from: observations)
    }
  }

  func recognizeText(source: String, options: RecognizeOptions?) throws -> Promise<String> {
    return Promise.async {
      let (image, orientation) = try ImageSourceResolver.resolve(source: source)
      let observations = try VisionOCREngine.recognize(
        image: image,
        orientation: orientation,
        options: options
      )
      let text = observations.compactMap { obs in
        obs.topCandidates(1).first?.string
      }.joined(separator: "\n\n")
      return text
    }
  }

  func getSupportedLanguages() throws -> Promise<[String]> {
    return Promise.async {
      return try VisionOCREngine.supportedLanguages()
    }
  }
}
