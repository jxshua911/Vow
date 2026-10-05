import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export async function openExternalLink(value: string): Promise<void> {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new Error('External links must be secure HTTPS URLs.');
  }

  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url: url.toString() });
    return;
  }

  const opened = window.open('about:blank', '_blank');
  if (!opened) {
    window.location.assign(url.toString());
    return;
  }
  opened.opener = null;
  opened.location.replace(url.toString());
}
