export type InstallPlatform = 'ios-safari' | 'ios-other' | 'android' | 'desktop';

/** Which "Add to Home Screen" instructions apply. iPhones can only install from Safari. */
export function installPlatform(ua: string, maxTouchPoints = 0): InstallPlatform {
  const iPadOS = /Macintosh/.test(ua) && maxTouchPoints > 1; // iPads pretend to be Macs
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) {
    const other = /CriOS|FxiOS|EdgiOS|OPiOS|GSA|Instagram|FBAN|FBAV/.test(ua);
    return other ? 'ios-other' : 'ios-safari';
  }
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

export function isStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}
