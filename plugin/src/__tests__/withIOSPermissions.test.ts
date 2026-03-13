import { setCameraPermission } from '../withIOSPermissions';

describe('setCameraPermission', () => {
  it('sets default camera text', () => {
    const plist: Record<string, any> = {};
    const result = setCameraPermission(plist);
    expect(result.NSCameraUsageDescription).toBe(
      'This app uses the camera to recognize text'
    );
    expect(result).toBe(plist); // mutates in place
  });

  it('sets custom camera text', () => {
    const plist: Record<string, any> = {};
    setCameraPermission(plist, 'Scan documents with camera');
    expect(plist.NSCameraUsageDescription).toBe('Scan documents with camera');
  });

  it('preserves existing NSCameraUsageDescription', () => {
    const plist: Record<string, any> = {
      NSCameraUsageDescription: 'Already set by another plugin',
    };
    setCameraPermission(plist, 'Custom text');
    expect(plist.NSCameraUsageDescription).toBe(
      'Already set by another plugin'
    );
  });
});
