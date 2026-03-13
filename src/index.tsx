import { NitroModules } from 'react-native-nitro-modules';
import type { NitroOcr, RecognizeOptions, OCRResult } from './NitroOcr.nitro';

export type {
  RecognizeOptions,
  OCRResult,
  OCRBlock,
  OCRLine,
  OCRElement,
  OCRSymbol,
  BoundingBox,
  Point,
  RecognitionLevel,
  ScriptHint,
} from './NitroOcr.nitro';

export type OCRErrorCode =
  | 'INVALID_SOURCE'
  | 'IMAGE_LOAD_FAILED'
  | 'RECOGNITION_FAILED'
  | 'UNSUPPORTED_LANGUAGE'
  | 'MODEL_NOT_AVAILABLE'
  | 'CANCELLED';

export class OCRError extends Error {
  public readonly code: OCRErrorCode;

  constructor(code: OCRErrorCode, message: string) {
    super(message);
    this.name = 'OCRError';
    this.code = code;
    Object.setPrototypeOf(this, OCRError.prototype);
  }
}

// Must stay in sync with the OCRErrorCode type union above.
const VALID_ERROR_CODES: ReadonlySet<string> = new Set<OCRErrorCode>([
  'INVALID_SOURCE',
  'IMAGE_LOAD_FAILED',
  'RECOGNITION_FAILED',
  'UNSUPPORTED_LANGUAGE',
  'MODEL_NOT_AVAILABLE',
  'CANCELLED',
]);

function isOCRErrorCode(value: string): value is OCRErrorCode {
  return VALID_ERROR_CODES.has(value);
}

function parseNativeError(error: unknown): OCRError {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/^([A-Z_]+): ([\s\S]+)$/);
  if (match?.[1] && match[2] && isOCRErrorCode(match[1])) {
    return new OCRError(match[1], match[2]);
  }
  return new OCRError('RECOGNITION_FAILED', message);
}

const NitroOcrHybridObject =
  NitroModules.createHybridObject<NitroOcr>('NitroOcr');

export async function recognize(
  source: string,
  options?: RecognizeOptions
): Promise<OCRResult> {
  try {
    return await NitroOcrHybridObject.recognize(source, options);
  } catch (error) {
    throw parseNativeError(error);
  }
}

export async function recognizeText(
  source: string,
  options?: RecognizeOptions
): Promise<string> {
  try {
    return await NitroOcrHybridObject.recognizeText(source, options);
  } catch (error) {
    throw parseNativeError(error);
  }
}

export async function getSupportedLanguages(): Promise<string[]> {
  try {
    return await NitroOcrHybridObject.getSupportedLanguages();
  } catch (error) {
    throw parseNativeError(error);
  }
}
