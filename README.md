# react-native-nitro-ocr

On-device OCR for React Native. Offline text recognition using Apple Vision on iOS and Google ML Kit on Android, built on [Nitro Modules](https://nitro.margelo.com/).

## Why react-native-nitro-ocr?

**You don't need an AI framework to read text.**

Most on-device ML solutions ask you to ship large models inside your app: 100 MB+ of weights, gigabytes of RAM, complex build configurations, and GPU pipelines you have to manage yourself. That makes sense for general-purpose AI. It doesn't make sense for reading text from an image.

Your phone already knows how to do this. Apple spent years training and optimizing text recognition models that ship with every iPhone. Google did the same for Android. These models run on dedicated neural hardware, use a fraction of the memory, and deliver results in milliseconds instead of seconds.

react-native-nitro-ocr gets out of the way and lets the platform do what it already does best.

- **Zero bundle size increase on iOS.** Apple Vision is built into the OS. There is no model to download, no SDK to bundle, no 18 MB dependency to justify.
- **~3.5 MB on Android.** ML Kit's bundled Latin model is smaller than most splash screen images. Non-Latin scripts are opt-in.
- **Fully offline.** No internet connection, no API keys, no cloud services, no data leaving the device. Works in airplane mode, works in a remote village, works underground.
- **Hardware-accelerated without configuration.** Apple Neural Engine, Metal GPU, Qualcomm Hexagon NPU, Samsung Exynos NPU. The OS routes inference to the fastest available hardware automatically. You don't write a single line of GPU code.
- **Built for the New Architecture.** Nitro Modules with JSI, so there is no JSON serialization and no async bridge overhead. Structured results cross the native boundary as typed objects, not dictionaries.

### When to use this vs. a full ML framework

|                  | react-native-nitro-ocr             | ExecuTorch / ONNX Runtime / llama.rn          |
| ---------------- | ----------------------------------- | ---------------------------------------------- |
| Use case         | Read text from images and camera    | Run custom ML models on-device                 |
| Bundle impact    | 0 MB (iOS) / ~3.5 MB (Android)     | 50–200+ MB                                     |
| RAM usage        | Minimal (OS-managed)                | 500 MB – 2+ GB                                 |
| Setup            | `npm install` and go                | Model conversion, delegate config, memory tuning |
| GPU acceleration | Automatic                           | Manual delegate selection                      |
| Accuracy         | State-of-the-art (platform-tuned)   | Depends on model choice and quantization       |
| Offline          | Always                              | Depends on deployment strategy                 |

If you need to classify images, run LLMs, generate speech, or do anything beyond reading text, use a full ML framework. That's what they're for.

If you need to point a camera at a sign and know what it says, you don't need to ship a neural network. You need this.

### Why a library?

You can call `VNRecognizeTextRequest` and `TextRecognition.getClient()` directly. The APIs are well-documented. But once you need this working reliably across both platforms, in production, from React Native, the details compound quickly.

Apple Vision and ML Kit are excellent and completely different. Coordinate systems, result hierarchies, confidence scores, language configuration, and image input formats all diverge. This library is the set of best practices you'd arrive at after building it yourself twice.

- **Bundled models, not unbundled.** Most RN ML Kit libraries use the unbundled variant that downloads models from Google Play Services on first use. That fails silently offline and fails entirely on devices without GMS (Huawei, Amazon, custom ROMs). We bundle the model. Offline means offline.
- **Native-side throttling for camera OCR.** Throttling in JS still creates image handlers on every frame and discards them. We skip frames in native code before any processing begins. The camera renders at full framerate while OCR runs at ~5 fps.
- **Full text hierarchy on both platforms.** Apple Vision returns flat observations with no line/word breakdown. We reconstruct Block > Line > Element > Symbol using `boundingBox(for:)` on text subranges, matching the structure ML Kit provides natively on Android.
- **Coordinate normalization.** Both platforms normalized to 0..1 with top-left origin. No per-platform conversion code in your app.
- **Typed results over JSI.** Nested structs (`OCRResult > OCRBlock > OCRLine > OCRElement > OCRSymbol`) cross the native boundary as typed objects, not JSON strings or untyped dictionaries.
- **iOS Simulator just works.** ML Kit-based libraries break on iOS Simulator because Google's podspec excludes arm64 simulator builds. By using Apple Vision on iOS, OCR runs natively on Apple Silicon simulators without Rosetta.
- **No App Store rejection risk on iOS.** Some ML Kit libraries have been rejected because `MLKitTextRecognitionCommon` bundles a `public_suffix_list.dat` referencing a U.S. embargoed territory domain. By using Apple Vision on iOS, no third-party Google SDK is included in the iOS binary.
- **Automatic orientation handling.** Portrait photos, EXIF rotation, landscape frames. All handled before recognition on both platforms.
- **Expo support.** Config plugin included. Install, add to your app config, and `npx expo prebuild`.

## Requirements

- React Native 0.76+ (New Architecture)
- `react-native-nitro-modules` >= 0.35.0
- iOS 16.0+
- Android SDK 24+ (Android 7.0)

## Installation

```sh
npm install react-native-nitro-ocr react-native-nitro-modules
```

> `react-native-nitro-modules` is a required peer dependency. This library is built on [Nitro Modules](https://nitro.margelo.com/).

### Expo

Add the plugin to your `app.json` or `app.config.js`:

```json
{
  "expo": {
    "plugins": ["react-native-nitro-ocr"]
  }
}
```

Then run `npx expo prebuild`.

For non-Latin script support or camera permissions:

```json
{
  "expo": {
    "plugins": [
      ["react-native-nitro-ocr", {
        "androidScriptModels": ["japanese", "chinese"],
        "cameraPermission": true,
        "cameraPermissionText": "This app uses the camera to scan text"
      }]
    ]
  }
}
```

> Each additional script model adds ~5-10 MB to the Android bundle.

### Bare React Native

#### iOS

No additional setup required. Apple Vision is built into the OS.

```sh
cd ios && pod install
```

#### Android

Latin script recognition works out of the box. For non-Latin scripts (Chinese, Japanese, Korean, Devanagari), add the corresponding ML Kit dependency to your app's `android/app/build.gradle`:

```groovy
dependencies {
    // Add any combination of these for non-Latin script support:
    implementation 'com.google.mlkit:text-recognition-chinese:16.0.1'
    implementation 'com.google.mlkit:text-recognition-japanese:16.0.1'
    implementation 'com.google.mlkit:text-recognition-korean:16.0.1'
    implementation 'com.google.mlkit:text-recognition-devanagari:16.0.1'  // Hindi, Marathi, Nepali
}
```

Then use `scriptHints` to select the model:

```ts
const result = await recognize(source, {
  scriptHints: ['chinese'],
})
```

If you request a non-Latin script without the corresponding dependency, the library throws an `OCRError` with code `MODEL_NOT_AVAILABLE` and a message telling you which dependency to add.

> The Expo config plugin handles this automatically via the `androidScriptModels` option.

## Usage

### Structured OCR

```ts
import { recognize } from 'react-native-nitro-ocr'

const result = await recognize('file:///path/to/photo.jpg')

console.log(result.text) // Full recognized text

for (const block of result.blocks) {
  for (const line of block.lines) {
    console.log(line.text, line.confidence, line.boundingBox)
  }
}
```

### Plain text only

```ts
import { recognizeText } from 'react-native-nitro-ocr'

const text = await recognizeText('file:///path/to/photo.jpg')
```

### Real-time camera OCR

Coming soon. Camera frame processor support via VisionCamera will ship in a future minor release.

### Options

```ts
const result = await recognize('file:///path/to/photo.jpg', {
  languages: ['en-US', 'es-ES'],
  recognitionLevel: 'fast', // iOS only, ignored on Android
})
```

See the full [API reference](docs/v1-api-design.md) for all types, options, and platform behavior differences.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
