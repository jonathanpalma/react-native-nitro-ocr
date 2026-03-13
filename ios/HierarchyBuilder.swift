import Foundation
import NitroModules
import Vision

enum HierarchyBuilder {

  // MARK: - Public

  static func buildResult(from observations: [VNRecognizedTextObservation]) -> OCRResult {
    let blocks = observations.compactMap { buildBlock(from: $0) }
    let text = blocks.map { $0.text }.joined(separator: "\n\n")
    return OCRResult(text: text, blocks: blocks)
  }

  // MARK: - Block

  private static func buildBlock(from obs: VNRecognizedTextObservation) -> OCRBlock? {
    guard let candidate = obs.topCandidates(1).first else {
      return nil
    }

    let fullText = candidate.string
    let confidence = Double(obs.confidence)
    let bbox = flipBoundingBox(obs.boundingBox)
    let corners = rectangleCornerPoints(obs)

    // iOS Vision does not expose per-observation recognized language.
    // Language arrays are empty on iOS; Android provides this via ML Kit.
    let recognizedLanguages: [String] = []
    let language = ""

    // Build lines by splitting candidate string on newlines
    let lines = buildLines(
      from: candidate,
      fullText: fullText,
      confidence: confidence,
      language: language,
      fallbackBox: obs.boundingBox,
      observation: obs
    )

    return OCRBlock(
      text: fullText,
      confidence: confidence,
      boundingBox: bbox,
      cornerPoints: corners,
      recognizedLanguages: recognizedLanguages,
      lines: lines
    )
  }

  // MARK: - Lines

  private static func buildLines(
    from candidate: VNRecognizedText,
    fullText: String,
    confidence: Double,
    language: String,
    fallbackBox: CGRect,
    observation: VNRecognizedTextObservation
  ) -> [OCRLine] {
    let lineTexts = fullText.components(separatedBy: "\n")
    var lines: [OCRLine] = []
    var searchStart = fullText.startIndex

    for lineText in lineTexts {
      guard !lineText.isEmpty else { continue }
      guard let lineRange = fullText.range(of: lineText, range: searchStart..<fullText.endIndex) else {
        continue
      }
      searchStart = lineRange.upperBound

      let visionBox = try? candidate.boundingBox(for: lineRange)
      let lineBBox = visionBox?.boundingBox ?? fallbackBox
      let flippedBBox = flipBoundingBox(lineBBox)
      let lineCorners: [Point]
      if let visionBox = visionBox {
        lineCorners = rectangleCornerPoints(visionBox)
      } else {
        lineCorners = cornerPointsFromBox(flippedBBox)
      }
      let angle = observationAngle(observation)
      let recognizedLanguages = language.isEmpty ? [] : [language]

      // Build elements (words) for this line
      let elements = buildElements(
        from: candidate,
        lineText: lineText,
        lineRange: lineRange,
        fullText: fullText,
        confidence: confidence,
        language: language,
        fallbackBox: lineBBox
      )

      lines.append(OCRLine(
        text: lineText,
        confidence: confidence,
        boundingBox: flippedBBox,
        cornerPoints: lineCorners,
        recognizedLanguages: recognizedLanguages,
        angle: angle,
        elements: elements
      ))
    }

    return lines
  }

  // MARK: - Elements (Words)

  private static func buildElements(
    from candidate: VNRecognizedText,
    lineText: String,
    lineRange: Range<String.Index>,
    fullText: String,
    confidence: Double,
    language: String,
    fallbackBox: CGRect
  ) -> [OCRElement] {
    var elements: [OCRElement] = []

    lineText.enumerateSubstrings(
      in: lineText.startIndex..<lineText.endIndex,
      options: .byWords
    ) { word, wordRangeInLine, _, _ in
      guard let word = word else { return }

      // Map the word range from lineText back into fullText
      let offsetFromLineStart = lineText.distance(
        from: lineText.startIndex,
        to: wordRangeInLine.lowerBound
      )
      let wordLength = lineText.distance(
        from: wordRangeInLine.lowerBound,
        to: wordRangeInLine.upperBound
      )
      let wordStartInFull = fullText.index(lineRange.lowerBound, offsetBy: offsetFromLineStart)
      let wordEndInFull = fullText.index(wordStartInFull, offsetBy: wordLength)
      let wordRangeInFull = wordStartInFull..<wordEndInFull

      let visionBox = try? candidate.boundingBox(for: wordRangeInFull)
      let elementBBox = visionBox?.boundingBox ?? fallbackBox
      let flippedBBox = flipBoundingBox(elementBBox)
      let elementCorners: [Point]
      if let visionBox = visionBox {
        elementCorners = rectangleCornerPoints(visionBox)
      } else {
        elementCorners = cornerPointsFromBox(flippedBBox)
      }

      // Build symbols (characters)
      let symbols = buildSymbols(
        from: candidate,
        word: word,
        wordRangeInFull: wordRangeInFull,
        fullText: fullText,
        confidence: confidence,
        fallbackBox: elementBBox
      )

      elements.append(OCRElement(
        text: word,
        confidence: confidence,
        boundingBox: flippedBBox,
        cornerPoints: elementCorners,
        recognizedLanguage: language,
        symbols: symbols
      ))
    }

    return elements
  }

  // MARK: - Symbols (Characters)

  private static func buildSymbols(
    from candidate: VNRecognizedText,
    word: String,
    wordRangeInFull: Range<String.Index>,
    fullText: String,
    confidence: Double,
    fallbackBox: CGRect
  ) -> [OCRSymbol] {
    var symbols: [OCRSymbol] = []
    var charIndex = wordRangeInFull.lowerBound

    for character in word {
      let charEnd = fullText.index(after: charIndex)
      let charRange = charIndex..<charEnd

      let visionBox = try? candidate.boundingBox(for: charRange)
      let symbolBBox = visionBox?.boundingBox ?? fallbackBox
      let flippedBBox = flipBoundingBox(symbolBBox)
      let symbolCorners: [Point]
      if let visionBox = visionBox {
        symbolCorners = rectangleCornerPoints(visionBox)
      } else {
        symbolCorners = cornerPointsFromBox(flippedBBox)
      }

      symbols.append(OCRSymbol(
        text: String(character),
        confidence: confidence,
        boundingBox: flippedBBox,
        cornerPoints: symbolCorners
      ))

      charIndex = charEnd
    }

    return symbols
  }

  // MARK: - Coordinate Helpers

  /// Flips a Vision bounding box (bottom-left origin) to top-left origin.
  private static func flipBoundingBox(_ box: CGRect) -> BoundingBox {
    BoundingBox(
      x: Double(box.origin.x),
      y: Double(1.0 - box.origin.y - box.height),
      width: Double(box.width),
      height: Double(box.height)
    )
  }

  /// Extracts corner points from a VNRectangleObservation's quad with Y-flip.
  private static func rectangleCornerPoints(_ rect: VNRectangleObservation) -> [Point] {
    [
      Point(x: Double(rect.topLeft.x), y: Double(1.0 - rect.topLeft.y)),
      Point(x: Double(rect.topRight.x), y: Double(1.0 - rect.topRight.y)),
      Point(x: Double(rect.bottomRight.x), y: Double(1.0 - rect.bottomRight.y)),
      Point(x: Double(rect.bottomLeft.x), y: Double(1.0 - rect.bottomLeft.y)),
    ]
  }

  /// Computes corner points from an axis-aligned bounding box.
  private static func cornerPointsFromBox(_ box: BoundingBox) -> [Point] {
    [
      Point(x: box.x, y: box.y),
      Point(x: box.x + box.width, y: box.y),
      Point(x: box.x + box.width, y: box.y + box.height),
      Point(x: box.x, y: box.y + box.height),
    ]
  }

  /// Computes the angle of text in degrees (clockwise positive, 0 = horizontal).
  private static func observationAngle(_ obs: VNRecognizedTextObservation) -> Double {
    let dx = Double(obs.topRight.x - obs.topLeft.x)
    let dy = Double(obs.topRight.y - obs.topLeft.y)
    return atan2(-dy, dx) * (180.0 / .pi)
  }
}
