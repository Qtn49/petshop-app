/**
 * Rasterizes public/logo.svg into PNGs and favicon.ico for metadata + browsers.
 * Run: npx tsx scripts/generate-favicon.ts
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import toIco from 'to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const logoSvg = path.join(root, 'public', 'logo.svg');

async function main() {
  const svg = await fs.readFile(logoSvg);

  const png32 = await sharp(svg).resize(32, 32).png().toBuffer();
  const png16 = await sharp(svg).resize(16, 16).png().toBuffer();
  const png180 = await sharp(svg).resize(180, 180).png().toBuffer();

  await fs.writeFile(path.join(root, 'public', 'logo.png'), png32);
  await fs.writeFile(path.join(root, 'public', 'apple-touch-icon.png'), png180);

  const ico = await toIco([png16, png32]);
  await fs.writeFile(path.join(root, 'public', 'favicon.ico'), ico);

  console.log('Wrote public/logo.png (32×32), public/apple-touch-icon.png (180×180), public/favicon.ico');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
