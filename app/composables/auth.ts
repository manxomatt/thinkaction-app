import { CapacitorHttp } from '@capacitor/core';
import { setAuthToken, setRefreshToken } from './capacitor';
import { getFcmToken } from '~/plugins/003.push-notification.client';

export interface IUser {
  _id?: string
  email?: string
  username?: string
  name?: string
  profile?: {
    status?: string
    bio?: string
  }
  avatar?: {
    public_domain?: string
    public_path?: string
  },
  private_account?: boolean
}

export const useAuthUser = () => useState<IUser | null>('authUser', () => null);
export const useAuthToken = () => useState<string | null>('authToken', () => null);

export const useAuth = () => {
  const user = useAuthUser();
  const token = useAuthToken();
  const { isNative } = useCapacitor();

  const isAuthenticated = computed(() => !!user.value);

  const updateUser = (data: IUser | null) => {
    user.value = data;
  };

  const signin = async (username: string, password: string) => {
    console.log('[Auth] signin() called');
    console.log('[Auth] isNative:', isNative);
    const config = useRuntimeConfig();

    // Use Capacitor native HTTP for native platforms to bypass CORS
    if (isNative) {
      console.log('[Auth] Using native HTTP for signin');
      const response = await CapacitorHttp.post({
        url: `${config.public.apiBase}/auth/signin`,
        headers: {
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({ username, password }),
        webFetchExtra: {
          credentials: 'include',
        },
        connectTimeout: 30000,
        readTimeout: 30000,
      });

      console.log('[Auth] Signin response status:', response.status);
      console.log('[Auth] Signin response data:', JSON.stringify(response.data));
      console.log('[Auth] Signin response headers:', JSON.stringify(response.headers));

      if (response.status >= 400) {
        throw createError({
          statusCode: response.status,
          data: response.data,
        });
      }

      const data = response.data as IUser & { access_token?: string; refresh_token?: string };

      // Extract tokens from response body (API returns tokens in body, not headers)
      const accessToken = data.access_token;
      const refreshToken = data.refresh_token;

      console.log('[Auth] Access token from body:', accessToken ? `${accessToken.substring(0, 20)}...` : 'NOT FOUND');
      console.log('[Auth] Refresh token from body:', refreshToken ? `${refreshToken.substring(0, 20)}...` : 'NOT FOUND');

      if (accessToken) {
        await setAuthToken(accessToken);
        console.log('[Auth] Access token saved to Preferences');

        // Verify token was saved correctly
        const { getAuthToken } = await import('./capacitor');
        const savedToken = await getAuthToken();
        console.log('[Auth] Verified saved token:', savedToken ? `${savedToken.substring(0, 20)}...` : 'NOT SAVED');
      } else {
        console.warn('[Auth] WARNING: No access token found in response body!');
      }
      if (refreshToken) {
        await setRefreshToken(refreshToken);
        console.log('[Auth] Refresh token saved to Preferences');

        // Verify refresh token was saved correctly
        const { getRefreshToken } = await import('./capacitor');
        const savedRefreshToken = await getRefreshToken();
        console.log('[Auth] Verified saved refresh token:', savedRefreshToken ? `${savedRefreshToken.substring(0, 20)}...` : 'NOT SAVED');
      } else {
        console.warn('[Auth] WARNING: No refresh token found in response body!');
      }
      updateUser(data);
      // Sync FCM token after successful login
      console.log('[Auth] About to sync FCM token...');
      await syncFcmToken();
      return data;
    }

    // Use standard fetch for web
    const data = await $fetch<IUser>('/auth/signin', {
      baseURL: config.public.apiBase,
      method: 'POST',
      body: { username, password },
      credentials: 'include',
    });
    updateUser(data);
    // Sync FCM token after successful login
    await syncFcmToken();
    return data;
  };

  const me = async () => {
    const { data, error } = await useApiFetch<IUser>('/auth/me', {
      method: 'GET',
      credentials: 'include',
    });
    updateUser(data.value);
    return { data, error };
  };

  const sendEmailVerification = async (username: string) => {
    return await useApiClientFetch('/auth/send-email-verification', {
      method: 'POST',
      credentials: 'include',
      body: {
        username,
      },
    });
  };

  const signout = async () => {
    const data = await useApiClientFetch('/auth/signout', { method: 'POST', credentials: 'include' });
    updateUser(null);
    return data;
  };

  const updateLastSeen = async () => {
    useApiClientFetch('/auth/update-last-seen', { method: 'POST' });
  };

  const signup = async (payload: Record<string, unknown>) => {
    return await useApiClientFetch('/auth/signup', { method: 'POST', body: payload });
  };

  const verifyEmail = async (code: string) => {
    return await useApiClientFetch('/auth/verify-email', { method: 'POST', body: { code } });
  };

  const requestPassword = async (email: string) => {
    return await useApiClientFetch('/auth/request-password', { method: 'POST', body: { email } });
  };

  const resetPassword = async (code: string, password: string) => {
    return await useApiClientFetch('/auth/reset-password', { method: 'POST', body: { code, password } });
  };

  /**
   * Update FCM token for push notifications
   * This should be called whenever the FCM token is received or refreshed
   * @param fcmToken - The FCM token from Firebase
   */
  const updateFcmToken = async (fcmToken: string) => {
    return await useApiClientFetch('/auth/update-fcm-token', {
      method: 'POST',
      body: { fcm_token: fcmToken },
    });
  };

  /**
   * Sync FCM token to backend if available
   * This is called automatically after successful login
   */
  const syncFcmToken = async () => {
    try {
      const fcmToken = getFcmToken();
      if (fcmToken) {
        console.log('[Auth] Syncing FCM token after login...');
        await updateFcmToken(fcmToken);
        console.log('[Auth] FCM token synced successfully');
      }
    } catch (error) {
      // Don't throw - FCM sync failure shouldn't break login flow
      console.error('[Auth] Failed to sync FCM token:', error);
    }
  };

  return {
    me,
    user,
    updateUser,
    token,
    signup,
    verifyEmail,
    signin,
    signout,
    updateLastSeen,
    isAuthenticated,
    requestPassword,
    resetPassword,
    sendEmailVerification,
    updateFcmToken,
    syncFcmToken,
  };
};
