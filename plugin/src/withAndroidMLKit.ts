import {
  withAppBuildGradle,
  withAndroidManifest,
  WarningAggregator,
  type ConfigPlugin,
} from 'expo/config-plugins';

export const VALID_SCRIPT_MODELS = [
  'chinese',
  'japanese',
  'korean',
  'devanagari',
] as const;

export const ML_KIT_DEPS: Record<
  'latin' | (typeof VALID_SCRIPT_MODELS)[number],
  string
> = {
  latin: 'com.google.mlkit:text-recognition:16.0.1',
  chinese: 'com.google.mlkit:text-recognition-chinese:16.0.1',
  japanese: 'com.google.mlkit:text-recognition-japanese:16.0.1',
  korean: 'com.google.mlkit:text-recognition-korean:16.0.1',
  devanagari: 'com.google.mlkit:text-recognition-devanagari:16.0.1',
};

type Props = {
  cameraPermission?: boolean;
  androidScriptModels?: string[];
};

export function resolveScriptModels(models?: string[]): {
  models: string[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const validated: string[] = [];
  for (const model of [...new Set(models ?? [])]) {
    if ((VALID_SCRIPT_MODELS as readonly string[]).includes(model)) {
      validated.push(model);
    } else if (model !== 'latin') {
      warnings.push(
        `Unknown script model '${model}'. Valid options: ${VALID_SCRIPT_MODELS.join(
          ', '
        )}.`
      );
    }
  }
  return { models: ['latin', ...validated], warnings };
}

export function addMLKitDependencies(
  gradleContents: string,
  models: string[]
): string {
  for (const model of models) {
    const dep = ML_KIT_DEPS[model as keyof typeof ML_KIT_DEPS];
    if (dep && !gradleContents.includes(dep)) {
      gradleContents = gradleContents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    implementation '${dep}'`
      );
    }
  }
  return gradleContents;
}

export function addCameraPermission(manifest: any): any {
  const permissions = manifest['uses-permission'] || [];
  if (
    !permissions.some(
      (p: any) => p.$?.['android:name'] === 'android.permission.CAMERA'
    )
  ) {
    permissions.push({
      $: { 'android:name': 'android.permission.CAMERA' },
    });
  }
  manifest['uses-permission'] = permissions;
  return manifest;
}

export function getMinSdkWarning(minSdk?: number): string | null {
  if (minSdk !== undefined && minSdk < 24) {
    return `requires minSdkVersion >= 24, but the project targets ${minSdk}. The build may fail.`;
  }
  return null;
}

export const withAndroidMLKit: ConfigPlugin<Props> = (
  config,
  { cameraPermission = false, androidScriptModels = [] }
) => {
  const minSdk = (config.android as any)?.minSdkVersion as number | undefined;
  const minSdkWarning = getMinSdkWarning(minSdk);
  if (minSdkWarning) {
    WarningAggregator.addWarningAndroid(
      'react-native-nitro-ocr',
      minSdkWarning
    );
  }

  const { models, warnings } = resolveScriptModels(androidScriptModels);
  for (const warning of warnings) {
    WarningAggregator.addWarningAndroid('react-native-nitro-ocr', warning);
  }

  config = withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addMLKitDependencies(
      cfg.modResults.contents,
      models
    );
    return cfg;
  });

  if (cameraPermission) {
    config = withAndroidManifest(config, (cfg) => {
      addCameraPermission(cfg.modResults.manifest);
      return cfg;
    });
  }

  return config;
};
