import type { HybridObject } from 'react-native-nitro-modules';

export type RecognitionLevel = 'fast' | 'accurate';
export type ScriptHint =
  | 'latin'
  | 'chinese'
  | 'devanagari'
  | 'japanese'
  | 'korean';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface OCRSymbol {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  cornerPoints: Point[];
}

export interface OCRElement {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  cornerPoints: Point[];
  recognizedLanguage: string;
  symbols: OCRSymbol[];
}

export interface OCRLine {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  cornerPoints: Point[];
  recognizedLanguages: string[];
  angle: number;
  elements: OCRElement[];
}

export interface OCRBlock {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  cornerPoints: Point[];
  recognizedLanguages: string[];
  lines: OCRLine[];
}

export interface OCRResult {
  text: string;
  blocks: OCRBlock[];
}

export interface RecognizeOptions {
  languages?: string[];
  recognitionLevel?: RecognitionLevel;
  scriptHints?: ScriptHint[];
  languageCorrection?: boolean;
}

export interface NitroOcr
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  recognize(source: string, options?: RecognizeOptions): Promise<OCRResult>;
  recognizeText(source: string, options?: RecognizeOptions): Promise<string>;
  getSupportedLanguages(): Promise<string[]>;
}
