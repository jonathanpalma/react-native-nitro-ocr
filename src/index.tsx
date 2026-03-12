import { NitroModules } from 'react-native-nitro-modules';
import type { NitroOcr } from './NitroOcr.nitro';

const NitroOcrHybridObject =
  NitroModules.createHybridObject<NitroOcr>('NitroOcr');

export function multiply(a: number, b: number): number {
  return NitroOcrHybridObject.multiply(a, b);
}
