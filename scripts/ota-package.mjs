import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import archiver from 'archiver';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const distDir = process.env.OTA_DIST_DIR || '.output/public';
const baseOutFile = process.env.OTA_ZIP || 'dist.zip';
const ext = path.extname(baseOutFile);
const baseName = path.basename(baseOutFile, ext);
const outFile = `${baseName}-${pkg.version}${ext}`;

if (!fs.existsSync(distDir)) {
  console.error(`Directory ${distDir} not found — run 'bun run generate' first.`);
  process.exit(1);
}

async function zipDir(sourceDir, outPath) {
  const output = fs.createWriteStream(outPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', () => resolve());
    archive.on('error', err => reject(err));
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

zipDir(distDir, outFile)
  .then(() => console.log('Packaged', outFile))
  .catch(err => { console.error(err); process.exit(1); });
