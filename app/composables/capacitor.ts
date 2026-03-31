import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export function useCapacitor() {
  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();

  return {
    platform,
    isNative,
    isAndroid: platform === 'android',
    isIOS: platform === 'ios',
    isWeb: platform === 'web',
  };
}

// Token storage for native apps (since cookies don't work well in WebView)
export async function setAuthToken(token: string): Promise<void> {
  const { isNative } = useCapacitor();
  if (isNative) {
    await Preferences.set({ key: 'auth_token', value: token });
  } else {
    localStorage.setItem('auth_token', token);
  }
}

export async function getAuthToken(): Promise<string | null> {
  const { isNative } = useCapacitor();
  if (isNative) {
    const { value } = await Preferences.get({ key: 'auth_token' });
    return value;
  } else {
    return localStorage.getItem('auth_token');
  }
}

export async function removeAuthToken(): Promise<void> {
  const { isNative } = useCapacitor();
  if (isNative) {
    await Preferences.remove({ key: 'auth_token' });
  } else {
    localStorage.removeItem('auth_token');
  }
}

export async function setRefreshToken(token: string): Promise<void> {
  const { isNative } = useCapacitor();
  if (isNative) {
    await Preferences.set({ key: 'refresh_token', value: token });
  } else {
    localStorage.setItem('refresh_token', token);
  }
}

export async function getRefreshToken(): Promise<string | null> {
  const { isNative } = useCapacitor();
  if (isNative) {
    const { value } = await Preferences.get({ key: 'refresh_token' });
    return value;
  } else {
    return localStorage.getItem('refresh_token');
  }
}

export async function removeRefreshToken(): Promise<void> {
  const { isNative } = useCapacitor();
  if (isNative) {
    await Preferences.remove({ key: 'refresh_token' });
  } else {
    localStorage.removeItem('refresh_token');
  }
}
