import {
  resolveScriptModels,
  addMLKitDependencies,
  addCameraPermission,
  getMinSdkWarning,
} from '../withAndroidMLKit';

const BASE_GRADLE = `
android {
    compileSdkVersion 34
}

dependencies {
    implementation project(':react-native')
}
`;

describe('resolveScriptModels', () => {
  it('includes latin by default when input is undefined', () => {
    const result = resolveScriptModels(undefined);
    expect(result).toEqual({ models: ['latin'], warnings: [] });
  });

  it('includes latin by default when input is empty', () => {
    const result = resolveScriptModels([]);
    expect(result).toEqual({ models: ['latin'], warnings: [] });
  });

  it('appends valid models after latin', () => {
    const result = resolveScriptModels(['japanese', 'chinese']);
    expect(result.models).toEqual(['latin', 'japanese', 'chinese']);
    expect(result.warnings).toHaveLength(0);
  });

  it('rejects invalid model with warning', () => {
    const result = resolveScriptModels(['arabic']);
    expect(result.models).toEqual(['latin']);
    expect(result.warnings).toEqual([
      expect.stringContaining("Unknown script model 'arabic'"),
    ]);
  });

  it('deduplicates entries', () => {
    const result = resolveScriptModels(['japanese', 'japanese']);
    expect(result.models).toEqual(['latin', 'japanese']);
  });

  it('handles mixed valid and invalid input', () => {
    const result = resolveScriptModels(['japanese', 'arabic']);
    expect(result.models).toEqual(['latin', 'japanese']);
    expect(result.warnings).toHaveLength(1);
  });

  it('does not duplicate latin when passed explicitly', () => {
    const result = resolveScriptModels(['latin', 'korean']);
    expect(result.models).toEqual(['latin', 'korean']);
  });
});

describe('addMLKitDependencies', () => {
  it('injects Latin dependency', () => {
    const result = addMLKitDependencies(BASE_GRADLE, ['latin']);
    expect(result).toContain('com.google.mlkit:text-recognition:16.0.1');
  });

  it('injects multiple dependencies', () => {
    const result = addMLKitDependencies(BASE_GRADLE, ['latin', 'japanese']);
    expect(result).toContain('com.google.mlkit:text-recognition:16.0.1');
    expect(result).toContain(
      'com.google.mlkit:text-recognition-japanese:16.0.1'
    );
  });

  it('is idempotent', () => {
    const once = addMLKitDependencies(BASE_GRADLE, ['latin']);
    const twice = addMLKitDependencies(once, ['latin']);
    const matches = twice.match(
      /com\.google\.mlkit:text-recognition:16\.0\.1/g
    );
    expect(matches).toHaveLength(1);
  });

  it('preserves unrelated Gradle content', () => {
    const result = addMLKitDependencies(BASE_GRADLE, ['latin']);
    expect(result).toContain("implementation project(':react-native')");
  });
});

describe('addCameraPermission', () => {
  it('adds permission to empty manifest', () => {
    const manifest: any = {};
    const result = addCameraPermission(manifest);
    expect(result['uses-permission']).toEqual([
      { $: { 'android:name': 'android.permission.CAMERA' } },
    ]);
    expect(result).toBe(manifest); // mutates in place
  });

  it('is idempotent', () => {
    const manifest: any = {
      'uses-permission': [
        { $: { 'android:name': 'android.permission.CAMERA' } },
      ],
    };
    addCameraPermission(manifest);
    expect(manifest['uses-permission']).toHaveLength(1);
  });
});

describe('getMinSdkWarning', () => {
  it('returns warning when minSdk < 24', () => {
    const warning = getMinSdkWarning(21);
    expect(warning).toContain('requires minSdkVersion >= 24');
    expect(warning).toContain('21');
  });

  it('returns null when minSdk >= 24', () => {
    expect(getMinSdkWarning(24)).toBeNull();
  });

  it('returns null when minSdk is undefined', () => {
    expect(getMinSdkWarning(undefined)).toBeNull();
  });
});
