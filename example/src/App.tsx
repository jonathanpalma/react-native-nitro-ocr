import { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FixtureScreen from './FixtureScreen';

type Tab = 'fixtures' | 'interactive';

export default function App() {
  const [tab, setTab] = useState<Tab>('fixtures');

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'fixtures' && styles.tabActive]}
          onPress={() => setTab('fixtures')}
        >
          <Text
            style={[styles.tabText, tab === 'fixtures' && styles.tabTextActive]}
          >
            Fixture Tests
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'interactive' && styles.tabActive]}
          onPress={() => setTab('interactive')}
        >
          <Text
            style={[
              styles.tabText,
              tab === 'interactive' && styles.tabTextActive,
            ]}
          >
            Interactive
          </Text>
        </TouchableOpacity>
      </View>
      {tab === 'fixtures' ? (
        <FixtureScreen />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Interactive mode requires react-native-image-picker.
          </Text>
          <Text style={styles.placeholderText}>
            Run fixture tests to validate OCR functionality.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: { fontSize: 14, color: '#666' },
  tabTextActive: { color: '#007AFF', fontWeight: '600' },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  placeholderText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 8,
  },
});
