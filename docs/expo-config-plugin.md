# Expo Config Plugin for react-native-nitro-ocr

## Context

There is no documented precedent for shipping an Expo config plugin alongside a Nitro Module. Nitro Modules position themselves as an alternative to Expo Modules, not an extension of them. However, config plugins operate at a different layer. They modify native project files during `expo prebuild` and are completely framework-agnostic. A config plugin does not care whether the library uses Nitro, Turbo Modules, or raw JNI. It just needs to ensure the native project is configured correctly before the build starts.

The Expo community has been requesting OCR support since 2018 (203 upvotes on the feature request, still unanswered). No official module exists. Shipping a config plugin makes this library work out of the box for Expo users with zero manual native setup.

## What the config plugin does

### iOS

Almost nothing. Apple Vision is a system framework available on iOS 16.0+. It does not require a CocoaPod, a vendored binary, or any build phase configuration. The podspec already handles linking through `install_modules_dependencies(s)`.

The plugin handles:

- **Camera permission** (`NSCameraUsageDescription` in Info.plist), opt-in via `cameraPermission: true`.

### Android

- **ML Kit dependency.** Latin model (`com.google.mlkit:text-recognition:16.0.1`) is always injected defensively. Gradle deduplicates if it already exists transitively. Additional script models (Chinese, Japanese, Korean, Devanagari) are opt-in via `androidScriptModels`.
- **Minimum SDK.** If `minSdkVersion < 24`, a warning is emitted via `WarningAggregator`. The plugin does not throw, since the actual build may resolve to 24 via `getExtOrDefault` in the library's gradle.
- **Camera permission** (`android.permission.CAMERA` in AndroidManifest.xml), opt-in via `cameraPermission: true`.

## File structure

```
plugin/
  src/
    index.ts              # Entry point, composes iOS + Android plugins
    withIOSPermissions.ts  # Camera permission in Info.plist
    withAndroidMLKit.ts    # ML Kit dependency + permissions + minSdk warning
    __tests__/             # Plugin unit tests (Jest + ts-jest, Node environment)
app.plugin.js             # Entry point for Expo (points to compiled output)
```

The `app.plugin.js` file at the package root is what Expo resolves when a user adds `"react-native-nitro-ocr"` to their plugins array.

## Dependency strategy

- `peerDependencies`: `"expo": ">=52.0.0"` (Expo SDK 52 is the first to fully support RN 0.76+ / New Architecture)
- `peerDependenciesMeta`: `{ "expo": { "optional": true } }` (non-Expo users see no warnings)
- `devDependencies`: `"expo": "~52.0.0"` (local compilation of plugin TypeScript)

At runtime, `expo/config-plugins` resolves from the user's Expo project. Imports use `expo/config-plugins` (the modern Expo re-export path), not `@expo/config-plugins`.

## Build setup

The library's bob config emits ESM (`"esm": true`). Expo config plugins are loaded via `require()` (CJS). The plugin has its own `plugin/tsconfig.json` targeting `"module": "commonjs"` with `outDir: "./build"`.

The `prepare` script chains both builds: `bob build && tsc --project plugin/tsconfig.json`.

The entry point wraps the plugin with `createRunOncePlugin` to prevent duplicate application if the user lists the plugin twice.

## Plugin options

```ts
type NitroOcrPluginOptions = {
  cameraPermission?: boolean;
  cameraPermissionText?: string;
  androidScriptModels?: Array<'chinese' | 'japanese' | 'korean' | 'devanagari'>;
};
```

Usage in `app.json`:

```json
{
  "expo": {
    "plugins": [
      ["react-native-nitro-ocr", {
        "cameraPermission": true,
        "cameraPermissionText": "This app uses the camera to recognize text",
        "androidScriptModels": ["japanese"]
      }]
    ]
  }
}
```

Or with no options (static image OCR only, Latin script):

```json
{
  "expo": {
    "plugins": ["react-native-nitro-ocr"]
  }
}
```

## Edge case behavior contract

| Scenario | Behavior |
|---|---|
| Duplicate entries in `androidScriptModels` (e.g. `['japanese', 'japanese']`) | Deduplicated before processing. Each dependency is injected at most once. |
| Invalid model string in `androidScriptModels` (e.g. `'arabic'`) | Silently skipped with a warning via `WarningAggregator`: key `'react-native-nitro-ocr'`, message `"Unknown script model '{value}'. Valid options: chinese, japanese, korean, devanagari."` |
| `NSCameraUsageDescription` already set in `Info.plist` (by user or another plugin) | Existing value is preserved. The plugin does not overwrite it. |
| `android.permission.CAMERA` already in `AndroidManifest.xml` | Not duplicated. Permission array is checked before push. |
| ML Kit dependency already in `app/build.gradle` (e.g. from another plugin or manual edit) | `contents.includes(dep)` check prevents duplicate injection. |
| `cameraPermission: true` with no `cameraPermissionText` | Default text used: `'This app uses the camera to recognize text'` |
| `options` is `undefined`/`void` (bare `"react-native-nitro-ocr"` in plugins) | Normalized to `{}`. Only Latin dep injected. No camera permissions. No minSdk warning unless config value is below 24. |

## Plugin unit test coverage

### iOS (`withIOSPermissions.test.ts`)

- No-op when `cameraPermission` is falsy
- Sets default camera text
- Sets custom camera text
- Preserves existing `NSCameraUsageDescription`

### Android (`withAndroidMLKit.test.ts`)

- Injects Latin dep by default
- Injects optional model dep
- Idempotent: no duplicate injection
- Duplicate `androidScriptModels` entries deduped
- Invalid model string warned and skipped
- Camera permission added when requested
- Camera permission idempotent
- Camera permission absent by default
- MinSdk warning when below 24
- No minSdk warning when >= 24

### Integration (`index.test.ts`)

- `createRunOncePlugin` wraps correctly
- Void options normalized (does not throw)

## Resolved questions

1. **Transitive ML Kit dependency.** Always injected defensively. Whether Expo autolinking resolves it transitively is uncertain across Expo SDK versions. Gradle deduplicates, so injecting it costs nothing. Omitting it risks a broken build.

2. **Nitrogen generated files.** The `prepare` script runs `bob build` which runs Nitrogen before `tsc`. Nitrogen-generated files exist by the time `pod install` runs during prebuild.

3. **C++ / CMake on Expo.** Verified: Android builds succeed with the current CMake configuration in Expo managed workflow via `expo prebuild`.

4. **EAS Build compatibility.** Verified: Plugin must be smoke-tested with `expo prebuild` on both iOS and Android before release. See verification checklist.
