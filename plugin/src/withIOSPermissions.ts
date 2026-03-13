import { withInfoPlist, type ConfigPlugin } from 'expo/config-plugins';

type Props = {
  cameraPermission?: boolean;
  cameraPermissionText?: string;
};

export function setCameraPermission(
  infoPlist: Record<string, any>,
  cameraPermissionText?: string
): Record<string, any> {
  infoPlist.NSCameraUsageDescription =
    infoPlist.NSCameraUsageDescription ||
    cameraPermissionText ||
    'This app uses the camera to recognize text';
  return infoPlist;
}

export const withIOSPermissions: ConfigPlugin<Props> = (
  config,
  { cameraPermission = false, cameraPermissionText }
) => {
  if (!cameraPermission) return config;
  return withInfoPlist(config, (cfg) => {
    setCameraPermission(cfg.modResults, cameraPermissionText);
    return cfg;
  });
};
