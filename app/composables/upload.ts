/**
 * Upload utility for handling blob uploads to presigned URLs
 * Works on both web and native Capacitor platforms
 */

import { Capacitor, CapacitorHttp } from '@capacitor/core';

// Declare the global type for the original fetch stored before Capacitor patches it
declare global {
  interface Window {
    __originalFetch?: typeof fetch;
  }
}

/**
 * Convert Blob to base64 string (without data URL prefix)
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/webp;base64,")
      const base64 = dataUrl.split(',')[1];
      resolve(base64 || '');
    };
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload file using CapacitorHttp with base64 data
 * The 'file' dataType in CapacitorHttp expects base64-encoded content, not a file path
 */
async function uploadWithCapacitorHttpBase64(
  uploadUrl: string,
  base64Data: string,
  contentType: string,
  timeout: number,
): Promise<void> {
  console.log('Using CapacitorHttp.request() with base64 data');
  console.log('Base64 data length:', base64Data.length);
  console.log('Content-Type:', contentType);

  // CapacitorHttp's 'file' dataType expects base64-encoded binary data
  // It will decode the base64 and send the raw bytes
  const response = await CapacitorHttp.request({
    url: uploadUrl,
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    data: base64Data,
    dataType: 'file',
    connectTimeout: timeout,
    readTimeout: timeout,
  });

  console.log('CapacitorHttp response status:', response.status);
  console.log('CapacitorHttp response headers:', JSON.stringify(response.headers));

  if (response.status >= 200 && response.status < 300) {
    console.log('CapacitorHttp base64 upload successful!');
  } else {
    console.error('CapacitorHttp base64 upload failed! Status:', response.status);
    console.error('Response data:', response.data);
    throw new Error(`Upload failed with status ${response.status}: ${JSON.stringify(response.data)}`);
  }
}

/**
 * Upload a blob using Capacitor HTTP plugin with base64 encoding
 * This converts the blob to base64 and sends it using CapacitorHttp's 'file' dataType
 * which decodes base64 and sends raw binary bytes
 */
async function uploadWithCapacitorHttp(
  uploadUrl: string,
  blob: Blob,
  timeout: number,
): Promise<void> {
  console.log('=== CAPACITOR HTTP BASE64 UPLOAD DEBUG START ===');
  console.log('Upload URL:', uploadUrl);
  console.log('Blob type:', blob.type);
  console.log('Blob size:', blob.size, 'bytes');
  console.log('Blob size (KB):', (blob.size / 1024).toFixed(2), 'KB');
  console.log('Timeout:', timeout, 'ms');

  try {
    // Step 1: Convert blob to base64
    console.log('Converting blob to base64...');
    const base64Data = await blobToBase64(blob);
    console.log('Base64 length:', base64Data.length);

    // Step 2: Upload using CapacitorHttp with base64 data
    // The 'file' dataType will decode base64 and send raw bytes
    console.log('Uploading via CapacitorHttp with base64 data...');
    await uploadWithCapacitorHttpBase64(
      uploadUrl,
      base64Data,
      blob.type,
      timeout,
    );

    console.log('=== CAPACITOR HTTP BASE64 UPLOAD DEBUG END (SUCCESS) ===');
  } catch (error) {
    console.error('=== CAPACITOR HTTP ERROR ===');
    console.error('Error:', error);
    console.log('=== CAPACITOR HTTP BASE64 UPLOAD DEBUG END (ERROR) ===');
    throw error;
  }
}

/**
 * Upload a blob using XMLHttpRequest (for web platform)
 */
function uploadWithXHR(
  uploadUrl: string,
  blob: Blob,
  timeout: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('=== XHR UPLOAD DEBUG START ===');
    console.log('Upload URL:', uploadUrl);
    console.log('Blob type:', blob.type);
    console.log('Blob size:', blob.size, 'bytes');
    console.log('Blob size (KB):', (blob.size / 1024).toFixed(2), 'KB');
    console.log('Timeout:', timeout, 'ms');

    const xhr = new XMLHttpRequest();

    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', blob.type);
    xhr.timeout = timeout;

    xhr.onload = () => {
      console.log('XHR upload response status:', xhr.status);
      if (xhr.status >= 200 && xhr.status < 300) {
        console.log('XHR upload successful!');
        resolve();
      } else {
        console.error('XHR upload failed! Status:', xhr.status);
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => {
      console.error('XHR upload network error');
      reject(new Error('Upload failed due to network error'));
    };

    xhr.ontimeout = () => {
      console.error('XHR upload timeout');
      reject(new Error('Upload timed out'));
    };

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        console.log(`Upload progress: ${percentComplete}%`);
      }
    };

    xhr.send(blob);
  });
}

/**
 * Upload a blob to a presigned URL
 * Uses Capacitor HTTP plugin directly on native platforms (Android/iOS) with file-based upload
 * Uses the original (unpatched) fetch on web platforms
 *
 * This is necessary because Capacitor's HTTP plugin patches fetch/XHR and doesn't
 * handle binary Blob uploads correctly - it sends empty data {}
 *
 * @param uploadUrl - The presigned URL to upload to
 * @param blob - The blob to upload
 * @param timeout - Upload timeout in milliseconds (default: 60000)
 */
export async function uploadToPresignedUrl(
  uploadUrl: string,
  blob: Blob,
  timeout = 60000,
): Promise<void> {
  console.log('=== UPLOAD TO PRESIGNED URL START ===');
  console.log('Upload URL:', uploadUrl);
  console.log('Blob type:', blob.type);
  console.log('Blob size:', blob.size);
  console.log('Platform:', Capacitor.getPlatform());
  console.log('Is native:', Capacitor.isNativePlatform());

  // On native platforms (Android/iOS), use Capacitor HTTP plugin directly
  // with file-based upload to properly send binary content
  if (Capacitor.isNativePlatform()) {
    console.log('Using Capacitor HTTP plugin for native platform upload');
    return uploadWithCapacitorHttp(uploadUrl, blob, timeout);
  }

  // On web, try to use the original fetch that was stored before Capacitor patched it
  // Fall back to XMLHttpRequest if original fetch is not available
  const originalFetch = window.__originalFetch;

  if (!originalFetch) {
    console.warn('Original fetch not available on web, using XMLHttpRequest as fallback');
    return uploadWithXHR(uploadUrl, blob, timeout);
  }

  console.log('Using original fetch for web platform upload');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // Use the original (unpatched) fetch for binary uploads
    const response = await originalFetch(uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: {
        'Content-Type': blob.type,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log('Upload response status:', response.status);

    if (!response.ok) {
      const responseText = await response.text();
      console.error('Upload failed response:', responseText);
      throw new Error(`Upload failed with status ${response.status}: ${responseText}`);
    }

    console.log('Upload successful');
    console.log('=== UPLOAD TO PRESIGNED URL END (SUCCESS) ===');
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Upload timed out');
    }
    console.error('Upload error:', error);
    console.log('=== UPLOAD TO PRESIGNED URL END (ERROR) ===');
    throw error;
  }
}
