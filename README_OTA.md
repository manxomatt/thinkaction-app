# OTA (Over-The-Air) Updates - Self-hosted Setup

## Overview

This project uses a self-hosted OTA approach with `@capgo/capacitor-updater` plugin. Generated `dist` files are uploaded to S3 and a `manifest.json` is published. The Nuxt client checks `manifest.json` and will attempt to trigger the native hot-code-push plugin if available.

## Prerequisites

1. AWS credentials configured (environment variables or AWS profile)
2. S3 bucket with public read access (or CloudFront distribution)
3. `@capgo/capacitor-updater` plugin installed

## Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Build Static Bundle

```bash
bun run ota:prepare
```

This runs `nuxt generate` to create the static bundle in `.output/public`.

### 3. Package the Bundle

```bash
bun run ota:package
```

This creates a versioned ZIP file (e.g., `dist-1.0.0.zip`) from the generated output.

### 4. Upload to S3

Set the required environment variables and run:

```bash
S3_BUCKET=your-bucket S3_REGION=ap-southeast-1 bun run ota:upload
```

Or add them to your `.env` file:

```env
S3_BUCKET=thinkaction-ota
S3_REGION=ap-southeast-1
S3_PREFIX=thinkaction
OTA_MANIFEST_URL=https://pointhub-s3.s3.ap-southeast-1.amazonaws.com/thinkaction/manifest.json
```

### 5. One-Command Deploy

To do all steps at once:

```bash
S3_BUCKET=your-bucket bun run ota:deploy
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `S3_BUCKET` | S3 bucket name (required) | - |
| `S3_REGION` | AWS region | `ap-southeast-1` |
| `S3_PREFIX` | S3 key prefix | `ota` |
| `OTA_VERSION` | Override version from package.json | `package.json version` |
| `OTA_DIST_DIR` | Source directory to package | `.output/public` |
| `OTA_ZIP` | Base name for ZIP file | `dist.zip` |
| `OTA_MANIFEST_URL` | URL to manifest.json | Auto-generated from S3 config |
| `OTA_CHECK_INTERVAL` | Seconds between update checks (0 = disabled) | `0` |

### Nuxt Runtime Config

In `nuxt.config.ts`:

```typescript
runtimeConfig: {
  public: {
    appVersion: pkg.version,
    otaManifestUrl: process.env.OTA_MANIFEST_URL || 'https://your-bucket.s3.region.amazonaws.com/ota/manifest.json',
    otaCheckInterval: Number(process.env.OTA_CHECK_INTERVAL) || 0,
  },
},
```

### Capacitor Config

In `capacitor.config.ts`:

```typescript
plugins: {
  CapacitorUpdater: {
    // IMPORTANT: autoUpdate must be false for self-hosted S3 manifests
    // The native plugin sends POST requests, but S3 only accepts GET.
    autoUpdate: false,
    appReadyTimeout: 10000,
    responseTimeout: 20,
    autoDeleteFailed: true,
    autoDeletePrevious: false,
    updateUrl: process.env.OTA_MANIFEST_URL || 'https://your-bucket.s3.region.amazonaws.com/ota/manifest.json',
    defaultChannel: 'default',
  },
},
```

> **Note**: The native `autoUpdate` feature is disabled because it sends POST requests to the `updateUrl`, but S3 only accepts GET requests (HTTP 405 error). The JavaScript plugin (`ota.client.ts`) handles updates using GET requests instead.

## How It Works

1. **On App Start**: The OTA plugin (`app/plugins/ota.client.ts`) runs and:
   - Calls `notifyAppReady()` to prevent rollback
   - Checks for updates via the manifest URL
   - If an update is available, prompts the user to download

2. **Update Flow**:
   - Plugin fetches `manifest.json` from S3
   - Compares `manifest.version` with `appVersion` from runtime config
   - If different, downloads the ZIP bundle
   - Applies the update using `CapacitorUpdater.set()`
   - App reloads with new version

3. **Fallback**: If the native plugin is not available (e.g., running in browser), it falls back to opening the update URL in the browser.

## Manifest Format

The `manifest.json` uploaded to S3 has this structure:

```json
{
  "version": "1.0.1",
  "date": "2024-01-15T10:30:00.000Z",
  "url": "https://bucket.s3.region.amazonaws.com/ota/1.0.1/dist-1.0.1.zip"
}
```

## Versioning

- Version is read from `package.json`
- Bump version before deploying: `npm version patch|minor|major`
- Or set `OTA_VERSION` environment variable to override

## S3 Bucket Setup

1. Create an S3 bucket
2. Enable public access or use CloudFront
3. Add bucket policy for public read:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket/ota/*"
    }
  ]
}
```

## Troubleshooting

### HTTP 405 Error / "response_error" from CapgoUpdater
- This occurs when `autoUpdate: true` is set with an S3-hosted manifest
- The native plugin sends POST requests, but S3 only accepts GET
- **Solution**: Set `autoUpdate: false` in `capacitor.config.ts`
- The JavaScript plugin (`ota.client.ts`) will handle updates using GET requests

### Update not detected
- Check that `manifest.json` is accessible (try opening URL in browser)
- Verify version in `manifest.json` differs from `package.json`
- Check browser console for errors

### Update fails to apply
- Ensure ZIP file is publicly accessible
- Check that ZIP contains the correct structure (files at root, not in subfolder)
- Verify `notifyAppReady()` is called to prevent rollback

### Native plugin not working
- Run `cap sync` after installing the plugin
- Check native logs (Android Studio / Xcode) for errors
- Ensure `autoUpdate: true` in capacitor config

## Scripts Reference

| Script | Description |
|--------|-------------|
| `bun run ota:prepare` | Generate static bundle |
| `bun run ota:package` | Create versioned ZIP |
| `bun run ota:upload` | Upload to S3 |
| `bun run ota:deploy` | All of the above |
