import { Capacitor } from '@capacitor/core';

export default defineNuxtPlugin(() => {
  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();

  return {
    provide: {
      capacitor: {
        platform,
        isNative,
        isAndroid: platform === 'android',
        isIOS: platform === 'ios',
        isWeb: platform === 'web',
      },
    },
  };
});
