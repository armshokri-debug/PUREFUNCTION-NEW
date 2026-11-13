import { describe, expect, it } from 'vitest';
import { installPlatform } from '../install';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Mobile Safari/537.36';
const MAC = IPAD_AS_MAC;

describe('installPlatform', () => {
  it('detects iPhone Safari vs other iPhone browsers', () => {
    expect(installPlatform(IPHONE_SAFARI)).toBe('ios-safari');
    expect(installPlatform(IPHONE_CHROME)).toBe('ios-other');
  });
  it('treats an iPad that looks like a Mac as iOS', () => {
    expect(installPlatform(IPAD_AS_MAC, 5)).toBe('ios-safari');
    expect(installPlatform(MAC, 0)).toBe('desktop');
  });
  it('detects Android', () => expect(installPlatform(ANDROID)).toBe('android'));
});
