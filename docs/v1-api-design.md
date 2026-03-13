# react-native-nitro-ocr — v1 API Design

## Design Principles

1. **Simple by default, powerful when needed** — `recognize(uri)` works with zero config
2. **Consistent across platforms** — same result shape, normalized coordinates, unified confidence scale
3. **Naming follows industry convention** — `text` (not `string` or `value`), `confidence` (not `score`), `boundingBox` (not `bbox` or `geometry`)
4. **Platform differences are documented, not hidden** — iOS-only and Android-only options are clearly marked
5. **Offline always** — no method requires network, no lazy model downloads

---

## Exported Functions

### `recognize`

Full structured OCR with bounding boxes, confidence, and text hierarchy.

```typescript
function recognize(source: ImageSource, options?: RecognizeOptions): Promise<OCRResult>
```

**Example:**

```typescript
import { recognize } from 'react-native-nitro-ocr'

const result = await recognize('file:///path/to/photo.jpg')
console.log(result.text)

for (const block of result.blocks) {
  for (const line of block.lines) {
    console.log(line.text, line.confidence, line.boundingBox)
  }
}
```

**With options:**

```typescript
const result = await recognize('file:///path/to/photo.jpg', {
  languages: ['en-US', 'es-ES'],
  recognitionLevel: 'fast',
})
```

---

### `recognizeText`

Plain text extraction only. Faster than `recognize` — skips hierarchy reconstruction and bounding box computation.

```typescript
function recognizeText(source: ImageSource, options?: RecognizeOptions): Promise<string>
```

**Example:**

```typescript
import { recognizeText } from 'react-native-nitro-ocr'

const text = await recognizeText('file:///path/to/photo.jpg')
console.log(text)
```

---

### `scanOCR` *(not yet implemented)*

> **Status:** Planned for a future release. VisionCamera frame processor support is not yet available. See [README](../README.md#real-time-camera-ocr) for current status.

VisionCamera frame processor plugin for real-time camera OCR. Runs synchronously on the camera thread. Returns `null` when throttled or no text detected.

```typescript
function scanOCR(frame: Frame, options?: ScanOptions): OCRResult | null
```

**Example:**

```typescript
import { useFrameProcessor } from 'react-native-vision-camera'
import { scanOCR } from 'react-native-nitro-ocr'

function CameraScreen() {
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet'
    const result = scanOCR(frame)
    if (result) {
      console.log(result.text)
    }
  }, [])

  return <Camera frameProcessor={frameProcessor} />
}
```

---

### `getSupportedLanguages`

Returns BCP-47 language codes supported by the current platform and OS version.

```typescript
function getSupportedLanguages(): Promise<string[]>
```

**Example:**

```typescript
import { getSupportedLanguages } from 'react-native-nitro-ocr'

const languages = await getSupportedLanguages()
// iOS: ['en-US', 'fr-FR', 'de-DE', 'es-ES', 'pt-BR', 'zh-Hans', 'ja-JP', 'ko-KR', ...]
// Android: ['en', 'es', 'fr', 'de', 'it', 'pt', ...] (depends on bundled script models)
```

---

## Types

### `ImageSource`

```typescript
type ImageSource = string
```

Accepted formats:
- `file:///path/to/image.jpg` — local file path
- `content://...` — Android content URI *(Android only)*
- `ph://...` — iOS Photos asset *(iOS only; locally available only; iCloud-only assets must be downloaded by the app first)*
- `data:image/jpeg;base64,...` — base64 data URI

---

### `RecognizeOptions`

```typescript
interface RecognizeOptions {
  /**
   * BCP-47 language codes in priority order.
   * Helps the engine optimize for expected languages.
   *
   * @default [] (engine auto-detects)
   * @example ['en-US', 'fr-FR']
   */
  languages?: string[]

  /**
   * Recognition quality vs speed tradeoff.
   * - 'accurate': best quality, slower (default)
   * - 'fast': optimized for speed, lower quality
   *
   * On Android this option is ignored — ML Kit does not expose recognition levels.
   *
   * @default 'accurate'
   * @platform ios
   */
  recognitionLevel?: 'fast' | 'accurate'

  /**
   * Script families to recognize on Android.
   * Determines which ML Kit model is used.
   *
   * Non-Latin scripts require adding the corresponding ML Kit dependency
   * to your app's `android/app/build.gradle`:
   * - `'chinese'`    → `implementation 'com.google.mlkit:text-recognition-chinese:16.0.1'`
   * - `'japanese'`   → `implementation 'com.google.mlkit:text-recognition-japanese:16.0.1'`
   * - `'korean'`     → `implementation 'com.google.mlkit:text-recognition-korean:16.0.1'`
   * - `'devanagari'` → `implementation 'com.google.mlkit:text-recognition-devanagari:16.0.1'`
   *
   * Without the dependency, the library throws `MODEL_NOT_AVAILABLE`.
   *
   * On iOS this option is ignored — Apple Vision handles all scripts automatically.
   *
   * @default ['latin']
   * @platform android
   */
  scriptHints?: Array<'latin' | 'chinese' | 'devanagari' | 'japanese' | 'korean'>

  /**
   * Apply NLP-based language correction to improve accuracy.
   *
   * On Android this option is ignored — ML Kit does not expose this setting.
   *
   * @default true
   * @platform ios
   */
  languageCorrection?: boolean
}
```

---

### `OCRResult`

The top-level result returned by `recognize`.

```typescript
interface OCRResult {
  /** Full concatenated text from all blocks, in reading order. */
  text: string

  /** Text regions detected in the image. */
  blocks: OCRBlock[]
}
```

---

### `OCRBlock`

A contiguous region of text (e.g., a paragraph or text group).

```typescript
interface OCRBlock {
  /** Text content of this block. */
  text: string

  /**
   * Recognition confidence, 0 to 1.
   *
   * On iOS: derived from the observation-level confidence.
   * On Android: averaged from child line confidences (ML Kit does not provide block-level confidence).
   */
  confidence: number

  /** Axis-aligned bounding box in normalized coordinates (0..1, origin top-left). */
  boundingBox: BoundingBox

  /**
   * Four corner points of the text region, clockwise from top-left.
   * Useful for rotated or skewed text where the axis-aligned boundingBox is imprecise.
   * Normalized coordinates (0..1, origin top-left).
   */
  cornerPoints: Point[]

  /** BCP-47 codes of detected languages in this block. */
  recognizedLanguages: string[]

  /** Lines within this block, in reading order. */
  lines: OCRLine[]
}
```

---

### `OCRLine`

A single line of text within a block.

```typescript
interface OCRLine {
  /** Text content of this line. */
  text: string

  /** Recognition confidence, 0 to 1. */
  confidence: number

  /** Axis-aligned bounding box, normalized (0..1, origin top-left). */
  boundingBox: BoundingBox

  /** Four corner points, clockwise from top-left, normalized. */
  cornerPoints: Point[]

  /** BCP-47 codes of detected languages. */
  recognizedLanguages: string[]

  /**
   * Rotation angle of the text in degrees. Clockwise positive, range [-180, 180].
   *
   * On iOS: derived from corner points.
   * On Android: directly from ML Kit.
   *
   * @default 0
   */
  angle: number

  /** Words within this line, in reading order. */
  elements: OCRElement[]
}
```

---

### `OCRElement`

A single word or word-like unit within a line.

```typescript
interface OCRElement {
  /** Text content of this element (typically a word). */
  text: string

  /** Recognition confidence, 0 to 1. */
  confidence: number

  /** Axis-aligned bounding box, normalized (0..1, origin top-left). */
  boundingBox: BoundingBox

  /** Four corner points, clockwise from top-left, normalized. */
  cornerPoints: Point[]

  /** BCP-47 code of the detected language. */
  recognizedLanguage: string

  /** Individual characters within this element. */
  symbols: OCRSymbol[]
}
```

---

### `OCRSymbol`

A single character.

```typescript
interface OCRSymbol {
  /** The character. */
  text: string

  /** Recognition confidence, 0 to 1. */
  confidence: number

  /** Axis-aligned bounding box, normalized (0..1, origin top-left). */
  boundingBox: BoundingBox

  /** Four corner points, clockwise from top-left, normalized. */
  cornerPoints: Point[]
}
```

---

### `BoundingBox`

Axis-aligned rectangle in normalized coordinates.

```typescript
interface BoundingBox {
  /** Left edge, 0..1 relative to image width. */
  x: number

  /** Top edge, 0..1 relative to image height. */
  y: number

  /** Width, 0..1 relative to image width. */
  width: number

  /** Height, 0..1 relative to image height. */
  height: number
}
```

---

### `Point`

A point in normalized coordinates.

```typescript
interface Point {
  /** Horizontal position, 0..1 relative to image width. */
  x: number

  /** Vertical position, 0..1 relative to image height. */
  y: number
}
```

---

## Platform Behavior Differences

Documented here and in JSDoc on each property so developers aren't surprised.

| Behavior | iOS (Apple Vision) | Android (ML Kit v2) |
|---|---|---|
| **Block confidence** | From `VNRecognizedTextObservation.confidence` | Averaged from child line confidences (ML Kit has no block-level confidence) |
| **Line/element/symbol confidence** | Observation-level confidence propagated (Vision doesn't provide per-word confidence) | Native per-level confidence from ML Kit |
| **Hierarchy reconstruction** | Reconstructed from flat observations via `boundingBox(for:)` on text subranges | Direct from ML Kit's `TextBlock > Line > Element > Symbol` |
| **Corner points** | From `VNRectangleObservation` quad at all levels; axis-aligned fallback when unavailable | From `getCornerPoints()` at all levels; axis-aligned fallback when null |
| **Angle** | Computed from corner points | Directly from `getAngle()` |
| **Recognized language** | Not available (Vision does not expose detected language); returns empty arrays | Per-level via `getRecognizedLanguage()` |
| **Recognition level** | `.fast` vs `.accurate` — meaningful performance/quality difference | Ignored (ML Kit has one mode per script) |
| **Language correction** | `usesLanguageCorrection` — NLP post-processing | Ignored (not configurable in ML Kit) |
| **Script selection** | Automatic (Vision handles all scripts) | Requires explicit script hint to load correct model |
| **Coordinate origin** | Vision uses bottom-left → library flips to top-left | ML Kit uses top-left → library normalizes from pixels to 0..1 |
| **Handwriting** | Supported (accurate mode) | Not supported |
| **Simulator** | Works natively (Apple Vision) | Requires workarounds (ML Kit excludes arm64 sim) |

---

## Error Handling

```typescript
class OCRError extends Error {
  /** Machine-readable error code. */
  code: OCRErrorCode

  /** Human-readable message. */
  message: string
}

type OCRErrorCode =
  | 'IMAGE_LOAD_FAILED'       // Could not load or decode the image
  | 'RECOGNITION_FAILED'      // Native recognition engine returned an error
  | 'INVALID_SOURCE'          // Image source string is malformed
  | 'UNSUPPORTED_LANGUAGE'    // Requested language is not available on this platform
  | 'MODEL_NOT_AVAILABLE'     // Android: requested script model not installed (see scriptHints docs for required Gradle dependencies)
  | 'CANCELLED'               // Recognition was cancelled
```

---

## What is NOT in v1

These are explicitly out of scope for the initial release:

- **`useOCR` React hook** — convenience, can be added in v1.1
- **Preprocessing** (auto-crop, perspective correction, grayscale) — significant native work, planned for v1.2
- **Debug overlay component** (`<OCRDebugView>`) — planned for v1.1
- **Region of interest** (scan only part of the image) — planned for v1.1
- **Batch processing** (multiple images) — users can `Promise.all` with `recognize`
- **Progress callbacks** — not needed for single-image recognition
- **Custom ML models** — out of scope, use `react-native-fast-tflite` or `react-native-executorch`
- **Translation** — separate concern, pair with Apple Translate or ML Kit Translation
- **PDF input** — may add in future

---

## v1 Export Summary

```typescript
// Functions
export function recognize(source: ImageSource, options?: RecognizeOptions): Promise<OCRResult>
export function recognizeText(source: ImageSource, options?: RecognizeOptions): Promise<string>
export function getSupportedLanguages(): Promise<string[]>

// Planned (not yet implemented)
// export function scanOCR(frame: Frame, options?: ScanOptions): OCRResult | null

// Types
export type ImageSource = string
export type RecognizeOptions = { ... }
export type OCRResult = { ... }
export type OCRBlock = { ... }
export type OCRLine = { ... }
export type OCRElement = { ... }
export type OCRSymbol = { ... }
export type BoundingBox = { ... }
export type Point = { ... }
export type OCRErrorCode = '...' | '...'
export class OCRError extends Error { ... }
```

**3 functions. 9 types. That's the entire public API.**
