import { useCallback, useState } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  recognize,
  recognizeText,
  getSupportedLanguages,
  OCRError,
} from 'react-native-nitro-ocr';
import type { OCRResult } from 'react-native-nitro-ocr';

const noTextImg = require('./fixtures/no-text.png');
const helloWorldImg = require('./fixtures/hello-world.png');
const twoParagraphsImg = require('./fixtures/two-paragraphs.png');
const rotatedTextImg = require('./fixtures/rotated-text.png');
const portraitExifImg = require('./fixtures/portrait-exif.jpg');

type TestStatus = 'pending' | 'running' | 'pass' | 'fail';

interface TestResult {
  name: string;
  status: TestStatus;
  detail?: string;
}

function resolveAssetUri(asset: number): string {
  const resolved = Image.resolveAssetSource(asset);
  if (!resolved) {
    throw new Error('Could not resolve asset');
  }
  return resolved.uri;
}

export default function FixtureScreen() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);

  const updateResult = useCallback(
    (index: number, update: Partial<TestResult>) => {
      setResults((prev) => {
        const next = [...prev];
        const existing = next[index];
        if (existing) {
          next[index] = { ...existing, ...update };
        }
        return next;
      });
    },
    []
  );

  const runTests = useCallback(async () => {
    setRunning(true);

    const tests: TestResult[] = [
      { name: 'no-text.png: empty result', status: 'pending' },
      { name: 'hello-world.png: basic recognition', status: 'pending' },
      { name: 'two-paragraphs.png: multi-block', status: 'pending' },
      { name: 'rotated-text.png: angle detection', status: 'pending' },
      { name: 'portrait-exif.jpg: orientation', status: 'pending' },
      { name: 'recognizeText matches recognize', status: 'pending' },
      { name: 'getSupportedLanguages', status: 'pending' },
      { name: 'error: empty source', status: 'pending' },
      { name: 'error: nonexistent file', status: 'pending' },
    ];
    setResults(tests);

    let idx = 0;

    // Test 0: no-text.png
    await runSingle(idx, updateResult, async () => {
      const uri = resolveAssetUri(noTextImg);
      const result = await recognize(uri);
      assert(result.text === '', `Expected empty text, got: "${result.text}"`);
      assert(
        result.blocks.length === 0,
        `Expected 0 blocks, got: ${result.blocks.length}`
      );
      return 'text="" blocks=0';
    });
    idx++;

    // Test 1: hello-world.png
    await runSingle(idx, updateResult, async () => {
      const uri = resolveAssetUri(helloWorldImg);
      const result = await recognize(uri);
      return formatResult(result);
    });
    idx++;

    // Test 2: two-paragraphs.png
    await runSingle(idx, updateResult, async () => {
      const uri = resolveAssetUri(twoParagraphsImg);
      const result = await recognize(uri);
      return formatResult(result);
    });
    idx++;

    // Test 3: rotated-text.png
    await runSingle(idx, updateResult, async () => {
      const uri = resolveAssetUri(rotatedTextImg);
      const result = await recognize(uri);
      return formatResult(result);
    });
    idx++;

    // Test 4: portrait-exif.jpg
    await runSingle(idx, updateResult, async () => {
      const uri = resolveAssetUri(portraitExifImg);
      const result = await recognize(uri);
      return formatResult(result);
    });
    idx++;

    // Test 5: recognizeText matches recognize().text
    await runSingle(idx, updateResult, async () => {
      const uri = resolveAssetUri(helloWorldImg);
      const fullResult = await recognize(uri);
      const textOnly = await recognizeText(uri);
      assert(
        fullResult.text === textOnly,
        `Mismatch: recognize="${fullResult.text}" vs recognizeText="${textOnly}"`
      );
      return `Both returned: "${textOnly}"`;
    });
    idx++;

    // Test 6: getSupportedLanguages
    await runSingle(idx, updateResult, async () => {
      const langs = await getSupportedLanguages();
      assert(Array.isArray(langs), 'Expected array');
      assert(langs.length > 0, 'Expected at least one language');
      return `${langs.length} languages: ${langs.slice(0, 5).join(', ')}...`;
    });
    idx++;

    // Test 7: error - empty source
    await runSingle(idx, updateResult, async () => {
      try {
        await recognize('');
        throw new Error('Should have thrown');
      } catch (e) {
        assert(e instanceof OCRError, `Expected OCRError, got: ${e}`);
        assert(
          (e as OCRError).code === 'INVALID_SOURCE',
          `Expected INVALID_SOURCE, got: ${(e as OCRError).code}`
        );
        return `OCRError code=${(e as OCRError).code}`;
      }
    });
    idx++;

    // Test 8: error - nonexistent file
    await runSingle(idx, updateResult, async () => {
      try {
        await recognize('file:///nonexistent_test_image_12345.jpg');
        throw new Error('Should have thrown');
      } catch (e) {
        assert(e instanceof OCRError, `Expected OCRError, got: ${e}`);
        assert(
          (e as OCRError).code === 'IMAGE_LOAD_FAILED',
          `Expected IMAGE_LOAD_FAILED, got: ${(e as OCRError).code}`
        );
        return `OCRError code=${(e as OCRError).code}`;
      }
    });

    setRunning(false);
  }, [updateResult]);

  const passCount = results.filter((r) => r.status === 'pass').length;
  const failCount = results.filter((r) => r.status === 'fail').length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Fixture Tests</Text>
      <Text style={styles.subtitle}>Platform: {Platform.OS}</Text>

      <TouchableOpacity
        style={[styles.button, running && styles.buttonDisabled]}
        onPress={runTests}
        disabled={running}
      >
        <Text style={styles.buttonText}>
          {running ? 'Running...' : 'Run Tests'}
        </Text>
      </TouchableOpacity>

      {results.length > 0 && (
        <Text style={styles.summary}>
          {passCount} passed, {failCount} failed, {results.length} total
        </Text>
      )}

      {results.map((r, i) => (
        <View key={i} style={styles.testRow}>
          <Text style={styles.testStatus}>
            {r.status === 'pass'
              ? 'PASS'
              : r.status === 'fail'
              ? 'FAIL'
              : r.status === 'running'
              ? '...'
              : '-'}
          </Text>
          <View style={styles.testInfo}>
            <Text
              style={[
                styles.testName,
                r.status === 'fail' && styles.testNameFail,
              ]}
            >
              {r.name}
            </Text>
            {r.detail ? (
              <Text style={styles.testDetail} numberOfLines={3}>
                {r.detail}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

async function runSingle(
  index: number,
  update: (i: number, u: Partial<TestResult>) => void,
  fn: () => Promise<string>
) {
  update(index, { status: 'running' });
  try {
    const detail = await fn();
    update(index, { status: 'pass', detail });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    update(index, { status: 'fail', detail: msg });
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function formatResult(result: OCRResult): string {
  const blockCount = result.blocks.length;
  const lineCount = result.blocks.reduce((s, b) => s + b.lines.length, 0);
  const text =
    result.text.length > 80
      ? result.text.substring(0, 80) + '...'
      : result.text;
  return `blocks=${blockCount} lines=${lineCount} text="${text}"`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  button: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  summary: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  testRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  testStatus: { width: 40, fontSize: 12, fontWeight: 'bold', color: '#333' },
  testInfo: { flex: 1 },
  testName: { fontSize: 13, fontWeight: '500' },
  testNameFail: { color: '#d00' },
  testDetail: { fontSize: 11, color: '#666', marginTop: 2 },
});
