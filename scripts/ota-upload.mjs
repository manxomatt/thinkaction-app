import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

// Load .env file if exists
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

const bucket = process.env.S3_BUCKET;
const region = process.env.S3_REGION || 'ap-southeast-1';
const prefix = process.env.S3_PREFIX || 'ota';

if (!bucket) {
  console.error('ERROR: S3_BUCKET environment variable is required');
  process.exit(1);
}

const client = new S3Client({ 
  region: region,
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true, 
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

const version = process.env.OTA_VERSION || pkg.version;

async function run() {
  // Upload versioned ZIP file
  const baseZipFile = process.env.OTA_ZIP || 'dist.zip';
  const zipExt = path.extname(baseZipFile);
  const zipBaseName = path.basename(baseZipFile, zipExt);
  const zipPath = `${prefix}/${zipBaseName}-${version}${zipExt}`;

  if (!fs.existsSync(zipPath)) {
    console.error(`ZIP file ${zipPath} not found. Run 'bun run ota:package' first.`);
    process.exit(1);
  }

  const zipBody = fs.readFileSync(zipPath);
  const zipKey = `${zipPath}`;
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: zipKey,
    Body: zipBody,
    ContentType: 'application/zip',
    ACL: 'public-read',
  }));
  console.log('Uploaded', zipKey);

  const manifest = {
    version,
    date: new Date().toISOString(),
    url: `${process.env.S3_PUBLIC_DOMAIN}/${zipKey}`,
  };

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: `${prefix}/manifest.json`,
    Body: JSON.stringify(manifest),
    ContentType: 'application/json',
    ACL: 'public-read',
  }));
  console.log('Uploaded manifest to', `${prefix}/manifest.json`);
  console.log('ZIP URL:', manifest.url);
}

run().catch(err => { console.error(err); process.exit(1); });
