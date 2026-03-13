jest.mock('react-native-nitro-modules', () => {
  const mock = {
    recognize: jest.fn(),
    recognizeText: jest.fn(),
    getSupportedLanguages: jest.fn(),
  };
  return {
    NitroModules: {
      createHybridObject: () => mock,
    },
    _mock: mock,
  };
});

export {};

const { _mock: mockHybridObject } =
  require('react-native-nitro-modules') as any;
const {
  recognize,
  recognizeText,
  getSupportedLanguages,
  OCRError,
} = require('../index');

type OCRErrorCode = import('../index').OCRErrorCode;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('OCRError', () => {
  it('constructs with code and message', () => {
    const error = new OCRError('INVALID_SOURCE', 'Source string is empty');
    expect(error.code).toBe('INVALID_SOURCE');
    expect(error.message).toBe('Source string is empty');
    expect(error.name).toBe('OCRError');
    expect(error).toBeInstanceOf(Error);
  });

  it('supports all error codes', () => {
    const codes: OCRErrorCode[] = [
      'INVALID_SOURCE',
      'IMAGE_LOAD_FAILED',
      'RECOGNITION_FAILED',
      'UNSUPPORTED_LANGUAGE',
      'MODEL_NOT_AVAILABLE',
      'CANCELLED',
    ];
    for (const code of codes) {
      const error = new OCRError(code, 'test');
      expect(error.code).toBe(code);
    }
  });
});

describe('parseNativeError', () => {
  it('parses structured native error messages', async () => {
    mockHybridObject.recognize.mockRejectedValue(
      new Error('IMAGE_LOAD_FAILED: Could not decode image at file:///bad.jpg')
    );
    await expect(recognize('file:///bad.jpg')).rejects.toMatchObject({
      code: 'IMAGE_LOAD_FAILED',
      message: 'Could not decode image at file:///bad.jpg',
    });
  });

  it('parses INVALID_SOURCE errors', async () => {
    mockHybridObject.recognize.mockRejectedValue(
      new Error('INVALID_SOURCE: Source string is empty')
    );
    await expect(recognize('')).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
      message: 'Source string is empty',
    });
  });

  it('falls back to RECOGNITION_FAILED for unstructured errors', async () => {
    mockHybridObject.recognize.mockRejectedValue(
      new Error('something went wrong')
    );
    await expect(recognize('file:///test.jpg')).rejects.toMatchObject({
      code: 'RECOGNITION_FAILED',
      message: 'something went wrong',
    });
  });

  it('handles non-Error thrown values', async () => {
    mockHybridObject.recognize.mockRejectedValue('raw string error');
    await expect(recognize('file:///test.jpg')).rejects.toMatchObject({
      code: 'RECOGNITION_FAILED',
      message: 'raw string error',
    });
  });

  it('falls back to RECOGNITION_FAILED for unknown error codes', async () => {
    mockHybridObject.recognize.mockRejectedValue(
      new Error('UNKNOWN_CODE: some message')
    );
    await expect(recognize('file:///test.jpg')).rejects.toMatchObject({
      code: 'RECOGNITION_FAILED',
      message: 'UNKNOWN_CODE: some message',
    });
  });
});

describe('recognize', () => {
  it('delegates to HybridObject and returns result', async () => {
    const mockResult = { text: 'Hello', blocks: [] };
    mockHybridObject.recognize.mockResolvedValue(mockResult);

    const result = await recognize('file:///test.jpg');
    expect(result).toEqual(mockResult);
    expect(mockHybridObject.recognize).toHaveBeenCalledWith(
      'file:///test.jpg',
      undefined
    );
  });

  it('passes options through', async () => {
    mockHybridObject.recognize.mockResolvedValue({ text: '', blocks: [] });
    const options = {
      languages: ['en'],
      recognitionLevel: 'accurate' as const,
    };

    await recognize('file:///test.jpg', options);
    expect(mockHybridObject.recognize).toHaveBeenCalledWith(
      'file:///test.jpg',
      options
    );
  });

  it('wraps native errors as OCRError', async () => {
    mockHybridObject.recognize.mockRejectedValue(
      new Error('RECOGNITION_FAILED: Engine error')
    );
    await expect(recognize('file:///test.jpg')).rejects.toBeInstanceOf(
      OCRError
    );
  });
});

describe('recognizeText', () => {
  it('delegates to HybridObject and returns string', async () => {
    mockHybridObject.recognizeText.mockResolvedValue('Hello World');

    const result = await recognizeText('file:///test.jpg');
    expect(result).toBe('Hello World');
    expect(mockHybridObject.recognizeText).toHaveBeenCalledWith(
      'file:///test.jpg',
      undefined
    );
  });

  it('wraps native errors as OCRError', async () => {
    mockHybridObject.recognizeText.mockRejectedValue(
      new Error('INVALID_SOURCE: Unsupported URI scheme')
    );
    await expect(recognizeText('badscheme://test')).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });
});

describe('getSupportedLanguages', () => {
  it('delegates to HybridObject and returns array', async () => {
    mockHybridObject.getSupportedLanguages.mockResolvedValue([
      'en',
      'fr',
      'de',
    ]);

    const result = await getSupportedLanguages();
    expect(result).toEqual(['en', 'fr', 'de']);
  });

  it('wraps native errors as OCRError', async () => {
    mockHybridObject.getSupportedLanguages.mockRejectedValue(
      new Error('RECOGNITION_FAILED: Context not available')
    );
    await expect(getSupportedLanguages()).rejects.toBeInstanceOf(OCRError);
  });
});
