import { createRunOncePlugin, type ConfigPlugin } from 'expo/config-plugins';
import { withIOSPermissions } from './withIOSPermissions';
import { withAndroidMLKit } from './withAndroidMLKit';

const pkg = require('../../package.json');

type NitroOcrPluginOptions = {
  cameraPermission?: boolean;
  cameraPermissionText?: string;
  androidScriptModels?: Array<'chinese' | 'japanese' | 'korean' | 'devanagari'>;
};

const withNitroOcr: ConfigPlugin<NitroOcrPluginOptions | void> = (
  config,
  options = {}
) => {
  const opts = options || {};
  config = withIOSPermissions(config, opts);
  config = withAndroidMLKit(config, opts);
  return config;
};

export default createRunOncePlugin(withNitroOcr, pkg.name, pkg.version);
