import { useRuntimeConfig } from 'nuxt/app';
import type { FetchError, FetchOptions, FetchRequest } from 'ofetch';
import qs from 'qs';
import { CapacitorHttp, type HttpResponse } from '@capacitor/core';
import { useCapacitor, getAuthToken, setAuthToken, setRefreshToken } from './capacitor';

// --- Helper Function: Refresh Token (Native) ---
async function refreshAccessTokenNative(): Promise<boolean> {
  try {
    const config = useRuntimeConfig();
    const authToken = await getAuthToken();

    const response = await CapacitorHttp.post({
      url: `${config.public.apiBase}/auth/refresh`,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      connectTimeout: 30000,
      readTimeout: 30000,
    });

    if (response.status >= 400) {
      console.warn('🚫 Token refresh failed (native)');
      return false;
    }

    // Store new tokens if provided
    if (response.headers?.['x-access-token']) {
      await setAuthToken(response.headers['x-access-token']);
    }
    if (response.headers?.['x-refresh-token']) {
      await setRefreshToken(response.headers['x-refresh-token']);
    }

    console.info('🔁 Token refreshed successfully (native)');
    return true;
  } catch {
    console.warn('🚫 Token refresh failed (native)');
    return false;
  }
}

// --- Helper Function: Refresh Token (Web) ---
async function refreshAccessToken(): Promise<boolean> {
  try {
    await $fetch('/auth/refresh', {
      baseURL: useRuntimeConfig().public.apiBase,
      method: 'POST',
      credentials: 'include',
    });
    console.info('🔁 Token refreshed successfully');
    return true;
  } catch {
    console.warn('🚫 Token refresh failed');
    return false;
  }
}

// --- Native API Fetch using Capacitor HTTP ---
async function nativeApiFetch<T>(
  url: string,
  options: FetchOptions = {},
  hasRetried = false,
): Promise<T> {
  const config = useRuntimeConfig();
  const { query, body, method = 'GET', headers = {} } = options;

  // Build full URL with query params
  let fullUrl = `${config.public.apiBase}${url}`;

  if (query && Object.keys(query).length > 0) {
    const queryString = qs.stringify(query, {
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

  let response: HttpResponse;

  switch (method.toUpperCase()) {
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
    const error = {
      status: response.status,
      statusCode: response.status,
      data: response.data,
      message: response.data?.message || 'Request failed',
    };

    // Handle token expiration (401)
    if (response.status === 401 && !hasRetried && url !== '/auth/refresh') {
      console.warn('Token expired, attempting refresh... (native)');
      const refreshed = await refreshAccessTokenNative();
      if (refreshed) {
        console.info('Token refreshed, retrying original request... (native)');
        return nativeApiFetch<T>(url, options, true);
      }
    }

    throw error;
  }

  return response.data as T;
}

// --- Main API Fetch Wrapper ---
export async function useApiClientFetch<T>(
  url: FetchRequest,
  options: FetchOptions = {},
  hasRetried = false,
): Promise<T> {
  const config = useRuntimeConfig();
  const { isNative } = useCapacitor();

  // Use native HTTP for Capacitor apps to bypass CORS
  if (isNative) {
    const urlString =
      typeof url === 'string'
        ? url
        : url instanceof URL
          ? url.pathname + url.search
          : (url as Request).url;
    return nativeApiFetch<T>(urlString, options, hasRetried);
  }

  // 1. Separate 'query' from other options
  // We need to handle query parameters manually before $fetch
  const { query, ...otherOptions } = options;

  let finalUrl: FetchRequest = url;

  // 2. Serialize query parameters using qs if they exist
  if (query && Object.keys(query).length > 0) {
    const queryString = qs.stringify(query, {
      // Crucial: Use dot notation for serialization
      allowDots: true,
      // arrayFormat: 'brackets' is a good default for arrays (e.g., ids[]=1&ids[]=2)
      arrayFormat: 'brackets',
    });

    // Append the serialized string directly to the URL
    // Make sure we work with a string representation of the request (handles string | URL | Request)
    const urlString =
      typeof url === 'string'
        ? url
        : url instanceof URL
          ? url.toString()
          : (url as Request).url;

    // Checks if the URL already has query params ('?')
    finalUrl = `${urlString}${urlString.includes('?') ? '&' : '?'}${queryString}`;
  }

  // 3. Construct merged options for $fetch
  const mergedOptions: FetchOptions = {
    baseURL: config.public.apiBase,
    credentials: 'include',
    // Remaining options (data, method, headers, etc.)
    ...otherOptions,
  };

  try {
    // 4. Execute $fetch with the modified URL
    return await $fetch<T>(finalUrl, mergedOptions as Record<string, unknown>);
  } catch (error) {
    const err = error as FetchError;

    // If refresh endpoint itself failed → don't retry
    if (url === '/auth/refresh') throw err;

    // Handle token expiration (401)
    const isUnauthorized = err.status === 401 || err.statusCode === 401;
    if (!isUnauthorized || hasRetried) throw err;

    console.warn('Token expired, attempting refresh...');

    // Attempt refresh once
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      console.error('Token refresh failed — user must reauthenticate');
      throw err;
    }

    console.info('Token refreshed, retrying original request...');
    // Retries the call with the original URL and options (including the query object)
    return useApiClientFetch<T>(url, options, true);
  }
}
