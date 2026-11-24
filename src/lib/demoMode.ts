export const VOW_DEMO_ACCOUNT_EMAIL = 'joshuakasanga9@gmail.com';

function storageKey(userId: string): string {
  return `vow:demo-mode:${userId}`;
}

export function isDemoModeEligible(email?: string | null): boolean {
  return email?.trim().toLowerCase() === VOW_DEMO_ACCOUNT_EMAIL;
}

export function getDemoModeEnabled(userId?: string | null): boolean {
  if (!userId || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(storageKey(userId)) === 'true';
  } catch {
    return false;
  }
}

export function setDemoModeEnabled(userId: string, enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) window.localStorage.setItem(storageKey(userId), 'true');
    else window.localStorage.removeItem(storageKey(userId));
  } catch (error) {
    console.warn('[VOW] Demo mode preference could not be saved:', error);
  }
  window.dispatchEvent(new CustomEvent('vow:demo-mode-changed', {
    detail: { userId, enabled },
  }));
}
