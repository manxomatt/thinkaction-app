import { useRuntimeConfig, useRequestHeaders, navigateTo } from '#app';
import type { UseFetchOptions, AsyncData } from 'nuxt/app';
import type { Ref } from 'vue';
import type { FetchError } from 'ofetch';
import QueryString from 'qs';
import { CapacitorHttp, type HttpResponse } from '@capacitor/core';
import { useCapacitor, getAuthToken, setAuthToken, setRefreshToken } from './capacitor';

const cleanHeaders = (headers?: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(headers ?? {}).filter(([_, v]) => v)) as Record<string, string>;

// --- Native refresh token ---
const refreshTokenNative = async (apiBaseUrl: string): Promise<boolean> => {
  try {
    const authToken = await getAuthToken();

    const response = await CapacitorHttp.post({
      url: `${apiBaseUrl}/auth/refresh`,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      connectTimeout: 30000,
      readTimeout: 30000,
    });

    if (response.status >= 400) {
      return false;
    }

    // Store new tokens if provided
    if (response.headers?.['x-access-token']) {
      await setAuthToken(response.headers['x-access-token']);
    }
    if (response.headers?.['x-refresh-token']) {
      await setRefreshToken(response.headers['x-refresh-token']);
    }

    return true;
  } catch {
    return false;
  }
};

export const refreshToken = async (apiBaseUrl: string, headers?: Record<string, string | undefined>) => {
  try {
    const { error } = await useFetch('/auth/refresh', {
      baseURL: apiBaseUrl,
      method: 'POST',
      credentials: 'include',
      headers: cleanHeaders(headers),
    });
    if (error.value) throw error.value;
    return true;
  } catch {
    return false;
  }
};

// --- Native API Fetch using Capacitor HTTP ---
async function nativeApiFetch<T>(
  url: string,
  options: UseFetchOptions<T> = {},
  retried = false,
): Promise<AsyncData<T, FetchError | null>> {
  const config = useRuntimeConfig();
  const { query, body, method = 'GET', headers = {} } = options;

  // Build full URL with query params
  let fullUrl = `${config.public.apiBase}${url}`;

  if (query && Object.keys(query).length > 0) {
    const queryString = QueryString.stringify(query, {
      allowDots: true,
      arrayFormat: 'brackets',
    });
    fullUrl = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}${queryString}`;
  }

  // Get auth token for native requests
  const authToken = await getAuthToken();

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };

  let response: HttpResponse;

  try {
    // Ensure body is properly serialized for Capacitor HTTP
    const serializedData = body !== undefined && body !== null
      ? (typeof body === 'string' ? body : JSON.stringify(body))
      : undefined;

    const httpOptions = {
      url: fullUrl,
      headers: requestHeaders,
      data: serializedData,
      // Add timeout to prevent hanging requests
      connectTimeout: 30000,
      readTimeout: 30000,
    };

    switch ((method as string).toUpperCase()) {
    case 'POST':
      response = await CapacitorHttp.post(httpOptions);
      break;
    case 'PUT':
      response = await CapacitorHttp.put(httpOptions);
      break;
    case 'PATCH':
      response = await CapacitorHttp.patch(httpOptions);
      break;
    case 'DELETE':
      response = await CapacitorHttp.delete(httpOptions);
      break;
    default:
      response = await CapacitorHttp.get({ url: fullUrl, headers: requestHeaders, connectTimeout: 30000, readTimeout: 30000 });
    }

    // Store new tokens if provided in response
    if (response.headers?.['x-access-token']) {
      await setAuthToken(response.headers['x-access-token']);
    }
    if (response.headers?.['x-refresh-token']) {
      await setRefreshToken(response.headers['x-refresh-token']);
    }

    if (response.status >= 400) {
      // Handle token expiration (401)
      if (response.status === 401 && !retried) {
        const refreshed = await refreshTokenNative(config.public.apiBase);
        if (refreshed) {
          return nativeApiFetch<T>(url, options, true);
        }
      }

      // Create error object similar to FetchError
      const error = {
        status: response.status,
        statusCode: response.status,
        data: response.data,
        message: response.data?.message || 'Request failed',
      } as FetchError;

      // Return AsyncData-like structure with error
      return {
        data: ref(null),
        pending: ref(false),
        error: ref(error),
        status: ref('error'),
        refresh: () => nativeApiFetch<T>(url, options),
        execute: () => nativeApiFetch<T>(url, options),
        clear: () => {},
      } as unknown as AsyncData<T, FetchError | null>;
    }

    // Return AsyncData-like structure with data
    return {
      data: ref(response.data as T),
      pending: ref(false),
      error: ref(null),
      status: ref('success'),
      refresh: () => nativeApiFetch<T>(url, options),
      execute: () => nativeApiFetch<T>(url, options),
      clear: () => {},
    } as unknown as AsyncData<T, FetchError | null>;
  } catch (err) {
    // Return AsyncData-like structure with error
    return {
      data: ref(null),
      pending: ref(false),
      error: ref(err as FetchError),
      status: ref('error'),
      refresh: () => nativeApiFetch<T>(url, options),
      execute: () => nativeApiFetch<T>(url, options),
      clear: () => {},
    } as unknown as AsyncData<T, FetchError | null>;
  }
}

export const useApiFetch = async <T>(
  url: string | Ref<string> | (() => string),
  options: UseFetchOptions<T> = {},
  retried = false,
): Promise<AsyncData<T, FetchError | null>> => {
  const config = useRuntimeConfig();
  const { isNative } = useCapacitor();

  // Resolve URL to string
  const urlString = typeof url === 'string'
    ? url
    : typeof url === 'function'
      ? url()
      : url.value;

  // Use native HTTP for Capacitor apps to bypass CORS
  if (isNative) {
    return nativeApiFetch<T>(urlString, options, retried);
  }

  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined;

  const queryString = QueryString.stringify(options.query, {
    allowDots: true,
    arrayFormat: 'brackets',
  }) as UseFetchOptions<T>;

  // Checks if the URL already has query params ('?')
  const finalUrl = `${url}${queryString ? '?': ''}${queryString}`;

  const result = await useFetch<T>(finalUrl, {
    baseURL: config.public.apiBase,
    credentials: 'include',
    headers: {
      ...cleanHeaders(headers),
      ...(options.headers as Record<string, string> | undefined),
      'Content-Type': 'application/json',
    },
  });

  const error = result.error.value;
  if (error && (error.status || error.statusCode) === 401 && !retried) {
    const refreshed = await refreshToken(config.public.apiBase, headers);
    if (refreshed) return useApiFetch(url, options, true);
  }

  return result as AsyncData<T, FetchError | null>;
};
